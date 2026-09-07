import { parseCalendarEvent, parseEventDraft } from '../event';

const base = {
  calendarId: 'personal-default',
  title: '歯医者',
  anchorDate: '2026-09-08',
  createdTimeZoneId: 'Asia/Tokyo',
};
const validExact = { ...base, temporalType: 'exact' as const, startTime: '14:30', duration: { type: 'fixed' as const, minutes: 30 as const } };
const validAllDay = { ...base, temporalType: 'allDay' as const };
const validFuzzy = { ...base, temporalType: 'fuzzy' as const, temporalDefinitionId: 'personal-default:morning' };

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
    { ...validExact, duration: { type: 'fixed', minutes: 45 } },
    { ...validExact, startTime: '24:00' },
  ])('rejects invalid exact event data', (draft) => {
    expect(parseEventDraft(draft).ok).toBe(false);
  });

  it('requires a temporal definition for fuzzy events', () => {
    expect(parseEventDraft({ ...validFuzzy, temporalDefinitionId: null }).ok).toBe(false);
  });

  it.each(['2026-02-30', '08/09/2026', ''])('rejects an invalid anchor date', (anchorDate) => {
    expect(parseEventDraft({ ...validAllDay, anchorDate }).ok).toBe(false);
  });

  it('keeps wall-clock values and creation zone as metadata', () => {
    expect(parseEventDraft(validExact)).toEqual({ ok: true, value: validExact });
  });
});

describe('parseCalendarEvent', () => {
  it('adds stable persistence metadata to a valid draft', () => {
    const event = { ...validAllDay, id: 'event-1', createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' };
    expect(parseCalendarEvent(event)).toEqual({ ok: true, value: event });
  });
});
