import type { PropsWithChildren } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AppDatabaseProvider, useRepositories } from '../app-database-provider';
import { DATABASE_NAME } from '../migrations';

const mockExpoDatabase = {
  execAsync: jest.fn(), runAsync: jest.fn(), getFirstAsync: jest.fn(), getAllAsync: jest.fn(),
  withExclusiveTransactionAsync: jest.fn(),
};
const mockMigrateDatabase = jest.fn().mockResolvedValue(undefined);
let mockLatestProviderProps: Record<string, unknown> = {};
let mockProviderMounts = 0;

jest.mock('../migrations', () => ({
  ...jest.requireActual('../migrations'),
  migrateDatabase: (...args: unknown[]) => mockMigrateDatabase(...args),
}));

jest.mock('expo-sqlite', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    SQLiteProvider: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => {
      mockLatestProviderProps = props;
      React.useEffect(() => {
        mockProviderMounts += 1;
        const mockOnInit = props.onInit;
        if (typeof mockOnInit === 'function') void mockOnInit(mockExpoDatabase);
      }, [props.onInit]);
      return children;
    },
    useSQLiteContext: () => mockExpoDatabase,
  };
});

function RepositoryConsumer() {
  const repositories = useRepositories();
  return <Text>{repositories.events ? 'repositories ready' : 'missing'}</Text>;
}

describe('AppDatabaseProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLatestProviderProps = {};
    mockProviderMounts = 0;
  });

  it('initializes the named database through the app adapter and exposes repositories', async () => {
    await render(<AppDatabaseProvider><RepositoryConsumer /></AppDatabaseProvider>);

    expect(screen.getByText('repositories ready')).toBeTruthy();
    expect(mockLatestProviderProps.databaseName).toBe(DATABASE_NAME);
    await waitFor(() => expect(mockMigrateDatabase).toHaveBeenCalledTimes(1));
    expect(mockMigrateDatabase.mock.calls[0][0]).not.toBe(mockExpoDatabase);
    expect(mockMigrateDatabase.mock.calls[0][0]).toEqual(expect.objectContaining({ exec: expect.any(Function) }));
  });

  it('rejects repository access outside the provider', async () => {
    await expect(render(<RepositoryConsumer />)).rejects.toThrow(
      'useRepositories must be used within AppDatabaseProvider',
    );
  });

  it('shows a private retryable error state and remounts SQLiteProvider', async () => {
    await render(<AppDatabaseProvider><Text>calendar</Text></AppDatabaseProvider>);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await act(() => {
      (mockLatestProviderProps.onError as (error: Error) => void)(
        new Error('SELECT title FROM events: 歯医者'),
      );
    });

    expect(screen.getByText('データを読み込めませんでした')).toBeTruthy();
    expect(screen.queryByText(/SELECT|歯医者/)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: '再試行' }));
    await waitFor(() => expect(mockProviderMounts).toBe(2));
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
