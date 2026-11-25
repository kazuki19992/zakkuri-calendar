# 予定編集UI Design

## 1. 目的

schema version 2で保存可能になった予定情報を、利用者が新規作成・再編集できる画面へ接続する。

- 「ざっくり」と「きっちり」を明確な2タブとして提供する。
- きっちり予定と終日予定で開始日・終了日を編集できるようにする。
- 繰り返し、カレンダー色、場所、複数通知、プレーンテキストメモを編集・保存する。
- ヘッダー、日付表記、情報密度、入力中の操作防止を整える。
- 既存の予定種別と非表示値を失わず、保存失敗時も入力を保持する。

この設計は、承認済みの`2026-09-25-calendar-event-editor-expansion-design.md`にある第4段階を2PRへ分割した前半である。後半の繰り返し発生回表示は別設計・別PRとする。

## 2. 対象範囲

### 2.1 対象

- 新規作成routeと既存編集routeで共用する予定編集モーダル。
- ざっくり／きっちりタブと、両タブの終日スイッチ。
- 開始日、終了日、開始時刻、終了時刻。
- 繰り返し規則。
- カレンダー既定色を継承する選択肢を含む予定色。
- 場所、複数通知、プレーンテキストメモ。
- 編集時のシリーズ全体削除。
- schema version 2の`EventAggregate`への保存と再読み込み。

### 2.2 対象外

- 繰り返し発生回の2日／月表示。次のPRで実装する。
- 端末通知の権限要求、予約、解除、発火。
- 繰り返し予定の「この予定だけ」「これ以降」の編集・削除。Issue #26で扱う。
- 「今週中」「来週前半」などの相対日付。Issue #25で扱う。
- URL自動リンク、チェックリスト、書式付きメモ、Markdown、添付。Issue #24で扱う。
- 複数カレンダーの作成・削除・切替、タイムゾーン編集、設定画面の拡張。
- SQLite schema、migration、Repository transactionの変更。

## 3. 画面構成

### 3.1 Presentationとnavigation

作成の`events/new`、編集の`events/[id]`と詳細の`events/detail/[id]`はExpo Routerのrouteとして、戻る操作とdeep linkを維持する。iOSではネイティブのフォームシートを利用し、最大高さの96%に固定してステータスバー側に余白を確保する。下スワイプでの閉じ方は従来どおり利用できる。AndroidとWebでは`presentation: 'modal'`を使う。共通の選択シートは、キャンセルなどの操作行の下にホームインジケーター分の余白を確保する。

routeはRepository、初期route parameter、保存成功後のcalendar refresh、`router.back()`だけを組み立てる。SQLiteや入力状態はrouteへ置かない。保存・削除中は、iOSのdismiss gestureとAndroidのhardware backを無効にする。通常時のキャンセルとsystem dismissは即時終了とし、未保存確認dialogは今回追加しない。

画面は`SafeAreaView`、`KeyboardAvoidingView`、縦`ScrollView`で構成する。小画面と文字拡大で下部項目へ到達でき、keyboard表示中も現在の入力欄を操作できる構造を維持する。

### 3.2 ヘッダー

ヘッダーは左右に同じ幅の操作領域を持つ3列構成とする。

- 左: 「キャンセル」のplain action。
- 中央: 新規時「予定を追加」、編集時「予定を編集」。
- 右: 「保存」のaccent action。

中央タイトルは左右の文言幅に引かれず画面中央へ置く。左右は同一の最小幅、44pt以上の高さを持つ。タイトルは1行を基本とし、文字拡大時も左右操作と重ならないよう中央列を縮める。保存中は右を「保存中」とし、キャンセル、保存、削除、すべての入力を無効にする。

### 3.3 フォーム順序

`ScrollView`内の順序は次で固定する。

1. タイトル。
2. ざっくり／きっちりタブ。
3. 終日スイッチと、選択中の時間形式に応じた日時とざっくり種別。
4. メモ。
5. 繰り返し。
6. 予定色。
7. 場所。
8. 通知。
9. 編集時だけ削除操作。

繰り返し、予定色、場所、通知は常に表示する。項目はカードで囲まず、区切り線と余白を使った設定画面に近い帯状レイアウトとする。各操作領域は原則44pt以上とする。

## 4. 編集モード

### 4.1 ざっくり／きっちりタブ

画面上の主タブは`fuzzy`と`exact`の2つだけとする。`allDay`は独立タブにせず、両タブの終日スイッチで表す。終日の状態と日付範囲は両タブで共有する。

- 「予定を追加」からの新規作成はざっくりで開く。1日・2日・週の空き時間をダブルタップした場合はきっちりで開き、その列の日付と最も近い正時を初期値に使う。
- 既存`fuzzy`予定はざっくり、既存`exact`／`allDay`予定はきっちりで開く。
- タブを往復しても、その画面で入力した日付、時刻、時間帯を失わない。
- 保存済みの日内ざっくり予定からきっちりへ切り替えると、その時間帯の解決済み開始・終了日時を初期値に使う。翌日の終了日も引き継ぐ。

週・月単位のざっくり予定では基準日をもとに期間を決めるため、日付の直接入力を無効化する。

### 4.2 ざっくり

「ざっくり種別」行をタップすると、この日・週単位・月単位を同じ単一選択シートに表示する。候補をタップするとシートが閉じ、選択値とぼかしのプレビューが更新される。日内の種別は一日の中での位置と幅を時刻の数値なしで示す。週・月単位の種別は解決された期間と日境界を示す。利用可能な種別がない場合は時間帯欄へ固定メッセージを表示する。

繰り返し、色、場所、通知、メモはざっくり予定でも設定できる。

### 4.3 きっちりと終日

どちらのタブも日時の先頭行に「終日」スイッチを置く。オン時は選択中のカレンダー色を使う。

- 終日OFFでは選択中のタブに応じた日付、時刻、ざっくり種別を表示する。
- 終日ONでは日時欄に開始日・終了日だけを表示する。どちらのタブからでも`allDay`として保存し、終日の通知と通常の繰り返しを適用する。
- 終日を切り替えても、同じ画面内では直前の時刻入力とざっくり種別を保持する。相対期間の繰り返し入力は終日と切り替えても復元する。

開始日を変更した場合は、現在の期間を保つよう終了日を同じcalendar day差だけ移動する。終日予定は包含日数を維持する。利用者が終了日または終了時刻を明示的に変更した場合は、その値を優先する。

既存の`instant`と`undetermined`は、終了日時が開始日時と同じ状態を保つ限り元のduration種別を保持する。開始日だけを移動した場合は終了日も追従させ、特殊durationを失わない。利用者が終了日時を開始より後へ変更して明示的な範囲を作った場合だけ`fixed`へ変換する。24時間を超える`fixed`も開始日時とdurationから終了日時へ展開し、未変更保存で短縮しない。

## 5. 日付と時刻

内部値は日付`yyyy-MM-dd`、時刻`HH:mm`を維持する。画面上の日付は独自formatterで`9月25日（金）`の形式にする。OSやlocale任せの`Sep 25, 2026`を画面の主表示にしない。

日付行は、整形済みの値そのものを操作領域とし、別行へ`yyyy/MM/dd`形式の入力を表示しない。時刻行は、その直下に設定画面と共通の時・分ドラムロールを展開する。分の候補は15分刻みとし、開いた時刻が刻み外なら元の分も選択肢に含める。選択は時刻行へ反映し、同時に開く時刻行は1つとする。

- iOSでは`locale="ja_JP"`と`display="compact"`を指定したpickerを整形済み日付の操作領域へ重ね、日付を直接タップして開く。
- Androidでは`presentation="dialog"`を利用し、確定またはdismissでunmountする。
- 画面上の確定値は両platformとも独自formatterを使う。
- 変換はlocal wall-clock値として扱い、UTC文字列や固定ミリ秒加算へ変換しない。

終了日時は開始日時より後でなければならない。複数日durationは`createFixedDurationFromDateTimes`でcalendar day差から算出する。終日終了日は開始日以降の包含日とする。

## 6. 追加項目

### 6.1 繰り返し

通常選択肢は次とする。

- 繰り返さない。
- 毎日。
- 毎週。
- 平日のみ。
- 毎月。
- 毎年。
- カスタム。

毎週は開始日の曜日、平日のみは月曜〜金曜の週次規則へ正規化する。毎月・毎年は開始日を基準とし、存在しない月日はその期間の発生回を作らない既存方針を維持する。

カスタムでは頻度、正の間隔、週次の場合の曜日、終了条件を編集する。終了条件は「なし」「指定日まで」「指定回数」とする。数値はnumber pad入力とし、正の安全な整数だけを保存する。「指定日まで」は開始日以降を必須とする。

このPRでは規則を保存・再編集できるようにするが、calendar表示へ発生回を展開しない。画面内に「繰り返し予定の表示は順次対応します」のような未実装表示は置かず、PR説明と文書で実装境界を示す。

### 6.2 カレンダーと色

現在は既定カレンダー1件を読み取り専用で表示する。カレンダー切替UIやplaceholderは置かない。

色は「カレンダーの色」と固定8色をdropdownで選べる。前者は`colorId: null`、固定色は安定した`EventColorId`として保存する。選択中の色見本だけでなく日本語labelを併用し、ライト／ダークの塗りは既存palette registryを再利用する。

時間帯、繰り返しpreset、カスタム頻度、終了条件、予定色のような単一選択はdropdownとする。曜日や通知presetのような複数選択・追加操作だけchipを維持し、選択時は色に加えて枠、文字の太さ、固定位置のcheck badge、`accessibilityState.selected`を併用する。check badgeは絶対配置として選択前後のchip位置を変えない。

### 6.3 場所

場所は単一行のplain textとする。空白だけの値は`null`へ正規化する。地図検索、候補取得、外部送信は行わない。

### 6.4 通知（2026-11-12の後続設計で更新）

通知は0件以上を順序付きで編集し、追加・行の編集・並べ替え・削除を提供する。開始/終了、日数と時分を区別し、ドラムで任意値を指定する。同じ通知条件は重複保存しない。保存前はインメモリのdraftであり、権限要求・DB保存・OS予約を行わない。

新規通知の初期値、種別変更時の互換性、通知なし、既定値の読込み失敗、旧通知の開始基準の保持は`2026-11-12-local-notifications-design.md`に従う。「端末への通知はまだ行われません」という旧説明は除く。予定保存とOS予約の失敗を区別し、権限案内と再試行は通知featureへ集約する。実機発火は未確認である。

### 6.5 メモ

メモは複数行のplain textとし、空白だけの値は`null`へ正規化する。URL自動リンク、checklist、Markdown記法、画像、code blockは解釈せず文字列として保持する。

## 7. 状態と責務

### 7.1 hook

`useEventEditor`を編集状態と非同期調整の正とする。画面コンポーネントはdisplay-ready値とcallbackだけを受け取る。

主な状態は次とする。

```ts
type EventEditorState = Readonly<{
  status: 'loading' | 'ready' | 'error';
  mode: 'create' | 'edit';
  editorTab: 'fuzzy' | 'exact';
  isAllDay: boolean;
  title: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  selectedDefinitionId: string | null;
  recurrenceDraft: RecurrenceDraft;
  calendarName: string;
  calendarColorId: EventColorId;
  colorId: EventColorId | null;
  location: string;
  reminders: readonly ReminderDraft[];
  notes: string;
  fieldErrors: EventEditorFieldErrors;
  saveError: string | null;
  isSaving: boolean;
  isDeleting: boolean;
}>;
```

実装時は巨大な単一setterを公開せず、項目単位のcallbackを持たせる。screen固有の表示文字列と開閉状態はcomponentへ置けるが、保存値、validation、ID生成、Repository操作はhookまたは純粋関数へ置く。

### 7.2 純粋関数

hookを肥大化させないため、次をfeature内の純粋関数へ分離する。

- `CalendarEvent`から編集日時範囲を作る変換。
- 日付と時刻から`EventDraft`を作る変換。
- 日付の日本語表示formatter。
- recurrence presetと`RecurrenceRuleV1 | null`の相互変換。
- reminder draftの重複排除、並べ替え、`EventReminder`変換。
- optional textのtrimと`null`正規化。

domainの検証関数を複製せず、最終保存前は`createCalendarEvent`／`parseCalendarEvent`と`normalizeEventReminders`を通す。

### 7.3 読み込み

新規作成は既定カレンダーと利用可能な時間表現の定義を読み込む。編集は`EventAggregate`を読み込み、予定本体と通知をすべてフォームへ展開する。

読み込み失敗時は固定メッセージと再試行を表示する。再試行までは空フォームを操作させない。unmount後の非同期完了を反映しない。

### 7.4 保存

保存開始前に同期的な`operationRef`を獲得し、連打、戻る、削除との競合を防ぐ。validation失敗ではlockを獲得せず、対応項目へerrorを表示する。

保存成功時だけrouteがcalendar refreshを通知して閉じる。Repository失敗時は固定メッセージを表示し、入力値とモーダルを維持する。予定タイトル、場所、メモをログやerrorへ含めない。

編集時は元の`createdAt`、`createdTimeZoneId`、ID、calendar IDを維持する。新規時は1つのevent IDを先に生成し、予定本体と通知へ同じIDを使う。

### 7.5 削除

編集時だけ削除操作を表示する。通常予定は「予定を削除」、繰り返し規則を持つ予定は「繰り返し予定を削除」と明示し、確認dialogにもシリーズ全体が対象であることを書く。削除成功時だけcalendar refresh後に閉じる。

## 8. Validationとerror表示

- タイトル: 空白だけを拒否。
- 日付: 実在するcalendar dateのみ。
- きっちり: 終了日時は開始日時より後。
- 終日: 終了日は開始日以降。
- ざっくり: 終日オフでは有効な時間表現の定義が必須。
- 繰り返し: 間隔・回数は正の整数、終了日は開始日以降。
- 通知: 事前時間は非負整数、重複なし。
- 場所・メモ: 空白だけは`null`。

field errorは該当行の直下へ`accessibilityRole="alert"`で表示する。保存全体やRepositoryのerrorはフォーム上部または保存操作付近へ固定文言で表示する。入力を変更した項目のerrorだけを消し、無関係なerrorを一括で隠さない。

## 9. Accessibility

- 操作領域は原則44pt以上。
- 2タブは`tab`相当のroleとselected stateを持つ。
- 終日、曜日、色、通知の状態を色だけで示さない。
- `Switch`は「終日」のlabelとchecked stateを持つ。
- 日付・時刻buttonは項目名と現在値を合わせて読み上げる。
- pickerを閉じた後は起点buttonへfocusを戻せる構造にする。
- 文字拡大時もheader actionと中央titleを重ねない。
- loading、error、保存中を読み上げ可能にする。
- Reduce Motion設定を尊重し、独自の大きなanimationを追加しない。

## 10. ファイル境界

- `src/app/events/new.tsx`, `src/app/events/[id].tsx`: route parameter、Repository注入、成功時の遷移だけ。
- `src/features/events/hooks/use-event-editor.ts`: 読み込み、編集状態、validation、保存・削除調整。
- `src/features/events/event-editor-model.ts`: 日時、繰り返し、通知、表示値の純粋変換。
- `src/features/events/screens/event-editor-screen.tsx`: header、loading/error、フォーム構成。
- `src/features/events/components/*`: タブ、日時、繰り返し、色、通知、text fieldなどfeature固有UI。
- `src/domain/calendar/*`: 既存の予定、色、繰り返し、通知validation。UI stateを持ち込まない。
- `src/shared/components`: 今回は新規追加しない。実際の第2利用箇所ができるまでfeature内に置く。

既存ファイルが大きくなる場合も、画面固有componentを`shared`へ先回りして移さない。

## 11. テスト

実装はTDDで進める。

### 11.1 純粋関数

- fixed、24時間超、`instant`、`undetermined`から終了日時を展開する。
- 月末、年末、うるう日をまたぐdurationを作る。
- 終了が開始以前の入力を拒否する。
- `9月25日（金）`形式をlocal calendar dateから作る。
- recurrence preset／customを規則へ変換し、不正な間隔、曜日、終了条件を拒否する。
- reminderを重複排除し、並べ替え後の`sortOrder`とevent IDを作る。

### 11.2 hook

- 新規はざっくり、編集は既存の予定の種類に応じたタブから始まる。
- タブと終日を往復しても入力を保持する。
- 複数日のきっちり／終日予定を作成・更新する。
- 既存`instant`、`undetermined`、24時間超durationを未変更保存で保持する。
- location、notes、color、recurrence、複数reminderを読み込み、同じaggregateへ保存する。
- reminder追加、重複防止、削除、並べ替え。
- validation error、Repository失敗、再試行、二重保存・保存中削除の防止。

### 11.3 componentとroute

- headerの左右操作領域が同じstyle境界を使い、中央titleを持つ。
- ざっくり／きっちり、終日ON/OFFで必要な項目だけを表示する。
- 日付の主表示が日本語形式で、native pickerのraw表示へ依存しない。
- フォーム項目の順序、通知未発火の説明、色・曜日・通知のaccessibility state。
- 新規／編集routeが薄いまま、保存・削除成功時だけrefreshして閉じる。
- 保存・削除中のgestureとAndroid backを無効にする。

### 11.4 全体検証

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
git diff --check
npx expo export --platform ios
npx expo export --platform android
```

export成功は実機のlayout、keyboard、picker、gesture、VoiceOver／TalkBack確認の代替にしない。

## 12. 実機確認

- iOS／Android、ライト／ダーク、小画面、文字拡大。
- header中央揃えと左右buttonの重なり。
- keyboard回避と最下部メモ・削除へのscroll。
- 日付・時刻pickerの表示、dismiss、focus復帰。
- ざっくり／きっちり／終日切替時の入力保持。
- 複数日、繰り返し、8色、複数通知の入力と再編集。
- 保存中のswipe dismiss、hardware back、連打防止。
- VoiceOver／TalkBackの読み上げ順とselected／checked state。

## 13. 完了条件

- 新規・既存予定で、承認済みの全編集項目を保存・再編集できる。
- 日付が`9月25日（金）`形式で表示される。
- きっちり／終日予定を複数日にまたがって保存できる。
- 「予定を追加」は保存・破棄や再起動の後もざっくりで開く。時間軸で時刻を指定した場合はきっちりで開く。編集時の精度と既存のduration種別、metadata、通知を維持する。
- 通知はDBへ保存され、端末通知を行わないことが画面上で明確である。
- 繰り返し規則は保存できるが、発生回表示が次PRであることを文書上明確にする。
- schema migrationと新規native dependencyを追加しない。
- 自動検証と両platform exportが成功し、実機未確認項目をPRへ記載する。

## 初期長と終了指定の更新（#57）

新規フォームのexact draftへ既定長を一度だけ反映する。未選択では1時間、明示終了routeと既存編集はそれぞれの値を優先する。きっちり・終日OFFでは終了指定を「時刻を指定／長さなし／未定」から単一選択し、後二者は終了日時を隠す。読込み失敗時もタイトル・メモを保持し、既定長を必要としないざっくり／終日の保存は妨げない。詳細は`2026-11-12-default-exact-duration-design.md`を参照する。
