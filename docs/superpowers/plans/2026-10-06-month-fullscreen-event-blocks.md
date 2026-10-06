# 月ビューの全画面予定ブロック・1日ビュー導線 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 月ビューを全画面の予定ブロック表示へ更新し、仮の1日ビューとiOS長押しプレビューを接続する。

**Architecture:** `month-view-model.ts`で発生回を週行ごとの最大3レーンsegmentへ変換し、`MonthGrid`は表示済みsegmentだけを描画する。`useDayCalendar`は月表示から独立して対象日を読込み、`/calendar/day/[date]`を通常遷移とiOSの`Link.Preview`で共用する。

**Tech Stack:** Expo SDK 57、Expo Router `Link.Preview`、React Native、TypeScript、expo-linear-gradient、Jest / @testing-library/react-native。

**Spec:** `docs/superpowers/specs/2026-10-06-month-fullscreen-event-blocks-design.md`

## Global Constraints

- 対象は月ビューと仮の1日ビューだけで、SQLite schema・Repository契約・2日ビューは変更しない。
- 各週行の予定レーンは3本まで、並びは複数日予定 > 1日の終日予定 > 当日予定とする。
- 予定自身の`colorId`を優先し、`null`だけカレンダー既定色へfallbackする。祝日は予定帯へ混在させない。
- 日付数字・セル余白・`他N件`は1日ビュー、予定blockは既存の編集routeを開く。
- iOSだけ`Link.Preview`で長押しプレビューを提供し、Android / Webへ独自長押しUIを追加しない。
- 色だけに依存せず、時間表現、形状、読み上げを保持する。すべての実効操作領域は44pt以上とする。

## Review Focus

- 月境界・週境界をまたぐ予定が、開始・途中・終了の形状と継続フェードを正しく持つこと。
- 同じ週で予定が重複した場合に3レーンを超えず、各日の`他N件`が隠れた予定数だけを示すこと。
- 繰り返し発生回と個別変更済み予定の編集で、元シリーズIDと`originalOccurrenceDate`を維持すること。
- 日付導線と予定blockが競合せず、iOSプレビュー中は編集・追加などの副作用を起こさないこと。
- 不正な1日route parameter、読込失敗、日付変更直後の古い非同期結果で誤った予定を表示しないこと。

### Task 1: 月の週行予定segmentを作る

**Files:**
- Modify: `src/features/calendar/month-view-model.ts`
- Modify: `src/features/calendar/__tests__/month-view-model.test.ts`

**Interfaces:**
- Produces: `MonthWeekViewModel`、`MonthEventSegmentViewModel`、`createMonthWeekViewModels(input)`。
- segment: `id`、`eventId`、`originalOccurrenceDate?`、`weekIndex`、`lane`、`startWeekday`、`spanDays`、`position`、継続flags、`colorId`、title、temporalLabel、accessibilityLabel。

- [ ] **Step 1: 表示モデルの失敗テストを書く**

```ts
it('複数日、終日、当日予定の順で3レーンへ配置し、残りを日別hidden countへ入れる', () => {
  const weeks = createMonthWeekViewModels({ grid, occurrences: [single, allDay, spanning, overflow], definitions, calendarColorId: 'blue' });
  expect(weeks[0].segments.map((item) => [item.id, item.lane])).toEqual([
    ['spanning', 0], ['all-day', 1], ['single', 2],
  ]);
  expect(weeks[0].days[2].hiddenEventCount).toBe(1);
});

it('週をまたぐ発生回を連続segmentへ分割して編集identityを保つ', () => {
  const segments = createMonthWeekViewModels({ grid, occurrences: [recurringRange], definitions, calendarColorId: 'teal' }).flatMap((week) => week.segments);
  expect(segments).toMatchObject([
    { position: 'start', continuesToNextWeek: true, eventId: 'series-1', originalOccurrenceDate: '2026-09-04' },
    { position: 'end', continuesFromPreviousWeek: true, eventId: 'series-1', originalOccurrenceDate: '2026-09-04' },
  ]);
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm test -- src/features/calendar/__tests__/month-view-model.test.ts --runInBand`

Expected: `createMonthWeekViewModels`が未exportのためFAIL。

- [ ] **Step 3: 純粋実装を書く**

```ts
export function createMonthWeekViewModels(input: Readonly<{ /* grid, occurrences, definitions, calendarColorId */ }>): readonly MonthWeekViewModel[] {
  // gridを7日単位に分割し、Occurrenceを週区間へclipする。
  // priority -> 週内開始 -> stable key順に、lane 0..2へ貪欲配置する。
  // 配置不能な予定は被覆日だけhidden countを増やす。
}
```

`event.colorId ?? calendarColorId`を解決して既知の`EventColorId`だけをsegmentへ渡す。既存`createMonthDayViewModels`はpicker互換のため残す。

- [ ] **Step 4: focused testを通してコミットする**

Run: `npm test -- src/features/calendar/__tests__/month-view-model.test.ts --runInBand`

Expected: PASS。

```bash
git add src/features/calendar/month-view-model.ts src/features/calendar/__tests__/month-view-model.test.ts
git commit -m "feat(calendar): 月予定を週行segmentへ変換"
```

### Task 2: 月グリッドを全画面予定block表示へ更新する

**Files:**
- Modify: `src/features/calendar/components/month-grid.tsx`
- Modify: `src/features/calendar/components/month-day-cell.tsx`
- Create: `src/features/calendar/components/month-week-event-layer.tsx`
- Create: `src/features/calendar/components/month-day-link.tsx`
- Modify: `src/features/calendar/components/__tests__/month-calendar-components.test.tsx`

**Interfaces:**
- Consumes: Task 1の`MonthWeekViewModel`と既存`MonthDayViewModel`。
- Produces: `MonthGrid`の`onOpenDay(date)`、`onEditEvent(id, originalOccurrenceDate?)` callback。

- [ ] **Step 1: 月予定block・操作導線の失敗テストを書く**

```tsx
it('日付数字と他N件は1日ビューを開き、予定blockは発生回を編集する', async () => {
  const view = await render(<MonthGrid days={days} weeks={weeks} onOpenDay={onOpenDay} onEditEvent={onEditEvent} />);
  await user.press(view.getByRole('button', { name: '2026年9月21日を開く' }));
  await user.press(view.getByRole('button', { name: '他1件、2026年9月21日の予定を開く' }));
  await user.press(view.getByRole('button', { name: '通院、10:00、繰り返し予定' }));
  expect(onOpenDay).toHaveBeenNthCalledWith(1, '2026-09-21');
  expect(onEditEvent).toHaveBeenCalledWith('series-1', '2026-09-21');
});
```

- [ ] **Step 2: 連続帯・3レーン・祝日の失敗テストを書く**

```tsx
expect(view.getAllByTestId('month-calendar.event-block')).toHaveLength(3);
expect(StyleSheet.flatten(view.getByTestId('month-calendar.event-block.spanning').props.style))
  .toMatchObject({ left: '0%', width: '57.142857%' });
expect(view.getByLabelText('2026年9月21日、敬老の日、選択中')).toBeOnTheScreen();
```

このテストでは終端の角丸、週外継続のgradient、`numberOfLines={1}`、44pt以上の実効操作領域も検証する。

- [ ] **Step 3: 失敗を確認する**

Run: `npm test -- src/features/calendar/components/__tests__/month-calendar-components.test.tsx --runInBand`

Expected: 予定blockと`onOpenDay` propsが未実装のためFAIL。

- [ ] **Step 4: 表示コンポーネントを実装する**

```tsx
<View style={styles.week}>
  {week.days.map((day) => <MonthDayCell key={day.date} day={day} onOpenDay={onOpenDay} />)}
  <MonthWeekEventLayer segments={week.segments} onEditEvent={onEditEvent} />
</View>
```

`MonthWeekEventLayer`は3つの絶対配置laneだけを描画し、`LinearGradient`で週外継続端をフェードする。`MonthDayLink`はiOSだけ`Link`、`Link.Trigger`、`Link.Preview`を使い、`useIsPreview()`中は`onOpen`を呼ばない。Android / Webでは通常`Pressable`で`onOpen`を呼ぶ。予定blockを`MonthDayLink`の子に置かない。picker variantは従来の簡易セルを維持する。

- [ ] **Step 5: focused testを通してコミットする**

Run: `npm test -- src/features/calendar/components/__tests__/month-calendar-components.test.tsx --runInBand`

Expected: PASS。

```bash
git add src/features/calendar/components/month-grid.tsx src/features/calendar/components/month-day-cell.tsx src/features/calendar/components/month-week-event-layer.tsx src/features/calendar/components/month-day-link.tsx src/features/calendar/components/__tests__/month-calendar-components.test.tsx
git commit -m "feat(calendar): 月ビューに予定blockを表示"
```

### Task 3: 月表示stateと1日routeを接続する

**Files:**
- Modify: `src/features/calendar/hooks/use-calendar-view.ts`
- Modify: `src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx`
- Modify: `src/features/calendar/screens/calendar-screen.tsx`
- Modify: `src/features/calendar/screens/__tests__/calendar-screen.test.tsx`
- Modify: `src/app/index.tsx`
- Modify: `src/app/__tests__/index.test.tsx`
- Create: `src/features/calendar/hooks/use-day-calendar.ts`
- Create: `src/features/calendar/hooks/__tests__/use-day-calendar.test.tsx`
- Create: `src/features/calendar/screens/day-calendar-screen.tsx`
- Create: `src/features/calendar/screens/__tests__/day-calendar-screen.test.tsx`
- Create: `src/app/calendar/day/[date].tsx`
- Create: `src/app/calendar/day/__tests__/[date].test.tsx`
- Modify: `src/app/_layout.tsx`
- Modify: `src/app/__tests__/_layout.test.tsx`

**Interfaces:**
- Produces: `CalendarViewState.monthWeeks`、`CalendarScreen.onOpenDay(date)`、`useDayCalendar(input): DayCalendarState`。

- [ ] **Step 1: 月state・日別読込の失敗testsを書く**

```tsx
expect(result.current.monthWeeks[0].segments).toMatchObject([{ eventId: 'event-1', colorId: 'red', lane: 0 }]);

it('日付変更後に先の読込結果だけを表示する', async () => {
  const { result, rerender } = renderHook(({ date }) => useDayCalendar({ ...input, date }), { initialProps: { date: '2026-09-21' } });
  rerender({ date: '2026-09-22' });
  await resolveSecondRequest();
  first.resolve(oldSnapshot);
  await waitFor(() => expect(result.current.items).toEqual(secondItems));
});
```

- [ ] **Step 2: navigation・route validationの失敗testsを書く**

```tsx
await user.press(screen.getByRole('button', { name: '2026年9月21日を開く' }));
expect(state.selectDate).toHaveBeenCalledWith('2026-09-21');
expect(onOpenDay).toHaveBeenCalledWith('2026-09-21');
expect(screen.queryByText('2026年9月21日の予定')).not.toBeOnTheScreen();
expect(screen.getByText('日付が正しくありません')).toBeOnTheScreen();
```

1日一覧の空・error/retry、予定tapの`occurrenceDate`維持、preview中の編集callback抑止も加える。`IndexRoute`は`/calendar/day/[date]`へのpushを検証する。

- [ ] **Step 3: 失敗を確認する**

Run: `npm test -- src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx src/features/calendar/hooks/__tests__/use-day-calendar.test.tsx src/features/calendar/screens/__tests__/calendar-screen.test.tsx src/features/calendar/screens/__tests__/day-calendar-screen.test.tsx src/app/__tests__/index.test.tsx src/app/calendar/day/__tests__/[date].test.tsx --runInBand`

Expected: `monthWeeks`、day hook、day screen、day routeが未実装のためFAIL。

- [ ] **Step 4: state・screen・routeを実装する**

`useCalendarView`は同じsnapshotから`monthWeeks`をmemoizeする。月モードで`SelectedDayAgenda`を描画せず、`await state.selectDate(date)`が成功した場合だけ`onOpenDay(date)`を呼ぶ。`useDayCalendar`は`listSchedule`、発生回展開、必要definition、祝日を読込み、request version refとmounted refで古い成功・失敗を捨てる。`DayCalendarScreen`は既存`SelectedDayAgenda`を再利用する。`[date].tsx`は`useLocalSearchParams`のdateを検証して依存を組み立て、`_layout.tsx`へ通常stackを追加する。

- [ ] **Step 5: focused testsを通してコミットする**

Run: `npm test -- src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx src/features/calendar/hooks/__tests__/use-day-calendar.test.tsx src/features/calendar/screens/__tests__/calendar-screen.test.tsx src/features/calendar/screens/__tests__/day-calendar-screen.test.tsx src/app/__tests__/index.test.tsx src/app/calendar/day/__tests__/[date].test.tsx src/app/__tests__/_layout.test.tsx --runInBand`

Expected: PASS。

```bash
git add src/features/calendar/hooks/use-calendar-view.ts src/features/calendar/hooks/use-day-calendar.ts src/features/calendar/screens/calendar-screen.tsx src/features/calendar/screens/day-calendar-screen.tsx src/app/index.tsx src/app/calendar/day/[date].tsx src/app/_layout.tsx src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx src/features/calendar/hooks/__tests__/use-day-calendar.test.tsx src/features/calendar/screens/__tests__/calendar-screen.test.tsx src/features/calendar/screens/__tests__/day-calendar-screen.test.tsx src/app/__tests__/index.test.tsx src/app/calendar/day/__tests__/[date].test.tsx src/app/__tests__/_layout.test.tsx
git commit -m "feat(calendar): 月ビューから1日表示を開く"
```

### Task 4: 文書を同期し全体を検証する

**Files:**
- Modify: `docs/superpowers/specs/2026-09-24-calendar-mobile-ui-redesign-design.md`
- Modify: `docs/superpowers/specs/2026-09-10-event-editor-and-add-flows-design.md`

- [ ] **Step 1: 旧月一覧への参照を確認する**

Run: `rg -n 'SelectedDayAgenda|選択日の予定一覧' docs/superpowers/specs/2026-09-24-calendar-mobile-ui-redesign-design.md docs/superpowers/specs/2026-09-10-event-editor-and-add-flows-design.md`

Expected: 月ビューの常設一覧を前提とする記述が見つかる。

- [ ] **Step 2: 既存設計を更新する**

月ビューの常設一覧を全画面予定blockと1日ビュー導線へ置換する。編集開始が月予定blockと1日一覧の双方から行えることを記し、2日ビューの編集導線は残す。

- [ ] **Step 3: 全体検証を実行する**

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
git diff --check
```

Expected: すべてexit code 0。

- [ ] **Step 4: Task 4をコミットする**

```bash
git add docs/superpowers/specs/2026-09-24-calendar-mobile-ui-redesign-design.md docs/superpowers/specs/2026-09-10-event-editor-and-add-flows-design.md
git commit -m "docs(calendar): 月ビュー導線を更新"
```
