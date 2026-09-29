import {
  CorruptDatabaseRowError,
  mapCalendarRow,
  mapEventRow,
  mapReminderRow,
  mapTemporalDefinitionRow,
  type EventRow,
  type ReminderRow,
  type TemporalDefinitionRow,
} from '../row-mappers';

const definitionRow: TemporalDefinitionRow = {
  id: 'personal-default:morning', calendar_id: 'personal-default', key: 'morning', label: '朝',
  granularity: 'day', resolver_type: 'timeOfDay',
  resolver_config_json: '{"kind":"timeOfDay","startMinute":360,"endMinute":600}',
  fade_in_ratio: 0.25, fade_out_ratio: 0.25, is_system: 1, is_enabled: 1, sort_order: 10,
  created_at: '2026-09-08T00:00:00.000Z', updated_at: '2026-09-08T00:00:00.000Z',
};

const eventRow: EventRow = {
  id: 'event-1', calendar_id: 'personal-default', title: '歯医者', temporal_type: 'exact',
  anchor_date: '2026-09-08', temporal_definition_id: null, start_time: '14:30',
  duration_type: 'fixed', duration_minutes: 30, created_time_zone_id: 'Asia/Tokyo',
  end_date: null, location: null, notes: null, color_id: null, recurrence_rule_json: null,
  created_at: '2026-09-08T00:00:00.000Z', updated_at: '2026-09-08T00:00:00.000Z',
};

const reminderRow: ReminderRow = {
  id: 'reminder-1', event_id: 'event-1', minutes_before: 30, sort_order: 0,
};

describe('row mappers', () => {
  it('maps snake-case calendar columns', () => {
    expect(mapCalendarRow({
      id: 'personal-default', name: 'マイカレンダー', time_zone_id: 'Asia/Tokyo',
      color_id: 'blue',
      created_at: '2026-09-08T00:00:00.000Z', updated_at: '2026-09-08T00:00:00.000Z',
    })).toEqual({
      id: 'personal-default', name: 'マイカレンダー', timeZoneId: 'Asia/Tokyo',
      colorId: 'blue',
      createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z',
    });
  });

  it('falls back to the default color for an unknown persisted calendar color', () => {
    expect(mapCalendarRow({
      id: 'personal-default', name: 'マイカレンダー', time_zone_id: 'Asia/Tokyo',
      color_id: 'removed-color',
      created_at: '2026-09-08T00:00:00.000Z', updated_at: '2026-09-08T00:00:00.000Z',
    }).colorId).toBe('blue');
  });

  it('parses and validates temporal definition JSON and booleans', () => {
    expect(mapTemporalDefinitionRow(definitionRow)).toMatchObject({
      resolverConfig: { kind: 'timeOfDay', startMinute: 360, endMinute: 600 },
      isSystem: true, isEnabled: true,
    });
  });

  it.each([
    [eventRow, { temporalType: 'exact', startTime: '14:30', duration: { type: 'fixed', minutes: 30 } }],
    [{ ...eventRow, temporal_type: 'allDay', start_time: null, duration_type: null, duration_minutes: null, end_date: '2026-09-08' }, { temporalType: 'allDay', endDate: '2026-09-08' }],
    [{ ...eventRow, temporal_type: 'fuzzy', temporal_definition_id: 'personal-default:morning', start_time: null, duration_type: null, duration_minutes: null }, { temporalType: 'fuzzy', temporalDefinitionId: 'personal-default:morning' }],
  ] as const)('maps each event temporal type without nullable storage fields', (row, expected) => {
    const event = mapEventRow(row);
    expect(event).toMatchObject(expected);
    expect(event).not.toHaveProperty('temporal_definition_id');
    expect(event).not.toHaveProperty('duration_minutes');
  });

  it('falls back to no recurrence for malformed or unsupported persisted recurrence JSON', () => {
    expect(mapEventRow({ ...eventRow, recurrence_rule_json: '{broken' }).recurrenceRule).toBeNull();
    expect(mapEventRow({
      ...eventRow,
      recurrence_rule_json: '{"version":2,"frequency":"daily","interval":1,"weekdays":[],"end":{"type":"never"}}',
    }).recurrenceRule).toBeNull();
  });

  it('開始日より前のuntilを持つ保存済み規則を繰り返しなしとして予定を読み込む', () => {
    expect(mapEventRow({
      ...eventRow,
      recurrence_rule_json: '{"version":1,"frequency":"daily","interval":1,"weekdays":[],"end":{"type":"until","date":"2026-09-07"}}',
    })).toMatchObject({
      id: 'event-1',
      title: '歯医者',
      temporalType: 'exact',
      recurrenceRule: null,
    });
  });

  it('falls back to no event color for an unknown persisted event color', () => {
    expect(mapEventRow({ ...eventRow, color_id: 'removed-color' }).colorId).toBeNull();
  });

  it('maps snake-case reminder columns', () => {
    expect(mapReminderRow(reminderRow)).toEqual({
      id: 'reminder-1', eventId: 'event-1', minutesBefore: 30, sortOrder: 0,
    });
  });

  it.each([
    () => mapTemporalDefinitionRow({ ...definitionRow, resolver_config_json: '{broken' }),
    () => mapTemporalDefinitionRow({ ...definitionRow, fade_in_ratio: 0.8, fade_out_ratio: 0.8 }),
    () => mapEventRow({ ...eventRow, anchor_date: '2026-02-30' }),
    () => mapEventRow({ ...eventRow, start_time: null }),
    () => mapEventRow({ ...eventRow, temporal_type: 'allDay', end_date: null }),
    () => mapReminderRow({ ...reminderRow, minutes_before: -1 }),
  ])('throws an id-only corruption error for malformed persisted data', (map) => {
    expect(map).toThrow(CorruptDatabaseRowError);
    expect(map).toThrow(/(?:event-1|personal-default:morning|reminder-1)/);
    expect(map).not.toThrow(/歯医者/);
  });
});
