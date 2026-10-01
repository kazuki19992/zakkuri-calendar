import type { CalendarEvent } from '@/domain/calendar/event';
import type { EventOccurrence } from '@/domain/calendar/event-occurrence';
import type { HolidayRangeResult } from '@/domain/calendar/holiday';

export type HolidaySupport = 'available' | 'unsupported';

export type HolidayRangeCoverage = Readonly<{
  from: string;
  through: string;
  result: HolidayRangeResult;
}>;

export type AgendaItemViewModel = Readonly<{
  kind?: 'fuzzyRange';
  id: string;
  eventId: string;
  originalOccurrenceDate?: string;
  title: string;
  temporalLabel: string;
  rangeLabel?: string;
  accessibilityLabel: string;
}>;

export function isResolvedRelativeEvent(event: CalendarEvent): boolean {
  return event.temporalType === 'fuzzy' && event.resolutionContext !== null;
}

function formatShortDate(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${month}月${day}日`;
}

function formatOccurrenceRange(occurrence: EventOccurrence): string {
  return `${formatShortDate(occurrence.occurrenceStartDate)}〜${formatShortDate(occurrence.occurrenceThroughDate)}`;
}

/** 発生回が占有する包含期間内の日付を、月表示・予定一覧に含める。 */
export function occursOnCalendarDate(occurrence: EventOccurrence, date: string): boolean {
  return occurrence.occurrenceStartDate <= date && date <= occurrence.occurrenceThroughDate;
}

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
  occurrences: readonly EventOccurrence[],
  definitionLabels: ReadonlyMap<string, string>,
): readonly AgendaItemViewModel[] {
  return occurrences.map((occurrence) => {
    const event = occurrence.event;
    const definitionLabel = getTemporalLabel(event, definitionLabels);
    const isFuzzyRange = isResolvedRelativeEvent(event);
    const rangeLabel = isFuzzyRange ? formatOccurrenceRange(occurrence) : null;
    const temporalLabel = rangeLabel === null ? definitionLabel : `${definitionLabel}・${rangeLabel}`;
    return {
      ...(isFuzzyRange ? { kind: 'fuzzyRange' as const } : {}),
      id: occurrence.key,
      eventId: occurrence.occurrenceIdentity?.seriesEventId ?? occurrence.eventId,
      ...(occurrence.occurrenceIdentity === null
        ? {}
        : { originalOccurrenceDate: occurrence.occurrenceIdentity.originalOccurrenceDate }),
      title: event.title,
      temporalLabel,
      ...(rangeLabel === null ? {} : { rangeLabel }),
      accessibilityLabel: [
        event.title,
        temporalLabel,
        isFuzzyRange ? '相対予定' : null,
        occurrence.isRecurring ? '繰り返し予定' : null,
        occurrence.occurrenceIdentity !== null
          && occurrence.eventId !== occurrence.occurrenceIdentity.seriesEventId
          ? '個別に変更済み'
          : null,
      ].filter((label): label is string => label !== null).join('、'),
    };
  });
}
