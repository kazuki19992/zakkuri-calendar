import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import type { Calendar } from './calendar';
import type { CalendarEvent, EventEditorTab, ExactDuration } from './event';
import type { EventColorId } from './event-color';
import type { EventAggregate } from './event-reminder';

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
}
