# 時間表現設定の実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 時間表現23種類と終了未定の表示時間を編集し、保存済み予定・未来通知へ安全に反映する。

**Architecture:** 定義編集domain、SQLiteの原子的command、設定featureのdraftと画面に分ける。既存の予定保存とカレンダー読み込みにも競合・snapshot境界を追加する。

**Tech Stack:** Expo SDK 57 / React Native / TypeScript / SQLite / date-fns / Jest。新規依存なし。

**Spec:** `docs/superpowers/specs/2026-11-13-temporal-preferences-design.md`

## Global Constraints

- ぼかしは5ポイント刻み、各0〜100%、合計100%以下。既存値は勝手に丸めない。
- 未定の表示時間は1〜1440分、既定120分。実終了・通知基準は生成しない。
- 元のperiodAnchorDate・referenceDate・parameterSnapshotを維持する。
- 時間表現の保存と相対予定更新・通知revisionは同一transaction。
- UI共有物は`src/shared/components`、業務計算はdomain、永続化はSQLite。
- 日本語テスト・コメント、44pt、読み上げ、ライト/ダーク、Reduce Motionを維持。

## Review Focus

- 確認シート表示中に別の保存が入った場合、無言で上書きしない（Task 2）。
- 既存の休日調整済み今週中にフェードだけ変更しても期間が変わらない（Task 1/2）。
- 日跨ぎの定義変更でも繰り返しidentity・個別例外を維持（Task 2/3）。
- 古い予定draftが変更前の日付を戻さない（Task 3）。
- 画面離脱後の非同期完了や保存連打で他画面を閉じない（Task 4）。

## Task 1: 定義編集domain

**Files:** `src/domain/temporal/temporal-preferences.ts`と同階層のテスト。

**Interfaces:** `TemporalDefinitionPatch`（resolverConfig/fadeInRatio/fadeOutRatio）、`applyTemporalPatch(definition, patch)`、`reResolveTemporalEvent(event, definition)`、`temporalDefinitionToken(definition)`、未定時間のvalidation/default。

- [x] 先に日跨ぎ・24時間・不正な種類変更、週・月末丸め、期間offset二重適用防止、snapshot維持、非刻みフェードのテストを書く。
- [x] `npm test -- --runInBand temporal-preferences`を実行し未実装によるFAILを確認する。
- [x] 既存parserとdate-fns境界を再利用して最小実装する。フェードのみならイベント日付を変更しない。
- [x] 同じコマンドでPASSを確認し、`feat(temporal): 時間表現の編集と再解決を追加`としてcommit。

## Task 2: SQLite commandと設定保存

**Files:** `temporal-definition-repository.ts`、`settings-repository.ts`、`repositories.ts`、関連Repositoryテスト。

**Interfaces:** `TemporalDefinitionRepository.listEditable(calendarId)` / `previewUpdate(id, patch)` / `updateDefinition({id, patch, token, now})`。previewは定義内容＋全予定mutationを表す通知desired_revisionのtokenと参照件数を返す。`SettingsRepository.setUndeterminedFadeMinutes`追加。

- [x] preview・保存・古いtoken拒否・全件検証後だけ更新・通知revision・transaction callback接続・無変更/フェードのみ・fallbackのテストを追加する。
- [x] 対象テストを実行しFAILを確認する。
- [x] transaction内で定義と参照予定を読み、Task 1の更新計画を適用する。tokenは最新定義の直列化＋通知desired_revisionを使い、独立した履歴tableは作らない。通知時刻が変わる範囲変更のみ通知revisionを増やす。
- [x] PASSを確認し、`feat(storage): 時間表現を予定と原子的に更新`としてcommit。

## Task 3: カレンダーsnapshotと予定編集競合

**Files:** `event-repository.ts`、`repositories.ts`、`calendar-snapshot.ts`、`use-event-editor.ts`、関連テスト・test double。

**Interfaces:** `EventRepository.readTemporalSchedule(calendarId, from, through)`はschedule/definitions/undeterminedFadeMinutesを一貫したtransactionで返す。予定create/update/例外保存/シリーズ変更には任意の期待定義tokenを渡す（既存呼び出しとの互換性を保持）。

- [x] 一貫したsnapshot、定義変更後のcreate/update・例外保存の拒否、タイトル等を保持した最新定義の再読み込み、個別例外identity維持のテストを先行追加する。
- [x] 対象テストFAILを確認する。
- [x] SQLiteは保存transaction内で定義を再照合する。featureは競合を専用エラーとして受け、draftの本文は残し定義・既存相対予定の期間を再読み込み、再確認を求める。カレンダーは新snapshot APIへ切り替える。
- [x] 既存テストとともにPASSを確認し、`fix(calendar): 定義編集と予定保存の競合を防止`としてcommit。

## Task 4: 設定画面・draft・プレビュー

**Files:** `src/features/settings/temporal-preferences-model.ts`、hooks/components/screens、`src/app/settings/temporal/`、`settings-screen.tsx`、root layout、関連テスト。

**Interfaces:** hookへRepositoryとonSavedを注入。一覧/単項目draft/preview確認/保存/初期値復元/破棄確認はfeature内。routerは配線のみ。

- [x] UIを触る前に分類・時刻表現・draft未保存・restore・失敗保持・競合・unmount・連打抑止・全resolverの操作・読み上げのテストを作る。
- [x] 対象テストFAILを確認する。
- [x] 共有選択シートと時間・分ドラムロールを利用する。日跨ぎは明示選択、週/月は種類ごとの入力、フェードは増減ボタンと既存stop計算のプレビュー。保存確認はタイトルを含めず差分と参照レコード数を表示する。
- [x] 一覧はfocus時に再読み込み。離脱確認は既存routerのbeforeRemove境界を使い、保存中の離脱を抑止する。成功時だけrefreshし、失敗時はdraftと前の表示を保持する。
- [x] 全対象テストPASSを確認し、`feat(settings): 時間表現の範囲とぼかしを編集`としてcommit。

## Task 5: 全体検証・文書・PR

**Files:** README、DB仕様、関連設計書、検証記録。

- [x] 実装済み/未実装/実機未確認を分けて記載する。設計との差分があれば同時更新する。
- [x] typecheck / lint / 全Jest / diff check / iOSとAndroid exportを実行し結果を記録する。
- [x] 全差分を独立レビューへ渡し、重要指摘を再現テスト→修正→全体検証で対応する。
- [ ] 通常Open PRをdevelopへ作成。日本語本文に目的・設計・検証・実機確認項目と`Closes #60`を記載する。Botの再レビューを待たず完了報告する。

## 実行記録

- 2026-11-13: 実装開始前。SDK 57 SQLite/Router公式資料を確認。既存worktreeを継続利用し、担当内で実装後に一度の独立レビューを行う。

- 実行: Task 2と3のSQLite保存guard・snapshot基盤を同じ意味単位のcommitへまとめ、続いてfeatureへの接続を検証した。機能範囲の変更なし。
- 検証途中のJest絞り込みは、worktree名にも一致するため`--runTestsByPath`へ変更した。

- 最終検証: typecheck/lint、全884 tests、専用TZのDST 2 tests、iOS/Android export成功。独立レビューのP2プレビュー指摘は3 testsのRED→GREENで対応。実機未確認は検証記録へ明記した。
