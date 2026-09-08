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
import { createExpoDatabaseAdapter } from './database';
import { DATABASE_NAME, migrateDatabase } from './migrations';
import { createRepositoryContainer, type RepositoryContainer } from './repository-container';

const RepositoryContext = createContext<RepositoryContainer | null>(null);

function RepositoryBoundary({ children }: PropsWithChildren) {
  const database = useSQLiteContext();
  const repositories = useMemo(
    () => createRepositoryContainer(createExpoDatabaseAdapter(database)),
    [database],
  );
  return <RepositoryContext.Provider value={repositories}>{children}</RepositoryContext.Provider>;
}

export function useRepositories(): RepositoryContainer {
  const repositories = useContext(RepositoryContext);
  if (!repositories) throw new Error('useRepositories must be used within AppDatabaseProvider');
  return repositories;
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
      <RepositoryBoundary>{children}</RepositoryBoundary>
    </SQLiteProvider>
  );
}
