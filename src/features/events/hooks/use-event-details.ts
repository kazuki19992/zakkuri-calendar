import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import type { CalendarEvent } from '@/domain/calendar/event';
import { getReminderTiming, type EventReminder } from '@/domain/calendar/event-reminder';
import { reminderFireAt } from '@/domain/notifications/notification-plan';
import { notificationCategory, timingIsCompatible, timingLabel } from '@/domain/notifications/reminder-timing';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import { projectEventNoteToPlainText } from '@/domain/calendar/event-note';
import { isCalendarDate } from '@/domain/calendar/month';
import { deadlineWarningLabel } from '@/domain/calendar/relative-recurrence';
import type { EventRepository, TemporalDefinitionRepository } from '@/domain/calendar/repositories';
import { formatEditorDate, getExactEditorRange } from '../event-editor-model';
import { getEditableOccurrenceAggregate } from '../recurrence-edit-model';

type EventDetails = Readonly<{
  title: string;
  timeLabel: string;
  location: string | null;
  note: string | null;
  recurring: boolean;
  reminders: readonly Readonly<{ id: string; dateTime: string | null; condition: string }>[];
}>;

type DetailResult = Readonly<{ status: 'loading' | 'missing' | 'error' }>
  | Readonly<{ status: 'ready'; details: EventDetails }>;

export type EventDetailState = DetailResult & Readonly<{ retry(): void }>;

function timeLabel(event: CalendarEvent, definition: TemporalDefinition | null): string {
  if (event.temporalType === 'exact') {
    const range = getExactEditorRange(event);
    const start = `${formatEditorDate(range.startDate)} ${range.startTime}`;
    if (event.duration.type === 'instant') return start;
    if (event.duration.type === 'undetermined') return `${start}〜（終了未定）`;
    const end = range.startDate === range.endDate
      ? range.endTime
      : `${formatEditorDate(range.endDate)} ${range.endTime}`;
    return `${start}〜${end}`;
  }

  const start = formatEditorDate(event.anchorDate);
  const range = event.endDate === event.anchorDate ? start : `${start}〜${formatEditorDate(event.endDate)}`;
  const label = event.temporalType === 'allDay' ? '終日' : definition?.label || 'ざっくり';
  return [range, label, deadlineWarningLabel(event)].filter(Boolean).join('　');
}

function reminderDetails(
  event: CalendarEvent,
  reminders: readonly EventReminder[],
  definition: TemporalDefinition | null,
): EventDetails['reminders'] {
  const definitions = definition ? [definition] : [];
  const category = notificationCategory(event, definitions);
  const dateOnly = category === 'all_day' || category === 'fuzzy_period';
  return reminders.map((reminder) => {
    const timing = getReminderTiming(reminder);
    const fireAt = timingIsCompatible(timing, event, definitions)
      ? reminderFireAt(event, timing, { definitions })
      : Number.NaN;
    const dateTime = Number.isFinite(fireAt) ? new Date(fireAt) : null;
    return {
      id: reminder.id,
      dateTime: dateTime ? `${formatEditorDate(format(dateTime, 'yyyy-MM-dd'))} ${format(dateTime, 'HH:mm')}` : null,
      condition: timingLabel(timing, dateOnly),
    };
  });
}

export function useEventDetails({
  events, temporalDefinitions, id, occurrenceDate, revision,
}: Readonly<{
  events: Pick<EventRepository, 'getById' | 'getOccurrenceEditData'>;
  temporalDefinitions: Pick<TemporalDefinitionRepository, 'getById'>;
  id: string;
  occurrenceDate?: string;
  revision: number;
}>): EventDetailState {
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([id, occurrenceDate, revision, attempt]);
  const [loaded, setLoaded] = useState<{ key: string; result: DetailResult }>();

  useEffect(() => {
    let active = true;
    const publish = (result: DetailResult) => {
      if (active) setLoaded({ key, result });
    };
    async function load() {
      if (!id || (occurrenceDate !== undefined && !isCalendarDate(occurrenceDate))) {
        publish({ status: 'missing' });
        return;
      }
      try {
        const occurrence = occurrenceDate === undefined ? null : await events.getOccurrenceEditData({
          seriesEventId: id, originalOccurrenceDate: occurrenceDate,
        });
        const aggregate = occurrenceDate === undefined
          ? await events.getById(id)
          : occurrence !== null && occurrence.exception?.kind !== 'deleted'
            ? getEditableOccurrenceAggregate(occurrence, occurrenceDate)
            : null;
        if (aggregate === null) {
          publish({ status: 'missing' });
          return;
        }
        const { event, reminders } = aggregate;
        const definition = event.temporalType === 'fuzzy'
          ? await temporalDefinitions.getById(event.temporalDefinitionId) : null;
        publish({ status: 'ready', details: {
          title: event.title,
          timeLabel: timeLabel(event, definition),
          location: event.location,
          note: projectEventNoteToPlainText(event.noteDocument),
          recurring: event.recurrenceRule !== null,
          reminders: reminderDetails(event, reminders, definition),
        } });
      } catch {
        publish({ status: 'error' });
      }
    }
    void load();
    return () => { active = false; };
  }, [events, id, key, occurrenceDate, temporalDefinitions]);

  const result: DetailResult = loaded?.key === key ? loaded.result : { status: 'loading' };
  return { ...result, retry: () => setAttempt((value) => value + 1) };
}
