import type { CalendarEvent } from '../event';
import type { EventAggregate } from '../event-reminder';
import type { RecurrenceException } from '../recurrence-exception';
import {
  buildSeriesScopedAggregate,
  getChangedEventFields,
  planFollowingMutation,
  planSeriesMutation,
} from '../recurrence-change';

const NOW = '2026-10-01T00:00:00.000Z';

function aggregate(overrides: Partial<CalendarEvent> = {}): EventAggregate {
  return {
    event: {
      id: 'series-1', calendarId: 'personal-default', title: '定例会',
      temporalType: 'exact', anchorDate: '2026-10-05', startTime: '09:00',
      duration: { type: 'fixed', minutes: 30 }, createdTimeZoneId: 'Asia/Tokyo',
      location: null, notes: null, colorId: 'blue',
      recurrenceRule: { version: 1, frequency: 'weekly', interval: 1,
        weekdays: [1], end: { type: 'never' } },
      createdAt: NOW, updatedAt: NOW, ...overrides,
    } as CalendarEvent,
    reminders: [],
  };
}

const futureException: RecurrenceException = {
  seriesEventId: 'series-1', originalOccurrenceDate: '2026-10-19',
  kind: 'replaced', replacementEventId: 'replacement-1', overrideFields: ['location'],
  createdAt: NOW, updatedAt: NOW,
};

describe('繰り返しシリーズの変更計画', () => {
  test('今回変更したフィールドだけを返す', () => {
    const before = aggregate();
    const after = aggregate({ title: '新しい定例会' });
    expect(getChangedEventFields(before, after)).toEqual(['title']);
  });

  test('既存の個別変更を広げず今回変更した値だけシリーズ基準へ適用する', () => {
    const series = aggregate();
    const displayed = aggregate({ title: 'この回だけ', anchorDate: '2026-10-12' });
    const submitted = aggregate({
      title: 'この回だけ', anchorDate: '2026-10-12', notes: '今回追加',
    });

    expect(buildSeriesScopedAggregate({ series, occurrenceDate: '2026-10-12', displayed, submitted }))
      .toMatchObject({ event: { title: '定例会', notes: '今回追加', anchorDate: '2026-10-12' } });
  });

  test('これ以降では旧シリーズを境界直前で閉じ通常の新シリーズを作る', () => {
    const plan = planFollowingMutation({
      series: aggregate(),
      boundaryDate: '2026-10-12',
      submitted: aggregate({ title: '新しい定例会', anchorDate: '2026-10-12' }),
      exceptions: [futureException],
      createSeriesId: () => 'series-2',
      now: NOW,
    });

    expect(plan.previousSeries?.event.recurrenceRule?.end)
      .toEqual({ type: 'until', date: '2026-10-11' });
    expect(plan.nextSeries?.event).toMatchObject({
      id: 'series-2', title: '新しい定例会', anchorDate: '2026-10-12',
    });
    expect(plan.upsertExceptions).toEqual([
      expect.objectContaining({ seriesEventId: 'series-2', originalOccurrenceDate: '2026-10-19' }),
    ]);
  });

  test('count規則は境界より前を旧シリーズ、残数を新シリーズへ割り当てる', () => {
    const series = aggregate({ recurrenceRule: {
      version: 1, frequency: 'weekly', interval: 1, weekdays: [1],
      end: { type: 'count', count: 5 },
    } });
    const plan = planFollowingMutation({
      series, boundaryDate: '2026-10-19',
      submitted: aggregate({ ...series.event, anchorDate: '2026-10-19' }),
      exceptions: [], createSeriesId: () => 'series-2', now: NOW,
    });
    expect(plan.previousSeries?.event.recurrenceRule?.end).toEqual({ type: 'count', count: 2 });
    expect(plan.nextSeries?.event.recurrenceRule?.end).toEqual({ type: 'count', count: 3 });
  });

  test('先頭Occurrenceからの分割では空の旧シリーズを残さない', () => {
    const plan = planFollowingMutation({
      series: aggregate(), boundaryDate: '2026-10-05',
      submitted: aggregate(), exceptions: [], createSeriesId: () => 'series-2', now: NOW,
    });
    expect(plan.previousSeries).toBeNull();
    expect(plan.nextSeries?.event.id).toBe('series-2');
  });

  test('規則変更時は対象例外を転送せず削除対象にする', () => {
    const plan = planFollowingMutation({
      series: aggregate(), boundaryDate: '2026-10-12',
      submitted: aggregate({ anchorDate: '2026-10-12', recurrenceRule: {
        version: 1, frequency: 'daily', interval: 1, weekdays: [], end: { type: 'never' },
      } }),
      exceptions: [futureException], createSeriesId: () => 'series-2', now: NOW,
    });
    expect(plan.upsertExceptions).toEqual([]);
    expect(plan.deleteExceptionIdentities).toEqual([{
      seriesEventId: 'series-1', originalOccurrenceDate: '2026-10-19',
    }]);
    expect(plan.deleteReplacementEventIds).toEqual(['replacement-1']);
  });

  test('すべての変更では現在のシリーズIDだけを維持する', () => {
    const plan = planSeriesMutation({
      series: aggregate(), boundaryDate: '2026-10-05',
      submitted: aggregate({ title: '全体変更' }),
      exceptions: [futureException], now: NOW,
    });
    expect(plan.nextSeries?.event).toMatchObject({ id: 'series-1', title: '全体変更' });
    expect(plan.upsertExceptions).toEqual([futureException]);
  });

  test('すべての日付移動はシリーズanchorと既存例外を同じ日数だけ移す', () => {
    const plan = planSeriesMutation({
      series: aggregate(), boundaryDate: '2026-10-12',
      submitted: aggregate({ anchorDate: '2026-10-13' }),
      exceptions: [futureException], now: NOW,
    });
    expect(plan.nextSeries?.event.anchorDate).toBe('2026-10-06');
    expect(plan.upsertExceptions[0].originalOccurrenceDate).toBe('2026-10-20');
    expect(plan.deleteExceptionIdentities).toEqual([{
      seriesEventId: 'series-1', originalOccurrenceDate: '2026-10-19',
    }]);
  });

  test('月末シリーズの例外は日数ではなく発生順で移送する', () => {
    const series = aggregate({
      anchorDate: '2026-01-31',
      recurrenceRule: { version: 1, frequency: 'monthly', interval: 1,
        weekdays: [], end: { type: 'never' } },
    });
    const exception = { ...futureException, originalOccurrenceDate: '2026-05-31' };
    const plan = planFollowingMutation({
      series, boundaryDate: '2026-03-31',
      submitted: aggregate({ ...series.event, anchorDate: '2026-04-01' }),
      exceptions: [exception], createSeriesId: () => 'series-2', now: NOW,
    });

    expect(plan.upsertExceptions[0].originalOccurrenceDate).toBe('2026-05-01');
  });

  test('週次シリーズの日付移動は曜日集合も回転する', () => {
    const plan = planFollowingMutation({
      series: aggregate(), boundaryDate: '2026-10-12',
      submitted: aggregate({ anchorDate: '2026-10-13' }), exceptions: [],
      createSeriesId: () => 'series-2', now: NOW,
    });

    expect(plan.nextSeries?.event.recurrenceRule?.weekdays).toEqual([2]);
  });
});
