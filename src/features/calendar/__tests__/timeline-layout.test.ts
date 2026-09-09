import { PixelRatio } from 'react-native';
import type { CalendarEvent } from '@/domain/calendar/event';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import {
  HOUR_HEIGHT,
  MIN_EVENT_HEIGHT,
  TIMELINE_HEIGHT,
  computeHourLineTop,
  computeNowLineTop,
  computePeakOpacityOffset,
  computeTimelineScale,
  createDayTimelineItems,
  resolveTextAnchor,
} from '../timeline-layout';

const base = {
  calendarId: 'personal-default',
  createdTimeZoneId: 'Asia/Tokyo',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
} as const;

function exact(
  id: string,
  startTime: string,
  duration: Extract<CalendarEvent, { temporalType: 'exact' }>['duration'],
  anchorDate = '2026-09-09',
): CalendarEvent {
  return { ...base, id, title: id, anchorDate, temporalType: 'exact', startTime, duration };
}

function fuzzy(
  id: string,
  definition: TemporalDefinition,
  anchorDate = '2026-09-09',
): CalendarEvent {
  return {
    ...base,
    id,
    title: id,
    anchorDate,
    temporalType: 'fuzzy',
    temporalDefinitionId: definition.id,
  };
}

function definition(
  id: string,
  startMinute: number,
  endMinute: number,
  fadeInRatio: number,
  fadeOutRatio: number,
): TemporalDefinition {
  return {
    id,
    calendarId: 'personal-default',
    key: id,
    label: id,
    granularity: 'day',
    resolverConfig: { kind: 'timeOfDay', startMinute, endMinute },
    fadeInRatio,
    fadeOutRatio,
    isSystem: false,
    isEnabled: true,
    sortOrder: 1,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
  };
}

describe('日別タイムライン配置', () => {
  it('14時30分の30分予定を時間軸上の位置と高さへ変換する', () => {
    const [item] = createDayTimelineItems({
      date: '2026-09-09',
      events: [exact('会議', '14:30', { type: 'fixed', minutes: 30 })],
      definitions: new Map(),
      undeterminedFadeMinutes: 120,
    });

    expect(item).toMatchObject({
      startMinute: 870,
      endMinute: 900,
      top: 870 * HOUR_HEIGHT / 60,
      height: MIN_EVENT_HEIGHT,
      temporalLabel: '14:30・30分',
      opacityStops: [{ offset: 0, opacity: 1 }, { offset: 1, opacity: 1 }],
    });
    expect(TIMELINE_HEIGHT).toBe(24 * HOUR_HEIGHT);
  });

  it('瞬間予定は最小表示高を持ち、時刻の位置を保持する', () => {
    const [item] = createDayTimelineItems({
      date: '2026-09-09',
      events: [exact('薬', '08:00', { type: 'instant' })],
      definitions: new Map(),
      undeterminedFadeMinutes: 120,
    });

    expect(item).toMatchObject({
      startMinute: 480,
      endMinute: 480,
      height: MIN_EVENT_HEIGHT,
      isInstant: true,
      temporalLabel: '08:00・瞬間',
    });
  });

  it('日跨ぎ予定を前半と後半へ分けて元範囲のグラデーションを保つ', () => {
    const lateNight = definition('深夜', 1320, 1560, 0.25, 0.25);
    const event = fuzzy('読書', lateNight);
    const input = { events: [event], definitions: new Map([[lateNight.id, lateNight]]), undeterminedFadeMinutes: 120 };

    const [first] = createDayTimelineItems({ ...input, date: '2026-09-09' });
    const [second] = createDayTimelineItems({ ...input, date: '2026-09-10' });

    expect(first).toMatchObject({
      startMinute: 1320,
      endMinute: 1440,
      continuesToNextDay: true,
      continuesFromPreviousDay: false,
      opacityStops: [
        { offset: 0, opacity: 0 },
        { offset: 0.5, opacity: 1 },
        { offset: 1, opacity: 1 },
      ],
    });
    expect(second).toMatchObject({
      startMinute: 0,
      endMinute: 120,
      continuesToNextDay: false,
      continuesFromPreviousDay: true,
      opacityStops: [
        { offset: 0, opacity: 1 },
        { offset: 0.5, opacity: 1 },
        { offset: 1, opacity: 0 },
      ],
    });
    expect(second.accessibilityLabel).toContain('前日から継続');
  });

  it.each([
    [0, 0, [{ offset: 0, opacity: 1 }, { offset: 1, opacity: 1 }]],
    [0.25, 0, [{ offset: 0, opacity: 0 }, { offset: 0.25, opacity: 1 }, { offset: 1, opacity: 1 }]],
    [0, 0.25, [{ offset: 0, opacity: 1 }, { offset: 0.75, opacity: 1 }, { offset: 1, opacity: 0 }]],
    [0.5, 0.5, [{ offset: 0, opacity: 0 }, { offset: 0.5, opacity: 1 }, { offset: 1, opacity: 0 }]],
  ] as const)('フェード比率%d/%dを表示stopへ変換する', (fadeInRatio, fadeOutRatio, expected) => {
    const target = definition('対象', 600, 720, fadeInRatio, fadeOutRatio);
    const [item] = createDayTimelineItems({
      date: '2026-09-09',
      events: [fuzzy('対象予定', target)],
      definitions: new Map([[target.id, target]]),
      undeterminedFadeMinutes: 120,
    });

    expect(item.opacityStops).toEqual(expected);
  });

  it('重なる予定へ決定的な横レーンを割り当てる', () => {
    const items = createDayTimelineItems({
      date: '2026-09-09',
      events: [
        exact('後発', '10:15', { type: 'fixed', minutes: 30 }),
        exact('先発', '10:00', { type: 'fixed', minutes: 60 }),
        exact('別枠', '11:00', { type: 'fixed', minutes: 30 }),
      ],
      definitions: new Map(),
      undeterminedFadeMinutes: 120,
    });

    expect(items.map(({ id, overlapIndex, overlapCount }) => ({ id, overlapIndex, overlapCount })))
      .toEqual([
        { id: '先発', overlapIndex: 0, overlapCount: 2 },
        { id: '後発', overlapIndex: 1, overlapCount: 2 },
        { id: '別枠', overlapIndex: 0, overlapCount: 1 },
      ]);
  });

  it('表示日の外にある予定と未解決予定は時間軸へ含めない', () => {
    const unresolved = {
      ...base,
      id: '未解決',
      title: '未解決',
      anchorDate: '2026-09-09',
      temporalType: 'fuzzy',
      temporalDefinitionId: 'missing',
    } as const satisfies CalendarEvent;
    expect(createDayTimelineItems({
      date: '2026-09-10',
      events: [exact('前日朝', '08:00', { type: 'fixed', minutes: 30 }), unresolved],
      definitions: new Map(),
      undeterminedFadeMinutes: 120,
    })).toEqual([]);
  });
});

describe('タイムライン表示の縮尺計算', () => {
  it('計測した高さを24時間分の基準高さに対する倍率へ変換する', () => {
    expect(computeTimelineScale(TIMELINE_HEIGHT)).toBe(1);
    expect(computeTimelineScale(TIMELINE_HEIGHT / 2)).toBe(0.5);
  });

  it('未計測(0以下)の高さは基準高さのまま等倍で表示する', () => {
    expect(computeTimelineScale(0)).toBe(1);
    expect(computeTimelineScale(-10)).toBe(1);
  });

  it('24で割り切れない高さでも、1時間の高さを実機ピクセルへ丸めてから倍率を求める', () => {
    const scale = computeTimelineScale(569);

    expect(HOUR_HEIGHT * scale).toBe(PixelRatio.roundToNearestPixel(569 / 24));
  });
});

describe('罫線位置の物理ピクセルへの吸着', () => {
  // 1時間の高さが物理ピクセルの整数倍にならない縮尺(例: 2xで21.5pt = 43px)では、
  // ptのまま配置すると罫線が1本おきに半ピクセル境界へ落ち、アンチエイリアスで
  // 薄くなって消えたように見える(間隔が1時間分飛んで見える原因)。
  it('各罫線のtopを物理ピクセル境界へ吸着させる', () => {
    const scale = computeTimelineScale(516); // 1時間 = 21.5pt → 2xで43px

    for (let hour = 0; hour <= 24; hour += 1) {
      const top = computeHourLineTop(hour, scale);
      expect(PixelRatio.roundToNearestPixel(top)).toBe(top);
      expect(top * PixelRatio.get()).toBeCloseTo(Math.round(top * PixelRatio.get()), 10);
    }
  });

  it('吸着後も隣接する罫線の間隔のばらつきを物理ピクセル1つ以内に収める', () => {
    const scale = computeTimelineScale(516);
    const tops = Array.from({ length: 25 }, (_, hour) => computeHourLineTop(hour, scale));
    const gaps = tops.slice(1).map((top, index) => top - tops[index]);

    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1 / PixelRatio.get() + 1e-9);
  });

  it('0時は常に先頭、24時は24時間分の位置に対応する', () => {
    expect(computeHourLineTop(0, 0.5)).toBe(0);
    expect(computeHourLineTop(24, 1)).toBe(TIMELINE_HEIGHT);
  });
});

describe('現在時刻の位置計算', () => {
  it('0時からの分数と縮尺から現在時刻線のtop位置を求める', () => {
    expect(computeNowLineTop(0, 1)).toBe(0);
    expect(computeNowLineTop(90, 1)).toBe(84); // 1時間30分 * 56pt/時
    expect(computeNowLineTop(90, 0.5)).toBe(42);
  });
});

describe('予定テキストの配置(不透明度が最も濃い位置へ寄せる)', () => {
  it.each([
    [[{ offset: 0, opacity: 1 }, { offset: 1, opacity: 1 }] as const, 0.5],
    [[{ offset: 0, opacity: 0 }, { offset: 0.25, opacity: 1 }, { offset: 1, opacity: 1 }] as const, 0.625],
    [[{ offset: 0, opacity: 1 }, { offset: 0.75, opacity: 1 }, { offset: 1, opacity: 0 }] as const, 0.375],
    [[{ offset: 0, opacity: 0 }, { offset: 0.5, opacity: 1 }, { offset: 1, opacity: 0 }] as const, 0.5],
  ])('opacityStops %o の最も濃い区間の中心offsetは%p', (stops, expected) => {
    expect(computePeakOpacityOffset(stops)).toBe(expected);
  });

  it.each([
    [0, 'flex-start'],
    [0.3, 'flex-start'],
    [1 / 3, 'flex-start'],
    [0.5, 'center'],
    [2 / 3, 'flex-end'],
    [0.9, 'flex-end'],
    [1, 'flex-end'],
  ] as const)('中心offset%pを3段階のFlexbox配置%pへ変換する', (offset, expected) => {
    expect(resolveTextAnchor(offset)).toBe(expected);
  });
});
