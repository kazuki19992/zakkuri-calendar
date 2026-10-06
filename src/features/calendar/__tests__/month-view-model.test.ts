import type { CalendarEvent } from '@/domain/calendar/event';
import type { EventOccurrence } from '@/domain/calendar/event-occurrence';
import type { MonthGridDate } from '@/domain/calendar/month';
import {
  createAgendaItems,
  createMonthDayViewModels,
  createMonthWeekViewModels,
} from '../month-view-model';

const baseEvent = {
  id: 'event-1',
  calendarId: 'personal-default',
  title: '敬老会',
  anchorDate: '2026-09-21',
  createdTimeZoneId: 'Asia/Tokyo',
  location: null,
  noteDocument: null,
  colorId: null,
  recurrenceRule: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
} as const;

const gridDate: MonthGridDate = {
  date: '2026-09-21',
  dayNumber: 21,
  weekday: 1,
  isCurrentMonth: true,
};

function asOccurrence(
  event: CalendarEvent,
  throughDate = event.temporalType === 'allDay' || event.temporalType === 'fuzzy'
    ? event.endDate
    : event.anchorDate,
): EventOccurrence {
  return {
    key: event.id,
    eventId: event.id,
    occurrenceIdentity: null,
    occurrenceStartDate: event.anchorDate,
    occurrenceThroughDate: throughDate,
    isRecurring: false,
    event,
  };
}

describe('月表示の表示用モデル', () => {
  it('複数日、終日、当日予定の順で3レーンへ配置し、残りを日別hidden countへ入れる', () => {
    const grid = Array.from({ length: 7 }, (_, index): MonthGridDate => ({
      date: `2026-09-${String(index + 21).padStart(2, '0')}`,
      dayNumber: index + 21,
      weekday: index + 1,
      isCurrentMonth: true,
    }));
    const allDay = asOccurrence({ ...baseEvent, id: 'all-day', temporalType: 'allDay', endDate: '2026-09-21' });
    const single = asOccurrence({ ...baseEvent, id: 'single', temporalType: 'exact', startTime: '09:00', duration: { type: 'fixed', minutes: 30 } });
    const spanning = asOccurrence({ ...baseEvent, id: 'spanning', temporalType: 'allDay', endDate: '2026-09-23' });
    const overflow = asOccurrence({ ...baseEvent, id: 'overflow', temporalType: 'exact', startTime: '10:00', duration: { type: 'fixed', minutes: 30 } });

    const [week] = createMonthWeekViewModels({ grid, occurrences: [single, allDay, spanning, overflow], definitionLabels: new Map(), calendarColorId: 'blue' });

    expect(week.segments.map((item) => [item.id, item.lane])).toEqual([
      ['spanning', 0], ['all-day', 1], ['single', 2],
    ]);
    expect(week.segments[0]).toMatchObject({ startsInWeek: true, endsInWeek: true });
    expect(week.days[0].hiddenEventCount).toBe(1);
  });

  it('繰り返し発生回の継続日へ予定点を出し元シリーズIDをagendaへ渡す', () => {
    const event: CalendarEvent = {
      ...baseEvent,
      temporalType: 'allDay',
      endDate: '2026-09-23',
    };
    const occurrence: EventOccurrence = {
      key: 'event-1:recurrence:2026-09-21',
      eventId: 'replacement-1',
      occurrenceIdentity: { seriesEventId: 'event-1', originalOccurrenceDate: '2026-09-21' },
      occurrenceStartDate: '2026-09-21',
      occurrenceThroughDate: '2026-09-23',
      isRecurring: true,
      event,
    };

    const days = createMonthDayViewModels({
      grid: [{ ...gridDate, date: '2026-09-23', dayNumber: 23 }],
      selectedDate: '2026-09-23',
      today: '2026-09-21',
      occurrences: [occurrence],
      holidayCoverage: [],
    });

    expect(days[0]).toMatchObject({ hasEvents: true });
    expect(createAgendaItems([occurrence], new Map())).toEqual([{
      id: occurrence.key,
      eventId: 'event-1',
      originalOccurrenceDate: '2026-09-21',
      title: '敬老会',
      temporalLabel: '終日',
      accessibilityLabel: '敬老会、終日、繰り返し予定、個別に変更済み',
    }]);
  });

  it('祝日だけの日は祝日名を示すが予定ありの点には数えない', () => {
    const result = createMonthDayViewModels({
      grid: [gridDate],
      selectedDate: '2026-09-20',
      today: '2026-09-20',
      occurrences: [],
      holidayCoverage: [{
        from: '2026-09-01', through: '2026-09-30',
        result: { status: 'available', holidays: [{ date: '2026-09-21', name: '敬老の日' }] },
      }],
    });

    expect(result[0]).toMatchObject({ holidayName: '敬老の日', hasEvents: false });
    expect(result[0].accessibilityLabel).toBe('2026年9月21日、敬老の日');
  });

  it('今日で選択中かつ祝日と予定ありの日を読み上げ可能な文言へ変換する', () => {
    const result = createMonthDayViewModels({
      grid: [gridDate],
      selectedDate: '2026-09-21',
      today: '2026-09-21',
      occurrences: [asOccurrence({
          ...baseEvent,
          temporalType: 'allDay',
          endDate: baseEvent.anchorDate,
        })],
      holidayCoverage: [
        {
          from: '2026-09-01',
          through: '2026-09-30',
          result: {
            status: 'available',
            holidays: [{ date: '2026-09-21', name: '敬老の日' }],
          },
        },
      ],
    });

    expect(result).toEqual([
      {
        ...gridDate,
        isToday: true,
        isSelected: true,
        hasEvents: true,
        holidaySupport: 'available',
        holidayName: '敬老の日',
        accessibilityLabel: '2026年9月21日、敬老の日、今日、選択中、予定あり',
      },
    ]);
  });

  it('祝日情報が未対応でも日付を通常日として確定せず祝日名を空にする', () => {
    const result = createMonthDayViewModels({
      grid: [gridDate],
      selectedDate: '2026-09-20',
      today: '2026-09-20',
      occurrences: [],
      holidayCoverage: [
        {
          from: '2026-09-01',
          through: '2026-09-30',
          result: { status: 'unsupported' },
        },
      ],
    });

    expect(result[0]).toMatchObject({
      holidaySupport: 'unsupported',
      holidayName: null,
      accessibilityLabel: '2026年9月21日、祝日情報未対応',
    });
  });

  it('正確な予定は開始時刻を表示する', () => {
    const event: CalendarEvent = {
      ...baseEvent,
      temporalType: 'exact',
      startTime: '14:30',
      duration: { type: 'fixed', minutes: 30 },
    };

    expect(createAgendaItems([asOccurrence(event)], new Map())).toEqual([
      {
        id: 'event-1',
        eventId: 'event-1',
        title: '敬老会',
        temporalLabel: '14:30',
        accessibilityLabel: '敬老会、14:30',
      },
    ]);
  });

  it('翌日へまたぐ正確な予定は翌日の月表示にも予定ありとして示す', () => {
    const result = createMonthDayViewModels({
      grid: [{ ...gridDate, date: '2026-09-22', dayNumber: 22 }],
      selectedDate: '2026-09-22',
      today: '2026-09-21',
      occurrences: [asOccurrence({
        ...baseEvent,
        anchorDate: '2026-09-21',
        temporalType: 'exact',
        startTime: '23:30',
        duration: { type: 'fixed', minutes: 60 },
      }, '2026-09-22')],
      holidayCoverage: [],
    });

    expect(result[0]).toMatchObject({ hasEvents: true });
  });

  it('終日予定は終日と表示する', () => {
    const event: CalendarEvent = {
      ...baseEvent, temporalType: 'allDay', endDate: baseEvent.anchorDate,
    };

    expect(createAgendaItems([asOccurrence(event)], new Map())).toEqual([
      {
        id: 'event-1',
        eventId: 'event-1',
        title: '敬老会',
        temporalLabel: '終日',
        accessibilityLabel: '敬老会、終日',
      },
    ]);
  });

  it('ざっくり予定は定義ラベルを表示する', () => {
    const event: CalendarEvent = {
      ...baseEvent,
      temporalType: 'fuzzy',
      temporalDefinitionId: 'personal-default:afternoon',
      endDate: baseEvent.anchorDate,
      resolutionContext: null,
    };

    expect(createAgendaItems(
      [asOccurrence(event)],
      new Map([['personal-default:afternoon', '午後']]),
    ))
      .toEqual([
        {
          id: 'event-1',
          eventId: 'event-1',
          title: '敬老会',
          temporalLabel: '午後',
          accessibilityLabel: '敬老会、午後',
        },
      ]);
  });

  it('相対予定は対象期間を帯として識別できる表示モデルにする', () => {
    const event: CalendarEvent = {
      ...baseEvent,
      anchorDate: '2026-09-21',
      temporalType: 'fuzzy',
      temporalDefinitionId: 'personal-default:this_week',
      endDate: '2026-09-25',
      resolutionContext: {
        version: 1,
        referenceDate: '2026-09-21',
        periodAnchorDate: '2026-09-21',
        parameterSnapshot: { thisWeekDeadlineWeekday: 5 },
      },
    };
    const occurrence = asOccurrence(event);

    const days = createMonthDayViewModels({
      grid: [gridDate],
      selectedDate: gridDate.date,
      today: gridDate.date,
      occurrences: [occurrence],
      holidayCoverage: [],
      definitionLabels: new Map([['personal-default:this_week', '今週中']]),
    });

    expect(days[0]).toMatchObject({
      hasEvents: true,
      hasFixedEvents: false,
      hasFuzzyRangeEvents: true,
      accessibilityLabel: expect.stringContaining('今週中1件'),
    });
    expect(createAgendaItems(
      [occurrence],
      new Map([['personal-default:this_week', '今週中']]),
    )).toEqual([expect.objectContaining({
      kind: 'fuzzyRange',
      rangeLabel: '9月21日〜9月25日',
      temporalLabel: '今週中・9月21日〜9月25日',
      accessibilityLabel: expect.stringContaining('相対予定'),
    })]);
  });

  it('定義が見つからないざっくり予定はざっくりへフォールバックする', () => {
    const event: CalendarEvent = {
      ...baseEvent,
      temporalType: 'fuzzy',
      temporalDefinitionId: 'personal-default:missing',
      endDate: baseEvent.anchorDate,
      resolutionContext: null,
    };

    expect(createAgendaItems([asOccurrence(event)], new Map())).toEqual([
      {
        id: 'event-1',
        eventId: 'event-1',
        title: '敬老会',
        temporalLabel: 'ざっくり',
        accessibilityLabel: '敬老会、ざっくり',
      },
    ]);
  });
});
