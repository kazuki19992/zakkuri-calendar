import type { TemporalDefinitionPatch, DefinitionExpectation } from '@/domain/temporal/temporal-preferences';
import type { NotificationCategory, ReminderTiming } from '@/domain/notifications/reminder-timing';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import type { Calendar } from './calendar';
import type { CalendarViewMode } from './calendar-view-mode';
import type { WeekStartsOn } from './month';
import type { HolidayPreferencesV1 } from './holiday-preferences';
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
  expectedDefinition?: DefinitionExpectation;
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
  expectedDefinition?: DefinitionExpectation;
  seriesId: string;
  expectedSeriesUpdatedAt: string;
  plan: RecurrenceMutationPlan;
}>;

export interface CalendarRepository {
  getDefault(): Promise<Calendar>;
  setColor(id: string, colorId: EventColorId, updatedAt: string): Promise<void>;
}

export type TemporalUpdatePreview = Readonly<{ token: string; count: number; definition: TemporalDefinition; next: TemporalDefinition }>;
export type TemporalUpdateCommand = Readonly<{ id: string; patch: TemporalDefinitionPatch; token: string; now: string }>;

export interface TemporalDefinitionRepository {
  listEditable(calendarId: string): Promise<TemporalDefinition[]>;
  previewUpdate(id: string, patch: TemporalDefinitionPatch): Promise<TemporalUpdatePreview>;
  updateDefinition(command: TemporalUpdateCommand): Promise<void>;
  listEnabled(calendarId: string): Promise<TemporalDefinition[]>;
  getById(id: string): Promise<TemporalDefinition | null>;
  disable(id: string, updatedAt: string): Promise<void>;
}

export type CalendarTemporalSchedule = Readonly<{ schedule: CalendarScheduleSnapshot; definitions: readonly TemporalDefinition[]; undeterminedFadeMinutes: number }>;

export interface EventRepository {
  readTemporalSchedule(calendarId: string, from: string, through: string): Promise<CalendarTemporalSchedule>;
  create(event: EventAggregate, expectedDefinition?: DefinitionExpectation): Promise<void>;
  getById(id: string): Promise<EventAggregate | null>;
  listByAnchorRange(calendarId: string, from: string, through: string): Promise<CalendarEvent[]>;
  listSchedule(calendarId: string, from: string, through: string): Promise<CalendarScheduleSnapshot>;
  getOccurrenceEditData(identity: OccurrenceIdentity): Promise<OccurrenceEditData | null>;
  saveOccurrenceException(command: SaveOccurrenceExceptionCommand): Promise<void>;
  deleteOccurrenceException(command: DeleteOccurrenceExceptionCommand): Promise<void>;
  applyRecurrenceMutation(command: ApplyRecurrenceMutationCommand): Promise<void>;
  update(event: EventAggregate, expectedDefinition?: DefinitionExpectation): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface SettingsRepository {
  getNotificationDefault(category: NotificationCategory): Promise<ReminderTiming | null>;
  setNotificationDefault(category: NotificationCategory, timing: ReminderTiming | null, updatedAt: string): Promise<void>;
  getHolidayPreferences(): Promise<HolidayPreferencesV1>;
  setHolidayPreferences(value: HolidayPreferencesV1, updatedAt: string): Promise<void>;
  getCalendarWeekStartsOn(): Promise<WeekStartsOn>;
  setCalendarWeekStartsOn(value: WeekStartsOn, updatedAt: string): Promise<void>;
  getDefaultExactDuration(): Promise<ExactDuration>;
  setDefaultExactDuration(value: ExactDuration, updatedAt: string): Promise<void>;
  getUndeterminedFadeMinutes(): Promise<number>;
  setUndeterminedFadeMinutes(value: number, updatedAt: string): Promise<void>;
  getCalendarVisible(calendarId: string): Promise<boolean>;
  setCalendarVisible(calendarId: string, visible: boolean, updatedAt: string): Promise<void>;
  getLastEventEditorTab(): Promise<EventEditorTab>;
  setLastEventEditorTab(tab: EventEditorTab, updatedAt: string): Promise<void>;
  getLastCalendarViewMode(): Promise<CalendarViewMode>;
  setLastCalendarViewMode(mode: CalendarViewMode, updatedAt: string): Promise<void>;
  getThisWeekDeadlineWeekday(): Promise<ThisWeekDeadlineWeekday>;
  setThisWeekDeadlineWeekday(value: ThisWeekDeadlineWeekday, updatedAt: string): Promise<void>;
}
