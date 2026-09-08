# MVP App Shell and Month View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Expo Routerのアプリシェルと、予定・日本の祝日を確認できる月ビューを実装する。

**Architecture:** 通常のExpo Router Stackをアプリ境界に置き、feature hookがRepository、純粋な月計算、祝日providerを調整する。react-native-calendars、date-fns、@gahojin-inc/holiday-japaneseはfeature component、domain関数、data adapterの内側へ閉じ込める。

**Tech Stack:** Expo SDK 57、React Native 0.86、Expo Router 57、TypeScript 6、expo-sqlite、react-native-calendars 1.1314、date-fns 4.4、@gahojin-inc/holiday-japanese 2026.8、Jest、React Native Testing Library

**Spec:** docs/superpowers/specs/2026-09-08-mvp-app-shell-month-view-design.md

## Global Constraints

- 実装前にExpo SDK 57の正確なRouter/Stack資料を確認する。
- 対象はiOSとAndroid。Webの動作保証は含めない。
- UIからSQLite、Repository、date-fns、祝日ライブラリを呼ばない。
- feature custom hookが読み込みと画面状態を調整し、日付計算は純粋なdomain関数へ置く。
- 祝日は表示情報であり、SQLiteへ保存せず、曖昧期間や業務日計算へ影響させない。
- MVPは月曜始まり。v1の設定化はIssue #10で追跡する。
- 新規コードコメントとJestのdescribe、it、testの説明文は日本語、コード識別子は英語にする。
- 予定タイトル、SQL、選択履歴をログや外部サービスへ送らない。
- 各挙動は実装前に、意図した理由で失敗するテストを確認する。
- 実機・Simulator確認と自動テスト結果を区別する。

---

## File Map

### Modify

- package.json / package-lock.json — 3つの依存を追加する。
- src/app/_layout.tsx — Native Tabsを通常のStackへ置き換える。
- src/app/index.tsx — 月画面の薄いrouteと依存compositionに置き換える。
- src/app/__tests__/_layout.test.tsx — Stackとスプラッシュ構成を検証する。
- src/constants/theme.ts — カレンダー用の意味色を追加する。
- README.md — 月ビューの境界と検証方法を記載する。

### Delete

- src/app/explore.tsx
- src/components/app-tabs.tsx
- src/components/app-tabs.web.tsx

### Create

- src/domain/calendar/month.ts
- src/domain/calendar/holiday.ts
- src/domain/calendar/__tests__/month.test.ts
- src/data/holidays/japanese-holiday-provider.ts
- src/data/holidays/__tests__/japanese-holiday-provider.test.ts
- src/features/calendar/month-view-model.ts
- src/features/calendar/__tests__/month-view-model.test.ts
- src/features/calendar/hooks/use-month-calendar.ts
- src/features/calendar/hooks/__tests__/use-month-calendar.test.tsx
- src/features/calendar/components/month-grid.tsx
- src/features/calendar/components/month-day-cell.tsx
- src/features/calendar/components/month-toolbar.tsx
- src/features/calendar/components/selected-day-agenda.tsx
- src/features/calendar/components/calendar-load-state.tsx
- src/features/calendar/components/__tests__/month-calendar-components.test.tsx
- src/features/calendar/screens/month-calendar-screen.tsx
- src/features/calendar/screens/__tests__/month-calendar-screen.test.tsx
- src/app/__tests__/index.test.tsx

---

### Task 1: Install the maintained calendar libraries

**Files:**
- Modify: package.json
- Modify: package-lock.json

**Produces:** react-native-calendars、date-fns、@gahojin-inc/holiday-japaneseのlockfile解決結果。

- [ ] **Step 1: 公式資料を確認する**

確認先:

    https://docs.expo.dev/versions/v57.0.0/sdk/router/
    https://docs.expo.dev/versions/v57.0.0/sdk/router/stack/
    https://wix.github.io/react-native-calendars/docs/Components/Calendar
    https://github.com/date-fns/date-fns
    https://github.com/gahojin/holiday-japanese

確認事項: 通常のStack、CalendarのfirstDay=1・showSixWeeks・dayComponent、追加native linkingが不要であること。

- [ ] **Step 2: 依存をインストールする**

    npm install react-native-calendars@^1.1314.0 date-fns@^4.4.0 @gahojin-inc/holiday-japanese@^2026.8.0

- [ ] **Step 3: 解決結果を検証する**

    npm ls react-native-calendars date-fns @gahojin-inc/holiday-japanese
    npm run typecheck

Expected: 3パッケージが1件ずつ解決され、typecheckが終了コード0。

- [ ] **Step 4: コミットする**

    git add package.json package-lock.json
    git commit -m "build: add month calendar dependencies"

---

### Task 2: Add wall-clock month calculations

**Files:**
- Create: src/domain/calendar/month.ts
- Create: src/domain/calendar/__tests__/month.test.ts

**Produces:**

~~~~ts
export type WeekStartsOn = 0 | 1;
export type MonthRange = Readonly<{ from: string; through: string }>;
export type MonthGridDate = Readonly<{
  date: string;
  dayNumber: number;
  weekday: number;
  isCurrentMonth: boolean;
}>;
export function toCalendarDate(date: Date): string;
export function getMonthStart(date: string): string;
export function getMonthRange(month: string): MonthRange;
export function moveMonth(month: string, offset: -1 | 1): string;
export function getMonthGrid(month: string, weekStartsOn: WeekStartsOn): readonly MonthGridDate[];
~~~~

- [ ] **Step 1: 失敗テストを書く**

~~~~ts
describe('月カレンダーの日付計算', () => {
  it('閏年2月の月初と月末を返す', () => {
    expect(getMonthRange('2028-02-14')).toEqual({
      from: '2028-02-01',
      through: '2028-02-29',
    });
  });

  it('年境界を越えて前月と次月へ移動する', () => {
    expect(moveMonth('2026-01-01', -1)).toBe('2025-12-01');
    expect(moveMonth('2026-12-01', 1)).toBe('2027-01-01');
  });

  it('月曜始まりの42日を壁時計日付で返す', () => {
    const grid = getMonthGrid('2026-09-01', 1);
    expect(grid).toHaveLength(42);
    expect(grid[0]?.date).toBe('2026-08-31');
    expect(grid[41]?.date).toBe('2026-10-11');
  });
});
~~~~

- [ ] **Step 2: REDを確認する**

    npm test -- --runInBand src/domain/calendar/__tests__/month.test.ts

Expected: month moduleが存在しないためFAIL。

- [ ] **Step 3: 最小実装を書く**

date-fnsのparse、format、startOfMonth、endOfMonth、startOfWeek、endOfWeek、addMonths、eachDayOfIntervalをこのファイルだけで使う。永続化文字列へ戻す処理はformat(date, 'yyyy-MM-dd')とし、toISOStringは使わない。getMonthGridは必ず42件へ伸ばす。

- [ ] **Step 4: GREENを確認してコミットする**

    npm test -- --runInBand src/domain/calendar/__tests__/month.test.ts src/domain/calendar/__tests__/event.test.ts
    npm run typecheck
    git add src/domain/calendar/month.ts src/domain/calendar/__tests__/month.test.ts
    git commit -m "feat: add month date calculations"

---

### Task 3: Wrap Japanese holidays behind a domain port

**Files:**
- Create: src/domain/calendar/holiday.ts
- Create: src/data/holidays/japanese-holiday-provider.ts
- Create: src/data/holidays/__tests__/japanese-holiday-provider.test.ts

**Produces:**

~~~~ts
export type Holiday = Readonly<{ date: string; name: string }>;
export type HolidayRangeResult =
  | Readonly<{ status: 'available'; holidays: readonly Holiday[] }>
  | Readonly<{ status: 'unsupported' }>;
export interface HolidayProvider {
  list(from: string, through: string): HolidayRangeResult;
}
export const JAPANESE_HOLIDAY_MIN_YEAR = 1970;
export const JAPANESE_HOLIDAY_MAX_YEAR = 2050;
export class JapaneseHolidayProvider implements HolidayProvider;
~~~~

- [ ] **Step 1: 失敗テストを書く**

~~~~ts
describe('日本の祝日provider', () => {
  it('元日と成人の日を日本語名付きで返す', () => {
    const result = new JapaneseHolidayProvider().list('2026-01-01', '2026-01-12');
    expect(result).toEqual({
      status: 'available',
      holidays: expect.arrayContaining([
        expect.objectContaining({ date: '2026-01-01', name: '元日' }),
        expect.objectContaining({ date: '2026-01-12', name: '成人の日' }),
      ]),
    });
  });

  it('収録範囲外を通常日として返さない', () => {
    expect(new JapaneseHolidayProvider().list('2051-01-01', '2051-01-31')).toEqual({
      status: 'unsupported',
    });
  });
});
~~~~

- [ ] **Step 2: REDを確認する**

    npm test -- --runInBand src/data/holidays/__tests__/japanese-holiday-provider.test.ts

Expected: provider moduleが存在しないためFAIL。

- [ ] **Step 3: 最小adapterを実装する**

1970〜2050外をunsupportedとする。対応範囲内はローカル壁時計Dateをbetweenへ渡し、nameJaと日付をdomain型へ変換する。外部ライブラリ型をexportしない。

- [ ] **Step 4: GREENを確認してコミットする**

    npm test -- --runInBand src/data/holidays/__tests__/japanese-holiday-provider.test.ts
    npm run typecheck
    git add src/domain/calendar/holiday.ts src/data/holidays
    git commit -m "feat: add Japanese holiday provider"

---

### Task 4: Build display-ready month view models

**Files:**
- Create: src/features/calendar/month-view-model.ts
- Create: src/features/calendar/__tests__/month-view-model.test.ts

**Produces:**

~~~~ts
export type MonthDayViewModel = Readonly<{
  date: string;
  dayNumber: number;
  weekday: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasEvents: boolean;
  holidayName: string | null;
  accessibilityLabel: string;
}>;
export type AgendaItemViewModel = Readonly<{
  id: string;
  title: string;
  temporalLabel: string;
  accessibilityLabel: string;
}>;
export function createMonthDayViewModels(input: Readonly<{
  grid: readonly MonthGridDate[];
  selectedDate: string;
  today: string;
  events: readonly CalendarEvent[];
  holidayResult: HolidayRangeResult;
}>): readonly MonthDayViewModel[];
export function createAgendaItems(
  events: readonly CalendarEvent[],
  definitionLabels: ReadonlyMap<string, string>,
): readonly AgendaItemViewModel[];
~~~~

- [ ] **Step 1: 失敗テストを書く**

日本語のテスト名で、今日・選択・予定・祝日を同時に含む読み上げ文言、exactの14:30、allDayの終日、fuzzyの定義ラベル、定義不明時のざっくりを検証する。

- [ ] **Step 2: REDを確認する**

    npm test -- --runInBand src/features/calendar/__tests__/month-view-model.test.ts

Expected: view-model moduleが存在しないためFAIL。

- [ ] **Step 3: 純粋な表示変換を実装する**

読み上げ文言は「2026年9月21日、敬老の日、選択中、予定あり」の順で組み立てる。ログ処理は作らない。

- [ ] **Step 4: GREENを確認してコミットする**

    npm test -- --runInBand src/features/calendar/__tests__/month-view-model.test.ts
    npm run typecheck
    git add src/features/calendar/month-view-model.ts src/features/calendar/__tests__/month-view-model.test.ts
    git commit -m "feat: map month calendar view state"

---

### Task 5: Orchestrate month state in a custom hook

**Files:**
- Create: src/features/calendar/hooks/use-month-calendar.ts
- Create: src/features/calendar/hooks/__tests__/use-month-calendar.test.tsx

**Consumes:** CalendarRepository、EventRepository、TemporalDefinitionRepository、HolidayProvider、Task 2と4の純粋関数。

**Produces:**

~~~~ts
export type MonthCalendarStatus = 'loading' | 'ready' | 'error';
export type UseMonthCalendarInput = Readonly<{
  calendars: CalendarRepository;
  events: EventRepository;
  temporalDefinitions: TemporalDefinitionRepository;
  holidayProvider: HolidayProvider;
  weekStartsOn: WeekStartsOn;
  now?: () => Date;
}>;
export type MonthCalendarState = Readonly<{
  status: MonthCalendarStatus;
  visibleMonth: string;
  selectedDate: string;
  today: string;
  days: readonly MonthDayViewModel[];
  agendaItems: readonly AgendaItemViewModel[];
  selectedHolidayName: string | null;
  holidaySupport: 'available' | 'unsupported';
  showPreviousMonth(): void;
  showNextMonth(): void;
  showToday(): void;
  selectDate(date: string): void;
  retry(): void;
}>;
export function useMonthCalendar(input: UseMonthCalendarInput): MonthCalendarState;
~~~~

- [ ] **Step 1: 初期読み込みの失敗テストを書く**

renderHookでnowを2026-09-08へ固定し、default calendar、2026-09-01〜09-30の予定、祝日を取得してreadyになり、9月8日が選択されることを検証する。

- [ ] **Step 2: REDを確認して初期読み込みだけを実装する**

    npm test -- --runInBand src/features/calendar/hooks/__tests__/use-month-calendar.test.tsx

Expected: hook moduleが存在しないためFAIL。最小実装後は同じコマンドがPASS。

- [ ] **Step 3: 状態遷移の失敗テストを追加する**

日本語のitを分けて、次月で10月1日を選ぶ、前後月セル選択で月が追従する、今日へ戻る、失敗後retryする、9月の遅いPromiseが10月を上書きしない、fuzzy定義IDを重複排除して無効化済み定義もgetByIdで解決する、を検証する。

- [ ] **Step 4: REDを確認して最小実装を追加する**

古い応答はrequestIdRefを増分し、完了時のIDが最新でない場合は反映しない。月変更時は別月の予定を空にしてloadingへ入る。

- [ ] **Step 5: GREENを確認してコミットする**

    npm test -- --runInBand src/features/calendar/hooks/__tests__/use-month-calendar.test.tsx
    npm run typecheck
    git add src/features/calendar/hooks
    git commit -m "feat: orchestrate month calendar state"

---

### Task 6: Add accessible month presentation components

**Files:**
- Modify: src/constants/theme.ts
- Create: src/features/calendar/components/month-grid.tsx
- Create: src/features/calendar/components/month-day-cell.tsx
- Create: src/features/calendar/components/month-toolbar.tsx
- Create: src/features/calendar/components/selected-day-agenda.tsx
- Create: src/features/calendar/components/calendar-load-state.tsx
- Create: src/features/calendar/components/__tests__/month-calendar-components.test.tsx

**Consumes:** Task 4のview modelのみ。Repository、SQLite、date-fns、祝日ライブラリは参照しない。

- [ ] **Step 1: 失敗テストを書く**

日本語の説明文で、月曜始まりと6週間、祝日名と選択状態を含む日付ボタン、前月・今日・次月callback、祝日情報未対応、空状態、失敗からの再試行を個別に検証する。

- [ ] **Step 2: REDを確認する**

    npm test -- --runInBand src/features/calendar/components/__tests__/month-calendar-components.test.tsx

Expected: componentsが存在しないためFAIL。

- [ ] **Step 3: 表示コンポーネントを実装する**

MonthGridだけがreact-native-calendarsをimportする。firstDay={1}、showSixWeeks、hideExtraDays={false}、enableSwipeMonthsを設定し、dayComponentからMonthDayCellへview modelを渡す。月移動UIはdocumented customHeader境界でMonthToolbarを渡し、ライブラリの既定headerと重複表示しない。

MonthDayCellは44pt相当の押下領域、accessibilityRole="button"、accessibilityStateのselected、view modelのaccessibilityLabelを持つ。色に加え、選択背景、今日の枠、予定dotを使う。

theme.tsのlight/dark双方へcalendarSaturday、calendarHoliday、calendarAccent、calendarBorderを追加する。

- [ ] **Step 4: GREENを確認してコミットする**

    npm test -- --runInBand src/features/calendar/components/__tests__/month-calendar-components.test.tsx
    npm run typecheck
    npm run lint
    git add src/constants/theme.ts src/features/calendar/components
    git commit -m "feat: add accessible month calendar UI"

---

### Task 7: Compose the screen and replace sample navigation

**Files:**
- Create: src/features/calendar/screens/month-calendar-screen.tsx
- Create: src/features/calendar/screens/__tests__/month-calendar-screen.test.tsx
- Modify: src/app/index.tsx
- Create: src/app/__tests__/index.test.tsx
- Modify: src/app/_layout.tsx
- Modify: src/app/__tests__/_layout.test.tsx
- Delete: src/app/explore.tsx
- Delete: src/components/app-tabs.tsx
- Delete: src/components/app-tabs.web.tsx

- [ ] **Step 1: 画面状態の失敗テストを書く**

hook境界をmockし、日本語の説明文でloading、error、ready+empty、ready+agendaを検証する。ready時はtoolbar、grid、agendaへstate値とcallbackが渡ることを確認する。

- [ ] **Step 2: REDを確認してscreenを実装する**

    npm test -- --runInBand src/features/calendar/screens/__tests__/month-calendar-screen.test.tsx

Expected: screen moduleが存在しないためFAIL。screenはuseRepositoriesで契約を取得してhookへ渡すが、表示componentにはRepositoryを渡さない。

- [ ] **Step 3: routeとStackの失敗テストを書く**

_layout.test.tsxを、DB provider外にAnimatedSplashOverlayが残り、内側に通常のStackがある期待へ更新する。index.test.tsxではrouteがJapaneseHolidayProvider、weekStartsOn={1}、screenを組み立てることを検証する。

- [ ] **Step 4: REDを確認する**

    npm test -- --runInBand src/app/__tests__/_layout.test.tsx src/app/__tests__/index.test.tsx

Expected: 現在のNative TabsとサンプルHomeScreenのためFAIL。

- [ ] **Step 5: routeと通常のStackを実装する**

src/app/index.tsxのcomposition pointへ次をそのまま残す。

~~~~ts
// TODO(v1, #9): 祝日カレンダーと、ざっくり期間・業務日計算への反映を設定可能にする。
// TODO(v1, #10): 永続化したカレンダー設定から週の開始曜日を取得する。
~~~~

_layout.tsxはAnimatedSplashOverlayをDB provider外に維持し、provider内をStackへ置き換える。ExperimentalStackは使用しない。

- [ ] **Step 6: サンプルrouteとTabsを削除する**

指定した3ファイルだけを削除する。その他のサンプルcomponentはrgで参照を確認し、このタスクと無関係なら削除しない。

- [ ] **Step 7: GREENを確認してコミットする**

    npm test -- --runInBand src/features/calendar/screens/__tests__/month-calendar-screen.test.tsx src/app/__tests__/_layout.test.tsx src/app/__tests__/index.test.tsx
    npm run typecheck
    npm run lint
    git add src/app src/components/app-tabs.tsx src/components/app-tabs.web.tsx src/features/calendar/screens
    git commit -m "feat: show month calendar as app home"

---

### Task 8: Verify, document, and open the develop PR

**Files:**
- Modify: README.md
- Modify: docs/superpowers/plans/2026-09-08-mvp-app-shell-month-view.md
- GitHub: Issue #8 and develop PR

- [x] **Step 1: READMEへ境界を追記する**

月ビュー、ローカル予定取得、日本の祝日表示、1970〜2050の祝日範囲、MVPは月曜始まり固定、Issue #9/#10、Web対象外を記載する。

- [x] **Step 2: 日本語規約を確認する**

    rg -n "TODO|//|/\\*|describe\\(|it\\(|test\\(" src/domain/calendar/month.ts src/data/holidays src/features/calendar src/app/index.tsx src/app/__tests__

Expected: 新規コメントとテスト説明文が日本語で、TODOがIssue #9/#10を参照する。既存テストの英語説明文は一括変更しない。

- [x] **Step 3: 全体を検証する**

    git diff --check
    npm run typecheck
    npm run lint
    npm test -- --runInBand

Expected: typecheck/lintは終了コード0、全suiteはfailure 0。

- [x] **Step 4: iOSとAndroidをbundleする**

task固有の一時ディレクトリを作り、その実パスを使って実行する。

    CALENDAR_EXPORT_DIR=$(mktemp -d /tmp/zakkuri-month-view.XXXXXX)
    npx expo export --platform ios --output-dir "$CALENDAR_EXPORT_DIR/ios"
    npx expo export --platform android --output-dir "$CALENDAR_EXPORT_DIR/android"

Expected: 両方がbundle errorなしで完了し、生成物をrepositoryへ含めない。

- [x] **Step 5: native runtimeの利用可否を確認する**

    xcrun simctl list devices booted
    adb devices

起動中のSimulatorまたはEmulatorがある場合だけ、月移動、今日、日付選択、祝日名、空状態を確認する。なければnative layout未確認とPRへ明記する。

- [x] **Step 6: documentationをコミットする**

    git add README.md docs/superpowers/plans/2026-09-08-mvp-app-shell-month-view.md
    git commit -m "docs: document MVP month calendar"

- [x] **Step 7: Issue #8を更新する**

実行済み証跡がある条件だけをcheckedへ変更し、native確認結果を追記する。Issue #9/#10はopenのまま維持する。

- [x] **Step 8: pushしてdevelop向けPRを作る**

    git push -u origin codex/mvp-month-view
    gh pr create --base develop --head codex/mvp-month-view --title "feat: MVPのアプリシェルと月ビューを実装" --body $'Closes #8\n\n## 概要\n- Stackベースのアプリシェルと月ビュー\n- ローカル予定一覧と日本の祝日表示\n- v1設定化を#9・#10で追跡\n\n## 検証\n- npm run typecheck\n- npm run lint\n- npm test -- --runInBand\n- iOS / Android export\n\nNative runtimeの確認結果はIssue #8の検証結果を参照してください。'

PR本文へCloses #8、採用ライブラリ、MVP境界、TODO #9/#10、正確な検証結果、native確認結果を記載する。

- [x] **Step 9: PR状態を確認する**

    gh pr view --json number,url,state,headRefName,baseRefName,headRefOid,statusCheckRollup
    git status --short --branch

Expected: base=develop、head=codex/mvp-month-view、worktree clean。
