# 1日時間軸と表示モードの実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 1日時間軸を常用モードへ追加し、月・previewから戻る履歴なしで切り替える。
**Architecture:** 既存calendar hookへdayと対象日要求を追加。2日時間軸・carouselを1／2列で共用し、1日用終日欄とpreview一覧をfeature内で構成する。
**Tech Stack:** Expo 57、React Native、TypeScript、date-fns、既存gesture API。新規依存なし。
**Spec:** `docs/superpowers/specs/2026-11-04-single-day-timeline-design.md`

## Global Constraints

- month→dayは同一main内のmode変更。戻るボタン／履歴を作らない。
- dayも最後のmodeへ保存、初回は今日、未保存時は従来のtwoDay。
- previewは読取専用一覧。Link.Previewにreplaceは使えないためフォーカス時だけdismissToする内部中継を経由し、既存mainのsnapshotを保持する。
- 共通UIはsrc/shared/components。calendar専用UIはfeature内。

## Review Focus

- 月からの日付・mode・snapshotの同時切替と失敗時の元表示維持。
- preview確定の要求を一度だけ処理し、その後の日移動を巻き戻さない。
- 1列幅と予備列の再配置、ピンチ中の横移動・追加抑止。
- 多数終日予定・文字拡大時にも時間軸を押し出さない。
- 2日／月、保存失敗、旧URL・不正日付の回帰。

### Task 1: day状態と永続化

Files: calendar-view-mode、two-day-view-model、use-calendar-viewと各テスト。
- [x] dayの復元、showDay(date)の原子的切替・失敗・保存、3列strip、年月境界の失敗テストを追加しRED確認。
- [x] dayをparserと既存last modeへ追加。日移動と対象日要求を実装しGREEN確認。

### Task 2: 共有時間軸と1日画面

Files: two-day-view、use-two-day-carousel、1日終日欄、calendar-screenとテスト。
- [x] 1列幅、3列strip、上限付き終日欄、1日メニュー／前後操作のテストを追加しRED確認。
- [x] visibleDayCount=1|2で既存描画を共用し、既定2を維持。日付見出し、終日スクロール、作成・編集callbackを接続しGREEN確認。

### Task 3: 月・preview・互換URL

Files: month-day-cell、month-grid、calendar-screen、app/index、旧day route、preview component、関連テスト。
- [x] 月タップがpushせずshowDayを呼ぶこと、preview要求の一度限り適用、初回要求、旧URL／不正値をテストしRED確認。
- [x] 通常タップはcallback、preview確定は内部中継からmainへの要求として統一。先読み中の副作用を防ぐ。戻るヘッダーを除去しGREEN確認。

### Task 4: 検証と提出

- [x] README・設計・計画を更新。
- [x] typecheck、lint、全テスト、diff-check、iOS/Android export、独立レビュー。
- 提出: commit/pushし、子Issueを閉じるdevelop宛てPRを作成する。

検証記録はPR本文へ記載する。iOSプレビュー確定時のnative stack同期・実機での外観と操作は未確認。

最終検証: typecheck・lint（警告0件）、74 suite／678 test、git diff --check、iOS／Android exportが成功。独立レビューの重要指摘3件は回帰テストで修正を確認。
