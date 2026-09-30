# 複数日相対日付のざっくり予定 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 週・月の相対日付を解決済み期間として保存し、「今週中」の締切設定と2日・月表示を追加する。

**Architecture:** domainの純粋resolverを期間解決の唯一の正とし、SQLiteには解決済み開始・終了日とversion付きcontextを保存する。予定編集・設定・カレンダー表示はfeature hookで非同期処理を調整し、presentationへDB型や期間計算を漏らさない。

**Tech Stack:** TypeScript 6、React 19、React Native 0.86、Expo SDK 57、Expo Router、expo-sqlite、date-fns、Jest、Testing Library

**Spec:** `docs/superpowers/specs/2026-09-30-relative-fuzzy-dates-design.md`

## Global Constraints

- 通常開発のbaseは`develop`、実装branchは`codex/relative-fuzzy-dates`とする。
- 週の開始は月曜日、曜日値は相対日付ではISOの`1`から`7`を使う。
- 「今週中」の締切は`5 | 6 | 7`、既定値は金曜日の`5`とする。
- 設定変更は保存済み予定を更新しない。
- 複数日相対予定へ`RecurrenceRuleV1`を保存しない。
- 日付計算は固定ミリ秒ではなく`date-fns`のcalendar date操作を使う。
- SQLite変更はversion 3 migrationで非破壊・再実行可能にする。
- 文字・ラベル・形状・accessibility stateを併用し、色だけへ依存しない。
- 新しい依存パッケージは追加しない。

---

### Task 1: 相対期間resolverと標準定義

**Files:**
- Create: `src/domain/temporal/relative-date-resolution.ts`
- Create: `src/domain/temporal/__tests__/relative-date-resolution.test.ts`
- Modify: `src/domain/temporal/temporal-definition.ts`
- Modify: `src/domain/temporal/standard-definitions.ts`
- Modify: `src/domain/temporal/__tests__/temporal-definition.test.ts`
- Modify: `src/domain/temporal/__tests__/standard-definitions.test.ts`

**Interfaces:**
- Produces: `ThisWeekDeadlineWeekday`, `RelativeDateResolution`, `resolveRelativeDateRange(referenceDate, definition, deadlineWeekday)`.
- Produces: `WeekRemainderResolver` with `kind: 'weekRemainder'`.
- Consumed by: Tasks 2、4、5。

- [x] **Step 1: resolverの失敗テストを書く**

`relative-date-resolution.test.ts`へ、手計算したliteralを使って次を追加する。

```ts
expect(resolveRelativeDateRange('2026-09-30', nextWeekFirstHalf, 5)).toEqual({
  ok: true,
  value: {
    referenceDate: '2026-09-30',
    periodAnchorDate: '2026-10-05',
    startDate: '2026-10-05',
    endDate: '2026-10-07',
    parameterSnapshot: {},
  },
});
expect(resolveRelativeDateRange('2026-10-03', thisWeek, 5)).toMatchObject({
  ok: true,
  value: { startDate: '2026-10-03', endDate: '2026-10-03', parameterSnapshot: { thisWeekDeadlineWeekday: 5 } },
});
```

週の月末・年末、月初・上旬・中旬・下旬・月末・来月、閏年、不正日付、日内定義拒否も別testとして追加する。

- [x] **Step 2: REDを確認する**

Run: `npm test -- src/domain/temporal/__tests__/relative-date-resolution.test.ts --runInBand`

Expected: moduleまたはexportが存在せずFAIL。

- [x] **Step 3: resolverと新resolver kindを最小実装する**

`Result`を返す純粋関数とし、`startOfWeek(..., { weekStartsOn: 1 })`、`addDays`、`addMonths`、`startOfMonth`、`endOfMonth`を使う。`weekRemainder`では締切後なら基準日1日だけを返す。

- [x] **Step 4: 標準定義テストを先に更新しREDを確認する**

`this_week`を週定義の先頭へ追加し、labelは`今週中`、resolverは`{ kind: 'weekRemainder', selectionWeekOffset: 0 }`と期待する。

Run: `npm test -- src/domain/temporal/__tests__/standard-definitions.test.ts src/domain/temporal/__tests__/temporal-definition.test.ts --runInBand`

Expected: 新定義・新resolver parseが未実装のためFAIL。

- [x] **Step 5: 定義parseとseedを実装しGREENを確認する**

Run: `npm test -- src/domain/temporal/__tests__/relative-date-resolution.test.ts src/domain/temporal/__tests__/standard-definitions.test.ts src/domain/temporal/__tests__/temporal-definition.test.ts --runInBand`

Expected: PASS。

- [x] **Step 6: Task 1をコミットする**

```bash
git add src/domain/temporal
git commit -m "feat(temporal): 相対日付の期間解決を追加"
```

### Task 2: fuzzy期間modelと発生回

**Files:**
- Modify: `src/domain/calendar/event.ts`
- Modify: `src/domain/calendar/__tests__/event.test.ts`
- Modify: `src/domain/calendar/event-occurrence.ts`
- Modify: `src/domain/calendar/__tests__/event-occurrence.test.ts`
- Modify: fuzzy fixtureを持つ既存test files。

**Interfaces:**
- Consumes: Task 1の`ThisWeekDeadlineWeekday`。
- Produces: `FuzzyResolutionContextV1`、fuzzy eventの`endDate`と`resolutionContext`。
- Produces: fuzzyの包含期間を持つ`EventOccurrence`。
- Consumed by: Tasks 3、4、6。

- [x] **Step 1: event validationの失敗テストを書く**

日内fuzzyは`endDate === anchorDate`と`resolutionContext: null`、相対fuzzyは正しいversion・日付・締切曜日を受理することをtestする。終了日が開始日より前、contextの不正version・不正日付・不正曜日を拒否するtestも追加する。

- [x] **Step 2: REDを確認する**

Run: `npm test -- src/domain/calendar/__tests__/event.test.ts --runInBand`

Expected: 現行fuzzy型が新fieldを返さずFAIL。

- [x] **Step 3: event modelを最小実装する**

```ts
type FuzzyResolutionContextV1 = Readonly<{
  version: 1;
  referenceDate: string;
  periodAnchorDate: string;
  parameterSnapshot: Readonly<{ thisWeekDeadlineWeekday?: 5 | 6 | 7 }>;
}>;
```

parserはcontext単体の構造を検証し、定義granularityとの突合はfeature保存境界へ残す。

- [x] **Step 4: 発生回の失敗テストを書く**

`anchorDate: '2026-09-30'`、`endDate: '2026-10-02'`の非繰り返しfuzzyが3日間へ交差し、日内fuzzyは1日だけになることをtestする。

- [x] **Step 5: RED後にspan計算を実装してGREENを確認する**

Run: `npm test -- src/domain/calendar/__tests__/event.test.ts src/domain/calendar/__tests__/event-occurrence.test.ts --runInBand`

Expected: PASS。

- [x] **Step 6: 既存fixtureを新しいdomain contractへ機械的に更新する**

全fuzzy fixtureへ`endDate: anchorDate`と`resolutionContext: null`を加え、挙動expectationは変えない。

Run: `npm run typecheck`

Expected: PASS。

- [x] **Step 7: Task 2をコミットする**

```bash
git add src
git commit -m "feat(events): ざっくり予定に解決済み期間を保持"
```

### Task 3: schema version 3とRepository永続化

**Files:**
- Modify: `src/data/sqlite/migrations.ts`
- Modify: `src/data/sqlite/row-mappers.ts`
- Modify: `src/data/sqlite/event-repository.ts`
- Modify: `src/data/sqlite/settings-repository.ts`
- Modify: `src/domain/calendar/repositories.ts`
- Modify: `src/data/sqlite/__tests__/migrations.test.ts`
- Modify: `src/data/sqlite/__tests__/row-mappers.test.ts`
- Modify: `src/data/sqlite/__tests__/repositories.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2の型。
- Produces: schema version 3、`this_week_deadline_weekday`のtyped repository API。
- Produces: fuzzy context round-tripと交差範囲検索。
- Consumed by: Tasks 4–6。

- [x] **Step 1: migrationの失敗テストを書く**

version 2 DBへfuzzy rowを置いたfixtureからmigrationし、`end_date = anchor_date`、context列追加、全calendarへの`this_week`1件seed、version 3記録をassertする。再実行後も重複しないことを別testにする。

- [x] **Step 2: REDを確認する**

Run: `npm test -- src/data/sqlite/__tests__/migrations.test.ts --runInBand`

Expected: versionが2のまま、または列・定義がなくFAIL。

- [x] **Step 3: version 3 migrationを実装してGREENを確認する**

runtime値はbound parameterでinsertし、transaction handleだけを使う。

- [x] **Step 4: mapper・event repositoryの失敗テストを書く**

有効contextのround-trip、不正JSON拒否、exact/all-dayの不正context拒否、開始日が検索範囲より前でも`end_date`が交差する予定の取得をtestする。

- [x] **Step 5: RED後にmapper・SQLを実装する**

event insert/updateへ`fuzzy_resolution_context_json`を追加する。範囲条件は非繰り返しの交差と、繰り返し元予定の取得を括弧で分離する。

- [x] **Step 6: settings repositoryの失敗テストを書く**

未保存・不正JSON・`4`は`5`へfallbackし、`5 | 6 | 7`をround-tripし、setterが不正値を拒否することをtestする。

- [x] **Step 7: RED後にtyped settings APIを実装する**

Run: `npm test -- src/data/sqlite/__tests__/migrations.test.ts src/data/sqlite/__tests__/row-mappers.test.ts src/data/sqlite/__tests__/repositories.test.ts --runInBand`

Expected: PASS。

- [x] **Step 8: Task 3をコミットする**

```bash
git add src/data/sqlite src/domain/calendar/repositories.ts
git commit -m "feat(sqlite): 相対予定の期間と締切設定を保存"
```

### Task 4: 予定編集画面へ相対日付を接続

**Files:**
- Modify: `src/features/events/event-editor-model.ts`
- Modify: `src/features/events/__tests__/event-editor-model.test.ts`
- Modify: `src/features/events/hooks/use-event-editor.ts`
- Modify: `src/features/events/hooks/__tests__/use-event-editor.test.tsx`
- Modify: `src/features/events/components/temporal-definition-picker.tsx`
- Modify: `src/features/events/components/event-date-time-fields.tsx`
- Modify: `src/features/events/components/recurrence-editor.tsx`
- Modify: `src/features/events/screens/event-editor-screen.tsx`
- Modify: related component/screen tests。
- Modify: legacy quick-create fixtures only where domain contract requires it。

**Interfaces:**
- Consumes: resolver、fuzzy model、SettingsRepository。
- Produces: grouped definitions、resolved date preview、date/recurrence disabled state。
- Consumed by: routes unchanged。

- [x] **Step 1: editor modelの失敗テストを書く**

定義をgranularity順へgroup化し、相対定義のpreviewからfuzzy draftを作り、日内定義では1日fuzzy draftを作る純粋関数をtestする。

- [x] **Step 2: RED後に純粋変換を実装する**

Run: `npm test -- src/features/events/__tests__/event-editor-model.test.ts --runInBand`

Expected: PASS。

- [x] **Step 3: hookの失敗テストを書く**

全granularityを読み込むこと、相対定義選択で`isDateEditable`とrecurrenceが無効になること、preview表示値、保存payload、未変更編集で保存済みcontextを維持すること、設定変更が既存予定へ影響しないことをtestする。

- [x] **Step 4: RED後にhookを実装する**

初期loadでdefinitionsと締切設定を取得する。選択中定義・reference date・previewは同期的な純粋派生とし、保存時に同じresolverを通す。

- [x] **Step 5: componentの失敗テストを書く**

グループ見出し、selected state、disabled日付のaccessibility state、期間preview、繰り返し不可理由を実componentへassertする。

- [x] **Step 6: RED後にpresentationを実装してGREENを確認する**

Run: `npm test -- src/features/events --runInBand`

Expected: PASS。

- [x] **Step 7: Task 4をコミットする**

```bash
git add src/features/events
git commit -m "feat(events): 相対日付を予定編集へ追加"
```

### Task 5: 締切曜日の設定画面

**Files:**
- Create: `src/features/settings/hooks/use-relative-date-settings.ts`
- Create: `src/features/settings/hooks/__tests__/use-relative-date-settings.test.tsx`
- Modify: `src/features/settings/screens/settings-screen.tsx`
- Modify: `src/features/settings/screens/__tests__/settings-screen.test.tsx`
- Modify: `src/app/settings.tsx`
- Modify: `src/app/__tests__/settings.test.tsx`

**Interfaces:**
- Consumes: `SettingsRepository.get/setThisWeekDeadlineWeekday`。
- Produces: load/error/saving/value stateと金・土・日の選択UI。

- [x] **Step 1: hookの失敗テストを書く**

初期値読込、保存成功後だけvalue確定、保存失敗時の旧値維持、同期的な二重操作防止、unmount後更新防止をtestする。

- [x] **Step 2: RED後にhookを実装してGREENを確認する**

Run: `npm test -- src/features/settings/hooks/__tests__/use-relative-date-settings.test.tsx --runInBand`

Expected: PASS。

- [x] **Step 3: screen・routeの失敗テストを書く**

「ざっくり予定」「今週中の締切」、金・土・日、selected/disabled state、既存予定へ影響しない補足をassertする。routeはRepositoryを注入する。

- [x] **Step 4: RED後に設定UIを実装する**

設定画面風の区切り線レイアウトと44pt以上のPressableを使い、カードUIを追加しない。

Run: `npm test -- src/features/settings src/app/__tests__/settings.test.tsx --runInBand`

Expected: PASS。

- [x] **Step 5: Task 5をコミットする**

```bash
git add src/features/settings src/app/settings.tsx src/app/__tests__/settings.test.tsx
git commit -m "feat(settings): 今週中の締切曜日を追加"
```

### Task 6: 2日・月表示へ相対期間を描画

**Files:**
- Modify: `src/features/calendar/calendar-view-model.ts`
- Modify: `src/features/calendar/two-day-view-model.ts`
- Modify: `src/features/calendar/month-view-model.ts`
- Modify: related view-model tests。
- Modify: `src/features/calendar/components/two-day-column.tsx`
- Modify: `src/features/calendar/components/month-day-cell.tsx`
- Modify: `src/features/calendar/components/selected-day-agenda.tsx`
- Modify: related component tests。
- Modify: `src/features/calendar/hooks/use-calendar-view.ts`
- Modify: `src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx`

**Interfaces:**
- Consumes: fuzzyの`endDate`、定義label、期間を持つoccurrence。
- Produces: `fuzzyRange` kind、`single | start | middle | end` position、月cellの相対indicator情報。

- [x] **Step 1: view modelの失敗テストを書く**

2日表示で開始・継続・終了positionと`定義名・タイトル`を返すこと、月cellでfixed event dotとfuzzy range barを別flagにすること、agendaへ全期間と定義名を返すことをtestする。

- [x] **Step 2: RED後にview modelを実装する**

positionは表示日とoccurrence start/throughの文字列比較で決定し、色とは独立した`kind`を返す。

- [x] **Step 3: componentの失敗テストを書く**

2日項目の破線・継続testID、月cellのdot/bar併存、agenda label、accessibility labelを実componentへassertする。

- [x] **Step 4: RED後にpresentationを実装する**

開始側・終了側だけ角丸にし、月cellは情報密度を増やさず短いbarを使う。

- [x] **Step 5: calendar hookの取得範囲testを追加する**

表示開始前に始まった相対予定がvisible occurrenceへ残ることをtestし、Repositoryの交差検索結果から表示modelへ流れることを確認する。

Run: `npm test -- src/features/calendar --runInBand`

Expected: PASS。

- [x] **Step 6: Task 6をコミットする**

```bash
git add src/features/calendar
git commit -m "feat(calendar): 相対予定の期間表示を追加"
```

### Task 7: 文書同期・全体検証・PR

**Files:**
- Modify: `docs/superpowers/specs/2026-09-07-zakkuri-calendar-mvp-design.md`
- Modify: `docs/superpowers/specs/2026-09-30-relative-fuzzy-dates-design.md` only if implementation details differ。
- Modify: this plan checkbox state。

**Interfaces:**
- Consumes: Tasks 1–6の実装結果。
- Produces: current schema/settings documentation、検証済みPR。

- [x] **Step 1: MVP仕様を実態へ同期する**

schema version 3、fuzzyの`end_date`とcontext、`this_week_deadline_weekday`、標準定義と繰り返し境界を記載する。

- [x] **Step 2: focused regressionを再実行する**

Run: `npm test -- src/domain/temporal src/domain/calendar src/data/sqlite src/features/events src/features/settings src/features/calendar --runInBand`

Expected: PASS、failure 0。

- [x] **Step 3: 全体検証をfresh実行する**

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
git diff --check
```

Expected: すべてexit 0。

- [x] **Step 4: 実装差分を設計書の完了条件と照合する**

週・月解決、設定snapshot、既存互換、繰り返し拒否、2日・月表示、accessibility、migrationの各項目へコードまたはtestの証拠があることを確認する。

- [x] **Step 5: 文書と最終調整をコミットする**

```bash
git add docs src
git commit -m "docs: 相対日付の実装内容へ仕様を同期"
```

- [ ] **Step 6: code reviewを依頼し、有効な指摘を修正する**

reviewerへbase SHA、head SHA、本plan、designを渡す。Critical・Importantは修正して再検証する。

- [ ] **Step 7: branchをpushし、`develop`向けOpen PRを作成する**

PR本文へ目的、設計判断、全検証結果、実機未確認事項、`Closes #25`を日本語で記載する。worktreeはmergeまで保持する。
