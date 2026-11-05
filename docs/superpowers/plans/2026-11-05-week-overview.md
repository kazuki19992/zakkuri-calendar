# 7日時間軸ビュー実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 週全体の配置を7列で見渡し、密集した日の全件を1日表示から確認できるようにする。
**Architecture:** 既存snapshotとモード状態へweekを追加。時間軸・zoom・carouselを共用し、週用の矩形衝突と省略件数だけを純粋関数へ分離する。
**Tech Stack:** Expo SDK 57、React Native、date-fns、既存gesture API。新規依存なし。
**Spec:** `docs/superpowers/specs/2026-11-05-week-overview-design.md`

## Global Constraints

- main内のモード変更。週から1日への戻る履歴・新しいrouteを作らない。
- 表示7日、前後各7日をbufferにし、取得開始のみさらに前日へ広げる。
- 既存週開始設定を使用。保存済み予定・繰り返し規則・DB schemaを変更しない。
- 週の時間レーン上限はmin(2,max(1,floor(日列幅/36)))。終日最大2レーン・44pt、本文高の1/3以下。
- 既存1日・2日の密集レイアウトは変更しない。Reduce Motionと完全な読み上げを維持。

## Review Focus

- 表示週・選択日・snapshotの更新、週開始設定refreshやURL要求との競合。
- 実際の縮尺の最小高・下端補正と衝突判定の一致。幅や倍率変更後の省略件数。
- bufferをまたぐ帯のラベル・フェード・省略と読み上げ範囲。
- 小画面／文字拡大でも7列を維持し、終日欄が時間軸を押し出さないこと。
- ピンチと横移動・ダブルタップの競合、2日表示の1日移動の維持。

### Task 1: 週範囲、snapshot、モード状態

Files: `src/domain/calendar/month.ts`、`calendar-view-mode.ts`、`src/features/calendar/calendar-snapshot.ts`、`hooks/use-calendar-view.ts`、各既存test。
Interfaces: `getWeekRange(date, weekStartsOn): MonthRange`、state `weekStrip: readonly TwoDayViewModel[]`。

- [x] RED: week parser、年跨ぎ／閏年／日月開始の週範囲、week復元時21列、listScheduleの22日範囲をassert。
- [x] RED: 7日移動で曜日維持、設定refreshで選択日不変、week保存失敗と1日切替失敗で元表示維持。
- [x] getWeekRange、weekの明示分岐、snapshotの週開始値による21列モデルを実装。
- [x] `npm test -- --runInBand month.test calendar-view-mode.test use-calendar-view.test` → GREEN。
- [x] 型検証後、週状態の変更をcommit。

### Task 2: 表示矩形、密集、省略、carousel

Files: `timeline-layout.ts`、新規`week-view-layout.ts`、`two-day-view-model.ts`、`hooks/use-two-day-carousel.ts`、各test。
Interfaces: `getTimelineItemFrame(item,scale): {top,height}`、`createWeekTimelineLayout(items,scale,columnWidth): {items,hiddenIds}`、`getWeekAllDayLaneLimit(height):number`、`formatWeekRange(from,through):string`。

- [x] RED: 縮小時の36pt衝突、24時下端、1/2レーン、省略の安定性と拡大時の再出現、範囲文字列をassert。
- [x] RED: 7列の幅と7列分の移動・失敗復帰、既存1/2列の既定値維持。
- [x] 描画と同じ矩形計算を共用し、週レーンを純粋関数で作る。終日layoutに任意laneLimit（既定2）を追加。
- [x] carouselをvisibleDayCount=1|2|7、stepDays（既定1）へ拡張。
- [x] `npm test -- --runInBand week-view-layout.test use-two-day-carousel.test two-day-view-model.test` → GREEN。
- [x] 型検証後、表示計算をcommit。

### Task 3: 週UIと操作接続

Files: 新規`components/week-day-header.tsx`、`components/two-day-view.tsx`、`two-day-column.tsx`、`timeline-event-block.tsx`、`two-day-all-day-layer.tsx`、`screens/calendar-screen.tsx`、`calendar-side-menu.tsx`、各test。
Consumes: Task 1 weekStrip、Task 2の表示モデル・可変レーン・carousel。

- [x] RED: 7列、週範囲、週メニュー、前後週、日付／他N件→showDay、編集ID、空き時刻追加、省略数と終日高の上限をassert。
- [x] weekだけ実縮尺レイアウトと上限を適用し、表示headerと終日帯のtopを合わせる。bufferは読み上げ対象外。
- [x] week modeの選択日・今日・週開始設定、ピンチ抑止を接続。新規の週routeは作らない。
- [x] `npm test -- --runInBand calendar-screen.test two-day-calendar-components.test week-day-header.test` → GREEN。
- [x] 型検証後、週UIをcommit。

### Task 4: 回帰検証とPR

- [x] README・承認済み設計・計画へ実装状態と実機未確認項目を反映。
- [x] typecheck、lint、全test、diff-check、iOS/Android exportを確認。
- [x] whole-branch独立レビューを1回行い、重要指摘にはRED→GREENと全体検証で対応。
- 提出: commit/push後、Closes #52を含むdevelop宛てOpen PRを作成する。

最終検証: typecheck、lint（警告0件）、76 suites／711 tests、diff-check、iOS／Android export成功。America/New_Yorkでの日付計算12件も成功。独立レビューの重要指摘は回帰テストを追加して修正済み。実機の可読性・操作性は未確認。
