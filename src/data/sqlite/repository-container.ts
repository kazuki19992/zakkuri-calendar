import type {
  CalendarRepository,
  EventRepository,
  SettingsRepository,
  TemporalDefinitionRepository,
} from '@/domain/calendar/repositories';
import { SqliteCalendarRepository } from './calendar-repository';
import type { AppDatabase } from './database';
import { SqliteEventRepository } from './event-repository';
import { SqliteSettingsRepository } from './settings-repository';
import { SqliteTemporalDefinitionRepository } from './temporal-definition-repository';

export type RepositoryContainer = Readonly<{
  calendars: CalendarRepository;
  temporalDefinitions: TemporalDefinitionRepository;
  events: EventRepository;
  settings: SettingsRepository;
}>;

export function createRepositoryContainer(database: AppDatabase): RepositoryContainer {
  return {
    calendars: new SqliteCalendarRepository(database),
    temporalDefinitions: new SqliteTemporalDefinitionRepository(database),
    events: new SqliteEventRepository(database),
    settings: new SqliteSettingsRepository(database),
  };
}
