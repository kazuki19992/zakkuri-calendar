import {
  createCalendarEvent,
  parseCalendarEvent,
  parseEventDraft,
  parseExactDuration,
} from '../event';

const base = {
  calendarId: 'personal-default',
  title: '歯医者',
  anchorDate: '2026-09-08',
  createdTimeZoneId: 'Asia/Tokyo',
};
const metadata = { location: null, notes: null, colorId: null, recurrenceRule: null };
const validExact = { ...base, ...metadata, temporalType: 'exact' as const, startTime: '14:30', duration: { type: 'fixed' as const, minutes: 30 as const } };
const validAllDay = { ...base, ...metadata, temporalType: 'allDay' as const, endDate: '2026-09-08' };
const validFuzzy = { ...base, ...metadata, temporalType: 'fuzzy' as const,
  temporalDefinitionId: 'personal-default:morning', endDate: base.anchorDate, resolutionContext: null };

describe('parseEventDraft', () => {
  it.each([validExact, validAllDay, validFuzzy])('accepts valid temporal variants', (draft) => {
    expect(parseEventDraft(draft)).toEqual({ ok: true, value: draft });
  });

  it.each(['', '   '])('rejects an empty title', (title) => {
    expect(parseEventDraft({ ...validAllDay, title }).ok).toBe(false);
  });

  it.each([
    { ...validExact, startTime: null },
    { ...validExact, duration: null },
    { ...validExact, duration: { type: 'fixed', minutes: '10' } },
    { ...validExact, startTime: '24:00' },
  ])('rejects invalid exact event data', (draft) => {
    expect(parseEventDraft(draft).ok).toBe(false);
  });

  it('requires a temporal definition for fuzzy events', () => {
    expect(parseEventDraft({ ...validFuzzy, temporalDefinitionId: null }).ok).toBe(false);
  });

  it('複数日ざっくり予定の解決条件を受け付ける', () => {
    const draft = { ...validFuzzy, endDate: '2026-09-11', resolutionContext: {
      version: 1 as const,
      referenceDate: '2026-09-08',
      periodAnchorDate: '2026-09-07',
      parameterSnapshot: { thisWeekDeadlineWeekday: 5 as const },
    } };
    expect(parseEventDraft(draft)).toEqual({ ok: true, value: draft });
  });

  it.each([
    { endDate: '2026-09-07' },
    { resolutionContext: { version: 2, referenceDate: '2026-09-08', periodAnchorDate: '2026-09-07', parameterSnapshot: {} } },
    { resolutionContext: { version: 1, referenceDate: '2026-02-30', periodAnchorDate: '2026-09-07', parameterSnapshot: {} } },
    { resolutionContext: { version: 1, referenceDate: '2026-09-08', periodAnchorDate: '2026-09-07', parameterSnapshot: { thisWeekDeadlineWeekday: 4 } } },
  ])('不正なざっくり期間を拒否する', (fields) => {
    expect(parseEventDraft({ ...validFuzzy, ...fields }).ok).toBe(false);
  });

  it.each(['2026-02-30', '08/09/2026', ''])('rejects an invalid anchor date', (anchorDate) => {
    expect(parseEventDraft({ ...validAllDay, anchorDate }).ok).toBe(false);
  });

  it('accepts a valid leap day before the year 0100', () => {
    expect(parseEventDraft({ ...validAllDay, anchorDate: '0096-02-29' }).ok).toBe(true);
  });

  it('keeps wall-clock values and creation zone as metadata', () => {
    expect(parseEventDraft(validExact)).toEqual({ ok: true, value: validExact });
  });

  it('任意の固定分数を持つ正確な予定を受け付ける', () => {
    const event = { ...validExact, duration: { type: 'fixed' as const, minutes: 135 } };

    expect(parseEventDraft(event)).toEqual({ ok: true, value: event });
  });

  it('24時間を超える固定分数を受け付ける', () => {
    expect(parseExactDuration({ type: 'fixed', minutes: 3 * 24 * 60 })).toEqual({
      ok: true,
      value: { type: 'fixed', minutes: 4320 },
    });
  });

  it('終日予定は開始日を含む終了日までを受け付ける', () => {
    const event = { ...validAllDay, endDate: '2026-10-03' };

    expect(parseEventDraft(event)).toEqual({ ok: true, value: event });
  });

  it('開始日より前の終日終了日を拒否する', () => {
    expect(parseEventDraft({ ...validAllDay, endDate: '2026-09-07' }).ok).toBe(false);
  });

  it('空白だけの場所とメモをnullへ正規化する', () => {
    expect(parseEventDraft({ ...validFuzzy, location: '  ', notes: '\t' })).toEqual({
      ok: true,
      value: validFuzzy,
    });
  });

  it('不明な色IDと予定開始日より前の繰り返し終了日を拒否する', () => {
    expect(parseEventDraft({ ...validFuzzy, colorId: 'removed-color' }).ok).toBe(false);
    expect(parseEventDraft({
      ...validFuzzy,
      recurrenceRule: {
        version: 1,
        frequency: 'daily',
        interval: 1,
        weekdays: [],
        end: { type: 'until', date: '2026-09-07' },
      },
    }).ok).toBe(false);
  });
});

describe('parseCalendarEvent', () => {
  it('adds stable persistence metadata to a valid draft', () => {
    const event = { ...validAllDay, id: 'event-1', createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' };
    expect(parseCalendarEvent(event)).toEqual({ ok: true, value: event });
  });
});

describe('予定の新規作成', () => {
  it('ざっくり予定へIDと同一の作成更新日時を付与する', () => {
    expect(
      createCalendarEvent({
        id: 'event-new',
        draft: validFuzzy,
        now: '2026-09-09T01:02:03.000Z',
      }),
    ).toEqual({
      ok: true,
      value: {
        ...validFuzzy,
        id: 'event-new',
        createdAt: '2026-09-09T01:02:03.000Z',
        updatedAt: '2026-09-09T01:02:03.000Z',
      },
    });
  });

  it('空のIDでは予定を作成しない', () => {
    const result = createCalendarEvent({
      id: '',
      draft: validFuzzy,
      now: '2026-09-09T01:02:03.000Z',
    });

    expect(result).toEqual({
      ok: false,
      error: { field: 'id', message: 'id must not be blank' },
    });
  });
});
