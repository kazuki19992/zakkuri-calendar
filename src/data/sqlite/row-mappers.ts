import type { Calendar } from '@/domain/calendar/calendar';
import {
  DEFAULT_EVENT_COLOR_ID,
  parseEventColorId,
} from '@/domain/calendar/event-color';
import { parseEventReminder, type EventReminder } from '@/domain/calendar/event-reminder';
import { parseCalendarEvent, type CalendarEvent } from '@/domain/calendar/event';
import { parseRecurrenceRule, type RecurrenceRuleV1 } from '@/domain/calendar/recurrence';
import {
  parseTemporalDefinition,
  type TemporalDefinition,
} from '@/domain/temporal/temporal-definition';

export type CalendarRow = Readonly<{
  id: string; name: string; time_zone_id: string; color_id: string; created_at: string; updated_at: string;
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
  end_date: string | null; location: string | null; notes: string | null; color_id: string | null;
  recurrence_rule_json: string | null;
}>;

export type ReminderRow = Readonly<{
  id: string; event_id: string; minutes_before: number; sort_order: number;
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
  const color = parseEventColorId(row.color_id);
  return {
    id: row.id,
    name: row.name,
    timeZoneId: row.time_zone_id,
    colorId: color.ok ? color.value : DEFAULT_EVENT_COLOR_ID,
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
  const color = row.color_id === null ? null : parseEventColorId(row.color_id);
  const base = {
    id: row.id,
    calendarId: row.calendar_id,
    title: row.title,
    temporalType: row.temporal_type,
    anchorDate: row.anchor_date,
    location: row.location,
    notes: row.notes,
    colorId: color !== null && color.ok ? color.value : null,
    recurrenceRule: null,
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
  if (row.temporal_type === 'allDay') {
    candidate = { ...base, temporalType: 'allDay', endDate: row.end_date };
  }
  const parsed = parseCalendarEvent(candidate);
  if (!parsed.ok) throw new CorruptDatabaseRowError('event', row.id);

  const recurrenceRule = parseStoredRecurrenceRule(row.recurrence_rule_json);
  if (recurrenceRule === null) return parsed.value;

  const withRecurrence = parseCalendarEvent({ ...parsed.value, recurrenceRule });
  return withRecurrence.ok ? withRecurrence.value : parsed.value;
}

export function mapReminderRow(row: ReminderRow): EventReminder {
  const parsed = parseEventReminder({
    id: row.id,
    eventId: row.event_id,
    minutesBefore: row.minutes_before,
    sortOrder: row.sort_order,
  });
  if (!parsed.ok) throw new CorruptDatabaseRowError('event reminder', row.id);
  return parsed.value;
}

function parseStoredRecurrenceRule(value: string | null): RecurrenceRuleV1 | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed = parseRecurrenceRule(JSON.parse(value) as unknown);
    return parsed.ok ? parsed.value : null;
  } catch {
    return null;
  }
}
