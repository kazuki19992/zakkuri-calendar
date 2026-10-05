# ざっくりカレンダー

曖昧な時間表現を扱える、Expo + React Native製のlocal-firstカレンダーです。現在はMVPのデータ基盤、時間軸付きの今日・明日2日ビュー、月ビュー、schema version 5を利用した予定の作成・編集・削除を実装しています。

## 開発

依存関係をlockfileどおりにインストールします。

```bash
npm ci
```

開発サーバーを起動します。

```bash
npm start
```

変更前後に次の検証を実行します。

```bash
npm test -- --runInBand
npm run typecheck
npm run lint
```

## ローカルEAS Build

EASのdevelopment profileでiOSとAndroidを順番にローカルビルドします。

```bash
./scripts/build-local.sh development
```

片方のplatformだけをビルドする場合は、第2引数へ指定します。

```bash
./scripts/build-local.sh development ios
./scripts/build-local.sh development android
```

第1引数には`development`、`preview`、`production`を指定できます。成果物は`builds/<profile>/<platform>/`へ保存され、Gitの追跡対象にはなりません。

スクリプトは`.env.local`があれば`KEY=value`または`export KEY=value`形式の環境変数を展開してビルドへ渡します。ファイルがない場合は警告を表示して続行します。`eas-cli`をローカルへインストールし、`eas login`を済ませてください。ビルドは`--non-interactive`で実行するため、認証情報・署名用証明書・プロビジョニングプロファイルなどの入力が必要な場合は、事前にEASへ登録してください。iOSのローカルビルドにはmacOS、Xcode、CocoaPodsが、AndroidにはAndroid SDKとNDKが必要です。

## MVPカレンダー

MVPでは、アプリ起動時に今日と明日の2日ビューを横2列で表示します。2日で共有する24時間軸上に予定を置き、左右スワイプまたは前後ボタンで1日ずつ移動できます。「2日」「月」で6週間固定の月ビューへ切り替えられます。カレンダー部分はReact Native標準コンポーネントで独自描画し、アプリのライト・ダークテーマへ追従します。予定は端末内SQLiteからローカルに取得し、日本の祝日名も表示します。

「朝」「昼ごろ」「午後」などの予定は、SQLiteに保存された時間表現定義の開始・終了時刻とフェード比率に従って縦方向のグラデーションで表示します。始点のみ、終点のみ、両端、グラデーションなしの4種類に対応し、深夜のように日付をまたぐ範囲は2日へ分けても元のピーク位置を維持します。正確な予定の「未定」は、SQLite設定の既定値120分を使って開始時刻をピークに薄くします。

画面右下の「予定を追加」ボタンから、選択中の日付の予定を作成できます。2日ビューでは空き時間をダブルタップすると、最も近い`HH:00`を開始時刻にした正確な予定フォームを開けます。既存予定をタップすると編集でき、削除時はネイティブの確認ダイアログを表示します。

作成・編集フォームは「ざっくり」と「きっちり」の2タブで構成し、最後に開いたタブを次回も復元します。きっちりでは終日を切り替え、開始日・終了日と時刻をネイティブピッカーで指定できます。日付は`9月25日（金）`形式の表示を直接タップして選択し、年末を含む複数日予定も保存できます。時間帯、繰り返し、予定色などの単一選択はドロップダウンを使用します。

両タブから、繰り返し、カレンダー既定色または固定8色、場所、複数通知、書式付きメモを編集できます。メモは全画面エディタで太字、斜体、箇条書き、番号付きリスト、チェックリスト、HTTP/HTTPSリンクに対応し、予定を保存するまではインメモリに保持します。通知は予定時刻から1日前までの候補と任意の分数を追加でき、順序も保存します。

### 予定モデル schema version 5

SQLiteのschema version 5では、複数日予定、相対日付の解決context、繰り返し例外、場所、予定色、複数通知に加え、アプリ所有のversion付きJSONで書式付きメモを保存します。既存の`notes`列はプレーンテキスト投影として残し、`notes_document_json`がない旧データは内容を解釈せず1つの段落へ変換します。保存時はJSONと投影を同じRepository操作で更新します。

繰り返し規則の発生回を2日／月ビューへ展開し、「この予定」「これ以降」「すべての予定」の変更範囲を扱います。通知設定をSQLiteへ保存しても、端末通知の権限要求、予約、解除、発火はまだ行いません。

- 月グリッドは6週間固定、月曜始まり固定です。週の開始曜日を設定できる機能はIssue [#10](https://github.com/kazuki19992/zakkuri-calendar/issues/10)で追跡します。
- 日本の祝日は端末内で判定し、1970年から2050年までを表示対象とします。この範囲外は祝日なしではなく「祝日情報未対応」として扱います。
- 2日／月の最後に開いた表示を次回起動時に復元します。未保存または不正な設定値では2日ビューを表示します。時間表現の範囲、フェード比率、未定時間を変更する設定UIはv1以降の対象です。
- 日内のざっくり予定、正確な予定、終日予定を作成・編集・削除できます。週・月単位の時間表現を選択するUIは後続タスクです。祝日を考慮した期間・業務日計算と祝日カレンダーの設定化も未実装で、Issue [#9](https://github.com/kazuki19992/zakkuri-calendar/issues/9)で追跡します。
- 予定モデルと編集UIはschema version 5の場所、書式付きメモ、色、通知、繰り返し規則、繰り返し例外まで対応しています。端末通知のスケジュール・発火は後続タスクです。
- 対象プラットフォームはiOSとAndroidです。Webの動作は保証しません。

## データ境界

- 個人のカレンダーデータは端末内のSQLiteデータベース`zakkuri-calendar.db`へ保存します。
- migrationと初期seedは`src/data/sqlite/migrations.ts`でversion管理し、再実行しても既存値を上書きしない形を維持します。
- ドメインルールとRepository契約は`src/domain`、SQLite実装は`src/data/sqlite`に置きます。
- UIはSQLやSQLite rowへ直接アクセスせず、Repository契約とfeature custom hookを経由します。
- migration、row mapper、Repositoryでは、予定タイトルなどの個人データをエラーメッセージやログへ含めません。

MVPの仕様は`docs/superpowers/specs/2026-09-07-zakkuri-calendar-mvp-design.md`、SQLite基盤の実装計画は`docs/superpowers/plans/2026-09-08-mvp-sqlite-foundation.md`、予定編集UIの設計は`docs/superpowers/specs/2026-09-30-event-editor-ui-design.md`、書式付きメモの設計は`docs/superpowers/specs/2026-10-02-rich-text-event-notes-design.md`を参照してください。
