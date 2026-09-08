import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import type { Calendar } from './calendar';
import type { CalendarEvent, ExactDuration } from './event';

export interface CalendarRepository {
  getDefault(): Promise<Calendar>;
}

export interface TemporalDefinitionRepository {
  listEnabled(calendarId: string): Promise<TemporalDefinition[]>;
  getById(id: string): Promise<TemporalDefinition | null>;
  disable(id: string, updatedAt: string): Promise<void>;
}

export interface EventRepository {
  create(event: CalendarEvent): Promise<void>;
  getById(id: string): Promise<CalendarEvent | null>;
  listByAnchorRange(calendarId: string, from: string, through: string): Promise<CalendarEvent[]>;
  update(event: CalendarEvent): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface SettingsRepository {
  getDefaultExactDuration(): Promise<ExactDuration>;
  setDefaultExactDuration(value: ExactDuration, updatedAt: string): Promise<void>;
  getUndeterminedFadeMinutes(): Promise<number>;
}
