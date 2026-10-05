import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import type { Calendar } from './calendar';
import type { CalendarViewMode } from './calendar-view-mode';
import type { CalendarEvent, EventEditorTab, ExactDuration } from './event';
import type { EventColorId } from './event-color';
import type { ThisWeekDeadlineWeekday } from '@/domain/temporal/relative-date-resolution';
import type { EventAggregate } from './event-reminder';
import type {
  CalendarScheduleSnapshot,
  EventOverrideField,
  OccurrenceIdentity,
  RecurrenceException,
} from './recurrence-exception';
import type { RecurrenceMutationPlan } from './recurrence-change';

export type OccurrenceEditData = Readonly<{
  series: EventAggregate;
  exception: RecurrenceException | null;
  replacement: EventAggregate | null;
  exceptions: readonly RecurrenceException[];
}>;

export type SaveOccurrenceExceptionCommand = Readonly<{
  identity: OccurrenceIdentity;
  replacement: EventAggregate;
  overrideFields: readonly EventOverrideField[];
  expectedSeriesUpdatedAt: string;
  now: string;
}>;

export type DeleteOccurrenceExceptionCommand = Readonly<{
  identity: OccurrenceIdentity;
  expectedSeriesUpdatedAt: string;
  now: string;
}>;

export type ApplyRecurrenceMutationCommand = Readonly<{
  seriesId: string;
  expectedSeriesUpdatedAt: string;
  plan: RecurrenceMutationPlan;
}>;

export interface CalendarRepository {
  getDefault(): Promise<Calendar>;
  setColor(id: string, colorId: EventColorId, updatedAt: string): Promise<void>;
}

export interface TemporalDefinitionRepository {
  listEnabled(calendarId: string): Promise<TemporalDefinition[]>;
  getById(id: string): Promise<TemporalDefinition | null>;
  disable(id: string, updatedAt: string): Promise<void>;
}

export interface EventRepository {
  create(event: EventAggregate): Promise<void>;
  getById(id: string): Promise<EventAggregate | null>;
  listByAnchorRange(calendarId: string, from: string, through: string): Promise<CalendarEvent[]>;
  listSchedule(calendarId: string, from: string, through: string): Promise<CalendarScheduleSnapshot>;
  getOccurrenceEditData(identity: OccurrenceIdentity): Promise<OccurrenceEditData | null>;
  saveOccurrenceException(command: SaveOccurrenceExceptionCommand): Promise<void>;
  deleteOccurrenceException(command: DeleteOccurrenceExceptionCommand): Promise<void>;
  applyRecurrenceMutation(command: ApplyRecurrenceMutationCommand): Promise<void>;
  update(event: EventAggregate): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface SettingsRepository {
  getDefaultExactDuration(): Promise<ExactDuration>;
  setDefaultExactDuration(value: ExactDuration, updatedAt: string): Promise<void>;
  getUndeterminedFadeMinutes(): Promise<number>;
  getCalendarVisible(calendarId: string): Promise<boolean>;
  setCalendarVisible(calendarId: string, visible: boolean, updatedAt: string): Promise<void>;
  getLastEventEditorTab(): Promise<EventEditorTab>;
  setLastEventEditorTab(tab: EventEditorTab, updatedAt: string): Promise<void>;
  getLastCalendarViewMode(): Promise<CalendarViewMode>;
  setLastCalendarViewMode(mode: CalendarViewMode, updatedAt: string): Promise<void>;
  getThisWeekDeadlineWeekday(): Promise<ThisWeekDeadlineWeekday>;
  setThisWeekDeadlineWeekday(value: ThisWeekDeadlineWeekday, updatedAt: string): Promise<void>;
}
