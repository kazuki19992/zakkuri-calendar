import type { CalendarEvent } from '@/domain/calendar/event';
import type { MonthGridDate } from '@/domain/calendar/month';
import { createAgendaItems, createMonthDayViewModels } from '../month-view-model';

const baseEvent = {
  id: 'event-1',
  calendarId: 'personal-default',
  title: '敬老会',
  anchorDate: '2026-09-21',
  createdTimeZoneId: 'Asia/Tokyo',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
} as const;

const gridDate: MonthGridDate = {
  date: '2026-09-21',
  dayNumber: 21,
  weekday: 1,
  isCurrentMonth: true,
};

describe('月表示の表示用モデル', () => {
  it('今日で選択中かつ祝日と予定ありの日を読み上げ可能な文言へ変換する', () => {
    const result = createMonthDayViewModels({
      grid: [gridDate],
      selectedDate: '2026-09-21',
      today: '2026-09-21',
      events: [
        {
          ...baseEvent,
          temporalType: 'allDay',
        },
      ],
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
      events: [],
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

    expect(createAgendaItems([event], new Map())).toEqual([
      {
        id: 'event-1',
        title: '敬老会',
        temporalLabel: '14:30',
        accessibilityLabel: '敬老会、14:30',
      },
    ]);
  });

  it('終日予定は終日と表示する', () => {
    const event: CalendarEvent = { ...baseEvent, temporalType: 'allDay' };

    expect(createAgendaItems([event], new Map())).toEqual([
      {
        id: 'event-1',
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
    };

    expect(createAgendaItems([event], new Map([['personal-default:afternoon', '午後']])))
      .toEqual([
        {
          id: 'event-1',
          title: '敬老会',
          temporalLabel: '午後',
          accessibilityLabel: '敬老会、午後',
        },
      ]);
  });

  it('定義が見つからないざっくり予定はざっくりへフォールバックする', () => {
    const event: CalendarEvent = {
      ...baseEvent,
      temporalType: 'fuzzy',
      temporalDefinitionId: 'personal-default:missing',
    };

    expect(createAgendaItems([event], new Map())).toEqual([
      {
        id: 'event-1',
        title: '敬老会',
        temporalLabel: 'ざっくり',
        accessibilityLabel: '敬老会、ざっくり',
      },
    ]);
  });
});
