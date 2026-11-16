# 相対期間の繰り返し実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 週・月の14表現を各対象期間へ再適用して繰り返し、例外・分割・保存・通知を整合させる。

**Architecture:** V1を維持してV2の期間identityと解決関数を追加する。定義とHolidayProviderを明示的な解決環境として渡し、同じ結果をRepository・calendar・editor・通知で使う。

**Tech Stack:** Expo SDK 57、TypeScript、date-fns、SQLite、Jest。新規依存・列・table追加なし。

**Spec:** `docs/superpowers/specs/2026-11-17-relative-recurrence-design.md`

## Global Constraints

- V1・recurrence=nullは自動変換しない。schema version 7のJSON境界を拡張する。
- 対象期間identityは週の月曜／月初、表示開始日と区別する。
- 今週中の次回以降は月曜〜保存時の締切。調整不能でも元締切と要確認を残す。
- 締切・休日policyは保存時snapshot、時間表現の範囲とフェードは#60の最新定義を使う。
- 通知予算60件・366暦日、予定保存前のインメモリdraft、44pt・読み上げ・Reduce Motionを維持する。
- 週↔月の変更は変更対象先頭回の表示開始日から新期間を選び、until期間は再指定する。

## Review Focus

- 月初より後の下旬を月初identityから開いても別の日へ移動しない（Task 1/2/3）。
- 休日fallbackを単発化・再繰り返ししても保存条件を失わない（Task 1/4）。
- 定義変更で月初の長さが変わっても例外と通知IDが変わらない（Task 2/3）。
- 曜日設定や祝日表示設定の変更で保存済みシリーズの条件を置換しない（Task 3/4）。
- 単位変更で終了条件を黙って読み替えず、保存前の再確認を必須にする（Task 4）。

## Task 1: V2モデル・期間解決・展開

**Files:** `src/domain/calendar/recurrence.ts`, `event.ts`, `event-occurrence.ts`, `recurrence-exception.ts`; 新規`relative-recurrence.ts`とテスト。

**Interfaces:** `RecurrenceRule = RecurrenceRuleV1 | RelativeRecurrenceRuleV2`。`RelativeRecurrenceEnvironment={definitions: readonly TemporalDefinition[]; holidayProvider?: HolidayProvider}`。`resolveRelativeOccurrence(series,periodDate,environment): CalendarEvent`、`relativeOccurrenceIndex(series,periodDate): number`。`expandEventOccurrences`へoptionalなenvironmentを追加しV1は不要のまま。

- [ ] 初回・月末・閏年・offset一回だけ・identity・終了条件・大きい間隔・fallbackとparserの失敗テストを追加する。
- [ ] `npx jest --runInBand --runTestsByPath src/domain/calendar/__tests__/relative-recurrence.test.ts`で未実装によるFAILを確認。
- [ ] V2を追加し、V1計算はversion=1へ狭めて維持する。初回snapshotと以降の再解決を分け、metadataだけの例外は解決済み開催を継承する。
- [ ] 同じテストと既存event-occurrence/recurrenceテストを通す。`feat(recurrence): 週月の意味を保つ発生回を解決`としてcommit。

## Task 2: V2の例外・分割・全体変更

**Files:** `recurrence-change.ts`、新規`relative-recurrence-change.ts`、関連domainテスト。

**Interfaces:** mutation入力へoptional environmentを追加。`buildSeriesScopedAggregate`はV2の解決済み回を用いる。新しいplannerは既存`RecurrenceMutationPlan`を返す。

- [ ] 期間identityでの個別変更、metadata継承、残回数、内容変更時の例外維持、規則変更時のreset、単発化、週↔月の基準を先行テストする。
- [ ] 対象テストFAILを確認後、V2だけ別plannerへ委譲する。V1のday offset／ordinal付け替えをV2へ流用しない。
- [ ] domain全体と既存V1変更テストを通し、`feat(recurrence): 相対期間の例外とシリーズ分割を整合`としてcommit。

## Task 3: SQLite・定義編集・calendar・通知の接続

**Files:** `event-repository.ts`, `repository-container.ts`, `temporal-definition-repository.ts`, `row-mappers.ts`、calendar-snapshot、notification-plan/coordinator/context、実SQLiteテスト。

**Interfaces:** `SqliteEventRepository`へHolidayProviderを注入。`OccurrenceEditData`に解決済み回を追加し、identityの有効性を実期間との交差で判定しない。`planNotifications(snapshot,now,holidayProvider?)`とcalendar展開へ同じ環境を渡す。

- [ ] V2再接続、旧JSON不変、例外保存・分割rollback、定義変更・通知再計算、無効化定義、古いdraft拒否の実SQLiteテストを先行する。
- [ ] 対象テストFAILを確認し、保存時に定義とV2条件を検証する。既存transaction接続・revisionチェックを維持する。
- [ ] #60の初回再解決をV2対応し、仮想の未来開催は保存しない。通知の警告・fingerprint・target identityと各ビューの警告ラベルを接続する。
- [ ] Repository・calendar hook・通知回帰テストを通し、`feat(calendar): 相対繰り返しを保存と通知へ接続`としてcommit。

## Task 4: 予定編集UIとdraft

**Files:** 新規`src/features/events/relative-recurrence-draft.ts`、`event-editor-model.ts`、`use-event-editor.ts`、`recurrence-editor.tsx`、画面・表示ラベルと各テスト。

**Interfaces:** `getRecurrenceDraft`はV2を読む。`buildRelativeRecurrenceRule(draft,definition,context)`でV2を組み立てる。現在条件への明示更新、終了期間再指定、初回・次2回previewはhookから表示値として返す。

- [ ] 週・月作成、既存単発への追加、今週中の保存条件、fallback、単位変更とuntil再指定、失敗時draft保持のテストを追加しFAILを確認する。
- [ ] 相対表現では週/月に選択肢を絞る。日付は既存の直接タップpickerと共有選択シートを使い、保存時はV2の実期間と規則を検証する。
- [ ] scope選択はV2の意味的変更を検出する。単位が変わった新初回は変更対象先頭回の表示開始日から求める。
- [ ] 通知・例外・タブ切替・メモの既存回帰とUI/hookテストを通し、`feat(events): 週月の繰り返し入力と確認を追加`としてcommit。

## Task 5: 全体検証・文書・独立レビュー・PR

- [ ] README、既存の相対予定/例外/設定設計、検証記録を実装に合わせて更新する。
- [ ] typecheck / lint / 全Jest / diff check、iOS/Android exportを実行し、DSTは専用TZでも検証する。
- [ ] 一度の独立した全差分レビューを行い、重要指摘を再現テスト→修正→全体検証で解消する。
- [ ] develop向け通常Open PRを作成し、`Closes #61`、設計判断、検証結果と実機未確認項目を日本語で記載する。Issue進捗も更新し、Botの再レビューは待たない。

## 実行記録

- 2026-11-17: 設計承認済み。SDK 57 SQLite公式資料を確認。既存の専用worktreeを継続し、担当内で実装後に一度の独立レビューを行う。
