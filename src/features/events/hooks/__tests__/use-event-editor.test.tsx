import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { Calendar } from '@/domain/calendar/calendar';
import type { CalendarEvent } from '@/domain/calendar/event';
import type { EventAggregate } from '@/domain/calendar/event-reminder';
import type { CalendarRepository, EventRepository, SettingsRepository, TemporalDefinitionRepository } from '@/domain/calendar/repositories';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import { useEventEditor } from '../use-event-editor';

const calendar: Calendar = { id: 'personal-default', name: 'マイカレンダー', timeZoneId: 'Asia/Tokyo', colorId: 'blue', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };
const morning: TemporalDefinition = { id: 'personal-default:morning', calendarId: calendar.id, key: 'morning', label: '朝', granularity: 'day', resolverConfig: { kind: 'timeOfDay', startMinute: 360, endMinute: 720 }, fadeInRatio: 0.2, fadeOutRatio: 0.2, isSystem: true, isEnabled: true, sortOrder: 1, createdAt: calendar.createdAt, updatedAt: calendar.updatedAt };
const nextWeek: TemporalDefinition = { ...morning, id: 'personal-default:next_week_first_half', key: 'next_week_first_half', label: '来週前半', granularity: 'week', resolverConfig: { kind: 'week', selectionWeekOffset: 1, startWeekday: 1, endWeekday: 3 }, sortOrder: 20 };
const exactEvent: Extract<CalendarEvent, { temporalType: 'exact' }> = {
  id: 'event-1', calendarId: calendar.id, title: '歯医者', anchorDate: '2026-09-09', temporalType: 'exact', startTime: '23:30', duration: { type: 'fixed', minutes: 2_940 }, createdTimeZoneId: 'Asia/Tokyo', location: '渋谷区', notes: '保険証を持参', colorId: 'teal', recurrenceRule: { version: 1, frequency: 'weekly', interval: 2, weekdays: [3, 5], end: { type: 'count', count: 5 } }, createdAt: calendar.createdAt, updatedAt: calendar.updatedAt,
};
const exactAggregate: EventAggregate = { event: exactEvent, reminders: [
  { id: 'reminder-1', eventId: exactEvent.id, minutesBefore: 30, sortOrder: 0 },
  { id: 'reminder-2', eventId: exactEvent.id, minutesBefore: 10, sortOrder: 1 },
] };

function createRepositories(): Readonly<{ calendars: jest.Mocked<CalendarRepository>; events: jest.Mocked<EventRepository>; settings: jest.Mocked<SettingsRepository>; temporalDefinitions: jest.Mocked<TemporalDefinitionRepository> }> {
  return {
    calendars: { getDefault: jest.fn().mockResolvedValue(calendar), setColor: jest.fn() },
    events: { create: jest.fn(), getById: jest.fn().mockResolvedValue(null), listByAnchorRange: jest.fn(),
      listSchedule: jest.fn(), getOccurrenceEditData: jest.fn(), saveOccurrenceException: jest.fn(),
      deleteOccurrenceException: jest.fn(), applyRecurrenceMutation: jest.fn(), update: jest.fn(), delete: jest.fn() },
    settings: { getDefaultExactDuration: jest.fn(), setDefaultExactDuration: jest.fn(), getUndeterminedFadeMinutes: jest.fn(), getCalendarVisible: jest.fn(), setCalendarVisible: jest.fn(), getLastEventEditorTab: jest.fn().mockResolvedValue('fuzzy'), setLastEventEditorTab: jest.fn().mockResolvedValue(undefined), getThisWeekDeadlineWeekday: jest.fn().mockResolvedValue(5), setThisWeekDeadlineWeekday: jest.fn() },
    temporalDefinitions: { listEnabled: jest.fn().mockResolvedValue([morning]), getById: jest.fn(), disable: jest.fn() },
  };
}
const initial = { date: '2026-09-09', startTime: '09:30', endTime: '11:45', temporalType: 'fuzzy' as const };

describe('予定編集の主要状態', () => {
  it('繰り返しOccurrenceは保存時に範囲を選び単発例外として保存できる', async () => {
    const repositories = createRepositories();
    repositories.events.getOccurrenceEditData.mockResolvedValue({
      series: exactAggregate,
      exception: null,
      replacement: null,
      exceptions: [],
    });
    const { result } = await renderHook(() => useEventEditor({
      ...repositories,
      initial,
      eventId: exactEvent.id,
      occurrenceDate: '2026-09-23',
      createId: () => 'replacement-1',
      now: () => '2026-09-20T00:00:00.000Z',
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.startDate).toBe('2026-09-23');

    await act(async () => { result.current.setTitle('この回だけ変更'); });
    let saveResult = true;
    await act(async () => { saveResult = await result.current.save(); });
    expect(saveResult).toBe(false);
    expect(repositories.events.update).not.toHaveBeenCalled();
    expect({ titleError: result.current.titleError, dateError: result.current.dateError,
      endTimeError: result.current.endTimeError, recurrenceError: result.current.recurrenceError,
      saveError: result.current.saveError }).toEqual({ titleError: null, dateError: null,
      endTimeError: null, recurrenceError: null, saveError: null });
    expect(result.current.scopeRequest).toEqual({
      operation: 'save', needsExceptionResetConfirmation: false,
      options: [
        { scope: 'occurrence', label: 'この予定' },
        { scope: 'following', label: 'これ以降の予定' },
        { scope: 'series', label: 'すべての予定' },
      ],
    });
    await act(async () => { result.current.cancelScope(); });
    expect(result.current.title).toBe('この回だけ変更');

    await act(async () => { await result.current.save(); });
    await act(async () => { await result.current.selectScope('occurrence'); });
    expect(repositories.events.saveOccurrenceException).toHaveBeenCalledWith(expect.objectContaining({
      identity: { seriesEventId: 'event-1', originalOccurrenceDate: '2026-09-23' },
      overrideFields: ['title'],
      replacement: expect.objectContaining({ event: expect.objectContaining({
        id: 'replacement-1', title: 'この回だけ変更', recurrenceRule: null,
      }) }),
    }));
  });

  it('繰り返し規則を変えると単発範囲を表示しない', async () => {
    const repositories = createRepositories();
    repositories.events.getOccurrenceEditData.mockResolvedValue({
      series: exactAggregate, exception: null, replacement: null, exceptions: [],
    });
    const { result } = await renderHook(() => useEventEditor({
      ...repositories, initial, eventId: exactEvent.id, occurrenceDate: '2026-09-23',
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.setRecurrencePreset('daily'); });
    await act(async () => { await result.current.save(); });
    expect(result.current.scopeRequest).toMatchObject({
      needsExceptionResetConfirmation: true,
      options: [{ scope: 'following' }, { scope: 'series' }],
    });
  });

  it('相対定義を選ぶと期間をpreviewして繰り返しなしで保存する', async () => {
    const repositories = createRepositories();
    repositories.temporalDefinitions.listEnabled.mockResolvedValue([morning, nextWeek]);
    const { result } = await renderHook(() => useEventEditor({
      ...repositories, initial: { ...initial, date: '2026-09-30' },
      createId: () => 'relative-event', now: () => '2026-09-30T12:00:00.000Z',
      getTimeZoneId: () => 'Asia/Tokyo',
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.selectDefinition(nextWeek.id); result.current.setTitle('来週の準備'); });

    expect(result.current).toMatchObject({
      isDateEditable: false,
      isRecurrenceEditable: false,
      relativeDatePreview: '10月5日（月）〜10月7日（水）',
    });
    await act(async () => { await result.current.save(); });
    expect(repositories.events.create).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({
        anchorDate: '2026-10-05', endDate: '2026-10-07', recurrenceRule: null,
        resolutionContext: expect.objectContaining({ referenceDate: '2026-09-30', periodAnchorDate: '2026-10-05' }),
      }),
    }));
  });

  it('保存済み相対定義を取得できなくても期間と解決条件を維持する', async () => {
    const repositories = createRepositories();
    const relativeEvent: CalendarEvent = {
      ...exactEvent,
      temporalType: 'fuzzy',
      temporalDefinitionId: nextWeek.id,
      anchorDate: '2026-10-05',
      endDate: '2026-10-07',
      resolutionContext: {
        version: 1,
        referenceDate: '2026-09-30',
        periodAnchorDate: '2026-10-05',
        parameterSnapshot: {},
      },
      recurrenceRule: null,
    };
    repositories.events.getById.mockResolvedValue({ event: relativeEvent, reminders: [] });
    repositories.temporalDefinitions.listEnabled.mockResolvedValue([morning]);
    repositories.temporalDefinitions.getById.mockResolvedValue(null);
    const { result } = await renderHook(() => useEventEditor({
      ...repositories,
      initial: { ...initial, date: '2026-09-30' },
      eventId: relativeEvent.id,
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.relativeDatePreview).toBe('10月5日（月）〜10月7日（水）');
    await act(async () => { await result.current.save(); });

    expect(repositories.events.update).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({
        anchorDate: '2026-10-05',
        endDate: '2026-10-07',
        resolutionContext: relativeEvent.resolutionContext,
      }),
    }));
  });
  it('保存済みタブを復元しタブ往復でも入力値を保持する', async () => {
    const repositories = createRepositories(); repositories.settings.getLastEventEditorTab.mockResolvedValue('exact');
    const { result } = await renderHook(() => useEventEditor({ ...repositories, initial }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.editorTab).toBe('exact');
    await act(async () => { result.current.setStartTime('08:15'); result.current.setEditorTab('fuzzy'); });
    await act(async () => { result.current.setEditorTab('exact'); });
    expect(result.current.startTime).toBe('08:15');
    expect(repositories.settings.setLastEventEditorTab).toHaveBeenCalledTimes(2);
  });

  it('明示されたexactは保存済みfuzzyより優先する', async () => {
    const repositories = createRepositories();
    const { result } = await renderHook(() => useEventEditor({ ...repositories, initial, initialTab: 'exact' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.editorTab).toBe('exact');
    expect(repositories.settings.getLastEventEditorTab).not.toHaveBeenCalled();
  });

  it('保存済みタブが不正なら初期予定種別へフォールバックする', async () => {
    const repositories = createRepositories();
    repositories.settings.getLastEventEditorTab.mockResolvedValue('invalid' as never);
    const { result } = await renderHook(() => useEventEditor({
      ...repositories,
      initial: { ...initial, temporalType: 'exact' },
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.editorTab).toBe('exact');
  });

  it('既存の終日予定はきっちりタブと複数日の終日入力へ展開する', async () => {
    const repositories = createRepositories();
    repositories.events.getById.mockResolvedValue({ event: { ...exactEvent, temporalType: 'allDay', anchorDate: '2026-09-09', endDate: '2026-09-11' }, reminders: [] });
    const { result } = await renderHook(() => useEventEditor({ ...repositories, initial, eventId: exactEvent.id }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ editorTab: 'exact', isAllDay: true, startDate: '2026-09-09', endDate: '2026-09-11' });
  });

  it('49時間の予定を複数日の終了日時へ展開し開始日移動でも期間を保持する', async () => {
    const repositories = createRepositories(); repositories.events.getById.mockResolvedValue(exactAggregate);
    const { result } = await renderHook(() => useEventEditor({ ...repositories, initial, eventId: exactEvent.id }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ startDate: '2026-09-09', startTime: '23:30', endDate: '2026-09-12', endTime: '00:30' });
    await act(async () => { result.current.setStartDate('2026-09-20'); });
    expect(result.current.endDate).toBe('2026-09-23');
  });

  it('複数日の日時と終日をそれぞれ保存する', async () => {
    const repositories = createRepositories();
    const { result } = await renderHook(() => useEventEditor({ ...repositories, initial, initialTab: 'exact', createId: () => 'event-new', now: () => '2026-09-09T12:00:00.000Z', getTimeZoneId: () => 'Asia/Tokyo' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.setTitle('旅行'); result.current.setEndDate('2026-09-11'); result.current.setEndTime('10:00'); });
    await act(async () => { await result.current.save(); });
    expect(repositories.events.create).toHaveBeenLastCalledWith(expect.objectContaining({ event: expect.objectContaining({ temporalType: 'exact', duration: { type: 'fixed', minutes: 2_910 } }) }));
    await act(async () => { result.current.setAllDay(true); });
    await act(async () => { await result.current.save(); });
    expect(repositories.events.create).toHaveBeenLastCalledWith(expect.objectContaining({ event: expect.objectContaining({ temporalType: 'allDay', endDate: '2026-09-11' }) }));
  });

  it.each(['instant', 'undetermined'] as const)('%sは同一終了日時なら保持し範囲変更時はfixedへ変換する', async (type) => {
    const repositories = createRepositories(); const event = { ...exactEvent, duration: { type } }; repositories.events.getById.mockResolvedValue({ event, reminders: [] });
    const { result } = await renderHook(() => useEventEditor({ ...repositories, initial, eventId: event.id }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { await result.current.save(); });
    expect(repositories.events.update).toHaveBeenLastCalledWith(expect.objectContaining({ event: expect.objectContaining({ duration: { type } }) }));
    await act(async () => { result.current.setEndDate('2026-09-10'); result.current.setEndTime('00:30'); });
    await act(async () => { await result.current.save(); });
    expect(repositories.events.update).toHaveBeenLastCalledWith(expect.objectContaining({ event: expect.objectContaining({ duration: { type: 'fixed', minutes: 60 } }) }));
  });

  it('終了日時が開始以前なら保存しない', async () => {
    const repositories = createRepositories(); const { result } = await renderHook(() => useEventEditor({ ...repositories, initial, initialTab: 'exact' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.setTitle('不正な予定'); result.current.setEndDate('2026-09-08'); });
    await act(async () => { await result.current.save(); });
    expect(result.current.endTimeError).not.toBeNull(); expect(repositories.events.create).not.toHaveBeenCalled();
  });
});

describe('予定編集の追加情報', () => {
  it('既存の追加情報と通知を展開する', async () => {
    const repositories = createRepositories(); repositories.events.getById.mockResolvedValue(exactAggregate);
    const { result } = await renderHook(() => useEventEditor({ ...repositories, initial, eventId: exactEvent.id }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ calendarName: 'マイカレンダー', calendarColorId: 'blue', colorId: 'teal', location: '渋谷区', notes: '保険証を持参', recurrenceDraft: { preset: 'custom', frequency: 'weekly', intervalText: '2', weekdays: [3, 5], endType: 'count', countText: '5' }, reminders: [{ id: 'reminder-1', minutesBefore: 30 }, { id: 'reminder-2', minutesBefore: 10 }] });
  });

  it('追加情報と並べ替えた通知を集約で更新する', async () => {
    const repositories = createRepositories(); repositories.events.getById.mockResolvedValue(exactAggregate);
    const { result } = await renderHook(() => useEventEditor({ ...repositories, initial, eventId: exactEvent.id }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.setLocation('  新宿  '); result.current.setNotes('  メモ本文  '); result.current.setColorId('red'); result.current.moveReminder('reminder-2', -1); });
    await act(async () => { await result.current.save(); });
    expect(repositories.events.update).toHaveBeenCalledWith({ event: expect.objectContaining({ location: '新宿', notes: 'メモ本文', colorId: 'red', recurrenceRule: exactEvent.recurrenceRule }), reminders: [
      { id: 'reminder-2', eventId: exactEvent.id, minutesBefore: 10, sortOrder: 0 },
      { id: 'reminder-1', eventId: exactEvent.id, minutesBefore: 30, sortOrder: 1 },
    ] });
  });

  it('通知の重複を避けて追加・削除し新規IDを保存する', async () => {
    const repositories = createRepositories(); const reminderIds = ['reminder-a', 'reminder-b'];
    const { result } = await renderHook(() => useEventEditor({ ...repositories, initial, createId: () => 'event-new', createReminderId: () => reminderIds.shift() ?? 'unused', now: () => '2026-09-09T12:00:00.000Z', getTimeZoneId: () => 'Asia/Tokyo' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.addReminder(30); });
    await act(async () => { result.current.addReminder(30); });
    await act(async () => { result.current.addReminder(5); });
    await act(async () => { result.current.removeReminder('reminder-a'); result.current.setTitle('朝の予定'); });
    await act(async () => { await result.current.save(); });
    expect(repositories.events.create).toHaveBeenCalledWith(expect.objectContaining({ event: expect.objectContaining({ id: 'event-new' }), reminders: [{ id: 'reminder-b', eventId: 'event-new', minutesBefore: 5, sortOrder: 0 }] }));
  });

  it('不正な繰り返しは入力を保持して保存しない', async () => {
    const repositories = createRepositories(); const { result } = await renderHook(() => useEventEditor({ ...repositories, initial }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.setTitle('予定'); result.current.setRecurrencePreset('custom'); result.current.setRecurrenceIntervalText('0'); });
    await act(async () => { await result.current.save(); });
    expect(result.current.recurrenceError).toBe('繰り返し間隔は1以上の整数で入力してください'); expect(repositories.events.create).not.toHaveBeenCalled();
  });
});
