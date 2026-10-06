# 予定登録の選択・時間入力操作 設計

## 目的

モバイルで予定を作成・編集する際の単一選択、タブ切替、任意通知時間入力を統一し、選択状態と現在値を色だけに依存せず理解できるようにする。対象は Issue #40 とし、通知の端末スケジュールや新しい時間表現は扱わない。

## 利用者体験

- 時間帯、予定色、繰り返しなどの単一選択は、現在値を表示した44pt以上の行をタップして同一形式のボトムシートを開く。
- シートは任意のグループ見出しと選択肢を表示する。選択肢をタップすると編集draftだけを更新して閉じ、キャンセルは値を変えずに閉じる。
- 予定色は、現在値と各候補に色見本と名称を表示し、選択済みはチェックと`accessibilityState.selected`でも示す。
- ざっくり／きっちり切替は内容を横へスライドする。Reduce Motion時は即時切替する。
- 任意通知は専用シートの時・分ドラムロールで選ぶ。範囲は0〜23時間、0〜59分で、確定値を分へ変換する。1日前は既存プリセットを維持する。

## コンポーネント境界

共通化した部品は`src/shared/components`に置く。

```text
shared/components
├─ single-select-sheet.tsx       # シート表示、選択・取消、group表示
└─ duration-wheel-picker.tsx     # 時・分のドラムロールと分変換

features/events/components
├─ event-single-select-field.tsx # 現在値を表示しSingleSelectSheetを接続
├─ temporal-definition-picker.tsx # 定義を「この日 / 週単位 / 月単位」へ変換
├─ event-color-picker.tsx        # 色名・swatch付きoptionを変換
├─ event-editor-tabs.tsx         # Reduce Motion対応の横スライド
└─ event-reminder-editor.tsx     # presetとDurationWheelPickerを接続
```

`SingleSelectSheet`のoptionは`value`、`label`、任意の`group`、任意の`accessory`、任意の`accessibilityLabel`を持つ。表示部品はSQLite、イベント型、時間表現定義へ依存しない。`TemporalDefinitionPicker`と`EventColorPicker`だけがそれぞれのdomain値をoptionへ変換する。

## 状態とデータフロー

選択・通知時間の確定は既存`useEventEditor`のstate更新callbackへ渡すだけとし、保存・バリデーション・Repositoryは変更しない。

1. fieldが現在値とoptionをシートへ渡す。
2. 選択でfieldの`onChange(value)`を一度だけ呼ぶ。
3. feature hookが編集draftを更新する。
4. 既存の保存時にevent/reminderへ永続化する。

`DurationWheelPicker`は`hours * 60 + minutes`を返す。0分は「予定時刻」として既存`reminderLabel`で表示し、重複した値は既存`onAdd`側で追加しない。

## アニメーション

タブの選択インジケータとコンテンツを`Animated`で水平方向へ遷移する。入力値・保存処理・フォーカス状態はアニメーション中も変更しない。`useReduceMotion()`がtrueの場合はduration 0とし、初期表示・切替のどちらでも中間位置を残さない。

## アクセシビリティ

- fieldは「予定の色、青、選択」のようにラベル・現在値・操作を読み上げる。
- group見出しは選択肢としてフォーカスしない。
- optionは色名、選択状態、必要な補助情報を読み上げる。swatch単独へ意味を持たせない。
- シートの選択肢、取消・確定、通知preset、ドラムロール操作は44pt以上とする。
- disabled状態は見た目だけでなく`accessibilityState.disabled`へ反映する。

## エラー処理

シートの取消・バック操作はdraftを変更しない。時・分ドラムロールは範囲外値をUIから生成しない。重複通知や保存失敗は既存`EventReminderEditor`・`useEventEditor`のエラー表示を継続する。

## テスト

- `SingleSelectSheet`: group見出し、現在値、選択、取消、disabled、読み上げ状態。
- `DurationWheelPicker`: 0分、23時間59分、分変換、取消。
- 時間帯picker: day/week/month groupへの変換。
- 色picker: light/darkの色見本、色名、チェック、カレンダー色fallback。
- tabs: Reduce Motionの即時切替と通常時の横遷移値。
- reminder editor: ドラムロール確定が既存の追加callbackへ正しい分数を渡すこと。

## 完了条件

Issue #40の受け入れ条件を満たし、`npm run typecheck`、`npm run lint`、`npm test -- --runInBand`、`git diff --check`を成功させる。実機ではiOS/Androidのシート操作、TalkBack/VoiceOver、Reduce Motion、文字拡大を別途確認する。
