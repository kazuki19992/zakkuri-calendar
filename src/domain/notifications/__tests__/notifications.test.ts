import {
  parseReminderTiming,
  defaultReminderTiming,
  timingLabel,
  timingIsCompatible,
} from '../reminder-timing';
import { planNotifications } from '../notification-plan';
import type { CalendarEvent } from '@/domain/calendar/event';
import { createStandardTemporalDefinitions } from '@/domain/temporal/standard-definitions';
const event: CalendarEvent = {
  id: 'e',
  calendarId: 'c',
  title: '予定',
  anchorDate: '2026-11-13',
  temporalType: 'exact',
  startTime: '14:00',
  duration: { type: 'fixed', minutes: 60 },
  location: null,
  noteDocument: null,
  colorId: null,
  recurrenceRule: null,
  createdTimeZoneId: 'Asia/Tokyo',
  createdAt: '',
  updatedAt: '',
};
const definitions = createStandardTemporalDefinitions('c', '2026-11-12');
function plan(
  e: CalendarEvent,
  timing = defaultReminderTiming('exact'),
  now = new Date(2026, 10, 12),
) {
  return planNotifications(
    {
      revision: 1,
      aggregates: [
        {
          event: e,
          reminders: [{ id: 'r', eventId: e.id, sortOrder: 0, timing }],
        },
      ],
      exceptions: [],
      definitions,
    },
    now,
  );
}
function local(date: number) {
  const d = new Date(date);
  return [
    d.getFullYear(),
    d.getMonth() + 1,
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
  ];
}
describe('通知時刻の計画', () => {
  test('きっちりは開始10分前、長さ未定でも開始を使う', () => {
    expect(local(plan(event).requests[0].fireAt)).toEqual([
      2026, 11, 13, 13, 50,
    ]);
    expect(
      local(
        plan({ ...event, duration: { type: 'undetermined' } }).requests[0]
          .fireAt,
      ),
    ).toEqual([2026, 11, 13, 13, 50]);
  });
  test('終日は複数日でも開始日の9時に一度だけ通知する', () => {
    const p = plan(
      { ...event, temporalType: 'allDay', endDate: '2026-11-16' },
      defaultReminderTiming('all_day'),
    );
    expect(p.requests).toHaveLength(1);
    expect(local(p.requests[0].fireAt)).toEqual([2026, 11, 13, 9, 0]);
  });
  test('朝の終了1時間前、深夜の翌日終了1時間前を計算する', () => {
    for (const [key, want] of [
      ['morning', [2026, 11, 13, 9, 0]],
      ['late_night', [2026, 11, 14, 1, 0]],
    ] as const) {
      expect(
        local(
          plan(
            {
              ...event,
              temporalType: 'fuzzy',
              temporalDefinitionId: `c:${key}`,
              endDate: event.anchorDate,
              resolutionContext: null,
            },
            defaultReminderTiming('fuzzy_day'),
          ).requests[0].fireAt,
        ),
      ).toEqual(want);
    }
  });
  test('金曜終了の週予定は木曜9時であり金曜0時ではない', () => {
    const p = plan(
      {
        ...event,
        anchorDate: '2026-11-09',
        temporalType: 'fuzzy',
        temporalDefinitionId: 'c:this_week',
        endDate: '2026-11-13',
        resolutionContext: null,
      },
      defaultReminderTiming('fuzzy_period'),
    );
    expect(local(p.requests[0].fireAt)).toEqual([2026, 11, 12, 9, 0]);
  });
  test('過ぎた通知を即時発火にせず、開始済み期間の未来通知は残す', () => {
    expect(
      plan(event, defaultReminderTiming('exact'), new Date(2026, 10, 13, 14))
        .requests,
    ).toHaveLength(0);
    expect(
      plan(
        {
          ...event,
          anchorDate: '2026-11-01',
          temporalType: 'fuzzy',
          temporalDefinitionId: 'c:month_last_third',
          endDate: '2026-11-30',
          resolutionContext: null,
        },
        defaultReminderTiming('fuzzy_period'),
      ).requests,
    ).toHaveLength(1);
  });
  test('通知の先行分を考慮して期間後に開催する予定も予約する', () => {
    const p = plan(
      { ...event, anchorDate: '2027-11-14' },
      {
        version: 1,
        kind: 'relativeMinutes',
        anchor: 'start',
        minutesBefore: 4320,
      },
    );
    expect(p.requests).toHaveLength(1);
  });
  test('繰り返しは近い60件だけ予約し残りを補充待ちにする', () => {
    const p = plan({
      ...event,
      recurrenceRule: {
        version: 1,
        frequency: 'daily',
        interval: 1,
        weekdays: [],
        end: { type: 'never' },
      },
    });
    expect(p.requests).toHaveLength(60);
    expect(p.deferred).toBe(true);
  });
  test('参照定義の欠損を成功扱いにしない', () => {
    expect(
      plan(
        {
          ...event,
          temporalType: 'fuzzy',
          temporalDefinitionId: 'missing',
          endDate: event.anchorDate,
          resolutionContext: null,
        },
        defaultReminderTiming('fuzzy_day'),
      ).failures,
    ).toHaveLength(1);
  });
});
describe('通知の入力規則', () => {
  test.each([-1, 0.5, NaN, 527040])(
    '新しい差分の不正値%sを拒否する',
    (minutesBefore) => {
      expect(
        parseReminderTiming({
          version: 1,
          kind: 'relativeMinutes',
          anchor: 'start',
          minutesBefore,
        }),
      ).toBeNull();
    },
  );
  test('未知versionと不正時刻を拒否し旧値の大きさは保持する', () => {
    expect(
      parseReminderTiming({
        version: 2,
        kind: 'legacyStartOffset',
        minutesBefore: 5,
      }),
    ).toBeNull();
    expect(
      parseReminderTiming({
        version: 1,
        kind: 'relativeDate',
        anchor: 'end',
        daysBefore: 1,
        time: '24:00',
      }),
    ).toBeNull();
    expect(
      parseReminderTiming({
        version: 1,
        kind: 'legacyStartOffset',
        minutesBefore: 1000000,
      }),
    ).not.toBeNull();
  });
  test('60分以上を時分で表示し基準も伝える', () => {
    expect(
      timingLabel({
        version: 1,
        kind: 'relativeMinutes',
        anchor: 'end',
        minutesBefore: 90,
      }),
    ).toBe('終了1時間30分前');
  });
  test('開始通知は朝へ移行できるが未定の終了通知は保存できない', () => {
    expect(
      timingIsCompatible(
        defaultReminderTiming('exact'),
        {
          ...event,
          temporalType: 'fuzzy',
          temporalDefinitionId: 'c:morning',
          endDate: event.anchorDate,
          resolutionContext: null,
        },
        definitions,
      ),
    ).toBe(true);
    expect(
      timingIsCompatible(
        {
          version: 1,
          kind: 'relativeMinutes',
          anchor: 'end',
          minutesBefore: 60,
        },
        { ...event, duration: { type: 'undetermined' } },
        definitions,
      ),
    ).toBe(false);
  });
});

describe('繰り返しの通知継承', () => {
  test('移動例外の明示通知なしを継承で復活させない', () => {
    const series = {
      ...event,
      recurrenceRule: {
        version: 1,
        frequency: 'daily',
        interval: 1,
        weekdays: [],
        end: { type: 'count', count: 2 },
      },
    } as CalendarEvent;
    const replacement = {
      ...event,
      id: 'replacement',
      anchorDate: '2026-11-20',
    };
    const snapshot = {
      revision: 0,
      definitions,
      aggregates: [
        {
          event: series,
          reminders: [
            { id: 'base-r', eventId: 'e', sortOrder: 0, minutesBefore: 10 },
          ],
        },
        { event: replacement, reminders: [] },
      ],
      exceptions: [
        {
          seriesEventId: 'e',
          originalOccurrenceDate: '2026-11-14',
          kind: 'replaced' as const,
          replacementEventId: 'replacement',
          overrideFields: ['reminders' as const, 'temporal' as const],
          createdAt: '',
          updatedAt: '',
        },
      ],
    };
    const p = planNotifications(snapshot, new Date(2026, 10, 12));
    expect(p.requests.map((r) => local(r.fireAt))).toEqual([
      [2026, 11, 13, 13, 50],
    ]);
    const inherited = planNotifications(
      {
        ...snapshot,
        exceptions: snapshot.exceptions.map((e) => ({
          ...e,
          overrideFields: ['temporal' as const],
        })),
      },
      new Date(2026, 10, 12),
    );
    expect(inherited.requests.map((r) => local(r.fireAt))).toEqual([
      [2026, 11, 13, 13, 50],
      [2026, 11, 20, 13, 50],
    ]);
    expect(inherited.requests[1].target).toEqual({
      eventId: 'e',
      occurrenceDate: '2026-11-14',
    });
  });
  test('同じ開催の同時刻通知を1件にし別予定は統合しない', () => {
    const p = planNotifications(
      {
        revision: 0,
        definitions: [],
        exceptions: [],
        aggregates: [
          {
            event,
            reminders: [
              { id: 'a', eventId: 'e', sortOrder: 0, minutesBefore: 10 },
              {
                id: 'b',
                eventId: 'e',
                sortOrder: 1,
                timing: {
                  version: 1,
                  kind: 'relativeMinutes',
                  anchor: 'start',
                  minutesBefore: 10,
                },
              },
            ],
          },
          {
            event: { ...event, id: 'other' },
            reminders: [
              { id: 'r', eventId: 'other', sortOrder: 0, minutesBefore: 10 },
            ],
          },
        ],
      },
      new Date(2026, 10, 12),
    );
    expect(p.requests).toHaveLength(2);
  });
});
