# 週開始曜日設定の実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 月曜／日曜始まりを永続化し、月表示と月pickerへ整合して反映する。
**Architecture:** 既存SettingsRepositoryへ設定を追加し、calendar snapshotに週開始値を含める。表示モデルはsnapshotと同時に切り替える。
**Tech Stack:** TypeScript、React Native、Expo、SQLite、Jest。依存追加なし。
**Spec:** `docs/superpowers/specs/2026-11-04-week-start-setting-design.md`

## Global Constraints

- `calendar_week_starts_on` は0（日曜）または1（月曜）、既定1。不正値は1。
- ざっくり期間・繰り返し規則・保存済み予定は変更しない。
- 月6週固定。共有UIは `src/shared/components` を利用する。
- 実装計画後は追加承認待ちなくPR作成まで進める。

## Review Focus

- 設定変更中の旧snapshotと新曜日順の混在を防ぐ。
- 古いpicker読込が新しい設定を戻さない。
- 保存中に戻っても成功時はcalendarへ変更通知する。
- 土日色は列番号によらない。
- DB読込失敗は不正設定値のfallbackと区別する。

### Task 1: 型付き設定の保存

**Files:** `src/domain/calendar/week-start.ts`、`repositories.ts`、`src/data/sqlite/settings-repository.ts`、関連Repository testsとtest doubles。
**Interfaces:** `getCalendarWeekStartsOn(): Promise<WeekStartsOn>`、`setCalendarWeekStartsOn(value: WeekStartsOn, updatedAt: string): Promise<void>`。
- [x] 欠損、不正JSON、文字列、boolean、0/1以外のfallbackと有効値読書き、不正setter拒否のテストを書く。
- [x] `npm test -- repositories.test --runInBand`でREDを確認する。
- [x] domainの既定値・parserとRepository実装を追加する。migration不要。
- [x] 同じテストでGREENを確認しcommitする。

### Task 2: 設定画面

**Files:** `src/features/settings/hooks/use-week-start-settings.ts`、`settings-screen.tsx`、`src/app/settings.tsx`、関連hook/UI tests。
**Interfaces:** hookはstatus/value/error/isSaving/reload/setValueを提供し、保存成功時に渡されたonSavedを呼ぶ。
- [x] 読込・再試行・保存失敗・連続操作・unmount中の保存完了通知のテストを書く。
- [x] 対象テストのREDを確認する。
- [x] 既存SingleSelectSheetを使う設定項目を追加し、保存成功後に選択を更新する。
- [x] テストのGREENを確認しcommitする。

### Task 3: 月表示とsnapshot整合

**Files:** `use-calendar-view.ts`、`month-grid.tsx`、`src/app/index.tsx`、関連hook/component/route tests、README、設計書。
**Interfaces:** CalendarSnapshotにweekStartsOnを保持。route固定入力を廃止し、読み込んだsnapshotの値を表示へ使う。
- [x] 日曜初回、refresh失敗後の旧表示維持と再試行、遅いpicker無効化、見出しと土日色のテストを書く。
- [x] 対象テストのREDを確認する。
- [x] 設定を先に読み、その設定で取得したsnapshotを同時反映する。pickerは独立snapshotで同じ整合性を維持する。
- [x] 対象テストと全体typecheck/lint/test/diff-checkでGREENを確認する。
- [x] ドキュメントを実装へ同期しcommit、fresh review、push、develop宛てPR作成。
