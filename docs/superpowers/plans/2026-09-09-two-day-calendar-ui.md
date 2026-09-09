# 2日ビュー中心のカレンダーUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. このタスクはユーザー指示によりサブエージェントを使わず、同一チャットで実行する。

**Goal:** 今日と明日の横2列を初期表示にし、独自月グリッドとの切り替え、1日単位のアニメーション移動、Notion風のライト・ダークテーマを提供する。

**Architecture:** `useCalendarView`がRepository、祝日、表示期間とモードを調整し、UIへ表示モデルとcallbackだけを渡す。日付計算と表示モデルは純粋関数、横スワイプは独立custom hook、2日・月描画はfeature componentへ分離し、`react-native-calendars`を削除する。

**Tech Stack:** Expo SDK 57、Expo Router 57、React Native 0.86 `Animated` / `PanResponder` / `AccessibilityInfo`、TypeScript 6、date-fns 4、expo-sqlite、Jest、React Native Testing Library

**Spec:** `docs/superpowers/specs/2026-09-09-two-day-calendar-ui-design.md`、`docs/superpowers/specs/2026-09-07-zakkuri-calendar-mvp-design.md`、Issue #15

## Global Constraints

- 初期表示は今日・明日の横2列とし、2日ビューの移動は現在1日単位にする。
- 移動単位はdomain関数へ閉じ込め、UIとgesture hookへ日数を埋め込まない。
- 2日／月の選択はMVPでは永続化せず、`TODO(v1, #16)`を残す。
- 時間軸とグラデーションは実装せず、Issue #17を後続とする。
- 祝日判定は既存`HolidayProvider`境界を維持する。
- UIはRepository、SQLite、祝日ライブラリへ直接アクセスしない。
- `react-native-calendars`を利用・依存から削除し、新しいanimation依存は追加しない。
- Reduce Motion有効時は位置animationを行わない。
- 新規コメントと`describe`、`test`、`it`の説明は日本語にする。
- 保存済みの個人予定本文をログや外部サービスへ送らない。

---

### Task 1: 2日表示の日付境界をdomainへ追加する

**Files:**
- Modify: `src/domain/calendar/month.ts`
- Modify: `src/domain/calendar/__tests__/month.test.ts`

**Interfaces:**
- Produces: `TwoDayRange = { from: string; through: string }`
- Produces: `getTwoDayRange(anchorDate: string): TwoDayRange`
- Produces: `moveTwoDayWindow(anchorDate: string, offset: -1 | 1): string`

- [x] **Step 1: 失敗テストを書く**

日本語テストで、`2026-09-30`の範囲が`2026-09-30`〜`2026-10-01`になること、次移動が`2026-10-01`、前移動が`2026-09-29`になることを固定する。

- [x] **Step 2: REDを確認する**

Run: `npm test -- --runInBand src/domain/calendar/__tests__/month.test.ts`

Expected: `getTwoDayRange`と`moveTwoDayWindow`が未定義のためFAIL。

- [x] **Step 3: date-fnsを使って最小実装する**

`parse(date, 'yyyy-MM-dd', new Date())`と`addDays`を使い、固定ミリ秒加算を行わない。`moveTwoDayWindow`内だけに現在の1日移動を保持する。

- [x] **Step 4: GREENを確認してコミットする**

Run: `npm test -- --runInBand src/domain/calendar/__tests__/month.test.ts`

Commit: `feat: 2日表示の日付範囲を追加`

### Task 2: 共通agendaと2日表示モデルを追加する

**Files:**
- Create: `src/features/calendar/calendar-view-model.ts`
- Create: `src/features/calendar/two-day-view-model.ts`
- Create: `src/features/calendar/__tests__/two-day-view-model.test.ts`
- Modify: `src/features/calendar/month-view-model.ts`
- Modify: `src/features/calendar/__tests__/month-view-model.test.ts`

**Interfaces:**
- Moves: `AgendaItemViewModel`、`HolidayRangeCoverage`、`createAgendaItems`、`getHolidayInfo`を`calendar-view-model.ts`へ置く。
- Produces: `TwoDayViewModel = { date; dateLabel; weekdayLabel; isToday; holidayName; holidaySupport; items; accessibilityLabel }`
- Produces: `createTwoDayViewModels(input): readonly [TwoDayViewModel, TwoDayViewModel]`

- [x] **Step 1: 2日表示モデルの失敗テストを書く**

基準日と翌日の順序、月・年境界、今日表示、祝日名、祝日未対応、fuzzyラベル、日別予定、空配列、読み上げラベルを日本語テストで固定する。

- [x] **Step 2: REDを確認する**

Run: `npm test -- --runInBand src/features/calendar/__tests__/two-day-view-model.test.ts`

Expected: 新しいmodelとfactoryが存在しないためFAIL。

- [x] **Step 3: 共通処理を移動し2日モデルを最小実装する**

月モデルと2日モデルが同じ`createAgendaItems`と`getHolidayInfo`を使う。曜日ラベルは`日`〜`土`の配列から生成し、予定は`anchorDate`で日別に分ける。

- [x] **Step 4: 月モデルを含めGREENにしてコミットする**

Run: `npm test -- --runInBand src/features/calendar/__tests__/two-day-view-model.test.ts src/features/calendar/__tests__/month-view-model.test.ts`

Commit: `feat: 2日カレンダーの表示モデルを追加`

### Task 3: 2日／月を調整するuseCalendarViewを実装する

**Files:**
- Create: `src/features/calendar/hooks/use-calendar-view.ts`
- Create: `src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx`
- Delete with the route integration in Task 6: `src/features/calendar/hooks/use-month-calendar.ts`
- Delete with the route integration in Task 6: `src/features/calendar/hooks/__tests__/use-month-calendar.test.tsx`
- Modify: `src/features/calendar/__tests__/month-calendar-integration.test.tsx`

**Interfaces:**
- Produces: `CalendarViewMode = 'twoDay' | 'month'`
- Produces: `CalendarViewState` with `status`、`mode`、`today`、`anchorDate`、`visibleMonth`、`selectedDate`、`twoDayDays`、`monthDays`、`selectedAgendaItems`、`selectedHolidayName`、`holidaySupport`、`isPeriodLoading`、`periodError`。
- Produces callbacks: `selectMode(mode)`、`showPreviousPeriod(): Promise<boolean>`、`showNextPeriod(): Promise<boolean>`、`showToday(): Promise<boolean>`、`selectDate(date)`、`retry()`。

- [x] **Step 1: hookの失敗テストを書く**

日本語テストで次を固定する。

- 初期modeが`twoDay`で、今日〜明日の予定・祝日・定義を取得する。
- 次期間で基準日が1日進み、前期間で1日戻る。
- `month`へ切り替えると選択日を含む月を取得し、`twoDay`へ戻ると選択日を基準にする。
- 「今日」で今日・明日へ戻る。
- 期間移動取得に失敗した場合は元の期間と表示内容を維持し、`false`と`periodError`を返す。
- 古い非同期応答は新しい表示を上書きしない。
- `refreshRevision`変更時に現在範囲を再取得する。

- [x] **Step 2: REDを確認する**

Run: `npm test -- --runInBand src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx`

Expected: `useCalendarView`が存在しないためFAIL。

- [x] **Step 3: 取得成功後だけ期間をcommitするhookを実装する**

初回のみ`status: 'loading'`を使う。期間移動中は現在の表示を保持して`isPeriodLoading: true`にし、対象rangeのRepository取得と表示モデル生成が完了したときだけ日付・snapshotを同時に更新する。失敗時は現在snapshotを維持し`periodError`を設定する。request IDで古い応答を無視する。

- [x] **Step 4: GREENと既存integrationを確認してコミットする**

Run: `npm test -- --runInBand src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx src/features/calendar/__tests__/month-calendar-integration.test.tsx`

Commit: `feat: 2日と月のカレンダー状態を統合`

### Task 4: Reduce Motionと横スワイプanimation hookを実装する

**Files:**
- Create: `src/hooks/use-reduce-motion.ts`
- Create: `src/hooks/__tests__/use-reduce-motion.test.tsx`
- Create: `src/features/calendar/hooks/use-horizontal-swipe-transition.ts`
- Create: `src/features/calendar/hooks/__tests__/use-horizontal-swipe-transition.test.tsx`

**Interfaces:**
- Produces: `useReduceMotion(): boolean`
- Produces: `SwipeDirection = 'previous' | 'next'`
- Produces: `getSwipeDirection(gesture): SwipeDirection | null`
- Produces: `useHorizontalSwipeTransition({ onPrevious; onNext; reduceMotion })` returning `translateX`、`panHandlers`、`movePrevious()`、`moveNext()`、`isAnimating`、`onLayout(width)`。

- [x] **Step 1: Reduce Motionとgesture判定の失敗テストを書く**

`AccessibilityInfo.isReduceMotionEnabled()`の初期値と`reduceMotionChanged`購読、水平距離・速度・縦移動の判定、previous/next方向を日本語テストで固定する。

- [x] **Step 2: REDを確認する**

Run: `npm test -- --runInBand src/hooks/__tests__/use-reduce-motion.test.tsx src/features/calendar/hooks/__tests__/use-horizontal-swipe-transition.test.tsx`

Expected: hooksと純粋判定関数が存在しないためFAIL。

- [x] **Step 3: AnimatedとPanResponderで最小実装する**

移動確定時は現在表示を画面外へanimateし、`await onPrevious/onNext`が`true`なら反対側から0へanimateする。`false`なら元位置へ戻す。`reduceMotion`時はanimationを呼ばずcallback結果だけを返す。進行中は追加操作を無視する。

- [x] **Step 4: GREENを確認してコミットする**

Run: `npm test -- --runInBand src/hooks/__tests__/use-reduce-motion.test.tsx src/features/calendar/hooks/__tests__/use-horizontal-swipe-transition.test.tsx`

Commit: `feat: カレンダーの横スワイプanimationを追加`

### Task 5: 独自2日ビューと月グリッドを実装する

**Files:**
- Create: `src/features/calendar/components/calendar-view-switcher.tsx`
- Create: `src/features/calendar/components/calendar-period-toolbar.tsx`
- Create: `src/features/calendar/components/two-day-view.tsx`
- Create: `src/features/calendar/components/two-day-column.tsx`
- Modify: `src/features/calendar/components/month-grid.tsx`
- Modify: `src/features/calendar/components/month-day-cell.tsx`
- Delete with the old screen in Task 6: `src/features/calendar/components/month-toolbar.tsx`
- Modify: `src/features/calendar/components/__tests__/month-calendar-components.test.tsx`
- Create: `src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- `CalendarViewSwitcher` consumes `mode` and `onSelectMode`。
- `CalendarPeriodToolbar` consumes `periodLabel`、mode別の前後ラベル、`isLoading`と3 callbacks。
- `TwoDayView` consumes exactly 2 `TwoDayViewModel`、`onAddEvent(date)`。
- `MonthGrid` consumes 42 `MonthDayViewModel` and `onSelectDate` only; external calendar UI propsを持たない。

- [x] **Step 1: presentationの失敗テストを書く**

横2列、各列の日付・祝日・予定・空状態・追加日付、2日／月のselected state、44pt操作領域、7列×6行の月グリッド、テーマ追従を日本語テストで固定する。

- [x] **Step 2: REDを確認する**

Run: `npm test -- --runInBand src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx src/features/calendar/components/__tests__/month-calendar-components.test.tsx`

Expected: 新規componentsがなく、MonthGridが`react-native-calendars`に依存しているためFAIL。

- [x] **Step 3: React Native標準componentsで最小実装する**

月グリッドはweekday headerと42個の`MonthDayCell`を7等分で描画する。2日列は各50%幅とし、列内予定が増えても親screenの縦ScrollViewで到達可能にする。時間軸やgradient用の座標計算は追加しない。

- [x] **Step 4: 外部calendar依存を削除する**

Run: `npm uninstall react-native-calendars`

`rg 'react-native-calendars' src package.json package-lock.json`が0件になることを確認する。

- [x] **Step 5: GREENを確認してコミットする**

Run: `npm test -- --runInBand src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx src/features/calendar/components/__tests__/month-calendar-components.test.tsx`

Commit: `feat: 2日と月のカレンダーを独自描画`

### Task 6: CalendarScreenとrouteを統合しテーマを更新する

**Files:**
- Create: `src/features/calendar/screens/calendar-screen.tsx`
- Create: `src/features/calendar/screens/__tests__/calendar-screen.test.tsx`
- Delete: `src/features/calendar/screens/month-calendar-screen.tsx`
- Delete: `src/features/calendar/screens/__tests__/month-calendar-screen.test.tsx`
- Modify: `src/app/index.tsx`
- Modify: `src/app/__tests__/index.test.tsx`
- Modify: `src/constants/theme.ts`
- Modify: `README.md`

**Interfaces:**
- `CalendarScreen` consumes `CalendarViewState` and `onAddEvent(date)` only。
- `IndexRoute` composes repositories、holiday provider、refresh revision、router without UI logic。
- Existing `useTheme` consumers receive the new Notion-like semantic color values without direct hex literals。

- [x] **Step 1: screen、route、themeの失敗テストを書く**

日本語テストで初期2日表示、mode切替、period toolbar、gesture handlers、日別追加callback、月選択一覧、route dependency composition、light/darkの具体tokenを固定する。

- [x] **Step 2: REDを確認する**

Run: `npm test -- --runInBand src/features/calendar/screens/__tests__/calendar-screen.test.tsx src/app/__tests__/index.test.tsx`

Expected: `CalendarScreen`と`useCalendarView`接続が存在しないためFAIL。

- [x] **Step 3: screenとrouteを最小実装する**

screenは`useReduceMotion`と`useHorizontalSwipeTransition`を呼び、両modeを同じAnimated containerへ描画する。`TODO(v1, #16)`はmode初期値付近へ置く。2日ビューの追加は各列の日付、月ビューは選択日をrouteへ渡す。

- [x] **Step 4: theme tokenとREADMEを更新する**

設計書のlight/dark 8 tokenへ置き換え、READMEの初期表示、切替、1日移動、独自描画、Issue #16/#17の対象外を記録する。

- [x] **Step 5: GREENを確認してコミットする**

Run: `npm test -- --runInBand src/features/calendar/screens/__tests__/calendar-screen.test.tsx src/app/__tests__/index.test.tsx`

Commit: `feat: 2日ビューをカレンダー初期画面に統合`

### Task 7: 全体検証とPRを完了する

**Files:**
- Modify: `docs/superpowers/plans/2026-09-09-two-day-calendar-ui.md`

- [ ] **Step 1: plan checkboxと差分を確認する**

Run: `git diff --check && git status --short && git diff --stat origin/develop...HEAD`

- [ ] **Step 2: repository全体を検証する**

Run:

```sh
npm run typecheck
npm run lint
npm test -- --runInBand
npx expo export --platform ios --output-dir /tmp/zakkuri-calendar-two-day-ios-20260909
npx expo export --platform android --output-dir /tmp/zakkuri-calendar-two-day-android-20260909
```

Expected: すべてexit 0。実機で確認していないanimation、small screen、文字拡大、VoiceOver/TalkBack、light/darkは未確認としてPRへ明記する。

- [ ] **Step 3: develop向けPRを作成する**

`codex/mvp-two-day-calendar-ui`をpushし、`Closes #15`、Issue #16/#17への後続、依存削除、検証結果、実機未確認項目を日本語で記載して`develop`向けPRを作成する。GitHubのhead/base/checksを再取得して報告する。
