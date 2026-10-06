# 2日ビューの時間軸・予定色の視認性改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2日ビューで予定色を反映し、時間線を予定の背後へ置き、倍率に応じて時刻ラベルをフェードさせ、現在時刻ラベルを優先表示する。

**Architecture:** 時刻ラベルの不透明度とラベル矩形の交差判定を`timeline-layout.ts`の純粋関数へ置く。表示モデルはイベントまたはカレンダー既定の`EventColorId`を解決してUIへ渡し、描画コンポーネントは色解決とレイヤー順序だけを担う。

**Tech Stack:** Expo SDK 57、React Native、TypeScript、expo-linear-gradient、Jest / @testing-library/react-native。

**Spec:** `docs/superpowers/specs/2026-10-06-two-day-timeline-visibility-design.md`

## Global Constraints

- 対象は2日ビューのみとし、月ビュー・SQLite schema・Repository契約は変更しない。
- `colorId: null`はカレンダー既定色へ解決し、未知の色IDをUIまで流さない。
- 祝日は予定パレットを使わず、既存の祝日専用色を維持する。
- 偶数時ラベルは常時表示し、奇数時ラベルは`scale` 0.66から0.78の間で0から1へ線形にフェードする。
- 時間線は予定より背後、現在時刻線とドットは予定より前面に置く。時間線は`pointerEvents="none"`を維持する。
- 色だけで状態を伝えず、既存のタイトル・時間表現・範囲形状・アクセシビリティ情報を維持する。
- Reduce Motionでは時間ベースのアニメーションを追加せず、現在の倍率から算出した不透明度を即時反映する。

## Review Focus

- 0.66・0.78ちょうど、および`NaN`・負の倍率で補助ラベルの不透明度が0〜1の範囲へ収まること。
- 現在時刻が定時または隣接定時に近い場合、現在時刻ラベルを優先し、交差しない通常ラベルを消さないこと。
- `colorId: null`、固定色、未知値の既存予定で、タイムラインと終日予定が一貫して安全な色を使うこと。
- フェードした予定の空白部では時間線を見せつつ、不透明な予定部を時間線で分断しないこと。
- ピンチ、縦スクロール、ダブルタップ作成、予定タップ、VoiceOver / TalkBackの倍率操作が後退しないこと。

---

## File Structure

- `src/features/calendar/timeline-layout.ts` — 時刻ラベルの不透明度、ラベル矩形衝突、タイムライン予定の色ID。
- `src/features/calendar/two-day-view-model.ts` — 終日予定のイベント色またはカレンダー既定色の解決。
- `src/features/calendar/hooks/use-calendar-view.ts` — 既に取得した`calendarColorId`を2日ViewModel生成へ渡す。
- `src/features/calendar/components/timeline-event-block.tsx` — パレット色でグラデーションを描画。
- `src/features/calendar/components/two-day-column.tsx` — 終日予定色と背面時間線。
- `src/features/calendar/components/timeline-axis.tsx` — 奇数時ラベルのフェードと現在時刻衝突除去。
- `src/features/calendar/components/two-day-view.tsx` — Axisへ現在の倍率・現在時刻を渡す。
- `src/features/calendar/**/__tests__/*` — 純粋計算、ViewModel、描画の回帰テスト。
- `docs/superpowers/specs/2026-09-09-time-axis-gradients-design.md` — 旧来の前面時間線方針を置換。

### Task 1: 時刻ラベルの表示計算

**Files:**
- Modify: `src/features/calendar/timeline-layout.ts`
- Modify: `src/features/calendar/__tests__/timeline-layout.test.ts`

**Interfaces:**
- Produces: `getTimelineHourLabelOpacity(hour: number, scale: number): number`
- Produces: `doesTimelineLabelOverlap(firstTop: number, secondTop: number, lineHeight: number): boolean`

- [ ] **Step 1: 倍率境界の失敗テストを書く**

```ts
import { getTimelineHourLabelOpacity } from '../timeline-layout';

it('奇数時ラベルを0.66から0.78の倍率でフェード表示する', () => {
  expect(getTimelineHourLabelOpacity(2, 0.4)).toBe(1);
  expect(getTimelineHourLabelOpacity(1, 0.66)).toBe(0);
  expect(getTimelineHourLabelOpacity(1, 0.72)).toBe(0.5);
  expect(getTimelineHourLabelOpacity(1, 0.78)).toBe(1);
});

it('不正な倍率でも補助ラベルの不透明度を制限する', () => {
  expect(getTimelineHourLabelOpacity(1, Number.NaN)).toBe(0);
  expect(getTimelineHourLabelOpacity(1, -1)).toBe(0);
  expect(getTimelineHourLabelOpacity(1, 2)).toBe(1);
});
```

- [ ] **Step 2: 未定義関数として失敗を確認する**

Run: `npm test -- src/features/calendar/__tests__/timeline-layout.test.ts --runInBand`

Expected: `getTimelineHourLabelOpacity`がexportされていないためFAIL。

- [ ] **Step 3: 最小実装を書く**

```ts
export const TIMELINE_ODD_HOUR_LABEL_FADE_START = 0.66;
export const TIMELINE_ODD_HOUR_LABEL_FADE_END = 0.78;

export function getTimelineHourLabelOpacity(hour: number, scale: number): number {
  if (hour % 2 === 0) return 1;
  if (!Number.isFinite(scale) || scale <= TIMELINE_ODD_HOUR_LABEL_FADE_START) return 0;
  if (scale >= TIMELINE_ODD_HOUR_LABEL_FADE_END) return 1;
  return (scale - TIMELINE_ODD_HOUR_LABEL_FADE_START)
    / (TIMELINE_ODD_HOUR_LABEL_FADE_END - TIMELINE_ODD_HOUR_LABEL_FADE_START);
}

export function doesTimelineLabelOverlap(firstTop: number, secondTop: number, lineHeight: number): boolean {
  return Math.abs(firstTop - secondTop) < lineHeight;
}
```

- [ ] **Step 4: 交差判定の失敗テストを追加してから通す**

```ts
expect(doesTimelineLabelOverlap(100, 100, 13)).toBe(true);
expect(doesTimelineLabelOverlap(100, 110, 13)).toBe(true);
expect(doesTimelineLabelOverlap(100, 113, 13)).toBe(false);
```

Run: `npm test -- src/features/calendar/__tests__/timeline-layout.test.ts --runInBand`

Expected: すべてPASS。

- [ ] **Step 5: Task 1をコミットする**

```bash
git add src/features/calendar/timeline-layout.ts src/features/calendar/__tests__/timeline-layout.test.ts
git commit -m "feat(calendar): 時間軸ラベルの表示計算を追加"
```

### Task 2: ViewModelへ予定色を解決して渡す

**Files:**
- Modify: `src/features/calendar/timeline-layout.ts`
- Modify: `src/features/calendar/two-day-view-model.ts`
- Modify: `src/features/calendar/hooks/use-calendar-view.ts`
- Modify: `src/features/calendar/__tests__/timeline-layout.test.ts`
- Modify: `src/features/calendar/__tests__/two-day-view-model.test.ts`
- Modify: `src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx`

**Interfaces:**
- Produces: `TimelineItemViewModel.colorId: EventColorId`
- Produces: 予定由来の`TwoDayAllDayItemViewModel.colorId: EventColorId`
- Consumes: `calendarColorId: EventColorId`。

- [ ] **Step 1: 固定色を保持するタイムライン予定の失敗テストを書く**

```ts
const [item] = createDayTimelineItems({
  ...input,
  calendarColorId: 'teal',
  occurrences: [{ ...input.occurrences[0], event: { ...input.occurrences[0].event, colorId: 'red' } }],
});
expect(item.colorId).toBe('red');
```

- [ ] **Step 2: `colorId`未定義として失敗を確認する**

Run: `npm test -- src/features/calendar/__tests__/timeline-layout.test.ts --runInBand`

Expected: `TimelineItemViewModel`に`colorId`がないためFAIL。

- [ ] **Step 3: タイムライン予定の色IDを解決する**

```ts
export type TimelineItemViewModel = Readonly<{ /* existing fields */ colorId: EventColorId }>;
// item生成時
colorId: event.colorId ?? input.calendarColorId,
```

`createDayTimelineItems`、`createDayViewModel`、`createTwoDayViewModels`、`createTwoDayStripViewModels`のinputへ`calendarColorId`を通し、`use-calendar-view.ts`が取得済みの値を渡す。

- [ ] **Step 4: 終日予定の色IDの失敗テストを書く**

```ts
expect(result[0].allDayItems.find((item) => item.id === 'all-day')?.colorId).toBe('purple');
expect(defaultColorResult[0].allDayItems.find((item) => item.id === 'all-day')?.colorId).toBe('teal');
```

Run: `npm test -- src/features/calendar/__tests__/two-day-view-model.test.ts --runInBand`

Expected: 現在の固定`DEFAULT_EVENT_COLOR_ID`によりFAIL。

- [ ] **Step 5: 終日予定の固定既定色を解決済み色へ置き換える**

```ts
colorId: occurrence.event.colorId ?? input.calendarColorId,
```

祝日itemの`colorId: 'holiday'`は変更しない。

- [ ] **Step 6: Task 2の関連テストを通してコミットする**

Run: `npm test -- src/features/calendar/__tests__/timeline-layout.test.ts src/features/calendar/__tests__/two-day-view-model.test.ts src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx --runInBand`

Expected: PASS。

```bash
git add src/features/calendar/timeline-layout.ts src/features/calendar/two-day-view-model.ts src/features/calendar/hooks/use-calendar-view.ts src/features/calendar/__tests__/timeline-layout.test.ts src/features/calendar/__tests__/two-day-view-model.test.ts src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx
git commit -m "feat(calendar): 2日ビューへ予定色を反映"
```

### Task 3: 予定、時間線、Axisを描画する

**Files:**
- Modify: `src/features/calendar/components/timeline-event-block.tsx`
- Modify: `src/features/calendar/components/two-day-column.tsx`
- Modify: `src/features/calendar/components/timeline-axis.tsx`
- Modify: `src/features/calendar/components/two-day-view.tsx`
- Modify: `src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx`

**Interfaces:**
- Consumes: 解決済み`colorId`、Task 1の表示計算、`getEventColor(id, scheme)`。
- Produces: パレット色の予定、背面時間線、現在時刻を優先するAxis。

- [ ] **Step 1: 描画順と予定色の失敗テストを書く**

```ts
expect(hourLineZIndex).toBeLessThan(eventZIndex);
expect(eventZIndex).toBeLessThan(nowLineZIndex);
expect(view.getByTestId('timeline-event.event-1.gradient').props.colors).toContain(
  expect.stringContaining('179, 38, 30'),
);
```

終日予定についても、背景色が`getEventColor('red', 'light')`であることを検証する。

- [ ] **Step 2: 前面時間線・共通色描画として失敗を確認する**

Run: `npm test -- src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx --runInBand`

Expected: zIndexとgradient色が期待値と異なってFAIL。

- [ ] **Step 3: パレット色とレイヤー順を実装する**

```ts
const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
const eventColor = getEventColor(item.colorId, colorScheme);
const colors = item.opacityStops.map((stop) => withOpacity(eventColor, stop.opacity));
// hour line: zIndex 0, event: 1, now line: 2, now dot: 3
```

`TimelineEventBlock`と予定由来の終日itemにこれを使う。文字色は既存どおり`theme.background`、祝日色は変更しない。時間線の`pointerEvents="none"`を残す。

- [ ] **Step 4: Axisのフェードと衝突除去の失敗テストを書く**

```ts
expect(view.getAllByText('14:00')).toHaveLength(1);
expect(StyleSheet.flatten(view.getByText('13:00').props.style)).toMatchObject({ opacity: 0.5 });
```

テストは`scale: 0.72`と`now: { top: computeHourLineTop(14, 0.72), label: '14:00' }`を渡す。0.66で奇数時不在、0.78でopacity 1、現在時刻なしでは通常ラベルを隠さないケースも追加する。

- [ ] **Step 5: 既存Axisの常時表示・重複表示として失敗を確認する**

Run: `npm test -- src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx --runInBand`

Expected: 奇数時ラベルにopacityがなく、14:00が通常・現在時刻の2つでFAIL。

- [ ] **Step 6: Axisの描画条件を実装する**

```ts
const opacity = getTimelineHourLabelOpacity(hour, scale);
const isHiddenByNow = now !== null && doesTimelineLabelOverlap(labelTop, now.top, styles.label.lineHeight);
if (opacity === 0 || isHiddenByNow) return null;
```

`TwoDayView`は既存どおり現在の`scale`と`now`をAxisへ渡す。追加の`Animated` stateを作らず、Reduce Motionでも算出済みopacityを即時描画する。

- [ ] **Step 7: コンポーネントテストを通してコミットする**

Run: `npm test -- src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx --runInBand`

Expected: PASS。

```bash
git add src/features/calendar/components/timeline-event-block.tsx src/features/calendar/components/two-day-column.tsx src/features/calendar/components/timeline-axis.tsx src/features/calendar/components/two-day-view.tsx src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx
git commit -m "feat(calendar): 2日ビューの時間軸を見やすくする"
```

### Task 4: 設計文書を同期し、全体を検証する

**Files:**
- Modify: `docs/superpowers/specs/2026-09-09-time-axis-gradients-design.md`
- Modify: `docs/superpowers/specs/2026-10-06-two-day-timeline-visibility-design.md`（実装との差分が出た場合のみ）

**Interfaces:**
- Consumes: 承認済み設計書。
- Produces: 時間線前面化が現行仕様ではないと明記したドキュメント。

- [ ] **Step 1: 旧方針があることを確認する**

Run: `rg -n '予定ブロックより手前|高いzIndex' docs/superpowers/specs/2026-09-09-time-axis-gradients-design.md`

Expected: 旧方針の記述が見つかる。

- [ ] **Step 2: 旧方針を新設計への参照へ置き換える**

時間線を予定より前面に置く説明を、`2026-10-06-two-day-timeline-visibility-design.md`がレイヤー順の正本である説明へ更新する。現在時刻線が最前面である記述は残す。

- [ ] **Step 3: 文書差分を検査し、全体検証を実行する**

```bash
git diff --check
npm run typecheck
npm run lint
npm test -- --runInBand
```

Expected: すべてexit code 0。

- [ ] **Step 4: Task 4をコミットしPRを作成する**

```bash
git add docs/superpowers/specs/2026-09-09-time-axis-gradients-design.md docs/superpowers/specs/2026-10-06-two-day-timeline-visibility-design.md
git commit -m "docs(calendar): 時間軸のレイヤー方針を更新"
git push --set-upstream origin codex/improve-two-day-timeline-visibility
```

`gh pr create`の本文には`Closes #38`、予定色・時間線レイヤー・ラベルフェード・現在時刻優先の設計判断、実行済み検証、ライト／ダーク・ピンチ・VoiceOver / TalkBackの実機確認項目を含める。
