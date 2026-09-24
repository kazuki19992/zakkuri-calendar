# iOSモバイルカレンダーUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ざっくり日時のgradientと1日単位の2日カルーセルを維持したまま、カレンダーをiOS向けモバイルカレンダーUIへ再構成し、月date pickerと最小高さを下回らないピンチ拡大・縮小を追加する。

**Architecture:** `CalendarScreen`はTop Barとoverlayの接続に限定し、Top Bar、view menu、date pickerを独立コンポーネントにする。時間解決、opacity stop、4列カルーセルは維持し、2日タイムラインの倍率だけを専用hookへ分離して、固定日付ヘッダー下の縦ScrollViewへ適用する。

**Tech Stack:** Expo SDK 57、React Native 0.86、Expo Router、React 19、TypeScript、React Native Gesture Handler 2.32、Expo LinearGradient、Jest、Testing Library React Native

**Spec:** `docs/superpowers/specs/2026-09-24-calendar-mobile-ui-redesign-design.md`

## Global Constraints

- `TemporalDefinition`、`CalendarEvent`、DB schema、Repository契約、予定作成フローは変更しない。
- `TWO_DAY_SWIPE_BUFFER_DAYS = 1`、表示2列、1日単位移動、失敗復帰、Reduce Motion、多重入力防止を維持する。
- 列幅は48pt時刻軸を除く`two-day-calendar.day-columns-viewport`の半分とする。
- fuzzy予定の`opacityStops`、`undeterminedFadeMinutes`、濃い領域への文字配置を簡略化しない。
- 2日ビューの初期・最小倍率は現在の24時間フィット倍率とし、それ未満へ縮小しない。
- 新しい依存は追加しない。既存の`react-native-gesture-handler ~2.32.0`を使う。
- safe areaは`CalendarScreen`のルート1か所で管理する。
- 新しいテスト名、コメント、JSDocは日本語で書く。
- exportやunit testを実機の見た目・gesture・performance確認とは扱わない。

## File Map

- Create `src/features/calendar/calendar-top-bar-model.ts`: 月・年表示の純粋モデル。
- Create `src/features/calendar/components/calendar-top-bar.tsx`: ハンバーガー、月名、今日ボタン。
- Create `src/features/calendar/components/calendar-view-menu.tsx`: 2日／月だけのcompact modal。
- Create `src/features/calendar/components/calendar-date-picker.tsx`: Top Bar直下の月date picker。
- Create `src/features/calendar/hooks/use-timeline-zoom.ts`: fit倍率とpinch倍率の管理。
- Modify `src/features/calendar/hooks/use-calendar-view.ts`: `showDate`とpicker月snapshot。
- Modify `src/features/calendar/screens/calendar-screen.tsx`: 新しいnavigation UIを接続。
- Modify `src/features/calendar/components/two-day-view.tsx`: 固定headerとpinch可能な縦timeline。
- Modify `src/features/calendar/components/two-day-column.tsx`: compact日付header、grid、now dot。
- Modify `src/features/calendar/components/timeline-axis.tsx`: 1時間ごとの小さいlabel。
- Modify `src/features/calendar/components/timeline-event-block.tsx`: 高密度な予定表示。
- Modify `src/features/calendar/components/month-grid.tsx`、`month-day-cell.tsx`: cardをやめたcompact grid。
- Modify `src/constants/theme.ts`: light/dark calendar semantic token。
- Modify `src/app/_layout.tsx`: `GestureHandlerRootView`。
- Delete `calendar-period-toolbar.tsx`、`calendar-view-switcher.tsx`: 新UI統合後に参照0件を確認して削除。

---

### Task 1: Top Bar表示モデルと任意日移動

**Files:**
- Create: `src/features/calendar/calendar-top-bar-model.ts`
- Create: `src/features/calendar/__tests__/calendar-top-bar-model.test.ts`
- Modify: `src/features/calendar/hooks/use-calendar-view.ts`
- Modify: `src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx`

**Interfaces:**
- Produces `createCalendarTopBarModel(displayDate: string, today: string): CalendarTopBarModel`。
- Produces `CalendarViewState.showDate(date: string): Promise<boolean>`。

- [ ] **Step 0: fresh worktreeへ依存を導入する**

Run: `npm ci --include=dev`

Expected: exit 0 and `package-lock.json` unchanged.

- [ ] **Step 1: 表示モデルの失敗テストを書く**

```ts
expect(createCalendarTopBarModel('2026-09-24', '2026-09-01')).toEqual({
  monthLabel: '9月', yearLabel: null,
  accessibilityLabel: '2026年9月、日付を選択',
});
expect(createCalendarTopBarModel('2027-01-01', '2026-09-01').yearLabel).toBe('2027');
```

- [ ] **Step 2: 未実装で失敗することを確認する**

Run: `npm test -- src/features/calendar/__tests__/calendar-top-bar-model.test.ts --runInBand`

Expected: FAIL with missing module.

- [ ] **Step 3: 表示モデルを最小実装する**

```ts
export function createCalendarTopBarModel(displayDate: string, today: string) {
  const [year, month] = displayDate.split('-').map(Number);
  const [todayYear] = today.split('-').map(Number);
  return {
    monthLabel: `${month}月`,
    yearLabel: year === todayYear ? null : String(year),
    accessibilityLabel: `${year}年${month}月、日付を選択`,
  } as const;
}
```

- [ ] **Step 4: `showDate`の2日・月・失敗テストを書く**

```ts
await act(async () => expect(await result.current.showDate('2026-09-30')).toBe(true));
expect(result.current).toMatchObject({
  anchorDate: '2026-09-30', visibleMonth: '2026-09-01', selectedDate: '2026-09-30',
});
```

月モードでは10月選択後に`visibleMonth: '2026-10-01'`、取得失敗時は元の日付を維持して`periodError`を設定する。

- [ ] **Step 5: `showDate`を実装する**

```ts
const showDate = useCallback((date: string) => {
  const current = stateRef.current;
  return transitionTo({
    ...current,
    anchorDate: date,
    visibleMonth: getMonthStart(date),
    selectedDate: date,
  });
}, [transitionTo]);
```

- [ ] **Step 6: 対象テストを通す**

Run: `npm test -- src/features/calendar/__tests__/calendar-top-bar-model.test.ts src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 7: コミットする**

```bash
git add src/features/calendar/calendar-top-bar-model.ts src/features/calendar/__tests__/calendar-top-bar-model.test.ts src/features/calendar/hooks/use-calendar-view.ts src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx
git commit -m "feat(calendar): 任意日への表示移動を追加"
```

---

### Task 2: Date picker用の独立月snapshot

**Files:**
- Modify: `src/features/calendar/hooks/use-calendar-view.ts`
- Modify: `src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx`

**Interfaces:**
- Produces `datePickerMonth`、`datePickerDays`、`isDatePickerLoading`、`datePickerError`。
- Produces `loadDatePickerMonth(month: string): Promise<boolean>`。
- picker取得はmainの`anchorDate`、`visibleMonth`、snapshotを変更しない。

- [ ] **Step 1: picker月取得の失敗テストを書く**

```ts
await act(async () => expect(await result.current.loadDatePickerMonth('2026-10-01')).toBe(true));
expect(result.current.datePickerMonth).toBe('2026-10-01');
expect(result.current.datePickerDays).toHaveLength(42);
expect(result.current.anchorDate).toBe('2026-09-08');
```

別テストで取得失敗時に既存42日を維持し、`datePickerError`だけを設定する。

- [ ] **Step 2: interface不足で失敗することを確認する**

Run: `npm test -- src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx --runInBand`

Expected: FAIL because `loadDatePickerMonth` is undefined.

- [ ] **Step 3: picker専用stateとrequest IDを実装する**

```ts
type DatePickerState = Readonly<{
  month: string; snapshot: CalendarSnapshot; isLoading: boolean; error: string | null;
}>;
const datePickerRequestIdRef = useRef(0);
```

`loadDatePickerMonth`は`mode: 'month'`の一時`ViewTarget`を`loadSnapshot`へ渡すが、成功時にもmain stateを変更しない。unmountでpicker requestも無効化する。

- [ ] **Step 4: `datePickerDays`を既存modelから生成する**

```ts
const datePickerDays = useMemo(() => createMonthDayViewModels({
  grid: getMonthGrid(datePickerState.month, input.weekStartsOn),
  selectedDate: state.selectedDate,
  today: state.today,
  events: datePickerState.snapshot.events,
  holidayCoverage: datePickerState.snapshot.holidayCoverage,
}), [datePickerState, input.weekStartsOn, state.selectedDate, state.today]);
```

- [ ] **Step 5: 遅い旧応答が新しいpicker月を上書きしないテストを追加する**

10月取得より後に開始した11月取得を先に完了し、最終値が11月のままであることを検証する。

- [ ] **Step 6: hookテストを通す**

Run: `npm test -- src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 7: コミットする**

```bash
git add src/features/calendar/hooks/use-calendar-view.ts src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx
git commit -m "feat(calendar): 日付選択用の月データを取得する"
```

---

### Task 3: Themeとcompact月グリッド

**Files:**
- Modify: `src/constants/theme.ts`
- Modify: `src/features/calendar/components/month-grid.tsx`
- Modify: `src/features/calendar/components/month-day-cell.tsx`
- Modify: `src/features/calendar/components/selected-day-agenda.tsx`
- Modify: `src/features/calendar/components/__tests__/month-calendar-components.test.tsx`
- Modify: `src/features/calendar/screens/__tests__/calendar-screen.test.tsx`

**Interfaces:**
- Adds `calendarEventText`、`calendarOverlay`、`calendarBackdrop` to both themes.
- Adds optional `variant?: 'month' | 'picker'` to `MonthGrid` and `MonthDayCell`。

- [ ] **Step 1: semantic tokenの失敗テストを書く**

```ts
expect(Colors.light).toMatchObject({
  text: '#202124', background: '#FFFFFF', textSecondary: '#5F6368',
  calendarBorder: '#DADCE0', calendarAccent: '#1A73E8', calendarEventText: '#174EA6',
});
expect(Colors.dark).toMatchObject({
  background: '#202124', text: '#E8EAED', calendarEventText: '#D2E3FC',
});
```

- [ ] **Step 2: 月セルの失敗テストを書く**

今日の数字が円形accent、選択状態が別の淡い面と`accessibilityState.selected`、cell自身にcard radiusがないことを検証する。`variant="picker"`でも7×6、予定dot、44pt targetを検証する。

- [ ] **Step 3: 旧theme/card styleで失敗することを確認する**

Run: `npm test -- src/features/calendar/components/__tests__/month-calendar-components.test.tsx src/features/calendar/screens/__tests__/calendar-screen.test.tsx --runInBand`

Expected: FAIL on old colors and cell border/radius.

- [ ] **Step 4: light/dark tokenと数字circleを実装する**

```tsx
<View style={[styles.dayCircle, day.isToday && { backgroundColor: theme.calendarAccent }]}>
  <Text style={[styles.dayNumber, day.isToday && { color: theme.background }]}>{day.dayNumber}</Text>
</View>
```

月は連続grid、pickerはoverlay内のcompact余白にする。`SelectedDayAgenda`は見出し15pt、項目14pt程度へ下げるが44pt targetは残す。

- [ ] **Step 5: 対象テストを通す**

Run: `npm test -- src/features/calendar/components/__tests__/month-calendar-components.test.tsx src/features/calendar/screens/__tests__/calendar-screen.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 6: コミットする**

```bash
git add src/constants/theme.ts src/features/calendar/components/month-grid.tsx src/features/calendar/components/month-day-cell.tsx src/features/calendar/components/selected-day-agenda.tsx src/features/calendar/components/__tests__/month-calendar-components.test.tsx src/features/calendar/screens/__tests__/calendar-screen.test.tsx
git commit -m "feat(calendar): テーマと月表示を高密度化"
```

---

### Task 4: Top Bar、view menu、date picker

**Files:**
- Create: `src/features/calendar/components/calendar-top-bar.tsx`
- Create: `src/features/calendar/components/calendar-view-menu.tsx`
- Create: `src/features/calendar/components/calendar-date-picker.tsx`
- Modify: `src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx`
- Modify: `src/features/calendar/components/__tests__/month-calendar-components.test.tsx`

**Interfaces:**
- `CalendarTopBar({ model, isLoading, onOpenMenu, onToggleDatePicker, onToday })`。
- `CalendarViewMenu({ visible, mode, onSelectMode, onClose })`。
- `CalendarDatePicker({ visible, month, days, isLoading, error, topOffset, onPreviousMonth, onNextMonth, onSelectDate, onClose })`。`topOffset`はrootが確保した上端safe areaとTop Bar高の合計を渡す。

- [ ] **Step 1: Top Barとmenuの失敗テストを書く**

```ts
expect(screen.getByRole('button', { name: '表示メニューを開く' })).toBeOnTheScreen();
expect(screen.getByRole('button', { name: '2026年9月、日付を選択' })).toBeOnTheScreen();
expect(screen.getByRole('button', { name: '今日へ移動' })).toBeOnTheScreen();
expect(screen.getByRole('menuitem', { name: '2日表示' })).toHaveAccessibilityState({ selected: true });
expect(screen.queryByText('3日')).toBeNull();
```

各Top Bar buttonの`minWidth`、`minHeight`が44以上であることも検証する。

- [ ] **Step 2: pickerの失敗テストを書く**

```ts
expect(screen.getByRole('dialog', { name: '日付を選択' })).toBeOnTheScreen();
expect(screen.getByText('2026年9月')).toBeOnTheScreen();
expect(screen.getAllByTestId('month-calendar.week')).toHaveLength(6);
```

前後月、日付選択成功時のclose、失敗時のerrorとopen維持、backdrop closeを検証する。

- [ ] **Step 3: component未実装で失敗することを確認する**

Run: `npm test -- src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx src/features/calendar/components/__tests__/month-calendar-components.test.tsx --runInBand`

Expected: FAIL with missing modules.

- [ ] **Step 4: Top Barとmenuを実装する**

標準`Pressable`と文字記号を使い、icon依存を増やさない。view menuはtransparent `Modal`、fade、backdrop、2項目だけを持つ。選択成功時だけ閉じ、loading中は多重tapを拒否する。

- [ ] **Step 5: date pickerを実装する**

```tsx
<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
  <Pressable testID="calendar-date-picker.backdrop" style={styles.backdrop} onPress={onClose}>
    <View accessibilityRole="dialog" accessibilityLabel="日付を選択" onStartShouldSetResponder={() => true}>
      <MonthGrid variant="picker" days={days} onSelectDate={(date) => void select(date)} />
    </View>
  </Pressable>
</Modal>
```

inner panelのtapをbackdropへ伝播させず、loading中は月移動と日付選択をdisabledにする。

- [ ] **Step 6: component testsを通す**

Run: `npm test -- src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx src/features/calendar/components/__tests__/month-calendar-components.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 7: コミットする**

```bash
git add src/features/calendar/components/calendar-top-bar.tsx src/features/calendar/components/calendar-view-menu.tsx src/features/calendar/components/calendar-date-picker.tsx src/features/calendar/components/__tests__
git commit -m "feat(calendar): トップバーと日付選択UIを追加"
```

---

### Task 5: CalendarScreenへnavigation UIを統合

**Files:**
- Modify: `src/features/calendar/screens/calendar-screen.tsx`
- Modify: `src/features/calendar/screens/__tests__/calendar-screen.test.tsx`
- Delete: `src/features/calendar/components/calendar-period-toolbar.tsx`
- Delete: `src/features/calendar/components/calendar-view-switcher.tsx`

**Interfaces:**
- Consumes Tasks 1-4 interfaces。
- Existing `useTwoDayCarousel`、`useHorizontalSwipeTransition` interfaces remain unchanged.

- [ ] **Step 1: screenの失敗テストへ更新する**

```ts
expect(screen.getByRole('button', { name: '表示メニューを開く' })).toBeOnTheScreen();
expect(screen.getByText('9月')).toBeOnTheScreen();
expect(screen.queryByText('2026年9月8日〜9日')).toBeNull();
await user.press(screen.getByRole('button', { name: '今日へ移動' }));
expect(callbacks.showToday).toHaveBeenCalledTimes(1);
```

menuから月表示、月名からpicker、picker月移動、`showDate`成功・失敗をscreen testで通す。

- [ ] **Step 2: 旧画面構造で失敗することを確認する**

Run: `npm test -- src/features/calendar/screens/__tests__/calendar-screen.test.tsx --runInBand`

Expected: FAIL because new Top Bar is absent.

- [ ] **Step 3: overlay stateとTop Bar modelを接続する**

```ts
const [isViewMenuVisible, setViewMenuVisible] = useState(false);
const [isDatePickerVisible, setDatePickerVisible] = useState(false);
const displayDate = isTwoDay ? state.anchorDate : state.visibleMonth;
const topBarModel = createCalendarTopBarModel(displayDate, state.today);
```

picker open時は`loadDatePickerMonth(getMonthStart(displayDate))`を開始する。月ビューのTop BarはScrollView外へ出し、Animated.Viewにはgridとagendaだけを入れる。

- [ ] **Step 4: 旧header controlsを外し参照0件を確認する**

Run: `rg -n "CalendarPeriodToolbar|CalendarViewSwitcher" src`

Expected: 旧component本体以外0件。確認後に2ファイルを削除し、再度0件にする。

- [ ] **Step 5: screen testsを通す**

Run: `npm test -- src/features/calendar/screens/__tests__/calendar-screen.test.tsx src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx src/features/calendar/components/__tests__/month-calendar-components.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 6: コミットする**

```bash
git add src/features/calendar/screens src/features/calendar/components
git commit -m "feat(calendar): 新しい画面ナビゲーションを統合"
```

---

### Task 6: 2日ヘッダー、時刻軸、予定visual

**Files:**
- Modify: `src/features/calendar/components/two-day-column.tsx`
- Modify: `src/features/calendar/components/timeline-axis.tsx`
- Modify: `src/features/calendar/components/timeline-event-block.tsx`
- Modify: `src/features/calendar/components/calendar-add-event-button.tsx`
- Modify: `src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx`
- Modify: `src/features/calendar/__tests__/timeline-layout.test.ts`

**Interfaces:**
- Existing component props and `TimelineItemViewModel.opacityStops` remain unchanged.
- Exact keeps opaque stops `[1,1]`; fuzzy/undetermined locations and opacity values pass unchanged to `LinearGradient`.

- [ ] **Step 1: compact headerと1時間labelの失敗テストを書く**

```ts
expect(screen.getByText('木')).toBeOnTheScreen();
expect(screen.getByText('24')).toBeOnTheScreen();
expect(screen.queryByText('今日')).toBeNull();
expect(screen.getByLabelText(/今日/)).toBeOnTheScreen();
expect(screen.getAllByTestId('two-day-calendar.hour-label')).toHaveLength(25);
expect(screen.getByTestId('two-day-calendar.now-dot')).toBeOnTheScreen();
```

- [ ] **Step 2: exact/fuzzy visualの失敗テストを書く**

```ts
expect(screen.getByTestId('timeline-event.exact.gradient').props.locations).toEqual([0, 1]);
expect(screen.getByTestId('timeline-event.fuzzy.gradient').props.locations).toEqual([0, 0.65, 1]);
expect(StyleSheet.flatten(screen.getByTestId('timeline-event.exact.card').props.style)).toMatchObject({
  borderRadius: 3, overflow: 'hidden',
});
```

light/darkで`calendarEventText`を使い、shadowとborderがないことを検証する。

- [ ] **Step 3: fade回帰テストを補強する**

`fadeInRatio/fadeOutRatio`の4組、未定時間、日跨ぎclip、definition変更後のtop/height/stopsをtable testで固定する。

- [ ] **Step 4: 旧visualで失敗することを確認する**

Run: `npm test -- src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx src/features/calendar/__tests__/timeline-layout.test.ts --runInBand`

Expected: component assertions FAIL、layout regression assertions PASS.

- [ ] **Step 5: header、axis、now dot、event、FABを更新する**

今日circleは32〜36pt、日付20〜24pt、曜日11〜12pt、祝日9〜11pt。axisは0〜24の25label、10〜11pt。eventはradius 3〜4pt、padding 2〜4pt、title 11〜13pt、secondary 10pt。FABは56pt、right/bottom 18pt、light shadowとAndroid elevationを使う。

- [ ] **Step 6: opacity stopと配置計算が無変更であることをdiff確認する**

Run: `git diff -- src/features/calendar/timeline-layout.ts src/features/calendar/two-day-view-model.ts`

Expected: test追加以外のproduction logic差分なし。

- [ ] **Step 7: 対象テストを通す**

Run: `npm test -- src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx src/features/calendar/__tests__/timeline-layout.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 8: コミットする**

```bash
git add src/features/calendar/components src/features/calendar/__tests__/timeline-layout.test.ts
git commit -m "feat(calendar): 2日タイムラインの外観を刷新"
```

---

### Task 7: Timeline zoom hook

**Files:**
- Create: `src/features/calendar/hooks/use-timeline-zoom.ts`
- Create: `src/features/calendar/hooks/__tests__/use-timeline-zoom.test.tsx`

**Interfaces:**
- Produces `clampTimelineScale(scale: number, fitScale: number): number`。
- Produces `useTimelineZoom(fitScale)` returning `scale`、`isPinching`、`beginPinch`、`updatePinch`、`endPinch`、`zoomIn`、`zoomOut`。
- Accessibility increment/decrement step is `0.1`。

- [ ] **Step 1: clampの失敗テストを書く**

```ts
expect(clampTimelineScale(0.2, 0.4)).toBe(0.4);
expect(clampTimelineScale(0.7, 0.4)).toBe(0.7);
expect(clampTimelineScale(1.2, 0.4)).toBe(1);
expect(clampTimelineScale(1.4, 1.2)).toBe(1.2);
expect(clampTimelineScale(Number.NaN, 0.4)).toBe(0.4);
```

- [ ] **Step 2: pinch lifecycleの失敗テストを書く**

```ts
const { result, rerender } = renderHook(({ fit }) => useTimelineZoom(fit), {
  initialProps: { fit: 0.4 },
});
act(() => result.current.beginPinch());
act(() => result.current.updatePinch(2));
expect(result.current.scale).toBe(0.8);
act(() => result.current.endPinch());
rerender({ fit: 0.9 });
expect(result.current.scale).toBe(0.9);
```

- [ ] **Step 3: module不足で失敗することを確認する**

Run: `npm test -- src/features/calendar/hooks/__tests__/use-timeline-zoom.test.tsx --runInBand`

Expected: FAIL with missing module.

- [ ] **Step 4: clampとhookを実装する**

```ts
export function clampTimelineScale(scale: number, fitScale: number): number {
  const minimum = Number.isFinite(fitScale) && fitScale > 0 ? fitScale : 1;
  const maximum = Math.max(minimum, 1);
  if (!Number.isFinite(scale)) return minimum;
  return Math.min(Math.max(scale, minimum), maximum);
}
```

begin時のscaleをrefへ保存し、updateは`startScale * factor`をclampする。fitScale変更effectも現在scaleを新境界へclampする。

- [ ] **Step 5: hook testsを通す**

Run: `npm test -- src/features/calendar/hooks/__tests__/use-timeline-zoom.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 6: コミットする**

```bash
git add src/features/calendar/hooks/use-timeline-zoom.ts src/features/calendar/hooks/__tests__/use-timeline-zoom.test.tsx
git commit -m "feat(calendar): タイムライン倍率管理を追加"
```

---

### Task 8: Pinch・縦scroll・横carouselのgesture統合

**Files:**
- Modify: `src/app/_layout.tsx`
- Modify: `src/features/calendar/components/two-day-view.tsx`
- Modify: `src/features/calendar/hooks/use-two-day-carousel.ts`
- Modify: `src/features/calendar/hooks/__tests__/use-two-day-carousel.test.tsx`
- Modify: `src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx`
- Modify: `src/app/__tests__/_layout.test.tsx`

**Interfaces:**
- Consumes Task 7 hook.
- `TwoDayView` external props remain unchanged.
- Carousel capture requires `numberActiveTouches === 1`.

- [ ] **Step 0: SDK固定の公式資料を再確認する**

Read: `https://docs.expo.dev/versions/v57.0.0/sdk/gesture-handler/`

Read: `https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/pinch-gesture/`

Expected: Expo SDK 57の推奨版がrepositoryの`~2.32.0`と一致し、`GestureHandlerRootView`、`GestureDetector`、`Gesture.Pinch()`のAPIが使用可能。差異がある場合は実装せず、計画と現行依存の差分をユーザーへ示す。

- [ ] **Step 1: root wrapperとpointer guardの失敗テストを書く**

RootLayout contentが`GestureHandlerRootView`配下で`flex: 1`を持つことを検証する。PanResponderへ`dx: 60, dy: 0, numberActiveTouches: 2`を渡してfalse、1ならtrueを検証する。

- [ ] **Step 2: zoom統合の失敗テストを書く**

```ts
expect(screen.getByTestId('two-day-calendar.timeline-scroll').props.scrollEnabled).toBe(false);
fireEvent(screen.getByTestId('two-day-calendar.timeline-zoom'), 'accessibilityAction', {
  nativeEvent: { actionName: 'increment' },
});
expect(screen.getByTestId('two-day-calendar.timeline-scroll').props.scrollEnabled).toBe(true);
```

`increment: 拡大`、`decrement: 縮小`があり、縮小を繰り返してもtimeline heightがfit height未満にならないことも検証する。
event上のpressが`onEditEvent`、空き領域のdouble tapが`onCreateExactAt`を拡大後も呼ぶことも検証する。

- [ ] **Step 3: 未統合で失敗することを確認する**

Run: `npm test -- src/features/calendar/hooks/__tests__/use-two-day-carousel.test.tsx src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx src/app/__tests__/_layout.test.tsx --runInBand`

Expected: FAIL on root, pointer guard, zoom test IDs.

- [ ] **Step 4: RootLayoutをGestureHandlerRootViewで包む**

```tsx
<GestureHandlerRootView style={{ flex: 1 }}>
  <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
    {/* existing providers and Stack */}
  </ThemeProvider>
</GestureHandlerRootView>
```

- [ ] **Step 5: TwoDayViewを固定summaryとscroll timelineへ分離する**

timeline viewportの`onLayout`からfitScaleを計算する。timeline row全体を1つの縦ScrollViewへ入れ、時刻軸と4列stripへ同じscaleを渡す。content heightは`TIMELINE_HEIGHT * scale`、`scrollEnabled`は`scale > fitScale + 0.001`。

- [ ] **Step 6: Pinch gestureとaccessibility actionを接続する**

```ts
const pinch = Gesture.Pinch()
  .runOnJS(true)
  .onBegin(zoom.beginPinch)
  .onUpdate((event) => zoom.updatePinch(event.scale))
  .onEnd(zoom.endPinch)
  .onFinalize(zoom.endPinch);
```

`GestureDetector`の直接の子をnative Viewにして`collapsable={false}`。pinch中は空き領域double tapを無効にする。

- [ ] **Step 7: Carouselへ1 pointer guardを追加する**

```ts
onMoveShouldSetPanResponderCapture: (_, gesture) =>
  gesture.numberActiveTouches === 1 &&
  !isAnimating &&
  Math.abs(gesture.dx) > 8 &&
  Math.abs(gesture.dx) > Math.abs(gesture.dy) * horizontalDominance,
```

- [ ] **Step 8: gesture testsを通す**

Run: `npm test -- src/features/calendar/hooks/__tests__/use-timeline-zoom.test.tsx src/features/calendar/hooks/__tests__/use-two-day-carousel.test.tsx src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx src/app/__tests__/_layout.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 9: コミットする**

```bash
git add src/app src/features/calendar/components/two-day-view.tsx src/features/calendar/hooks/use-two-day-carousel.ts src/features/calendar/hooks/__tests__/use-two-day-carousel.test.tsx src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx
git commit -m "feat(calendar): 2日タイムラインのピンチ拡大を追加"
```

---

### Task 9: 全体検証と視覚自己レビュー

**Files:**
- Modify only scoped files from Tasks 1-8 when verification exposes a regression.
- Update the approved spec only if an implementation detail necessarily differs, and explain that difference before changing it.

**Interfaces:** No new interface.

- [ ] **Step 1: calendar testsを実行する**

Run: `npm test -- src/features/calendar src/app/__tests__/index.test.tsx src/app/__tests__/_layout.test.tsx --runInBand`

Expected: PASS including exact/fuzzy、4列carousel、picker、Top Bar、month grid、pinch.

- [ ] **Step 2: repository標準検証を実行する**

Run: `npm run typecheck`

Expected: exit 0.

Run: `npm run lint`

Expected: exit 0 with no new warnings.

Run: `npm test -- --runInBand`

Expected: all suites PASS.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 3: iOS・Android exportを実行する**

Run: `npx expo export --platform ios`

Expected: exit 0.

Run: `npx expo export --platform android`

Expected: exit 0.

- [ ] **Step 4: origin/developとの差分を自己レビューする**

Run: `git diff origin/develop...HEAD -- src docs/superpowers/specs docs/superpowers/plans`

次を確認する。

- opacity stop、`undeterminedFadeMinutes`、位置・高さ計算に意図しない変更がない。
- 4列、columnWidth、1日移動、failure rollbackが維持されている。
- Top Bar、menu、pickerにダミー項目や第三者ブランド資産がない。
- pinchが複数pointerでcarouselを誤作動させない。
- light/dark双方に全tokenがある。
- 旧toolbar/switcherと古い期待値が残っていない。

- [ ] **Step 5: 実機・シミュレータ確認を行う**

可能ならiPhone SE相当、6.1インチ、大型iPhoneで確認する。

- 24時間fitが現在の高さ未満にならず、pinch inがfitで止まる。
- pinch out後の縦scroll、event上横swipe、event tap、空き領域double tapが共存する。
- `9/24 | 9/25`から`9/25 | 9/26`へjumpなく移動する。
- fuzzy「午後」がfade付き時間範囲として理解できる。
- light/dark、Reduce Motion、文字拡大、VoiceOver/TalkBack。

未実施項目はPR本文の「実機未確認」に列挙する。

- [ ] **Step 6: verificationで修正した場合だけコミットする**

```bash
git add src docs/superpowers/specs
git commit -m "fix(calendar): 全体検証の指摘を反映"
```

修正がなければ空コミットを作らない。

## Final Delivery

実装完了後は`superpowers:requesting-code-review`と`superpowers:verification-before-completion`を使う。PRを作成する場合はbaseを`develop`とし、日本語本文へ変更概要、gradientとcarousel維持の根拠、pinch境界、実行した検証、実機未確認項目を記載する。
