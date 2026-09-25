# カレンダー表示と視認性改善 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** 2日ビューの祝日を読み取り専用の終日項目として表示し、日付ヘッダーと終日領域の位置を安定させる。同時に、月ビューの祝日だけの日には予定点を出さず、今日ボタンと予定色を判別しやすくする。

**Architecture:** 祝日と利用者予定をUI内で判定せず、`two-day-view-model.ts`で共通の終日表示モデルへ変換する。予定色は固定パレットのレジストリへ分離し、現行イベントは既定色を参照する。コンポーネントは表示モデルの`kind`により、祝日は非操作、予定は既存の編集操作を維持する。

**Tech Stack:** Expo SDK 57、React Native、TypeScript、Jest、React Native Testing Library

---

## 前提と対象範囲

- 正本: `docs/superpowers/specs/2026-09-25-calendar-event-editor-expansion-design.md`
- 本計画は4段階ロードマップの第1段階だけを対象にする。
- サイドメニュー、設定画面、SQLite拡張、予定追加モーダル、繰り返し発生回は後続PRへ分ける。
- 実機の見た目は自動テストでは確認済みと扱わず、PRに手動確認項目として残す。

## Task 1: 固定予定色パレットとコントラスト境界を追加する

**Files:**
- Create: `src/constants/event-colors.ts`
- Create: `src/features/calendar/__tests__/event-color-palette.test.ts`
- Modify: `src/constants/theme.ts`
- Modify: `src/features/calendar/components/timeline-event-block.tsx`
- Test: `src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx`

### Step 1: パレットとコントラストの失敗テストを書く

8色の固定ID、既定色、テーマごとの塗り、背景色を文字色として使った際の4.5:1以上のコントラストを検証する。

```ts
expect(EVENT_COLOR_PALETTE.map((color) => color.id)).toEqual([
  'blue', 'teal', 'green', 'ochre', 'orange', 'red', 'purple', 'gray',
]);

for (const color of EVENT_COLOR_PALETTE) {
  expect(getContrastRatio(color.light, Colors.light.background)).toBeGreaterThanOrEqual(4.5);
  expect(getContrastRatio(color.dark, Colors.dark.background)).toBeGreaterThanOrEqual(4.5);
}
```

### Step 2: 対象テストを実行して失敗を確認する

Run: `npm test -- src/features/calendar/__tests__/event-color-palette.test.ts --runInBand`

Expected: 新しいmoduleが存在せずFAIL。

### Step 3: 最小の固定パレットを実装する

```ts
export type EventColorId = 'blue' | 'teal' | 'green' | 'ochre' | 'orange' | 'red' | 'purple' | 'gray';

export const DEFAULT_EVENT_COLOR_ID: EventColorId = 'blue';

export const EVENT_COLOR_PALETTE = [
  { id: 'blue', light: '#185ABC', dark: '#AECBFA' },
  { id: 'teal', light: '#00695C', dark: '#80CBC4' },
  { id: 'green', light: '#2E7D32', dark: '#81C995' },
  { id: 'ochre', light: '#795548', dark: '#FDD663' },
  { id: 'orange', light: '#A14200', dark: '#FFB74D' },
  { id: 'red', light: '#B3261E', dark: '#F28B82' },
  { id: 'purple', light: '#6A1B9A', dark: '#D7AEFB' },
  { id: 'gray', light: '#5F6368', dark: '#BDC1C6' },
] as const;
```

パレットは複数featureから参照する固定値なので`src/constants`に置き、IDと表示色だけを持たせる。DBやイベント型へはまだ追加しない。`theme.ts`の既定予定色をパレットの既定色へ合わせ、`calendarEventText`は各テーマの`background`と同色にする。

### Step 4: タイムライン予定の表示テストを更新する

ライト・ダーク両テーマで、予定タイトルと時刻が背景色と同じ文字色を参照し、濃い予定背景との組み合わせになることを検証する。

### Step 5: 対象テストを実行する

Run: `npm test -- src/features/calendar/__tests__/event-color-palette.test.ts src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx --runInBand`

Expected: PASS。

## Task 2: 祝日を読み取り専用の終日表示モデルへ統合する

**Files:**
- Modify: `src/features/calendar/two-day-view-model.ts`
- Modify: `src/features/calendar/__tests__/two-day-view-model.test.ts`

### Step 1: 祝日表示モデルの失敗テストを書く

祝日のある日に、祝日が利用者の終日予定より先頭へ入り、`kind: 'holiday'`と編集用IDを持たないことを検証する。予定件数は利用者予定だけを数える。

```ts
expect(result[0].allDayItems).toEqual([
  expect.objectContaining({ kind: 'holiday', title: 'テスト記念日', eventId: null }),
  expect.objectContaining({ kind: 'event', title: '休暇', eventId: 'all-day' }),
]);
expect(result[0].accessibilityLabel).toContain('予定1件');
```

祝日だけの日についても、`予定なし`と祝日名が同時に読み上げられることを検証する。

### Step 2: 対象テストを実行して期待した差分で失敗することを確認する

Run: `npm test -- src/features/calendar/__tests__/two-day-view-model.test.ts --runInBand`

Expected: 現在の`allDayItems`に祝日が含まれないためFAIL。

### Step 3: 終日表示モデルを実装する

```ts
export type TwoDayAllDayItemViewModel = Readonly<{
  kind: 'event' | 'holiday';
  id: string;
  eventId: string | null;
  colorId: EventColorId | 'holiday';
  isInteractive: boolean;
  title: string;
  temporalLabel: string;
  accessibilityLabel: string;
}>;
```

- 祝日の安定キーは`holiday:${date}`とする。
- 祝日は`temporalLabel: '祝日'`、編集用`eventId: null`とする。
- 利用者予定は既存`AgendaItemViewModel`から`kind: 'event'`、`eventId: item.id`へ変換する。
- 配列は祝日、利用者予定の順にする。
- `itemCount`は祝日を除くイベントIDで数える。
- `holidayName`は月ビュー等との互換性のため当面保持するが、2日列ヘッダーでは使わない。

### Step 4: 対象テストを実行する

Run: `npm test -- src/features/calendar/__tests__/two-day-view-model.test.ts --runInBand`

Expected: PASS。

## Task 3: 日付ヘッダーと終日領域を固定し、祝日を非操作で表示する

**Files:**
- Modify: `src/features/calendar/components/two-day-column.tsx`
- Modify: `src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx`

### Step 1: UIの失敗テストを書く

- 祝日名は日付ヘッダー内ではなく終日領域に表示される。
- 祝日はボタンにならず、読み取り専用表示になる。
- 利用者の終日予定だけが編集ボタンとして残る。
- 祝日専用semantic color tokenを使う。
- 祝日の有無にかかわらず、日付ヘッダーと終日領域の最小高が同一である。

```ts
expect(view.queryByRole('button', { name: 'テスト記念日、祝日' })).toBeNull();
expect(view.getByLabelText('テスト記念日、祝日')).toBeOnTheScreen();
expect(view.getByRole('button', { name: /休暇/ })).toBeOnTheScreen();
```

### Step 2: 対象テストを実行して失敗を確認する

Run: `npm test -- src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx --runInBand`

Expected: 祝日がヘッダー内にあり、終日項目ではないためFAIL。

### Step 3: 固定レイアウトと祝日表示を実装する

- 日付ヘッダーは曜日と日付円だけを含む固定最小高にする。
- その下に左右列共通の終日領域を設け、空でも同じ最小高を確保する。
- 終日項目は祝日を含め先頭2件まで表示し、超過分は「他N件」と総件数を含むアクセシビリティラベルで省略表示する。
- 終日領域は共通の最小高と`flex: 1`を持ち、列ごとのタイムライン開始位置は親の行レイアウトで揃える。
- `kind === 'holiday'`は`View`で描画し、専用背景色・専用ラベル・左の識別線を使う。
- `kind === 'event'`だけ`Pressable`で描画し、`eventId`を編集callbackへ渡す。
- 祝日情報未対応は終日領域内の補助文言として表示する。

### Step 4: 対象テストを実行する

Run: `npm test -- src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx --runInBand`

Expected: PASS。

## Task 4: 月ビューの祝日点回帰と「今日」ボタンを確定する

**Files:**
- Modify: `src/features/calendar/__tests__/month-view-model.test.ts`
- Modify: `src/features/calendar/components/calendar-top-bar.tsx`
- Modify: `src/features/calendar/components/__tests__/calendar-navigation-components.test.tsx`
- Modify: `src/features/calendar/screens/__tests__/calendar-screen.test.tsx`

### Step 1: 月ビューの祝日だけの日の回帰テストを書く

祝日coverageだけを与え、イベントを与えない日について次を検証する。

```ts
expect(day).toMatchObject({ holidayName: '敬老の日', hasEvents: false });
expect(day.accessibilityLabel).toBe('2026年9月21日、敬老の日');
```

既存実装がすでに満たす場合は、仕様固定用の回帰テストとして保持し、不要な本体変更は行わない。

### Step 2: 「今日」ラベルの失敗テストを書く

```ts
expect(view.getByRole('button', { name: '今日へ移動' })).toHaveTextContent('今日');
expect(view.queryByText('◎')).toBeNull();
```

disabled時の`accessibilityState`と44pt以上の操作領域も維持する。

### Step 3: 対象テストを実行する

Run: `npm test -- src/features/calendar/__tests__/month-view-model.test.ts src/features/calendar/components/__tests__/calendar-navigation-components.test.tsx src/features/calendar/screens/__tests__/calendar-screen.test.tsx --runInBand`

Expected: 月ビュー回帰テストはPASSし、今日ラベルだけFAIL。

### Step 4: 今日ボタンを実装する

`◎`を`今日`へ置換し、`todayButton`と`todayLabel`で44pt以上の操作領域と適切な横余白を持たせる。既存のcallback、disabled、アクセシビリティ名は維持する。

### Step 5: 対象テストを再実行する

Run: `npm test -- src/features/calendar/__tests__/month-view-model.test.ts src/features/calendar/components/__tests__/calendar-navigation-components.test.tsx src/features/calendar/screens/__tests__/calendar-screen.test.tsx --runInBand`

Expected: PASS。

## Task 5: 全体検証、ドキュメント整合、PR作成

### Step 1: 関連テストをまとめて実行する

Run: `npm test -- src/features/calendar/__tests__/event-color-palette.test.ts src/features/calendar/__tests__/two-day-view-model.test.ts src/features/calendar/__tests__/month-view-model.test.ts src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx src/features/calendar/components/__tests__/calendar-navigation-components.test.tsx src/features/calendar/screens/__tests__/calendar-screen.test.tsx --runInBand`

Expected: PASS。

### Step 2: リポジトリ標準の全体検証を実行する

Run: `npm run typecheck`

Run: `npm run lint`

Run: `npm test -- --runInBand`

Run: `git diff --check`

Expected: すべて成功。

### Step 3: 設計との整合をレビューする

- 祝日が日付ヘッダーを押し下げない。
- 祝日が読み取り専用の終日項目である。
- 祝日専用色と予定色を色以外のラベル・形状でも区別する。
- 月ビューで祝日だけの日に予定点を出さない。
- 予定文字色がテーマ背景色、予定背景が濃い固定色になる。
- 「今日」ボタンが44pt以上で、読み上げ名とdisabled状態を維持する。
- 後続PRのサイドバー、DB、編集モーダルを混ぜていない。

### Step 4: コミットしてpushする

```bash
git add docs/superpowers/plans/2026-09-25-calendar-display-accessibility.md src/constants src/features/calendar
git commit -m "feat(calendar): 祝日表示と予定色の視認性を改善"
git push -u origin codex/calendar-event-editor-expansion
```

### Step 5: `develop`向けPRを作成する

PR本文へ目的、設計判断、検証結果、実機確認項目、後続3段階との境界を記載し、通常のOpen PRとして作成する。
