# ざっくりカレンダー

曖昧な時間表現を扱える、Expo + React Native製のlocal-firstカレンダーです。現在はMVPのデータ基盤、今日・明日の2日ビュー、月ビュー、日内のざっくり予定作成を実装しています。

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

MVPでは、アプリ起動時に今日と明日の2日ビューを横2列で表示します。左右スワイプまたは前後ボタンで1日ずつ移動でき、「2日」「月」で6週間固定の月ビューへ切り替えられます。カレンダー部分はReact Native標準コンポーネントで独自描画し、アプリのライト・ダークテーマへ追従します。予定は端末内SQLiteからローカルに取得し、日本の祝日名も表示します。

予定を登録するには、2日ビューでは各日付列の「予定」を、月ビューでは日付を選択して予定欄の「予定を追加」を押します。モーダルでタイトル、日付、「朝」「午後」などの日内の時間帯を選んで保存すると、端末内SQLiteへ保存され、カレンダーへ反映されます。

- 月グリッドは6週間固定、月曜始まり固定です。週の開始曜日を設定できる機能はIssue [#10](https://github.com/kazuki19992/zakkuri-calendar/issues/10)で追跡します。
- 日本の祝日は端末内で判定し、1970年から2050年までを表示対象とします。この範囲外は祝日なしではなく「祝日情報未対応」として扱います。
- 2日／月の最後に開いた表示を次回起動時に復元する設定はIssue [#16](https://github.com/kazuki19992/zakkuri-calendar/issues/16)、時間軸と時間表現ごとのグラデーションはIssue [#17](https://github.com/kazuki19992/zakkuri-calendar/issues/17)で追跡します。
- 現在作成できるのは日内のざっくり予定です。時刻指定、終日、週・月単位の予定、編集・削除は後続タスクで実装します。祝日を考慮した期間・業務日計算と祝日カレンダーの設定化も未実装で、Issue [#9](https://github.com/kazuki19992/zakkuri-calendar/issues/9)で追跡します。
- 対象プラットフォームはiOSとAndroidです。Webの動作は保証しません。

## データ境界

- 個人のカレンダーデータは端末内のSQLiteデータベース`zakkuri-calendar.db`へ保存します。
- migrationと初期seedは`src/data/sqlite/migrations.ts`でversion管理し、再実行しても既存値を上書きしない形を維持します。
- ドメインルールとRepository契約は`src/domain`、SQLite実装は`src/data/sqlite`に置きます。
- UIはSQLやSQLite rowへ直接アクセスせず、Repository契約とfeature custom hookを経由します。
- migration、row mapper、Repositoryでは、予定タイトルなどの個人データをエラーメッセージやログへ含めません。

MVPの仕様は`docs/superpowers/specs/2026-09-07-zakkuri-calendar-mvp-design.md`、SQLite基盤の実装計画は`docs/superpowers/plans/2026-09-08-mvp-sqlite-foundation.md`を参照してください。
