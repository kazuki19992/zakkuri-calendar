# MVPコア体験の安定化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** #54のうちコードで再現できる保存・移行の検証を補強し、#1の実装状況と端末確認の残件を証拠付きで管理する。

**Architecture:** 既存のAppDatabase契約へテスト専用のNode SQLite adapterを接続し、本番migrationとRepositoryを実SQLで検証する。アプリの依存・schema・UIは検証で不具合が再現した場合のみ変更する。

**Tech Stack:** Expo SDK 57、TypeScript、Jest、Node.js 22.18以降のnode:sqlite（開発テスト専用、runtime依存追加なし。@types/nodeをdevDependencyとして明示）。

**Spec:** GitHub #54、#1、`docs/superpowers/specs/2026-09-07-zakkuri-calendar-mvp-design.md` と承認済み後続設計。

## 制約とレビュー観点

- 合成データと一時DBだけを使用し、個人DBへアクセスしない。
- 自動テスト・export・シミュレータ・実機の証拠を区別する。端末未確認を完了にしない。
- 旧schemaからの更新、途中失敗後の再試行、保存集約の部分更新、再接続、外部キーを重点確認する。
- #54は実機受け入れ条件が残る間openを維持する。#1も部分完了を明示する。

## Task 1: 実SQLite回帰テスト

対象: `src/test/node-sqlite-database.ts`、`src/data/sqlite/__tests__/sqlite-integration.test.ts`、`src/test/fixtures/sqlite-legacy-schema.ts`。

- [x] 初期化・seed再実行・close/reopen、予定／通知／メモ／設定保存、繰り返し例外、外部キーとrollbackの期待値をテストに記述する。
- [x] adapter未実装による失敗を確認し、AppDatabaseを実SQLiteへ接続する最小実装を追加する。
- [x] 過去のschema構造を独立fixtureとして用意し、version 1〜5の保存済みデータが最新へ移行することを検証する。
- [x] migration途中失敗の全体rollbackと再試行、Repositoryの通知書込み失敗による予定・通知の復旧を確認する。
- [x] 不具合が再現した場合は失敗テストを先に追加し、必要最小限の修正を行う。

## Task 2: 証拠一覧とIssue更新

対象: `docs/verification/2026-11-12-mvp-stabilization.md`、README、GitHub #1/#54。

- [x] #1各項目を実装・関連設計／PR・テストに対応付け、完了条件の証拠を記録する。
- [x] #54の全受け入れ条件の自動検証範囲と端末確認手順、未確認理由を記録する。
- [x] typecheck、lint、全Jest、diff checkを実行する。今回native/UI変更がなければbuild/exportの再実行は必須とせず、過去結果と区別する。
- [x] fresh-context reviewerで差分を確認し、重要な問題を修正して再検証する。
- [x] commit/push、develop向けPR作成。最新Issue本文を再取得して変更を保全し、確認できた#1の項目だけチェックする。#54へ結果と残件を追記する。

## 実行記録

- Base: `7a58910e3bc4fe5acba2b2b6c7ff7d858ab60f7f`。専用worktree作成済み。
- Node v22.18.0。iOS simulatorは利用可能（未起動）、adb接続端末なし。これだけでは実機検証済みとしない。
- `.env.local`: 元リポジトリ・worktreeともになし。

- Task 1完了: helper未実装でテスト失敗を確認後、adapterを追加。初回4件→旧移行等を含む12件成功。全体77 suites / 725 tests成功。
- adapter初期版の未使用引数エラーはNodeとExpoの差。Expo 57のiOS/Androidソースでindex=0を無視することを確認し、テストadapterを合わせた。アプリの不具合として扱わない。
- Task 2完了: fresh reviewの指摘を修正し、PR #56を作成。#1は確認済みの項目をチェックし、#54は証拠表と残件を追記してopen継続。#55は修正済み・PR未マージを明示。
- 既定長についてMVPと後続設計の差を発見。独断で変更せずユーザーへ質問し、今回の検証で既定長設定UIを実装済みとは扱わない。

- 最終review指摘: 同一接続のテストがExpoの新規接続におけるFK OFFを隠す問題を採用。別接続＋FK OFF＋本番adapter経由で2件の失敗を再現後、専用接続へBEGIN前のFK設定を実装。unitもRED→GREEN、全77 suites / 727 tests成功。#55へ再現・完了条件を記録。
- typecheck成功、lint警告なし、iOS/Android export成功。native build・端末操作は未実施。
