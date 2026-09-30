# 繰り返し予定の発生回表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保存済みの繰り返し予定を要求期間内の発生回へ展開し、2日ビュー、月ビュー、選択日の予定一覧から元シリーズを開けるようにする。

**Architecture:** `src/domain/calendar/event-occurrence.ts`を唯一の発生回展開境界とし、DB上の`CalendarEvent`を複製・書換えせず`EventOccurrence`へ包む。`useCalendarView`はRepositoryから候補シリーズを取得した直後に1回だけ展開し、2日・月・agendaの各表示モデルは同じ発生回配列を受け取る。React key用の`id`と編集対象の`eventId`を分離し、押下時は常に元シリーズIDを渡す。

**Tech Stack:** TypeScript 6、Expo SDK 57、React Native 0.86、date-fns 4、Jest 29、React Native Testing Library 14

**Spec:** `docs/superpowers/specs/2026-09-30-recurrence-occurrence-display-design.md`

**Issue:** #31

## Global Constraints

- `RecurrenceRuleV1`の週周期は月曜開始で固定し、曜日値は日曜0から土曜6とする。
- `until`は包含、`count`は期間数ではなく実際の発生回数として扱う。
- 月次の存在しない日と年次の存在しない月日は補正せずskipする。
- 複数日の終日予定と固定duration予定は、各発生回でも元のcalendar spanを維持する。
- 発生回をeventsテーブルへ保存せず、SQLite schema、migration、index、Repository SQLを変更しない。
- 発生回の表示keyはopaqueとし、UIやRepositoryで分解しない。
- 発生回の編集・削除は元シリーズ全体へ適用し、「この予定だけ」「これ以降」は実装しない。
- 端末通知の展開・予約、相対日付ざっくり予定、繰り返し規則UIの変更は行わない。
- 日付計算では固定ミリ秒加算を使わず、date-fnsのcalendar date演算を使う。
- テスト名、コードコメント、JSDocは日本語で記述する。
- 自動テストやstatic exportだけを実機表示・操作・アクセシビリティ確認済みの根拠にしない。

---

## File Structure

- Create `src/domain/calendar/event-occurrence.ts`: 発生回型、期間計算、各頻度の候補列挙、終了条件、安定key、並び順。
- Create `src/domain/calendar/__tests__/event-occurrence.test.ts`: 日次・週次・月次・年次、複数日、境界、error、順序のdomainテスト。
- Modify `src/features/calendar/calendar-view-model.ts`: 発生回の日付交差判定とagenda item変換。
- Modify `src/features/calendar/month-view-model.ts`: 月セルの予定有無を発生回期間から判定。
- Modify `src/features/calendar/timeline-layout.ts`: 発生開始日を起点に時間軸を解決し、表示keyと元シリーズIDを保持。
- Modify `src/features/calendar/two-day-view-model.ts`: 発生回から終日欄・タイムライン・件数を作る。
- Modify `src/features/calendar/hooks/use-calendar-view.ts`: Repository取得直後の一括展開とsnapshot保持。
- Modify `src/features/calendar/components/selected-day-agenda.tsx`: agenda押下時に元シリーズIDを渡す。
- Modify `src/features/calendar/components/timeline-event-block.tsx`: timeline押下時に元シリーズIDを渡す。
- Modify existing tests under `src/features/calendar/**/__tests__`: 表示、押下、hook統合の回帰テスト。

### Task 1: Domainで発生回を決定的に展開する

**Files:**
- Create: `src/domain/calendar/event-occurrence.ts`
- Create: `src/domain/calendar/__tests__/event-occurrence.test.ts`

**Interfaces:**
- Consumes: `CalendarEvent`、`RecurrenceRuleV1`、`Result<T, E>`、`isCalendarDate`、date-fnsのcalendar date演算。
- Produces: `EventOccurrence`、`EventOccurrenceExpansionError`、`expandEventOccurrences({ events, from, through })`。

- [ ] **Step 1: 発生回型、非繰り返し、入力error、安定順序の失敗テストを書く**

`event-occurrence.test.ts`へ共通fixtureを置き、最低限次を固定する。

```ts
const exactEvent: CalendarEvent = {
  id: 'event-1', calendarId: 'personal-default', title: '通院',
  anchorDate: '2026-09-08', createdTimeZoneId: 'Asia/Tokyo',
  temporalType: 'exact', startTime: '10:00', duration: { type: 'fixed', minutes: 60 },
  location: null, notes: null, colorId: null, recurrenceRule: null,
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
};

const dailyNever: RecurrenceRuleV1 = {
  version: 1, frequency: 'daily', interval: 1, weekdays: [], end: { type: 'never' },
};

function recurring(event: CalendarEvent, recurrenceRule: RecurrenceRuleV1): CalendarEvent {
  return { ...event, recurrenceRule };
}

function expandOk(event: CalendarEvent, from: string, through: string): readonly EventOccurrence[] {
  const result = expandEventOccurrences({ events: [event], from, through });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function dates(occurrences: readonly EventOccurrence[]): readonly string[] {
  return occurrences.map((occurrence) => occurrence.occurrenceStartDate);
}

it('非繰り返し予定を元IDの1発生回へ包む', () => {
  const result = expandEventOccurrences({ events: [exactEvent], from: '2026-09-08', through: '2026-09-09' });
  expect(result).toEqual({ ok: true, value: [{
    key: 'event-1', eventId: 'event-1', occurrenceStartDate: '2026-09-08',
    occurrenceThroughDate: '2026-09-08', isRecurring: false, event: exactEvent,
  }] });
});

it.each([
  { from: '2026-02-30', through: '2026-03-01', field: 'from' },
  { from: '2026-09-02', through: '2026-09-01', field: 'range' },
])('不正な要求範囲をfield errorにする', ({ from, through, field }) => {
  expect(expandEventOccurrences({ events: [], from, through }))
    .toMatchObject({ ok: false, error: { field } });
});
```

- [ ] **Step 2: domainテストを実行して未実装で失敗することを確認する**

Run: `npm test -- src/domain/calendar/__tests__/event-occurrence.test.ts --runInBand`

Expected: `Cannot find module '../event-occurrence'`でFAIL。

- [ ] **Step 3: 公開型、期間計算、交差判定、非繰り返し変換を実装する**

`event-occurrence.ts`の公開境界を次で固定する。

```ts
export type EventOccurrence = Readonly<{
  key: string;
  eventId: string;
  occurrenceStartDate: string;
  occurrenceThroughDate: string;
  isRecurring: boolean;
  event: CalendarEvent;
}>;

export type EventOccurrenceExpansionError = Readonly<{ field: string; message: string }>;

export function expandEventOccurrences(input: Readonly<{
  events: readonly CalendarEvent[];
  from: string;
  through: string;
}>): Result<readonly EventOccurrence[], EventOccurrenceExpansionError>;
```

期間は次の純粋helperで算出する。固定durationの終了が0時ちょうどなら空の翌日を含めないため、`startMinute + minutes - 1`を使う。

```ts
function getOccurrenceSpanDays(event: CalendarEvent): number {
  if (event.temporalType === 'allDay') {
    return differenceInCalendarDays(parseDate(event.endDate), parseDate(event.anchorDate));
  }
  if (event.temporalType === 'exact' && event.duration.type === 'fixed') {
    const startMinute = toMinutesOfDay(event.startTime);
    return Math.floor(((startMinute ?? 0) + event.duration.minutes - 1) / MINUTES_PER_DAY);
  }
  return 0;
}

function createOccurrence(event: CalendarEvent, startDate: string, isRecurring: boolean): EventOccurrence {
  return {
    key: isRecurring ? `${event.id}:recurrence:${startDate}` : event.id,
    eventId: event.id,
    occurrenceStartDate: startDate,
    occurrenceThroughDate: addCalendarDays(startDate, getOccurrenceSpanDays(event)),
    isRecurring,
    event,
  };
}
```

- [ ] **Step 4: 日次と週次のinterval・until・countを表す失敗テストを書く**

```ts
it('日次は要求範囲付近へ移動してintervalと包含untilを適用する', () => {
  const event = recurring(exactEvent, {
    version: 1, frequency: 'daily', interval: 2, weekdays: [],
    end: { type: 'until', date: '2026-09-14' },
  });
  expect(dates(expandOk(event, '2026-09-10', '2026-09-16')))
    .toEqual(['2026-09-10', '2026-09-12', '2026-09-14']);
});

it('週次は月曜開始周期でanchor前を除外し複数曜日を発生回として数える', () => {
  const event = recurring({ ...exactEvent, anchorDate: '2026-09-09' }, {
    version: 1, frequency: 'weekly', interval: 2, weekdays: [1, 3, 5],
    end: { type: 'count', count: 4 },
  });
  expect(dates(expandOk(event, '2026-09-01', '2026-09-30')))
    .toEqual(['2026-09-09', '2026-09-11', '2026-09-21', '2026-09-23']);
});
```

- [ ] **Step 5: 日次と週次を開始日から日単位走査せず展開する**

日次は`differenceInCalendarDays`と`Math.ceil(dayDifference / interval)`で最初のcandidate indexへ移動する。週次はanchorを含む月曜始まりの週を周期0とし、要求範囲付近の対象週ordinalへ直接移動する。`count`前件数は次で求める。

```ts
const firstWeekCount = weekdays.filter((weekday) => weekday >= anchorWeekday).length;
const countBeforeWeek = recurrenceWeekOrdinal === 0
  ? 0
  : firstWeekCount + (recurrenceWeekOrdinal - 1) * weekdays.length;
```

対象週内では`weekdays`昇順にcandidateを作り、`anchorDate`、`until`、`count`を超えた値を返さない。`weekdays.length === 0`は発生回0件として終了する。

- [ ] **Step 6: 月次・年次の欠損日、うるう年、countを表す失敗テストを書く**

```ts
it('31日の月次予定は存在しない月をcountへ含めない', () => {
  const event = recurring({ ...exactEvent, anchorDate: '2026-01-31' }, {
    version: 1, frequency: 'monthly', interval: 1, weekdays: [],
    end: { type: 'count', count: 3 },
  });
  expect(dates(expandOk(event, '2026-01-01', '2026-05-31')))
    .toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);
});

it('2月29日の年次予定はうるう年だけ発生する', () => {
  const event = recurring({ ...exactEvent, anchorDate: '2024-02-29' }, {
    version: 1, frequency: 'yearly', interval: 1, weekdays: [],
    end: { type: 'count', count: 3 },
  });
  expect(dates(expandOk(event, '2024-01-01', '2033-12-31')))
    .toEqual(['2024-02-29', '2028-02-29', '2032-02-29']);
});
```

- [ ] **Step 7: 月次・年次をcalendar month／year単位で展開する**

月次はanchorからの月差を`interval`単位へ切り上げ、`setDate`による繰上がりを使わず`yyyy-MM-${anchorDay}`を組み立てて`isCalendarDate`で存在確認する。年次も`yyyy-${anchorMonthDay}`を組み立て、実在candidateだけ`occurrenceCount`へ加算する。`count`の場合も巨大な発生回配列を作らず、要求範囲前はcounterだけ進める。

```ts
function candidateForMonth(anchor: DateParts, month: string): string | null {
  const value = `${month}-${String(anchor.day).padStart(2, '0')}`;
  return isCalendarDate(value) ? value : null;
}

function candidateForYear(anchor: DateParts, year: number): string | null {
  const value = `${String(year).padStart(4, '0')}-${anchor.monthDay}`;
  return isCalendarDate(value) ? value : null;
}
```

- [ ] **Step 8: 複数日交差、0時境界、key、重複、並び順の失敗テストを書く**

```ts
it.each([
  { startTime: '23:00', minutes: 120, through: '2026-09-09' },
  { startTime: '00:00', minutes: 1440, through: '2026-09-08' },
  { startTime: '12:00', minutes: 2880, through: '2026-09-10' },
])('fixed予定の実占有最終日を求める', ({ startTime, minutes, through }) => {
  const event = recurring({ ...exactEvent, startTime, duration: { type: 'fixed', minutes } }, dailyNever);
  expect(expandOk(event, '2026-09-08', '2026-09-10')[0].occurrenceThroughDate).toBe(through);
});

it('表示開始前に始まり期間内へ続く発生回も返す', () => {
  const event = recurring({
    ...exactEvent, anchorDate: '2026-09-07', temporalType: 'allDay', endDate: '2026-09-09',
  }, dailyNever);
  expect(dates(expandOk(event, '2026-09-09', '2026-09-09'))).toContain('2026-09-07');
});
```

展開開始candidateは予定ごとに`from - getOccurrenceSpanDays(event)`まで戻し、最後に包含区間の交差で絞る。全予定を結合後、開始日、`createdAt`、`eventId`、`key`の順でsortし、同一シリーズ・開始日の重複を作らない。

- [ ] **Step 9: domainテストを通し、Task 1をコミットする**

Run: `npm test -- src/domain/calendar/__tests__/event-occurrence.test.ts --runInBand`

Expected: PASS。

```bash
git add src/domain/calendar/event-occurrence.ts src/domain/calendar/__tests__/event-occurrence.test.ts
git commit -m "feat(calendar): 繰り返し発生回を展開"
```

### Task 2: すべてのカレンダー表示モデルを発生回へ統一する

**Files:**
- Modify: `src/features/calendar/calendar-view-model.ts`
- Modify: `src/features/calendar/month-view-model.ts`
- Modify: `src/features/calendar/timeline-layout.ts`
- Modify: `src/features/calendar/two-day-view-model.ts`
- Modify: `src/features/calendar/__tests__/month-view-model.test.ts`
- Modify: `src/features/calendar/__tests__/timeline-layout.test.ts`
- Modify: `src/features/calendar/__tests__/two-day-view-model.test.ts`

**Interfaces:**
- Consumes: Task 1の`EventOccurrence`。
- Produces: `occursOnCalendarDate(occurrence, date)`、`AgendaItemViewModel.eventId`、`TimelineItemViewModel.eventId`、発生回を受け取る2日・月表示model factory。

- [ ] **Step 1: 月セルとagendaの発生回テストを先に書く**

既存fixtureを`EventOccurrence`へ包み、継続日と編集IDを固定する。

```ts
const occurrence: EventOccurrence = {
  key: 'event-1:recurrence:2026-09-21', eventId: 'event-1',
  occurrenceStartDate: '2026-09-21', occurrenceThroughDate: '2026-09-23',
  isRecurring: true, event,
};

expect(createMonthDayViewModels({ ...input, occurrences: [occurrence] })[0])
  .toMatchObject({ hasEvents: true });
expect(createAgendaItems([occurrence], new Map())).toEqual([expect.objectContaining({
  id: occurrence.key, eventId: 'event-1',
  accessibilityLabel: expect.stringContaining('繰り返し予定'),
})]);
```

- [ ] **Step 2: 月表示modelテストが旧`events`契約で失敗することを確認する**

Run: `npm test -- src/features/calendar/__tests__/month-view-model.test.ts --runInBand`

Expected: `occurrences`が未定義または`eventId`不足でFAIL。

- [ ] **Step 3: calendar／month view modelを発生回型へ変更する**

```ts
export type AgendaItemViewModel = Readonly<{
  id: string;
  eventId: string;
  title: string;
  temporalLabel: string;
  accessibilityLabel: string;
}>;

export function occursOnCalendarDate(occurrence: EventOccurrence, date: string): boolean {
  return occurrence.occurrenceStartDate <= date && date <= occurrence.occurrenceThroughDate;
}

export function createAgendaItems(
  occurrences: readonly EventOccurrence[],
  definitionLabels: ReadonlyMap<string, string>,
): readonly AgendaItemViewModel[] {
  return occurrences.map((occurrence) => {
    const event = occurrence.event;
    const temporalLabel = getTemporalLabel(event, definitionLabels);
    return {
      id: occurrence.key,
      eventId: occurrence.eventId,
      title: event.title,
      temporalLabel,
      accessibilityLabel: [event.title, temporalLabel, occurrence.isRecurring ? '繰り返し予定' : null]
        .filter((label): label is string => label !== null)
        .join('、'),
    };
  });
}
```

`createMonthDayViewModels`の引数名を`occurrences`へ変え、`some`には上記交差判定を使う。

- [ ] **Step 4: timelineの発生開始日・表示key・元IDテストを書く**

```ts
const recurringOccurrence = {
  key: 'event-1:recurrence:2026-09-15', eventId: 'event-1',
  occurrenceStartDate: '2026-09-15', occurrenceThroughDate: '2026-09-16',
  isRecurring: true, event: overnightEvent,
} satisfies EventOccurrence;

expect(createDayTimelineItems({ ...input, date: '2026-09-16', occurrences: [recurringOccurrence] })[0])
  .toMatchObject({
    id: recurringOccurrence.key, eventId: 'event-1', continuesFromPreviousDay: true,
    accessibilityLabel: expect.stringContaining('繰り返し予定'),
  });
```

- [ ] **Step 5: timeline layoutを発生回起点へ変更する**

`createDayTimelineItems`は`events`ではなく`occurrences`を受け取る。時刻解決には`occurrence.event`を渡し、日差は次で計算する。

```ts
export type TimelineItemViewModel = Readonly<{
  id: string;
  eventId: string;
  title: string;
  temporalLabel: string;
  accessibilityLabel: string;
  startMinute: number;
  endMinute: number;
  top: number;
  height: number;
  overlapIndex: number;
  overlapCount: number;
  opacityStops: readonly TimelineOpacityStop[];
  isInstant: boolean;
  continuesFromPreviousDay: boolean;
  continuesToNextDay: boolean;
}>;

const dayOffset = differenceInCalendarDays(
  parseISO(input.date),
  parseISO(occurrence.occurrenceStartDate),
);

items.push({
  id: occurrence.key,
  eventId: occurrence.eventId,
  title: event.title,
  accessibilityLabel: [
    event.title, temporalLabel, ...continuationLabels,
    occurrence.isRecurring ? '繰り返し予定' : null,
  ].filter((label): label is string => label !== null).join('、'),
  // existing geometry fields
});
```

- [ ] **Step 6: 2日表示の終日・祝日・複数発生回テストを書く**

同じ`eventId`で開始日が異なる2発生回を渡し、異なる`id`、同じ`eventId`、祝日先頭、継続日の表示を検証する。終日／unresolved抽出は開始日一致ではなく`occursOnCalendarDate`を使う。

```ts
expect(result[0].allDayItems[1]).toMatchObject({
  id: 'series-1:recurrence:2026-10-01', eventId: 'series-1',
  accessibilityLabel: expect.stringContaining('繰り返し予定'),
});
expect(result.flatMap((day) => day.timelineItems).map((item) => item.id))
  .toEqual(expect.arrayContaining([
    'series-2:recurrence:2026-09-30',
    'series-2:recurrence:2026-10-01',
  ]));
```

- [ ] **Step 7: 2日表示modelの入力を`occurrences`へ統一する**

`createDayViewModel`、`createTwoDayViewModels`、`createTwoDayStripViewModels`の`events`を`occurrences`へ置換する。各発生回の`event`からdefinition、時間種別、titleを読み、終日項目の`id`へkey、`eventId`へ元シリーズIDを渡す。日付件数は発生回keyで重複除去する。

- [ ] **Step 8: 表示modelの対象テストを通し、Task 2をコミットする**

Run: `npm test -- src/features/calendar/__tests__/month-view-model.test.ts src/features/calendar/__tests__/timeline-layout.test.ts src/features/calendar/__tests__/two-day-view-model.test.ts --runInBand`

Expected: PASS。

```bash
git add src/features/calendar/calendar-view-model.ts src/features/calendar/month-view-model.ts src/features/calendar/timeline-layout.ts src/features/calendar/two-day-view-model.ts src/features/calendar/__tests__
git commit -m "refactor(calendar): 表示モデルを発生回へ統一"
```

### Task 3: カレンダー読み込み時に発生回を1回だけ展開する

**Files:**
- Modify: `src/features/calendar/hooks/use-calendar-view.ts`
- Modify: `src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx`

**Interfaces:**
- Consumes: Task 1の`expandEventOccurrences`、Task 2の`occurrences`入力。
- Produces: `CalendarSnapshot.occurrences`と、表示／非表示、期間移動、月picker、refreshに共通する展開済みsnapshot。

- [ ] **Step 1: hook統合の失敗テストを書く**

`createDependencies()`のRepository返却値へ、表示範囲より前のanchorを持つ日次シリーズを追加する。

```ts
const recurringEvent: CalendarEvent = {
  ...event,
  id: 'series-1',
  anchorDate: '2026-09-01',
  recurrenceRule: {
    version: 1, frequency: 'daily', interval: 2, weekdays: [],
    end: { type: 'never' },
  },
};

it('範囲より前に始まったシリーズを2日・月・選択日へ同じ発生回として表示する', async () => {
  const dependencies = createDependencies();
  dependencies.events.listByAnchorRange.mockResolvedValue([recurringEvent]);
  const { result } = await renderHook(() => useCalendarView({
    ...dependencies,
    weekStartsOn: 1,
    now: () => new Date(2026, 8, 9, 12),
  }));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current.twoDayDays[0].timelineItems[0]).toMatchObject({ eventId: 'series-1' });
  expect(result.current.monthDays.find((day) => day.date === '2026-09-09')).toMatchObject({ hasEvents: true });
  await act(async () => result.current.selectDate('2026-09-09'));
  expect(result.current.selectedAgendaItems[0]).toMatchObject({ eventId: 'series-1' });
});
```

既存の表示切替、期間移動、date picker、refresh、カレンダー非表示テストにも、発生回が再計算または空になるassertionを追加する。

- [ ] **Step 2: hookテストを実行して未来の発生回が欠落することを確認する**

Run: `npm test -- src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx --runInBand`

Expected: 元anchor日以外にtimeline／月点／agendaがなくFAIL。

- [ ] **Step 3: snapshotを展開済み発生回へ変更する**

```ts
type CalendarSnapshot = Readonly<{
  calendarId: string;
  calendarName: string;
  calendarColorId: EventColorId;
  isCalendarVisible: boolean;
  occurrences: readonly EventOccurrence[];
  holidayCoverage: readonly HolidayRangeCoverage[];
  definitions: ReadonlyMap<string, TemporalDefinition>;
  undeterminedFadeMinutes: number;
}>;
```

`loadSnapshot`でRepository取得後に一度だけ展開する。

```ts
const expanded = expandEventOccurrences({ events, from: range.from, through: range.through });
if (!expanded.ok) throw new Error('event occurrence expansion failed');
const occurrences = expanded.value;

const fuzzyDefinitionIds = [...new Set(
  occurrences
    .map((occurrence) => occurrence.event)
    .filter((event) => event.temporalType === 'fuzzy')
    .map((event) => event.temporalDefinitionId),
)];
```

`visibleEvents`／`datePickerVisibleEvents`を`visibleOccurrences`／`datePickerVisibleOccurrences`へ置換し、2日・月・agendaの全factoryへ同じ配列を渡す。カレンダー非表示時は発生回だけ空にし、祝日coverageは維持する。

- [ ] **Step 4: hookの対象テストと表示modelテストを通す**

Run: `npm test -- src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx src/features/calendar/__tests__/month-view-model.test.ts src/features/calendar/__tests__/two-day-view-model.test.ts --runInBand`

Expected: PASS。

- [ ] **Step 5: Task 3をコミットする**

```bash
git add src/features/calendar/hooks/use-calendar-view.ts src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx
git commit -m "feat(calendar): カレンダー読み込みで繰り返しを展開"
```

### Task 4: 発生回の表示keyと元シリーズ編集IDをUIで分離する

**Files:**
- Modify: `src/features/calendar/components/selected-day-agenda.tsx`
- Modify: `src/features/calendar/components/timeline-event-block.tsx`
- Modify: `src/features/calendar/components/__tests__/month-calendar-components.test.tsx`
- Modify: `src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx`

**Interfaces:**
- Consumes: Task 2の`AgendaItemViewModel.eventId`と`TimelineItemViewModel.eventId`。
- Produces: key/test IDは発生回keyのまま、`onEditEvent`へ元シリーズIDを渡すUI導線。

- [ ] **Step 1: agendaとtimelineでkeyと編集IDが異なる失敗テストを書く**

```ts
const recurringTimelineItem = {
  ...timelineItem,
  id: 'series-1:recurrence:2026-09-08',
  eventId: 'series-1',
  accessibilityLabel: '歯医者、14:30・30分、繰り返し予定',
};

fireEvent.press(view.getByLabelText('歯医者、14:30・30分、繰り返し予定'));
expect(onEditEvent).toHaveBeenCalledWith('series-1');
expect(view.getByTestId('timeline-event.series-1:recurrence:2026-09-08')).toBeOnTheScreen();
```

agenda側も`id: 'series-1:recurrence:2026-09-08'`、`eventId: 'series-1'`で同じassertionを追加する。

- [ ] **Step 2: componentテストが発生回keyをcallbackへ返して失敗することを確認する**

Run: `npm test -- src/features/calendar/components/__tests__/month-calendar-components.test.tsx src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx --runInBand`

Expected: `onEditEvent`が発生回keyで呼ばれるためFAIL。

- [ ] **Step 3: 押下callbackだけ元シリーズIDへ変更する**

```tsx
// selected-day-agenda.tsx
<Pressable
  key={item.id}
  accessibilityRole="button"
  accessibilityLabel={item.accessibilityLabel}
  onPress={() => onEditEvent?.(item.eventId)}
  style={styles.item}
>

// timeline-event-block.tsx
<Pressable
  testID={`timeline-event.${item.id}`}
  accessibilityLabel={item.accessibilityLabel}
  onPress={() => onPress?.(item.eventId)}
>
```

2日終日項目は既に`item.eventId`を使うため、実装は維持し、回帰テストだけ発生回key／元IDの組合せへ更新する。

- [ ] **Step 4: componentテストとcalendar screenテストを通す**

Run: `npm test -- src/features/calendar/components/__tests__/month-calendar-components.test.tsx src/features/calendar/components/__tests__/two-day-calendar-components.test.tsx src/features/calendar/screens/__tests__/calendar-screen.test.tsx --runInBand`

Expected: PASS。

- [ ] **Step 5: Task 4をコミットする**

```bash
git add src/features/calendar/components/selected-day-agenda.tsx src/features/calendar/components/timeline-event-block.tsx src/features/calendar/components/__tests__
git commit -m "fix(calendar): 発生回から元シリーズを編集"
```

### Task 5: スコープ監査、全体検証、PR作成

**Files:**
- Verify only: `src/data/sqlite/**`
- Verify only: `src/features/events/**`
- Verify only: `src/app/**`
- Verify: all changed files from Tasks 1-4

**Interfaces:**
- Consumes: Tasks 1-4の完成差分。
- Produces: Issue #31を閉じる`develop`向けOpen PRと、コード検証／export／実機未確認を分けたPR本文。

- [ ] **Step 1: 設計上変更禁止の領域に差分がないことを確認する**

Run: `git diff --exit-code origin/develop...HEAD -- src/data/sqlite src/features/events src/app`

Expected: 出力なし、exit 0。

- [ ] **Step 2: 全体の型、lint、テスト、差分形式を検証する**

Run: `npm run typecheck`

Expected: exit 0。

Run: `npm run lint`

Expected: exit 0。

Run: `npm test -- --runInBand`

Expected: 全suite PASS。

Run: `git diff --check origin/develop...HEAD`

Expected: 出力なし、exit 0。

- [ ] **Step 3: iOSとAndroidのstatic exportを別出力先で実行する**

Run: `npx expo export --platform ios --output-dir /private/tmp/zakkuri-calendar-recurrence-ios`

Expected: iOS bundle/export成功、exit 0。

Run: `npx expo export --platform android --output-dir /private/tmp/zakkuri-calendar-recurrence-android`

Expected: Android bundle/export成功、exit 0。

- [ ] **Step 4: 作業treeとコミット差分を最終確認する**

Run: `git status --short --branch`

Expected: `codex/recurrence-occurrences`上で未コミット差分なし。

Run: `git diff --stat origin/develop...HEAD`

Expected: 設計・計画、domain発生回、calendar表示model／hook／componentとそのテストだけを表示する。

- [ ] **Step 5: branchをpushして`develop`向けOpen PRを作る**

```bash
git push -u origin codex/recurrence-occurrences
gh pr create --base develop --head codex/recurrence-occurrences \
  --title "feat(calendar): 繰り返し予定の発生回を表示" \
  --body "$(printf '%s\n' \
    '## 変更の目的と内容' \
    '- 保存済みの繰り返し規則を表示期間内の発生回へ展開します。' \
    '- 2日ビュー、月ビュー、選択日の予定一覧へ同じ発生回を表示します。' \
    '- 発生回keyと元シリーズIDを分離し、編集・削除はシリーズ全体へ適用します。' \
    '' \
    '## 主な設計判断と影響範囲' \
    '- 発生回はDBへ複製せずdomain純粋関数で算出します。' \
    '- SQLite schema、migration、Repository SQL、予定編集画面は変更しません。' \
    '- 「この予定だけ」「これ以降」の編集は対象外です。' \
    '' \
    '## 実行した検証と結果' \
    '- npm run typecheck' \
    '- npm run lint' \
    '- npm test -- --runInBand' \
    '- git diff --check origin/develop...HEAD' \
    '- iOS / Android static export' \
    '' \
    '## 自動検証では確認できない実機確認項目' \
    '- 多数の繰り返し予定がある場合の表示密度、スクロール、操作性能' \
    '- VoiceOver / TalkBackの読み上げ順と自然さ' \
    '' \
    'Closes #31')"
```

Expected: DraftではないOpen PRのURLが返る。
