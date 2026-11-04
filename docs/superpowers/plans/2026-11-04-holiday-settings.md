# 祝日設定と締切調整の実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 日本／なしの祝日表示設定と、今週中の締切を土日祝から繰り上げる任意設定を追加する。
**Architecture:** 設定は既存app_settings、祝日選択はprovider adapter、締切調整はdomainの純粋関数へ分離する。編集は読込時policyと保存済みcontextを保持する。
**Tech Stack:** TypeScript、Expo 57、React Native、SQLite、date-fns、Jest。依存追加なし。
**Spec:** `docs/superpowers/specs/2026-11-04-holiday-settings-design.md`

## Global Constraints

- 日本／表示しない、既定日本・調整OFF。無効時は土日だけ除外する。
- 今週中だけを調整し、基準日前や未対応祝日では保存を止める。
- 保存済み予定を設定変更で更新しない。旧contextを受け入れる。
- UIの共有部品はsrc/shared/components、provider型へライブラリ型を漏らさない。

## Review Focus

- 同じ定義へ戻る再指定と保存期間の保持を区別する。
- 保存中の画面離脱でも変更通知を失わない。
- 日本祝日未対応と利用者の無効化を混同しない。
- 古いsnapshot・picker応答が新設定を上書きしない。
- 調整不能時にも本文を維持し、handlerからの直接保存も拒否する。

### Task 1: domainと永続化

**Files:** domain/calendar/holiday-preferences.ts、temporal/adjust-this-week-deadline.ts、event.ts、repositories.ts、sqlite/settings-repository.ts、data/holidays/selected-holiday-provider.ts と各テスト。
**Interfaces:** HolidayPreferencesV1、get/setHolidayPreferences、selectHolidayProvider(provider, calendarId)、adjustThisWeekDeadline(resolution, preferences, holidays)。
- [x] 既定・不正設定、平日／祝日／土日／対象なし／unsupported、旧新context往復の失敗テストを追加してREDを確認。
- [x] 型・parser・bound UPSERT・adapter・純粋計算を実装してGREENを確認。
- [x] 関連test doublesをSettingsRepositoryへ追従する。

### Task 2: 設定と表示

**Files:** features/settings hookと画面、app/settings、use-calendar-view、use-day-calendar、day-calendar-screen、関連テスト。
**Interfaces:** hookはstatus/value/error/isSaving/reload/setValueを提供。calendar snapshot取得時に設定を読み、provider選択する。
- [x] 設定保存・失敗・再試行・連打・unmount通知、祝日OFFと未対応の表示テストを追加しREDを確認。
- [x] 共通シートとSwitchの設定UI、全カレンダーへの設定反映を実装しGREENを確認。

### Task 3: 予定編集

**Files:** use-event-editor、app/events routes、editor screen、関連hook/UIテスト。
**Interfaces:** editorへHolidayProviderを注入。policyは初回読込時に固定し、relativeDateError/isSaveDisabledを公開する。
- [x] 調整後期間・保存context、対象なし／unsupported保存拒否、既存維持／再指定、設定読込失敗のテストを追加しREDを確認。
- [x] 操作履歴、preview、保存handlerとbuttonの防御を実装しGREENを確認。

### Task 4: 統合検証とPR

- [x] README・設計を実装状態へ同期。
- [x] typecheck、lint、全テスト、diff-check、iOS/Android exportを確認。
- [x] fresh reviewの有効な指摘を確認し、commit/push、develop宛てPR #49（Closes #9）を作成。Critical／Importantの指摘なし。
