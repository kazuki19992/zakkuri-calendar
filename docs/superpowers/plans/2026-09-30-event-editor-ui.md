# 予定編集UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** schema version 2の予定情報を、ざっくり／きっちり、複数日、繰り返し、色、場所、複数通知、メモを扱える予定編集モーダルから作成・再編集できるようにする。

**Architecture:** Expo Router routeはRepository注入と成功後の遷移だけに保ち、`useEventEditor`が編集状態と非同期操作を調整する。日時・繰り返し・通知・表示文字列の決定的変換は`event-editor-model.ts`へ分離し、screenはfeature固有componentを組み合わせる。既存のdomain、schema version 2、Repository transactionを再利用し、DB変更と新規依存追加は行わない。

**Tech Stack:** Expo SDK 57、Expo Router、React Native、TypeScript、`@expo/ui/community/datetime-picker`、date-fns、SQLite Repository境界、Jest、React Native Testing Library。

**Spec:** `docs/superpowers/specs/2026-09-30-event-editor-ui-design.md`

## 実装結果（2026-09-30）

- [x] Task 1: 日時、繰り返し、通知の純粋変換を追加した。
- [x] Task 2: 2タブ、終日、複数日の編集状態を追加した。
- [x] Task 3: 場所、メモ、色、繰り返し、複数通知を予定集約へ接続した。
- [x] Task 4: 左右均等ヘッダー、日本語日付、日時入力を再構成した。
- [x] Task 5: 繰り返し、色、場所、通知、メモのUIを追加した。
- [x] Task 6: route回帰、文書、全体テスト、iOS／Android exportを確認した。

元のチェックリストはTDDの実施順序と検証commandを残すため、計画時の表記のまま保持する。

## Global Constraints

- `src/app`はroute parameter、Repository注入、成功時のrefreshと`router.back()`だけを担当する。
- SQLite schema、migration、Repository transaction、新規native dependencyを変更しない。
- 日付は内部`yyyy-MM-dd`、時刻は内部`HH:mm`、画面表示は`9月25日（金）`とする。
- 日付・時刻計算で固定ミリ秒加算を使わず、calendar dateと分単位の純粋計算を使う。
- 初回はざっくり、保存済みタブを復元し、明示的なきっちり作成と既存予定種別を優先する。
- `instant`／`undetermined`は終了が開始と同じ状態なら保持し、明示的な非ゼロ範囲へ変えた場合だけ`fixed`へ変換する。
- 通知設定は保存するが、端末通知の権限要求、予約、解除、発火を行わない。
- 繰り返し規則は保存するが、発生回の2日／月表示は次PRへ残す。
- 操作領域は原則44pt以上、状態を色だけで示さず、role、label、selected／checked stateを併用する。
- feature固有componentを`src/shared/components`へ移さない。
- featureとbug fixはTDDで実装し、失敗理由を確認してから最小実装を行う。

---

### Task 1: 編集値の純粋変換を追加する

**Files:**
- Create: `src/features/events/event-editor-model.ts`
- Create: `src/features/events/__tests__/event-editor-model.test.ts`
- Reuse: `src/domain/calendar/time.ts`
- Reuse: `src/domain/calendar/recurrence.ts`
- Reuse: `src/domain/calendar/event-reminder.ts`

**Interfaces:**
- Consumes: `CalendarEvent`, `ExactDuration`, `RecurrenceRuleV1`, `EventReminder`, `createFixedDurationFromDateTimes`, `offsetCalendarDate`。
- Produces:

```ts
export type ExactEditorRange = Readonly<{
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}>;

export type RecurrencePreset =
  | 'none' | 'daily' | 'weekly' | 'weekdays' | 'monthly' | 'yearly' | 'custom';

export type RecurrenceDraft = Readonly<{
  preset: RecurrencePreset;
  frequency: RecurrenceRuleV1['frequency'];
  intervalText: string;
  weekdays: readonly number[];
  endType: RecurrenceRuleV1['end']['type'];
  untilDate: string;
  countText: string;
}>;

export type ReminderDraft = Readonly<{ id: string; minutesBefore: number }>;

export function formatEditorDate(date: string): string;
export function getExactEditorRange(event: Extract<CalendarEvent, { temporalType: 'exact' }>): ExactEditorRange;
export function moveEditorRangeStart(range: ExactEditorRange, nextStartDate: string): ExactEditorRange;
export function getEditorExactDuration(
  range: ExactEditorRange,
  existingDuration: ExactDuration | null,
): Result<ExactDuration, EventValidationError>;
export function getRecurrenceDraft(rule: RecurrenceRuleV1 | null, anchorDate: string): RecurrenceDraft;
export function buildRecurrenceRule(
  draft: RecurrenceDraft,
  anchorDate: string,
): Result<RecurrenceRuleV1 | null, EventValidationError>;
export function getReminderDrafts(reminders: readonly EventReminder[]): readonly ReminderDraft[];
export function moveReminderDraft(
  reminders: readonly ReminderDraft[],
  index: number,
  offset: -1 | 1,
): readonly ReminderDraft[];
export function buildEventReminders(
  eventId: string,
  reminders: readonly ReminderDraft[],
): Result<readonly EventReminder[], EventValidationError>;
```

- [ ] **Step 1: 日時と日本語日付の失敗テストを書く**

`event-editor-model.test.ts`へ、次のliteral期待値を追加する。

```ts
expect(formatEditorDate('2026-09-25')).toBe('9月25日（金）');
expect(getExactEditorRange({
  ...exactEvent,
  anchorDate: '2026-12-31',
  startTime: '23:30',
  duration: { type: 'fixed', minutes: 1_590 },
})).toEqual({
  startDate: '2026-12-31', startTime: '23:30',
  endDate: '2027-01-02', endTime: '02:00',
});
expect(getEditorExactDuration({
  startDate: '2026-09-25', startTime: '09:00',
  endDate: '2026-09-25', endTime: '09:00',
}, { type: 'instant' })).toEqual({ ok: true, value: { type: 'instant' } });
```

開始日変更で終了日が同じcalendar day差だけ動くこと、`undetermined`保持、終了が開始以前の非特殊範囲を拒否することも追加する。

- [ ] **Step 2: 日時テストを実行して未実装で失敗することを確認する**

Run: `npm test -- src/features/events/__tests__/event-editor-model.test.ts --runInBand`

Expected: moduleまたはexport未定義でFAIL。

- [ ] **Step 3: 日時変換を最小実装する**

固定durationの終了日は、`startMinutes + duration.minutes`を1日1,440分で商と剰余へ分け、`offsetCalendarDate`で日付を進める。`Date#getTime()`や固定ミリ秒加算は使わない。`instant`／`undetermined`は終了と開始が同一なら既存値を返し、それ以外は`createFixedDurationFromDateTimes`へ委譲する。

- [ ] **Step 4: 繰り返し変換の失敗テストを書く**

次をliteral fixtureで検証する。

- `null`⇔`none`。
- 毎日、開始曜日の毎週、月〜金の平日、毎月、毎年のpreset。
- interval 2、複数曜日、until、countを含む規則はcustomへ復元する。
- 空／0／小数のintervalとcount、開始日前のuntilをfield errorにする。
- weekly weekdaysは重複除去・昇順化された`RecurrenceRuleV1`になる。

- [ ] **Step 5: 通知変換の失敗テストを書く**

既存IDと順序の復元、境界外moveのno-op、上／下移動、重複分数の除去、event IDと0始まり`sortOrder`の付与を検証する。

```ts
expect(buildEventReminders('event-1', [
  { id: 'r2', minutesBefore: 30 },
  { id: 'r1', minutesBefore: 10 },
])).toEqual({ ok: true, value: [
  { id: 'r2', eventId: 'event-1', minutesBefore: 30, sortOrder: 0 },
  { id: 'r1', eventId: 'event-1', minutesBefore: 10, sortOrder: 1 },
] });
```

- [ ] **Step 6: 繰り返しと通知変換を最小実装する**

presetは固定規則へ変換し、customは文字列数値を安全な正整数へparseして`parseRecurrenceRule`を通す。untilがanchorDateより前の場合は`recurrenceRule` field errorを返す。通知は`normalizeEventReminders`を最終境界として使う。

- [ ] **Step 7: Task 1テストをGREENにする**

Run: `npm test -- src/features/events/__tests__/event-editor-model.test.ts src/domain/calendar/__tests__/time.test.ts src/domain/calendar/__tests__/recurrence.test.ts src/domain/calendar/__tests__/event-reminder.test.ts --runInBand`

Expected: PASS。

- [ ] **Step 8: Task 1をcommitする**

```bash
git add src/features/events/event-editor-model.ts src/features/events/__tests__/event-editor-model.test.ts
git commit -m "feat(events): 予定編集値の変換を追加"
```

---

### Task 2: hookを2タブと複数日編集へ拡張する

**Files:**
- Modify: `src/features/events/hooks/use-event-editor.ts`
- Modify: `src/features/events/hooks/__tests__/use-event-editor.test.tsx`
- Reuse: `src/features/events/event-editor-model.ts`

**Interfaces:**
- Consumes: Task 1の日時変換と`SettingsRepository`。
- Produces: `EventEditorState`へ次を追加・変更する。

```ts
editorTab: EventEditorTab;
isAllDay: boolean;
startDate: string;
startTime: string;
endDate: string;
endTime: string;
isDateEditable: boolean;
setEditorTab(value: EventEditorTab): void;
setAllDay(value: boolean): void;
setStartDate(value: string): void;
setEndDate(value: string): void;
setStartTime(value: string): void;
setEndTime(value: string): void;
```

旧`anchorDate`と`setTemporalType`はscreen移行完了時に削除する。hook内部では`editorTab + isAllDay`から`fuzzy | exact | allDay`を決める。

- [ ] **Step 1: 読み込みとタブ切替の失敗テストを書く**

- 新規初回／不正設定はざっくり。
- 保存済みexactはきっちり。
- 明示`initialTab: 'exact'`は保存済みfuzzyより優先。
- 既存all-dayはきっちり＋終日ON。
- 既存fuzzyはざっくり。
- タブ往復でexact rangeとselectedDefinitionIdを保持。
- タブ変更時だけ`setLastEventEditorTab`を呼ぶ。

- [ ] **Step 2: 対象hookテストをREDにする**

Run: `npm test -- src/features/events/hooks/__tests__/use-event-editor.test.tsx --runInBand`

Expected: 新しいstate／callback未定義でFAIL。

- [ ] **Step 3: 2タブ状態を最小実装する**

既存予定の`temporalType`をeditorTabとisAllDayへ展開する。新規作成はmount時snapshotの`initialTab`、保存設定、初期種別の順で決める。タブ変更で入力値を初期化しない。

- [ ] **Step 4: 複数日と特殊durationの失敗テストを書く**

- fixed 49時間を正しいendDate/endTimeへ読み込む。
- 開始日移動で終了日を同じday差だけ移動する。
- exact複数日を`createFixedDurationFromDateTimes`相当のdurationで保存する。
- all-dayのstartDate/endDateを包含日として保存する。
- instant／undeterminedは同一終了日時なら保持し、非ゼロ終了へ変更時はfixedへ変換する。
- 終日ON/OFF往復で時刻を保持する。
- 終了日時が開始以前なら`endTimeError`を表示してRepositoryを呼ばない。

- [ ] **Step 5: 複数日保存を最小実装する**

`getExactEditorRange`で読み込み、`moveEditorRangeStart`でstartDate変更を調整し、保存時は`getEditorExactDuration`を使う。all-dayは入力されたendDateをそのまま検証する。既存metadataとremindersはTask 3まで従来どおり保持する。

- [ ] **Step 6: Task 2テストをGREENにする**

Run: `npm test -- src/features/events/hooks/__tests__/use-event-editor.test.tsx src/features/events/__tests__/event-editor-model.test.ts --runInBand`

Expected: PASS。

- [ ] **Step 7: Task 2をcommitする**

```bash
git add src/features/events/hooks/use-event-editor.ts src/features/events/hooks/__tests__/use-event-editor.test.tsx
git commit -m "feat(events): 2タブと複数日編集へ対応"
```

---

### Task 3: metadata、繰り返し、複数通知をhookへ接続する

**Files:**
- Modify: `src/features/events/hooks/use-event-editor.ts`
- Modify: `src/features/events/hooks/__tests__/use-event-editor.test.tsx`
- Reuse: `src/constants/event-colors.ts`
- Reuse: `src/features/events/event-editor-model.ts`

**Interfaces:**
- Consumes: `CalendarRepository.getDefault()`の`name`／`colorId`、Task 1のrecurrence／reminder変換。
- Produces: `EventEditorState`へ次を追加する。

```ts
calendarName: string;
calendarColorId: EventColorId;
colorId: EventColorId | null;
location: string;
notes: string;
recurrenceDraft: RecurrenceDraft;
reminders: readonly ReminderDraft[];
recurrenceError: string | null;
reminderError: string | null;
setColorId(value: EventColorId | null): void;
setLocation(value: string): void;
setNotes(value: string): void;
setRecurrencePreset(value: RecurrencePreset): void;
setRecurrenceFrequency(value: RecurrenceRuleV1['frequency']): void;
setRecurrenceIntervalText(value: string): void;
toggleRecurrenceWeekday(value: number): void;
setRecurrenceEndType(value: RecurrenceRuleV1['end']['type']): void;
setRecurrenceUntilDate(value: string): void;
setRecurrenceCountText(value: string): void;
addReminder(minutesBefore: number): void;
removeReminder(id: string): void;
moveReminder(id: string, offset: -1 | 1): void;
```

`UseEventEditorInput`へ`createReminderId?: () => string`を追加する。新規event IDは最初の保存試行で変わらないようmount中に1回だけ確定する。

- [ ] **Step 1: metadata読み込み・保存の失敗テストを書く**

既存aggregateのcalendar name/color、予定color、location、notes、recurrence、remindersがstateへ展開されることを検証する。編集後の`events.update`がtrim済みoptional text、選択色、規則、通知順を含むことをliteralで検証する。

- [ ] **Step 2: 新規作成aggregateの失敗テストを書く**

新規event IDを`event-new`、通知IDを`reminder-a`／`reminder-b`に固定し、複数回のvalidation失敗を挟んでも同じevent IDを使うことを検証する。通知の追加、重複追加no-op、削除、上下移動もstate結果で検証する。

- [ ] **Step 3: 対象hookテストをREDにする**

Run: `npm test -- src/features/events/hooks/__tests__/use-event-editor.test.tsx --runInBand`

Expected: metadata state／callback未定義でFAIL。

- [ ] **Step 4: metadataと通知状態を最小実装する**

読み込み時にaggregateをdraftへ展開する。場所・メモは画面では空文字、保存時はtrimして空なら`null`。通知追加は非負安全整数だけ許可し、同じminutesBeforeが存在すればno-opにする。ID生成は追加時1回だけ行う。

- [ ] **Step 5: recurrenceとaggregate保存を最小実装する**

保存前に`buildRecurrenceRule`と`buildEventReminders`を呼び、失敗時は対応field errorを出してRepositoryを呼ばない。event作成／更新と通知は従来どおり1つの`EventAggregate`としてRepositoryへ渡す。

- [ ] **Step 6: 二重操作と失敗保持を再検証する**

連続save、save中remove、Repository reject、retryについて、operationRefが同期的に競合を防ぎ、入力値とerrorを保持する既存テストを新stateへ追従させる。

- [ ] **Step 7: Task 3テストをGREENにする**

Run: `npm test -- src/features/events/hooks/__tests__/use-event-editor.test.tsx src/features/events/__tests__/event-editor-model.test.ts --runInBand`

Expected: PASS。

- [ ] **Step 8: Task 3をcommitする**

```bash
git add src/features/events/hooks/use-event-editor.ts src/features/events/hooks/__tests__/use-event-editor.test.tsx
git commit -m "feat(events): 予定metadataと通知編集を接続"
```

---

### Task 4: ヘッダー、タブ、日時入力componentを再構成する

**Files:**
- Create: `src/features/events/components/event-editor-header.tsx`
- Create: `src/features/events/components/event-editor-tabs.tsx`
- Modify: `src/features/events/components/event-date-time-fields.tsx`
- Delete: `src/features/events/components/event-type-picker.tsx`
- Create: `src/features/events/components/__tests__/event-editor-primary-fields.test.tsx`
- Modify: `src/features/events/screens/event-editor-screen.tsx`
- Modify: `src/features/events/screens/__tests__/event-editor-screen.test.tsx`

**Interfaces:**
- Consumes: Task 2のeditorTab、isAllDay、start/end値とcallback、`formatEditorDate`。
- Produces: equal-width header、2タブ、終日switch、日本語表示の日付・時刻行。

- [ ] **Step 1: headerとtabの失敗component testを書く**

- 新規／編集title、キャンセル、保存を表示する。
- 左右button wrapperが同じstyle IDまたは同じflatten済みwidth/flexBasisを持つ。
- busy時は左右actionがdisabled、右labelが「保存中」。
- ざっくり／きっちりが`accessibilityRole="tab"`とselected stateを持つ。

- [ ] **Step 2: 日時入力の失敗component testを書く**

- 主表示が`9月25日（金）`である。
- ざっくりは日付だけ、きっちり終日OFFは開始／終了の日時、終日ONは開始／終了日だけを表示する。
- 終日switchがchecked stateを持つ。
- busy時はbuttonとswitchからcallbackが発火しない。
- pickerを開いたときだけnative DateTimePicker mockがmountされる。

- [ ] **Step 3: component testをREDにする**

Run: `npm test -- src/features/events/components/__tests__/event-editor-primary-fields.test.tsx src/features/events/screens/__tests__/event-editor-screen.test.tsx --runInBand`

Expected: 新componentと新表示未実装でFAIL。

- [ ] **Step 4: headerとtabを最小実装する**

headerは同一`side` styleの左右wrapperと中央`title`列で構成する。タブは2つのPressableだけを持ち、色に加えてlabelとselected stateを使う。

- [ ] **Step 5: 日付・時刻行を最小実装する**

確定値は独自Textで表示する。Androidはpickerに`presentation="dialog"`、iOSは`locale="ja_JP"`を渡す。pickerの開閉はcomponent local stateとし、保存値はcallbackへ返す。`Sep 25, 2026`に依存するTextをrenderしない。

- [ ] **Step 6: screen上部へ接続する**

旧3種`EventTypePicker`を削除し、header、title、2タブ、日時／時間帯をフォーム順に配置する。loading／error／retryを維持する。

- [ ] **Step 7: Task 4テストをGREENにする**

Run: `npm test -- src/features/events/components/__tests__/event-editor-primary-fields.test.tsx src/features/events/screens/__tests__/event-editor-screen.test.tsx --runInBand`

Expected: PASS。

- [ ] **Step 8: Task 4をcommitする**

```bash
git add src/features/events/components src/features/events/screens
git commit -m "feat(events): 予定編集の基本フォームを再構成"
```

---

### Task 5: 繰り返し、色、場所、通知、メモUIを追加する

**Files:**
- Create: `src/features/events/components/recurrence-editor.tsx`
- Create: `src/features/events/components/event-color-picker.tsx`
- Create: `src/features/events/components/event-reminder-editor.tsx`
- Create: `src/features/events/components/event-metadata-fields.tsx`
- Create: `src/features/events/components/__tests__/event-editor-additional-fields.test.tsx`
- Modify: `src/features/events/screens/event-editor-screen.tsx`
- Modify: `src/features/events/screens/__tests__/event-editor-screen.test.tsx`
- Modify: `src/features/events/components/delete-event-button.tsx`

**Interfaces:**
- Consumes: Task 3のmetadata stateとcallback、既存`EVENT_COLOR_PALETTE`。
- Produces: 設計書3.3の全フォーム順、通知未発火説明、シリーズ全体削除表記。

- [ ] **Step 1: recurrence UIの失敗テストを書く**

- 7 presetを表示してselected stateを付ける。
- custom選択時だけfrequency、interval、weekly weekdays、end conditionを表示する。
- weekdaysはbutton labelとselected stateを持つ。
- until時だけ日付、count時だけ回数入力を表示する。
- field errorをalertとして表示する。

- [ ] **Step 2: 色・通知・metadata UIの失敗テストを書く**

- 「カレンダーの色」と8色をlabel、見本、checkmark、selected stateで表示する。
- calendar nameは読み取り専用。
- 場所は単一行、メモはmultiline。
- reminder行はlabel、上へ、下へ、削除buttonを持ち、端の移動buttonをdisabledにする。
- 既定候補と任意分追加を提供し、通知未発火説明を常に表示する。

- [ ] **Step 3: additional fields testをREDにする**

Run: `npm test -- src/features/events/components/__tests__/event-editor-additional-fields.test.tsx --runInBand`

Expected: component未定義でFAIL。

- [ ] **Step 4: recurrence editorを最小実装する**

PressableとTextInputで制御componentを作る。custom以外のpresetでは詳細入力を隠し、hookへpreset callbackだけを渡す。number pad入力は文字列のままhookへ渡し、componentでdomain validationしない。

- [ ] **Step 5: 色、場所、メモを最小実装する**

既存palette registryを利用し、色だけでなくlabelとcheckmarkを表示する。TextInputはbusy時editable falseとし、errorの有無に応じてaccessibility情報を付ける。

- [ ] **Step 6: notification editorを最小実装する**

既定候補`0, 5, 10, 30, 60, 1440`と任意分入力を提供する。並べ替えは上／下buttonで行い、drag依存を追加しない。説明文は「設定は保存されますが、端末への通知はまだ行われません」とする。

- [ ] **Step 7: screenへ設計順で接続する**

タイトル、タブ、日時／時間帯、繰り返し、カレンダー／色、場所、通知、メモ、削除の順に配置する。カードを追加せず、区切り線と余白を使う。繰り返し予定の削除dialogはシリーズ全体を明示する。

- [ ] **Step 8: Task 5テストをGREENにする**

Run: `npm test -- src/features/events/components/__tests__/event-editor-additional-fields.test.tsx src/features/events/screens/__tests__/event-editor-screen.test.tsx --runInBand`

Expected: PASS。

- [ ] **Step 9: Task 5をcommitする**

```bash
git add src/features/events/components src/features/events/screens
git commit -m "feat(events): 予定の追加項目UIを実装"
```

---

### Task 6: route、文書、全体検証、PRを仕上げる

**Files:**
- Modify: `src/app/events/new.tsx`
- Modify: `src/app/events/[id].tsx`
- Modify: `src/app/events/__tests__/new.test.tsx`
- Modify: `src/app/events/__tests__/[id].test.tsx`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-09-07-zakkuri-calendar-mvp-design.md`
- Modify: `docs/superpowers/plans/2026-09-30-event-editor-ui.md`

**Interfaces:**
- Consumes: 完成した`useEventEditor`と`EventEditorScreen`。
- Produces: thin route、保存／削除成功時だけのrefresh、実装済みUIと未実装の繰り返し表示を区別した文書、検証証跡。

- [ ] **Step 1: route回帰テストを新stateへ追従する**

- 新規routeがdate/startTimeと明示exactをhookへ渡す。
- 保存成功時だけ`notifyChanged`後にbackする。
- 編集routeがIDを渡し、更新／削除成功時だけrefreshしてbackする。
- 保存／削除中は`Stack.Screen.gestureEnabled: false`とAndroid back抑止を維持する。

- [ ] **Step 2: route testを実行する**

Run: `npm test -- src/app/events/__tests__/new.test.tsx 'src/app/events/__tests__/[id].test.tsx' --runInBand`

Expected: PASS。

- [ ] **Step 3: READMEとMVP設計を更新する**

場所、メモ、色、通知、繰り返し、複数日の編集UIが実装済みであることを記載する。同時に、繰り返し発生回表示と端末通知は未実装であり、通知行を保存しても通知は発火しないと明記する。

- [ ] **Step 4: focused testを実行する**

Run:

```bash
npm test -- \
  src/features/events/__tests__/event-editor-model.test.ts \
  src/features/events/hooks/__tests__/use-event-editor.test.tsx \
  src/features/events/components/__tests__/event-editor-primary-fields.test.tsx \
  src/features/events/components/__tests__/event-editor-additional-fields.test.tsx \
  src/features/events/screens/__tests__/event-editor-screen.test.tsx \
  src/app/events/__tests__/new.test.tsx \
  'src/app/events/__tests__/[id].test.tsx' \
  --runInBand
```

Expected: PASS。

- [ ] **Step 5: 全体検証を実行する**

Run:

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
git diff --check
```

Expected: 全command exit 0。

- [ ] **Step 6: iOSとAndroid exportを順番に実行する**

Run: `npx expo export --platform ios`

Expected: exit 0、`Exported: dist`。

Run: `npx expo export --platform android`

Expected: exit 0、`Exported: dist`。

- [ ] **Step 7: 実機未確認項目とscopeを監査する**

`git diff origin/develop...HEAD`を確認し、schema／migration／端末通知／繰り返し発生回展開／Issue #24〜#26の実装が混入していないことを確認する。実機のheader、keyboard、picker、gesture、文字拡大、VoiceOver／TalkBackは未確認としてPRへ記載する。

- [ ] **Step 8: 文書と計画をcommitする**

```bash
git add README.md docs/superpowers/specs/2026-09-07-zakkuri-calendar-mvp-design.md docs/superpowers/plans/2026-09-30-event-editor-ui.md
git commit -m "docs(events): 予定編集UIの実装範囲を記録"
```

- [ ] **Step 9: 独立レビュー後にpushしてPRを作成する**

Critical／Important指摘を解消し、修正後の全体検証を取り直す。`codex/event-editor-ui`をpushし、`develop`向け通常PRを日本語で作成する。PR本文へ目的、設計判断、検証、export、未実装境界、実機未確認項目を記載する。
