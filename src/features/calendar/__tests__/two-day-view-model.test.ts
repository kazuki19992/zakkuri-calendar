import type { CalendarEvent } from '@/domain/calendar/event';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import {
  createTwoDayStripDates,
  createTwoDayStripViewModels,
  createTwoDayViewModels,
} from '../two-day-view-model';

const baseEvent = {
  calendarId: 'personal-default',
  createdTimeZoneId: 'Asia/Tokyo',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
} as const;

const afternoon: TemporalDefinition = {
  id: 'personal-default:afternoon',
  calendarId: 'personal-default',
  key: 'afternoon',
  label: '午後',
  granularity: 'day',
  resolverConfig: { kind: 'timeOfDay', startMinute: 720, endMinute: 1020 },
  fadeInRatio: 0,
  fadeOutRatio: 0.35,
  isSystem: true,
  isEnabled: true,
  sortOrder: 1,
  createdAt: baseEvent.createdAt,
  updatedAt: baseEvent.updatedAt,
};

const holidayCoverage = [
  { from: '2026-09-01', through: '2026-09-30', result: { status: 'available', holidays: [] } },
  {
    from: '2026-10-01',
    through: '2026-10-31',
    result: {
      status: 'available',
      holidays: [{ date: '2026-10-01', name: 'テスト記念日' }],
    },
  },
] as const;

describe('2日表示の表示用モデル', () => {
  it('月境界を越える2日を順番にし、予定を時間軸へ配置する', () => {
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
        temporalDefinitionId: afternoon.id,
      },
    ];

    const result = createTwoDayViewModels({
      range: { from: '2026-09-30', through: '2026-10-01' },
      today: '2026-09-30',
      events,
      definitions: new Map([[afternoon.id, afternoon]]),
      undeterminedFadeMinutes: 120,
      holidayCoverage,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      date: '2026-09-30', dateLabel: '9月30日', weekdayLabel: '水', isToday: true,
      holidayName: null, holidaySupport: 'available', allDayItems: [],
      timelineItems: [{ id: 'event-1', title: '振り返り', temporalLabel: '14:30・30分' }],
      accessibilityLabel: '2026年9月30日、水曜日、今日、予定1件',
    });
    expect(result[1]).toMatchObject({
      date: '2026-10-01', holidayName: 'テスト記念日',
      timelineItems: [{ id: 'event-2', temporalLabel: '午後' }],
      accessibilityLabel: '2026年10月1日、木曜日、テスト記念日、予定1件',
    });
  });

  it('終日予定と未解決予定を時間軸外に残す', () => {
    const events: readonly CalendarEvent[] = [
      { ...baseEvent, id: 'all-day', title: '休暇', anchorDate: '2026-09-30', temporalType: 'allDay' },
      {
        ...baseEvent, id: 'missing', title: '未解決', anchorDate: '2026-09-30',
        temporalType: 'fuzzy', temporalDefinitionId: 'missing-definition',
      },
    ];
    const result = createTwoDayViewModels({
      range: { from: '2026-09-30', through: '2026-10-01' }, today: '2026-09-30', events,
      definitions: new Map(), undeterminedFadeMinutes: 120, holidayCoverage,
    });

    expect(result[0].allDayItems).toEqual([
      { id: 'all-day', title: '休暇', temporalLabel: '終日', accessibilityLabel: '休暇、終日' },
      { id: 'missing', title: '未解決', temporalLabel: 'ざっくり', accessibilityLabel: '未解決、ざっくり' },
    ]);
    expect(result[0].timelineItems).toEqual([]);
  });

  it('前日から続く予定を翌日の時間軸にも表示する', () => {
    const lateNight: TemporalDefinition = {
      ...afternoon, id: 'personal-default:late-night', label: '深夜',
      resolverConfig: { kind: 'timeOfDay', startMinute: 1320, endMinute: 1560 },
      fadeInRatio: 0.25, fadeOutRatio: 0.25,
    };
    const event: CalendarEvent = {
      ...baseEvent, id: 'late', title: '読書', anchorDate: '2026-09-30',
      temporalType: 'fuzzy', temporalDefinitionId: lateNight.id,
    };
    const result = createTwoDayViewModels({
      range: { from: '2026-09-30', through: '2026-10-01' }, today: '2026-09-30',
      events: [event], definitions: new Map([[lateNight.id, lateNight]]),
      undeterminedFadeMinutes: 120, holidayCoverage,
    });

    expect(result[0].timelineItems[0]).toMatchObject({ continuesToNextDay: true });
    expect(result[1].timelineItems[0]).toMatchObject({ continuesFromPreviousDay: true });
  });

  it('年境界を越え、祝日未対応と予定なしを読み上げへ反映する', () => {
    const result = createTwoDayViewModels({
      range: { from: '2026-12-31', through: '2027-01-01' }, today: '2026-09-30',
      events: [], definitions: new Map(), undeterminedFadeMinutes: 120,
      holidayCoverage: [
        { from: '2026-12-01', through: '2026-12-31', result: { status: 'unsupported' } },
        { from: '2027-01-01', through: '2027-01-31', result: { status: 'unsupported' } },
      ],
    });

    expect(result.map((day) => day.date)).toEqual(['2026-12-31', '2027-01-01']);
    expect(result[0]).toMatchObject({
      holidaySupport: 'unsupported', holidayName: null, allDayItems: [], timelineItems: [],
      accessibilityLabel: '2026年12月31日、木曜日、祝日情報未対応、予定なし',
    });
  });
});

describe('2日ビューのスワイプ用予備列', () => {
  it('前後に指定した日数分の予備列を加えた日付の並びを返す', () => {
    const range = { from: '2026-09-30', through: '2026-10-01' };

    expect(createTwoDayStripDates(range, 1)).toEqual([
      '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02',
    ]);
    expect(createTwoDayStripDates(range, 2)).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03',
    ]);
  });

  it('予備日数0では表示する2日だけを返す', () => {
    expect(createTwoDayStripDates({ from: '2026-09-08', through: '2026-09-09' }, 0))
      .toEqual(['2026-09-08', '2026-09-09']);
  });

  it('予備列も含めて各日の表示用モデルを作る', () => {
    const events: readonly CalendarEvent[] = [
      {
        ...baseEvent, id: 'prev-event', title: '前日の予定', anchorDate: '2026-09-29',
        temporalType: 'exact', startTime: '10:00', duration: { type: 'fixed', minutes: 30 },
      },
      {
        ...baseEvent, id: 'next-event', title: '翌々日の予定', anchorDate: '2026-10-02',
        temporalType: 'exact', startTime: '10:00', duration: { type: 'fixed', minutes: 30 },
      },
    ];

    const result = createTwoDayStripViewModels({
      range: { from: '2026-09-30', through: '2026-10-01' },
      bufferDays: 1,
      today: '2026-09-30',
      events,
      definitions: new Map(),
      undeterminedFadeMinutes: 120,
      holidayCoverage,
    });

    expect(result.map((day) => day.date)).toEqual([
      '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02',
    ]);
    expect(result[0].timelineItems).toMatchObject([{ id: 'prev-event' }]);
    expect(result[3].timelineItems).toMatchObject([{ id: 'next-event' }]);
  });
});
