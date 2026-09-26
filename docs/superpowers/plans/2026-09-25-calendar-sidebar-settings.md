# カレンダーサイドメニューと設定画面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ハンバーガーボタンから左スライド式サイドメニューを開き、表示モード切替、マイカレンダー表示設定、最小の設定画面への遷移を提供する。

**Architecture:** カレンダー表示ON/OFFは既存`app_settings`へカレンダーID別のbooleanとして保存し、`useCalendarView`が利用者予定だけを表示モデル入力から除外する。サイドメニューは表示準備済みstateとcallbackだけを受け取るpresentation componentとし、設定画面はExpo Routerの薄いrouteからfeature screenを表示する。

**Tech Stack:** Expo SDK 57、Expo Router、React Native Animated/Modal、SQLite、TypeScript、Jest、React Native Testing Library

**Spec:** `docs/superpowers/specs/2026-09-25-calendar-event-editor-expansion-design.md`

## Global Constraints

- 本計画は4段階ロードマップの第2段階だけを対象とし、予定schemaや予定編集モーダルは変更しない。
- サイドメニューは画面幅のおよそ80%、背景暗転、背景操作不可、背景タップ・OS戻る・項目選択で閉じる。
- 表示項目は2日、月、マイカレンダー、設定だけとし、未実装モードや複数カレンダーplaceholderを置かない。
- マイカレンダー非表示でも祝日は残し、予定データは削除しない。
- Reduce Motion時は大きなスライドanimationを行わない。
- 設定画面の本文はアクセシビリティ見出しの「設定」だけとし、項目や説明を追加しない。
- 設定画面は通常のStack push、戻る操作、iOS左端スワイプを使う。
- UIからSQLiteへ直接アクセスしない。
- 自動検証とexportを実機確認済みとして扱わない。

---

### Task 1: マイカレンダー表示設定をRepositoryへ追加する

**Files:**
- Modify: `src/domain/calendar/repositories.ts`
- Modify: `src/data/sqlite/settings-repository.ts`
- Modify: `src/data/sqlite/__tests__/repositories.test.ts`

**Interfaces:**
- Consumes: 既存`app_settings(key, value_json, updated_at)`と`AppDatabase.first/run`。
- Produces: `SettingsRepository.getCalendarVisible(calendarId: string): Promise<boolean>`、`setCalendarVisible(calendarId: string, visible: boolean, updatedAt: string): Promise<void>`。

- [ ] **Step 1: missing、valid、malformed、保存の失敗テストを書く**

```ts
it.each([
  [null, true],
  [{ value_json: 'true' }, true],
  [{ value_json: 'false' }, false],
  [{ value_json: '"false"' }, true],
  [{ value_json: 'broken' }, true],
])('カレンダー表示設定を安全に読み込む', async (row, expected) => {
  const db = createDatabaseDouble();
  db.first.mockResolvedValue(row);
  await expect(new SqliteSettingsRepository(db.database).getCalendarVisible('personal-default'))
    .resolves.toBe(expected);
});

it('カレンダーID別の表示設定をbound parameterでupsertする', async () => {
  const db = createDatabaseDouble();
  await new SqliteSettingsRepository(db.database)
    .setCalendarVisible('personal-default', false, now);
  expect(db.run).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT(key) DO UPDATE'), {
    $key: 'calendar_visible:personal-default',
    $valueJson: 'false',
    $updatedAt: now,
  });
});
```

- [ ] **Step 2: Repositoryテストを実行して型エラーまたはmethod未定義で失敗することを確認する**

Run: `npm test -- src/data/sqlite/__tests__/repositories.test.ts --runInBand`

Expected: `getCalendarVisible` / `setCalendarVisible`未定義でFAIL。

- [ ] **Step 3: Repository契約とSQLite実装を追加する**

```ts
export interface SettingsRepository {
  getDefaultExactDuration(): Promise<ExactDuration>;
  setDefaultExactDuration(value: ExactDuration, updatedAt: string): Promise<void>;
  getUndeterminedFadeMinutes(): Promise<number>;
  getCalendarVisible(calendarId: string): Promise<boolean>;
  setCalendarVisible(calendarId: string, visible: boolean, updatedAt: string): Promise<void>;
}
```

`calendarId.trim()`が空なら読み書きとも例外にし、保存キーは`calendar_visible:${calendarId}`とする。読込値はJSON booleanだけを受け入れ、欠損・文字列・数値・壊れたJSONは`true`へfallbackする。保存はbound parameterと既存upsert形式を使う。

- [ ] **Step 4: Repositoryテストを再実行する**

Run: `npm test -- src/data/sqlite/__tests__/repositories.test.ts --runInBand`

Expected: PASS。

- [ ] **Step 5: Task 1をコミットする**

```bash
git add src/domain/calendar/repositories.ts src/data/sqlite/settings-repository.ts src/data/sqlite/__tests__/repositories.test.ts
git commit -m "feat(settings): カレンダー表示設定を永続化"
```

### Task 2: カレンダーhookで利用者予定だけを表示ON/OFFする

**Files:**
- Modify: `src/features/calendar/hooks/use-calendar-view.ts`
- Modify: `src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx`
- Modify: `src/app/__tests__/index.test.tsx`

**Interfaces:**
- Consumes: Task 1の`getCalendarVisible` / `setCalendarVisible`。
- Produces: `CalendarViewState.calendarName`、`calendarColorId`、`isCalendarVisible`、`isCalendarVisibilityUpdating`、`calendarVisibilityError`、`setCalendarVisible(visible): Promise<boolean>`。

- [ ] **Step 1: 初期読込、非表示、保存成功、保存失敗のhookテストを書く**

```ts
expect(result.current).toMatchObject({
  calendarName: 'マイカレンダー',
  calendarColorId: 'blue',
  isCalendarVisible: true,
});

dependencies.settings.getCalendarVisible.mockResolvedValue(false);
expect(result.current.twoDayDays[1]).toMatchObject({
  holidayName: 'テスト祝日',
  timelineItems: [],
});

await act(async () => expect(await result.current.setCalendarVisible(false)).toBe(true));
expect(dependencies.settings.setCalendarVisible).toHaveBeenCalledWith(
  calendar.id,
  false,
  '2026-09-08T03:00:00.000Z',
);
expect(result.current).toMatchObject({ isCalendarVisible: false, calendarVisibilityError: null });
```

保存失敗時は表示状態を変えず、`calendarVisibilityError: 'カレンダー表示設定を保存できませんでした'`を返す。同期的な`useRef` lockで連打中の2回目は`false`を返し、Repositoryを重複実行しない。

- [ ] **Step 2: hookテストを実行して新state/method未定義で失敗することを確認する**

Run: `npm test -- src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx src/app/__tests__/index.test.tsx --runInBand`

Expected: 新しいRepository mockとstateが未定義でFAIL。

- [ ] **Step 3: snapshotへカレンダー表示情報を追加する**

```ts
type CalendarSnapshot = Readonly<{
  calendarId: string;
  calendarName: string;
  isCalendarVisible: boolean;
  events: readonly CalendarEvent[];
  holidayCoverage: readonly HolidayRangeCoverage[];
  definitions: ReadonlyMap<string, TemporalDefinition>;
  undeterminedFadeMinutes: number;
}>;
```

`loadSnapshot`はdefault calendar取得後に予定、表示設定、fade設定を取得する。表示モデルへ渡す`visibleEvents`だけを`isCalendarVisible ? events : []`へ切り替え、`holidayCoverage`はそのまま渡す。日付ピッカーと選択日agendaにも同じfilterを適用する。

- [ ] **Step 4: `setCalendarVisible`を実装する**

保存成功後だけ現在snapshotとdate-picker snapshotの`isCalendarVisible`を更新する。処理中stateと同期ref lockを設定し、失敗時は現在値を保って日本語エラーを設定する。

- [ ] **Step 5: hookとroute組み立てテストを再実行する**

Run: `npm test -- src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx src/app/__tests__/index.test.tsx --runInBand`

Expected: PASS。

- [ ] **Step 6: Task 2をコミットする**

```bash
git add src/features/calendar/hooks/use-calendar-view.ts src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx src/app/__tests__/index.test.tsx
git commit -m "feat(calendar): カレンダー表示状態を切り替える"
```

### Task 3: 左スライド式サイドメニューを実装する

**Files:**
- Delete: `src/features/calendar/components/calendar-view-menu.tsx`
- Create: `src/features/calendar/components/calendar-side-menu.tsx`
- Modify: `src/features/calendar/components/__tests__/calendar-navigation-components.test.tsx`
- Modify: `src/features/calendar/screens/calendar-screen.tsx`
- Modify: `src/features/calendar/screens/__tests__/calendar-screen.test.tsx`
- Modify: `src/constants/event-colors.ts`
- Modify: `src/features/calendar/__tests__/event-color-palette.test.ts`

**Interfaces:**
- Consumes: Task 2の`CalendarViewState`と既存`CalendarViewMode`。
- Produces: `CalendarSideMenu` presentation componentと`CalendarScreen.onOpenSettings(): void`。

- [ ] **Step 1: パレットの利用者向け色名テストを書く**

```ts
expect(EVENT_COLOR_PALETTE.map(({ id, label }) => [id, label])).toEqual([
  ['blue', '青'], ['teal', '青緑'], ['green', '緑'], ['ochre', '黄土'],
  ['orange', '橙'], ['red', '赤'], ['purple', '紫'], ['gray', '灰'],
]);
```

- [ ] **Step 2: メニューの失敗テストを書く**

80%幅、背景暗転、2日/月だけ、選択state、マイカレンダーのswitchと色名、設定導線を検証する。背景、OS戻る、表示選択、switch保存成功、設定選択がそれぞれcloseすること、保存失敗ではcloseせずalertを残すことを検証する。

```tsx
<CalendarSideMenu
  visible
  mode="twoDay"
  calendarName="マイカレンダー"
  calendarColorId="blue"
  isCalendarVisible
  isCalendarVisibilityUpdating={false}
  calendarVisibilityError={null}
  reduceMotion={false}
  onSelectMode={onSelectMode}
  onSetCalendarVisible={onSetCalendarVisible}
  onOpenSettings={onOpenSettings}
  onClose={onClose}
/>
```

`calendar-side-menu.panel`は`width: '80%'`、`maxWidth: 360`。`Modal.statusBarTranslucent`は`true`。switchのアクセシビリティ名は「マイカレンダーを表示」、設定ボタンは「設定を開く」とする。

- [ ] **Step 3: componentテストを実行してmodule未定義で失敗することを確認する**

Run: `npm test -- src/features/calendar/__tests__/event-color-palette.test.ts src/features/calendar/components/__tests__/calendar-navigation-components.test.tsx src/features/calendar/screens/__tests__/calendar-screen.test.tsx --runInBand`

Expected: `CalendarSideMenu`未定義または期待UI不足でFAIL。

- [ ] **Step 4: 色名とサイドメニューを実装する**

`EVENT_COLOR_PALETTE`へ安定IDと同じ順序で`label`を追加する。メニューは透明`Modal`、全面backdrop、左panel、`Animated.Value`の`translateX`を使う。通常は`Animated.timing(..., { duration: 220, useNativeDriver: true })`、Reduce Motion時は`setValue(0)`または即時closeとする。close中の重複をrefで防ぐ。

- [ ] **Step 5: CalendarScreenへ接続する**

既存`CalendarViewMenu`を`CalendarSideMenu`へ置換し、`state.setCalendarVisible`、stateの表示情報、`reduceMotion`、`onOpenSettings`を渡す。設定選択時はメニューclose完了後にroute callbackを呼ぶ。

- [ ] **Step 6: component/screenテストを再実行する**

Run: `npm test -- src/features/calendar/__tests__/event-color-palette.test.ts src/features/calendar/components/__tests__/calendar-navigation-components.test.tsx src/features/calendar/screens/__tests__/calendar-screen.test.tsx --runInBand`

Expected: PASS。

- [ ] **Step 7: Task 3をコミットする**

```bash
git add src/constants/event-colors.ts src/features/calendar
git commit -m "feat(calendar): 左スライド式サイドメニューを追加"
```

### Task 4: 最小設定画面と通常Stack遷移を追加する

**Files:**
- Create: `src/features/settings/screens/settings-screen.tsx`
- Create: `src/features/settings/screens/__tests__/settings-screen.test.tsx`
- Create: `src/app/settings.tsx`
- Create: `src/app/__tests__/settings.test.tsx`
- Modify: `src/app/_layout.tsx`
- Modify: `src/app/__tests__/_layout.test.tsx`
- Modify: `src/app/index.tsx`
- Modify: `src/app/__tests__/index.test.tsx`

**Interfaces:**
- Consumes: Task 3の`CalendarScreen.onOpenSettings`。
- Produces: `/settings` routeと`SettingsScreen`。

- [ ] **Step 1: feature screenとrouteの失敗テストを書く**

```ts
expect(screen.getByRole('header', { name: '設定' })).toBeOnTheScreen();
expect(screen.queryAllByRole('button')).toHaveLength(0);
```

routeテストは`SettingsRoute`が`SettingsScreen`だけを返すことを確認する。layoutテストは`settings` screenが`headerShown: true`、`title: '設定'`、`gestureEnabled: true`、`animation: 'slide_from_right'`であることを検証する。

- [ ] **Step 2: route/screenテストを実行してmodule未定義で失敗することを確認する**

Run: `npm test -- src/features/settings/screens/__tests__/settings-screen.test.tsx src/app/__tests__/settings.test.tsx src/app/__tests__/_layout.test.tsx src/app/__tests__/index.test.tsx --runInBand`

Expected: 新規screen/route未定義でFAIL。

- [ ] **Step 3: SettingsScreenと薄いrouteを実装する**

```tsx
export function SettingsScreen() {
  const theme = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>設定</Text>
    </View>
  );
}
```

`src/app/settings.tsx`は`return <SettingsScreen />`だけとする。

- [ ] **Step 4: Stackとホームrouteを接続する**

`_layout.tsx`へ`<Stack.Screen name="settings" options={{ headerShown: true, title: '設定', gestureEnabled: true, animation: 'slide_from_right' }} />`を追加する。`index.tsx`は`CalendarScreen.onOpenSettings={() => router.push('/settings')}`を渡す。

- [ ] **Step 5: route/screenテストを再実行する**

Run: `npm test -- src/features/settings/screens/__tests__/settings-screen.test.tsx src/app/__tests__/settings.test.tsx src/app/__tests__/_layout.test.tsx src/app/__tests__/index.test.tsx --runInBand`

Expected: PASS。

- [ ] **Step 6: Task 4をコミットする**

```bash
git add src/features/settings src/app
git commit -m "feat(settings): 最小設定画面への導線を追加"
```

### Task 5: 全体検証、export、レビュー、PR作成

**Files:**
- Verify: `docs/superpowers/specs/2026-09-25-calendar-event-editor-expansion-design.md`
- Verify: all modified files

**Interfaces:**
- Consumes: Tasks 1-4の完成差分。
- Produces: `develop`向けOpen PR。

- [ ] **Step 1: 関連テストをまとめて実行する**

Run: `npm test -- src/data/sqlite/__tests__/repositories.test.ts src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx src/features/calendar/components/__tests__/calendar-navigation-components.test.tsx src/features/calendar/screens/__tests__/calendar-screen.test.tsx src/features/settings/screens/__tests__/settings-screen.test.tsx src/app/__tests__/_layout.test.tsx src/app/__tests__/index.test.tsx src/app/__tests__/settings.test.tsx --runInBand`

Expected: PASS。

- [ ] **Step 2: 標準検証を実行する**

Run: `npm run typecheck`

Run: `npm run lint`

Run: `npm test -- --runInBand`

Run: `git diff --check`

Expected: すべて成功。

- [ ] **Step 3: Expo exportを実行する**

Run: `npx expo export --platform ios --platform android`

Expected: iOS/Android bundle exportが成功する。生成物がGit管理対象外であることを`git status --short`で確認する。

- [ ] **Step 4: 設計整合と独立レビューを行う**

祝日がカレンダー非表示でも残ること、設定失敗で状態を変えないこと、メニューのclose経路、Reduce Motion、設定routeのpush/back gesture、未実装項目がないことを確認する。Critical/Important指摘を解消後、標準検証を再実行する。

- [ ] **Step 5: pushしてPRを作成する**

```bash
git push -u origin codex/calendar-sidebar-settings
gh pr create --base develop --head codex/calendar-sidebar-settings --title "feat: カレンダーのサイドメニューと設定画面を追加" --body "第2段階としてサイドメニュー、カレンダー表示設定、最小設定画面を追加します。検証結果と実機確認項目は本文へ記載します。"
```

PR本文へ目的、`app_settings`のkey/default/validation、画面とRepositoryの境界、検証結果、export結果、実機未確認項目、後続の予定DB/編集画面が別PRであることを記載する。
