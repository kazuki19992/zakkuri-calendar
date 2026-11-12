# 端末ローカル通知の検証記録

対象: Issue #59、承認済み`2026-11-12-local-notifications-design.md`。実機の発火は未確認。

## 自動検証

- typecheck、lint、git diff --check: 成功。
- 全Jest: 93 suites / 809 tests成功。夏時間専用2件は通常TZではskipし、別実行で確認。
- `TZ=America/New_York npm test -- --runInBand src/domain/notifications/__tests__/dst.test.ts`: 2件成功。欠落時刻を次の有効時刻へ進め、重複は最初の時刻を選ぶ。
- 実SQLite: 本番のExpo adapterと同じ別接続transactionを使い、schema 7移行、通知のid/分数/順序、FK cascade、revision、設定のnull/fallback/既存予定非遡及を確認。
- 通知計画: 朝/深夜/締切前日、既存の開始基準、移動例外、通知継承と明示空配列、同時刻の統合、期間外開催への先行通知、60件の予算。
- 同期: 読戻し不一致、部分失敗、取消し失敗、同期中編集/削除、権限の再許可、要求の連打、DB読込み失敗時に既存予約を全削除しないこと。
- editor/settings: 初期通知・複数追加/変更/削除・手動空配列、遅延した明示resetが手動編集を上書きしないこと、保存失敗からの再試行、権限の自動要求をしないこと。
- native設定のintrospection: 公式通知pluginのAPNs entitlementをローカル専用wrapperで除き、Androidの正確アラーム宣言を保持すること。
- iOS・Androidの`expo export --clear`: 成功。これはバイナリの署名・実機動作の証拠ではない。

## native build

- iOS: 最初の試行は公式pluginが付ける`aps-environment`と既存AdHoc profileの不一致で失敗。SDKの暗黙plugin適用とmod実行順を調べ、ローカル通知専用wrapperとintrospection回帰テストで対処。最終のbuild結果は後述する。
- Android: `./scripts/build-local.sh development android`は既存app configの`android.package`未設定により非対話モードで停止。package IDや署名の新規登録は行っていない。Android APKのcompile・実機発火は未確認。

## 実機で残す確認

- 許可/拒否/再許可、iOSの静かな通知、Android channelと正確アラーム許可有無。
- 保存後の複数通知の発火、変更・削除・個別例外・シリーズ分割後の取消し。
- foreground/background/終了状態からの表示とタップ、削除・移動した予定の表示。
- 長期間開かない場合の予約消費と補充、再起動、時計/タイムゾーン変更、集中モード・省電力・音の設定。
- 新しい設定行と日数/時分pickerの明暗テーマ、文字拡大、VoiceOver/TalkBack、タップ領域、モーダル切替。

#54の確認済みチェックはこの自動検証だけで増やさない。
