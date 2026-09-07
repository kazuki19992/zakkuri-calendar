import type { Calendar } from '@/domain/calendar/calendar';
import { parseCalendarEvent, type CalendarEvent } from '@/domain/calendar/event';
import {
  parseTemporalDefinition,
  type TemporalDefinition,
} from '@/domain/temporal/temporal-definition';

export type CalendarRow = Readonly<{
  id: string; name: string; time_zone_id: string; created_at: string; updated_at: string;
}>;

export type TemporalDefinitionRow = Readonly<{
  id: string; calendar_id: string; key: string; label: string; granularity: string;
  resolver_type: string; resolver_config_json: string; fade_in_ratio: number; fade_out_ratio: number;
  is_system: number; is_enabled: number; sort_order: number; created_at: string; updated_at: string;
}>;

export type EventRow = Readonly<{
  id: string; calendar_id: string; title: string; temporal_type: string; anchor_date: string;
  temporal_definition_id: string | null; start_time: string | null; duration_type: string | null;
  duration_minutes: number | null; created_time_zone_id: string; created_at: string; updated_at: string;
}>;

export class CorruptDatabaseRowError extends Error {
  constructor(entity: string, id: string) {
    super(`Invalid ${entity} row: ${id}`);
    this.name = 'CorruptDatabaseRowError';
  }
}

const isNonBlank = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export function mapCalendarRow(row: CalendarRow): Calendar {
  if (![row.id, row.name, row.time_zone_id, row.created_at, row.updated_at].every(isNonBlank)) {
    throw new CorruptDatabaseRowError('calendar', row.id);
  }
  return {
    id: row.id,
    name: row.name,
    timeZoneId: row.time_zone_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTemporalDefinitionRow(row: TemporalDefinitionRow): TemporalDefinition {
  let resolverConfig: unknown;
  try {
    resolverConfig = JSON.parse(row.resolver_config_json) as unknown;
  } catch {
    throw new CorruptDatabaseRowError('temporal definition', row.id);
  }
  if (
    (row.is_system !== 0 && row.is_system !== 1) ||
    (row.is_enabled !== 0 && row.is_enabled !== 1) ||
    typeof resolverConfig !== 'object' ||
    resolverConfig === null ||
    !('kind' in resolverConfig) ||
    resolverConfig.kind !== row.resolver_type
  ) {
    throw new CorruptDatabaseRowError('temporal definition', row.id);
  }
  const parsed = parseTemporalDefinition({
    id: row.id,
    calendarId: row.calendar_id,
    key: row.key,
    label: row.label,
    granularity: row.granularity,
    resolverConfig,
    fadeInRatio: row.fade_in_ratio,
    fadeOutRatio: row.fade_out_ratio,
    isSystem: row.is_system === 1,
    isEnabled: row.is_enabled === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
  if (!parsed.ok) throw new CorruptDatabaseRowError('temporal definition', row.id);
  return parsed.value;
}

export function mapEventRow(row: EventRow): CalendarEvent {
  const base = {
    id: row.id,
    calendarId: row.calendar_id,
    title: row.title,
    temporalType: row.temporal_type,
    anchorDate: row.anchor_date,
    createdTimeZoneId: row.created_time_zone_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  let candidate: unknown = base;
  if (row.temporal_type === 'exact') {
    const duration = row.duration_type === 'fixed'
      ? { type: 'fixed', minutes: row.duration_minutes }
      : row.duration_type === 'instant' || row.duration_type === 'undetermined'
        ? { type: row.duration_type }
        : null;
    candidate = { ...base, startTime: row.start_time, duration };
  } else if (row.temporal_type === 'fuzzy') {
    candidate = { ...base, temporalDefinitionId: row.temporal_definition_id };
  }
  const parsed = parseCalendarEvent(candidate);
  if (!parsed.ok) throw new CorruptDatabaseRowError('event', row.id);
  return parsed.value;
}
