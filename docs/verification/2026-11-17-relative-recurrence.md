# 週・月の意味を保つ繰り返しの検証記録

## 対象

Issue #61。週8種類・月6種類の相対表現を毎週・毎月・任意間隔で繰り返すV2モデル、保存・表示・例外・シリーズ変更・通知・定義設定への接続。

設計: `docs/superpowers/specs/2026-11-17-relative-recurrence-design.md`。実装計画: `docs/superpowers/plans/2026-11-17-relative-recurrence.md`。

## 自動検証

- `npm run typecheck`: 成功。
- `npm run lint`: 成功、警告なし。
- `npm test -- --runInBand`: 109 suites・942 tests成功。既存のTZ条件付き1 suite・2 testsは通常環境でskip。
- `TZ=America/New_York npx jest --runInBand --runTestsByPath src/domain/notifications/__tests__/dst.test.ts src/domain/calendar/__tests__/relative-recurrence.test.ts`: 2 suites・26 tests成功。通常環境でskipしたDST 2 testsを含む。
- `git diff --check`: 成功。
- `npx expo export --platform ios --output-dir /tmp/zakkuri-relative-final-ios --clear`: 成功。
- `npx expo export --platform android --output-dir /tmp/zakkuri-relative-final-android`: 成功。

両exportは既存の書式付きメモ用DOM bundleを含む。新しいnative依存・schema migrationは追加していない。schema version 7の既存JSON列へV2を保存し、既存のV1・単発を自動変換しない。

## 主な回帰確認

- 全14定義の初回と未来回、来週／来月offsetを初回だけ適用、部分週から次回の月曜開始、月末5日間・閏年・年跨ぎ・大きい間隔と日付上限。
- 回数／最終対象期間、削除回を補充しないこと、遠方へ移動した例外の取得を有限に行うこと。
- 月曜／月初のidentityと実際の表示開始日の区別、単回のmetadata・temporal override、分割・全体変更・残回数・意味変更時のリセット。
- 休日調整不能・祝日情報未対応時の元締切と警告、単発化・再繰り返しでのpolicy保存、現在の表示用祝日設定と保存済みpolicyの分離。
- 実SQLiteのV2再接続・例外保存・分割rollback・不正V2の拒否・既存V1互換。旧V1の不正JSONに対する既存fallbackは維持し、未知versionはV1へ読み替えない。
- #60の範囲変更に対する初回・未来回の再解決、identityと既存例外維持、フェードだけの変更で締切を変えないこと。
- 予定保存時に変更元・変更先の定義tokenとシリーズrevisionを検証し、実期間が同じでも古いdraftを拒否すること。再読み込みで入力本文を保持すること。
- 同じ解決環境をカレンダー・通知へ渡すこと、警告ラベル・通知fingerprintと安定した開催identity。
- 週／月作成、単発からの変換、終了対象再選択、タブ・定義往復のdraft保持、初回と次2回のプレビュー、変更範囲確認。

## 独立レビューと修正

実装head `516bf52`を対象とする独立レビューでImportant 4件を再現した。修正前のdomain／hookテストで11件の失敗、範囲選択UIで1件の失敗を確認し、修正後に全体942件の成功を確認した。

1. 初回の「来週／来月」の間隔変更・単発化で前の期間へ戻る問題を、解決済み期間の維持で修正。保存済み祝日結果と現在のProvider結果が異なる場合の単発化も再計算しない。
2. 日時だけの単回変更と繰り返し規則編集を分離。月末→月初・月→週・きっちりへの単回変更、異なる単位の既存例外の再編集を可能にした。単回にはシリーズ例外リセットの警告を表示しない。
3. 保存済み月単発へカスタム繰り返しを加える場合、入力の単位を定義へ合わせるよう修正。
4. ざっくり／きっちりのタブ往復だけで保存済み締切snapshotを現在設定へ置換しないよう修正。

Minorの保留指摘はない。実機の描画・アクセシビリティ・OS通知・native buildはレビュー対象外とし、次項の未確認事項として明示する。自動検証をそれらの証拠へ読み替えない。

## 実機未確認

native build・端末操作・通知の実発火は今回実行していない。export成功はそれらの成功を示さない。

- iOS／Androidの小画面・文字拡大・ライト／ダークでの繰り返し条件、プレビュー、リセット確認の見え方。
- VoiceOver／TalkBackでの条件選択・日付picker・要確認理由・保存・取消の読み上げと操作。
- 来週／来月・月末を登録し、再起動して1日／2日／週／月ビューで同じ開催を開けること。
- 月末→月初、週↔月、きっちりへの単回変更、個別例外の再編集、各変更範囲での実際の操作感。
- 時間表現設定変更後の表示更新、通知の再予約・タップ先・要確認文面・実発火。権限・集中モード・省電力設定の影響。

## 参照した公式資料

- [Expo SDK 57 SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/): 既存transaction境界を維持する。
- [Expo SDK 57のDateTimePicker型定義](https://github.com/expo/expo/blob/sdk-57/packages/expo-ui/src/community/datetime-picker/types.tsx): 既存NativeDateTimePickerで使用するcallbackとpresentation等を確認。追加依存はない。
