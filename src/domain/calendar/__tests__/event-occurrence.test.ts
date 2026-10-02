import type { CalendarEvent } from '../event';
import {
  expandEventOccurrences,
  type EventOccurrence,
} from '../event-occurrence';
import type { RecurrenceRuleV1 } from '../recurrence';

const exactEvent: CalendarEvent = {
  id: 'event-1',
  calendarId: 'personal-default',
  title: '通院',
  anchorDate: '2026-09-08',
  createdTimeZoneId: 'Asia/Tokyo',
  temporalType: 'exact',
  startTime: '10:00',
  duration: { type: 'fixed', minutes: 60 },
  location: null,
  noteDocument: null,
  colorId: null,
  recurrenceRule: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const dailyNever: RecurrenceRuleV1 = {
  version: 1,
  frequency: 'daily',
  interval: 1,
  weekdays: [],
  end: { type: 'never' },
};

function recurring(
  event: CalendarEvent,
  recurrenceRule: RecurrenceRuleV1,
): CalendarEvent {
  return { ...event, recurrenceRule };
}

function expandOk(
  event: CalendarEvent,
  from: string,
  through: string,
): readonly EventOccurrence[] {
  const result = expandEventOccurrences({ events: [event], from, through });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function dates(occurrences: readonly EventOccurrence[]): readonly string[] {
  return occurrences.map((occurrence) => occurrence.occurrenceStartDate);
}

describe('予定の発生回展開', () => {
  it('非繰り返し予定を元IDの1発生回へ包む', () => {
    const result = expandEventOccurrences({
      events: [exactEvent],
      from: '2026-09-08',
      through: '2026-09-09',
    });

    expect(result).toEqual({
      ok: true,
      value: [{
        key: 'event-1',
        eventId: 'event-1',
        occurrenceIdentity: null,
        occurrenceStartDate: '2026-09-08',
        occurrenceThroughDate: '2026-09-08',
        isRecurring: false,
        event: exactEvent,
      }],
    });
  });

  it('範囲外の非繰り返し予定を返さない', () => {
    expect(expandEventOccurrences({
      events: [exactEvent],
      from: '2026-09-09',
      through: '2026-09-10',
    })).toEqual({ ok: true, value: [] });
  });

  it.each([
    { from: '2026-02-30', through: '2026-03-01', field: 'from' },
    { from: '2026-03-01', through: 'invalid', field: 'through' },
    { from: '2026-09-02', through: '2026-09-01', field: 'range' },
  ])('不正な要求範囲をfield errorにする', ({ from, through, field }) => {
    expect(expandEventOccurrences({ events: [], from, through }))
      .toMatchObject({ ok: false, error: { field } });
  });

  it('日次は要求範囲付近へ移動してintervalと包含untilを適用する', () => {
    const event = recurring(exactEvent, {
      version: 1,
      frequency: 'daily',
      interval: 2,
      weekdays: [],
      end: { type: 'until', date: '2026-09-14' },
    });

    expect(dates(expandOk(event, '2026-09-10', '2026-09-16')))
      .toEqual(['2026-09-10', '2026-09-12', '2026-09-14']);
  });

  it('日次のcountは要求範囲より前の発生回も数える', () => {
    const event = recurring(exactEvent, {
      ...dailyNever,
      interval: 3,
      end: { type: 'count', count: 3 },
    });

    expect(dates(expandOk(event, '2026-09-10', '2026-09-30')))
      .toEqual(['2026-09-11', '2026-09-14']);
  });

  it('週次は月曜開始周期でanchor前を除外し複数曜日を発生回として数える', () => {
    const event = recurring({ ...exactEvent, anchorDate: '2026-09-09' }, {
      version: 1,
      frequency: 'weekly',
      interval: 2,
      weekdays: [1, 3, 5],
      end: { type: 'count', count: 4 },
    });

    expect(dates(expandOk(event, '2026-09-01', '2026-09-30')))
      .toEqual(['2026-09-09', '2026-09-11', '2026-09-21', '2026-09-23']);
  });

  it('週次の空曜日は発生回を作らない', () => {
    const event = recurring(exactEvent, {
      version: 1,
      frequency: 'weekly',
      interval: 1,
      weekdays: [],
      end: { type: 'never' },
    });

    expect(expandOk(event, '2026-09-01', '2026-09-30')).toEqual([]);
  });

  it('日曜anchorでは月曜開始週内の前日をcountへ含めない', () => {
    const event = recurring({ ...exactEvent, anchorDate: '2026-09-13' }, {
      version: 1,
      frequency: 'weekly',
      interval: 2,
      weekdays: [0, 1],
      end: { type: 'count', count: 3 },
    });

    expect(dates(expandOk(event, '2026-09-20', '2026-09-30')))
      .toEqual(['2026-09-21', '2026-09-27']);
  });

  it('平日規則は土日を除外する', () => {
    const event = recurring({ ...exactEvent, anchorDate: '2026-09-11' }, {
      version: 1,
      frequency: 'weekly',
      interval: 1,
      weekdays: [1, 2, 3, 4, 5],
      end: { type: 'never' },
    });

    expect(dates(expandOk(event, '2026-09-11', '2026-09-15')))
      .toEqual(['2026-09-11', '2026-09-14', '2026-09-15']);
  });

  it('31日の月次予定は存在しない月をcountへ含めない', () => {
    const event = recurring({ ...exactEvent, anchorDate: '2026-01-31' }, {
      version: 1,
      frequency: 'monthly',
      interval: 1,
      weekdays: [],
      end: { type: 'count', count: 3 },
    });

    expect(dates(expandOk(event, '2026-01-01', '2026-05-31')))
      .toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);
  });

  it('月次intervalとuntilを実在する候補へ適用する', () => {
    const event = recurring({ ...exactEvent, anchorDate: '2026-01-30' }, {
      version: 1,
      frequency: 'monthly',
      interval: 2,
      weekdays: [],
      end: { type: 'until', date: '2026-07-30' },
    });

    expect(dates(expandOk(event, '2026-02-01', '2026-12-31')))
      .toEqual(['2026-03-30', '2026-05-30', '2026-07-30']);
  });

  it('2月29日の年次予定はうるう年だけ発生する', () => {
    const event = recurring({ ...exactEvent, anchorDate: '2024-02-29' }, {
      version: 1,
      frequency: 'yearly',
      interval: 1,
      weekdays: [],
      end: { type: 'count', count: 3 },
    });

    expect(dates(expandOk(event, '2024-01-01', '2033-12-31')))
      .toEqual(['2024-02-29', '2028-02-29', '2032-02-29']);
  });

  it('年次intervalとuntilを実在する候補へ適用する', () => {
    const event = recurring({ ...exactEvent, anchorDate: '2025-09-08' }, {
      version: 1,
      frequency: 'yearly',
      interval: 2,
      weekdays: [],
      end: { type: 'until', date: '2030-09-08' },
    });

    expect(dates(expandOk(event, '2026-01-01', '2032-12-31')))
      .toEqual(['2027-09-08', '2029-09-08']);
  });

  it.each([
    { startTime: '23:00', minutes: 120, through: '2026-09-09' },
    { startTime: '00:00', minutes: 1_440, through: '2026-09-08' },
    { startTime: '12:00', minutes: 2_880, through: '2026-09-10' },
  ])('fixed予定の実占有最終日を求める', ({ startTime, minutes, through }) => {
    const event = recurring({
      ...exactEvent,
      startTime,
      duration: { type: 'fixed', minutes },
    }, dailyNever);

    expect(expandOk(event, '2026-09-08', '2026-09-10')[0].occurrenceThroughDate)
      .toBe(through);
  });

  it('複数日の終日予定は各発生回で同じ日数を維持する', () => {
    const event = recurring({
      ...exactEvent,
      temporalType: 'allDay',
      anchorDate: '2026-09-07',
      endDate: '2026-09-09',
    }, {
      version: 1,
      frequency: 'weekly',
      interval: 1,
      weekdays: [1],
      end: { type: 'count', count: 2 },
    });

    expect(expandOk(event, '2026-09-01', '2026-09-30').map((occurrence) => [
      occurrence.occurrenceStartDate,
      occurrence.occurrenceThroughDate,
    ])).toEqual([
      ['2026-09-07', '2026-09-09'],
      ['2026-09-14', '2026-09-16'],
    ]);
  });

  it('複数日のざっくり予定は保存済み終了日まで占有する', () => {
    const event: CalendarEvent = {
      ...exactEvent,
      temporalType: 'fuzzy',
      anchorDate: '2026-09-30',
      endDate: '2026-10-02',
      temporalDefinitionId: 'personal-default:next_week_first_half',
      resolutionContext: {
        version: 1,
        referenceDate: '2026-09-23',
        periodAnchorDate: '2026-09-28',
        parameterSnapshot: {},
      },
    };

    expect(expandOk(event, '2026-10-01', '2026-10-01')).toEqual([
      expect.objectContaining({
        occurrenceStartDate: '2026-09-30',
        occurrenceThroughDate: '2026-10-02',
      }),
    ]);
  });

  it('表示開始前に始まり期間内へ続く発生回も返す', () => {
    const event = recurring({
      ...exactEvent,
      anchorDate: '2026-09-07',
      temporalType: 'allDay',
      endDate: '2026-09-09',
    }, dailyNever);

    expect(dates(expandOk(event, '2026-09-09', '2026-09-09')))
      .toEqual(['2026-09-07', '2026-09-08', '2026-09-09']);
  });

  it('繰り返し発生回へ安定keyと元予定IDを付ける', () => {
    const event = recurring(exactEvent, dailyNever);

    expect(expandOk(event, '2026-09-08', '2026-09-09')).toEqual([
      expect.objectContaining({
        key: 'event-1:recurrence:2026-09-08',
        eventId: 'event-1',
        occurrenceIdentity: {
          seriesEventId: 'event-1',
          originalOccurrenceDate: '2026-09-08',
        },
        isRecurring: true,
      }),
      expect.objectContaining({
        key: 'event-1:recurrence:2026-09-09',
        eventId: 'event-1',
        occurrenceIdentity: {
          seriesEventId: 'event-1',
          originalOccurrenceDate: '2026-09-09',
        },
        isRecurring: true,
      }),
    ]);
  });

  it('開始日、作成日時、元予定ID、keyの順で並べる', () => {
    const events: readonly CalendarEvent[] = [
      recurring({ ...exactEvent, id: 'b', createdAt: '2026-09-02T00:00:00.000Z' }, dailyNever),
      recurring({ ...exactEvent, id: 'c', createdAt: '2026-09-01T00:00:00.000Z' }, dailyNever),
      recurring({ ...exactEvent, id: 'a', createdAt: '2026-09-01T00:00:00.000Z' }, dailyNever),
    ];

    const result = expandEventOccurrences({
      events,
      from: '2026-09-08',
      through: '2026-09-08',
    });
    if (!result.ok) throw new Error(result.error.message);

    expect(result.value.map((occurrence) => occurrence.eventId)).toEqual(['a', 'c', 'b']);
  });

  it('削除例外を除外し移動した置換例外を移動先へ一度だけ表示する', () => {
    const series = recurring({ ...exactEvent, id: 'series-1', anchorDate: '2026-10-05' }, {
      version: 1,
      frequency: 'weekly',
      interval: 1,
      weekdays: [1],
      end: { type: 'count', count: 4 },
    });
    const replacement: CalendarEvent = {
      ...series,
      id: 'replacement-1',
      title: '移動した定例会',
      anchorDate: '2026-10-20',
      recurrenceRule: null,
    };

    const result = expandEventOccurrences({
      snapshot: {
        events: [series],
        exceptions: [
          {
            seriesEventId: 'series-1',
            originalOccurrenceDate: '2026-10-12',
            kind: 'replaced',
            replacementEventId: 'replacement-1',
            overrideFields: ['title', 'temporal'],
            createdAt: exactEvent.createdAt,
            updatedAt: exactEvent.updatedAt,
          },
          {
            seriesEventId: 'series-1',
            originalOccurrenceDate: '2026-10-19',
            kind: 'deleted',
            replacementEventId: null,
            overrideFields: [],
            createdAt: exactEvent.createdAt,
            updatedAt: exactEvent.updatedAt,
          },
        ],
        replacementEvents: [replacement],
      },
      from: '2026-10-01',
      through: '2026-10-31',
    });
    if (!result.ok) throw new Error(result.error.message);

    expect(dates(result.value)).toEqual(['2026-10-05', '2026-10-20', '2026-10-26']);
    expect(result.value.filter((item) => item.eventId === 'replacement-1')).toHaveLength(1);
    expect(result.value.find((item) => item.eventId === 'replacement-1')?.occurrenceIdentity)
      .toEqual({ seriesEventId: 'series-1', originalOccurrenceDate: '2026-10-12' });
  });

  it('置換例外が表示範囲外へ移動した場合は元日付にも表示しない', () => {
    const series = recurring({ ...exactEvent, id: 'series-1', anchorDate: '2026-10-12' }, dailyNever);
    const replacement: CalendarEvent = {
      ...series,
      id: 'replacement-1',
      anchorDate: '2026-10-20',
      recurrenceRule: null,
    };
    const result = expandEventOccurrences({
      snapshot: {
        events: [series],
        exceptions: [{
          seriesEventId: 'series-1', originalOccurrenceDate: '2026-10-12',
          kind: 'replaced', replacementEventId: 'replacement-1',
          overrideFields: ['temporal'], createdAt: exactEvent.createdAt,
          updatedAt: exactEvent.updatedAt,
        }],
        replacementEvents: [replacement],
      },
      from: '2026-10-12',
      through: '2026-10-12',
    });

    expect(result).toEqual({ ok: true, value: [] });
  });
});
