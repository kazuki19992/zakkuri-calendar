# 端末ローカル通知 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保存済みの複数通知をiOS/Androidへ予約し、予定変更・削除・繰り返し例外へ追随させる。

**Architecture:** domainの判別unionと純粋な開催別通知計画を正にする。SQLiteの一括snapshot/revisionとOSの予約実体を単一coordinatorで照合し、featureは表示用状態と操作だけを扱う。

**Tech Stack:** Expo SDK 57、React Native、date-fns、expo-sqlite、expo-notifications、expo-intent-launcher、Jest/RNTL。

**Spec:** docs/superpowers/specs/2026-11-12-local-notifications-design.md

## Global Constraints

- 通常PRのbaseはdevelop。既存のcodex/local-notifications-designを使う。
- 初期値はexact開始10分前、終日開始日9:00、日内fuzzy終了60分前、週/月fuzzy終了日前日9:00。
- 既定値は新規draftだけ。保存前はインメモリ。通知なしと未初期化を分ける。
- 旧通知は開始基準で元の値を保持。近い60件・366暦日以内を単発予約。
- UIの共通部品はsrc/shared/components。予定情報をログや外部サービスへ送らない。
- テスト名・コメントは日本語。外部型をdomainへ漏らさず、OS発火と自動検証を分ける。

## Review Focus

- 同期中に予定が削除・再編集された場合、古いsnapshotで成功を確定しない（Task 3）。
- 期間後の開催に対する早い通知、期間前に開始した長期予定の終了通知を落とさない（Task 1）。
- 通知を手動で空にしたdraftで、遅延読込みや種別往復によって初期通知が復活しない（Task 4）。
- 明示的な空配列の例外は系列の通知を継承しない（Task 2/3）。
- DB保存とOS予約の失敗を混同せず、cold startのタップをDB/router準備後に一度だけ処理する（Task 3/5）。

---

### Task 1: 通知の型・既定値・開催別計画

**Files:** domain/calendar/event-reminder.ts、domain/notifications/{reminder-timing,notification-plan,ports}.ts、domain/calendar/recurrence-change.ts、対応する__tests__。

**Interfaces:** `ReminderTiming`はversion 1のrelativeMinutes/relativeDate/legacyStartOffset。`getReminderTiming(reminder)`は旧minutesBefore入力もlegacyへ正規化する互換境界。`planNotifications(snapshot, now)`はrequests/failures/deferredを返す。requestsはidentifier/key/fingerprint/fireAt/title/label/targetを持つ。`NotificationSnapshot`はrevision、events/reminders/definitions/exceptionsを一括で保持する。

- [x] 先に型validation、既定4種、深夜・金曜締切・過去・複数通知重複・60件・年跨ぎ・DST・移動例外・通知日時での期間選別テストを書く。
- [x] `npm test -- --runInBand src/domain/notifications`で未実装によるFAILを確認する。
- [x] union parse/正規化/ラベル/互換性を実装する。既存呼出し互換を境界内に残し、保存される新形式を正本とする。
- [x] date-fnsによるカレンダー日付/壁時計演算と既存開催展開を使い計画する。全通知の先行差・spanで候補範囲を求める。
- [x] 同じコマンドと既存reminder/recurrenceテストがPASSになることを確認する。

### Task 2: SQLite version 7・設定・入力snapshot

**Files:** data/sqlite/{migrations,row-mappers,event-repository,settings-repository,notification-repository,repository-container}.ts、domain/calendar/repositories.ts、対応するDBテスト。

**Interfaces:** `NotificationRepository.readSnapshot(): Promise<NotificationSnapshot>`、`getRevision(): Promise<number>`、`markApplied(revision, now): Promise<boolean>`、`recordFailure(code): Promise<void>`。設定は`getNotificationDefault(category)`/`setNotificationDefault(category,timing|null,updatedAt)`。

- [x] 旧schema6の通知id/値/順序の移行とFK削除、再実行、rollback、4設定のfallback/null、snapshotの明示空通知継承を先にテストする。
- [x] focusedテストでFAILを確認する。
- [x] schema7でtiming_json/timing_keyへ移行し同期singletonを作る。旧分数列のfixtureは旧形式のまま保持する。
- [x] 全event transactionの終了でrevisionを増やす。一括snapshotは同じread transactionからevents/exceptions/reminders/参照定義を取得する。
- [x] 設定4キーは独立し、version付きparse/fallbackをSQLite境界で行う。
- [x] 実SQLiteと既存Repository/mapper/migrationテストをPASSにする。

### Task 3: OS adapterと同期coordinator

**Files:** data/notifications/{notification-device,notification-device.native,notification-device.web}.ts、features/notifications/{notification-coordinator,notification-context}.tsx/ts、対応テスト、package.json/lockfile/app.json。

**Interfaces:** `NotificationDevice`はpermissions/requestPermission/list/schedule/cancel/openSettings/openAlarmSettings/listeners。`NotificationCoordinator`はsubscribe/getState/reconcile/requestPermission。stateはpermission/status/deferred/through/errorを持つ。

- [x] fake OSで差分なし・他機能ID・取消失敗・部分予約・読戻し不一致・同期中編集/削除・拒否/再許可・読込失敗をテストしてFAILを確認する。
- [x] Expo SDK57互換依存をexpo installで追加する。ローカル通知のみ使用しpush tokenは取得しない。
- [x] prefix付き安定identifier、時刻と内容fingerprintの読戻し、DB revisionの照合を実装する。成功は最新snapshotが全件照合できた時だけ。
- [x] 許可拒否では予定を維持し、Webはnative APIを評価しない。Android channelとexact alarm設定への導線を加える。
- [x] focusedテストをPASSにする。

### Task 4: 予定編集と設定UI

**Files:** features/events/{event-editor-model,hooks/use-event-editor,components/event-reminder-editor}.ts(x)、features/settingsのnotification設定hook/section、shared/components/reminder-timing-picker.tsx、関連UIテスト。

**Interfaces:** `ReminderDraft`はidとtiming（旧入力も読込互換）。editorはaddReminder/updateReminder/removeReminderを持つ。共用pickerはvalue/allowedAnchors/kind/onConfirm/onCloseを受け、日数・時分を返す。

- [x] 新規4種初期値、複数追加/変更/削除、手動空配列、遅延応答、タブ往復、互換性エラー、設定null/保存失敗を先にテストしFAILを確認する。
- [x] 未操作の新規draftだけ種別に従う既定通知を適用する。手動編集・既存編集で不適合なら入力保持して保存前に説明する。
- [x] 設定は4行＋権限/予約状態と再試行。共有入力を使い、単一選択にチップを使わない。
- [x] focused hook/UIと既存予定編集テストをPASSにする。

### Task 5: ライフサイクル・タップ・全体検証・PR

**Files:** app/_layout.tsx、features/notifications/provider/responseモデル、README、MVP/予定編集/schema資料、verification記録。

- [x] cold start待機・重複response・削除/分割/移動例外・不正payload・保存成功後の許可案内のテストを書きFAILを確認する。
- [x] DB providerとCalendarRefreshProviderの内側へ通知providerを接続し、保存後/復帰/foreground受信/active中の日付・ゾーン変化で同期する。
- [x] 既存編集routeへ検証済みID/元の開催日で遷移する。任意URLは受け付けない。
- [x] typecheck、lint、全Jest、git diff --check、iOS/Android exportを実行する。
- [x] native development buildは署名・環境が利用可能ならrepository scriptで確認する。未実施と失敗は区別して記録し、実機発火は未確認のまま残す。
- [ ] 独立した最終レビューを1回行い、有効な指摘を修正・再検証する。
- [ ] 日本語Semantic commitで意味単位に保存しpush、develop向け通常PRを作成・attachする。本文にCloses #59、検証、OS制約と実機未確認を記載する。

ユーザーの継続指示により、計画提示後の再承認は求めずinlineで実行し、最後に独立レビューを行う。
