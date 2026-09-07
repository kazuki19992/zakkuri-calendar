import {
  CorruptDatabaseRowError,
  mapCalendarRow,
  mapEventRow,
  mapTemporalDefinitionRow,
  type EventRow,
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
  created_at: '2026-09-08T00:00:00.000Z', updated_at: '2026-09-08T00:00:00.000Z',
};

describe('row mappers', () => {
  it('maps snake-case calendar columns', () => {
    expect(mapCalendarRow({
      id: 'personal-default', name: 'マイカレンダー', time_zone_id: 'Asia/Tokyo',
      created_at: '2026-09-08T00:00:00.000Z', updated_at: '2026-09-08T00:00:00.000Z',
    })).toEqual({
      id: 'personal-default', name: 'マイカレンダー', timeZoneId: 'Asia/Tokyo',
      createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z',
    });
  });

  it('parses and validates temporal definition JSON and booleans', () => {
    expect(mapTemporalDefinitionRow(definitionRow)).toMatchObject({
      resolverConfig: { kind: 'timeOfDay', startMinute: 360, endMinute: 600 },
      isSystem: true, isEnabled: true,
    });
  });

  it.each([
    [eventRow, { temporalType: 'exact', startTime: '14:30', duration: { type: 'fixed', minutes: 30 } }],
    [{ ...eventRow, temporal_type: 'allDay', start_time: null, duration_type: null, duration_minutes: null }, { temporalType: 'allDay' }],
    [{ ...eventRow, temporal_type: 'fuzzy', temporal_definition_id: 'personal-default:morning', start_time: null, duration_type: null, duration_minutes: null }, { temporalType: 'fuzzy', temporalDefinitionId: 'personal-default:morning' }],
  ] as const)('maps each event temporal type without nullable storage fields', (row, expected) => {
    const event = mapEventRow(row);
    expect(event).toMatchObject(expected);
    expect(event).not.toHaveProperty('temporal_definition_id');
    expect(event).not.toHaveProperty('duration_minutes');
  });

  it.each([
    () => mapTemporalDefinitionRow({ ...definitionRow, resolver_config_json: '{broken' }),
    () => mapTemporalDefinitionRow({ ...definitionRow, fade_in_ratio: 0.8, fade_out_ratio: 0.8 }),
    () => mapEventRow({ ...eventRow, anchor_date: '2026-02-30' }),
    () => mapEventRow({ ...eventRow, start_time: null }),
  ])('throws an id-only corruption error for malformed persisted data', (map) => {
    expect(map).toThrow(CorruptDatabaseRowError);
    expect(map).toThrow(/(?:event-1|personal-default:morning)/);
    expect(map).not.toThrow(/歯医者/);
  });
});
