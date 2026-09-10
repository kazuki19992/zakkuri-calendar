# ざっくりカレンダー

曖昧な時間表現を扱える、Expo + React Native製のlocal-firstカレンダーです。現在はMVPのデータ基盤、時間軸付きの今日・明日2日ビュー、月ビュー、予定の作成・編集・削除を実装しています。

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

作成・編集フォームでは、タイトル、日付、種別（正確・終日・ざっくり）を選べます。正確な予定はネイティブピッカーで開始・終了時刻を指定します。終了時刻が開始より前の場合は翌日終了として保存され（例: `23:30`〜`00:30`）、翌日側の月表示・予定一覧にも表示されます。同じ時刻を開始・終了に指定することはできません。

- 月グリッドは6週間固定、月曜始まり固定です。週の開始曜日を設定できる機能はIssue [#10](https://github.com/kazuki19992/zakkuri-calendar/issues/10)で追跡します。
- 日本の祝日は端末内で判定し、1970年から2050年までを表示対象とします。この範囲外は祝日なしではなく「祝日情報未対応」として扱います。
- 2日／月の最後に開いた表示を次回起動時に復元する設定はIssue [#16](https://github.com/kazuki19992/zakkuri-calendar/issues/16)で追跡します。時間表現の範囲、フェード比率、未定時間を変更する設定UIはv1以降の対象です。
- 日内のざっくり予定、正確な予定、終日予定を作成・編集・削除できます。週・月単位の時間表現を選択するUIは後続タスクです。祝日を考慮した期間・業務日計算と祝日カレンダーの設定化も未実装で、Issue [#9](https://github.com/kazuki19992/zakkuri-calendar/issues/9)で追跡します。
- 対象プラットフォームはiOSとAndroidです。Webの動作は保証しません。

## データ境界

- 個人のカレンダーデータは端末内のSQLiteデータベース`zakkuri-calendar.db`へ保存します。
- migrationと初期seedは`src/data/sqlite/migrations.ts`でversion管理し、再実行しても既存値を上書きしない形を維持します。
- ドメインルールとRepository契約は`src/domain`、SQLite実装は`src/data/sqlite`に置きます。
- UIはSQLやSQLite rowへ直接アクセスせず、Repository契約とfeature custom hookを経由します。
- migration、row mapper、Repositoryでは、予定タイトルなどの個人データをエラーメッセージやログへ含めません。

MVPの仕様は`docs/superpowers/specs/2026-09-07-zakkuri-calendar-mvp-design.md`、SQLite基盤の実装計画は`docs/superpowers/plans/2026-09-08-mvp-sqlite-foundation.md`を参照してください。
