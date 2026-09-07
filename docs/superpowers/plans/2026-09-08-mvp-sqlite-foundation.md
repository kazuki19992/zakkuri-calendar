# MVP SQLite Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the tested domain contracts and local SQLite foundation required by every later MVP calendar feature, without implementing calendar screens or event-entry UI.

**Architecture:** Pure TypeScript domain modules own event invariants and temporal-definition validation. A small database port isolates those modules from Expo, while the production adapter uses Expo SDK 57 `expo-sqlite`; repositories map validated domain values to parameterized SQLite queries. `SQLiteProvider` initializes the database at the app boundary, so later feature hooks depend on repository contracts rather than SQL.

**Tech Stack:** Expo SDK 57, React Native 0.86, TypeScript 6, Expo Router, `expo-sqlite`, Jest with `jest-expo`, React Native Testing Library

**Spec:** `docs/superpowers/specs/2026-09-07-zakkuri-calendar-mvp-design.md`

## Global Constraints

- Read the exact Expo SDK 57 documentation before changing Expo APIs: `https://docs.expo.dev/versions/v57.0.0/`.
- Use `npx expo install` so Expo selects SDK-compatible package versions.
- Target iOS and Android; web is not an MVP verification target.
- Personal event data stays on device and must not be logged or sent externally.
- UI code must not call SQLite directly; later UI accesses persistence through feature hooks and repository contracts.
- Keep business rules in pure TypeScript modules with no React, Expo, or SQLite imports.
- Store temporal definitions in SQLite and seed them idempotently; do not expose definition editing UI in this task.
- Store wall-clock date/time values without automatic time-zone conversion, while retaining the creation IANA time-zone ID.
- Use parameter binding for all runtime values. Never interpolate event content into SQL strings.
- Use TDD: observe each new test fail for the intended reason before writing its implementation.
- This plan is only MVP task 2. Do not implement month/day/week views, event forms, notifications, billing, analytics, Sentry, sharing, or cloud sync.

---

## File Map

### Existing files to modify

- `package.json` — test scripts, Jest configuration, and SDK-compatible dependencies.
- `package-lock.json` — generated dependency lockfile.
- `tsconfig.json` — Jest type declarations for test files.
- `src/app/_layout.tsx` — install the database provider at the app boundary while retaining the current theme and splash behavior.

### Domain files to create

- `src/domain/shared/result.ts` — small success/failure result type used at validation boundaries.
- `src/domain/calendar/calendar.ts` — calendar entity and stable default calendar ID.
- `src/domain/calendar/event.ts` — event, duration, and draft types plus event invariant validation.
- `src/domain/calendar/repositories.ts` — repository interfaces consumed by later feature hooks.
- `src/domain/temporal/temporal-definition.ts` — temporal-definition union, resolver config types, and validation.
- `src/domain/temporal/standard-definitions.ts` — validated seed definitions agreed in the MVP design.

### SQLite files to create

- `src/data/sqlite/database.ts` — narrow async database interface and the Expo SQLite adapter.
- `src/data/sqlite/migrations.ts` — schema creation, version history, WAL/foreign-key setup, and idempotent seed orchestration.
- `src/data/sqlite/row-mappers.ts` — validation-aware conversion between SQLite rows and domain entities.
- `src/data/sqlite/calendar-repository.ts` — default calendar persistence.
- `src/data/sqlite/temporal-definition-repository.ts` — definition queries and soft-disable operation.
- `src/data/sqlite/event-repository.ts` — event CRUD using bound parameters.
- `src/data/sqlite/settings-repository.ts` — typed default-duration and undetermined-fade settings.
- `src/data/sqlite/repository-container.ts` — construct repository implementations once per database instance.
- `src/data/sqlite/app-database-provider.tsx` — `SQLiteProvider`, initialization state, retry behavior, and repository Context.

### Shared UI file to create

- `src/shared/components/database-error-state.tsx` — retryable initialization failure shown by the provider and reusable by later screens.

### Test support and test files to create

- `src/test/create-database-double.ts` — controllable database double implementing the narrow database interface.
- `src/domain/calendar/__tests__/event.test.ts`
- `src/domain/temporal/__tests__/temporal-definition.test.ts`
- `src/domain/temporal/__tests__/standard-definitions.test.ts`
- `src/data/sqlite/__tests__/migrations.test.ts`
- `src/data/sqlite/__tests__/row-mappers.test.ts`
- `src/data/sqlite/__tests__/repositories.test.ts`
- `src/data/sqlite/__tests__/app-database-provider.test.tsx`

---

### Task 1: Install the SDK-compatible persistence and test toolchain

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`
- Create: `src/domain/shared/__tests__/test-environment.test.ts`

**Interfaces:**
- Consumes: Expo SDK version declared in `package.json`.
- Produces: `npm test -- --runInBand`, `npm run typecheck`, and the base `jest-expo` configuration.

- [ ] **Step 1: Install Expo SQLite using the SDK-aware installer**

Run:

```bash
npx expo install expo-sqlite
```

Expected: `expo-sqlite` is added to dependencies at the SDK 57-compatible version and `package-lock.json` changes.

- [ ] **Step 2: Install the official Expo Jest stack**

Run:

```bash
npx expo install jest-expo jest @types/jest @testing-library/react-native --dev
```

Expected: the four packages are added to dev dependencies with Expo-compatible versions.

- [ ] **Step 3: Add deterministic test and typecheck scripts**

Update `package.json` scripts with:

```json
{
  "test": "jest",
  "test:watch": "jest --watch",
  "typecheck": "tsc --noEmit"
}
```

Add this Jest configuration to `package.json`:

```json
{
  "jest": {
    "preset": "jest-expo",
    "moduleNameMapper": {
      "^@/(.*)$": "<rootDir>/src/$1",
      "^@/assets/(.*)$": "<rootDir>/assets/$1"
    }
  }
}
```

Add `"types": ["jest"]` under `compilerOptions` in `tsconfig.json` without changing the existing strict mode or path aliases.

- [ ] **Step 4: Write the first test**

Create `src/domain/shared/__tests__/test-environment.test.ts`:

```ts
describe('test environment', () => {
  it('runs TypeScript tests through jest-expo', () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 5: Run the test and configuration checks**

Run:

```bash
npm test -- --runInBand src/domain/shared/__tests__/test-environment.test.ts
npm run typecheck
npm run lint
```

Expected: one Jest test passes; typecheck and lint exit with status 0.

- [ ] **Step 6: Commit the toolchain**

```bash
git add package.json package-lock.json tsconfig.json src/domain/shared/__tests__/test-environment.test.ts
git commit -m "test: configure Expo unit test foundation"
```

---

### Task 2: Define reusable validation results and calendar identity

**Files:**
- Create: `src/domain/shared/result.ts`
- Create: `src/domain/calendar/calendar.ts`
- Create: `src/domain/calendar/__tests__/calendar.test.ts`

**Interfaces:**
- Produces: `Result<T, E>`, `Calendar`, `DEFAULT_CALENDAR_ID`, and `createDefaultCalendar(timeZoneId, now)`.

- [ ] **Step 1: Write failing calendar-domain tests**

Create `src/domain/calendar/__tests__/calendar.test.ts` with these cases:

```ts
import { createDefaultCalendar, DEFAULT_CALENDAR_ID } from '../calendar';

describe('createDefaultCalendar', () => {
  it('creates the single MVP calendar with a stable id and wall-clock timezone zone', () => {
    expect(createDefaultCalendar('Asia/Tokyo', '2026-09-08T00:00:00.000Z')).toEqual({
      id: DEFAULT_CALENDAR_ID,
      name: 'マイカレンダー',
      timeZoneId: 'Asia/Tokyo',
      createdAt: '2026-09-08T00:00:00.000Z',
      updatedAt: '2026-09-08T00:00:00.000Z',
    });
  });

  it('rejects an empty time-zone id', () => {
    expect(() => createDefaultCalendar('', '2026-09-08T00:00:00.000Z')).toThrow(
      'timeZoneId must not be empty',
    );
  });
});
```

- [ ] **Step 2: Run the test to verify the missing module failure**

Run:

```bash
npm test -- --runInBand src/domain/calendar/__tests__/calendar.test.ts
```

Expected: FAIL because `../calendar` does not exist.

- [ ] **Step 3: Implement the result and calendar types**

Create `src/domain/shared/result.ts`:

```ts
export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

Create `src/domain/calendar/calendar.ts` with:

```ts
export const DEFAULT_CALENDAR_ID = 'personal-default';

export type Calendar = Readonly<{
  id: string;
  name: string;
  timeZoneId: string;
  createdAt: string;
  updatedAt: string;
}>;

export function createDefaultCalendar(timeZoneId: string, now: string): Calendar;
```

Validate that `timeZoneId` and `now` are non-empty. Do not introduce a general-purpose entity base class.

- [ ] **Step 4: Run the focused test**

Run:

```bash
npm test -- --runInBand src/domain/calendar/__tests__/calendar.test.ts
```

Expected: both tests pass.

- [ ] **Step 5: Commit the calendar identity**

```bash
git add src/domain/shared/result.ts src/domain/calendar/calendar.ts src/domain/calendar/__tests__/calendar.test.ts
git commit -m "feat: define default calendar domain"
```

---

### Task 3: Define and validate temporal definitions

**Files:**
- Create: `src/domain/temporal/temporal-definition.ts`
- Create: `src/domain/temporal/__tests__/temporal-definition.test.ts`

**Interfaces:**
- Produces: `TemporalGranularity`, `TemporalResolverConfig`, `TemporalDefinition`, `parseTemporalDefinition(input)`, and `TemporalDefinitionValidationError`.

- [ ] **Step 1: Write failing validator tests**

Cover one valid value for every resolver kind and these invalid cases:

```ts
import { parseTemporalDefinition } from '../temporal-definition';

const base = {
  id: 'personal-default:morning',
  calendarId: 'personal-default',
  key: 'morning',
  label: '朝',
  granularity: 'day' as const,
  resolverConfig: { kind: 'timeOfDay', startMinute: 360, endMinute: 600 },
  fadeInRatio: 0.25,
  fadeOutRatio: 0.25,
  isSystem: true,
  isEnabled: true,
  sortOrder: 10,
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
};

it('accepts a validated day definition', () => {
  expect(parseTemporalDefinition(base)).toEqual({ ok: true, value: base });
});

it.each([
  [-0.1, 0.2],
  [0.2, 1.1],
  [0.6, 0.5],
])('rejects invalid fade ratios', (fadeInRatio, fadeOutRatio) => {
  expect(parseTemporalDefinition({ ...base, fadeInRatio, fadeOutRatio }).ok).toBe(false);
});

it('accepts a cross-midnight time range', () => {
  const result = parseTemporalDefinition({
    ...base,
    key: 'late_night',
    resolverConfig: { kind: 'timeOfDay', startMinute: 1320, endMinute: 1560 },
  });
  expect(result.ok).toBe(true);
});

it('rejects malformed resolver JSON values before they reach the domain', () => {
  expect(parseTemporalDefinition({ ...base, resolverConfig: { kind: 'week' } }).ok).toBe(false);
});
```

Also test:

- `week` config with `selectionWeekOffset`, `startWeekday`, and `endWeekday`.
- `monthDays` config with `selectionMonthOffset`, `startDay`, and `endDay: number | 'last'`.
- `monthLastDays` config with `selectionMonthOffset` and `count`.
- blank IDs, keys, labels, and calendar IDs.
- non-integer minute/day/order values.

- [ ] **Step 2: Run the test to verify failure**

Run:

```bash
npm test -- --runInBand src/domain/temporal/__tests__/temporal-definition.test.ts
```

Expected: FAIL because the temporal-definition module does not exist.

- [ ] **Step 3: Implement the discriminated resolver union**

Create exact TypeScript shapes:

```ts
export type TemporalGranularity = 'day' | 'week' | 'month';

export type TimeOfDayResolver = Readonly<{
  kind: 'timeOfDay';
  startMinute: number;
  endMinute: number;
}>;

export type WeekResolver = Readonly<{
  kind: 'week';
  selectionWeekOffset: 0 | 1 | 2;
  startWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  endWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
}>;

export type MonthDaysResolver = Readonly<{
  kind: 'monthDays';
  selectionMonthOffset: 0 | 1;
  startDay: number;
  endDay: number | 'last';
}>;

export type MonthLastDaysResolver = Readonly<{
  kind: 'monthLastDays';
  selectionMonthOffset: 0 | 1;
  count: number;
}>;

export type TemporalResolverConfig =
  | TimeOfDayResolver
  | WeekResolver
  | MonthDaysResolver
  | MonthLastDaysResolver;

export type TemporalDefinition = Readonly<{
  id: string;
  calendarId: string;
  key: string;
  label: string;
  granularity: TemporalGranularity;
  resolverConfig: TemporalResolverConfig;
  fadeInRatio: number;
  fadeOutRatio: number;
  isSystem: boolean;
  isEnabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}>;
```

`TemporalDefinition` contains the fields from section 9.2 of the design. `parseTemporalDefinition` accepts `unknown`, checks every field, returns `Result<TemporalDefinition, TemporalDefinitionValidationError>`, enforces each ratio in `[0, 1]`, and enforces `fadeInRatio + fadeOutRatio <= 1`.

- [ ] **Step 4: Run focused tests and typecheck**

```bash
npm test -- --runInBand src/domain/temporal/__tests__/temporal-definition.test.ts
npm run typecheck
```

Expected: all temporal-definition tests pass and typecheck exits 0.

- [ ] **Step 5: Commit the temporal-definition contract**

```bash
git add src/domain/temporal/temporal-definition.ts src/domain/temporal/__tests__/temporal-definition.test.ts
git commit -m "feat: define temporal definition model"
```

---

### Task 4: Encode the agreed standard definitions as validated seed input

**Files:**
- Create: `src/domain/temporal/standard-definitions.ts`
- Create: `src/domain/temporal/__tests__/standard-definitions.test.ts`

**Interfaces:**
- Consumes: `TemporalDefinition`, `parseTemporalDefinition`, and `DEFAULT_CALENDAR_ID`.
- Produces: `createStandardTemporalDefinitions(calendarId, now): TemporalDefinition[]`.

- [ ] **Step 1: Write failing seed-catalog tests**

Assert the catalog contains exactly 22 unique definitions in the agreed order:

```ts
const expectedKeys = [
  'morning',
  'am',
  'before_noon',
  'around_noon',
  'early_afternoon',
  'pm',
  'evening',
  'night',
  'late_night',
  'this_week_first_half',
  'this_week_second_half',
  'this_weekend',
  'next_week',
  'next_week_first_half',
  'next_week_second_half',
  'week_after_next',
  'month_start',
  'month_first_third',
  'month_middle_third',
  'month_last_third',
  'month_end',
  'next_month',
];
```

Test the exact ranges and fades from design section 7, including:

```ts
expect(byKey('late_night')).toMatchObject({
  resolverConfig: { kind: 'timeOfDay', startMinute: 1320, endMinute: 1560 },
  fadeInRatio: 0.25,
  fadeOutRatio: 0.25,
});

expect(byKey('around_noon')).toMatchObject({
  resolverConfig: { kind: 'timeOfDay', startMinute: 690, endMinute: 810 },
  fadeInRatio: 0.5,
  fadeOutRatio: 0.5,
});

expect(byKey('month_end')).toMatchObject({
  resolverConfig: { kind: 'monthLastDays', selectionMonthOffset: 0, count: 5 },
  fadeInRatio: 0.35,
  fadeOutRatio: 0,
});
```

Assert every result passes `parseTemporalDefinition`, uses a deterministic ID `${calendarId}:${key}`, is a system definition, and is enabled.

- [ ] **Step 2: Run the test to verify failure**

```bash
npm test -- --runInBand src/domain/temporal/__tests__/standard-definitions.test.ts
```

Expected: FAIL because `standard-definitions.ts` does not exist.

- [ ] **Step 3: Implement the complete catalog**

Encode all 22 rows from design section 7. Keep this module free of SQLite imports. Build each definition through a helper that calls `parseTemporalDefinition` and throws only if the developer-authored seed is invalid.

Use sort orders in increments of 10 within the displayed order. Preserve Japanese labels exactly as written in the design.

- [ ] **Step 4: Run catalog and domain tests**

```bash
npm test -- --runInBand src/domain/temporal
npm run typecheck
```

Expected: all temporal tests pass and typecheck exits 0.

- [ ] **Step 5: Commit the seed catalog**

```bash
git add src/domain/temporal/standard-definitions.ts src/domain/temporal/__tests__/standard-definitions.test.ts
git commit -m "feat: define standard temporal seeds"
```

---

### Task 5: Define calendar events and repository contracts

**Files:**
- Create: `src/domain/calendar/event.ts`
- Create: `src/domain/calendar/repositories.ts`
- Create: `src/domain/calendar/__tests__/event.test.ts`

**Interfaces:**
- Consumes: calendar and temporal-definition IDs.
- Produces: `CalendarEvent`, `EventDraft`, `ExactDuration`, `parseEventDraft`, `CalendarRepository`, `TemporalDefinitionRepository`, `EventRepository`, and `SettingsRepository`.

- [ ] **Step 1: Write failing event-invariant tests**

Test valid `exact`, `allDay`, and `fuzzy` drafts. Include these boundary failures:

```ts
it.each(['', '   '])('rejects an empty title', (title) => {
  expect(parseEventDraft({ ...validAllDay, title }).ok).toBe(false);
});

it('requires startTime and duration for exact events', () => {
  expect(parseEventDraft({ ...validExact, startTime: null }).ok).toBe(false);
});

it('only accepts the agreed fixed durations', () => {
  expect(
    parseEventDraft({ ...validExact, duration: { type: 'fixed', minutes: 45 } }).ok,
  ).toBe(false);
});

it('requires a temporal definition for fuzzy events', () => {
  expect(parseEventDraft({ ...validFuzzy, temporalDefinitionId: null }).ok).toBe(false);
});

it('keeps wall-clock values and creation zone as metadata', () => {
  expect(parseEventDraft(validExact)).toEqual({ ok: true, value: validExact });
});
```

Test real calendar dates, `HH:mm` values, and duration variants:

```ts
export type ExactDuration =
  | { type: 'instant' }
  | { type: 'fixed'; minutes: 10 | 15 | 30 | 60 }
  | { type: 'undetermined' };
```

- [ ] **Step 2: Run the test to verify failure**

```bash
npm test -- --runInBand src/domain/calendar/__tests__/event.test.ts
```

Expected: FAIL because the event module does not exist.

- [ ] **Step 3: Implement the event union and validation**

Use discriminated event drafts:

```ts
type EventDraftBase = Readonly<{
  calendarId: string;
  title: string;
  anchorDate: string;
  createdTimeZoneId: string;
}>;

export type EventDraft =
  | (EventDraftBase & {
      temporalType: 'exact';
      startTime: string;
      duration: ExactDuration;
    })
  | (EventDraftBase & {
      temporalType: 'allDay';
    })
  | (EventDraftBase & {
      temporalType: 'fuzzy';
      temporalDefinitionId: string;
    });
```

`CalendarEvent` extends the valid union with `id`, `createdAt`, and `updatedAt`. Do not add note, location, recurrence, sync, billing, or notification fields.

- [ ] **Step 4: Define the repository methods needed by later hooks**

Create interfaces with these signatures:

```ts
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
```

- [ ] **Step 5: Run domain tests and typecheck**

```bash
npm test -- --runInBand src/domain/calendar
npm run typecheck
```

Expected: all calendar-domain tests pass and typecheck exits 0.

- [ ] **Step 6: Commit domain events and ports**

```bash
git add src/domain/calendar/event.ts src/domain/calendar/repositories.ts src/domain/calendar/__tests__/event.test.ts
git commit -m "feat: define event and repository contracts"
```

---

### Task 6: Add the narrow database adapter and test double

**Files:**
- Create: `src/data/sqlite/database.ts`
- Create: `src/test/create-database-double.ts`
- Create: `src/data/sqlite/__tests__/database.test.ts`

**Interfaces:**
- Consumes: Expo `SQLiteDatabase`.
- Produces: `AppDatabase`, `AppRunResult`, `createExpoDatabaseAdapter(db)`, and `createDatabaseDouble()`.

- [ ] **Step 1: Write a failing adapter contract test**

The narrow interface must expose only the operations used by migrations and repositories:

```ts
export type AppRunResult = Readonly<{
  changes: number;
  lastInsertRowId: number;
}>;

export type AppDatabaseParameter = string | number | null;

export interface AppDatabase {
  exec(source: string): Promise<void>;
  run(source: string, params?: Record<string, AppDatabaseParameter>): Promise<AppRunResult>;
  first<T>(source: string, params?: Record<string, AppDatabaseParameter>): Promise<T | null>;
  all<T>(source: string, params?: Record<string, AppDatabaseParameter>): Promise<T[]>;
  exclusiveTransaction(task: (transaction: AppDatabase) => Promise<void>): Promise<void>;
}
```

Mock an Expo database object and assert that `createExpoDatabaseAdapter` delegates to `execAsync`, `runAsync`, `getFirstAsync`, `getAllAsync`, and `withExclusiveTransactionAsync`.

- [ ] **Step 2: Run the focused test to verify failure**

```bash
npm test -- --runInBand src/data/sqlite/__tests__/database.test.ts
```

Expected: FAIL because `database.ts` does not exist.

- [ ] **Step 3: Implement the adapter**

Use named parameters for runtime values. Keep schema creation in `exec`, where the SQL is developer-authored and contains no user input. Map Expo's `SQLiteRunResult` to `{ changes, lastInsertRowId }`.

- [ ] **Step 4: Implement the controllable test double**

`createDatabaseDouble()` returns:

```ts
type DatabaseDouble = {
  database: AppDatabase;
  exec: jest.Mock;
  run: jest.Mock;
  first: jest.Mock;
  all: jest.Mock;
  exclusiveTransaction: jest.Mock;
};
```

The default `exclusiveTransaction` implementation immediately awaits its callback with the same database double. Tests may override result queues for `first` and `all`.

- [ ] **Step 5: Run tests and typecheck**

```bash
npm test -- --runInBand src/data/sqlite/__tests__/database.test.ts
npm run typecheck
```

Expected: the adapter tests pass and the database double satisfies `AppDatabase`.

- [ ] **Step 6: Commit the database boundary**

```bash
git add src/data/sqlite/database.ts src/test/create-database-double.ts src/data/sqlite/__tests__/database.test.ts
git commit -m "feat: isolate Expo SQLite adapter"
```

---

### Task 7: Create the versioned schema and idempotent seeds

**Files:**
- Create: `src/data/sqlite/migrations.ts`
- Create: `src/data/sqlite/__tests__/migrations.test.ts`

**Interfaces:**
- Consumes: `AppDatabase`, `createDefaultCalendar`, and `createStandardTemporalDefinitions`.
- Produces: `DATABASE_NAME`, `LATEST_SCHEMA_VERSION`, and `migrateDatabase(database, environment)`.

- [ ] **Step 1: Write failing migration tests**

Cover:

1. WAL and foreign keys are enabled before migrations.
2. Schema version 1 creates `schema_migrations`, `calendars`, `temporal_definitions`, `events`, and `app_settings`.
3. Migration and seed work happens inside one exclusive transaction.
4. The default calendar and 22 definitions use `INSERT ... ON CONFLICT DO NOTHING` with bound values.
5. Defaults are `instant` and `120` minutes.
6. An existing version 1 database does not rerun schema or seed writes.
7. A failed transaction does not report a completed migration.

Use an injected environment instead of global time-zone or clock calls:

```ts
export type MigrationEnvironment = Readonly<{
  now: () => string;
  timeZoneId: () => string;
}>;
```

Test with fixed functions returning `2026-09-08T00:00:00.000Z` and `Asia/Tokyo`.

- [ ] **Step 2: Run the test to verify failure**

```bash
npm test -- --runInBand src/data/sqlite/__tests__/migrations.test.ts
```

Expected: FAIL because `migrations.ts` does not exist.

- [ ] **Step 3: Implement schema version 1**

Set constants:

```ts
export const DATABASE_NAME = 'zakkuri-calendar.db';
export const LATEST_SCHEMA_VERSION = 1;
```

Before the transaction, execute:

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
```

Inside `exclusiveTransaction`, use the transaction object passed to the callback to create the five tables defined in design section 9. Do not issue migration queries through the outer database adapter. Include:

- foreign keys from definitions and events to calendars;
- a nullable foreign key from events to temporal definitions;
- `UNIQUE(calendar_id, key)` for definitions;
- checks for booleans, fade ranges, fade sum, and non-negative sort order;
- indexes on `events(calendar_id, anchor_date)` and `temporal_definitions(calendar_id, is_enabled, sort_order)`;
- a primary-key version row in `schema_migrations`.

Do not concatenate calendar IDs, labels, JSON, times, or settings into SQL. Serialize each resolver config with `JSON.stringify` and pass named parameters.

- [ ] **Step 4: Implement idempotent seed writes**

Insert the default calendar, all 22 definitions, and these settings:

```ts
const settings = [
  ['default_exact_duration', JSON.stringify({ type: 'instant' })],
  ['undetermined_fade_minutes', JSON.stringify(120)],
] as const;
```

Use stable IDs and `ON CONFLICT DO NOTHING`; do not overwrite user-edited definitions during later app launches.

- [ ] **Step 5: Run migration and catalog tests**

```bash
npm test -- --runInBand src/data/sqlite/__tests__/migrations.test.ts src/domain/temporal/__tests__/standard-definitions.test.ts
npm run typecheck
```

Expected: all focused tests pass and typecheck exits 0.

- [ ] **Step 6: Commit schema and migration version 1**

```bash
git add src/data/sqlite/migrations.ts src/data/sqlite/__tests__/migrations.test.ts
git commit -m "feat: add local calendar database schema"
```

---

### Task 8: Map database rows through domain validation

**Files:**
- Create: `src/data/sqlite/row-mappers.ts`
- Create: `src/data/sqlite/__tests__/row-mappers.test.ts`

**Interfaces:**
- Consumes: raw `CalendarRow`, `TemporalDefinitionRow`, `EventRow`, and domain parsers.
- Produces: `mapCalendarRow`, `mapTemporalDefinitionRow`, `mapEventRow`, and `CorruptDatabaseRowError`.

- [ ] **Step 1: Write failing row-mapper tests**

Test:

- snake_case database columns become camelCase domain fields;
- integer booleans become booleans;
- `resolver_config_json` is parsed and validated;
- exact duration row columns become the correct discriminated union;
- all-day and fuzzy rows do not leak irrelevant nullable columns;
- malformed JSON, invalid fade ratios, invalid dates, and impossible duration combinations throw `CorruptDatabaseRowError` without including the event title in the message.

Example privacy assertion:

```ts
expect(() => mapEventRow({ ...row, temporal_type: 'exact', start_time: null })).toThrow(
  'Invalid event row: event-1',
);
expect(() => mapEventRow({ ...row, temporal_type: 'exact', start_time: null })).not.toThrow(
  /歯医者/,
);
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npm test -- --runInBand src/data/sqlite/__tests__/row-mappers.test.ts
```

Expected: FAIL because `row-mappers.ts` does not exist.

- [ ] **Step 3: Implement focused mappers**

Each mapper accepts exactly one row type, constructs an unknown domain candidate, passes it through the corresponding parser, and throws an ID-only `CorruptDatabaseRowError` on failure. Do not create a generic reflection-based mapper.

- [ ] **Step 4: Run mapper and domain tests**

```bash
npm test -- --runInBand src/data/sqlite/__tests__/row-mappers.test.ts src/domain
npm run typecheck
```

Expected: all mapper/domain tests pass and no error message contains a title.

- [ ] **Step 5: Commit row mapping**

```bash
git add src/data/sqlite/row-mappers.ts src/data/sqlite/__tests__/row-mappers.test.ts
git commit -m "feat: validate SQLite row mapping"
```

---

### Task 9: Implement parameterized repositories and typed settings

**Files:**
- Create: `src/data/sqlite/calendar-repository.ts`
- Create: `src/data/sqlite/temporal-definition-repository.ts`
- Create: `src/data/sqlite/event-repository.ts`
- Create: `src/data/sqlite/settings-repository.ts`
- Create: `src/data/sqlite/repository-container.ts`
- Create: `src/data/sqlite/__tests__/repositories.test.ts`

**Interfaces:**
- Consumes: `AppDatabase`, row mappers, and the repository contracts from Task 5.
- Produces: concrete repository classes and `createRepositoryContainer(database)`.

- [ ] **Step 1: Write failing repository tests**

Use `createDatabaseDouble()` to assert:

- default calendar lookup uses `DEFAULT_CALENDAR_ID` as a bound parameter;
- enabled definitions filter by calendar ID and `is_enabled = 1`, ordered by `sort_order, key`;
- disabled definitions remain retrievable through `getById`;
- `disable` updates `is_enabled` and `updated_at` but never deletes the row;
- event range query uses inclusive `anchor_date >=` and `anchor_date <=` bounds;
- create/update map all three temporal types to consistent nullable columns;
- delete binds only the event ID;
- a missing setting returns `{ type: 'instant' }` or `120`;
- malformed settings return the safe default without including the raw value in an error;
- setting a default duration accepts only the domain duration union.

Example binding assertion:

```ts
expect(database.run).toHaveBeenCalledWith(
  expect.stringContaining('UPDATE temporal_definitions'),
  {
    $id: 'personal-default:morning',
    $updatedAt: '2026-09-08T00:00:00.000Z',
  },
);
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npm test -- --runInBand src/data/sqlite/__tests__/repositories.test.ts
```

Expected: FAIL because the concrete repositories do not exist.

- [ ] **Step 3: Implement calendar and definition repositories**

Use named parameters and row mappers. `getDefault` throws an ID-only infrastructure error if the seeded calendar is absent. `disable` checks `changes === 1`; zero changes reports a missing definition.

- [ ] **Step 4: Implement event repository**

Centralize event-to-parameter conversion in a private focused function inside `event-repository.ts`. For irrelevant nullable columns, bind `null`. Order range results by `anchor_date`, then `start_time`, then `created_at`, then `id` for deterministic UI consumption.

- [ ] **Step 5: Implement settings repository**

Parse `value_json` as `unknown`, validate the exact duration union or positive integer fade minutes, and fall back to the agreed safe values. `setDefaultExactDuration` uses upsert by key.

- [ ] **Step 6: Construct one repository container**

Expose:

```ts
export type RepositoryContainer = Readonly<{
  calendars: CalendarRepository;
  temporalDefinitions: TemporalDefinitionRepository;
  events: EventRepository;
  settings: SettingsRepository;
}>;

export function createRepositoryContainer(database: AppDatabase): RepositoryContainer;
```

- [ ] **Step 7: Run repository tests and typecheck**

```bash
npm test -- --runInBand src/data/sqlite/__tests__/repositories.test.ts src/data/sqlite/__tests__/row-mappers.test.ts
npm run typecheck
```

Expected: all repository and mapper tests pass; typecheck exits 0.

- [ ] **Step 8: Commit repositories**

```bash
git add src/data/sqlite/calendar-repository.ts src/data/sqlite/temporal-definition-repository.ts src/data/sqlite/event-repository.ts src/data/sqlite/settings-repository.ts src/data/sqlite/repository-container.ts src/data/sqlite/__tests__/repositories.test.ts
git commit -m "feat: add local calendar repositories"
```

---

### Task 10: Initialize SQLite at the app boundary

**Files:**
- Create: `src/data/sqlite/app-database-provider.tsx`
- Create: `src/shared/components/database-error-state.tsx`
- Create: `src/data/sqlite/__tests__/app-database-provider.test.tsx`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Consumes: Expo `SQLiteProvider`, `migrateDatabase`, `createExpoDatabaseAdapter`, and `createRepositoryContainer`.
- Produces: `AppDatabaseProvider`, `useRepositories()`, and a retryable `DatabaseErrorState`.

- [ ] **Step 1: Write failing provider tests**

Mock `expo-sqlite` at the module boundary. Cover:

- children are wrapped with database name `zakkuri-calendar.db`;
- `onInit` adapts the Expo database and calls `migrateDatabase`;
- repositories are available only below the initialized provider;
- `useRepositories` outside the provider throws `useRepositories must be used within AppDatabaseProvider`;
- an initialization error renders `データを読み込めませんでした` and a `再試行` button;
- pressing retry remounts `SQLiteProvider` with a new key;
- displayed/logged errors do not include database SQL or event data.

- [ ] **Step 2: Run the provider test to verify failure**

```bash
npm test -- --runInBand src/data/sqlite/__tests__/app-database-provider.test.tsx
```

Expected: FAIL because `app-database-provider.tsx` does not exist.

- [ ] **Step 3: Implement the shared error state**

`DatabaseErrorState` accepts:

```ts
type DatabaseErrorStateProps = Readonly<{
  onRetry: () => void;
}>;
```

Render the fixed Japanese title, a short non-technical explanation, and an accessible retry `Pressable`. Do not accept or render the underlying `Error` object.

- [ ] **Step 4: Implement the provider and repository hook**

Use the device's current IANA zone through `Intl.DateTimeFormat().resolvedOptions().timeZone`, falling back to `UTC` only when the platform returns an empty value. Inject `new Date().toISOString()` and that zone into `migrateDatabase`.

Use `SQLiteProvider`'s `onInit` and `onError`. A private child component calls `useSQLiteContext()`, adapts that database, memoizes `createRepositoryContainer(adapter)`, and provides only the resulting container through Context. On retry, clear the public error state and increment a provider key. Do not export the raw SQLite database through Context.

- [ ] **Step 5: Wrap the existing root layout**

In `src/app/_layout.tsx`, keep `ThemeProvider`, `AnimatedSplashOverlay`, and current navigation behavior. Add `AppDatabaseProvider` outside the app content so every later screen can access repositories through `useRepositories`.

- [ ] **Step 6: Run provider tests and app checks**

```bash
npm test -- --runInBand src/data/sqlite/__tests__/app-database-provider.test.tsx
npm run typecheck
npm run lint
```

Expected: provider tests pass; typecheck and lint exit 0.

- [ ] **Step 7: Commit application integration**

```bash
git add src/data/sqlite/app-database-provider.tsx src/shared/components/database-error-state.tsx src/data/sqlite/__tests__/app-database-provider.test.tsx src/app/_layout.tsx
git commit -m "feat: initialize local database at app startup"
```

---

### Task 11: Verify the complete foundation and document its boundary

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: all outputs of Tasks 1–10.
- Produces: a verified foundation ready for the month-view task, plus concise developer setup documentation.

- [ ] **Step 1: Add focused README guidance**

Replace the create-expo-app placeholder guidance with a small development section that states:

- install with `npm ci`;
- run with `npm start`;
- run `npm test -- --runInBand`, `npm run typecheck`, and `npm run lint`;
- the app is local-first and uses `zakkuri-calendar.db`;
- migrations live in `src/data/sqlite/migrations.ts` and must remain idempotent;
- UI must access data through repositories/hooks, not direct SQL.

Do not document unimplemented screens as available.

- [ ] **Step 2: Run the full automated verification**

```bash
npm test -- --runInBand
npm run typecheck
npm run lint
npx expo export --platform ios --output-dir /tmp/zakkuri-calendar-ios-export
npx expo export --platform android --output-dir /tmp/zakkuri-calendar-android-export
git diff --check
```

Expected:

- all Jest suites pass with zero failures;
- TypeScript and lint exit 0;
- both platform exports exit 0;
- `git diff --check` prints no errors.

These exports verify bundling only. They do not establish simulator/device SQLite behavior.

- [ ] **Step 3: Perform a native persistence smoke check**

Run the app on one available iOS simulator or Android emulator. Confirm:

1. the starter UI opens after database initialization;
2. force-closing and reopening does not show an initialization error;
3. a second launch completes without a migration or initialization error;
4. no event content or SQL is printed to the console.

If neither platform runtime is available, record this check as unverified in the PR instead of inferring success from Jest or export output.

- [ ] **Step 4: Commit the verified developer documentation**

```bash
git add README.md
git commit -m "docs: document local database foundation"
```

- [ ] **Step 5: Update GitHub tracking after verification**

In Issue #3, check only acceptance items backed by the commands above. Open a PR to `develop`, include `Closes #3`, list exact automated checks, and state native persistence as verified or unverified.
