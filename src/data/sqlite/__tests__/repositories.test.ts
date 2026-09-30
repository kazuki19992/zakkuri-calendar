import type { CalendarEvent } from '@/domain/calendar/event';
import type { EventReminder } from '@/domain/calendar/event-reminder';
import type { AppDatabase } from '@/data/sqlite/database';
import { createDatabaseDouble } from '@/test/create-database-double';
import { SqliteCalendarRepository } from '../calendar-repository';
import { SqliteEventRepository } from '../event-repository';
import { createRepositoryContainer } from '../repository-container';
import { SqliteSettingsRepository } from '../settings-repository';
import { SqliteTemporalDefinitionRepository } from '../temporal-definition-repository';
import type { CalendarRow, EventRow, TemporalDefinitionRow } from '../row-mappers';

const now = '2026-09-08T00:00:00.000Z';
const calendarRow: CalendarRow = {
  id: 'personal-default', name: 'マイカレンダー', time_zone_id: 'Asia/Tokyo', color_id: 'blue', created_at: now, updated_at: now,
};
const definitionRow: TemporalDefinitionRow = {
  id: 'personal-default:morning', calendar_id: 'personal-default', key: 'morning', label: '朝', granularity: 'day', resolver_type: 'timeOfDay',
  resolver_config_json: '{"kind":"timeOfDay","startMinute":360,"endMinute":600}', fade_in_ratio: 0.25, fade_out_ratio: 0.25,
  is_system: 1, is_enabled: 1, sort_order: 10, created_at: now, updated_at: now,
};
const eventRow: EventRow = {
  id: 'event-1', calendar_id: 'personal-default', title: '歯医者', temporal_type: 'exact', anchor_date: '2026-09-08',
  temporal_definition_id: null, start_time: '14:30', duration_type: 'fixed', duration_minutes: 30,
  created_time_zone_id: 'Asia/Tokyo', created_at: now, updated_at: now,
  end_date: null, location: '東京', notes: '診察券を持参', color_id: 'teal',
  recurrence_rule_json: '{"version":1,"frequency":"weekly","interval":1,"weekdays":[1],"end":{"type":"never"}}',
  fuzzy_resolution_context_json: null,
};
const exactEvent: CalendarEvent = {
  id: 'event-1', calendarId: 'personal-default', title: '歯医者', temporalType: 'exact', anchorDate: '2026-09-08',
  startTime: '14:30', duration: { type: 'fixed', minutes: 30 }, location: '東京', notes: '診察券を持参', colorId: 'teal',
  recurrenceRule: { version: 1, frequency: 'weekly', interval: 1, weekdays: [1], end: { type: 'never' } },
  createdTimeZoneId: 'Asia/Tokyo', createdAt: now, updatedAt: now,
};
const reminder30: EventReminder = { id: 'reminder-30', eventId: exactEvent.id, minutesBefore: 30, sortOrder: 4 };
const reminder10: EventReminder = { id: 'reminder-10', eventId: exactEvent.id, minutesBefore: 10, sortOrder: 2 };

function createTransactionDatabaseDouble() {
  const db = createDatabaseDouble();
  const transactionRun = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
  const transaction = { ...db.database, run: transactionRun } as AppDatabase;
  db.exclusiveTransaction.mockImplementation(async (task: (handle: AppDatabase) => Promise<void>) => {
    await task(transaction);
  });
  return { ...db, transactionRun };
}

describe('SQLite repositories', () => {
  it('looks up the stable default calendar with a bound id', async () => {
    const db = createDatabaseDouble();
    db.first.mockResolvedValue(calendarRow);
    await expect(new SqliteCalendarRepository(db.database).getDefault()).resolves.toMatchObject({ id: 'personal-default' });
    expect(db.first).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $id'), { $id: 'personal-default' });
  });

  it('lists enabled definitions deterministically and keeps disabled definitions addressable', async () => {
    const db = createDatabaseDouble();
    db.all.mockResolvedValue([definitionRow]);
    db.first.mockResolvedValue({ ...definitionRow, is_enabled: 0 });
    const repository = new SqliteTemporalDefinitionRepository(db.database);
    await expect(repository.listEnabled('personal-default')).resolves.toHaveLength(1);
    expect(db.all).toHaveBeenCalledWith(expect.stringContaining('is_enabled = 1'), { $calendarId: 'personal-default' });
    expect(db.all.mock.calls[0][0]).toContain('ORDER BY sort_order, key');
    await expect(repository.getById(definitionRow.id)).resolves.toMatchObject({ isEnabled: false });
  });

  it('soft-disables a definition and rejects a missing id', async () => {
    const db = createDatabaseDouble();
    const repository = new SqliteTemporalDefinitionRepository(db.database);
    await repository.disable(definitionRow.id, now);
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining('UPDATE temporal_definitions'), { $id: definitionRow.id, $updatedAt: now });
    expect(db.run.mock.calls[0][0]).not.toContain('DELETE');
    db.run.mockResolvedValueOnce({ changes: 0, lastInsertRowId: 0 });
    await expect(repository.disable('missing', now)).rejects.toThrow('Temporal definition not found: missing');
  });

  it('queries an inclusive anchor range and recurring series candidates with deterministic ordering', async () => {
    const db = createDatabaseDouble();
    db.all.mockResolvedValue([eventRow]);
    const events = new SqliteEventRepository(db.database);
    await expect(events.listByAnchorRange('personal-default', '2026-09-01', '2026-09-30')).resolves.toHaveLength(1);
    expect(db.all).toHaveBeenCalledWith(expect.stringContaining('COALESCE(end_date, anchor_date) >= $from'), {
      $calendarId: 'personal-default', $from: '2026-09-01', $through: '2026-09-30',
    });
    expect(db.all.mock.calls[0][0]).toContain('anchor_date <= $through');
    expect(db.all.mock.calls[0][0]).toContain('recurrence_rule_json IS NOT NULL AND anchor_date <= $through');
    expect(db.all.mock.calls[0][0]).toContain('ORDER BY anchor_date, start_time, created_at, id');
  });

  it('予定と正規化済み通知を専用transaction handleで一体作成する', async () => {
    const db = createTransactionDatabaseDouble();
    await new SqliteEventRepository(db.database).create({ event: exactEvent, reminders: [reminder30, reminder10] });
    expect(db.exclusiveTransaction).toHaveBeenCalledTimes(1);
    expect(db.run).not.toHaveBeenCalled();
    expect(db.transactionRun).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO events'), expect.objectContaining({
      $location: '東京', $notes: '診察券を持参', $colorId: 'teal', $recurrenceRuleJson: expect.any(String),
    }));
    expect(db.transactionRun).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO event_reminders'), {
      $id: 'reminder-10', $eventId: exactEvent.id, $minutesBefore: 10, $sortOrder: 0,
    });
    expect(db.transactionRun).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO event_reminders'), {
      $id: 'reminder-30', $eventId: exactEvent.id, $minutesBefore: 30, $sortOrder: 1,
    });
  });

  it('不正な予定集約は予定本文を含まないエラーでtransaction開始前に拒否する', async () => {
    const db = createTransactionDatabaseDouble();
    const events = new SqliteEventRepository(db.database);
    const invalidReminder = { ...reminder10, eventId: 'other-event' };
    await expect(events.create({ event: exactEvent, reminders: [invalidReminder] }))
      .rejects.toThrow('Invalid event reminders');
    await expect(events.update({ event: { ...exactEvent, colorId: 'unknown-color' as never }, reminders: [] }))
      .rejects.toThrow('Invalid event aggregate');
    expect(db.exclusiveTransaction).not.toHaveBeenCalled();
    expect(db.transactionRun).not.toHaveBeenCalled();
  });

  it('予定と通知を取得して集約として返す', async () => {
    const db = createDatabaseDouble();
    db.first.mockResolvedValue(eventRow);
    db.all.mockResolvedValue([
      { id: 'reminder-10', event_id: exactEvent.id, minutes_before: 10, sort_order: 0 },
      { id: 'reminder-30', event_id: exactEvent.id, minutes_before: 30, sort_order: 1 },
    ]);
    await expect(new SqliteEventRepository(db.database).getById(exactEvent.id)).resolves.toEqual({
      event: exactEvent,
      reminders: [
        { id: 'reminder-10', eventId: exactEvent.id, minutesBefore: 10, sortOrder: 0 },
        { id: 'reminder-30', eventId: exactEvent.id, minutesBefore: 30, sortOrder: 1 },
      ],
    });
    expect(db.all).toHaveBeenCalledWith(expect.stringContaining('FROM event_reminders'), { $eventId: exactEvent.id });
    expect(db.all.mock.calls[0][0]).toContain('ORDER BY sort_order, id');
  });

  it('予定更新で通知を置換し、通知書込みの失敗をtransactionから返す', async () => {
    const db = createTransactionDatabaseDouble();
    const events = new SqliteEventRepository(db.database);
    await events.update({ event: exactEvent, reminders: [reminder30, reminder10] });
    expect(db.transactionRun).toHaveBeenNthCalledWith(1, expect.stringContaining('UPDATE events'), expect.objectContaining({ $id: exactEvent.id }));
    expect(db.transactionRun).toHaveBeenNthCalledWith(2, expect.stringContaining('DELETE FROM event_reminders'), { $eventId: exactEvent.id });
    db.transactionRun.mockReset()
      .mockResolvedValueOnce({ changes: 1, lastInsertRowId: 1 })
      .mockResolvedValueOnce({ changes: 1, lastInsertRowId: 1 })
      .mockRejectedValueOnce(new Error('write failed'));
    await expect(events.update({ event: exactEvent, reminders: [reminder10] })).rejects.toThrow('write failed');
  });

  it('削除対象の予定の通知だけを先に同じtransactionで削除する', async () => {
    const db = createTransactionDatabaseDouble();
    await new SqliteEventRepository(db.database).delete(exactEvent.id);
    expect(db.run).not.toHaveBeenCalled();
    expect(db.transactionRun).toHaveBeenNthCalledWith(1, expect.stringContaining('DELETE FROM event_reminders'), { $eventId: exactEvent.id });
    expect(db.transactionRun).toHaveBeenNthCalledWith(2, expect.stringContaining('DELETE FROM events'), { $id: exactEvent.id });
  });

  it.each([[null, { type: 'instant' }], [{ value_json: 'private broken value' }, { type: 'instant' }]])(
    'returns a safe exact-duration fallback for missing or malformed data', async (row, expected) => {
      const db = createDatabaseDouble();
      db.first.mockResolvedValue(row);
      await expect(new SqliteSettingsRepository(db.database).getDefaultExactDuration()).resolves.toEqual(expected);
    },
  );

  it('reads fade minutes safely and upserts a validated duration', async () => {
    const db = createDatabaseDouble();
    db.first.mockResolvedValue({ value_json: '120' });
    const settings = new SqliteSettingsRepository(db.database);
    await expect(settings.getUndeterminedFadeMinutes()).resolves.toBe(120);
    await settings.setDefaultExactDuration({ type: 'fixed', minutes: 15 }, now);
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT(key) DO UPDATE'), {
      $key: 'default_exact_duration', $valueJson: '{"type":"fixed","minutes":15}', $updatedAt: now,
    });
  });

  it('カレンダー色を検証してbound parameterで更新する', async () => {
    const db = createDatabaseDouble();
    const calendars = new SqliteCalendarRepository(db.database);
    await calendars.setColor('personal-default', 'teal', now);
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining('UPDATE calendars'), {
      $id: 'personal-default', $colorId: 'teal', $updatedAt: now,
    });
    await expect(calendars.setColor('personal-default', 'unknown-color' as never, now)).rejects.toThrow('Invalid calendar color');
  });

  it.each([null, { value_json: 'broken' }, { value_json: '"allDay"' }])(
    '最後の編集タブの欠損・不正値をfuzzyへfallbackする',
    async (row) => {
      const db = createDatabaseDouble();
      db.first.mockResolvedValue(row);
      await expect(new SqliteSettingsRepository(db.database).getLastEventEditorTab()).resolves.toBe('fuzzy');
    },
  );

  it('最後の編集タブを検証してupsertする', async () => {
    const db = createDatabaseDouble();
    const settings = new SqliteSettingsRepository(db.database);
    await settings.setLastEventEditorTab('exact', now);
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT(key) DO UPDATE'), {
      $key: 'last_event_editor_tab', $valueJson: '"exact"', $updatedAt: now,
    });
    await expect(settings.setLastEventEditorTab('allDay' as never, now)).rejects.toThrow('Invalid event editor tab');
  });

  it.each([null, { value_json: '4' }, { value_json: '"5"' }, { value_json: 'broken' }])(
    '今週中の締切曜日が欠損または不正なら金曜日へfallbackする', async (row) => {
      const db = createDatabaseDouble();
      db.first.mockResolvedValue(row);
      await expect(new SqliteSettingsRepository(db.database).getThisWeekDeadlineWeekday()).resolves.toBe(5);
    },
  );

  it.each([5, 6, 7] as const)('今週中の締切曜日%dを保存する', async (weekday) => {
    const db = createDatabaseDouble();
    const settings = new SqliteSettingsRepository(db.database);
    await settings.setThisWeekDeadlineWeekday(weekday, now);
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT(key) DO UPDATE'), {
      $key: 'this_week_deadline_weekday', $valueJson: String(weekday), $updatedAt: now,
    });
  });

  it.each([
    [null, true],
    [{ value_json: 'true' }, true],
    [{ value_json: 'false' }, false],
    [{ value_json: '"false"' }, true],
    [{ value_json: '0' }, true],
    [{ value_json: 'broken' }, true],
  ])('カレンダー表示設定の欠損・正常値・不正値を安全に読み込む', async (row, expected) => {
    const db = createDatabaseDouble();
    db.first.mockResolvedValue(row);
    await expect(new SqliteSettingsRepository(db.database).getCalendarVisible('personal-default'))
      .resolves.toBe(expected);
    expect(db.first).toHaveBeenCalledWith(expect.stringContaining('WHERE key = $key'), {
      $key: 'calendar_visible:personal-default',
    });
  });

  it('カレンダーID別の表示設定をbound parameterでupsertする', async () => {
    const db = createDatabaseDouble();
    await new SqliteSettingsRepository(db.database)
      .setCalendarVisible('personal-default', false, now);
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT(key) DO UPDATE'), {
      $key: 'calendar_visible:personal-default',
      $valueJson: 'false',
      $updatedAt: now,
    });
  });

  it('空のカレンダーIDでは表示設定を読み書きしない', async () => {
    const db = createDatabaseDouble();
    const settings = new SqliteSettingsRepository(db.database);
    await expect(settings.getCalendarVisible('   ')).rejects.toThrow('calendarId must not be empty');
    await expect(settings.setCalendarVisible('', true, now)).rejects.toThrow('calendarId must not be empty');
    expect(db.first).not.toHaveBeenCalled();
    expect(db.run).not.toHaveBeenCalled();
  });

  it('constructs one complete repository container', () => {
    const container = createRepositoryContainer(createDatabaseDouble().database);
    expect(Object.keys(container).sort()).toEqual(['calendars', 'events', 'settings', 'temporalDefinitions']);
  });
});
