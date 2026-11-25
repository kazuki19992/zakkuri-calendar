import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { DatabaseErrorState } from '@/shared/components/database-error-state';
import { writeCalendarBackup } from './calendar-backup';
import { createExpoDatabaseAdapter } from './database';
import { DATABASE_NAME, migrateDatabase } from './migrations';
import { createRepositoryContainer, type RepositoryContainer } from './repository-container';

type DatabaseAccess = Readonly<{
  repositories: RepositoryContainer;
  writeBackup(): Promise<void>;
}>;

const DatabaseContext = createContext<DatabaseAccess | null>(null);

function DatabaseBoundary({ children }: PropsWithChildren) {
  const database = useSQLiteContext();
  const access = useMemo<DatabaseAccess>(() => ({
    repositories: createRepositoryContainer(createExpoDatabaseAdapter(database)),
    writeBackup: () => writeCalendarBackup(database),
  }), [database]);
  return <DatabaseContext.Provider value={access}>{children}</DatabaseContext.Provider>;
}

export function useRepositories(): RepositoryContainer {
  const access = useContext(DatabaseContext);
  if (!access) throw new Error('useRepositories must be used within AppDatabaseProvider');
  return access.repositories;
}

export function useCalendarBackupWriter(): DatabaseAccess['writeBackup'] {
  const access = useContext(DatabaseContext);
  if (!access) throw new Error('useCalendarBackupWriter must be used within AppDatabaseProvider');
  return access.writeBackup;
}

export function AppDatabaseProvider({ children }: PropsWithChildren) {
  const [hasError, setHasError] = useState(false);
  const [providerKey, setProviderKey] = useState(0);

  const initialize = useCallback(async (database: SQLiteDatabase) => {
    const timeZoneId = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    await migrateDatabase(createExpoDatabaseAdapter(database), {
      now: () => new Date().toISOString(),
      timeZoneId: () => timeZoneId,
    });
  }, []);
  const retry = useCallback(() => {
    setHasError(false);
    setProviderKey((key) => key + 1);
  }, []);

  if (hasError) return <DatabaseErrorState onRetry={retry} />;

  return (
    <SQLiteProvider
      key={providerKey}
      databaseName={DATABASE_NAME}
      onInit={initialize}
      onError={() => setHasError(true)}
    >
      <DatabaseBoundary>{children}</DatabaseBoundary>
    </SQLiteProvider>
  );
}
