import type { EventAggregate } from '@/domain/calendar/event-reminder';
import { materializeOccurrenceReplacement } from '@/domain/calendar/recurrence-exception';
import type { OccurrenceEditData } from '@/domain/calendar/repositories';

export function getEditableOccurrenceAggregate(data: OccurrenceEditData, occurrenceDate: string): EventAggregate {
  const fields = data.exception?.overrideFields ?? [];
  const event = materializeOccurrenceReplacement({
    seriesEvent: data.series.event,
    replacementEvent: data.replacement?.event ?? data.series.event,
    overrideFields: fields,
    occurrenceDate,
    resolvedOccurrence: data.resolvedOccurrence,
  });
  return {
    event: { ...event, id: data.series.event.id, recurrenceRule: data.series.event.recurrenceRule },
    reminders: fields.includes('reminders') ? data.replacement?.reminders ?? [] : data.series.reminders,
  };
}

export type RecurrenceEditScope = 'occurrence' | 'following' | 'series';

export type ScopeRequest = Readonly<{
  relativePreviews?: Partial<Record<RecurrenceEditScope,readonly string[]>>;
  operation: 'save' | 'delete';
  options: readonly Readonly<{
    scope: RecurrenceEditScope;
    label: string;
  }>[];
  needsExceptionResetConfirmation: boolean;
}>;

const OPTIONS: ScopeRequest['options'] = [
  { scope: 'occurrence', label: 'この予定' },
  { scope: 'following', label: 'これ以降の予定' },
  { scope: 'series', label: 'すべての予定' },
];

export function createScopeRequest(
  operation: ScopeRequest['operation'],
  recurrenceChanged: boolean,
  seriesMeaningChanged = false,
): ScopeRequest {
  return {
    operation,
    options: recurrenceChanged
      ? OPTIONS.filter((option) => option.scope !== 'occurrence')
      : OPTIONS,
    needsExceptionResetConfirmation: recurrenceChanged || seriesMeaningChanged,
  };
}
