# MVPざっくり予定クイック作成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. このタスクはユーザー指示によりサブエージェントを使わず、同一チャットで実行する。

**Goal:** 月ビューで選択した日に、SQLiteの有効な日内時間表現を使った予定を数秒で登録し、保存結果を月ビューへ即時反映する。

**Architecture:** Expo Routerのmodal routeは依存を組み立てるだけにし、入力・検証・保存はfeature custom hook、表示はfeature screen/component、永続化は既存の`EventRepository`へ置く。保存成功通知は小さなcalendar refresh Contextでroute間に伝え、SQLiteを唯一の永続状態として月hookが再取得する。

**Tech Stack:** Expo SDK 57、Expo Router 57、React Native 0.86、TypeScript 6、expo-sqlite、expo-crypto、Jest、React Native Testing Library

**Spec:** `docs/superpowers/specs/2026-09-07-zakkuri-calendar-mvp-design.md`、Issue #13

## Global Constraints

- 個人予定は端末内SQLiteだけへ保存し、ログや外部サービスへ本文を送らない。
- UIコンポーネントはSQLite・Repository・端末APIへ直接依存しない。
- 新規コメントと`describe`、`test`、`it`の説明は日本語にする。
- 対象は日内の`fuzzy`予定作成だけとし、週・月、exact、allDay、編集・削除は後続Issueへ残す。
- 保存成功前に画面を閉じず、保存中は二重送信を防止する。

---

### Task 1: 作成用ドメインファクトリとID生成依存を追加する

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/domain/calendar/event.ts`
- Test: `src/domain/calendar/__tests__/event.test.ts`

**Interfaces:**
- Consumes: 既存の`EventDraft`、`CalendarEvent`、`parseCalendarEvent`
- Produces: `createCalendarEvent(input: { id: string; draft: EventDraft; now: string }): Result<CalendarEvent, EventValidationError>`

- [ ] **Step 1: `createCalendarEvent`の失敗テストを書く**

`src/domain/calendar/__tests__/event.test.ts`へ、空IDを拒否し、有効なfuzzy draftでは`createdAt`と`updatedAt`へ同じ`now`を保持する日本語テストを追加する。

- [ ] **Step 2: REDを確認する**

Run: `npm test -- --runInBand src/domain/calendar/__tests__/event.test.ts`

Expected: `createCalendarEvent`が未定義のためFAIL。

- [ ] **Step 3: 最小実装とExpo Cryptoを追加する**

`createCalendarEvent`は次の形で既存parserへ委譲する。

```ts
export function createCalendarEvent(input: Readonly<{
  id: string;
  draft: EventDraft;
  now: string;
}>): Result<CalendarEvent, EventValidationError> {
  return parseCalendarEvent({
    ...input.draft,
    id: input.id,
    createdAt: input.now,
    updatedAt: input.now,
  });
}
```

Run: `npx expo install expo-crypto`

- [ ] **Step 4: GREENを確認する**

Run: `npm test -- --runInBand src/domain/calendar/__tests__/event.test.ts`

Expected: PASS。

### Task 2: 月ビューの再読み込み通知をroute間で共有する

**Files:**
- Create: `src/features/calendar/calendar-refresh-context.tsx`
- Create: `src/features/calendar/__tests__/calendar-refresh-context.test.tsx`
- Modify: `src/features/calendar/hooks/use-month-calendar.ts`
- Modify: `src/features/calendar/hooks/__tests__/use-month-calendar.test.tsx`
- Modify: `src/app/_layout.tsx`
- Modify: `src/app/__tests__/_layout.test.tsx`
- Modify: `src/app/index.tsx`
- Modify: `src/app/__tests__/index.test.tsx`

**Interfaces:**
- Produces: `CalendarRefreshProvider`、`useCalendarRefresh(): { revision: number; notifyChanged(): void }`
- Extends: `UseMonthCalendarInput`へ`refreshRevision?: number`

- [ ] **Step 1: Contextと月再取得の失敗テストを書く**

Provider内で`notifyChanged()`後に`revision`が増えること、`refreshRevision`変更時に現在月を再取得すること、RootLayoutがProvider内へStackを置くことを日本語テストで固定する。

- [ ] **Step 2: REDを確認する**

Run: `npm test -- --runInBand src/features/calendar/__tests__/calendar-refresh-context.test.tsx src/features/calendar/hooks/__tests__/use-month-calendar.test.tsx src/app/__tests__/_layout.test.tsx src/app/__tests__/index.test.tsx`

Expected: Contextと`refreshRevision`が未定義のためFAIL。

- [ ] **Step 3: 最小実装を追加する**

Contextは整数revisionだけを保持する。`IndexRoute`はrevisionを`useMonthCalendar`へ渡し、`useMonthCalendar`の読み込みeffect依存へ追加する。Providerは`AppDatabaseProvider`の内側、`Stack`の外側に置く。

- [ ] **Step 4: GREENを確認する**

Run: `npm test -- --runInBand src/features/calendar/__tests__/calendar-refresh-context.test.tsx src/features/calendar/hooks/__tests__/use-month-calendar.test.tsx src/app/__tests__/_layout.test.tsx src/app/__tests__/index.test.tsx`

Expected: PASS。

### Task 3: ざっくり予定作成hookを実装する

**Files:**
- Create: `src/features/events/hooks/use-quick-create-event.ts`
- Create: `src/features/events/hooks/__tests__/use-quick-create-event.test.tsx`

**Interfaces:**
- Consumes: `CalendarRepository`、`TemporalDefinitionRepository`、`EventRepository`
- Produces: `QuickCreateEventState`（`status`、`title`、`anchorDate`、`definitions`、`selectedDefinitionId`、field error、save error、setter、`retry()`、`save()`）
- `save(): Promise<boolean>`は永続化成功時だけ`true`を返す。

- [ ] **Step 1: 読み込みと保存の失敗テストを書く**

次の日本語テストを追加する。

- 既定カレンダーと有効定義を読み、`granularity === 'day'`だけを表示順のまま選択する。
- 初期日付と最初の定義を初期選択する。
- 空タイトルはRepositoryを呼ばずフォームエラーにする。
- fuzzy予定をtrim済みタイトル、選択日、定義ID、端末timezone、注入ID・時刻で保存する。
- 保存中の2回目の`save()`はRepositoryを再度呼ばない。
- Repository失敗時は`false`を返して入力を保持し、再試行可能なエラーを公開する。

- [ ] **Step 2: REDを確認する**

Run: `npm test -- --runInBand src/features/events/hooks/__tests__/use-quick-create-event.test.tsx`

Expected: hookが存在しないためFAIL。

- [ ] **Step 3: hookを最小実装する**

`now`、`createId`、`getTimeZoneId`は任意注入とし、production defaultは`new Date().toISOString()`、`Crypto.randomUUID()`、`Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'`を使う。二重送信はstateだけでなくrefでも防ぐ。例外内容やタイトルはログへ出さない。

- [ ] **Step 4: GREENを確認する**

Run: `npm test -- --runInBand src/features/events/hooks/__tests__/use-quick-create-event.test.tsx`

Expected: PASS。

### Task 4: 作成モーダルと月ビューの追加導線を実装する

**Files:**
- Create: `src/app/events/new.tsx`
- Create: `src/app/events/__tests__/new.test.tsx`
- Create: `src/features/events/screens/quick-create-event-screen.tsx`
- Create: `src/features/events/screens/__tests__/quick-create-event-screen.test.tsx`
- Create: `src/features/events/components/temporal-definition-picker.tsx`
- Modify: `src/app/_layout.tsx`
- Modify: `src/app/__tests__/_layout.test.tsx`
- Modify: `src/app/index.tsx`
- Modify: `src/app/__tests__/index.test.tsx`
- Modify: `src/features/calendar/screens/month-calendar-screen.tsx`
- Modify: `src/features/calendar/screens/__tests__/month-calendar-screen.test.tsx`
- Modify: `src/features/calendar/components/selected-day-agenda.tsx`
- Modify: `src/features/calendar/components/__tests__/month-calendar-components.test.tsx`

**Interfaces:**
- `MonthCalendarScreen`は`onAddEvent(date: string)`を受け取る。
- `QuickCreateEventScreen`は表示用stateと`onSave()`、`onCancel()`だけを受け取る。
- `/events/new?date=YYYY-MM-DD` routeだけがRepository、router、refresh Context、ID生成を組み立てる。

- [ ] **Step 1: UIとnavigationの失敗テストを書く**

次を日本語テストで固定する。

- 選択日の予定欄に44pt以上の「予定を追加」ボタンを表示し、選択日をcallbackへ渡す。
- IndexRouteは`/events/new`へ選択日param付きでpushする。
- Root Stackは`events/new`を`presentation: 'modal'`として登録する。
- モーダルはタイトル、基準日、日内定義、キャンセル、保存を表示する。
- loading、定義なし、読み込み失敗・再試行、保存中、field error、保存失敗を表示する。
- 選択状態を色だけに頼らず`accessibilityState.selected`とラベルで伝える。
- routeは保存成功時だけ`notifyChanged()`して`router.back()`する。

- [ ] **Step 2: REDを確認する**

Run: `npm test -- --runInBand src/features/events/screens/__tests__/quick-create-event-screen.test.tsx src/app/events/__tests__/new.test.tsx src/features/calendar/screens/__tests__/month-calendar-screen.test.tsx src/features/calendar/components/__tests__/month-calendar-components.test.tsx src/app/__tests__/index.test.tsx src/app/__tests__/_layout.test.tsx`

Expected: route、screen、追加callbackが未定義のためFAIL。

- [ ] **Step 3: 最小UIとrouteを実装する**

画面は`KeyboardAvoidingView`と`ScrollView`を使い、タイトル`TextInput`、基準日の`YYYY-MM-DD`入力、日内定義のPressable一覧を表示する。選択肢にはチェック記号と`accessibilityState.selected`を付ける。保存中は入力と保存ボタンを無効化し、成功したときだけrouteがrefresh通知後に戻る。

- [ ] **Step 4: GREENを確認する**

Run: `npm test -- --runInBand src/features/events/screens/__tests__/quick-create-event-screen.test.tsx src/app/events/__tests__/new.test.tsx src/features/calendar/screens/__tests__/month-calendar-screen.test.tsx src/features/calendar/components/__tests__/month-calendar-components.test.tsx src/app/__tests__/index.test.tsx src/app/__tests__/_layout.test.tsx`

Expected: PASS。

### Task 5: ドキュメントと全体検証を完了する

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-09-09-mvp-quick-create-event.md`

**Interfaces:**
- Produces: Issue #13を閉じる`develop`向けPR

- [ ] **Step 1: READMEへ現在の登録導線と対象外を記録する**

月ビューで日付選択→予定を追加→タイトル・日付・日内表現→保存、という操作と、exact/allDay/編集削除が後続であることを追記する。

- [ ] **Step 2: 全検証を実行する**

Run:

```sh
git diff --check
npm run typecheck
npm run lint
npm test -- --runInBand
npx expo export --platform ios --output-dir /tmp/zakkuri-calendar-quick-create-ios
npx expo export --platform android --output-dir /tmp/zakkuri-calendar-quick-create-android
```

Expected: すべてexit 0。実機UIは未確認としてPRへ明記する。

- [ ] **Step 3: PRを作成する**

`codex/mvp-quick-create-event`をpushし、`Closes #13`、対象範囲、検証、実機未確認を日本語で記載して`develop`向けPRを作成する。
