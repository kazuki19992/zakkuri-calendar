# Recurrence Exceptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 繰り返し予定を「この予定」「これ以降」「すべて」の範囲で編集・削除し、単発例外とシリーズ分割をSQLiteへ安全に保存する。

**Architecture:** 例外の識別・表示合成・シリーズ分割計算はdomainの純粋関数へ置き、SQLite Repositoryはschema v4と排他transactionによる原子的更新を担う。カレンダーは予定・例外・置換予定のsnapshotからOccurrenceを展開し、編集画面はOccurrence identityと今回の変更フィールドを保持して保存・削除時だけ範囲選択を表示する。

**Tech Stack:** TypeScript 6、React 19、React Native 0.86、Expo SDK 57 / Expo Router、expo-sqlite、date-fns、Jest / Testing Library

**Spec:** `docs/superpowers/specs/2026-10-01-recurrence-exceptions-design.md`

## Global Constraints

- 通常・終日・ざっくり予定で同じOccurrence identityと範囲規則を使う。
- 単発例外は入れ子にせず、同じOccurrenceの再編集は同じ例外行を更新する。
- 「これ以降」は旧シリーズを境界直前で終了し、境界から通常の新シリーズを作る。
- 「すべて」は現在の分割後シリーズだけを対象にする。
- 規則変更時は「この予定」を選択不能にし、対象範囲の既存例外を確認後にリセットする。
- schema migrationはversion 4、再実行可能、既存予定を破壊しないものとする。
- 複数書き込みは1つのexclusive transactionで成功またはrollbackさせる。
- 依存パッケージは追加せず、Expo SDK 57の公式APIだけを使う。

## Review Focus

- 置換予定を元Occurrenceの範囲外へ移動しても、元Occurrenceを重複表示せず移動先に一度だけ表示する。
- 既存の単発例外から「これ以降」を選んでも、今回変更していない例外固有値をシリーズ全体へ広げない。
- 分割済みシリーズを再分割しても例外の入れ子・孤立・過去側への巻き戻りを作らない。
- `count`・`until`・先頭Occurrence境界でも重複・欠落を作らない。
- transaction途中の失敗または古い`updatedAt`では部分更新せず、編集内容を保持して競合を表示する。

---

### Task 1: 例外domain modelと表示合成

**Files:**
- Create: `src/domain/calendar/recurrence-exception.ts`
- Create: `src/domain/calendar/__tests__/recurrence-exception.test.ts`

**Interfaces:**
- Consumes: `CalendarEvent`、`EventAggregate`、`isCalendarDate`。
- Produces: `OccurrenceIdentity`、`EventOverrideField`、`RecurrenceException`、`CalendarScheduleSnapshot`、`parseRecurrenceException()`、`materializeOccurrenceReplacement()`。

- [x] **Step 1: parserと合成規則の失敗testを書く**

```ts
expect(parseRecurrenceException(validException).ok).toBe(true);
const actual = materializeOccurrenceReplacement({
  seriesEvent, replacementEvent, overrideFields: ['title'], occurrenceDate: '2026-10-05',
});
expect(actual.title).toBe(replacementEvent.title);
expect(actual.anchorDate).toBe('2026-10-05');
```

`deleted`/`replaced`の必須値、重複mask、無効日付、全mask、元Occurrenceの日付を保つケースも追加する。

- [x] **Step 2: `npm test -- src/domain/calendar/__tests__/recurrence-exception.test.ts --runInBand`を実行し、未実装exportでFAILすることを確認する**
- [x] **Step 3: 次の公開型を実装し、mask対象だけ置換予定から合成する**

```ts
export type OccurrenceIdentity = Readonly<{ seriesEventId: string; originalOccurrenceDate: string }>;
export type EventOverrideField = 'title' | 'temporal' | 'location' | 'notes' | 'color' | 'reminders';
export type RecurrenceException = OccurrenceIdentity & Readonly<{
  kind: 'deleted' | 'replaced'; replacementEventId: string | null;
  overrideFields: readonly EventOverrideField[]; createdAt: string; updatedAt: string;
}>;
export type CalendarScheduleSnapshot = Readonly<{
  events: readonly CalendarEvent[]; exceptions: readonly RecurrenceException[];
  replacementEvents: readonly CalendarEvent[];
}>;
```

- [x] **Step 4: 同じtest commandを実行してPASSを確認する**
- [x] **Step 5: `git commit -m "feat(domain): 繰り返し予定の例外モデルを追加"`で対象2 fileをcommitする**

### Task 2: 例外を考慮したOccurrence展開

**Files:**
- Modify: `src/domain/calendar/event-occurrence.ts`
- Modify: `src/domain/calendar/__tests__/event-occurrence.test.ts`

**Interfaces:**
- Consumes: Task 1の`CalendarScheduleSnapshot`、`OccurrenceIdentity`、`materializeOccurrenceReplacement()`。
- Produces: `expandEventOccurrences({ snapshot, from, through })`と`EventOccurrence.occurrenceIdentity`。

- [x] **Step 1: 削除・置換・範囲外移動の失敗testを書く**

```ts
const result = expandEventOccurrences({ snapshot, from: '2026-10-01', through: '2026-10-31' });
expect(result.ok && result.value.filter((item) => item.eventId === 'replacement-1')).toHaveLength(1);
expect(result.ok && result.value.find((item) => item.eventId === 'replacement-1')?.occurrenceIdentity)
  .toEqual({ seriesEventId: 'series-1', originalOccurrenceDate: '2026-10-12' });
```

元日付を消すこと、移動先だけ表示すること、非繰り返し予定の互換性も追加する。

- [x] **Step 2: `npm test -- src/domain/calendar/__tests__/event-occurrence.test.ts --runInBand`を実行し、旧APIまたは重複表示でFAILすることを確認する**
- [x] **Step 3: series展開後にidentityで例外を適用し、`deleted`を除外、`replaced`を合成して表示範囲を再判定する**

```ts
export type EventOccurrence = Readonly<{
  key: string; eventId: string; occurrenceIdentity: OccurrenceIdentity | null;
  occurrenceStartDate: string; occurrenceThroughDate: string;
  isRecurring: boolean; event: CalendarEvent;
}>;
```

- [x] **Step 4: 同じtest commandを実行してPASSを確認する**
- [x] **Step 5: `git commit -m "feat(domain): 繰り返し例外を予定展開へ反映"`でcommitする**

### Task 3: シリーズ範囲変更の純粋計算

**Files:**
- Create: `src/domain/calendar/recurrence-change.ts`
- Create: `src/domain/calendar/__tests__/recurrence-change.test.ts`
- Modify: `src/domain/calendar/event-occurrence.ts`

**Interfaces:**
- Consumes: `CalendarEvent`、`RecurrenceRuleV1`、`RecurrenceException`、Occurrence generator。
- Produces: `ChangedEventField`、`RecurrenceMutationScope`、`planFollowingMutation()`、`planSeriesMutation()`、`getChangedEventFields()`。

- [x] **Step 1: 分割・変更mask・end条件の失敗testを書く**

```ts
expect(getChangedEventFields(existingOccurrence, submittedDraft)).toEqual(['title']);
const plan = planFollowingMutation({ series, boundaryDate: '2026-10-12', submitted,
  exceptions, createSeriesId: () => 'series-2', now: NOW });
expect(plan.previousSeries?.event.recurrenceRule?.end).toEqual({ type: 'until', date: '2026-10-11' });
expect(plan.nextSeries?.event.anchorDate).toBe('2026-10-12');
```

週複数曜日、月末欠番、うるう日、`count`残数、`until`、先頭分割、再分割、既存override非伝播を追加する。

- [x] **Step 2: `npm test -- src/domain/calendar/__tests__/recurrence-change.test.ts --runInBand`を実行し、module未実装でFAILすることを確認する**
- [x] **Step 3: 次のplanを返す差分検出・分割・ordinal rekeyを実装する**

```ts
export type RecurrenceMutationPlan = Readonly<{
  removePreviousSeries: boolean;
  previousSeries: EventAggregate | null; nextSeries: EventAggregate | null;
  upsertExceptions: readonly RecurrenceException[];
  deleteExceptionIdentities: readonly OccurrenceIdentity[];
  deleteReplacementEventIds: readonly string[];
}>;
```

規則変更時は対象例外を削除対象へ入れ、規則未変更時だけ未来側を新シリーズへ転送する。

- [x] **Step 4: `npm test -- src/domain/calendar/__tests__/recurrence-change.test.ts src/domain/calendar/__tests__/event-occurrence.test.ts --runInBand`でPASSを確認する**
- [x] **Step 5: `git commit -m "feat(domain): 繰り返しシリーズの範囲変更を計画"`でcommitする**

### Task 4: SQLite schema v4と原子的Repository

**Files:**
- Modify: `src/data/sqlite/migrations.ts`
- Modify: `src/data/sqlite/row-mappers.ts`
- Modify: `src/data/sqlite/event-repository.ts`
- Modify: `src/domain/calendar/repositories.ts`
- Modify: `src/data/sqlite/__tests__/migrations.test.ts`
- Modify: `src/data/sqlite/__tests__/row-mappers.test.ts`
- Modify: `src/data/sqlite/__tests__/repositories.test.ts`

**Interfaces:**
- Consumes: Tasks 1-3のsnapshot、exception、mutation plan。
- Produces: `listSchedule()`、`getOccurrenceEditData()`、`saveOccurrenceException()`、`deleteOccurrenceException()`、`applyRecurrenceMutation()`。

- [x] **Step 1: schema・mapping・transactionの失敗testを書く**

```ts
expect(LATEST_SCHEMA_VERSION).toBe(4);
expect(database.transactionExec).toHaveBeenCalledWith(expect.stringContaining('recurrence_exceptions'));
await expect(events.listSchedule('personal-default', '2026-10-01', '2026-10-31'))
  .resolves.toEqual({ events: [series], exceptions: [exception], replacementEvents: [replacement] });
```

複合PK、replacement unique index、cascade、JSON mask、全例外取得、途中失敗rollback、`expectedUpdatedAt`不一致も追加する。

- [x] **Step 2: `npm test -- src/data/sqlite/__tests__/migrations.test.ts src/data/sqlite/__tests__/row-mappers.test.ts src/data/sqlite/__tests__/repositories.test.ts --runInBand`でschema v3と未実装APIによるFAILを確認する**
- [x] **Step 3: version 4 migrationとrow mapperを実装する**

```sql
CREATE TABLE IF NOT EXISTS recurrence_exceptions (
  series_event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  original_occurrence_date TEXT NOT NULL, kind TEXT NOT NULL,
  replacement_event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  override_fields_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (series_event_id, original_occurrence_date)
);
```

- [x] **Step 4: `EventRepository`へsnapshot読取と排他transaction commandを追加し、シリーズの`updated_at = expectedUpdatedAt`を最初に検査する**

```ts
listSchedule(calendarId: string, from: string, through: string): Promise<CalendarScheduleSnapshot>;
getOccurrenceEditData(identity: OccurrenceIdentity): Promise<OccurrenceEditData | null>;
saveOccurrenceException(command: SaveOccurrenceExceptionCommand): Promise<void>;
deleteOccurrenceException(command: DeleteOccurrenceExceptionCommand): Promise<void>;
applyRecurrenceMutation(command: ApplyRecurrenceMutationCommand): Promise<void>;
```

- [x] **Step 5: Step 2のtest commandを再実行してPASSを確認する**
- [x] **Step 6: `git commit -m "feat(sqlite): 繰り返し例外を原子的に永続化"`でcommitする**

### Task 5: カレンダーからOccurrence identityを編集画面へ渡す

**Files:**
- Modify: `src/features/calendar/hooks/use-calendar-view.ts`
- Modify: `src/features/calendar/calendar-view-model.ts`
- Modify: `src/features/calendar/timeline-layout.ts`
- Modify: `src/features/calendar/two-day-view-model.ts`
- Modify: `src/features/calendar/month-view-model.ts`
- Modify: `src/features/calendar/components/timeline-event-block.tsx`
- Modify: `src/features/calendar/components/two-day-column.tsx`
- Modify: `src/features/calendar/components/two-day-view.tsx`
- Modify: `src/features/calendar/components/selected-day-agenda.tsx`
- Modify: `src/features/calendar/screens/calendar-screen.tsx`
- Modify: `src/app/index.tsx`
- Modify: corresponding calendar tests and `src/app/__tests__/index.test.tsx`

**Interfaces:**
- Consumes: `listSchedule()`と`EventOccurrence.occurrenceIdentity`。
- Produces: `EventEditTarget { eventId, originalOccurrenceDate? }`を全viewからrouteへ渡す。

- [x] **Step 1: 月・2日・agenda・routeの失敗testを書く**

```ts
fireEvent.press(screen.getByLabelText('予定を編集'));
expect(onEditEvent).toHaveBeenCalledWith({ eventId: 'series-1', originalOccurrenceDate: '2026-10-12' });
expect(router.push).toHaveBeenCalledWith({ pathname: '/events/[id]',
  params: { id: 'series-1', occurrenceDate: '2026-10-12' } });
```

- [x] **Step 2: `npm test -- src/features/calendar src/app/__tests__/index.test.tsx --runInBand`で旧string callbackによるFAILを確認する**
- [x] **Step 3: 次のtargetをview model itemへ保持し、全Press handlerとrouteへ渡す**

```ts
export type EventEditTarget = Readonly<{ eventId: string; originalOccurrenceDate?: string }>;
```

`useCalendarView`は`listByAnchorRange()`を`listSchedule()`へ置換する。

- [x] **Step 4: Step 2のtest commandでPASSを確認する**
- [x] **Step 5: `git commit -m "feat(calendar): 繰り返しOccurrenceを編集対象として渡す"`でcommitする**

### Task 6: 編集hookのscope stateとRepository command

**Files:**
- Create: `src/features/events/recurrence-edit-model.ts`
- Create: `src/features/events/__tests__/recurrence-edit-model.test.ts`
- Modify: `src/features/events/hooks/use-event-editor.ts`
- Modify: `src/features/events/hooks/__tests__/use-event-editor.test.tsx`
- Modify: `src/app/events/[id].tsx`
- Modify: `src/app/events/__tests__/[id].test.tsx`

**Interfaces:**
- Consumes: Repository occurrence API、Task 3 planner、route `occurrenceDate`。
- Produces: `scopeRequest`、`selectScope()`、`cancelScope()`、`confirmExceptionReset()`。

- [x] **Step 1: state machineの失敗testを書く**

```ts
await act(async () => result.current.requestSave());
expect(result.current.scopeRequest?.options.map((item) => item.scope))
  .toEqual(['occurrence', 'following', 'series']);
act(() => result.current.cancelScope());
expect(result.current.scopeRequest).toBeNull();
expect(result.current.title).toBe('編集途中のタイトル');
```

規則変更時のoccurrence除外、reset確認、単発upsert/delete、following/series、競合時draft保持、二重tap防止を追加する。

- [x] **Step 2: `npm test -- src/features/events/__tests__/recurrence-edit-model.test.ts src/features/events/hooks/__tests__/use-event-editor.test.tsx src/app/events/__tests__/[id].test.tsx --runInBand`で未実装stateによるFAILを確認する**
- [x] **Step 3: 次のscope modelとcommand生成を実装する**

```ts
export type RecurrenceEditScope = 'occurrence' | 'following' | 'series';
export type ScopeRequest = Readonly<{
  operation: 'save' | 'delete';
  options: readonly Readonly<{ scope: RecurrenceEditScope; label: string }>[];
  needsExceptionResetConfirmation: boolean;
}>;
```

load時は元aggregateと現在例外を保持し、表示draftと元シリーズ値を分離する。scope確定後だけRepository commandを実行する。

- [x] **Step 4: Step 2のtest commandでPASSを確認する**
- [x] **Step 5: `git commit -m "feat(events): 繰り返し編集の範囲選択状態を追加"`でcommitする**

### Task 7: 範囲選択と例外reset確認UI

**Files:**
- Create: `src/features/events/components/recurrence-scope-dialog.tsx`
- Create: `src/features/events/components/__tests__/recurrence-scope-dialog.test.tsx`
- Modify: `src/features/events/components/delete-event-button.tsx`
- Modify: `src/features/events/screens/event-editor-screen.tsx`
- Modify: `src/features/events/screens/__tests__/event-editor-screen.test.tsx`
- Modify: `src/app/events/[id].tsx`

**Interfaces:**
- Consumes: Task 6の`ScopeRequest`とcallback。
- Produces: Save/Delete時だけ表示されるアクセシブルなscope dialog。

- [x] **Step 1: 表示・取消・選択・reset確認の失敗testを書く**

```ts
expect(screen.getByText('変更する範囲')).toBeTruthy();
fireEvent.press(screen.getByLabelText('キャンセル'));
expect(onCancel).toHaveBeenCalledTimes(1);
fireEvent.press(screen.getByLabelText('これ以降'));
expect(onSelect).toHaveBeenCalledWith('following');
```

削除copy、規則変更時の「この予定」非表示、44pt操作領域、busy時不可も追加する。

- [x] **Step 2: `npm test -- src/features/events/components/__tests__/recurrence-scope-dialog.test.tsx src/features/events/screens/__tests__/event-editor-screen.test.tsx --runInBand`で未実装componentによるFAILを確認する**
- [x] **Step 3: React Native `Modal`、theme token、Reduce Motion、Safe Areaを使ってdialogを実装する**

```tsx
<View accessibilityViewIsModal accessibilityLabel="変更する範囲">
  {request.options.map((option) => <Pressable key={option.scope}
    accessibilityRole="button" accessibilityLabel={option.label}
    onPress={() => onSelect(option.scope)}><Text>{option.label}</Text></Pressable>)}
</View>
```

- [x] **Step 4: `npm test -- src/features/events --runInBand`でPASSを確認する**
- [x] **Step 5: `git commit -m "feat(events): 繰り返し予定の編集範囲UIを追加"`でcommitする**

### Task 8: 全体検証・レビュー・PR

**Files:**
- Modify: `docs/superpowers/specs/2026-10-01-recurrence-exceptions-design.md` only if implementation naming differs while approved behavior remains unchanged
- Modify: `docs/superpowers/plans/2026-10-01-recurrence-exceptions.md`

**Interfaces:**
- Consumes: Tasks 1-7の完成状態。
- Produces: checked plan、全検証結果、`develop`向けOpen PR。

- [x] **Step 1: checkboxと設計用語を実装結果へ同期し、`rg -n 'T[B]D|PLACEHOLD[E]R|fill i[n]' docs/superpowers/specs/2026-10-01-recurrence-exceptions-design.md docs/superpowers/plans/2026-10-01-recurrence-exceptions.md`がmatchなしになることを確認する**
- [x] **Step 2: 全自動検証を実行する**

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
git diff --check
```

Expected: すべてexit 0。

- [x] **Step 3: fresh reviewerへ`origin/develop...HEAD`のschema、rollback、Occurrence重複、scope state、アクセシビリティを依頼し、有効な指摘を修正する**
- [x] **Step 4: Step 2の4 commandを再実行してすべてexit 0を確認する**
- [x] **Step 5: document差分があれば`git commit -m "docs: 繰り返し例外の実装結果を同期"`でcommitする**
- [ ] **Step 6: branchをpushし、目的・設計判断・影響範囲・検証・実機未確認項目・`Closes #26`を含む日本語PRを`develop`向けに作成する**
