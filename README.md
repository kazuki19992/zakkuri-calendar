# ざっくりカレンダー

曖昧な時間表現を扱える、Expo + React Native製のlocal-firstカレンダーです。現在はMVPのデータ基盤を実装しています。

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

## データ境界

- 個人のカレンダーデータは端末内のSQLiteデータベース`zakkuri-calendar.db`へ保存します。
- migrationと初期seedは`src/data/sqlite/migrations.ts`でversion管理し、再実行しても既存値を上書きしない形を維持します。
- ドメインルールとRepository契約は`src/domain`、SQLite実装は`src/data/sqlite`に置きます。
- UIはSQLやSQLite rowへ直接アクセスせず、Repository契約とfeature custom hookを経由します。
- migration、row mapper、Repositoryでは、予定タイトルなどの個人データをエラーメッセージやログへ含めません。

MVPの仕様は`docs/superpowers/specs/2026-09-07-zakkuri-calendar-mvp-design.md`、SQLite基盤の実装計画は`docs/superpowers/plans/2026-09-08-mvp-sqlite-foundation.md`を参照してください。
