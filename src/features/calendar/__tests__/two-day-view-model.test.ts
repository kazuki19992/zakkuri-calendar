import type { CalendarEvent } from '@/domain/calendar/event';
import { createTwoDayViewModels } from '../two-day-view-model';

const baseEvent = {
  calendarId: 'personal-default',
  createdTimeZoneId: 'Asia/Tokyo',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
} as const;

describe('2日表示の表示用モデル', () => {
  it('月境界を越える2日を順番にし、今日・祝日・日別予定を反映する', () => {
    const events: readonly CalendarEvent[] = [
      {
        ...baseEvent,
        id: 'event-1',
        title: '振り返り',
        anchorDate: '2026-09-30',
        temporalType: 'exact',
        startTime: '14:30',
        duration: { type: 'fixed', minutes: 30 },
      },
      {
        ...baseEvent,
        id: 'event-2',
        title: '散歩',
        anchorDate: '2026-10-01',
        temporalType: 'fuzzy',
        temporalDefinitionId: 'personal-default:afternoon',
      },
    ];

    const result = createTwoDayViewModels({
      range: { from: '2026-09-30', through: '2026-10-01' },
      today: '2026-09-30',
      events,
      definitionLabels: new Map([['personal-default:afternoon', '午後']]),
      holidayCoverage: [
        {
          from: '2026-09-01',
          through: '2026-09-30',
          result: { status: 'available', holidays: [] },
        },
        {
          from: '2026-10-01',
          through: '2026-10-31',
          result: {
            status: 'available',
            holidays: [{ date: '2026-10-01', name: 'テスト記念日' }],
          },
        },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      date: '2026-09-30',
      dateLabel: '9月30日',
      weekdayLabel: '水',
      isToday: true,
      holidayName: null,
      holidaySupport: 'available',
      items: [
        {
          id: 'event-1',
          title: '振り返り',
          temporalLabel: '14:30',
          accessibilityLabel: '振り返り、14:30',
        },
      ],
      accessibilityLabel: '2026年9月30日、水曜日、今日、予定1件',
    });
    expect(result[1]).toMatchObject({
      date: '2026-10-01',
      dateLabel: '10月1日',
      weekdayLabel: '木',
      isToday: false,
      holidayName: 'テスト記念日',
      holidaySupport: 'available',
      items: [{ temporalLabel: '午後' }],
      accessibilityLabel: '2026年10月1日、木曜日、テスト記念日、予定1件',
    });
  });

  it('年境界を越え、祝日未対応と予定なしを読み上げへ反映する', () => {
    const result = createTwoDayViewModels({
      range: { from: '2026-12-31', through: '2027-01-01' },
      today: '2026-09-30',
      events: [],
      definitionLabels: new Map(),
      holidayCoverage: [
        { from: '2026-12-01', through: '2026-12-31', result: { status: 'unsupported' } },
        { from: '2027-01-01', through: '2027-01-31', result: { status: 'unsupported' } },
      ],
    });

    expect(result.map((day) => day.date)).toEqual(['2026-12-31', '2027-01-01']);
    expect(result[0]).toMatchObject({
      holidaySupport: 'unsupported',
      holidayName: null,
      items: [],
      accessibilityLabel: '2026年12月31日、木曜日、祝日情報未対応、予定なし',
    });
  });
});
