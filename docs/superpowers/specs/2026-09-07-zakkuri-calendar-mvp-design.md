# ざっくりカレンダー MVP 設計

## 1. 目的

ざっくりカレンダーのMVPは、正確な時刻が決まっていない予定を、その曖昧さを失わずに登録・表示・編集できるかを検証する。

最優先する体験は次のループである。

1. アプリを開く
2. 「昼過ぎ」「夕方」「来週前半」などを選ぶ
3. 予定を数秒で登録する
4. カレンダー上で曖昧さをラベルと視覚表現から理解する
5. 後から予定の精度を変更する

元仕様: [Notion「ざっくりカレンダー」](https://app.notion.com/p/2b6f0b553b648093be5edaaa3347093d)

関連Issue: [#1 MVP](https://github.com/kazuki19992/zakkuri-calendar/issues/1)、[#2 UX・技術設計](https://github.com/kazuki19992/zakkuri-calendar/issues/2)

## 2. MVPの範囲

### 2.1 対象

- 個人カレンダー1枚
- SQLiteによる完全ローカル保存
- 予定の作成、編集、削除
- 正確な時刻、終日、標準のざっくり時間表現
- 日、週、月ビュー
- ラベルとグラデーションを組み合わせた曖昧さの表示
- 正確な予定のデフォルト長設定
- iOS、Android

### 2.2 対象外

- 通知
- RevenueCat課金
- 複数カレンダーの作成UI
- 標準時間表現の編集UI
- カスタム時間表現の作成UI
- Sentry
- Analytics
- 共有、認証、クラウド同期、QR招待
- 外部カレンダー読み込み
- ウィジェット、追加テーマ、AI
- Webの動作保証

対象外の機能は、既存のドメインモデルを置き換えずに追加できる境界を用意する。ただし、未確定の機能本体や抽象化は先回りして実装しない。

## 3. 設計原則

- React NativeとExpo SDK 57を使用する。
- 個人予定は端末内だけに保存し、外部へ送信しない。
- UI、状態調整、時間計算、永続化を分離する。
- UIはSQLiteを直接呼ばず、機能単位のカスタムhookを経由する。
- hookは画面状態とユースケースの調整を担当し、時間計算や検証は純粋関数へ置く。
- Repositoryの契約をドメイン側に置き、SQLite実装へ依存させない。
- DIコンテナは導入せず、React Contextによる小さな依存注入にする。
- DRY、KISS、SOLIDを判断基準にし、実在しない再利用のための抽象化は作らない。
- 将来変更が確定している時間表現、カレンダー境界、タイムゾーン情報はデータモデルへ含める。
- 共有や課金など仕様が未確定の機能は、後から接続できる境界だけを守る。

## 4. ソース構成

```text
src/
├── app/                         Expo Routerのrouteと画面構成
├── domain/
│   ├── calendar/                カレンダーの型と契約
│   └── temporal/                時間表現、期間解決、検証
├── data/
│   └── sqlite/                  migration、seed、Repository実装
├── features/
│   └── calendar/
│       ├── components/          カレンダー固有の表示部品
│       ├── hooks/               UI状態と操作の調整
│       └── screens/             hookと表示部品の組み立て
└── shared/
    └── components/              複数画面で使う共通UI
```

`shared/components`には、Dialog、Toast、LoadingState、EmptyState、ErrorStateなど、実際に複数画面で使うものだけを置く。将来使う可能性だけでは共通化しない。

## 5. 画面と操作フロー

### 5.1 ナビゲーション

Expo RouterのStackを使用する。

- メインカレンダー画面
- 予定作成・編集モーダル
- 設定画面

見た目や配置は変更可能とし、route、hook、ドメイン処理の境界を維持する。

### 5.2 メインカレンダー

- 日、週、月の表示切替
- 前後の期間への移動
- 今日へ戻る操作
- 日付選択
- 予定一覧
- 予定追加ボタン

初期表示は月ビューとし、選択日の予定一覧を同じ画面に表示する。

### 5.3 予定作成・編集

作成と編集は同じフォームとhookを使う。

- タイトル
- 基準日
- 正確、終日、ざっくりの種別
- ざっくり予定の時間表現
- 正確な予定の開始時刻
- 正確な予定の長さ

保存後はメイン画面の対象期間へ即時反映する。保存が失敗した場合は成功状態へ遷移しない。

### 5.4 設定

正確な予定を作る際のデフォルト長を選択できる。初期値は「瞬間」とする。

- 瞬間
- 10分
- 15分
- 30分
- 1時間
- 未定

予定ごとにデフォルトとは異なる長さを選べる。「未定」の減衰時間はDBに保持するが、MVPでは編集UIを提供しない。

## 6. ドメインモデル

### 6.1 TemporalExpression

予定の時間表現は、次の判別可能な型として扱う。

- `exact`: 正確な開始時刻と長さ
- `allDay`: 日付のみ
- `fuzzy`: DB上の時間表現定義を参照
- `approximatePoint`: 将来のおおよその時刻用。MVPでは作成UIを提供しない

正確な予定の長さは次の型を持つ。

- `instant`: 開始時刻の一点
- `fixed`: 10、15、30、60分
- `undetermined`: 開始時刻は確定し、終了は未定

`undetermined`は開始時刻をピーク濃度とし、初期値では2時間かけて終了方向へ減衰する。2時間は製品上の確定値ではなく、実機で触った後にDB設定を調整する。

### 6.2 時間表現定義

標準時間表現もコード定数ではなく、SQLiteの`temporal_definitions`へseedする。

- 予定は定義IDを参照する。
- 定義変更は、その定義を参照する既存予定にも反映する。
- 削除は物理削除せず無効化し、新しい予定の選択肢から外す。
- 無効化後も既存予定のラベルと期間は解決できる。
- 定義はカレンダーに所属させ、将来カレンダーごとに異なる定義を持てるようにする。

### 6.3 相対表現

「来週前半」「月末」などは、作成時に対象期間のanchorを確定して予定へ保存する。

例として、ある日に「来週前半」を選択すると、翌週月曜日が`anchorDate`になる。時間経過によって予定が次の週へ移動することはない。一方、定義を月曜日〜水曜日から月曜日〜木曜日へ変更した場合は、同じanchor週の中で既存予定の範囲も更新される。

週の開始は月曜日とする。

### 6.4 タイムゾーン

- 日付と時刻は壁時計の値として保存する。
- 端末のタイムゾーン変更では、保存した日付と時刻を自動移動しない。
- 作成時のIANAタイムゾーンIDを将来用メタデータとして保存する。
- MVPではタイムゾーン編集UIを提供しない。

## 7. 初期の標準時間表現

### 7.1 日内

| key | ラベル | 範囲 | fadeInRatio | fadeOutRatio |
| --- | --- | --- | ---: | ---: |
| `morning` | 朝 | 06:00〜10:00 | 0.25 | 0.25 |
| `am` | 午前 | 08:00〜12:00 | 0 | 0 |
| `before_noon` | 昼前 | 10:30〜12:00 | 0.35 | 0 |
| `around_noon` | 昼ごろ | 11:30〜13:30 | 0.5 | 0.5 |
| `early_afternoon` | 昼過ぎ | 13:00〜16:00 | 0 | 0.35 |
| `pm` | 午後 | 12:00〜17:00 | 0 | 0.35 |
| `evening` | 夕方 | 16:00〜19:00 | 0.25 | 0.25 |
| `night` | 夜 | 18:00〜23:00 | 0.25 | 0.25 |
| `late_night` | 深夜 | 22:00〜翌02:00 | 0.25 | 0.25 |

`late_night`の終了は翌日の02:00として解決し、日跨ぎをドメイン層で扱う。

### 7.2 週

| key | ラベル | anchor | 範囲 | fadeInRatio | fadeOutRatio |
| --- | --- | --- | --- | ---: | ---: |
| `this_week_first_half` | 今週前半 | 今週 | 月〜水 | 0 | 0 |
| `this_week_second_half` | 今週後半 | 今週 | 木〜金 | 0 | 0 |
| `this_weekend` | 今週末 | 今週 | 土〜日 | 0 | 0 |
| `next_week` | 来週 | 翌週 | 月〜日 | 0 | 0 |
| `next_week_first_half` | 来週前半 | 翌週 | 月〜水 | 0 | 0 |
| `next_week_second_half` | 来週後半 | 翌週 | 木〜日 | 0 | 0 |
| `week_after_next` | 再来週 | 翌々週 | 月〜日 | 0 | 0 |

### 7.3 月

| key | ラベル | anchor | 範囲 | fadeInRatio | fadeOutRatio |
| --- | --- | --- | --- | ---: | ---: |
| `month_start` | 月初 | 当月 | 1〜5日 | 0 | 0.35 |
| `month_first_third` | 上旬 | 当月 | 1〜10日 | 0 | 0 |
| `month_middle_third` | 中旬 | 当月 | 11〜20日 | 0 | 0 |
| `month_last_third` | 下旬 | 当月 | 21日〜月末 | 0 | 0 |
| `month_end` | 月末 | 当月 | 最終5日間 | 0.35 | 0 |
| `next_month` | 来月 | 翌月 | 1日〜月末 | 0 | 0 |

週、月、年の境界では実際のカレンダー日付を使い、固定日数の加算で月を近似しない。

## 8. フェードモデル

各定義は範囲全体に対する開始側と終了側のフェード比率を持つ。

- `fadeInRatio = 0`: 開始境界が明確
- `fadeOutRatio = 0`: 終了境界が明確
- 両方0: 両端が明確
- 開始側だけ正数: 開始だけグラデーション
- 終了側だけ正数: 終了だけグラデーション
- 両方正数: 両端がグラデーション
- `0.5 / 0.5`: 中央が単一のピーク
- `0 / 1`: 開始がピークで、終了まで減衰

各値は0以上1以下、合計は1以下とする。保存前と読み出し時にドメイン層で検証する。値は見た目ではなく時間範囲内の意味を表し、色や不透明度への変換は表示層が担当する。

MVPでは値の編集UIを提供しない。具体的な色、濃度、重なり表現は日・週・月ビューの各タスクで実機確認しながら決定する。

## 9. SQLite設計

### 9.1 `calendars`

- `id`: TEXT PRIMARY KEY
- `name`: TEXT NOT NULL
- `time_zone_id`: TEXT NOT NULL
- `created_at`: TEXT NOT NULL
- `updated_at`: TEXT NOT NULL

MVPでは既定の個人カレンダーを1件seedする。将来の複数カレンダー機能は同じテーブルへ追加する。

### 9.2 `temporal_definitions`

- `id`: TEXT PRIMARY KEY
- `calendar_id`: TEXT NOT NULL
- `key`: TEXT NOT NULL
- `label`: TEXT NOT NULL
- `granularity`: TEXT NOT NULL
- `resolver_type`: TEXT NOT NULL
- `resolver_config_json`: TEXT NOT NULL
- `fade_in_ratio`: REAL NOT NULL
- `fade_out_ratio`: REAL NOT NULL
- `is_system`: INTEGER NOT NULL
- `is_enabled`: INTEGER NOT NULL
- `sort_order`: INTEGER NOT NULL
- `created_at`: TEXT NOT NULL
- `updated_at`: TEXT NOT NULL

`resolver_config_json`は判別可能な構造としてドメイン層で型検証する。

- 日内: 開始分、終了分。翌日は1440を超える分として表現できる。
- 週: 選択時の週offset、週内の開始曜日と終了曜日。
- 月: 選択時の月offset、月初基準または月末基準の開始日と終了日。

イベント作成時には選択offsetを使ってanchorを確定し、既存イベントの表示時には保存済みanchorと定義内の範囲だけを使う。

### 9.3 `events`

- `id`: TEXT PRIMARY KEY
- `calendar_id`: TEXT NOT NULL
- `title`: TEXT NOT NULL
- `temporal_type`: TEXT NOT NULL
- `anchor_date`: TEXT NOT NULL
- `temporal_definition_id`: TEXT NULL
- `start_time`: TEXT NULL
- `duration_type`: TEXT NULL
- `duration_minutes`: INTEGER NULL
- `created_time_zone_id`: TEXT NOT NULL
- `created_at`: TEXT NOT NULL
- `updated_at`: TEXT NOT NULL

型ごとの必須項目はドメイン層で検証する。

- `exact`: `start_time`と`duration_type`が必須
- `fixed`: `duration_minutes`が必須
- `fuzzy`: `temporal_definition_id`が必須
- `allDay`: 時刻と定義IDを持たない

予定の削除はMVPでは物理削除とする。共有同期を導入する時点で同期要件に沿った削除表現をmigrationで追加する。

### 9.4 `app_settings`

- `key`: TEXT PRIMARY KEY
- `value_json`: TEXT NOT NULL
- `updated_at`: TEXT NOT NULL

初期設定は次のとおり。

- `default_exact_duration`: `{ "type": "instant" }`
- `undetermined_fade_minutes`: `120`

読み出し時にキーごとの型検証を行い、不正値は安全な既定値へフォールバックして修復対象として扱う。

### 9.5 migration

migration履歴をテーブルで管理し、各migrationをトランザクション内で一度だけ実行する。標準定義と既定カレンダーのseedは再実行しても重複しない。

## 10. データフロー

```text
Route / Screen
  ↓ user action
Feature Hook
  ↓ validated command
Domain function / Repository interface
  ↓
SQLite Repository
  ↓ persisted result
Feature Hook
  ↓ view state
Presentational Component
```

- routeはパラメータ受け渡しとscreenの配置だけを担当する。
- feature hookは読み込み、保存中、エラー、選択状態を公開する。
- ドメイン関数は期間解決と入力検証を行う。
- Repositoryはドメイン型を受け取り、SQLiteのrow変換を内部へ閉じ込める。
- 表示コンポーネントはSQLite rowやJSONを受け取らない。

グローバル状態管理ライブラリは導入しない。DBを永続状態のsource of truthとし、画面間で必要な再読み込み通知だけを小さなContextで扱う。

## 11. エラー処理とプライバシー

- DB初期化中は操作画面を表示しない。
- 初期化失敗時は再試行可能な共通ErrorStateを表示する。
- migrationとseedはトランザクション内で実行する。
- タイトル未入力や不正な時間範囲は保存前にフォーム内で表示する。
- 保存、更新、削除の失敗は共通Toastで通知する。
- 永続化成功前に予定を成功扱いにしない。
- ログへ予定タイトル、将来のメモ、場所などの本文を出さない。
- 予定本文を外部サービスへ送信しない。

## 12. アクセシビリティ

- グラデーションだけに意味を依存せず、時間表現のラベルを必ず表示する。
- 正確、終日、ざっくりの種別と期間をスクリーンリーダー用テキストでも説明する。
- 色だけで予定の種別や選択状態を区別しない。
- 操作要素には役割、ラベル、選択状態を設定する。
- 小さい画面と文字サイズ拡大時にも主要操作へ到達できる構造にする。

## 13. テスト方針

各実装タスクはTDDで進める。

### 13.1 ドメイン

- 日跨ぎ
- 月曜日始まりの週解決
- 月末、年末、閏年
- anchorの固定
- 定義変更の既存予定への反映
- フェード値の範囲と合計制約
- exact、allDay、fuzzyの型別検証

### 13.2 SQLite

- migrationの初回実行と再実行
- 既定カレンダーと標準定義のseed
- 予定の作成、取得、更新、削除
- 無効化された定義を参照する既存予定
- 不正なrowと設定値の扱い

### 13.3 hooks

- 初期読み込み
- 表示期間と選択日の変更
- 作成、編集、削除後の再読み込み
- 保存中の二重送信防止
- Repository失敗時の状態

### 13.4 UI

- 予定作成・編集フォームの主要操作
- 日、週、月の表示切替
- 空状態、読み込み状態、エラー状態
- ラベルとアクセシビリティ情報

各PRで対象テスト、lint、typecheckを実行し、MVP安定化タスクで全テストとiOS・Androidのレイアウト確認を行う。自動テストの成功を実機動作の証明として扱わない。

## 14. タスクと依存順

1. UX・技術設計
2. テスト基盤とSQLite基盤
3. アプリシェルと月ビュー
4. ざっくり予定のクイック作成
5. 日ビューとグラデーション表示
6. 週ビュー
7. 週・月単位のざっくり予定
8. 正確な時刻と終日予定
9. 編集、削除、精度変更
10. MVP安定化

各タスクは個別Issueとし、`develop`から作業ブランチを作成して、原則1タスク1PRで`develop`へ統合する。

## 15. 成功条件

- アカウント登録なしで利用開始できる。
- 標準時間表現を使った予定を数秒で登録できる。
- 予定がアプリ再起動後も端末内に残る。
- 日、週、月ビューで曖昧さをラベルと視覚表現から理解できる。
- 予定の編集、削除、精度変更ができる。
- 正確な時刻、終日、ざっくり予定を同じカレンダーで扱える。
- UI変更が時間計算やSQLite実装の書き換えを要求しない。
- 予定本文を外部へ送信しない。
- lint、typecheck、全自動テストが成功する。
