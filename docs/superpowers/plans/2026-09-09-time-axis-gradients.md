# 2日ビューの時間軸と曖昧さグラデーション Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. このタスクはユーザー指示によりサブエージェントを使わず、同一チャットで実行する。

**Goal:** 2日ビューへ共通24時間軸を追加し、正確な予定とDB定義されたざっくり予定を位置・長さ・4種類のフェードで表示する。

**Architecture:** 時間範囲の意味解決はdomain純粋関数、日ごとのクリップ・グラデーションstop・重複配置はfeature純粋関数、Repository調整は`useCalendarView`、描画はfeature componentへ分離する。UIはSQLiteや時間表現の業務規則を参照しない。

**Tech Stack:** Expo SDK 57、Expo Router 57、React Native 0.86、`expo-linear-gradient` 57、TypeScript 6、date-fns 4、expo-sqlite、Jest、React Native Testing Library

**Spec:** `docs/superpowers/specs/2026-09-09-time-axis-gradients-design.md`、Issue #17

## Global Constraints

- 新しいproduction codeの前に失敗テストを実行し、期待した理由でFAILすることを確認する。
- 時間表現の範囲とフェード比率をUIやfeatureへハードコードしない。
- UI componentはRepository、SQLite、domainの解決規則へアクセスしない。
- コメントと`describe`、`test`、`it`の説明は日本語にする。
- 月ビューの既存動作と1日単位の横移動を維持する。
- 実機で確認していない表示やアクセシビリティを自動テストから断定しない。

---

### Task 1: 予定の時間範囲をdomainで解決する

**Files:**
- Create: `src/domain/temporal/resolve-event-time.ts`
- Create: `src/domain/temporal/__tests__/resolve-event-time.test.ts`

**Interfaces:**
- Produces: `ResolvedEventTime = { kind: 'allDay' } | { kind: 'timed'; startMinute; endMinute; fadeInRatio; fadeOutRatio; isInstant } | { kind: 'unresolved' }`
- Produces: `resolveEventTime({ event, definition, undeterminedFadeMinutes }): ResolvedEventTime`

- [x] **Step 1: 失敗テストを書く**

日本語テストで、瞬間、固定10/15/30/60分、未定、00:00、23:59からの日跨ぎ、4種類の定義フェード、定義不在、日粒度以外、終日を固定する。

- [x] **Step 2: REDを確認する**

Run: `npm test -- --runInBand src/domain/temporal/__tests__/resolve-event-time.test.ts`

Expected: moduleが存在しないためFAIL。

- [x] **Step 3: 最小実装する**

正確な予定の`HH:mm`を分へ変換し、durationから終了を決める。未定は設定値と`fadeInRatio: 0`、`fadeOutRatio: 1`を使う。fuzzyは同じIDの日粒度`timeOfDay`定義だけを使い、入力を変形しない。

- [x] **Step 4: GREENを確認する**

Run: `npm test -- --runInBand src/domain/temporal/__tests__/resolve-event-time.test.ts`

### Task 2: 日別タイムライン配置を純粋関数で生成する

**Files:**
- Create: `src/features/calendar/timeline-layout.ts`
- Create: `src/features/calendar/__tests__/timeline-layout.test.ts`

**Interfaces:**
- Produces: `TimelineOpacityStop = { offset: number; opacity: number }`
- Produces: `TimelineItemViewModel` with `startMinute`、`endMinute`、`top`、`height`、`overlapIndex`、`overlapCount`、`opacityStops`、label fields。
- Produces: `createDayTimelineItems(input)` and exported timeline size constants。

- [x] **Step 1: 失敗テストを書く**

日本語テストで、分数から位置・高さ、瞬間の最小高、日跨ぎの前半・後半、表示先頭日の前日からの継続、4種類のstop、`.5/.5`の一点ピーク、重複レーンの決定順を固定する。

- [x] **Step 2: REDを確認する**

Run: `npm test -- --runInBand src/features/calendar/__tests__/timeline-layout.test.ts`

Expected: moduleが存在しないためFAIL。

- [x] **Step 3: 最小実装する**

date-fnsの`differenceInCalendarDays`で表示日との差を求め、全範囲を表示日の0〜1440分へクリップする。opacityは全範囲上の区分線を切り出し、同一offsetをまとめ、最低2stopにする。重複は開始・終了・ID順の貪欲レーン割り当てとする。

- [x] **Step 4: GREENを確認する**

Run: `npm test -- --runInBand src/features/calendar/__tests__/timeline-layout.test.ts`

### Task 3: 2日表示モデルとhookへ時間情報を接続する

**Files:**
- Modify: `src/features/calendar/two-day-view-model.ts`
- Modify: `src/features/calendar/__tests__/two-day-view-model.test.ts`
- Modify: `src/features/calendar/hooks/use-calendar-view.ts`
- Modify: `src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx`
- Modify: `src/app/index.tsx`
- Modify: `src/app/__tests__/index.test.tsx`

**Interfaces:**
- Changes: `TwoDayViewModel.items` to `allDayItems` and `timelineItems`。
- Changes: `UseCalendarViewInput` receives `settings: SettingsRepository`。
- Snapshot stores `definitions: ReadonlyMap<string, TemporalDefinition>` and `undeterminedFadeMinutes`。

- [ ] **Step 1: 表示モデルとhookの失敗テストを書く**

2日モデルが終日・未解決と時間軸項目を分けること、翌日へ続く予定を両日に出すこと、hookが定義本体と未定分数を取得すること、2日表示だけ前日から予定を取得することを日本語テストで固定する。

- [ ] **Step 2: REDを確認する**

Run: `npm test -- --runInBand src/features/calendar/__tests__/two-day-view-model.test.ts src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx src/app/__tests__/index.test.tsx`

- [ ] **Step 3: 最小実装する**

hookで定義と設定を取得し、Mapと設定値を2日表示モデルへ渡す。月表示のagendaには定義MapからラベルMapを生成して既存関数を使う。routeから`settings`を注入する。

- [ ] **Step 4: GREENを確認する**

Run: `npm test -- --runInBand src/features/calendar/__tests__/two-day-view-model.test.ts src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx src/app/__tests__/index.test.tsx`

### Task 4: 共通時間軸と予定グラデーションを描画する

**Files:**
- Create: `src/features/calendar/components/timeline-event-block.tsx`
- Create: `src/features/calendar/components/timeline-axis.tsx`
- Modify: `src/features/calendar/components/two-day-view.tsx`
- Modify: `src/features/calendar/components/two-day-column.tsx`
- Modify: `src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx`
- Modify: `src/features/calendar/screens/calendar-screen.tsx`
- Modify: `src/features/calendar/screens/__tests__/calendar-screen.test.tsx`
- Modify: `src/constants/theme.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- `TimelineAxis` consumes no data and renders a 24-hour shared scale。
- `TimelineEventBlock` consumes one `TimelineItemViewModel` only。
- `TwoDayColumn` consumes header/all-day data and a `timelineOnly` rendering mode instead of resolving time。

- [ ] **Step 1: Expo SDK 57互換依存を追加する**

Run: `npx expo install expo-linear-gradient`

Versioned docsの推奨版`~57.0.1`が解決されることを確認する。

- [ ] **Step 2: componentの失敗テストを書く**

共通24時間軸、横2列、絶対位置、重複幅、4種類の`LinearGradient` colors/locations、タイトルと時間表現、終日・空状態、読み上げ、日別追加を日本語テストで固定する。

- [ ] **Step 3: REDを確認する**

Run: `npm test -- --runInBand src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx src/features/calendar/screens/__tests__/calendar-screen.test.tsx`

- [ ] **Step 4: themeに予定用semantic tokenを追加して最小描画する**

`calendarEvent`と`calendarEventBorder`をlight/darkへ追加する。opacity stopをテーマ色のrgbaへ変換し、`LinearGradient`の`colors`と`locations`へ渡す。1時間罫線、3時間ラベル、予定の位置・高さ・重複幅はview modelだけを使う。

- [ ] **Step 5: GREENを確認する**

Run: `npm test -- --runInBand src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx src/features/calendar/screens/__tests__/calendar-screen.test.tsx`

### Task 5: 文書、全体検証、PRを完了する

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-09-09-time-axis-gradients.md`

- [ ] **Step 1: READMEとplanを更新する**

READMEへ24時間軸、DB定義グラデーション、日跨ぎ、未定時間設定を記載し、plan checkboxを実績へ合わせる。

- [ ] **Step 2: 差分を確認する**

Run: `git diff --check && git status --short && git diff --stat origin/develop...HEAD`

- [ ] **Step 3: repository全体を検証する**

Run:

```sh
npm run typecheck
npm run lint
npm run format:check
npm test -- --runInBand
npx expo export --platform ios --output-dir /tmp/zakkuri-calendar-time-axis-ios-20260909
npx expo export --platform android --output-dir /tmp/zakkuri-calendar-time-axis-android-20260909
```

`format:check`が未定義の場合は既存のformat検証手段を確認し、存在しないことをPRへ明記する。自動検証で代替できないiOS/Android実機、小画面、文字拡大、VoiceOver/TalkBack、light/darkの見え方は未確認として記載する。

- [ ] **Step 4: develop向けPRを作成する**

`codex/mvp-time-axis-gradients`をpushし、`Closes #17`、設計判断、依存追加、検証結果、実機未確認事項を日本語で記載して`develop`向けPRを作成する。作成後にhead/base/state/checksを再取得する。
