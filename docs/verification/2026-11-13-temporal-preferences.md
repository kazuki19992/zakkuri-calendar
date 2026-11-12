# 時間表現設定の検証記録

## 対象

Issue #60。時間表現23種類の日・週・月の範囲とフェード、終了未定の表示時間、保存済み予定への反映と通知整合。

設計は`docs/superpowers/specs/2026-11-13-temporal-preferences-design.md`、実装計画は`docs/superpowers/plans/2026-11-13-temporal-preferences.md`。

## 自動検証

- `npm run typecheck`: 成功。
- `npm run lint`: 成功、警告なし。
- `npm test -- --runInBand`: 104 suites、884 tests成功。既存のタイムゾーン条件付き1 suite・2 testsは通常環境でskip。
- `TZ=America/New_York npx jest --runInBand --runTestsByPath src/domain/notifications/__tests__/dst.test.ts`: 夏時間の欠落・重複に関する2 tests成功。
- `git diff --check`: 成功。
- `npx expo export --platform ios --output-dir /tmp/zakkuri-temporal-export-ios`: 成功。DOMメモエディタのbundleも含む。
- `npx expo export --platform android --output-dir /tmp/zakkuri-temporal-export-android`: 成功。

iOS export初回はMetroのtransform cacheに削除済みの前タスクworktreeパスが残り、既存メモエディタのDOM bundleを解決できなかった。`--clear`で再実行して成功し、その後は通常のexportも成功した。対処のためのソース変更や依存追加は行っていない。

## 主な回帰確認

- 日跨ぎ・24時間制限、週・月末・閏年、対象期間offsetを再適用しない再解決、今週中snapshotの維持。
- 実SQLiteでの定義・相対予定・通知revisionのcommit/rollback、確認後の競合拒否、未定設定の不正値fallback。
- カレンダーが予定・定義・未定設定を一貫したsnapshotで取得すること。
- 古い定義からの予定保存の拒否と、入力本文を保持した再読み込み。
- 日跨ぎの定義変更後も繰り返し・削除例外のidentityを維持し、未来通知の時刻が変わること。
- 設定draft、確認前のDB不変、失敗後の再試行、初期値復元、連打抑止、離脱後と対象切り替え後の古い完了結果の無効化。
- 23種類の範囲表示と翌日選択、読み上げ名、ドラムロールの上下限、破棄確認。

独立レビューで、週・月の範囲が1日だけの場合にプレビューだけフェードする点を検出。修正前に3 testsの失敗を確認し、固定7日間を使う描画から、draftの実範囲を解決する描画へ修正。修正後に3 testsと全体884 testsの成功を確認した。日内のプレビューも実際の時間軸のstop計算を共有する。

## 実機未確認

自動検証とexportは、native build・実機動作の成功を示さない。新しいnative依存・migrationは追加していないため、今回development buildは実行していない。

- iOS/Androidの小画面・文字拡大・ライト/ダークでのレイアウト。
- VoiceOver/TalkBackでの増減・選択・保存・エラー・破棄確認。
- 戻るボタン／戻るジェスチャー、ドラムロール、確認ダイアログの操作感。
- 再起動後の設定復元、1日・2日・週・月ビューでの日跨ぎ・月末の見え方。
- 端末通知の権限あり／なしでの再予約・実発火と、OS設定による差。

実機未確認を理由に既存描画・通知仕様を変更しない。実機で差が見つかった場合は再現条件を記録して修正する。

## 参照した公式資料

SQLiteのtransactionとRouterの画面配線は[Expo SDK 57 SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)・[Expo SDK 57 Router](https://docs.expo.dev/versions/v57.0.0/sdk/router/)を確認した。破棄確認はExpo Routerに同梱のnavigation境界を使用し、[戻る操作の抑止に関する公式資料](https://reactnavigation.org/docs/preventing-going-back/)の`usePreventRemove`方式に沿う。
