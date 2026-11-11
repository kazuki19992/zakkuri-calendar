# 正確な予定の初期長設定 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** #57の承認済み設計を実装し、既定長の設定・互換保存・新規draftへの一度だけの適用・終了種別の編集を提供する。

**Architecture:** domainに初期値と候補の正本、SQLite側に保存形式の互換parse、featureに設定hook・終了draftの純粋関数と非同期初期化hookを置く。既存editor全体は書き換えず、設定と初期化を小さな境界へ分離する。

**Tech Stack:** Expo SDK 57、TypeScript、React Native、既存SingleSelectSheet、SQLite、Jest。新しい依存なし。

**Spec:** `docs/superpowers/specs/2026-11-12-default-exact-duration-design.md`（2026-11-12ユーザー承認済み）。

## 制約と重点確認

- schema version 6のまま、旧seedを変更せず、同じ設定キーへversion 1 envelopeを保存する。
- 旧instantのみ初期値1時間と解釈。明示instant・旧任意固定長・既存予定を保持する。
- 新規・終了未指定にだけ一度適用。既存編集と明示終了を優先し、読込失敗は該当exact入力／保存だけを止める。
- 長さなし／未定の保存に隠れた終了値を使用しない。日付の固定ミリ秒加算は禁止。
- Reduce Motion、読み上げ状態、文字拡大、失敗時の入力保持を既存UIへ合わせる。

## Task 1: 既定長の正本と保存

対象: `src/domain/calendar/default-exact-duration.ts`、`src/data/sqlite/settings-repository.ts`、関連Repository・実SQLiteテスト。

- [x] 欠損・旧instant・旧fixed・旧undetermined・envelope全種別・未知version・不正値と保存形式のテストを先に追加し、失敗を確認する。
- [x] 既定60分と6候補、同値判定・表示の境界を追加。RepositoryはJSON互換解釈を内部に閉じ、parameter付き1行UPSERTにする。
- [x] 実SQLiteで旧versionからの移行・close/reopen・seed再実行・保存失敗後の保持と既存予定不変を確認する。
- [x] focused tests→typecheck/lint/全suiteを実行し、意味のまとまったcommitを作る。

## Task 2: 設定画面

対象: `features/settings/hooks/use-default-exact-duration-settings.ts`、設定固有の表示model・section、settings route／screenとテスト。

- [x] 非同期読込、保存成功後確定、失敗保持、再試行、二重操作、unmount、候補外固定長と6候補UIをテストし、失敗を確認する。
- [x] hookと設定節を追加し、SingleSelectSheetを使う。他の設定の操作を巻き込まない。
- [x] focused testsと全suiteを確認してcommitする。

## Task 3: editor初期化・終了指定と最終検証

対象: `features/events/exact-duration-draft.ts`、`hooks/use-new-event-duration.ts`、`hooks/use-event-editor.ts`、日時fields／screen、新規route、各テスト、READMEと仕様・検証記録。

- [ ] 設定→初期draft、明示終了優先、深夜／月年跨ぎ、全duration種別、失敗範囲、再試行、タブ／終日、既存編集、終了切替の失敗テストを追加する。
- [ ] routeの固定+60を外し、終了の有無をhookへ渡す。小さな純粋関数と非同期hookで初期化し、編集可能になる前にsnapshotを確定する。
- [ ] editorに終了種別とretryを配線する。保存時は種別に従い、fixed復帰では最後の有効分数を現在の開始から解決する。
- [ ] 承認済み仕様とREADME・元MVP・後続editor・#54記録を実装へ合わせる。
- [ ] typecheck／lint／全Jest／diff-check、iOS／Android exportを実行する。
- [ ] fresh-context reviewerで差分全体を確認し、重要な指摘をRED→GREENで修正する。
- [ ] commit／push、develop宛て通常PR（Closes #57）作成・添付。#1／#54の実装状況を更新し、端末未確認を完了扱いにしない。

## 共有境界と実行記録

- Task 1→2/3: `DEFAULT_EXACT_DURATION`はfixed 60、`ExactDuration`の既存型を維持。Repository API署名も維持する。
- Task 2→3: 設定保存は将来の新規フォームだけに反映。calendar refreshや現在のeditorを更新する通知は不要。
- 新規hook入力は`initial.endTime?: string`とし、値がある場合は明示終了として既定長を読まない。既存呼出し・テストの終了指定を保つ。
- Base develop: `5337af30bd1490e405b530a57d8f75a615582ba6`、設計commit: `ac952a1`。worktreeはclean、origin/developに追加commitなし。

- Task 1完了: 互換性テスト13件のうち10件が期待どおり失敗→修正後SQLite 9 suites/129 tests成功。typecheck/lint成功、全78 suites/740 tests成功。

- Task 2完了: hook/UIの未実装失敗→設定7 suites/17 tests成功。選択済みaccessibilityLabelを既存共通UIの仕様に合わせて検証。typecheck/lint成功、全80 suites/746 tests成功。
