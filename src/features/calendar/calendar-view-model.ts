import type { CalendarEvent } from '@/domain/calendar/event';
import type { HolidayRangeResult } from '@/domain/calendar/holiday';

export type HolidaySupport = 'available' | 'unsupported';

export type HolidayRangeCoverage = Readonly<{
  from: string;
  through: string;
  result: HolidayRangeResult;
}>;

export type AgendaItemViewModel = Readonly<{
  id: string;
  title: string;
  temporalLabel: string;
  accessibilityLabel: string;
}>;

export function getHolidayInfo(
  date: string,
  holidayCoverage: readonly HolidayRangeCoverage[],
): Readonly<{ support: HolidaySupport; name: string | null }> {
  const coverage = holidayCoverage.find((item) => item.from <= date && date <= item.through);
  if (coverage === undefined || coverage.result.status === 'unsupported') {
    return { support: 'unsupported', name: null };
  }
  return {
    support: 'available',
    name: coverage.result.holidays.find((holiday) => holiday.date === date)?.name ?? null,
  };
}

function getTemporalLabel(
  event: CalendarEvent,
  definitionLabels: ReadonlyMap<string, string>,
): string {
  if (event.temporalType === 'exact') return event.startTime;
  if (event.temporalType === 'allDay') return '終日';

  const definitionLabel = definitionLabels.get(event.temporalDefinitionId);
  return definitionLabel !== undefined && definitionLabel.trim().length > 0
    ? definitionLabel
    : 'ざっくり';
}

export function createAgendaItems(
  events: readonly CalendarEvent[],
  definitionLabels: ReadonlyMap<string, string>,
): readonly AgendaItemViewModel[] {
  return events.map((event) => {
    const temporalLabel = getTemporalLabel(event, definitionLabels);
    return {
      id: event.id,
      title: event.title,
      temporalLabel,
      accessibilityLabel: `${event.title}、${temporalLabel}`,
    };
  });
}
