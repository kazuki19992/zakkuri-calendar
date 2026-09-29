# 予定モデル・SQLite schema v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存予定を失わずに、複数日予定、場所、プレーンテキストメモ、固定色、複数通知、繰り返し規則、カレンダー既定色、最後に開いた編集タブをdomainとSQLiteへ保存できるようにする。

**Architecture:** `CalendarEvent`は予定本体のmetadataを持ち、通知は`EventAggregate`の子要素として分離する。`EventRepository`が予定行と通知行を`AppDatabase.exclusiveTransaction`内で一体保存し、期間一覧は通知を読み込まない。schema version 2はnullable列と安全な既定値付き列だけを追加し、既存のschema version 1データを非破壊で移行する。

**Tech Stack:** TypeScript 6、Expo SDK 57、expo-sqlite 57、date-fns 4、Jest 29、React Native 0.86

**Spec:** `docs/superpowers/specs/2026-09-25-calendar-event-editor-expansion-design.md`

## Global Constraints

- 端末内SQLiteを唯一の永続状態とし、タイトル、場所、メモ、保存JSONをログや例外文へ含めない。
- 既存の`exact`、`allDay`、`fuzzy`予定とschema version 1データを失わない。
- runtime値はすべてbound parameterで渡し、transaction内ではcallbackへ渡された`AppDatabase`だけを使う。
- Stage 3では入力項目と画面構成を変えず、繰り返し発生回の展開と追加項目の編集UIはStage 4へ残す。
- 色IDは固定パレットの安定IDを使い、未知値はカレンダー既定色へ安全にfallbackする。
- 日付計算に固定ミリ秒加算を使わず、既存のcalendar date境界とdate-fnsを使う。
- 依存パッケージを追加しない。

---

### Task 1: 色ID、繰り返し規則、予定metadata、通知集約をdomainへ追加する

**Files:**
- Create: `src/domain/calendar/event-color.ts`
- Create: `src/domain/calendar/recurrence.ts`
- Create: `src/domain/calendar/event-reminder.ts`
- Modify: `src/constants/event-colors.ts`
- Modify: `src/domain/calendar/calendar.ts`
- Modify: `src/domain/calendar/event.ts`
- Modify: `src/domain/calendar/repositories.ts`
- Modify: `src/domain/calendar/time.ts`
- Test: `src/domain/calendar/__tests__/event-color.test.ts`
- Test: `src/domain/calendar/__tests__/recurrence.test.ts`
- Test: `src/domain/calendar/__tests__/event-reminder.test.ts`
- Test: `src/domain/calendar/__tests__/calendar.test.ts`
- Test: `src/domain/calendar/__tests__/event.test.ts`
- Test: `src/domain/calendar/__tests__/time.test.ts`

**Interfaces:**
- Produces: `EventColorId`、`DEFAULT_EVENT_COLOR_ID`、`parseEventColorId(value)`。
- Produces: `RecurrenceRuleV1`と`parseRecurrenceRule(value)`。不正値は`Result`のfailureとし、永続化境界が`null`へfallbackできるようにする。
- Produces: `EventReminder`、`EventAggregate`、`parseEventReminder(value)`、`normalizeEventReminders(eventId, reminders)`。
- Produces: `Calendar.colorId`、`CalendarEvent.location`、`notes`、`colorId`、`recurrenceRule`、all-dayの包含終了日`endDate`。
- Produces: `EventEditorTab = 'fuzzy' | 'exact'`と、wall-clockの開始日・時刻／終了日・時刻から24時間超のfixed durationを作る`createFixedDurationFromDateTimes(...)`。
- Changes: `EventRepository.create/update`は`EventAggregate`、`getById`は`EventAggregate | null`を扱い、`listByAnchorRange`は`CalendarEvent[]`のまま維持する。

- [x] **Step 1: 色IDとカレンダー既定色の失敗テストを書く**

```ts
expect(parseEventColorId('blue')).toEqual({ ok: true, value: 'blue' });
expect(parseEventColorId('removed-color').ok).toBe(false);
expect(createDefaultCalendar('Asia/Tokyo', now)).toMatchObject({ colorId: 'blue' });
```

- [x] **Step 2: 色IDテストを実行して未実装で失敗することを確認する**

Run: `npm test -- src/domain/calendar/__tests__/event-color.test.ts src/domain/calendar/__tests__/calendar.test.ts --runInBand`

Expected: FAIL because `event-color.ts` and `Calendar.colorId` do not exist.

- [x] **Step 3: domain色IDを実装し、表示パレットから再exportする**

```ts
export const EVENT_COLOR_IDS = ['blue', 'teal', 'green', 'ochre', 'orange', 'red', 'purple', 'gray'] as const;
export type EventColorId = (typeof EVENT_COLOR_IDS)[number];
export const DEFAULT_EVENT_COLOR_ID: EventColorId = 'blue';
```

`src/constants/event-colors.ts`はdomainのID・型・既定値をimportして表示色registryだけを保持し、既存import互換のため3つを再exportする。

- [x] **Step 4: 繰り返し規則の失敗テストを書く**

```ts
const weekly = {
  version: 1, frequency: 'weekly', interval: 2, weekdays: [1, 3], end: { type: 'count', count: 8 },
};
expect(parseRecurrenceRule(weekly)).toEqual({ ok: true, value: weekly });
expect(parseRecurrenceRule({ ...weekly, interval: 0 }).ok).toBe(false);
expect(parseRecurrenceRule({ ...weekly, weekdays: [1, 7] }).ok).toBe(false);
expect(parseRecurrenceRule({ ...weekly, end: { type: 'until', date: '2026-02-30' } }).ok).toBe(false);
```

- [x] **Step 5: 繰り返し規則のversion、頻度、間隔、曜日、終了条件を検証する**

`frequency`は`daily | weekly | monthly | yearly`、`interval`とcountは正の整数、weekdayは0〜6、untilは実在する`yyyy-MM-dd`とする。曜日は重複を除去して昇順へ正規化し、weekly以外は空配列へ正規化する。

- [x] **Step 6: 通知と集約の失敗テストを書く**

```ts
const reminders = normalizeEventReminders('event-1', [
  { id: 'r2', eventId: 'event-1', minutesBefore: 30, sortOrder: 9 },
  { id: 'r1', eventId: 'event-1', minutesBefore: 10, sortOrder: 4 },
  { id: 'duplicate', eventId: 'event-1', minutesBefore: 30, sortOrder: 10 },
]);
expect(reminders).toEqual({ ok: true, value: [
  { id: 'r1', eventId: 'event-1', minutesBefore: 10, sortOrder: 0 },
  { id: 'r2', eventId: 'event-1', minutesBefore: 30, sortOrder: 1 },
] });
expect(parseEventReminder({ id: 'r', eventId: 'event-1', minutesBefore: -1, sortOrder: 0 }).ok).toBe(false);
```

- [x] **Step 7: `EventReminder`と`EventAggregate`を実装する**

`normalizeEventReminders`は`Result<readonly EventReminder[], EventValidationError>`を返す。入力`sortOrder`、次にIDで安定sortし、同じ`minutesBefore`の2件目以降を除外して、0始まりの連続`sortOrder`を付ける。event ID不一致や不正整数はfailureとして保存前に拒否する。

- [x] **Step 8: 拡張予定モデルの失敗テストを書く**

```ts
expect(parseEventDraft({ ...base, temporalType: 'allDay', endDate: '2026-10-03',
  location: null, notes: null, colorId: null, recurrenceRule: null }).ok).toBe(true);
expect(parseEventDraft({ ...base, temporalType: 'allDay', endDate: '2026-09-30',
  location: null, notes: null, colorId: null, recurrenceRule: null }).ok).toBe(false);
expect(parseExactDuration({ type: 'fixed', minutes: 3 * 24 * 60 }).ok).toBe(true);
expect(createFixedDurationFromDateTimes('2026-09-30', '23:30', '2026-10-02', '00:30'))
  .toEqual({ ok: true, value: { type: 'fixed', minutes: 1500 } });
```

- [x] **Step 9: 予定metadataと複数日validationを実装する**

`location`と`notes`は空白だけなら`null`、それ以外は元の文字列を保持する。`colorId`は`null`または既知ID、`recurrenceRule`は`null`またはV1規則とし、`until.date`は予定の`anchorDate`以降を必須とする。all-dayの`endDate`は`anchorDate`以降、fixed durationは1以上のsafe integerへ上限を広げる。`createFixedDurationFromDateTimes`はcalendar dateの日数差とwall-clock分の差からdurationを作り、終了が開始以下ならfailureを返す。既存作成hookが新規fieldを明示できるよう、`createCalendarEvent`の入力は正規化済み`EventDraft`を受ける。

- [x] **Step 10: domainテストを実行する**

Run: `npm test -- src/domain/calendar/__tests__/event-color.test.ts src/domain/calendar/__tests__/recurrence.test.ts src/domain/calendar/__tests__/event-reminder.test.ts src/domain/calendar/__tests__/calendar.test.ts src/domain/calendar/__tests__/event.test.ts src/domain/calendar/__tests__/time.test.ts --runInBand`

Expected: PASS.

- [x] **Step 11: domain変更をコミットする**

```bash
git add src/domain/calendar src/constants/event-colors.ts
git commit -m "feat(events): 予定metadataと通知集約を追加"
```

---

### Task 2: schema version 2 migrationとrow mapperを追加する

**Files:**
- Modify: `src/data/sqlite/migrations.ts`
- Modify: `src/data/sqlite/row-mappers.ts`
- Test: `src/data/sqlite/__tests__/migrations.test.ts`
- Test: `src/data/sqlite/__tests__/row-mappers.test.ts`

**Interfaces:**
- Consumes: Task 1の`EventColorId`、`RecurrenceRuleV1`、`EventReminder`、拡張`CalendarEvent`。
- Produces: `LATEST_SCHEMA_VERSION = 2`、`ReminderRow`、`mapReminderRow(row)`。
- Produces: schema v1からv2への一回限りの非破壊migration。

- [x] **Step 1: schema v2 migrationの失敗テストを書く**

```ts
database.first.mockResolvedValue({ version: 1 });
await migrateDatabase(database.database, environment);
const sql = database.exec.mock.calls.map(([source]) => source).join('\n');
expect(sql).toContain('ALTER TABLE calendars ADD COLUMN color_id');
expect(sql).toContain('ALTER TABLE events ADD COLUMN end_date');
expect(sql).toContain('CREATE TABLE event_reminders');
expect(sql).toContain('ON DELETE CASCADE');
expect(database.run).toHaveBeenCalledWith(expect.stringContaining('schema_migrations'), {
  $version: 2, $appliedAt: environment.now(),
});
```

- [x] **Step 2: migrationテストを実行してversion 1のまま失敗することを確認する**

Run: `npm test -- src/data/sqlite/__tests__/migrations.test.ts --runInBand`

Expected: FAIL because schema version 2 SQL is absent.

- [x] **Step 3: ordered schema v2 migrationを実装する**

version 2で次を追加する。

```sql
ALTER TABLE calendars ADD COLUMN color_id TEXT NOT NULL DEFAULT 'blue';
ALTER TABLE events ADD COLUMN end_date TEXT;
ALTER TABLE events ADD COLUMN location TEXT;
ALTER TABLE events ADD COLUMN notes TEXT;
ALTER TABLE events ADD COLUMN color_id TEXT;
ALTER TABLE events ADD COLUMN recurrence_rule_json TEXT;
UPDATE events SET end_date = anchor_date WHERE temporal_type = 'allDay' AND end_date IS NULL;
CREATE TABLE event_reminders (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  minutes_before INTEGER NOT NULL CHECK (minutes_before >= 0),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  UNIQUE (event_id, minutes_before)
);
CREATE INDEX event_reminders_event_order_idx ON event_reminders(event_id, sort_order, id);
CREATE INDEX events_recurrence_anchor_idx ON events(calendar_id, anchor_date)
  WHERE recurrence_rule_json IS NOT NULL;
```

version 0ではv1を適用・記録してからv2を適用・記録し、version 1ではv2だけを適用する。各version rowは、そのversionのschema変更が完了した後に同じexclusive transaction内で記録する。

- [x] **Step 4: migrationの再実行・既存行保持テストを追加する**

version 2ではschema writeを行わないこと、version 1からのmigrationが既存eventsをDELETEしないこと、all-dayだけを`end_date = anchor_date`へ補完すること、失敗時にversion 2を記録しないことを検証する。

- [x] **Step 5: 拡張row mapperの失敗テストを書く**

```ts
expect(mapCalendarRow({ ...calendarRow, color_id: 'invalid' }).colorId).toBe('blue');
expect(mapEventRow({ ...eventRow, recurrence_rule_json: '{broken' }).recurrenceRule).toBeNull();
expect(() => mapEventRow({ ...allDayRow, end_date: null })).toThrow(CorruptDatabaseRowError);
expect(mapReminderRow({ id: 'r1', event_id: 'event-1', minutes_before: 30, sort_order: 0 }))
  .toEqual({ id: 'r1', eventId: 'event-1', minutesBefore: 30, sortOrder: 0 });
```

- [x] **Step 6: row型とmapperを実装する**

`CalendarRow`へ`color_id`、`EventRow`へ5列を追加する。予定色の未知値は`null`、calendar色の未知値は`DEFAULT_EVENT_COLOR_ID`、不正または未知versionの繰り返しJSONは`null`へfallbackする。all-day終了日、日時、通知整数など構造上壊れた行だけを本文非露出の`CorruptDatabaseRowError`にする。

- [x] **Step 7: SQLite境界テストを実行する**

Run: `npm test -- src/data/sqlite/__tests__/migrations.test.ts src/data/sqlite/__tests__/row-mappers.test.ts --runInBand`

Expected: PASS.

- [x] **Step 8: migrationとmapperをコミットする**

```bash
git add src/data/sqlite/migrations.ts src/data/sqlite/row-mappers.ts src/data/sqlite/__tests__/migrations.test.ts src/data/sqlite/__tests__/row-mappers.test.ts
git commit -m "feat(sqlite): schema version 2へ非破壊移行"
```

---

### Task 3: Repositoryへ予定集約のtransaction保存と新設定を追加する

**Files:**
- Modify: `src/data/sqlite/event-repository.ts`
- Modify: `src/data/sqlite/calendar-repository.ts`
- Modify: `src/data/sqlite/settings-repository.ts`
- Modify: `src/domain/calendar/repositories.ts`
- Test: `src/data/sqlite/__tests__/repositories.test.ts`

**Interfaces:**
- Consumes: `EventAggregate`、`EventReminder`、`EventEditorTab`、拡張row mapper。
- Produces: atomicな`create(aggregate)`、`getById(id)`、`update(aggregate)`、`delete(id)`。
- Produces: `CalendarRepository.setColor(id, colorId, updatedAt)`。
- Produces: `SettingsRepository.getLastEventEditorTab()`と`setLastEventEditorTab(tab, updatedAt)`。欠損・不正値は`fuzzy`。

- [x] **Step 1: 予定＋通知の作成transaction失敗テストを書く**

```ts
await repository.create({ event: exactEvent, reminders: [reminder30, reminder10] });
expect(db.exclusiveTransaction).toHaveBeenCalledTimes(1);
expect(db.run).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO events'),
  expect.objectContaining({ $location: '東京', $recurrenceRuleJson: expect.any(String) }));
expect(db.run).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO event_reminders'),
  expect.objectContaining({ $eventId: exactEvent.id, $minutesBefore: 10, $sortOrder: 0 }));
```

- [x] **Step 2: 作成テストを実行して旧契約で失敗することを確認する**

Run: `npm test -- src/data/sqlite/__tests__/repositories.test.ts --runInBand`

Expected: FAIL because `create` still accepts one event and does not open a transaction.

- [x] **Step 3: aggregate作成と単件取得を実装する**

`create`はtransaction handleへevent insert、正規化済みreminder insertを順に発行する。`getById`はeventを1件読み、存在時だけ次のbound queryで通知を取得する。

```sql
SELECT * FROM event_reminders
WHERE event_id = $eventId
ORDER BY sort_order, id
```

- [x] **Step 4: aggregate更新・削除の失敗テストを書く**

更新はevent UPDATE後に対象eventのreminderをDELETEし、新しい一覧をINSERTする。途中のinsert failureが`exclusiveTransaction`からrejectされることを検証する。削除は同じtransaction内でreminders、eventの順に明示DELETEし、他予定の通知へ触れないことを検証する。

- [x] **Step 5: aggregate更新・削除を実装する**

event UPDATEの`changes !== 1`はIDだけを含む固定エラーにする。すべてのruntime値をnamed bound parameterで渡し、repository本体のdatabaseではなくtransaction引数を使う。

- [x] **Step 6: 期間一覧の繰り返し候補queryテストを書く**

```ts
expect(sql).toContain('anchor_date >= $from AND anchor_date <= $through');
expect(sql).toContain('recurrence_rule_json IS NOT NULL AND anchor_date <= $through');
```

通常予定は従来の範囲、繰り返しシリーズは開始日がthrough以前なら返し、Stage 4の純粋展開関数へ渡せるようにする。

- [x] **Step 7: calendar色と最後の編集タブ設定テストを書く**

```ts
await calendars.setColor('personal-default', 'teal', now);
expect(db.run).toHaveBeenCalledWith(expect.stringContaining('UPDATE calendars'), {
  $id: 'personal-default', $colorId: 'teal', $updatedAt: now,
});
await expect(settings.getLastEventEditorTab()).resolves.toBe('fuzzy');
await settings.setLastEventEditorTab('exact', now);
expect(db.run).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT(key) DO UPDATE'), {
  $key: 'last_event_editor_tab', $valueJson: '"exact"', $updatedAt: now,
});
```

- [x] **Step 8: calendar色と編集タブ設定を実装する**

unknown色とunknown tabは保存前に拒否する。設定読込の欠損、不正JSON、`allDay`など未対応値は`fuzzy`へfallbackする。

- [x] **Step 9: Repositoryテストを実行する**

Run: `npm test -- src/data/sqlite/__tests__/repositories.test.ts --runInBand`

Expected: PASS.

- [x] **Step 10: Repository変更をコミットする**

```bash
git add src/domain/calendar/repositories.ts src/data/sqlite/event-repository.ts src/data/sqlite/calendar-repository.ts src/data/sqlite/settings-repository.ts src/data/sqlite/__tests__/repositories.test.ts
git commit -m "feat(sqlite): 予定と通知を一体で永続化"
```

---

### Task 4: 既存featureを新しいRepository契約へ追従させる

**Files:**
- Modify: `src/features/events/hooks/use-quick-create-event.ts`
- Modify: `src/features/events/hooks/use-event-editor.ts`
- Modify: `src/features/events/hooks/__tests__/use-quick-create-event.test.tsx`
- Modify: `src/features/events/hooks/__tests__/use-event-editor.test.tsx`
- Modify: `src/features/calendar/hooks/use-calendar-view.ts`
- Modify: `src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx`
- Modify: Calendar/Event fixtureを持つ既存`src/**/*.test.ts(x)`

**Interfaces:**
- Consumes: aggregate型Repositoryと`Calendar.colorId`。
- Produces: 現在の画面挙動を変えず、既存作成では空通知・既定metadataを保存し、編集では未表示metadataと通知を保持する。
- Produces: サイドメニューの色表示を固定`blue`ではなく永続化された`Calendar.colorId`へ接続する。

- [x] **Step 1: quick createのaggregate保存失敗テストを書く**

```ts
expect(repositories.events.create).toHaveBeenCalledWith({
  event: expect.objectContaining({
    temporalType: 'fuzzy', location: null, notes: null,
    colorId: null, recurrenceRule: null,
  }),
  reminders: [],
});
```

- [x] **Step 2: event editorのmetadata保持失敗テストを書く**

`getById`へ場所、メモ、色、繰り返し、通知を持つaggregateを返し、現在のタイトルだけを変更して保存したとき、`update`へ同じ非表示metadata・remindersが渡ることを検証する。

- [x] **Step 3: 既存作成・編集hookをaggregate契約へ追従させる**

新規予定は`location: null`、`notes: null`、`colorId: null`、`recurrenceRule: null`、空通知を使う。all-day新規は`endDate = anchorDate`。編集では`existingAggregate.event`をフォーム初期値に使い、現在の画面にないmetadataと`existingAggregate.reminders`をそのまま保持する。

- [x] **Step 4: calendar既定色の読込失敗テストを書く**

```ts
dependencies.calendars.getDefault.mockResolvedValue({ ...calendar, colorId: 'teal' });
await waitFor(() => expect(result.current.status).toBe('ready'));
expect(result.current.calendarColorId).toBe('teal');
```

- [x] **Step 5: calendar snapshotへ永続色を接続する**

`loadSnapshot`が取得した`calendar.colorId`をsnapshotへ保持し、`calendarColorId`へ返す。見た目は既定blueのまま変えず、保存済みの別色だけがサイドメニュー表示へ反映される。

- [x] **Step 6: すべての型付きfixtureを新しい必須fieldへ更新する**

Calendar fixtureには`colorId: 'blue'`、Event fixtureには`location: null`、`notes: null`、`colorId: null`、`recurrenceRule: null`を追加する。all-day fixtureには`endDate: anchorDate`を追加する。Repository mockの`getById`はaggregateを返す。

- [x] **Step 7: feature回帰テストを実行する**

Run: `npm test -- src/features/events/hooks/__tests__/use-quick-create-event.test.tsx src/features/events/hooks/__tests__/use-event-editor.test.tsx src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx --runInBand`

Expected: PASS.

- [x] **Step 8: feature追従をコミットする**

```bash
git add src/features src/app src/domain/temporal src/test
git commit -m "refactor(events): 既存画面を予定集約へ追従"
```

---

### Task 5: 保存仕様の文書化と全体検証を行う

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-09-07-zakkuri-calendar-mvp-design.md`
- Modify: `docs/superpowers/plans/2026-09-29-event-model-schema-v2.md`

**Interfaces:**
- Consumes: Tasks 1〜4の確定したschema・Repository契約。
- Produces: 実装済みStage 3と未実装Stage 4を区別した文書、検証証跡。

- [x] **Step 1: READMEとschema文書を更新する**

READMEへschema version 2、保存可能になった場所・メモ・色・通知・繰り返し規則、通知は端末へ発火しないことを追記する。予定編集UIと繰り返し展開は未実装と明記し、完成済みと誤読させない。

- [x] **Step 2: focused SQLite・domainテストを再実行する**

Run: `npm test -- src/domain/calendar src/data/sqlite --runInBand`

Expected: PASS with zero failing suites.

- [x] **Step 3: 全体検証を実行する**

Run: `npm run typecheck && npm run lint && npm test -- --runInBand && git diff --check`

Expected: all commands exit 0.

- [x] **Step 4: iOSとAndroidのstatic exportを順番に実行する**

Run: `npx expo export --platform ios`

Expected: exit 0 and `Exported: dist`.

Run: `npx expo export --platform android`

Expected: exit 0 and `Exported: dist`.

- [x] **Step 5: 実装計画のcheckboxと実際の差分を照合する**

各Taskの実施済みstepを`[x]`へ更新し、Stage 4のUI・繰り返し展開・端末通知が差分へ混入していないことを`git diff origin/develop...HEAD`で確認する。

- [x] **Step 6: 文書と計画をコミットする**

```bash
git add README.md docs/superpowers/specs/2026-09-07-zakkuri-calendar-mvp-design.md docs/superpowers/plans/2026-09-29-event-model-schema-v2.md
git commit -m "docs(events): schema version 2の保存範囲を記録"
```

- [ ] **Step 7: 独立コードレビュー後にpushしてPRを作成する**

レビューではmigrationの非破壊性、aggregate transaction、row fallback、既存UIのmetadata保持、個人データ非露出を重点確認する。Critical/Importantを解消して全体検証を取り直した後、`codex/event-model-schema-v2`をpushし、`develop`向け通常PRを日本語で作成する。
