import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { Calendar } from '@/domain/calendar/calendar';
import type { CalendarEvent } from '@/domain/calendar/event';
import { eventNoteFromPlainText } from '@/domain/calendar/event-note';
import type { EventAggregate } from '@/domain/calendar/event-reminder';
import type { CalendarRepository, EventRepository, SettingsRepository, TemporalDefinitionRepository } from '@/domain/calendar/repositories';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import { useEventEditor } from '../use-event-editor';

const calendar: Calendar = { id: 'personal-default', name: 'マイカレンダー', timeZoneId: 'Asia/Tokyo', colorId: 'blue', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };
const morning: TemporalDefinition = { id: 'personal-default:morning', calendarId: calendar.id, key: 'morning', label: '朝', granularity: 'day', resolverConfig: { kind: 'timeOfDay', startMinute: 360, endMinute: 720 }, fadeInRatio: 0.2, fadeOutRatio: 0.2, isSystem: true, isEnabled: true, sortOrder: 1, createdAt: calendar.createdAt, updatedAt: calendar.updatedAt };
const nextWeek: TemporalDefinition = { ...morning, id: 'personal-default:next_week_first_half', key: 'next_week_first_half', label: '来週前半', granularity: 'week', resolverConfig: { kind: 'week', selectionWeekOffset: 1, startWeekday: 1, endWeekday: 3 }, sortOrder: 20 };
const exactEvent: Extract<CalendarEvent, { temporalType: 'exact' }> = {
  id: 'event-1', calendarId: calendar.id, title: '歯医者', anchorDate: '2026-09-09', temporalType: 'exact', startTime: '23:30', duration: { type: 'fixed', minutes: 2_940 }, createdTimeZoneId: 'Asia/Tokyo', location: '渋谷区', noteDocument: eventNoteFromPlainText('保険証を持参'), colorId: 'teal', recurrenceRule: { version: 1, frequency: 'weekly', interval: 2, weekdays: [3, 5], end: { type: 'count', count: 5 } }, createdAt: calendar.createdAt, updatedAt: calendar.updatedAt,
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
    settings: { getNotificationDefault: jest.fn().mockResolvedValue(null), setNotificationDefault: jest.fn(), getHolidayPreferences: jest.fn().mockResolvedValue({ version: 1, calendarId: 'jp', adjustThisWeekDeadline: false }), setHolidayPreferences: jest.fn().mockResolvedValue(undefined), getCalendarWeekStartsOn: jest.fn().mockResolvedValue(1), setCalendarWeekStartsOn: jest.fn(), getDefaultExactDuration: jest.fn(), setDefaultExactDuration: jest.fn(), getUndeterminedFadeMinutes: jest.fn(), getCalendarVisible: jest.fn(), setCalendarVisible: jest.fn(), getLastEventEditorTab: jest.fn().mockResolvedValue('fuzzy'), setLastEventEditorTab: jest.fn().mockResolvedValue(undefined), getLastCalendarViewMode: jest.fn().mockResolvedValue('twoDay'), setLastCalendarViewMode: jest.fn().mockResolvedValue(undefined), getThisWeekDeadlineWeekday: jest.fn().mockResolvedValue(5), setThisWeekDeadlineWeekday: jest.fn() },
    temporalDefinitions: { listEnabled: jest.fn().mockResolvedValue([morning]), getById: jest.fn(), disable: jest.fn() },
  };
}
const initial = { date: '2026-09-09', startTime: '09:30', endTime: '11:45', temporalType: 'fuzzy' as const };

describe('予定編集の主要状態', () => {
  it('保存済み期間は維持し、別表現から再指定したときだけ新policyで調整する', async () => {
    const repositories = createRepositories();
    const thisWeek: TemporalDefinition = { ...nextWeek, id: 'this-week', key: 'this_week', label: '今週中', resolverConfig: { kind: 'weekRemainder', selectionWeekOffset: 0 } };
    const context = { version: 1, referenceDate: '2026-03-16', periodAnchorDate: '2026-03-16', parameterSnapshot: { thisWeekDeadlineWeekday: 5 } } as const;
    repositories.events.getById.mockResolvedValue({ event: { ...exactEvent, temporalType: 'fuzzy', recurrenceRule: null,
      anchorDate: '2026-03-16', endDate: '2026-03-20', temporalDefinitionId: thisWeek.id, resolutionContext: context }, reminders: [] });
    repositories.temporalDefinitions.listEnabled.mockResolvedValue([morning, thisWeek]);
    repositories.settings.getHolidayPreferences.mockResolvedValue({ version: 1, calendarId: 'jp', adjustThisWeekDeadline: true });
    const holidayProvider = { list: jest.fn().mockReturnValue({ status: 'available', holidays: [{ date: '2026-03-20', name: '春分の日' }] }) };
    const { result } = await renderHook(() => useEventEditor({ ...repositories, holidayProvider, initial, eventId: exactEvent.id }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.setTitle('タイトルのみ変更'); await result.current.save(); });
    expect(repositories.events.update).toHaveBeenLastCalledWith(expect.objectContaining({ event: expect.objectContaining({ endDate: '2026-03-20', resolutionContext: context }) }));
    expect(holidayProvider.list).not.toHaveBeenCalled();
    await act(async () => { result.current.selectDefinition(morning.id); });
    await act(async () => { result.current.selectDefinition(thisWeek.id); });
    expect(result.current.relativeDatePreview).toContain('3月19日');
    await act(async () => { await result.current.save(); });
    expect(repositories.events.update).toHaveBeenLastCalledWith(expect.objectContaining({ event: expect.objectContaining({ endDate: '2026-03-19' }) }));
  });

  it('祝日設定の読込失敗を既定値で保存しない', async () => {
    const repositories = createRepositories();
    repositories.settings.getHolidayPreferences.mockRejectedValue(new Error('failed'));
    const { result } = await renderHook(() => useEventEditor({ ...repositories, initial }));
    await waitFor(() => expect(result.current.status).toBe('error'));
    await act(async () => { expect(await result.current.save()).toBe(false); });
    expect(repositories.events.create).not.toHaveBeenCalled();
  });
  it('今週中の祝日締切を繰り上げ、contextを保存する', async () => {
    const repositories = createRepositories();
    const thisWeek: TemporalDefinition = { ...nextWeek, id: 'this-week', key: 'this_week', label: '今週中', resolverConfig: { kind: 'weekRemainder', selectionWeekOffset: 0 } };
    repositories.temporalDefinitions.listEnabled.mockResolvedValue([morning, thisWeek]);
    repositories.settings.getHolidayPreferences.mockResolvedValue({ version: 1, calendarId: 'jp', adjustThisWeekDeadline: true });
    const holidayProvider = { list: jest.fn().mockReturnValue({ status: 'available', holidays: [{ date: '2026-03-20', name: '春分の日' }] }) };
    const { result } = await renderHook(() => useEventEditor({ ...repositories, holidayProvider,
      initial: { ...initial, date: '2026-03-16' }, createId: () => 'new' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.setTitle('提出'); result.current.selectDefinition(thisWeek.id); });
    expect(result.current.relativeDatePreview).toContain('3月19日');
    await act(async () => { expect(await result.current.save()).toBe(true); });
    expect(repositories.events.create).toHaveBeenCalledWith(expect.objectContaining({ event: expect.objectContaining({
      anchorDate: '2026-03-16', endDate: '2026-03-19', resolutionContext: expect.objectContaining({
        parameterSnapshot: { thisWeekDeadlineWeekday: 5, deadlineAdjustment: { version: 1, calendarId: 'jp', unadjustedDeadlineDate: '2026-03-20' } },
      }),
    }) }));
  });

  it.each(['noBusinessDay', 'unsupported'] as const)('締切が%sでは本文を維持して保存を拒否する', async (reason) => {
    const repositories = createRepositories();
    const thisWeek: TemporalDefinition = { ...nextWeek, id: 'this-week', resolverConfig: { kind: 'weekRemainder', selectionWeekOffset: 0 } };
    repositories.temporalDefinitions.listEnabled.mockResolvedValue([thisWeek]);
    repositories.settings.getHolidayPreferences.mockResolvedValue({ version: 1, calendarId: 'jp', adjustThisWeekDeadline: true });
    const holidayProvider = { list: jest.fn().mockReturnValue(reason === 'unsupported' ? { status: 'unsupported' } : { status: 'available', holidays: [{ date: '2026-03-20', name: '春分の日' }] }) };
    const { result } = await renderHook(() => useEventEditor({ ...repositories, holidayProvider, initial: { ...initial, date: '2026-03-20' } }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.setTitle('残す本文'); });
    expect(result.current.isSaveDisabled).toBe(true);
    await act(async () => { expect(await result.current.save()).toBe(false); });
    expect(result.current.dateError).toContain(reason === 'unsupported' ? '祝日情報' : '対象となる平日');
    expect(result.current.title).toBe('残す本文');
    expect(repositories.events.create).not.toHaveBeenCalled();
  });
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

  it('既存の個別変更は無変更保存でmaskを維持する', async () => {
    const repositories = createRepositories();
    repositories.events.getOccurrenceEditData.mockResolvedValue({
      series: exactAggregate,
      exception: {
        seriesEventId: exactEvent.id, originalOccurrenceDate: '2026-09-23', kind: 'replaced',
        replacementEventId: 'replacement-1', overrideFields: ['title'],
        createdAt: calendar.createdAt, updatedAt: calendar.updatedAt,
      },
      replacement: { event: { ...exactEvent, id: 'replacement-1', title: 'この回だけ',
        anchorDate: '2026-09-23', recurrenceRule: null }, reminders: exactAggregate.reminders },
      exceptions: [],
    });
    const { result } = await renderHook(() => useEventEditor({
      ...repositories, initial, eventId: exactEvent.id, occurrenceDate: '2026-09-23',
      now: () => '2026-09-20T00:00:00.000Z',
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { await result.current.save(); });
    await act(async () => { await result.current.selectScope('occurrence'); });

    expect(repositories.events.saveOccurrenceException).toHaveBeenCalledWith(
      expect.objectContaining({ overrideFields: ['title'] }),
    );
  });

  it('既存の個別値をこれ以降のシリーズへ広げない', async () => {
    const repositories = createRepositories();
    repositories.events.getOccurrenceEditData.mockResolvedValue({
      series: exactAggregate,
      exception: {
        seriesEventId: exactEvent.id, originalOccurrenceDate: '2026-09-23', kind: 'replaced',
        replacementEventId: 'replacement-1', overrideFields: ['title'],
        createdAt: calendar.createdAt, updatedAt: calendar.updatedAt,
      },
      replacement: { event: { ...exactEvent, id: 'replacement-1', title: 'この回だけ',
        anchorDate: '2026-09-23', recurrenceRule: null }, reminders: exactAggregate.reminders },
      exceptions: [],
    });
    const { result } = await renderHook(() => useEventEditor({
      ...repositories, initial, eventId: exactEvent.id, occurrenceDate: '2026-09-23',
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.completeNoteEditor(eventNoteFromPlainText('今回追加')); });
    await act(async () => { await result.current.save(); });
    await act(async () => { await result.current.selectScope('following'); });

    expect(repositories.events.applyRecurrenceMutation).toHaveBeenCalledWith(expect.objectContaining({
      plan: expect.objectContaining({ nextSeries: expect.objectContaining({
        event: expect.objectContaining({ title: '歯医者', noteDocument: eventNoteFromPlainText('今回追加') }),
      }) }),
    }));
  });

  it('シリーズ全体の削除は旧シリーズ削除を明示する', async () => {
    const repositories = createRepositories();
    repositories.events.getOccurrenceEditData.mockResolvedValue({
      series: exactAggregate, exception: null, replacement: null, exceptions: [],
    });
    const { result } = await renderHook(() => useEventEditor({
      ...repositories, initial, eventId: exactEvent.id, occurrenceDate: '2026-09-23',
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { await result.current.remove(); });
    await act(async () => { await result.current.selectScope('series'); });

    expect(repositories.events.applyRecurrenceMutation).toHaveBeenCalledWith(expect.objectContaining({
      plan: expect.objectContaining({ removePreviousSeries: true, nextSeries: null }),
    }));
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

  it.each(['instant', 'undetermined'] as const)('%sを保持し終了種別を明示するとfixedへ変換する', async (type) => {
    const repositories = createRepositories(); const event = { ...exactEvent, duration: { type } }; repositories.events.getById.mockResolvedValue({ event, reminders: [] });
    const { result } = await renderHook(() => useEventEditor({ ...repositories, initial, eventId: event.id }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { await result.current.save(); });
    expect(repositories.events.update).toHaveBeenLastCalledWith(expect.objectContaining({ event: expect.objectContaining({ duration: { type } }) }));
    await act(async () => { result.current.setExactDurationType('fixed'); });
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
    expect(result.current).toMatchObject({ calendarName: 'マイカレンダー', calendarColorId: 'blue', colorId: 'teal', noteSummary: '保険証を持参', recurrenceDraft: { preset: 'custom', frequency: 'weekly', intervalText: '2', weekdays: [3, 5], endType: 'count', countText: '5' }, reminders: [{ id: 'reminder-1', minutesBefore: 30 }, { id: 'reminder-2', minutesBefore: 10 }] });
  });

  it('メモ完了ではdraftだけを更新し予定保存時に文書を永続化する', async () => {
    const repositories = createRepositories(); repositories.events.getById.mockResolvedValue(exactAggregate);
    const { result } = await renderHook(() => useEventEditor({ ...repositories, initial, eventId: exactEvent.id }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const document = eventNoteFromPlainText('メモ本文');
    await act(async () => { result.current.openNoteEditor(); });
    expect(result.current.isNoteEditorOpen).toBe(true);
    await act(async () => { result.current.completeNoteEditor(document); });
    expect(repositories.events.update).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ isNoteEditorOpen: false, noteSummary: 'メモ本文' });

    await act(async () => { result.current.setLocation('  新宿  '); result.current.setColorId('red'); result.current.moveReminder('reminder-2', -1); });
    await act(async () => { await result.current.save(); });
    expect(repositories.events.update).toHaveBeenCalledWith({ event: expect.objectContaining({ location: '新宿', noteDocument: document, colorId: 'red', recurrenceRule: exactEvent.recurrenceRule }), reminders: [
      { id: 'reminder-2', eventId: exactEvent.id, minutesBefore: 10, sortOrder: 0 },
      { id: 'reminder-1', eventId: exactEvent.id, minutesBefore: 30, sortOrder: 1 },
    ] });
  });

  it('メモ編集のキャンセルではdraftを変更しない', async () => {
    const repositories = createRepositories(); repositories.events.getById.mockResolvedValue(exactAggregate);
    const { result } = await renderHook(() => useEventEditor({ ...repositories, initial, eventId: exactEvent.id }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.openNoteEditor(); result.current.cancelNoteEditor(); });
    expect(result.current).toMatchObject({ isNoteEditorOpen: false, noteSummary: '保険証を持参' });
  });

  it('選択linkはhttp系だけを外部browserで開き失敗を固定文言で示す', async () => {
    const repositories = createRepositories();
    const openBrowser = jest.fn().mockResolvedValue(undefined);
    const { result } = await renderHook(() => useEventEditor({
      ...repositories, initial, openBrowser,
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => { await result.current.openNoteLink('javascript:alert(1)'); });
    expect(openBrowser).not.toHaveBeenCalled();
    expect(result.current.noteLinkError).toBe('リンクを開けませんでした。');

    await act(async () => { await result.current.openNoteLink('https://example.com/path'); });
    expect(openBrowser).toHaveBeenCalledWith('https://example.com/path');
    expect(result.current.noteLinkError).toBeNull();

    openBrowser.mockRejectedValueOnce(new Error('failed'));
    await act(async () => { await result.current.openNoteLink('http://example.com/'); });
    expect(result.current.noteLinkError).toBe('リンクを開けませんでした。');
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

describe('初期長設定と終了の指定', () => {
  const withoutEnd = { date: '2026-12-31', startTime: '23:30', temporalType: 'fuzzy' as const };
  it.each([
    [{ type: 'fixed', minutes: 30 }, '2027-01-01', '00:00'],
    [{ type: 'instant' }, '2026-12-31', '23:30'],
    [{ type: 'undetermined' }, '2026-12-31', '23:30'],
  ] as const)('設定%sを一度だけ適用し終了種別に沿って保存する', async (duration, endDate, endTime) => {
    const repositories = createRepositories();
    repositories.settings.getDefaultExactDuration.mockResolvedValue(duration);
    const { result } = await renderHook(() => useEventEditor({ createId: () => 'event-new', ...repositories, initial: withoutEnd }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await waitFor(() => expect(result.current.exactDurationStatus).toBe('ready'));
    expect(result.current.endDate).toBe(endDate);
    expect(result.current.endTime).toBe(endTime);
    await act(async () => { result.current.setTitle('合成予定'); result.current.setEditorTab('exact'); });
    await act(async () => { await result.current.save(); });
    expect(repositories.events.create).toHaveBeenCalledWith(expect.objectContaining({ event: expect.objectContaining({ duration }) }));
    await act(async () => { result.current.setEditorTab('fuzzy'); });
    await act(async () => { result.current.setEditorTab('exact'); });
    expect(repositories.settings.getDefaultExactDuration).toHaveBeenCalledTimes(1);
  });

  it('明示終了と既存予定は設定を取得せず保存値を優先する', async () => {
    const repositories = createRepositories();
    const { result } = await renderHook(() => useEventEditor({ createId: () => 'event-new', ...repositories, initial }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.endTime).toBe('11:45');
    expect(repositories.settings.getDefaultExactDuration).not.toHaveBeenCalled();
  });

  it('初期長読込失敗でも入力を保持し、ざっくりと終日の保存を妨げない', async () => {
    const repositories = createRepositories();
    repositories.settings.getDefaultExactDuration.mockRejectedValueOnce(new Error('synthetic'));
    const { result } = await renderHook(() => useEventEditor({ createId: () => 'event-new', ...repositories, initial: withoutEnd }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await waitFor(() => expect(result.current.exactDurationStatus).toBe('error'));
    await act(async () => { result.current.setTitle('入力保持'); result.current.setEditorTab('exact'); });
    expect(result.current.isSaveDisabled).toBe(true);
    await act(async () => { expect(await result.current.save()).toBe(false); });
    await act(async () => { result.current.setAllDay(true); });
    expect(result.current.isSaveDisabled).toBe(false);
    await act(async () => { expect(await result.current.save()).toBe(true); });
    await act(async () => { result.current.setAllDay(false); result.current.setEditorTab('fuzzy'); });
    await act(async () => { expect(await result.current.save()).toBe(true); });
    repositories.settings.getDefaultExactDuration.mockResolvedValue({ type: 'fixed', minutes: 15 });
    await act(async () => { await result.current.retryExactDuration(); });
    expect(result.current.title).toBe('入力保持');
    expect(result.current.exactDurationStatus).toBe('ready');
  });

  it('遅延初期化は終日の入力を壊さず、完了後は変更した開始日から終了を作る', async () => {
    const repositories = createRepositories();
    let resolve!: (duration: { type: 'fixed'; minutes: number }) => void;
    repositories.settings.getDefaultExactDuration.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { result } = await renderHook(() => useEventEditor({ createId: () => 'event-new', ...repositories, initial: withoutEnd }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      result.current.setEditorTab('exact'); result.current.setAllDay(true);
    });
    await act(async () => { result.current.setStartDate('2027-01-05'); });
    await act(async () => { result.current.setEndDate('2027-01-08'); });
    await act(async () => { resolve({ type: 'fixed', minutes: 60 }); });
    expect(result.current.endDate).toBe('2027-01-08');
    await act(async () => { result.current.setAllDay(false); });
    expect(result.current.endDate).toBe('2027-01-06');
    expect(result.current.endTime).toBe('00:30');
  });

  it('終了種別を変えたら無効な終了を保存に使わず最後の有効な長さへ戻せる', async () => {
    const repositories = createRepositories();
    const { result } = await renderHook(() => useEventEditor({ createId: () => 'event-new', ...repositories, initial: { ...initial, temporalType: 'exact' } }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.setTitle('合成予定'); result.current.setEditorTab('exact'); result.current.setExactDurationType('instant'); });
    await act(async () => { result.current.setStartTime('23:30'); result.current.setExactDurationType('undetermined'); });
    await act(async () => { await result.current.save(); });
    expect(repositories.events.create).toHaveBeenLastCalledWith(expect.objectContaining({ event: expect.objectContaining({ duration: { type: 'undetermined' } }) }));
    await act(async () => { result.current.setExactDurationType('fixed'); });
    expect(result.current.endTime).toBe('01:45');
    expect(result.current.endDate).toBe('2026-09-10');
  });

  it.each(['instant', 'undetermined'] as const)('既存の%sを再編集しても初期長で上書きしない', async (type) => {
    const repositories = createRepositories();
    repositories.events.getById.mockResolvedValue({ event: { ...exactEvent, duration: { type } }, reminders: [] });
    const { result } = await renderHook(() => useEventEditor({ createId: () => 'event-new', ...repositories, initial, eventId: exactEvent.id }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.exactDurationType).toBe(type);
    expect(repositories.settings.getDefaultExactDuration).not.toHaveBeenCalled();
    await act(async () => { await result.current.save(); });
    expect(repositories.events.update).toHaveBeenCalledWith(expect.objectContaining({ event: expect.objectContaining({ duration: { type } }) }));
  });
});

describe('終了種別の境界', () => {
  it('無効になる直前の有効なfixed長を復帰時に使い、同時刻は自動で長さなしにしない', async () => {
    const repositories = createRepositories();
    const { result } = await renderHook(() => useEventEditor({ ...repositories, initial, initialTab: 'exact' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.setEndTime('10:00'); });
    await act(async () => { result.current.setEndTime('09:30'); result.current.setTitle('境界'); });
    await act(async () => { expect(await result.current.save()).toBe(false); });
    expect(result.current.exactDurationType).toBe('fixed');
    await act(async () => { result.current.setExactDurationType('instant'); });
    expect(result.current.endTimeError).toBeNull();
    await act(async () => { result.current.setExactDurationType('fixed'); });
    expect(result.current.endTime).toBe('10:00');
  });
});


describe('通知初期値の新規draft適用', () => {
  test('日内ざっくりの終了通知を初期化し、手動削除後はタブ往復でも復活させない', async () => {
    const r = createRepositories();
    r.settings.getNotificationDefault.mockImplementation(async category => category === 'fuzzy_day'
      ? { version: 1, kind: 'relativeMinutes', anchor: 'end', minutesBefore: 60 }
      : { version: 1, kind: 'relativeMinutes', anchor: 'start', minutesBefore: 10 });
    const { result } = await renderHook(() => useEventEditor({ ...r, initial }));
    await waitFor(() => expect(result.current.reminders).toHaveLength(1));
    expect(result.current.reminders[0].timing).toEqual({ version: 1, kind: 'relativeMinutes', anchor: 'end', minutesBefore: 60 });
    await act(async () => { result.current.removeReminder(result.current.reminders[0].id); result.current.setEditorTab('exact'); });
    await act(async () => { result.current.setEditorTab('fuzzy'); });
    expect(result.current.reminders).toEqual([]);
  });
  test('複数通知の追加・変更を保存し既定値の再読込みで潰さない', async () => {
    const r = createRepositories();
    const { result } = await renderHook(() => useEventEditor({ ...r, initial }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.addReminder({ version:1,kind:'relativeMinutes',anchor:'end',minutesBefore:60 }); });
    await act(async () => { result.current.addReminder({ version:1,kind:'relativeMinutes',anchor:'start',minutesBefore:10 }); });
    expect(result.current.reminders).toHaveLength(2);
    await act(async () => { result.current.updateReminder(result.current.reminders[0].id,{version:1,kind:'relativeMinutes',anchor:'end',minutesBefore:30}); });
    expect(result.current.reminders[0].timing?.kind).toBe('relativeMinutes');
    expect(result.current.reminders[0].timing).toMatchObject({minutesBefore:30});
  });
  test('新規通知既定値の読込み失敗を通知なしとして保存しない', async () => {
    const r=createRepositories(); r.settings.getNotificationDefault.mockRejectedValue(Error('read'));
    const {result}=await renderHook(()=>useEventEditor({...r,initial}));
    await waitFor(()=>expect(result.current.notificationDefaultStatus).toBe('error'));
    expect(result.current.isSaveDisabled).toBe(true);
    r.settings.getNotificationDefault.mockResolvedValue(null);
    await act(async()=>{result.current.retryNotificationDefaults();});
    await waitFor(()=>expect(result.current.notificationDefaultStatus).toBe('ready'));
  });
});

test('既存予定の初期通知への置換が遅れても、その後の手動編集を上書きしない',async()=>{
 const r=createRepositories();r.events.getById.mockResolvedValue(exactAggregate);
 let finish!:(value:null)=>void;r.settings.getNotificationDefault.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const {result}=await renderHook(()=>useEventEditor({...r,initial,eventId:exactEvent.id}));
 await waitFor(()=>expect(result.current.status).toBe('ready'));
 await act(async()=>{result.current.resetReminderDefaults();});
 await act(async()=>{result.current.addReminder({version:1,kind:'relativeMinutes',anchor:'start',minutesBefore:5});});
 await act(async()=>{finish(null);});
 expect(result.current.reminders).toHaveLength(3);
});

test('時刻付きの旧開始通知と同条件の新通知を追加・更新で重複させない', async () => {
 const r=createRepositories();r.events.getById.mockResolvedValue(exactAggregate);
 const {result}=await renderHook(()=>useEventEditor({...r,initial,eventId:exactEvent.id}));
 await waitFor(()=>expect(result.current.status).toBe('ready'));
 await act(async()=>{result.current.addReminder({version:1,kind:'relativeMinutes',anchor:'start',minutesBefore:30});});
 expect(result.current.reminders).toHaveLength(2);
 await act(async()=>{result.current.updateReminder('reminder-2',{version:1,kind:'relativeMinutes',anchor:'start',minutesBefore:30});});
 expect(result.current.reminders[1].minutesBefore).toBe(10);
 await act(async()=>{result.current.addReminder({version:1,kind:'relativeMinutes',anchor:'end',minutesBefore:30});});
 expect(result.current.reminders).toHaveLength(3);
});
