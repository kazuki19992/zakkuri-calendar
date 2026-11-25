# 予定登録の選択・時間入力操作 設計

## 目的

モバイルで予定を作成・編集する際の単一選択、タブ切替、任意通知時間入力を統一し、選択状態と現在値を色だけに依存せず理解できるようにする。対象は Issue #40 とし、通知の端末スケジュールや新しい時間表現は扱わない。

## 利用者体験

- 「ざっくり種別」行をタップするとキーボードを閉じ、この日・週単位・月単位の見出しでまとめた単一選択シートを開く。フォームには選択中の種別だけをプレビューする。日内は一日の中での位置と幅を時刻の数値なしで示し、日をまたぐ範囲はバーの両端に分けてぼかしを引き継ぐ。週・月単位は実際の解決期間と日境界を示す。
- 予定色、繰り返し、終了の指定は、現在値を表示した44pt以上の行をタップするとボトムシートを開く。終了の指定には各選択肢の説明を添える。
- フォームを開くとタイトルにフォーカスし、空白のままでは保存できない。新規時に時間形式のタブを切り替えるだけなら破棄確認を表示しない。
- どちらのタブにも終日スイッチを表示する。オンでは開始日と終了日を表示する。きっちりの終日オフでは開始日・開始時刻、終了の指定、終了日・終了時刻の順に表示する。開始時刻を指定していない場合は次の30分刻みを初期値にし、当日23:30を上限とする。
- 繰り返し、色、場所、通知は作成・編集フォームに常に表示する。予定詳細の見出しでは、ざっくり予定に日付と時間帯名を、きっちり予定に具体的な時刻を表示する。各通知の実日時は通知欄に表示する。編集は詳細を置き換える。削除も詳細から操作できる。
- シートは任意のグループ見出しと選択肢を表示する。選択肢をタップすると編集draftだけを更新して閉じ、キャンセルは値を変えずに閉じる。
- 予定色は、現在値と各候補に色見本と名称を表示し、選択済みはチェックと`accessibilityState.selected`でも示す。
- ざっくり／きっちり切替は、タブより下の日時から削除操作までをひとまとめに横へスライドする。Reduce Motion時は即時切替する。
- 任意通知は専用シートの時・分ドラムロールで選ぶ。範囲は0〜23時間、0〜59分で、確定値を分へ変換する。60分以上は「1時間30分前」のように時間と分で表示し、1日前は既存プリセットを維持する。

## コンポーネント境界

複数featureで共用する部品は`src/shared/components`に置き、予定通知専用の部品は`features/events/components`に閉じる。

```text
shared/components
└─ single-select-sheet.tsx       # シート表示、選択・取消、group表示

features/events/components
├─ event-single-select-field.tsx # 現在値を表示しSingleSelectSheetを接続
├─ temporal-definition-picker.tsx # 定義を「この日 / 週単位 / 月単位」へ変換
├─ event-color-picker.tsx        # 色名・swatch付きoptionを変換
├─ event-editor-tabs.tsx         # Reduce Motion対応の横スライド
├─ event-reminder-editor.tsx     # presetとDurationWheelPickerを接続
└─ duration-wheel-picker.tsx     # 時・分のドラムロールと分変換
```

`SingleSelectSheet`のoptionは`value`、`label`、任意の`description`、任意の`group`、任意の`accessory`、任意の`accessibilityLabel`を持つ。表示部品はSQLite、イベント型、時間表現定義へ依存しない。`TemporalDefinitionPicker`は定義からグループ付きの選択肢を構成し、`EventColorPicker`は色をシートの選択肢へ変換する。

## 状態とデータフロー

選択・通知時間の確定は既存`useEventEditor`のstate更新callbackへ渡すだけとし、保存・バリデーション・Repositoryは変更しない。

1. 入力欄が現在値を表示し、タップすると候補をシートに表示する。
2. 選択でfieldの`onChange(value)`を一度だけ呼ぶ。
3. feature hookが編集draftを更新する。
4. 既存の保存時にevent/reminderへ永続化する。

`DurationWheelPicker`は`hours * 60 + minutes`を返す。0分は「予定時刻」として既存`reminderLabel`で表示し、重複した値は既存`onAdd`側で追加しない。

## アニメーション

タブの選択インジケータとタブ配下のフォーム全体を`Animated`で水平方向へ遷移する。単一選択シートはModal全体をslideさせず、背景をfadeしつつシート本体だけを短い距離で上下させる。入力値・保存処理・フォーカス状態はアニメーション中も変更しない。`useReduceMotion()`がtrueの場合はduration 0とし、初期表示・切替・閉じる操作で中間位置を残さない。

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
- ざっくり種別の選択シートは日・週・月の候補と選択状態を検証する。選択中のプレビューは日内バーの位置・幅、日またぎの分割、相対期間の日境界とぼかしを検証する。
- 色picker: light/darkの色見本、色名、チェック、カレンダー色fallback。
- tabs: Reduce Motionの即時切替と通常時の横遷移値。
- reminder editor: ドラムロール確定が既存の追加callbackへ正しい分数を渡すこと。

## 完了条件

Issue #40の受け入れ条件を満たし、`npm run typecheck`、`npm run lint`、`npm test -- --runInBand`、`git diff --check`を成功させる。実機ではiOS/Androidのシート操作、TalkBack/VoiceOver、Reduce Motion、文字拡大を別途確認する。
