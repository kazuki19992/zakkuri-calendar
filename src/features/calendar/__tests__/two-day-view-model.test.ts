import type { CalendarEvent } from '@/domain/calendar/event';
import type { EventOccurrence } from '@/domain/calendar/event-occurrence';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import {
  createTwoDayAllDayLayout,
  createTwoDayStripDates,
  createTwoDayStripViewModels,
  createTwoDayViewModels,
} from '../two-day-view-model';

const baseEvent = {
  calendarId: 'personal-default',
  createdTimeZoneId: 'Asia/Tokyo',
  location: null,
  noteDocument: null,
  colorId: null,
  recurrenceRule: null,
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

function asOccurrence(event: CalendarEvent): EventOccurrence {
  return {
    key: event.id,
    eventId: event.id,
    occurrenceIdentity: null,
    occurrenceStartDate: event.anchorDate,
    occurrenceThroughDate: event.temporalType === 'allDay' || event.temporalType === 'fuzzy'
      ? event.endDate
      : event.anchorDate,
    isRecurring: false,
    event,
  };
}

function asOccurrences(events: readonly CalendarEvent[]): readonly EventOccurrence[] {
  return events.map(asOccurrence);
}

describe('2日表示の表示用モデル', () => {
  it('同じシリーズの発生回を異なるkeyと同じ元予定IDで表示する', () => {
    const event: CalendarEvent = {
      ...baseEvent,
      id: 'series-1',
      title: '朝会',
      anchorDate: '2026-09-01',
      temporalType: 'exact',
      startTime: '09:00',
      duration: { type: 'fixed', minutes: 30 },
    };
    const occurrences: readonly EventOccurrence[] = ['2026-09-30', '2026-10-01'].map((date) => ({
      key: `series-1:recurrence:${date}`,
      eventId: 'series-1',
      occurrenceIdentity: { seriesEventId: 'series-1', originalOccurrenceDate: date },
      occurrenceStartDate: date,
      occurrenceThroughDate: date,
      isRecurring: true,
      event,
    }));

    const result = createTwoDayViewModels({
      range: { from: '2026-09-30', through: '2026-10-01' },
      today: '2026-09-30',
      occurrences,
      definitions: new Map(),
      undeterminedFadeMinutes: 120,
      holidayCoverage,
    });

    expect(result.flatMap((day) => day.timelineItems)).toMatchObject([
      {
        id: 'series-1:recurrence:2026-09-30',
        eventId: 'series-1',
        accessibilityLabel: expect.stringContaining('繰り返し予定'),
      },
      {
        id: 'series-1:recurrence:2026-10-01',
        eventId: 'series-1',
        accessibilityLabel: expect.stringContaining('繰り返し予定'),
      },
    ]);
  });

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
        endDate: '2026-10-01',
        resolutionContext: null,
      },
    ];

    const result = createTwoDayViewModels({
      range: { from: '2026-09-30', through: '2026-10-01' },
      today: '2026-09-30',
      occurrences: asOccurrences(events),
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
      allDayItems: [{
        kind: 'holiday', id: 'holiday:2026-10-01', eventId: null, colorId: 'holiday', isInteractive: false,
        title: 'テスト記念日', temporalLabel: '祝日',
        accessibilityLabel: 'テスト記念日、祝日',
      }],
      timelineItems: [{ id: 'event-2', temporalLabel: '午後' }],
      accessibilityLabel: '2026年10月1日、木曜日、テスト記念日、予定1件',
    });
  });

  it('終日予定と未解決予定を時間軸外に残す', () => {
    const events: readonly CalendarEvent[] = [
      {
        ...baseEvent, id: 'all-day', title: '休暇', anchorDate: '2026-09-30', colorId: 'purple',
        temporalType: 'allDay', endDate: '2026-09-30',
      },
      {
        ...baseEvent, id: 'missing', title: '未解決', anchorDate: '2026-09-30',
        temporalType: 'fuzzy', temporalDefinitionId: 'missing-definition',
        endDate: '2026-09-30', resolutionContext: null,
      },
    ];
    const result = createTwoDayViewModels({
      range: { from: '2026-09-30', through: '2026-10-01' }, today: '2026-09-30',
      occurrences: asOccurrences(events),
      definitions: new Map(), undeterminedFadeMinutes: 120, holidayCoverage,
    });

    expect(result[0].allDayItems).toEqual([
      {
        kind: 'event', id: 'all-day', eventId: 'all-day', colorId: 'purple', isInteractive: true, title: '休暇',
        temporalLabel: '終日', accessibilityLabel: '休暇、終日',
      },
      {
        kind: 'event', id: 'missing', eventId: 'missing', colorId: 'blue', isInteractive: true, title: '未解決',
        temporalLabel: 'ざっくり', accessibilityLabel: '未解決、ざっくり',
      },
    ]);
    expect(result[0].timelineItems).toEqual([]);
  });

  it('解決済みの相対予定を期間の位置が分かる終日項目として表示する', () => {
    const event: CalendarEvent = {
      ...baseEvent,
      id: 'relative-range',
      title: '資料を仕上げる',
      anchorDate: '2026-09-30',
      temporalType: 'fuzzy',
      temporalDefinitionId: 'personal-default:this_week',
      endDate: '2026-10-02',
      resolutionContext: {
        version: 1,
        referenceDate: '2026-09-30',
        periodAnchorDate: '2026-09-30',
        parameterSnapshot: { thisWeekDeadlineWeekday: 5 },
      },
    };

    const result = createTwoDayViewModels({
      range: { from: '2026-09-30', through: '2026-10-01' }, today: '2026-09-30',
      occurrences: asOccurrences([event]),
      definitions: new Map([['personal-default:this_week', {
        ...afternoon,
        id: 'personal-default:this_week',
        key: 'this_week',
        label: '今週中',
        granularity: 'week',
        resolverConfig: { kind: 'weekRemainder', selectionWeekOffset: 0 },
        fadeInRatio: 1,
        fadeOutRatio: 0,
      }]]),
      undeterminedFadeMinutes: 120,
      holidayCoverage,
    });

    expect(result[0].allDayItems[0]).toMatchObject({
      kind: 'fuzzyRange',
      rangePosition: 'start',
      temporalLabel: '今週中・9月30日〜10月2日',
      accessibilityLabel: expect.stringContaining('相対予定、期間の開始'),
    });
    expect(result[1].allDayItems[1]).toMatchObject({
      kind: 'fuzzyRange',
      rangePosition: 'middle',
      temporalLabel: '今週中・9月30日〜10月2日',
      accessibilityLabel: expect.stringContaining('相対予定、期間の途中'),
    });

    const layout = createTwoDayAllDayLayout(result);
    expect(layout.segments.find((segment) => segment.id === 'relative-range')).toMatchObject({
      startIndex: 0,
      spanDays: 2,
      isFuzzyRange: true,
      opacityStops: [
        { offset: 0, opacity: 0 },
        { offset: 1, opacity: 0.666667 },
      ],
    });
  });

  it('祝日と利用者の終日予定を分け、祝日を先頭の読み取り専用項目にする', () => {
    const result = createTwoDayViewModels({
      range: { from: '2026-10-01', through: '2026-10-02' },
      today: '2026-09-30',
      occurrences: asOccurrences([{
        ...baseEvent, id: 'all-day', title: '休暇', anchorDate: '2026-10-01',
        temporalType: 'allDay', endDate: '2026-10-01',
      }]),
      definitions: new Map(),
      undeterminedFadeMinutes: 120,
      holidayCoverage,
    });

    expect(result[0].allDayItems).toEqual([
      {
        kind: 'holiday', id: 'holiday:2026-10-01', eventId: null, colorId: 'holiday', isInteractive: false,
        title: 'テスト記念日', temporalLabel: '祝日',
        accessibilityLabel: 'テスト記念日、祝日',
      },
      {
        kind: 'event', id: 'all-day', eventId: 'all-day', colorId: 'blue', isInteractive: true, title: '休暇',
        temporalLabel: '終日', accessibilityLabel: '休暇、終日',
      },
    ]);
    expect(result[0].accessibilityLabel).toBe('2026年10月1日、木曜日、テスト記念日、予定1件');
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
      endDate: '2026-09-30', resolutionContext: null,
    };
    const result = createTwoDayViewModels({
      range: { from: '2026-09-30', through: '2026-10-01' }, today: '2026-09-30',
      occurrences: asOccurrences([event]), definitions: new Map([[lateNight.id, lateNight]]),
      undeterminedFadeMinutes: 120, holidayCoverage,
    });

    expect(result[0].timelineItems[0]).toMatchObject({ continuesToNextDay: true });
    expect(result[1].timelineItems[0]).toMatchObject({ continuesFromPreviousDay: true });
  });

  it('年境界を越え、祝日未対応と予定なしを読み上げへ反映する', () => {
    const result = createTwoDayViewModels({
      range: { from: '2026-12-31', through: '2027-01-01' }, today: '2026-09-30',
      occurrences: [], definitions: new Map(), undeterminedFadeMinutes: 120,
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
      occurrences: asOccurrences(events),
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

describe('2日表示の終日レーン', () => {
  it('表示端で1日だけ見える複数日予定を祝日と単日予定より優先する', () => {
    const day = {
      date: '2026-09-08', dateLabel: '9月8日', weekdayLabel: '火', isToday: false,
      holidayName: '記念日', holidaySupport: 'available' as const, timelineItems: [],
      accessibilityLabel: '2026年9月8日、火曜日',
      allDayItems: [
        { kind: 'event' as const, id: 'a-single', eventId: 'a-single', colorId: 'blue' as const,
          isInteractive: true, title: '単日', temporalLabel: '終日', accessibilityLabel: '単日、終日' },
        { kind: 'holiday' as const, id: 'holiday:2026-09-08', eventId: null, colorId: 'holiday' as const,
          isInteractive: false, title: '記念日', temporalLabel: '祝日', accessibilityLabel: '記念日、祝日' },
        { kind: 'fuzzyRange' as const, id: 'z-multi', eventId: 'z-multi', colorId: 'blue' as const,
          isInteractive: true, title: '複数日', temporalLabel: '今週中', rangePosition: 'middle' as const,
          accessibilityLabel: '複数日、今週中、期間の途中' },
      ],
    };

    const layout = createTwoDayAllDayLayout([day]);

    expect(layout.segments.map((segment) => segment.id)).toEqual(['z-multi', 'holiday:2026-09-08']);
    expect(layout.hiddenCounts).toEqual([1]);
  });
});
