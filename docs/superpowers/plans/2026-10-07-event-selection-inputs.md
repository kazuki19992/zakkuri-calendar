# 予定登録の選択・時間入力操作 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 予定編集の単一選択を共通ボトムシートへ統一し、Reduce Motion対応タブ遷移と0〜23時間59分の通知ドラムロールを追加する。

**Architecture:** React Native標準の`Modal`、`FlatList`、`Animated`だけで汎用部品を`src/shared/components`へ作る。予定編集featureはdomain値を表示optionへ変換し、既存hook callbackへ返すだけにして保存形式とRepositoryを変更しない。

**Tech Stack:** Expo SDK 57、React Native、TypeScript、Jest、`@testing-library/react-native`。

**Spec:** `docs/superpowers/specs/2026-10-07-event-selection-inputs-design.md`

## Global Constraints

- iOS/Androidとも同じアプリ内ボトムシートを使い、外部依存を追加しない。
- 共通部品は`src/shared/components`、イベント固有のoption変換は`src/features/events`に置く。
- 通知ドラムは0〜23時間・0〜59分とし、1日前は既存presetで扱う。
- SQLite schema、Repository、通知の端末発火は変更しない。
- 色と選択状態をラベル、チェック、`accessibilityState`でも示し、操作領域を44pt以上にする。
- シートとタブ遷移はReduce Motionを尊重する。

## Review Focus

- 取消、Android back、背景tapでは値を変えず、閉じるcallbackを一度だけ呼ぶこと。
- optionが0件、現在値がoptionにない場合もcrashせず、fallback文言とdisabled状態を保つこと。
- 同じlabelが別groupにあってもvalueで識別し、groupと選択状態を正しく読み上げること。
- 0分、1439分、既存通知と同値の確定を正しく既存追加処理へ渡すこと。
- タブ連続操作やReduce Motion変更で古いanimation完了が最新選択を戻さないこと。

---

### Task 1: 共通の単一選択ボトムシートを作る

**Files:**
- Create: `src/shared/components/single-select-sheet.tsx`
- Create: `src/shared/components/__tests__/single-select-sheet.test.tsx`

**Interfaces:**
- Produces: `SingleSelectOption<T>`と`SingleSelectSheet<T>`。
- `SingleSelectSheet<T>` props: `visible`、`title`、`value`、`options`、`disabled?`、`onSelect(value)`、`onClose()`。

- [ ] **Step 1: group・選択・取消の失敗テストを書く**

```tsx
const options = [
  { value: 'morning', label: '朝', group: 'この日' },
  { value: 'this-week', label: '今週中', group: '週単位' },
] as const;
const view = await render(<SingleSelectSheet visible title="時間帯" value="morning"
  options={options} onSelect={onSelect} onClose={onClose} />);
expect(view.getByText('この日')).toBeOnTheScreen();
expect(view.getByLabelText('朝、この日、選択中').props.accessibilityState.selected).toBe(true);
await user.press(view.getByLabelText('今週中、週単位'));
expect(onSelect).toHaveBeenCalledWith('this-week');
```

同じsuiteへ0件、未知値、disabled、Android back、背景tap、同一label別group、44pt操作領域を追加する。

- [ ] **Step 2: 失敗を確認する**

Run: `npm test -- src/shared/components/__tests__/single-select-sheet.test.tsx --runInBand`

Expected: module未作成のためFAIL。

- [ ] **Step 3: 最小実装を書く**

```tsx
export type SingleSelectOption<T extends string | number> = Readonly<{
  value: T; label: string; group?: string;
  accessory?: ReactNode; accessibilityLabel?: string;
}>;

export function SingleSelectSheet<T extends string | number>(props: Readonly<{
  visible: boolean; title: string; value: T;
  options: readonly SingleSelectOption<T>[]; disabled?: boolean;
  onSelect(value: T): void; onClose(): void;
}>) {
  // Modal、背景、accessibilityViewIsModal、group境界、選択checkを描画する。
}
```

選択時は`onSelect`と`onClose`を各一度呼ぶ。`useReduceMotion()`でModalの`animationType`を`none`/`slide`へ切り替える。

- [ ] **Step 4: focused testを通してコミットする**

Run: `npm test -- src/shared/components/__tests__/single-select-sheet.test.tsx --runInBand`

```bash
git add src/shared/components/single-select-sheet.tsx src/shared/components/__tests__/single-select-sheet.test.tsx
git commit -m "feat(ui): 共通の単一選択シートを追加"
```

### Task 2: 予定編集の単一選択項目を共通シートへ移行する

**Files:**
- Modify: `src/features/events/components/event-single-select-field.tsx`
- Modify: `src/features/events/components/temporal-definition-picker.tsx`
- Modify: `src/features/events/components/event-color-picker.tsx`
- Modify: `src/features/events/components/recurrence-editor.tsx`
- Modify: `src/features/events/components/__tests__/event-editor-primary-fields.test.tsx`
- Modify: `src/features/events/components/__tests__/event-editor-additional-fields.test.tsx`

**Interfaces:**
- Consumes: Task 1の`SingleSelectOption<T>`と`SingleSelectSheet<T>`。
- Produces: `EventSingleSelectField<T>`の`options`と既存`onChange(value)`契約。

- [ ] **Step 1: 時間帯groupの失敗テストを書く**

```tsx
await user.press(view.getByLabelText('時間帯、来週、選択する'));
expect(view.getByText('この日')).toBeOnTheScreen();
expect(view.getByText('週単位')).toBeOnTheScreen();
expect(view.getByText('月単位')).toBeOnTheScreen();
await user.press(view.getByLabelText('朝、この日'));
expect(onSelect).toHaveBeenCalledWith('morning');
```

定義0件と未知`selectedId`のfallbackも検証する。

- [ ] **Step 2: 色と繰り返し選択の失敗テストを書く**

```tsx
await user.press(view.getByLabelText('予定の色、カレンダーの色、選択する'));
expect(view.getByLabelText('赤、未選択')).toBeOnTheScreen();
expect(view.getByTestId('event-editor.color-option-red-swatch')).toBeOnTheScreen();
await user.press(view.getByLabelText('赤、未選択'));
expect(onChange).toHaveBeenCalledWith('red');
```

light/dark swatch、名称とcheck、disabled field、繰り返しpreset/frequency/endTypeのcallbackを追加する。

- [ ] **Step 3: 失敗を確認する**

Run: `npm test -- src/features/events/components/__tests__/event-editor-primary-fields.test.tsx src/features/events/components/__tests__/event-editor-additional-fields.test.tsx --runInBand`

Expected: 旧`@expo/ui` PickerのためFAIL。

- [ ] **Step 4: fieldとoption変換を実装する**

```tsx
const groups = { day: 'この日', week: '週単位', month: '月単位' } as const;
const options = definitions.map((definition) => ({
  value: definition.id, label: definition.label,
  group: groups[definition.granularity],
}));
```

fieldは内部`open` stateを持ち、現在値の`Pressable`とsheetを接続する。色optionの`accessory`へswatchを渡し、旧`@expo/ui` import/mockを削除する。

- [ ] **Step 5: focused testを通してコミットする**

Run: `npm test -- src/features/events/components/__tests__/event-editor-primary-fields.test.tsx src/features/events/components/__tests__/event-editor-additional-fields.test.tsx --runInBand`

```bash
git add src/features/events/components/event-single-select-field.tsx src/features/events/components/temporal-definition-picker.tsx src/features/events/components/event-color-picker.tsx src/features/events/components/recurrence-editor.tsx src/features/events/components/__tests__/event-editor-primary-fields.test.tsx src/features/events/components/__tests__/event-editor-additional-fields.test.tsx
git commit -m "feat(events): 単一選択を共通シートへ移行"
```

### Task 3: 通知時間のドラムロールを追加する

**Files:**
- Create: `src/features/events/components/duration-wheel-picker.tsx`
- Create: `src/features/events/components/__tests__/duration-wheel-picker.test.tsx`
- Modify: `src/features/events/components/event-reminder-editor.tsx`
- Modify: `src/features/events/components/__tests__/event-editor-additional-fields.test.tsx`

**Interfaces:**
- Produces: `DurationWheelPicker` props `visible`、`initialMinutes`、`maxHours`、`onConfirm(totalMinutes)`、`onClose()`。
- Consumes: `EventReminderEditor.onAdd(minutesBefore)`。永続化は整数分のまま維持する。

- [ ] **Step 1: 時・分変換と境界の失敗テストを書く**

```tsx
const view = await render(<DurationWheelPicker visible initialMinutes={90} maxHours={23}
  onConfirm={onConfirm} onClose={onClose} />);
expect(view.getByLabelText('通知時間、1時間30分前')).toBeOnTheScreen();
fireEvent(view.getByTestId('duration-wheel.hours'), 'momentumScrollEnd', {
  nativeEvent: { contentOffset: { y: 23 * 44 } },
});
fireEvent(view.getByTestId('duration-wheel.minutes'), 'momentumScrollEnd', {
  nativeEvent: { contentOffset: { y: 59 * 44 } },
});
await user.press(view.getByLabelText('通知時間を確定'));
expect(onConfirm).toHaveBeenCalledWith(1_439);
```

0分、範囲外初期値のclamp、取消、Reduce Motion、各行44ptを追加する。

- [ ] **Step 2: 失敗を確認する**

Run: `npm test -- src/features/events/components/__tests__/duration-wheel-picker.test.tsx --runInBand`

Expected: module未作成のためFAIL。

- [ ] **Step 3: ドラムロールを実装する**

```tsx
const ITEM_HEIGHT = 44;
const hours = Array.from({ length: maxHours + 1 }, (_, value) => value);
const minutes = Array.from({ length: 60 }, (_, value) => value);
// 2本のFlatListをsnapToInterval={ITEM_HEIGHT}で表示し、
// onMomentumScrollEndでindexをclampする。
```

確定時は`hours * 60 + minutes`を返す。0分は「予定時刻」と読み上げる。

- [ ] **Step 4: reminder editorへの接続テストを書く**

```tsx
await user.press(view.getByLabelText('任意の通知時間を追加'));
expect(view.getByLabelText('通知時間、0時間0分前')).toBeOnTheScreen();
// 2時間15分を確定
expect(onAdd).toHaveBeenCalledWith(135);
```

既存preset、重複disabled、並べ替え、削除が残ることも検証する。

- [ ] **Step 5: focused testを通してコミットする**

Run: `npm test -- src/features/events/components/__tests__/duration-wheel-picker.test.tsx src/features/events/components/__tests__/event-editor-additional-fields.test.tsx --runInBand`

```bash
git add src/features/events/components/duration-wheel-picker.tsx src/features/events/components/__tests__/duration-wheel-picker.test.tsx src/features/events/components/event-reminder-editor.tsx src/features/events/components/__tests__/event-editor-additional-fields.test.tsx
git commit -m "feat(events): 通知時間のドラムロールを追加"
```

### Task 4: タブの横スライドを追加する

**Files:**
- Modify: `src/features/events/components/event-editor-tabs.tsx`
- Create: `src/features/events/components/event-editor-tab-content.tsx`
- Modify: `src/features/events/screens/event-editor-screen.tsx`
- Modify: `src/features/events/components/__tests__/event-editor-primary-fields.test.tsx`
- Modify: `src/features/events/screens/__tests__/event-editor-screen.test.tsx`

**Interfaces:**
- Consumes: `EventEditorTab`と`useReduceMotion()`。
- Produces: `EventEditorTabs`の選択indicatorと、イベント固有の`EventEditorTabContent`による日時section内容のanimation。既存`onChange(tab)`契約は維持する。

- [ ] **Step 1: 通常時とReduce Motionの失敗テストを書く**

```tsx
jest.mocked(useReduceMotion).mockReturnValue(false);
await view.rerender(<EventEditorTabs value="exact" disabled={false} onChange={onChange} />);
expect(Animated.timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
  toValue: 1, duration: 180, useNativeDriver: true,
}));
jest.mocked(useReduceMotion).mockReturnValue(true);
expect(Animated.timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: 0 }));
```

`EventEditorTabContent`ではfuzzy→exactが左、exact→fuzzyが右から入ること、連続切替、disabledも検証する。

- [ ] **Step 2: 失敗を確認する**

Run: `npm test -- src/features/events/components/__tests__/event-editor-primary-fields.test.tsx src/features/events/screens/__tests__/event-editor-screen.test.tsx --runInBand`

Expected: `Animated.timing`未使用のためFAIL。

- [ ] **Step 3: animationを実装する**

```tsx
const progress = useRef(new Animated.Value(value === 'fuzzy' ? 0 : 1)).current;
useEffect(() => {
  progress.stopAnimation();
  Animated.timing(progress, {
    toValue: value === 'fuzzy' ? 0 : 1,
    duration: reduceMotion ? 0 : 180,
    useNativeDriver: true,
  }).start();
}, [progress, reduceMotion, value]);
```

animation completionでstateを変更せず、最新propsだけを描画する。

`EventEditorTabs`は`onLayout`で得たcontainer幅から半幅のindicator移動量を計算する。`EventEditorTabContent`は直前tabとの順序から開始位置を`-12`または`12`に同期設定し、`translateX: 0`へ移動しながらopacityを上げる。Reduce Motion時はindicatorと内容をduration 0で即時反映し、`Animated`完了callbackから表示stateを更新しない。`EventEditorScreen`では日時sectionの`EventDateTimeFields`、`TemporalDefinitionPicker`、相対日付previewをwrapper内へまとめる。

- [ ] **Step 4: focused testを通してコミットする**

Run: `npm test -- src/features/events/components/__tests__/event-editor-primary-fields.test.tsx src/features/events/screens/__tests__/event-editor-screen.test.tsx --runInBand`

```bash
git add src/features/events/components/event-editor-tabs.tsx src/features/events/components/event-editor-tab-content.tsx src/features/events/screens/event-editor-screen.tsx src/features/events/components/__tests__/event-editor-primary-fields.test.tsx src/features/events/screens/__tests__/event-editor-screen.test.tsx
git commit -m "feat(events): タブ切替に横スライドを追加"
```

### Task 5: 文書同期と全体検証を行う

**Files:**
- Modify: `docs/superpowers/specs/2026-09-10-event-editor-and-add-flows-design.md`

**Interfaces:**
- Consumes: Task 1〜4の確定UI契約。
- Produces: 旧Pickerと任意分数TextInputを前提にしない既存設計文書。

- [ ] **Step 1: 旧入力方式を検索する**

Run: `rg -n '@expo/ui|Picker|任意の分数|チップ|ざっくり.*きっちり' docs/superpowers/specs/2026-09-10-event-editor-and-add-flows-design.md`

Expected: 更新対象の記述を確認できる。

- [ ] **Step 2: 既存設計を同期する**

共通シート、group見出し、色見本、0〜23時間59分の通知ドラム、Reduce Motion対応横スライドを記録し、通知発火は対象外のまま維持する。

- [ ] **Step 3: 全体検証を実行する**

Run: `npm run typecheck`

Run: `npm run lint`

Run: `npm test -- --runInBand`

Run: `git diff --check`

Expected: すべてexit code 0。

- [ ] **Step 4: 文書をコミットする**

```bash
git add docs/superpowers/specs/2026-09-10-event-editor-and-add-flows-design.md
git commit -m "docs(events): 選択入力の設計を同期"
```
