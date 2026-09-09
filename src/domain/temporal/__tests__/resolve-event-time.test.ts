import type { CalendarEvent } from '@/domain/calendar/event';
import type { TemporalDefinition } from '../temporal-definition';
import { resolveEventTime } from '../resolve-event-time';

const eventBase = {
  calendarId: 'personal-default',
  title: '予定',
  anchorDate: '2026-09-09',
  createdTimeZoneId: 'Asia/Tokyo',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
} as const;

const definitionBase = {
  id: 'personal-default:custom',
  calendarId: 'personal-default',
  key: 'custom',
  label: '独自時間',
  granularity: 'day',
  resolverConfig: { kind: 'timeOfDay', startMinute: 600, endMinute: 720 },
  fadeInRatio: 0,
  fadeOutRatio: 0,
  isSystem: false,
  isEnabled: true,
  sortOrder: 1,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
} as const satisfies TemporalDefinition;

function exactEvent(
  startTime: string,
  duration: Extract<CalendarEvent, { temporalType: 'exact' }>['duration'],
): CalendarEvent {
  return {
    ...eventBase,
    id: `exact-${startTime}-${duration.type}`,
    temporalType: 'exact',
    startTime,
    duration,
  };
}

describe('予定の時間範囲解決', () => {
  it.each([
    [10, 10],
    [15, 15],
    [30, 30],
    [60, 60],
  ] as const)('固定%d分を開始時刻からの範囲へ解決する', (minutes, expectedLength) => {
    expect(resolveEventTime({
      event: exactEvent('14:30', { type: 'fixed', minutes }),
      definition: null,
      undeterminedFadeMinutes: 120,
    })).toEqual({
      kind: 'timed',
      startMinute: 870,
      endMinute: 870 + expectedLength,
      fadeInRatio: 0,
      fadeOutRatio: 0,
      isInstant: false,
    });
  });

  it('瞬間は開始と終了が同じ範囲になる', () => {
    expect(resolveEventTime({
      event: exactEvent('00:00', { type: 'instant' }),
      definition: null,
      undeterminedFadeMinutes: 120,
    })).toEqual({
      kind: 'timed', startMinute: 0, endMinute: 0,
      fadeInRatio: 0, fadeOutRatio: 0, isInstant: true,
    });
  });

  it('未定は設定した分数だけ開始から薄くする', () => {
    expect(resolveEventTime({
      event: exactEvent('14:30', { type: 'undetermined' }),
      definition: null,
      undeterminedFadeMinutes: 90,
    })).toEqual({
      kind: 'timed', startMinute: 870, endMinute: 960,
      fadeInRatio: 0, fadeOutRatio: 1, isInstant: false,
    });
  });

  it('23時59分からの固定予定は翌日へ続く分数を保つ', () => {
    expect(resolveEventTime({
      event: exactEvent('23:59', { type: 'fixed', minutes: 60 }),
      definition: null,
      undeterminedFadeMinutes: 120,
    })).toMatchObject({ kind: 'timed', startMinute: 1439, endMinute: 1499 });
  });

  it.each([
    [0, 0],
    [0.25, 0],
    [0, 0.35],
    [0.5, 0.5],
  ] as const)('日内定義のフェード比率%d/%dをそのまま解決する', (fadeInRatio, fadeOutRatio) => {
    const definition: TemporalDefinition = { ...definitionBase, fadeInRatio, fadeOutRatio };
    const event: CalendarEvent = {
      ...eventBase,
      id: 'fuzzy',
      temporalType: 'fuzzy',
      temporalDefinitionId: definition.id,
    };

    expect(resolveEventTime({ event, definition, undeterminedFadeMinutes: 120 })).toEqual({
      kind: 'timed', startMinute: 600, endMinute: 720,
      fadeInRatio, fadeOutRatio, isInstant: false,
    });
  });

  it('終日予定を時間軸外として解決する', () => {
    const event: CalendarEvent = { ...eventBase, id: 'all-day', temporalType: 'allDay' };
    expect(resolveEventTime({ event, definition: null, undeterminedFadeMinutes: 120 }))
      .toEqual({ kind: 'allDay' });
  });

  it('定義不在または日内以外の定義は未解決にする', () => {
    const event: CalendarEvent = {
      ...eventBase,
      id: 'fuzzy',
      temporalType: 'fuzzy',
      temporalDefinitionId: definitionBase.id,
    };
    const weekDefinition: TemporalDefinition = {
      ...definitionBase,
      granularity: 'week',
      resolverConfig: {
        kind: 'week', selectionWeekOffset: 0, startWeekday: 1, endWeekday: 3,
      },
    };

    expect(resolveEventTime({ event, definition: null, undeterminedFadeMinutes: 120 }))
      .toEqual({ kind: 'unresolved' });
    expect(resolveEventTime({ event, definition: weekDefinition, undeterminedFadeMinutes: 120 }))
      .toEqual({ kind: 'unresolved' });
  });
});
