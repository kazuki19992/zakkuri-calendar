# 最後に開いたカレンダービューの復元 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 最後に正常表示し保存できた2日／月ビューを次回起動時から直接復元し、設定保存だけ失敗した場合も現在表示を維持する。

**Architecture:** `app_settings`を利用する型付きSettingsRepositoryへ表示モード設定を追加し、`useCalendarView`が初期設定の1回限りの復元、表示data取得後の保存、競合防止を調整する。routeとUIは永続化へ直接依存せず、screenは表示用error stateだけを描画する。

**Tech Stack:** Expo SDK 57、React Native 0.86、TypeScript 6、expo-sqlite、Jest、React Native Testing Library

**Spec:** `docs/superpowers/specs/2026-10-04-restore-calendar-view-design.md`

## 実装結果

- [x] `CalendarViewMode`の型・既定値・validationと、既存`app_settings`を使うSettingsRepository境界を追加した。
- [x] hook初期化時だけ保存済みmodeを解決し、最初のsnapshotから2日／月ビューを直接復元した。
- [x] 切替先dataの取得成功後だけmodeを保存し、保存だけ失敗した場合は切替後の表示を維持した。
- [x] 設定保存errorを期間取得errorと独立した`alert`としてtop bar直下へ表示した。
- [x] focused test: 6 suites、118 tests PASS。
- [x] `npm run typecheck`、`npm run lint`、全61 suites／556 tests、`git diff --check`がPASS。
- [x] Metroの旧worktree参照cacheを`--clear`で再構築し、iOS／AndroidのExpo exportが成功した。
- [ ] 実機での初回起動・再起動後のSQLite永続化、保存失敗表示、VoiceOver／TalkBackは未確認。

## Global Constraints

- 保存対象は`twoDay | month`だけとし、既定値は`twoDay`とする。
- 設定keyは`last_calendar_view_mode`、保存値はJSON文字列`"twoDay"`または`"month"`とする。
- `app_settings`を再利用し、schema version、table、column、migrationを変更しない。
- UIと`src/app/index.tsx`からSQLiteへ直接アクセスしない。
- 初期設定の欠損、不正値、取得失敗では2日ビューへfallbackし、設定errorを表示しない。
- 設定復元はhook初期化時だけ行い、retryと`refreshRevision`では現在modeを維持する。
- 表示data取得に失敗した場合はmodeを変更せず、設定を保存しない。
- 設定保存だけ失敗した場合は新modeを維持し、`selectMode`は`true`を返す。
- 保存失敗文面は「表示設定を保存できませんでした」、表示位置はtop bar直下、roleは`alert`とする。
- 既存のcalendar visibility設定用busy/version stateとは分離する。
- 新規依存を追加しない。

## Review Focus

- 初期mode取得中に`refreshRevision`が変わっても、古い2日ビュー取得が保存済み月ビューを上書きしないこと（Task 2でdeferred設定取得test）。
- 保存失敗後に`refreshRevision`が変わっても、画面が古い保存modeへ戻らないこと（Task 3でrerender test）。
- snapshot取得が成功する前に設定を保存せず、取得失敗時は現在modeと保存値を維持すること（Task 3で呼出順・失敗test）。
- React再描画前の連打でもmode切替と設定保存を二重実行しないこと（Task 3でdeferred snapshot test）。
- 期間取得errorと設定保存errorが同時に存在しても、利用者とscreen readerへ両方を伝えること（Task 4で2 alert test）。

---

### Task 1: 表示モード設定のdomain・Repository境界を追加する

**Files:**
- Create: `src/domain/calendar/calendar-view-mode.ts`
- Create: `src/domain/calendar/__tests__/calendar-view-mode.test.ts`
- Modify: `src/domain/calendar/repositories.ts`
- Modify: `src/data/sqlite/settings-repository.ts`
- Modify: `src/data/sqlite/__tests__/repositories.test.ts`
- Modify: `src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx`
- Modify: `src/features/events/hooks/__tests__/use-event-editor.test.tsx`
- Modify: `src/features/settings/hooks/__tests__/use-relative-date-settings.test.tsx`
- Modify: `src/app/__tests__/index.test.tsx`

**Interfaces:**
- Consumes: 既存`app_settings(key, value_json, updated_at)`と`SettingsRepository`。
- Produces: `CalendarViewMode`、`DEFAULT_CALENDAR_VIEW_MODE`、`parseCalendarViewMode(value)`、`SettingsRepository.getLastCalendarViewMode()`、`SettingsRepository.setLastCalendarViewMode(mode, updatedAt)`。

- [ ] **Step 1: worktreeと依存を確認する**

```bash
git status --short --branch
test -d node_modules || npm ci --include=dev
```

Expected: branchが`codex/restore-calendar-view`で、計画書以外に未追跡・未commit変更がない。依存がなければlockfileどおりに導入される。

- [ ] **Step 2: domain parserの失敗testを書く**

`src/domain/calendar/__tests__/calendar-view-mode.test.ts`を作成する。

```ts
import {
  DEFAULT_CALENDAR_VIEW_MODE,
  parseCalendarViewMode,
} from '../calendar-view-mode';

describe('カレンダー表示モード', () => {
  it.each(['twoDay', 'month'] as const)('既知の表示モード%sを受け入れる', (value) => {
    expect(parseCalendarViewMode(value)).toBe(value);
  });

  it.each([undefined, null, 'week', 2, {}, []])(
    '不正値%pを拒否する',
    (value) => expect(parseCalendarViewMode(value)).toBeNull(),
  );

  it('既定値は2日表示にする', () => {
    expect(DEFAULT_CALENDAR_VIEW_MODE).toBe('twoDay');
  });
});
```

- [ ] **Step 3: Repositoryの欠損・正常値・不正値・保存testを書く**

`src/data/sqlite/__tests__/repositories.test.ts`へ追加する。

```ts
it.each([
  [null, 'twoDay'],
  [{ value_json: '"twoDay"' }, 'twoDay'],
  [{ value_json: '"month"' }, 'month'],
  [{ value_json: '"week"' }, 'twoDay'],
  [{ value_json: '2' }, 'twoDay'],
  [{ value_json: 'broken' }, 'twoDay'],
] as const)('最後の表示モードを安全に読み込む', async (row, expected) => {
  const db = createDatabaseDouble();
  db.first.mockResolvedValue(row);
  await expect(new SqliteSettingsRepository(db.database).getLastCalendarViewMode())
    .resolves.toBe(expected);
  expect(db.first).toHaveBeenCalledWith(expect.stringContaining('WHERE key = $key'), {
    $key: 'last_calendar_view_mode',
  });
});

it('最後の表示モードを検証してbound parameterでupsertする', async () => {
  const db = createDatabaseDouble();
  const settings = new SqliteSettingsRepository(db.database);
  await settings.setLastCalendarViewMode('month', now);
  expect(db.run).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT(key) DO UPDATE'), {
    $key: 'last_calendar_view_mode', $valueJson: '"month"', $updatedAt: now,
  });
  await expect(settings.setLastCalendarViewMode('week' as never, now))
    .rejects.toThrow('Invalid calendar view mode');
});
```

- [ ] **Step 4: 対象testを実行してREDを確認する**

```bash
npm test -- src/domain/calendar/__tests__/calendar-view-mode.test.ts src/data/sqlite/__tests__/repositories.test.ts --runInBand
```

Expected: `calendar-view-mode` moduleとSettingsRepository methodが未実装のためFAILする。

- [ ] **Step 5: domain型・parser・Repository contractを実装する**

`src/domain/calendar/calendar-view-mode.ts`を作成する。

```ts
export type CalendarViewMode = 'twoDay' | 'month';

export const DEFAULT_CALENDAR_VIEW_MODE: CalendarViewMode = 'twoDay';

export function parseCalendarViewMode(value: unknown): CalendarViewMode | null {
  return value === 'twoDay' || value === 'month' ? value : null;
}
```

`src/domain/calendar/repositories.ts`へ型をimportし、`SettingsRepository`へ追加する。

```ts
getLastCalendarViewMode(): Promise<CalendarViewMode>;
setLastCalendarViewMode(mode: CalendarViewMode, updatedAt: string): Promise<void>;
```

- [ ] **Step 6: SQLite Repositoryを最小実装する**

`src/data/sqlite/settings-repository.ts`へ型、default、parserをimportして追加する。

```ts
async getLastCalendarViewMode(): Promise<CalendarViewMode> {
  const row = await this.database.first<SettingRow>(
    'SELECT value_json FROM app_settings WHERE key = $key',
    { $key: 'last_calendar_view_mode' },
  );
  if (!row) return DEFAULT_CALENDAR_VIEW_MODE;
  return parseCalendarViewMode(parseJson(row.value_json)) ?? DEFAULT_CALENDAR_VIEW_MODE;
}

async setLastCalendarViewMode(mode: CalendarViewMode, updatedAt: string): Promise<void> {
  if (parseCalendarViewMode(mode) === null) throw new Error('Invalid calendar view mode');
  await this.database.run(
    `INSERT INTO app_settings (key, value_json, updated_at)
     VALUES ($key, $valueJson, $updatedAt)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
    {
      $key: 'last_calendar_view_mode',
      $valueJson: JSON.stringify(mode),
      $updatedAt: updatedAt,
    },
  );
}
```

- [ ] **Step 7: SettingsRepositoryのtest doubleを更新する**

次の4か所に追加する。

```ts
getLastCalendarViewMode: jest.fn().mockResolvedValue('twoDay'),
setLastCalendarViewMode: jest.fn().mockResolvedValue(undefined),
```

- `src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx`の`createDependencies`
- `src/features/events/hooks/__tests__/use-event-editor.test.tsx`の`createRepositories`
- `src/features/settings/hooks/__tests__/use-relative-date-settings.test.tsx`の`repository`
- `src/app/__tests__/index.test.tsx`のRepository container fixture

- [ ] **Step 8: Repositoryと型検証をGREENにする**

```bash
npm test -- src/domain/calendar/__tests__/calendar-view-mode.test.ts src/data/sqlite/__tests__/repositories.test.ts --runInBand
npm run typecheck
```

Expected: 対象testがPASSし、SettingsRepository実装・test doubleの不足がない。

- [ ] **Step 9: Task 1をcommitする**

```bash
git add src/domain/calendar/calendar-view-mode.ts src/domain/calendar/__tests__/calendar-view-mode.test.ts src/domain/calendar/repositories.ts src/data/sqlite/settings-repository.ts src/data/sqlite/__tests__/repositories.test.ts src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx src/features/events/hooks/__tests__/use-event-editor.test.tsx src/features/settings/hooks/__tests__/use-relative-date-settings.test.tsx src/app/__tests__/index.test.tsx
git commit -m "feat(settings): カレンダービュー設定を保存"
```

---

### Task 2: 保存済みmodeを初回snapshotへ適用する

**Files:**
- Modify: `src/features/calendar/hooks/use-calendar-view.ts`
- Modify: `src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx`
- Modify: `src/features/calendar/components/calendar-side-menu.tsx`

**Interfaces:**
- Consumes: Task 1の`CalendarViewMode`、`DEFAULT_CALENDAR_VIEW_MODE`、`getLastCalendarViewMode()`。
- Produces: 初期化時に1回だけ設定を解決する`useCalendarView`と、domain型を参照するside menu。

- [ ] **Step 1: 初回月表示とfallbackの失敗testを書く**

`src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx`へ追加する。

```ts
it('保存済み月表示を初回snapshotから直接読み込む', async () => {
  const dependencies = createDependencies();
  dependencies.settings.getLastCalendarViewMode.mockResolvedValue('month');
  const { result } = await renderHook(() => useCalendarView({
    ...dependencies, weekStartsOn: 1, now: () => new Date(2026, 8, 8, 12),
  }));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current).toMatchObject({
    mode: 'month', selectedDate: '2026-09-08', visibleMonth: '2026-09-01',
  });
  expect(dependencies.events.listSchedule).toHaveBeenCalledTimes(1);
  expect(dependencies.events.listSchedule).toHaveBeenCalledWith(
    calendar.id, '2026-08-31', '2026-10-11',
  );
});

it('表示設定の取得失敗では2日表示を読み込みalertを出さない', async () => {
  const dependencies = createDependencies();
  dependencies.settings.getLastCalendarViewMode.mockRejectedValue(new Error('unavailable'));
  const { result } = await renderHook(() => useCalendarView({
    ...dependencies, weekStartsOn: 1, now: () => new Date(2026, 8, 8, 12),
  }));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current).toMatchObject({ mode: 'twoDay', periodError: null });
});
```

- [ ] **Step 2: 初期取得とrefresh競合の失敗testを書く**

既存`createDeferred`を使う。

```ts
it('初期mode取得中のrefreshでも保存済み月表示を一度だけ適用する', async () => {
  const dependencies = createDependencies();
  const mode = createDeferred<CalendarViewMode>();
  dependencies.settings.getLastCalendarViewMode.mockReturnValue(mode.promise);
  const { result, rerender } = await renderHook(
    ({ revision }) => useCalendarView({
      ...dependencies, refreshRevision: revision, weekStartsOn: 1,
      now: () => new Date(2026, 8, 8, 12),
    }),
    { initialProps: { revision: 0 } },
  );
  await rerender({ revision: 1 });
  await act(async () => mode.resolve('month'));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current.mode).toBe('month');
  expect(dependencies.settings.getLastCalendarViewMode).toHaveBeenCalledTimes(1);
  expect(dependencies.events.listSchedule).toHaveBeenLastCalledWith(
    calendar.id, '2026-08-31', '2026-10-11',
  );
});
```

初回snapshotを失敗させて`retry()`したtestにも、getterが1回のままであるassertを追加する。

- [ ] **Step 3: hook対象testを実行してREDを確認する**

```bash
npm test -- src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx --runInBand
```

Expected: 現在は初期modeを読まず常に`twoDay`なので新規testがFAILする。

- [ ] **Step 4: 表示モード型をdomainへ統一する**

`use-calendar-view.ts`からlocal typeを削除し、Task 1の型とdefaultをimportする。`calendar-side-menu.tsx`もfeature hookではなくdomain moduleから型をimportする。

```ts
import {
  DEFAULT_CALENDAR_VIEW_MODE,
  type CalendarViewMode,
} from '@/domain/calendar/calendar-view-mode';
```

- [ ] **Step 5: 初期modeを1回だけ解決する境界を実装する**

`useCalendarView`へ追加する。

```ts
const initialModePromiseRef = useRef<Promise<CalendarViewMode> | null>(null);
const initialModeAppliedRef = useRef(false);

const getInitialMode = useCallback((): Promise<CalendarViewMode> => {
  initialModePromiseRef.current ??= inputRef.current.settings
    .getLastCalendarViewMode()
    .catch(() => DEFAULT_CALENDAR_VIEW_MODE);
  return initialModePromiseRef.current;
}, []);
```

modeからtargetを作る純粋helperを追加する。

```ts
function withViewMode(target: ViewTarget, mode: CalendarViewMode): ViewTarget {
  return mode === 'month'
    ? { ...target, mode, visibleMonth: getMonthStart(target.today), selectedDate: target.today }
    : { ...target, mode, anchorDate: target.today,
        visibleMonth: getMonthStart(target.today), selectedDate: target.today };
}
```

初期load effectはrequest ID採番後に次の順序で処理する。

```ts
let target = stateRef.current;
if (!initialModeAppliedRef.current) {
  const mode = await getInitialMode();
  if (!mountedRef.current || requestId !== requestIdRef.current) return;
  target = withViewMode(stateRef.current, mode);
  initialModeAppliedRef.current = true;
  setState((current) => ({ ...current, ...target }));
}
const snapshot = await loadSnapshot(inputRef.current, target);
```

成功時の`setState`にも`...target`を含める。loading中にtargetをstateへ保持するため、初回snapshotが失敗した場合もretryは復元対象modeを再取得する。以後の`refreshRevision`では現在targetだけを再取得する。

- [ ] **Step 6: 初期復元testをGREENにする**

```bash
npm test -- src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx src/features/calendar/components/__tests__/calendar-navigation-components.test.tsx --runInBand
npm run typecheck
```

Expected: 保存済み月表示、fallback、deferred初期取得、retry、既存calendar操作がPASSする。

- [ ] **Step 7: Task 2をcommitする**

```bash
git add src/features/calendar/hooks/use-calendar-view.ts src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx src/features/calendar/components/calendar-side-menu.tsx
git commit -m "feat(calendar): 保存済み表示を起動時に復元"
```

---

### Task 3: 表示切替成功後にmodeを保存する

**Files:**
- Modify: `src/features/calendar/hooks/use-calendar-view.ts`
- Modify: `src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx`

**Interfaces:**
- Consumes: Task 1の`setLastCalendarViewMode()`、Task 2の初期復元済みstateと既存`transitionTo(target)`。
- Produces: `CalendarViewState.viewModePersistenceError`と、表示成功後だけ設定を保存する`selectMode(mode): Promise<boolean>`。

- [ ] **Step 1: 成功時の順序とsnapshot失敗testを書く**

```ts
it('表示data取得成功後にだけ最後のmodeを保存する', async () => {
  const dependencies = createDependencies();
  const { result } = await renderHook(() => useCalendarView({
    ...dependencies, weekStartsOn: 1, now: () => new Date(2026, 8, 8, 12),
  }));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  await act(async () => expect(await result.current.selectMode('month')).toBe(true));
  expect(dependencies.settings.setLastCalendarViewMode).toHaveBeenCalledWith(
    'month', '2026-09-08T03:00:00.000Z',
  );
  expect(dependencies.events.listSchedule.mock.invocationCallOrder.at(-1))
    .toBeLessThan(dependencies.settings.setLastCalendarViewMode.mock.invocationCallOrder[0]);
});

it('切替先data取得失敗時はmodeと保存設定を変更しない', async () => {
  const dependencies = createDependencies();
  const { result } = await renderHook(() => useCalendarView({
    ...dependencies, weekStartsOn: 1, now: () => new Date(2026, 8, 8, 12),
  }));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  dependencies.events.listSchedule.mockRejectedValueOnce(new Error('unavailable'));
  await act(async () => expect(await result.current.selectMode('month')).toBe(false));
  expect(result.current.mode).toBe('twoDay');
  expect(dependencies.settings.setLastCalendarViewMode).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 保存失敗・refresh・連打の失敗testを書く**

```ts
it('mode保存だけ失敗しても月表示を維持して成功を返す', async () => {
  const dependencies = createDependencies();
  dependencies.settings.setLastCalendarViewMode.mockRejectedValue(new Error('unavailable'));
  const { result } = await renderHook(() => useCalendarView({
    ...dependencies, weekStartsOn: 1, now: () => new Date(2026, 8, 8, 12),
  }));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  await act(async () => expect(await result.current.selectMode('month')).toBe(true));
  expect(result.current).toMatchObject({
    mode: 'month', viewModePersistenceError: '表示設定を保存できませんでした',
  });
});

it('保存失敗後のrefreshでも月表示を維持し初期設定を再取得しない', async () => {
  const dependencies = createDependencies();
  dependencies.settings.getLastCalendarViewMode.mockResolvedValue('twoDay');
  dependencies.settings.setLastCalendarViewMode.mockRejectedValue(new Error('unavailable'));
  const { result, rerender } = await renderHook(
    ({ revision }) => useCalendarView({
      ...dependencies, refreshRevision: revision, weekStartsOn: 1,
      now: () => new Date(2026, 8, 8, 12),
    }),
    { initialProps: { revision: 0 } },
  );
  await waitFor(() => expect(result.current.status).toBe('ready'));
  await act(async () => expect(await result.current.selectMode('month')).toBe(true));
  await rerender({ revision: 1 });
  await waitFor(() => expect(result.current.isPeriodLoading).toBe(false));
  expect(result.current.mode).toBe('month');
  expect(dependencies.settings.getLastCalendarViewMode).toHaveBeenCalledTimes(1);
});
```

連打testでは月表示用`listSchedule`をdeferredにし、1回目完了前の2回目が`false`、月表示用取得とsetterが各1回であることをassertする。unmount testではsetterをdeferredにし、unmount後のrejectでstate更新warningがないことを確認する。

- [ ] **Step 3: hook対象testを実行してREDを確認する**

```bash
npm test -- src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx --runInBand
```

Expected: setter未呼出、公開error property未定義、連打guard未実装のため新規testがFAILする。

- [ ] **Step 4: persistence stateと同期guardを追加する**

`InternalState`と`CalendarViewState`へ追加する。

```ts
viewModePersistenceError: string | null;
```

初期値は`null`。hook内へ追加する。

```ts
const modeSelectionBusyRef = useRef(false);
const modeSelectionVersionRef = useRef(0);
```

- [ ] **Step 5: selectModeを表示成功後保存へ変更する**

```ts
const selectMode = useCallback(async (mode: CalendarViewMode): Promise<boolean> => {
  if (modeSelectionBusyRef.current) return false;
  const current = stateRef.current;
  if (current.mode === mode) return true;
  modeSelectionBusyRef.current = true;
  const operationVersion = ++modeSelectionVersionRef.current;
  setState((value) => ({ ...value, viewModePersistenceError: null }));
  try {
    const target = mode === 'month'
      ? { ...current, mode, visibleMonth: getMonthStart(current.selectedDate) }
      : { ...current, mode, anchorDate: current.selectedDate,
          visibleMonth: getMonthStart(current.selectedDate) };
    if (!await transitionTo(target)) return false;
    try {
      const now = (inputRef.current.now ?? getSystemTime)().toISOString();
      await inputRef.current.settings.setLastCalendarViewMode(mode, now);
      if (mountedRef.current && operationVersion === modeSelectionVersionRef.current) {
        setState((value) => ({ ...value, viewModePersistenceError: null }));
      }
    } catch {
      if (mountedRef.current && operationVersion === modeSelectionVersionRef.current) {
        setState((value) => ({
          ...value,
          viewModePersistenceError: '表示設定を保存できませんでした',
        }));
      }
    }
    return true;
  } finally {
    modeSelectionBusyRef.current = false;
  }
}, [transitionTo]);
```

unmount cleanupで`modeSelectionVersionRef.current += 1`を行い、公開return objectへerrorを追加する。

- [ ] **Step 6: 保存成功でerrorが消えるtestを追加する**

setterを1回目reject、2回目resolveにし、`month`への失敗後に`twoDay`へ戻した結果が`viewModePersistenceError: null`で、setterが`month`、`twoDay`の順に呼ばれることをassertする。同じmode再選択ではsnapshotとsetterのcall数が増えないtestも追加する。

- [ ] **Step 7: Task 3対象testをGREENにする**

```bash
npm test -- src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx --runInBand
npm run typecheck
```

Expected: 初期復元、保存順序、取得失敗、保存失敗、refresh、連打、unmount、error解除がPASSする。

- [ ] **Step 8: Task 3をcommitする**

```bash
git add src/features/calendar/hooks/use-calendar-view.ts src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx
git commit -m "feat(calendar): 表示切替結果を設定へ保存"
```

---

### Task 4: 設定保存errorをcalendar画面へ表示する

**Files:**
- Modify: `src/features/calendar/screens/calendar-screen.tsx`
- Modify: `src/features/calendar/screens/__tests__/calendar-screen.test.tsx`
- Test: `src/features/calendar/components/__tests__/calendar-navigation-components.test.tsx`

**Interfaces:**
- Consumes: Task 3の`CalendarViewState.viewModePersistenceError`と、保存失敗でも`true`を返す`selectMode`。
- Produces: top bar直下の独立した`alert`表示。side menuの既存「trueなら閉じる」contractを維持する。

- [ ] **Step 1: screen state fixtureを更新する**

`createState`の既定値へ追加する。

```ts
viewModePersistenceError: null,
```

- [ ] **Step 2: 設定保存errorと複数alertの失敗testを書く**

```ts
it('表示設定の保存失敗をtop bar直下のalertとして表示する', async () => {
  await renderWithSafeArea(<CalendarScreen
    state={createState({ viewModePersistenceError: '表示設定を保存できませんでした' })}
    onAddEvent={jest.fn()}
  />);
  expect(screen.getByRole('alert')).toHaveTextContent('表示設定を保存できませんでした');
});

it('期間取得と表示設定保存のerrorを独立して表示する', async () => {
  await renderWithSafeArea(<CalendarScreen state={createState({
    periodError: '表示期間を読み込めませんでした',
    viewModePersistenceError: '表示設定を保存できませんでした',
  })} onAddEvent={jest.fn()} />);
  expect(screen.getAllByRole('alert').map((item) => item.props.children)).toEqual([
    '表示期間を読み込めませんでした',
    '表示設定を保存できませんでした',
  ]);
});
```

- [ ] **Step 3: screen testを実行してREDを確認する**

```bash
npm test -- src/features/calendar/screens/__tests__/calendar-screen.test.tsx --runInBand
```

Expected: 設定保存errorを描画していないため新規testがFAILする。

- [ ] **Step 4: top bar直下へerrorを描画する**

既存`periodError`の直後へ追加する。

```tsx
{state.viewModePersistenceError !== null ? (
  <Text accessibilityRole="alert" style={[styles.error, { color: theme.calendarHoliday }]}>
    {state.viewModePersistenceError}
  </Text>
) : null}
```

- [ ] **Step 5: side menu contractの回帰testを補強する**

`calendar-navigation-components.test.tsx`の既存「月表示選択で`onSelectMode`がtrueなら閉じる」testを維持する。`onSelectMode`がfalseの場合は`onClose`を呼ばないtestを追加し、表示data取得失敗との境界を固定する。

- [ ] **Step 6: UI対象testをGREENにする**

```bash
npm test -- src/features/calendar/screens/__tests__/calendar-screen.test.tsx src/features/calendar/components/__tests__/calendar-navigation-components.test.tsx --runInBand
npm run typecheck
```

Expected: 固定文面、2つのalert、成功時close、表示data失敗時menu維持がPASSする。

- [ ] **Step 7: Task 4をcommitする**

```bash
git add src/features/calendar/screens/calendar-screen.tsx src/features/calendar/screens/__tests__/calendar-screen.test.tsx src/features/calendar/components/__tests__/calendar-navigation-components.test.tsx
git commit -m "feat(calendar): 表示設定の保存失敗を通知"
```

---

### Task 5: 文書更新、全体検証、Issue #16のPRを作成する

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-10-04-restore-calendar-view.md`
- Verify: `docs/superpowers/specs/2026-10-04-restore-calendar-view-design.md`
- Verify: all changed source and test files

**Interfaces:**
- Consumes: Task 1〜4の完成した設定保存・初期復元・error表示。
- Produces: 実装結果を反映した文書、検証証跡、Issue #16を閉じる`develop`向けOpen PR。

- [ ] **Step 1: READMEの未実装記述を更新する**

現在の記述を次へ変更する。

```text
2日／月の最後に開いた表示を次回起動時に復元します。未保存または不正な設定値では2日ビューを表示します。
```

Issue #9／#10と時間表現設定UIの未実装記述は残す。

- [ ] **Step 2: planへ実装結果を追記する**

このplan冒頭のGlobal Constraints前へ「実装結果」節を追加し、Task 1〜4の各deliverable、実行した検証、実機未確認をcheck付きで記録する。未実行の確認を完了扱いにしない。

- [ ] **Step 3: focused testをまとめて実行する**

```bash
npm test -- src/domain/calendar/__tests__/calendar-view-mode.test.ts src/data/sqlite/__tests__/repositories.test.ts src/features/calendar/hooks/__tests__/use-calendar-view.test.tsx src/features/calendar/components/__tests__/calendar-navigation-components.test.tsx src/features/calendar/screens/__tests__/calendar-screen.test.tsx src/app/__tests__/index.test.tsx --runInBand
```

Expected: default／validation、Repository、初期復元、保存、競合、UI、route回帰がすべてPASSする。

- [ ] **Step 4: 通常の全体検証を実行する**

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
git diff --check
```

Expected: 全commandがexit 0。失敗した場合は原因を修正し、同じcommandを最初から再実行する。

- [ ] **Step 5: iOS／Android exportを実行する**

```bash
npx expo export --platform ios --output-dir /tmp/zakkuri-calendar-restore-view-ios-20261004
npx expo export --platform android --output-dir /tmp/zakkuri-calendar-restore-view-android-20261004
```

Expected: 両platformがbundleとassetsを出力しexit 0。これは実機再起動後のSQLite永続化やscreen reader確認の証拠にはしない。

- [ ] **Step 6: 実装差分を設計境界と照合する**

```bash
git diff origin/develop...HEAD --stat
git diff origin/develop...HEAD -- src/domain/calendar src/data/sqlite src/features/calendar README.md docs/superpowers
git status --short --branch
```

次を確認する。

- schema migration、設定画面項目、未実装ビュー、Issue #9／#10の実装が混入していない。
- `src/app/index.tsx`へ設定取得・保存ロジックを追加していない。
- 保存失敗時も表示modeを維持し、固定文面だけを出している。
- worktreeに未追跡の成果物やexport出力がない。

- [ ] **Step 7: 文書と最終調整をcommitする**

```bash
git add README.md docs/superpowers/plans/2026-10-04-restore-calendar-view.md
git commit -m "docs: カレンダービュー復元の実装結果を更新"
```

source/testの修正が検証中に必要だった場合は、その責務に対応するSemantic Commitとして先に分けてcommitする。

- [ ] **Step 8: branchをpushしてPRを作成する**

```bash
git push -u origin codex/restore-calendar-view
gh pr create --base develop --head codex/restore-calendar-view \
  --title "feat(calendar): 最後に開いた表示を復元" \
  --body "Closes #16

## 変更内容
- 2日／月の最後に開いた表示を端末内へ保存
- 起動時の初回snapshotから保存済み表示を復元
- 表示設定だけ保存できない場合も切替後の表示を維持してalertを表示

## 設計境界
- 既存app_settingsを利用しschema migrationと新規依存はなし
- 設定復元はhook初期化時だけ行いrefreshでは現在表示を維持

## 検証
- focused test
- npm run typecheck
- npm run lint
- npm test -- --runInBand
- git diff --check
- iOS／Android Expo export

## 実機未確認
- 初回起動と再起動後のSQLite永続化
- 保存失敗時の表示
- VoiceOver／TalkBack"
```

PR本文へ次を明記する。

- 変更目的と、初回だけ保存modeを適用する設計。
- 表示data成功後に保存し、保存だけ失敗しても表示を維持する判断。
- schema migration、新規依存、設定画面追加がないこと。
- focused test、typecheck、lint、全test、diff check、iOS／Android exportの実結果。
- 実機での初回／再起動後の復元、保存失敗表示、VoiceOver／TalkBackは未確認であること。
- `Closes #16`。

- [ ] **Step 9: PRのhead・base・stateを確認する**

```bash
gh pr view --json number,state,isDraft,baseRefName,headRefName,headRefOid,url
git status --short --branch
```

Expected: `baseRefName`が`develop`、`headRefName`が`codex/restore-calendar-view`、`state`が`OPEN`、`isDraft`が`false`、worktreeがclean。レビュー対応のためworktreeとlocal branchはmerge確認まで保持する。
