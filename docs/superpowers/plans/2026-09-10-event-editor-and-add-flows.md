# 予定編集・正確な時間入力・追加導線 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 正確な開始・終了時刻を持つ予定を、常設追加ボタン・2日ビューのダブルタップ・既存予定タップから作成、編集、削除できるようにする。

**Architecture:** 既存の`events.duration_minutes`を正確な開始・終了時刻の差分として使う。新規・編集routeは依存とnavigationだけを組み立て、フォーム状態とCRUDは`useEventEditor`、画面表示はevents featureへ置く。カレンダーUIは表示用callbackだけを受け取り、SQLiteとRouterへ直接依存しない。

**Tech Stack:** Expo SDK 57、Expo Router 57、React Native 0.86、TypeScript、expo-sqlite、@expo/ui DateTimePicker、Jest、React Native Testing Library

**Spec:** `docs/superpowers/specs/2026-09-10-event-editor-and-add-flows-design.md`

**実施状況（2026-09-10）:** Task 1〜6のコード・文書化・自動検証を完了した。ネイティブピッカーと実機ジェスチャーのOS固有の見た目は、実機で確認するまで未検証とする。

## Global Constraints

- 個人予定は端末内SQLiteだけへ保存し、本文を外部サービス・ログへ送信しない。
- UIコンポーネントはSQLite、Repository、Expo Router、端末APIへ直接依存しない。
- 新規コメントとテストの`describe`、`test`、`it`は日本語で記述する。
- 終了時刻が開始時刻より前なら翌日終了として扱い、同じ時刻は拒否する。
- `@expo/ui/community/datetime-picker`のimportは`EventDateTimeFields`へ限定する。
- 各振る舞いは失敗するテストを先に書き、失敗理由を確認してから最小実装を追加する。

---

### Task 1: 任意の終了時刻をドメインで扱えるようにする

**Files:**
- Create: `src/domain/calendar/time.ts`
- Create: `src/domain/calendar/__tests__/time.test.ts`
- Modify: `src/domain/calendar/event.ts`
- Modify: `src/domain/calendar/__tests__/event.test.ts`

**Interfaces:**
- Produces: `toMinutesOfDay(value: string): number | null`
- Produces: `toWallClockTime(minutes: number): string | null`
- Produces: `createFixedDurationFromTimes(startTime: string, endTime: string): Result<ExactDuration, EventValidationError>`
- Extends: `ExactDuration`の`fixed.minutes`を1〜1,439の整数として受理する。

- [ ] **Step 1: 失敗するドメインテストを書く**

`time.test.ts`へ、`09:30`と570分の相互変換、`09:30`〜`11:45`から135分のfixed duration生成、`23:30`〜`00:30`から60分の翌日継続duration生成、開始と同じ/形式不正の終了時刻を拒否するテストを書く。`event.test.ts`へ135分のdurationを持つexact eventを受理するテストを追加する。

- [ ] **Step 2: REDを確認する**

Run: `npm test -- --runInBand src/domain/calendar/__tests__/time.test.ts src/domain/calendar/__tests__/event.test.ts`

Expected: 時刻変換exportが未定義で、135分durationが既存候補外としてFAILする。

- [ ] **Step 3: 最小実装を追加する**

`time.ts`は`HH:mm`を0〜1,439分へ変換し、終了が開始より前なら終了へ1,440分を加える。差分が1〜1,439分だけ`fixed` durationを返し、同じ時刻は拒否する。`parseExactDuration`はその同じ範囲の整数を受理し、既存の`instant`と`undetermined`挙動を維持する。

- [ ] **Step 4: GREENを確認しコミットする**

Run: `npm test -- --runInBand src/domain/calendar/__tests__/time.test.ts src/domain/calendar/__tests__/event.test.ts`

```bash
git add src/domain/calendar/time.ts src/domain/calendar/__tests__/time.test.ts src/domain/calendar/event.ts src/domain/calendar/__tests__/event.test.ts
git commit -m "feat: 正確な予定の任意終了時刻を検証する"
```

### Task 2: 共通の予定作成・編集・削除hookを追加する

**Files:**
- Create: `src/features/events/hooks/use-event-editor.ts`
- Create: `src/features/events/hooks/__tests__/use-event-editor.test.tsx`
- Delete: `src/features/events/hooks/use-quick-create-event.ts`
- Delete: `src/features/events/hooks/__tests__/use-quick-create-event.test.tsx`

**Interfaces:**
- Produces: `useEventEditor(input): EventEditorState`
- Input: repositories、`initial: { date; startTime; endTime; temporalType }`、任意`eventId`、ID/clock/timezone注入。
- State: status、mode、title、anchorDate、temporalType、startTime、endTime、definitions、selectedDefinitionId、errors、setter、`retry()`、`save()`、`remove()`。

- [ ] **Step 1: 失敗するhookテストを書く**

`use-event-editor.test.tsx`に、新規exactが`09:30`〜`11:45`を135分durationでcreateすること、`23:30`〜`00:30`を60分durationでcreateすること、新規fuzzyが日内定義を選択すること、exact/allDay/fuzzyの編集予定をフォーム値へ展開すること、開始と同じ終了時刻ならRepositoryを呼ばないこと、updateが同じID/createdAtを保つこと、deleteがIDで実行されること、失敗時に入力を保持して二重操作を防ぐことをテストする。

- [ ] **Step 2: REDを確認する**

Run: `npm test -- --runInBand src/features/events/hooks/__tests__/use-event-editor.test.tsx`

Expected: `useEventEditor`が未定義でFAIL。

- [ ] **Step 3: 最小実装を追加する**

hookは既定カレンダー・有効な日内定義・編集対象予定を読み込む。選択中種別だけから`EventDraft`を作り、新規では`createCalendarEvent`と`events.create`、編集では既存ID/createdAtと新しい時刻で`parseCalendarEvent`と`events.update`を使う。`remove()`は編集時だけ`events.delete(eventId)`を呼ぶ。保存・削除中はstateとrefの両方で重複を防ぐ。

- [ ] **Step 4: GREENを確認しコミットする**

Run: `npm test -- --runInBand src/features/events/hooks/__tests__/use-event-editor.test.tsx`

```bash
git add src/features/events/hooks
git commit -m "feat: 予定の作成編集削除hookを追加する"
```

### Task 3: 共通フォームとネイティブ日時ピッカーを実装する

**Files:**
- Create: `src/features/events/components/event-type-picker.tsx`
- Create: `src/features/events/components/event-date-time-fields.tsx`
- Create: `src/features/events/components/delete-event-button.tsx`
- Create: `src/features/events/screens/event-editor-screen.tsx`
- Create: `src/features/events/screens/__tests__/event-editor-screen.test.tsx`
- Delete: `src/features/events/screens/quick-create-event-screen.tsx`
- Delete: `src/features/events/screens/__tests__/quick-create-event-screen.test.tsx`

**Interfaces:**
- Produces: `EventEditorScreen({ state, onSave, onDelete, onCancel })`
- `EventDateTimeFields`はdate/startTime/endTimeとsetter、disabledを受け取る。

- [ ] **Step 1: 失敗するフォームテストを書く**

`@expo/ui/community/datetime-picker`をtest double化し、exactでタイトル・日付・開始・終了を表示すること、allDay/fuzzyへの切替で対応する入力だけを表示すること、編集時だけ削除を表示すること、picker変更がsetterへ文字列を渡すこと、保存・削除中は全操作を無効化することをテストする。削除はnative alertで承認されたときだけ`onDelete`を呼ぶことを確認する。

- [ ] **Step 2: REDを確認する**

Run: `npm test -- --runInBand src/features/events/screens/__tests__/event-editor-screen.test.tsx`

Expected: `EventEditorScreen`が未定義でFAIL。

- [ ] **Step 3: 最小実装を追加する**

`EventTypePicker`は「正確」「終日」「ざっくり」の44pt以上のPressableを描画する。`EventDateTimeFields`だけがExpo UIのnative pickerをimportし、Dateと`YYYY-MM-DD`/`HH:mm`の変換を内部に閉じ込める。`DeleteEventButton`は`Alert.alert`でキャンセルと破壊的な削除を提示する。screenはloading/error/retryと種別ごとのフィールドを表示する。

- [ ] **Step 4: GREENを確認しコミットする**

Run: `npm test -- --runInBand src/features/events/screens/__tests__/event-editor-screen.test.tsx`

```bash
git add src/features/events/components src/features/events/screens
git commit -m "feat: 共通の予定編集フォームを追加する"
```

### Task 4: 新規・編集のmodal routeを接続する

**Files:**
- Create: `src/app/events/[id].tsx`
- Create: `src/app/events/__tests__/[id].test.tsx`
- Modify: `src/app/events/new.tsx`
- Modify: `src/app/events/__tests__/new.test.tsx`
- Modify: `src/app/_layout.tsx`
- Modify: `src/app/__tests__/_layout.test.tsx`

**Interfaces:**
- Produces: `/events/new?date=YYYY-MM-DD&startTime=HH:mm&temporalType=exact|allDay|fuzzy`と`/events/[id]`。

- [ ] **Step 1: 失敗するrouteテストを書く**

new routeがsearch parameterをhookの初期値へ渡すこと、保存成功時だけ`notifyChanged()`後に`router.back()`することをテストする。編集routeが動的IDをhookへ渡し、update/delete成功時だけ再読込して戻ることをテストする。layoutが両routeをmodalとして登録することをテストする。

- [ ] **Step 2: REDを確認する**

Run: `npm test -- --runInBand src/app/events/__tests__/new.test.tsx src/app/events/__tests__/[id].test.tsx src/app/__tests__/_layout.test.tsx`

Expected: 編集routeと共通hookが未定義でFAIL。

- [ ] **Step 3: 最小実装を追加する**

new routeはdateがなければ今日、startTimeがなければ現在時刻、endTimeは開始の60分後を24時間表記で渡す。23時台に60分後が日付をまたぐ場合も、そのまま翌日継続の初期値として扱う。編集routeは`useLocalSearchParams<{ id: string }>()`でIDを取得する。保存・削除中はgesture/hardware backを無効にする。

- [ ] **Step 4: GREENを確認しコミットする**

Run: `npm test -- --runInBand src/app/events/__tests__/new.test.tsx src/app/events/__tests__/[id].test.tsx src/app/__tests__/_layout.test.tsx`

```bash
git add src/app/events src/app/_layout.tsx src/app/__tests__/_layout.test.tsx
git commit -m "feat: 予定作成と編集のmodal routeを接続する"
```

### Task 5: カレンダーから追加・編集・ダブルタップ作成を始められるようにする

**Files:**
- Create: `src/features/calendar/timeline-tap-time.ts`
- Create: `src/features/calendar/__tests__/timeline-tap-time.test.ts`
- Create: `src/features/calendar/components/calendar-add-event-button.tsx`
- Modify: `src/app/index.tsx`
- Modify: `src/app/__tests__/index.test.tsx`
- Modify: `src/features/calendar/screens/calendar-screen.tsx`
- Modify: `src/features/calendar/screens/__tests__/calendar-screen.test.tsx`
- Modify: `src/features/calendar/hooks/use-calendar-view.ts`
- Modify: `src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx`
- Modify: `src/features/calendar/components/two-day-view.tsx`
- Modify: `src/features/calendar/components/two-day-column.tsx`
- Modify: `src/features/calendar/components/timeline-event-block.tsx`
- Modify: `src/features/calendar/components/selected-day-agenda.tsx`
- Modify: `src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx`

**Interfaces:**
- Produces: `resolveNearestTimelineHour(y: number, scale: number): string`
- `CalendarScreen`は`onAddEvent({ date, startTime })`と`onEditEvent(id)`を受け取る。

- [ ] **Step 1: 失敗するカレンダー操作テストを書く**

`timeline-tap-time.test.ts`に、0分、29分、30分、23時59分のY座標が`00:00`、`00:00`、`01:00`、`23:00`へ解決されるテストを書く。2日表示テストに、上部「＋ 予定」がないこと、タイムラインのdouble tapが日付・丸め時刻を渡すこと、予定ブロックのtapがIDを渡すことを追加する。`use-calendar-view.test.tsx`に、月表示が前日を含めて予定を取得し、前日23:30開始の60分予定を翌月初日でも表示対象に含めるテストを追加する。screen/indexテストに、右下の常設追加ボタンが44pt以上であり、月/2日で追加・編集routeへ正しいparameterを渡すことを追加する。

- [ ] **Step 2: REDを確認する**

Run: `npm test -- --runInBand src/features/calendar/__tests__/timeline-tap-time.test.ts src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx src/features/calendar/screens/__tests__/calendar-screen.test.tsx src/app/__tests__/index.test.tsx`

Expected: 時刻解決関数とcallbackが未定義、または上部追加ボタンが残っているためFAIL。

- [ ] **Step 3: 最小実装を追加する**

時刻解決関数はY座標・scaleから分を求め、最も近い1時間へ丸めて00:00〜23:00へclampする。月・2日表示のrepository取得範囲を前日まで広げる。上部追加Pressableを削除し、timeline列でdouble tap間隔を判定する。ブロックのPressableはdouble tapより優先する。常設追加ボタンはカレンダー右下absolute配置の丸い44pt以上のbuttonにする。index routeは新規と編集のrouteをpushする。

- [ ] **Step 4: GREENを確認しコミットする**

Run: `npm test -- --runInBand src/features/calendar/__tests__/timeline-tap-time.test.ts src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx src/features/calendar/screens/__tests__/calendar-screen.test.tsx src/app/__tests__/index.test.tsx`

```bash
git add src/app/index.tsx src/app/__tests__/index.test.tsx src/features/calendar
git commit -m "feat: カレンダーから予定を追加編集できるようにする"
```

### Task 6: 文書化・全体検証・PR作成を行う

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-09-10-event-editor-and-add-flows-design.md`
- Modify: `docs/superpowers/plans/2026-09-10-event-editor-and-add-flows.md`

- [ ] **Step 1: READMEの不足を確認する**

MVP機能一覧に正確な開始・終了時刻、編集・削除、常設追加、2日ビューのdouble tap作成が記載されていないことを確認する。

- [ ] **Step 2: READMEと進捗を更新する**

利用可能な種別・作成導線・翌日へ継続する終了時刻の扱いをREADMEへ追記する。実装済みの計画チェックを更新し、未実施の実機確認は未検証と明記する。

- [ ] **Step 3: 全検証を実行する**

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
npx expo export --platform ios --output-dir /private/tmp/zakkuri-calendar-event-editor-ios
npx expo export --platform android --output-dir /private/tmp/zakkuri-calendar-event-editor-android
git diff --check
```

Expected: すべてexit code 0。format check scriptが存在しない場合は、その不在と`git diff --check`結果をPRへ記載する。

- [ ] **Step 4: コミット・push・PR作成を行う**

```bash
git add README.md docs/superpowers/specs/2026-09-10-event-editor-and-add-flows-design.md docs/superpowers/plans/2026-09-10-event-editor-and-add-flows.md
git commit -m "docs: 予定編集と追加導線を記録する"
git push -u origin codex/event-editor-and-add-flows
gh pr create --base develop --head codex/event-editor-and-add-flows --title "feat: 予定の編集と正確な時間入力を追加"
```
