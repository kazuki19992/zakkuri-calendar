# MVP安定化の検証記録（#54）

確認日: 2026-11-12（JST）。関連: [親Issue #1](https://github.com/kazuki19992/zakkuri-calendar/issues/1)、[安定化 #54](https://github.com/kazuki19992/zakkuri-calendar/issues/54)。

## 確認対象と証拠の区分

- 統合済みの基準commit: `7a58910e3bc4fe5acba2b2b6c7ff7d858ab60f7f`（PR #53）。検証対象コードcommit: `81eeb183d32e3d3d7bc61139e4955b0872db1410`（[PR #56](https://github.com/kazuki19992/zakkuri-calendar/pull/56)）。以降は文書のみ更新。
- 自動検証環境: macOS、Node.js v22.18.0、lockfileによる依存install。テストDBは一時ディレクトリの合成データだけで、端末の個人DBは使用していない。
- 今回の追加: 実SQLiteによる12件の統合テスト。本番DBアダプターの専用接続で外部キー設定を引き継ぐ修正（#55）を含む。UI・schema・native依存は変更していない。
- 今回の実行結果: typecheck成功、lint成功（警告なし）、Jest **77 suites / 727 tests成功**、`git diff --check`成功。
- iOS／Android exportはDBアダプター修正後に両方成功。native development buildと端末操作は未実施で、exportとは区別する。
- 端末／OS／アプリbuild: **未確認・対象buildなし**。iOS simulator runtimeは利用可能だが未起動。adb接続端末はなし。シミュレータや実機の操作、VoiceOver／TalkBackの検証は実施していない。

本記録の「自動確認済み」はテストの期待値が満たされたことを表す。「実装済み」はコードとマージ済みPRの照合結果であり、見た目・操作感・実機での受け入れ完了を意味しない。#54と#1のMVP全体は未完了として維持する。

## #1のタスクと証拠

| #1項目 | 実装・設計／マージ済みPR | 自動検証の主な入口（srcからの相対パス） | 判定・残件 |
| --- | --- | --- | --- |
| 1 UX・技術設計 | MVP設計、後続設計、PR #4 | `domain/temporal/__tests__`、`domain/calendar/__tests__` | 設計作業は完了。既定長の旧設計との違いは下記参照 |
| 2 テスト／ローカルDB | PR #7、#29、#34、#35、#47 | `data/sqlite/__tests__`、今回の`sqlite-integration.test.ts` | 実装・自動確認済み。native接続は別確認 |
| 3 シェル／月 | PR #11、#23、#44、#51 | `features/calendar/hooks/__tests__/use-calendar-view.test.tsx`、`components/__tests__/month-calendar-components.test.tsx` | 実装・主要操作自動確認済み。選択日の一覧は後続設計により1日表示へ切替 |
| 4 ざっくりクイック作成 | PR #14、#22、#30 | `features/events/hooks/__tests__/use-quick-create-event.test.tsx`、`use-event-editor.test.tsx` | 入力・保存・再取得は自動確認済み。「数秒」の体験は未確認 |
| 5 日／グラデーション | PR #19、#21、#27、#43、#47、#51 | `features/calendar/__tests__/date-range-gradient.test.ts`、`timeline-layout.test.ts`、`two-day-view-model.test.ts` | 実装・計算／ラベル自動確認済み。重複の可読性・読み上げ未確認 |
| 6 週 | PR #53 | `features/calendar/__tests__/week-view-layout.test.ts`、`hooks/__tests__/use-calendar-view.test.tsx`、`components/__tests__/week-day-header.test.tsx` | 実装・7日移動／密集配置自動確認済み。小画面未確認 |
| 7 週／月のざっくり | PR #33、#47、#49 | `domain/temporal/__tests__/relative-date-resolution.test.ts`、`features/events/hooks/__tests__/use-event-editor.test.tsx` | 実装・月年境界／期間保存／表示モデル自動確認済み |
| 8 正確／終日 | PR #22、#29、#30 | `domain/calendar/__tests__/event.test.ts`、`features/events/hooks/__tests__/use-event-editor.test.tsx`、各ビューmodel | 実装・自動確認済み。実機操作は#54に残る |
| 9 編集／削除／精度 | PR #22、#30、#34 | `features/events/screens/__tests__/event-editor-screen.test.tsx`、`hooks/__tests__/use-event-editor.test.tsx` | 実装・保存／削除確認／切替の自動確認済み。実機操作は#54に残る |
| 10 安定化 | 本PR、#54 | 全77 suitesと下記手順 | DB・入力・主要操作は自動確認済み。両OSの受け入れは未完了 |

各PRは`https://github.com/kazuki19992/zakkuri-calendar/pull/<番号>`で追跡できる。Issueのチェックは実装作業と自動検証の完了を反映し、数秒の登録・実機レイアウト・理解しやすさは未チェックで残す。

## #1のMVP完了条件

| 条件 | 今回までの証拠 | 状態 |
| --- | --- | --- |
| 初回アカウント登録なし | `src/app/_layout.tsx`と`AppDatabaseProvider`でローカル初期化。認証導線なし | 実装済み／fresh installの端末操作未確認 |
| 数秒で登録 | 作成hookの必須入力・二重保存防止・失敗後retryテスト | 実装済み／実測未確認 |
| 再起動後の端末内保存 | 実DBファイルをclose/reopenして予定・通知・メモ・設定を復元 | 自動確認済み／アプリkill・再起動は未確認 |
| 曖昧さを理解できる | 各view model、グラデーション、ラベルのテスト | 実装済み／ユーザーの理解・実機視認性未確認 |
| 編集・削除・精度変更 | editor hook／screen、Repositoryテスト | コード・自動確認済み |
| exact・終日・fuzzyの同居 | 各view modelと実DB保存のテスト | コード・自動確認済み |
| 予定本文を外部送信しない | `src`の通信・ログ経路を確認。アップロード／分析／クラウド送信なし。メモのURLは利用者操作で外部browserを開く | 現在のアプリコード確認済み。native通信をキャプチャした証拠ではない |
| lint／typecheck／test成功 | 本PRの検証結果 | 自動確認済み |

## 追加した実SQLiteテスト

`src/data/sqlite/__tests__/sqlite-integration.test.ts`を通常の`npm test -- --runInBand`で実行する。

- 初回migrationとseed再実行で重複せず、利用者が変更した値を保持する。`foreign_key_check`と`integrity_check`も確認する。
- ファイル接続を閉じて開き直し、年跨ぎの正確な予定、書式・リンク・チェックリスト、通知、最後のタブ・ビュー、週開始、表示設定を復元する。編集と削除後の通知除去も確認する。
- `RAISE(ABORT, ...)`の合成triggerで通知保存を失敗させ、元の予定と通知へrollbackし、trigger解除後のretryを確認する。
- 存在しないカレンダーへの予定保存が外部キーで拒否され、予定が残らないことを確認する。
- 過去commitから固定したversion 1〜5のDDLで旧DBを作成し、exact／終日／fuzzy、旧プレーンテキスト／文書メモ、通知、既存個別例外を保持して最新へ移行する。version 6の今週中フェード更新も確認する。
- migrationの途中を失敗させ、DDL・履歴をrollbackし、外部キーを再有効化してretryできることを確認する。
- 繰り返しの個別置換を保存・再接続・発生回展開し、シリーズ削除時に置換予定と通知も除去する。
- 日内／週／月のざっくり・終日の保存と、締切曜日／祝日設定変更後も保存済み期間・contextが不変であることを確認する。

Node SQLiteは実際のSQLエンジンであるが、Expoのnative接続、スレッド・同時書込み、端末ファイルシステムの保証にはならない。Node bridgeはテスト専用でアプリからimportしない。本番のcreateExpoDatabaseAdapterを使用し、元接続とtransaction接続を分離、各接続のFK初期値をOFFとしている。Expo 57のnative実装に合わせて未使用の名前付き引数を無視する。

公式資料: [Expo SDK 57 SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)、[Node 22.18 SQLite](https://nodejs.org/download/release/v22.18.0/docs/api/sqlite.html)。

## #54全受け入れ条件の残件

| #54の順番 | 自動検証／記録 | 端末で残ること |
| --- | --- | --- |
| 1 親の証拠照合 | 上の対応表 | 確認結果が入るまで端末欄は未確認 |
| 2 初回／作成編集削除 | editor／quick-create／DB | fresh install、各種作成・精度切替・cancel |
| 3 ビュー／連続操作 | view、carousel、gesture session、editor hook | pinch／swipe／double tapの複合操作 |
| 4 境界／密集表示 | 日月年境界、layout／gradient／holiday model | 文字欠け・重なり・全件到達 |
| 5 再起動／設定／offline | 実DBのclose/reopen・context不変 | アプリ再起動・機内モード |
| 6 DB移行 | 旧version 1〜5／初回／再実行／rollback成功 | Expo native接続での移行smoke |
| 7 例外／メモ | Repository、発生回、editor draft、メモ変換 | WebViewで書式／リンク／チェック操作 |
| 8 失敗／空／非同期 | trigger失敗注入、既存hookのstale応答・retry | native表示・操作の復旧確認 |
| 9 両OSアクセシビリティ | ラベル、状態、Reduce Motion分岐の既存テスト | 両OS、小画面、文字拡大、読み上げ |
| 10 検証記録 | 本記録。未確認は成功にしない | 下記テンプレートへの端末結果記入 |
| 11 全体検証／不具合追跡 | 77 suites／727 tests、typecheck／lint／diff | DB adapterを修正。両OS export成功、native build未実施 |
| 12 未確認解消／明示保留 | #1は部分更新する | 保留は未承認。#54はopen継続 |

## 端末確認手順と記入テンプレート

すべて合成予定で行う。移行試験は**専用テストアプリ／専用DB**に限定し、既存の個人DBを削除・上書きしない。実データの入ったアプリのuninstallを手順に含めない。

各行をiOS／Androidそれぞれで実行し、端末名・OS・build識別子・対象commit・確認日時・手順番号・期待結果・実結果・成功／不具合／未確認と理由を記録する。スクリーンショットやログへ個人予定を含めない。

| 手順 | 操作と期待結果 | iOS | Android |
| --- | --- | --- | --- |
| M1 | 新規テスト環境で起動。認証なしで今日を表示。タイトル＋朝／今週中／月末、exact、終日、複数日を保存。登録所要時間を記録 | 未確認 | 未確認 |
| M2 | 編集、ざっくり⇔きっちり、cancel、確認後削除。二重タップでも二重保存・削除なし | 未確認 | 未確認 |
| M3 | 1日／2日／週／月、前後・今日・picker・menu、日付／他N件を操作。pinch直後のswipe／double tapで意図しない作成・移動なし | 未確認 | 未確認 |
| M4 | 12/31〜1/2、月末・深夜、同時刻5件、終日10件、今週中・月末を表示。色・フェード・祝日・優先順を確認し1日で全件へ到達 | 未確認 | 未確認 |
| M5 | 毎週予定のこの予定／これ以降／すべてを変更し、個別例外のidentityを保つ。メモ書式・チェック・リンク、完了後cancelで未保存内容がDBへ漏れない | 未確認 | 未確認 |
| M6 | 機内モードで保存しアプリを終了・再起動。予定・通知設定・メモ・表示設定を復元。締切・週開始・祝日変更で既存相対日付が変わらない | 未確認 | 未確認 |
| M7 | 小画面、最大文字、明暗テーマ、VoiceOver／TalkBack、Reduce Motion。全操作へ到達、週の省略件数と見出しscrollを確認 | 未確認 | 未確認 |
| M8 | iOS長押しプレビュー→確定→メイン1日表示。余分な戻る履歴なし。Androidは通常tapの到達確認 | 未確認 | 未確認 |
| M9 | 専用nativeテスト環境の旧DB移行／再実行、合成失敗の復旧。SQLiteの保持と再試行を確認 | 未確認 | 未確認 |

## 仕様照合で見つかった確認事項

MVP設計5.4には「正確な予定のデフォルト長設定、初期値は瞬間」が残っている。一方、後続の承認済み`2026-09-10-event-editor-and-add-flows-design.md`は新規exactを1時間とし、現コードもそれに従う。Repositoryに既定長の保存APIはあるが、設定UI・新規editorへの適用はない。今回この仕様差を推測で変更しない。ユーザーへ提示済みで、取り扱いを確認して追跡する。MVPの完全完了を示す証拠には含めない。

## 発見・修正した不具合（#55）

Expo 57の標準排他transactionは新しい接続を開く。元接続の外部キー設定は引き継がれないため、不整合予定を保存でき、シリーズ削除で例外行が孤立する。最初の同一接続テストはこの差を隠したため、別接続・FK初期値OFF・本番adapter経由へ変更した。その状態で「不整合参照の拒否」「シリーズ削除後の例外除去」の2件が失敗することを確認した。

修正は、元接続のFK状態を読み、同じファイルとopen optionsで専用接続を開き、BEGIN前にFK状態を適用する。専用接続のwithTransactionAsyncでcommit/rollbackし、finallyでcloseする。別接続なので通常接続のSQLをtransactionへ巻き込まない。migration中の意図的なOFFも維持し、schemaを変更せず旧versionからの更新を通す。

修正後、専用接続設定・closeのunitテストと12件の統合テスト、全体77 suites／727 testsが成功した。既存の孤立データを自動削除する処理は含めない。今回の試験は実SQLiteとSDK構造の再現であり、端末native実行の証拠ではない。

## #57 初期長設定の後続対応

初期値1時間と詳細設計のユーザー承認に基づき、設定UI・新規フォームへの一度だけの適用・終了種別を実装した。元MVPと後続editorの仕様差は本設計へ統一し、既存予定は変更しない。旧設定と新形式、DB再接続、設定保存失敗、フォームのタブ／終日・日付跨ぎ・終了種別を自動テストする。最終結果は#57の実装PRに記録する。

追加の端末確認: 各6候補を設定→新規作成→保存→再編集、23:30からの日跨ぎ、開いていたdraftの保持、終了3種別、明暗テーマ・文字拡大・VoiceOver／TalkBack。native build・実機操作は未確認で、M1〜M9は自動完了にしない。

#57の検証対象コード: `6a17e9daefe6239448949164244ae424dd1ba924`（PR #58、未マージ）。83 suites／765 tests、typecheck、lint警告なし、diff-check、iOS／Android export成功。以降は文書のみ更新。native development build・実機操作は未実施。
