# 書式付き予定メモ Design

## 1. 目的

Issue #24として、Markdownを知らない利用者でも予定メモへ基本的な書式、リスト、チェック項目、URLリンクを入力・編集・保存できるようにする。

- 太字、斜体、箇条書き、番号付きリスト、チェックリストを画面上の操作だけで扱えるようにする。
- `http://`と`https://`のURLを自動でリンクとして認識し、安全な明示操作で開けるようにする。
- 書式とチェック状態を端末内SQLiteへ保存し、再編集時に復元する。
- 既存のプレーンテキストメモを失わず、新しい書式付きメモへ移行する。
- 初期版は全画面の専用エディタとしつつ、後続で予定編集画面へ直接埋め込める責務境界を保つ。

本設計は`2026-09-25-calendar-event-editor-expansion-design.md`で後続へ分離した書式付きメモを具体化する。予定本体を保存するまでは、メモの変更をSQLiteへ書き込まない。

## 2. 対象範囲

### 2.1 対象

- 予定編集画面から開く全画面のメモエディタ。
- 太字、斜体、箇条書き、番号付きリスト、チェックリスト。
- チェックリストのチェック状態の編集と保存。
- `http://`、`https://` URLの自動リンク化と明示的な外部ブラウザ表示。
- アプリ所有のversion付きメモ文書形式。
- Expo DOM ComponentsとTiptapを使う編集面、およびアプリ文書形式とのadapter。
- 既存プレーンテキストメモの読み込み互換。
- schema version 5への非破壊migration。
- 通常予定と繰り返し予定・例外予定のメモ編集。
- VoiceOver、TalkBack、文字サイズ、ライト・ダークテーマへの対応。

### 2.2 対象外

- 画像・ファイル添付。
- 見出し、コードブロック、引用、表、水平線。
- 下線、取り消し線、文字色、背景色、フォントサイズ、文字揃え。
- リストの入れ子、複数段階のインデント。
- HTMLの直接入力・保存・表示。
- Markdown記法の入力支援、Markdownとしての解釈・保存・書き出し。
- 外部サービスへの同期、共同編集、クラウド保存。
- メモだけの自動保存や、予定を保存せずにメモだけを復元する機能。
- カレンダー一覧上での書式付き本文表示。カレンダー画面は従来どおり予定タイトルなど必要な要約だけを表示する。

`# 見出し`、バッククォート、画像記法などの未対応記法は特別扱いせず、利用者が入力した通常の文字列として表示・保存する。

## 3. 利用者向け挙動

### 3.1 開閉と保存境界

予定編集画面の「メモ」欄は、保存済みまたは編集中のメモのプレーンテキスト要約と「メモを追加」または「メモを編集」の操作を表示する。操作すると全画面の専用メモエディタをModalで開き、本文へ直ちに入力できる状態にする。

エディタのヘッダーは次の構成とする。

- 左: 「キャンセル」。エディタを開いた時点の文書へ戻して閉じる。
- 中央: 「メモ」。左右の操作領域を同幅にし、中央へ固定する。
- 右: 「完了」。現在の文書を予定編集画面のインメモリdraftへ反映して閉じる。

「完了」ではSQLiteへ保存しない。予定編集画面の「保存」が成功したときだけ、予定本体、メモ文書、プレーンテキスト投影を同じRepository操作で保存する。予定編集をキャンセルした場合、アプリを終了した場合、または保存に成功しなかった場合は、未保存のメモを既存DBへ反映しない。予定保存が失敗した場合は予定編集画面とインメモリdraftを保ち、再試行できるようにする。

保存済みメモを開いた場合も閲覧専用画面を挟まず、最初から編集可能にする。

### 3.2 書式ツールバー

キーボード表示中は、キーボード直上へ常時ツールバーを表示する。少なくとも次の操作を並べる。

- 太字。
- 斜体。
- 箇条書き。
- 番号付きリスト。
- チェックリスト。
- 選択中またはカーソル位置のリンクを開く。

太字・斜体は選択範囲へ適用する。選択がない場合は、以降に入力する文字の状態を切り替える。リスト操作は現在の段落を対象種別へ切り替え、同じ操作をもう一度行うと通常段落へ戻す。現在の状態を色だけで示さず、押下状態とアクセシビリティ状態でも示す。

キーボードを閉じた場合も本文は表示したままにし、再タップで編集を継続できる。端末の戻る操作はキーボードが開いていれば先にキーボードを閉じ、その後の戻る操作は「キャンセル」と同じ扱いにする。編集中の変更がある場合に無言で破棄しないよう、閉じる操作時は既存画面の離脱確認方針と統一する。

### 3.3 リストとチェックリスト

- リスト項目で改行すると、同じ種類の次項目を作る。
- 空のリスト項目で改行すると、そのリストを終了して通常段落へ戻る。
- 初期版ではTabやインデント操作による入れ子を作らない。貼り付けられた入れ子構造も平坦化する。
- チェックリストのチェックボックスは本文内で切り替えられる。
- チェック状態はエディタのdraftに含め、「完了」後も予定保存まではインメモリに留める。
- 再編集時は保存済みのチェック状態を復元する。

### 3.4 URLリンク

入力または貼り付けられた`http://`と`https://` URLだけを自動でリンク化する。メールアドレス、電話番号、独自scheme、JavaScript URL、相対URLは初期版ではリンクにしない。

編集中の通常タップはカーソル移動と選択に使い、リンクを開かない。リンク内へカーソルを置くかリンク文字列を選択したときだけ、ツールバーの「リンクを開く」を有効にする。この明示操作で外部ブラウザ表示を開始する。

表示前にnative側でURLを再解析し、schemeが`http:`または`https:`であることを検証する。検証に失敗した場合やブラウザを開けなかった場合は、文書を変更せず固定文言のエラーを表示する。

## 4. アーキテクチャ

### 4.1 責務分離

書式付きメモは次の3層へ分ける。

1. `src/domain/calendar/event-note.ts`
   - アプリ所有の`EventNoteDocumentV1`、parser、正規化、空判定、プレーンテキスト投影を提供する。
   - Tiptap、React、Expo、SQLiteの型へ依存しない。
2. `src/features/events/event-note/tiptap-note-adapter.ts`
   - `EventNoteDocumentV1`とTiptap JSONの相互変換だけを担当する。
   - 未対応node・markをアプリ文書へ漏らさず、安全な対応形式へ縮退する。
3. `src/features/events/components/formatted-note-editor/`
   - Expo DOMの編集面、nativeヘッダー、nativeツールバー、Modal wrapperを持つ。
   - 文書の初期化、編集command、状態通知、「完了」要求を調整する。

`useEventEditor`は`EventNoteDocumentV1 | null`のdraftとエディタ開閉を管理する。画面コンポーネントからSQLiteやTiptap JSONへ直接アクセスしない。

### 4.2 全画面Modalと将来の埋め込み

初期版はExpo Routerの別routeではなく、予定編集画面内の全画面Modalとして開く。これにより、予定全体とメモを同じインメモリdraftとして維持し、route parameter、URL、navigation履歴へ個人情報であるメモ本文を載せない。

再利用単位はModalそのものではなく、次の2つに分ける。

- `FormattedNoteEditor`: 文書、編集command、ready/error、完了通知を扱う編集本体。
- `FormattedNoteEditorModal`: 初期版の全画面ヘッダー、Modal、離脱操作を組み立てるwrapper。

後続で予定編集画面へ直接埋め込む場合は、`FormattedNoteEditorModal`を外し、同じ`FormattedNoteEditor`とdomain文書を利用する。SQLite形式やTiptap adapterを変更条件にしない。

### 4.3 Expo DOMとTiptap

編集面はExpo SDK 57のDOM Components上でTiptapを動かす。Tiptapには次のnode・markだけを登録する。

- `Document`
- `Paragraph`
- `Text`
- `HardBreak`（既存メモの段落内改行を保持するためだけに使用する）
- `Bold`
- `Italic`
- `BulletList`
- `OrderedList`
- `ListItem`
- `TaskList`
- `TaskItem`
- `Link`
- 履歴操作に必要な`UndoRedo`（Tiptap v3で旧`History`から改名）
- 空文書の案内に必要な`Placeholder`

汎用presetから未対応extensionを一括導入せず、許可するextensionを明示する。Heading、Code、CodeBlock、Image、Blockquote、Underline、Strikeなどは登録しない。

Linkは`openOnClick: false`、自動リンクを有効にし、`http:`と`https:`だけを許可する判定を設定する。メモ由来のHTMLやscriptを実行せず、note contentからWebViewのnavigationを開始させない。DOMからnative moduleへ直接アクセスできる実験的bridgeは有効にしない。

貼り付け時はTiptap側のparse後にadapterで許可schemaへ正規化する。未対応blockはテキストを段落として残し、未対応markとstyleを除去し、リストの入れ子は入力順を保って平坦化する。利用者が貼り付けた内容を任意HTMLとしてDBへ保存しない。

### 4.4 NativeとDOM間の通信

Expo DOMのimperative methodは非同期戻り値を同期取得する用途に使わず、nativeからDOMへのcommandだけに限定する。

- nativeツールバーからDOMへ`toggleBold`、`toggleItalic`、`toggleBulletList`、`toggleOrderedList`、`toggleTaskList`を送る。
- DOMはselectionやactive marksの変化をnative callbackへ送り、ツールバー状態を更新する。
- nativeヘッダーの「完了」はDOMへ`requestComplete()`を送る。
- DOMはその時点の最新Tiptap JSONをadapterでアプリ文書へ変換し、`onComplete(serializedDocument)`をnativeへ返す。

「完了」時にnative側の遅延stateを読む方式を避け、最後の文字入力直後でも最新文書を返す。callbackで受け取った値はdomain parserで再検証してから`useEventEditor`へ渡し、プレーンテキストはnative側の正規化済み文書から導出する。DOMから送るpayloadはJSON互換値に限定する。

## 5. Domain model

### 5.1 アプリ所有の文書形式

Tiptap固有JSONをdomainやSQLiteの正としない。アプリが所有する最小のversion付き形式を正とする。

```ts
type EventNoteDocumentV1 = Readonly<{
  version: 1;
  blocks: readonly EventNoteBlockV1[];
}>;

type EventNoteBlockV1 =
  | Readonly<{ type: 'paragraph'; content: readonly EventNoteInlineV1[] }>
  | Readonly<{
      type: 'bulletList' | 'orderedList';
      items: readonly (readonly EventNoteInlineV1[])[];
    }>
  | Readonly<{
      type: 'checkList';
      items: readonly Readonly<{
        checked: boolean;
        content: readonly EventNoteInlineV1[];
      }>[];
    }>;

type EventNoteInlineV1 = Readonly<{
  text: string;
  bold?: true;
  italic?: true;
  link?: string;
}>;
```

`CalendarEvent`と`EventDraft`は`notes: string | null`を`noteDocument: EventNoteDocumentV1 | null`へ置き換える。domain内にプレーンテキストと書式文書の二重の正を持たない。quick createは`noteDocument: null`を設定する。

### 5.2 検証と正規化

`parseEventNoteDocument`は少なくとも次を検証する。

- `version === 1`である。
- block、item、inlineが配列で、許可された判別値だけを持つ。
- `text`が文字列である。
- `bold`、`italic`は存在する場合`true`だけである。
- `link`は存在する場合、有効な`http:`または`https:` URLである。
- checklistの`checked`がbooleanである。
- ネスト、未知field、未知block・markを保存済みdomain値として受け入れない。

正規化は決定的で、少なくとも次を行う。

- 空文字のinlineを除く。
- 太字・斜体・linkが等しい隣接inlineを結合する。
- URLは`URL`でparseした正規文字列表現に揃える。
- markの比較順を固定し、同じ意味の文書が安定したJSONになるようにする。
- 空のlist itemを許可するが、末尾の操作上だけ生じた空項目は通常段落への離脱時に残さない。
- 完全に空の文書は予定保存時に`null`へ変換する。
- 空行として意味のあるparagraphは文書内に保持する。

新しい利用者向け文字数上限は設けない。ただし、壊れたDB値や過大なbridge payloadによる無制限処理を避けるため、parserはblock数、item数、inline数、構造深度に実装上の安全上限を持てる。この上限は通常入力で到達しない十分大きな値とし、本文を黙って切り捨てず検証失敗として扱う。

### 5.3 プレーンテキスト投影

`projectEventNoteToPlainText`は検索互換、既存列、予定編集画面の要約に使う決定的な文字列を返す。

- paragraphはinlineの`text`を連結する。
- 箇条書きは各項目を`• `で始める。
- 番号付きリストは各項目を`1. `、`2. `のように始める。
- チェックリストは未完了を`☐ `、完了を`☑ `で始める。
- block間とitem間は改行で区切る。
- link先が表示文字列と同じ場合はURLを1回だけ出力し、書式記号やHTMLを加えない。

旧プレーンテキストを文書へ変換する場合は、本文全体を1つのparagraphとして扱う。Markdownらしい文字や箇条書き記号を解析しないため、既存表示を勝手に変更しない。改行はinline text内で保持し、Tiptap adapterがDOM上のhard breakまたは段落内改行へ損失なく対応させる。

### 5.4 繰り返し例外

繰り返し予定の変更検出は、文字列比較から正規化済み`EventNoteDocumentV1`の構造比較へ変更する。比較用に決定的なcanonical JSONまたは同等の純粋関数を使い、object identityでは判定しない。

`EventOverrideField`の永続値`'notes'`は既存の`override_fields_json`との互換性のため維持する。`'notes'`が指定された場合、materialize処理はreplacementの`noteDocument`を使用し、指定されていない場合はseriesの`noteDocument`を使用する。利用者向け名称も引き続き「メモ」とする。

## 6. SQLiteとRepository

### 6.1 schema version 5

`events`へ次のnullable列を追加する。

```sql
ALTER TABLE events ADD COLUMN notes_document_json TEXT;
```

既存`notes TEXT`列は削除・改名せず、書式を除いたプレーンテキスト投影として残す。migration時に既存rowを一括JSON化しない。これにより、version 4以前のDBを短時間かつ非破壊でversion 5へ移行できる。

migrationは既存のversion付きtransaction内で列追加とschema version記録を行う。`schema_migrations`にversion 5がある場合は再適用しない。新規DBもversion 1から順に同じmigrationを通り、最終schemaを1経路で作る。

### 6.2 row mapping

row mapperは次の優先順位でdomain値を作る。

1. `notes_document_json`が非NULLで、有効なJSONかつ`EventNoteDocumentV1`なら正規化して使用する。
2. JSONがNULLまたは不正で、既存`notes`が空でなければ、`notes`全体を1つのparagraphへ変換する。
3. 両方に有効な本文がなければ`noteDocument: null`とする。

不正JSONがあっても旧`notes`から利用者の本文を復元できる場合は表示を継続する。生の本文やJSONをログ・例外messageへ含めない。JSONも旧本文も復元できない場合は、メモだけを`null`へfallbackし、予定本体を読めなくしない。書式の破損を診断する仕組みを将来追加する場合も、個人データを外部へ送らない。

### 6.3 書き込み

Repositoryのcreate、update、繰り返し例外replacementの作成・更新は、正規化済みdomain文書から次の2値を同時にbindする。

- `notes_document_json`: `EventNoteDocumentV1`のJSON。空文書はNULL。
- `notes`: `projectEventNoteToPlainText`の結果。空文書はNULL。

予定本体、通知、繰り返し例外を扱う既存transaction境界を維持し、JSONだけまたはプレーンテキストだけが先に確定する状態を作らない。SQLへruntime値を埋め込まずbound parameterを使う。

更新時に旧`notes`しかないrowを未変更のまま保存した場合も、editor draftへ変換済みの文書をJSON列へ保存する。これは利用者本文を変更せず、次回以降の正を新形式へ移す遅延migrationとなる。

## 7. 予定編集とデータフロー

### 7.1 読み込み

1. Repositoryがevent rowを取得する。
2. row mapperがJSON文書または旧`notes`から`noteDocument`を作る。
3. `useEventEditor`が文書をインメモリdraftとして保持する。
4. メモ行はプレーンテキスト投影の先頭部分を要約表示する。
5. メモ操作時にModalへdraftのimmutableな初期値を渡す。
6. Tiptap adapterがアプリ文書を許可されたTiptap JSONへ変換する。

### 7.2 編集と完了

1. DOM editorは編集中のTiptap documentをDOM側memoryに保持する。
2. selection状態だけをnativeへ通知し、入力ごとにDBへ書かない。
3. 「完了」でnativeが`requestComplete()`を送る。
4. DOM側が最新documentをアプリ文書へ変換し、nativeへ返す。
5. native側がdomain parserで検証・正規化する。
6. 成功時だけ`useEventEditor`のdraftを置き換えてModalを閉じる。
7. 予定の「保存」でRepositoryがJSONとプレーンテキストを同じ操作内に保存する。

「キャンセル」では手順4以降を行わず、Modalを開く前のdraftを維持する。

### 7.3 Linkを開く

1. DOM editorが現在selectionに対応するlink URLをnativeへ通知する。
2. native toolbarは有効な候補がある場合だけ「リンクを開く」を有効にする。
3. 利用者の押下時にnative側でURLを再検証する。
4. `expo-web-browser`の`openBrowserAsync`で外部ページを表示する。

DOM内のanchorによる直接navigationは許可しない。DOM componentでnavigation要求を監視できる境界を使い、ローカルeditor bundle以外への遷移は拒否する。リンク先へメモ本文、予定ID、カレンダーIDを追加しない。

## 8. UIとアクセシビリティ

- 既存の落ち着いたsemantic color tokenを使用し、書式状態を色だけで表さない。
- headerの左右操作領域とtoolbarの各操作領域は44pt以上とする。
- 太字、斜体、各リスト操作は明確なaccessibility labelと`accessibilityState.selected`を持つ。
- 利用できない「リンクを開く」は`accessibilityState.disabled`を持つ。
- チェック項目はcheckboxのrole、label、`checked`状態を読み上げ、本文タップとチェック操作を区別できるようにする。
- editorは現在の段落・リスト項目と入力内容をscreen readerで編集できるsemanticを維持する。
- 文字サイズ拡大時はtoolbarを横scrollまたは複数行へ安全に収め、本文領域を0にしない。
- ライト・ダークテーマで本文、placeholder、selection、toolbar、focus表示のコントラストを確認する。
- Reduce Motion時は全画面表示に不要な大きいanimationを使わない。
- キーボード表示、Safe Area、横向き、小画面でもheader、本文、toolbarが重ならないようにする。

ツールバーのiconだけでは意味が伝わりにくい操作は、accessibility labelに加えて選択状態が視覚的にも分かる形状を使う。初期実装でiconと短い文字ラベルのどちらを使うかは既存画面tokenと実機の幅を確認して決めるが、機能名をscreen readerから失わない。

## 9. エラー処理

- DOM editorの初期化中は本文を操作できないloading状態を表示し、「完了」を無効にする。
- 初期化に失敗した場合は元のdraftを保持し、固定文言のエラー、再試行、キャンセルを表示する。
- adapter変換またはdomain検証に失敗した場合はModalを閉じず、以前のdraftを上書きしない。
- 「完了」要求中は連打を同期的に防ぎ、成功または失敗後に解除する。
- リンク検証・ブラウザ表示失敗では本文を変更せず、再操作可能な固定文言を表示する。
- 予定保存失敗では予定編集画面とメモdraftを保持し、既存DB値を変更しない。
- 旧JSON破損時のfallbackでは生のメモ本文、URL、JSONをログへ出さない。

DOM editorがreadyになる前、またはエラー状態で「完了」できないことをnative側でも保証し、DOM callbackだけを信頼して保存可能状態にしない。

## 10. テスト方針

### 10.1 Domain

- 全対応block・mark・チェック状態をparseできる。
- 未知version、未知block・mark、不正型、非http(s) linkを拒否する。
- 隣接inline結合、空inline除去、空文書判定、URL正規化が決定的である。
- paragraph、各list、checklistを期待するプレーンテキストへ投影する。
- 旧プレーンテキストのMarkdownらしい記号を解釈せず保持する。
- 文書の構造比較で繰り返し予定の`notes` override変更を検出する。
- replacementとseriesの`noteDocument`を`overrideFields`どおりmaterializeする。

### 10.2 Adapter

- アプリ文書からTiptap JSONを経由して同じcanonical文書へround tripできる。
- 太字と斜体とlinkが重なるinlineを保持する。
- checklistのchecked状態を保持する。
- unsupported node・mark・styleを除去し、読めるテキストを段落へ残す。
- nested listを順序どおり平坦化する。
- 空段落と改行を合意した規則どおり保持する。

### 10.3 SQLiteとRepository

- version 4 DBへversion 5列を追加し、既存予定・メモ・例外を保持する。
- 新規DBがversion 5まで作成される。
- valid JSONを優先してrow mappingする。
- JSONがNULLまたは不正な場合、旧`notes`をparagraphへ変換する。
- JSONと旧`notes`の両方が空なら`noteDocument: null`になる。
- create/updateがcanonical JSONとプレーンテキスト投影を同時にbindする。
- 空文書を両列へNULLとして保存する。
- 繰り返しreplacementの作成・更新でも両列を保存する。
- runtime値をSQL文字列へ埋め込まない。

### 10.4 HookとUI

- メモ「完了」でdraftだけが更新され、Repositoryは呼ばれない。
- メモ「キャンセル」で開く前のdraftを維持する。
- 予定「保存」で最新メモをRepositoryへ渡す。
- 予定保存失敗時にdraftを維持する。
- DOMのready前と完了要求中は「完了」を無効にする。
- 最後の文字入力直後の「完了」でも最新documentを受け取る。
- toolbar command、selected/disabled状態、accessibility labelを確認する。
- link通常タップでnavigationせず、専用操作だけがnativeのURL表示境界を呼ぶ。
- checkboxの操作と読み上げ状態を確認する。
- 既存予定、単一発生回、「これ以降」の編集でメモを正しく引き継ぐ。

### 10.5 全体検証と手動確認

通常のtypecheck、lint、全test、`git diff --check`に加え、UIとDOM依存変更のためiOS・Androidのdevelopment exportまたはbuildを実行する。

自動検証とは別に実機で次を確認する。

- 日本語IMEの変換確定前後、文字選択、カーソル移動、undo/redo相当の入力挙動。
- キーボード表示・非表示とtoolbar位置。
- 太字、斜体、3種類のlist、空項目でのlist終了。
- checklistの切替、保存、再起動後の復元。
- URL自動リンク、通常タップで開かないこと、専用操作からのbrowser表示。
- iOS VoiceOverとAndroid TalkBackでtoolbar、link、checkboxを操作できること。
- Dynamic Type、ライト・ダーク、小画面、横向き、Reduce Motion。
- version 4相当の実DBから既存プレーンテキストメモを移行・編集・再保存できること。

build・export成功、unit test成功、実機操作、アクセシビリティ確認は別の結果としてPRへ記載し、自動テストだけで実機確認済みとしない。

## 11. 依存関係とリスク

実装時はExpo SDK 57固定の公式資料とTiptap公式資料を再確認し、現在のReact版と互換性があるTiptap packageを固定する。必要なextensionだけを追加し、別のReact Native rich-text bridgeは追加しない。Expo SDK 57既定の`@expo/dom-webview`にはtop-level navigationを判定するnative callbackがないため、公式互換版の`react-native-webview`へopt outし、許可したeditor document以外への遷移をnative境界で拒否する。DOM/native間の機能呼び出しはExpo DOM Componentsのbridgeを利用する。

主なリスクと対応は次のとおり。

- DOM初期化時間: 専用Modalを開いた時だけeditorを作り、ready状態を明示する。
- async bridgeの競合: 「完了」はDOMから最新documentを返信するrequest/response flowにする。
- IMEとselection差異: Tiptapへ編集責務を寄せ、独自contenteditable操作を増やさず実機確認する。
- vendor形式への固定: DBへはアプリ所有schemaだけを保存し、Tiptapをadapterの内側へ閉じる。
- 不正pasteとURL: 許可schemaへの正規化、native側のURL再検証、WebView navigation拒否を重ねる。
- 旧データ喪失: `notes`を残し、遅延変換とdual-writeで後方互換を保つ。
- bundle size: 実装後にexport結果を確認し、不要extensionを含めない。

メモ本文をネットワークへ送る依存、分析処理、外部変換サービスは追加しない。

## 12. ドキュメント更新

実装PRでは次を同時に更新する。

- SQLite schema version、`events.notes_document_json`、旧`notes`の役割をDB関連文書へ記載する。
- 予定のdomain modelとメモ保存形式をアーキテクチャ文書へ反映する。
- READMEまたは利用者向け機能一覧へ、対応書式と対象外を記載する。
- Issue #24の完了条件と実装結果を対応付ける。
- 実機未確認項目が残る場合は未確認としてPRに明記する。

## 13. 受け入れ条件との対応

| 受け入れ条件 | 設計上の対応 |
| --- | --- |
| Markdownを知らなくても操作できる | 常時表示toolbarと本文内checkboxだけで編集する |
| 太字・斜体 | app schemaのinline markとTiptap commandで保持する |
| 箇条書き・番号付きリスト | 専用blockとlist commandで保持する |
| チェックリスト | `checked`を持つ専用blockとして保存・復元する |
| URLを自動リンク化する | http(s)限定のautolinkとnative再検証を行う |
| 安全にリンクを開く | 編集タップでは開かず、専用操作から`expo-web-browser`を使う |
| 書式とチェック状態を端末内へ保存する | version付きJSONをSQLiteへ保存する |
| 既存プレーンテキストを保持する | 旧`notes` fallbackと遅延migrationを行う |
| VoiceOver・TalkBackで操作できる | toolbar state、checkbox role/state、44pt領域を定義する |
| 予定保存前はDBへ書かない | `useEventEditor`のインメモリdraftを保存境界とする |
| 後から直接埋め込める | editor本体とModal wrapperを分離する |

## 14. 実装分割の境界

実装は1つのPR内で、テストを先に追加しながら次の依存順で進める。

1. `EventNoteDocumentV1`、parser、正規化、投影、構造比較。
2. schema version 5、row mapper、Repositoryのdual-writeと旧データfallback。
3. Tiptap依存とadapter、DOM editorの最小構成。
4. native toolbar・全画面Modal・`useEventEditor`のインメモリdraft。
5. リンク表示境界、エラー処理、アクセシビリティ。
6. 繰り返し例外の比較・materialize、回帰テスト、文書更新。

各段階でdomain、data、featureの境界を保ち、Tiptap JSONをdomainやRepository APIへ漏らさない。実装計画は本設計の承認後に別文書として作成する。
