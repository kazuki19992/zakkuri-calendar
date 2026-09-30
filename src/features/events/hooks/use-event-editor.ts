import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventColorId } from '@/domain/calendar/event-color';
import {
  createCalendarEvent,
  parseCalendarEvent,
  type EventDraft,
  type EventEditorTab,
  type ExactDuration,
} from '@/domain/calendar/event';
import type { EventAggregate } from '@/domain/calendar/event-reminder';
import { offsetCalendarDate } from '@/domain/calendar/month';
import type { RecurrenceRuleV1 } from '@/domain/calendar/recurrence';
import type {
  CalendarRepository,
  EventRepository,
  SettingsRepository,
  TemporalDefinitionRepository,
} from '@/domain/calendar/repositories';
import { toMinutesOfDay } from '@/domain/calendar/time';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import {
  buildEventReminders,
  buildRecurrenceRule,
  getEditorExactDuration,
  getExactEditorRange,
  getRecurrenceDraft,
  getReminderDrafts,
  moveEditorRangeStart,
  moveReminderDraft,
  type RecurrenceDraft,
  type RecurrencePreset,
  type ReminderDraft,
} from '../event-editor-model';

type EditorStatus = 'loading' | 'ready' | 'error';

export type EventEditorState = Readonly<{
  status: EditorStatus;
  mode: 'create' | 'edit';
  title: string;
  editorTab: EventEditorTab;
  isAllDay: boolean;
  isDateEditable: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  definitions: readonly TemporalDefinition[];
  selectedDefinitionId: string | null;
  calendarName: string;
  calendarColorId: EventColorId;
  colorId: EventColorId | null;
  location: string;
  notes: string;
  recurrenceDraft: RecurrenceDraft;
  reminders: readonly ReminderDraft[];
  titleError: string | null;
  dateError: string | null;
  endTimeError: string | null;
  recurrenceError: string | null;
  reminderError: string | null;
  saveError: string | null;
  isSaving: boolean;
  isDeleting: boolean;
  setTitle(value: string): void;
  setEditorTab(value: EventEditorTab): void;
  setAllDay(value: boolean): void;
  setStartDate(value: string): void;
  setEndDate(value: string): void;
  setStartTime(value: string): void;
  setEndTime(value: string): void;
  selectDefinition(id: string): void;
  setColorId(value: EventColorId | null): void;
  setLocation(value: string): void;
  setNotes(value: string): void;
  setRecurrencePreset(value: RecurrencePreset): void;
  setRecurrenceFrequency(value: RecurrenceRuleV1['frequency']): void;
  setRecurrenceIntervalText(value: string): void;
  toggleRecurrenceWeekday(value: number): void;
  setRecurrenceEndType(value: RecurrenceRuleV1['end']['type']): void;
  setRecurrenceUntilDate(value: string): void;
  setRecurrenceCountText(value: string): void;
  addReminder(minutesBefore: number): void;
  removeReminder(id: string): void;
  moveReminder(id: string, offset: -1 | 1): void;
  retry(): void;
  save(): Promise<boolean>;
  remove(): Promise<boolean>;
}>;

type UseEventEditorInput = Readonly<{
  calendars: CalendarRepository;
  events: EventRepository;
  settings: SettingsRepository;
  temporalDefinitions: TemporalDefinitionRepository;
  initial: Readonly<{
    date: string;
    startTime: string;
    endTime: string;
    temporalType: EventDraft['temporalType'];
  }>;
  initialTab?: EventEditorTab;
  eventId?: string;
  createId?: () => string;
  createReminderId?: () => string;
  now?: () => string;
  getTimeZoneId?: () => string;
}>;

const defaultNow = (): string => new Date().toISOString();
const defaultTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const optionalText = (value: string): string | null => value.trim() || null;

function initialEndDate(date: string, startTime: string, endTime: string): string {
  const start = toMinutesOfDay(startTime);
  const end = toMinutesOfDay(endTime);
  return start !== null && end !== null && end < start ? offsetCalendarDate(date, 1) : date;
}

export function useEventEditor({
  calendars,
  events,
  settings,
  temporalDefinitions,
  initial,
  initialTab,
  eventId,
  createId = Crypto.randomUUID,
  createReminderId = Crypto.randomUUID,
  now = defaultNow,
  getTimeZoneId = defaultTimeZone,
}: UseEventEditorInput): EventEditorState {
  const [initialValues] = useState(initial);
  const [initialEditorTab] = useState(initialTab);
  const [newEventId] = useState(() => createId());
  const [status, setStatus] = useState<EditorStatus>('loading');
  const [existingAggregate, setExistingAggregate] = useState<EventAggregate | null>(null);
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [calendarName, setCalendarName] = useState('');
  const [calendarColorId, setCalendarColorId] = useState<EventColorId>('blue');
  const [title, setTitleValue] = useState('');
  const [editorTab, setEditorTabValue] = useState<EventEditorTab>(
    initialEditorTab ?? (initialValues.temporalType === 'fuzzy' ? 'fuzzy' : 'exact'),
  );
  const [isAllDay, setAllDayValue] = useState(initialValues.temporalType === 'allDay');
  const [startDate, setStartDateValue] = useState(initialValues.date);
  const [startTime, setStartTimeValue] = useState(initialValues.startTime);
  const [endDate, setEndDateValue] = useState(() => initialEndDate(
    initialValues.date,
    initialValues.startTime,
    initialValues.endTime,
  ));
  const [endTime, setEndTimeValue] = useState(initialValues.endTime);
  const [definitions, setDefinitions] = useState<readonly TemporalDefinition[]>([]);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null);
  const [colorId, setColorIdValue] = useState<EventColorId | null>(null);
  const [location, setLocationValue] = useState('');
  const [notes, setNotesValue] = useState('');
  const [recurrenceDraft, setRecurrenceDraft] = useState<RecurrenceDraft>(() =>
    getRecurrenceDraft(null, initialValues.date));
  const [reminders, setReminders] = useState<readonly ReminderDraft[]>([]);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [endTimeError, setEndTimeError] = useState<string | null>(null);
  const [recurrenceError, setRecurrenceError] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadRevision, setLoadRevision] = useState(0);
  const operationRef = useRef(false);

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      try {
        const [calendar, loadedAggregate, savedTab] = await Promise.all([
          calendars.getDefault(),
          eventId === undefined ? Promise.resolve(null) : events.getById(eventId),
          eventId === undefined && initialEditorTab === undefined
            ? settings.getLastEventEditorTab()
            : Promise.resolve(null),
        ]);
        if (!active) return;
        if (eventId !== undefined && loadedAggregate === null) throw new Error('event not found');
        const targetCalendarId = loadedAggregate?.event.calendarId ?? calendar.id;
        const loadedDefinitions = await temporalDefinitions.listEnabled(targetCalendarId);
        if (!active) return;

        const dayDefinitions = loadedDefinitions.filter((definition) => definition.granularity === 'day');
        setCalendarId(targetCalendarId);
        setCalendarName(calendar.name);
        setCalendarColorId(calendar.colorId);
        setDefinitions(dayDefinitions);
        setSelectedDefinitionId(dayDefinitions[0]?.id ?? null);

        if (loadedAggregate === null) {
          const validSavedTab = savedTab === 'exact' || savedTab === 'fuzzy' ? savedTab : null;
          const fallbackTab = initialValues.temporalType === 'fuzzy' ? 'fuzzy' : 'exact';
          setEditorTabValue(initialEditorTab ?? validSavedTab ?? fallbackTab);
        } else {
          const event = loadedAggregate.event;
          setExistingAggregate(loadedAggregate);
          setTitleValue(event.title);
          setStartDateValue(event.anchorDate);
          setColorIdValue(event.colorId);
          setLocationValue(event.location ?? '');
          setNotesValue(event.notes ?? '');
          setRecurrenceDraft(getRecurrenceDraft(event.recurrenceRule, event.anchorDate));
          setReminders(getReminderDrafts(loadedAggregate.reminders));
          if (event.temporalType === 'fuzzy') {
            setEditorTabValue('fuzzy');
            setAllDayValue(false);
            setEndDateValue(event.anchorDate);
            setSelectedDefinitionId(event.temporalDefinitionId);
          } else if (event.temporalType === 'allDay') {
            setEditorTabValue('exact');
            setAllDayValue(true);
            setEndDateValue(event.endDate);
          } else {
            const range = getExactEditorRange(event);
            setEditorTabValue('exact');
            setAllDayValue(false);
            setStartDateValue(range.startDate);
            setStartTimeValue(range.startTime);
            setEndDateValue(range.endDate);
            setEndTimeValue(range.endTime);
          }
        }
        setStatus('ready');
      } catch {
        if (active) setStatus('error');
      }
    };
    void load();
    return () => { active = false; };
  }, [calendars, eventId, events, initialEditorTab, initialValues, loadRevision, settings, temporalDefinitions]);

  const clearErrors = useCallback(() => {
    setTitleError(null);
    setDateError(null);
    setEndTimeError(null);
    setRecurrenceError(null);
    setReminderError(null);
    setSaveError(null);
  }, []);
  const setTitle = useCallback((value: string) => { setTitleValue(value); clearErrors(); }, [clearErrors]);
  const setEditorTab = useCallback((value: EventEditorTab) => {
    if (value === editorTab) return;
    setEditorTabValue(value);
    clearErrors();
    if (status === 'ready') void settings.setLastEventEditorTab(value, now()).catch(() => {});
  }, [clearErrors, editorTab, now, settings, status]);
  const setAllDay = useCallback((value: boolean) => { setAllDayValue(value); clearErrors(); }, [clearErrors]);
  const setStartDate = useCallback((value: string) => {
    const moved = moveEditorRangeStart({ startDate, startTime, endDate, endTime }, value);
    setStartDateValue(moved.startDate);
    setEndDateValue(moved.endDate);
    clearErrors();
  }, [clearErrors, endDate, endTime, startDate, startTime]);
  const setEndDate = useCallback((value: string) => { setEndDateValue(value); clearErrors(); }, [clearErrors]);
  const setStartTime = useCallback((value: string) => { setStartTimeValue(value); clearErrors(); }, [clearErrors]);
  const setEndTime = useCallback((value: string) => { setEndTimeValue(value); clearErrors(); }, [clearErrors]);
  const selectDefinition = useCallback((value: string) => { setSelectedDefinitionId(value); setSaveError(null); }, []);
  const setColorId = useCallback((value: EventColorId | null) => { setColorIdValue(value); clearErrors(); }, [clearErrors]);
  const setLocation = useCallback((value: string) => { setLocationValue(value); clearErrors(); }, [clearErrors]);
  const setNotes = useCallback((value: string) => { setNotesValue(value); clearErrors(); }, [clearErrors]);
  const updateRecurrence = useCallback((update: Partial<RecurrenceDraft>) => {
    setRecurrenceDraft((value) => ({ ...value, ...update }));
    setRecurrenceError(null);
  }, []);
  const setRecurrencePreset = useCallback((value: RecurrencePreset) => updateRecurrence({ preset: value }), [updateRecurrence]);
  const setRecurrenceFrequency = useCallback((value: RecurrenceRuleV1['frequency']) => updateRecurrence({ frequency: value }), [updateRecurrence]);
  const setRecurrenceIntervalText = useCallback((value: string) => updateRecurrence({ intervalText: value }), [updateRecurrence]);
  const toggleRecurrenceWeekday = useCallback((value: number) => {
    setRecurrenceDraft((draft) => ({
      ...draft,
      weekdays: draft.weekdays.includes(value)
        ? draft.weekdays.filter((weekday) => weekday !== value)
        : [...draft.weekdays, value].sort((first, second) => first - second),
    }));
    setRecurrenceError(null);
  }, []);
  const setRecurrenceEndType = useCallback((value: RecurrenceRuleV1['end']['type']) => updateRecurrence({ endType: value }), [updateRecurrence]);
  const setRecurrenceUntilDate = useCallback((value: string) => updateRecurrence({ untilDate: value }), [updateRecurrence]);
  const setRecurrenceCountText = useCallback((value: string) => updateRecurrence({ countText: value }), [updateRecurrence]);
  const addReminder = useCallback((minutesBefore: number) => {
    if (!Number.isSafeInteger(minutesBefore) || minutesBefore < 0) {
      setReminderError('通知時間は0以上の整数で入力してください');
      return;
    }
    setReminders((current) => current.some((item) => item.minutesBefore === minutesBefore)
      ? current
      : [...current, { id: createReminderId(), minutesBefore }]);
    setReminderError(null);
  }, [createReminderId]);
  const removeReminder = useCallback((id: string) => {
    setReminders((current) => current.filter((item) => item.id !== id));
    setReminderError(null);
  }, []);
  const moveReminder = useCallback((id: string, offset: -1 | 1) => {
    setReminders((current) => moveReminderDraft(current, current.findIndex((item) => item.id === id), offset));
  }, []);
  const retry = useCallback(() => { setStatus('loading'); setLoadRevision((value) => value + 1); }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (operationRef.current || status !== 'ready') return false;
    clearErrors();
    const existingEvent = existingAggregate?.event;
    const recurrence = buildRecurrenceRule(recurrenceDraft, startDate);
    if (!recurrence.ok) { setRecurrenceError(recurrence.error.message); return false; }

    const base = {
      calendarId: existingEvent?.calendarId ?? calendarId ?? '',
      title: title.trim(),
      anchorDate: startDate,
      createdTimeZoneId: existingEvent?.createdTimeZoneId ?? getTimeZoneId(),
      location: optionalText(location),
      notes: optionalText(notes),
      colorId,
      recurrenceRule: recurrence.value,
    };
    let draft: EventDraft;
    if (editorTab === 'fuzzy') {
      if (selectedDefinitionId === null) { setSaveError('時間帯を選択してください。'); return false; }
      draft = { ...base, temporalType: 'fuzzy', temporalDefinitionId: selectedDefinitionId };
    } else if (isAllDay) {
      draft = { ...base, temporalType: 'allDay', endDate };
    } else {
      const existingDuration: ExactDuration | null = existingEvent?.temporalType === 'exact'
        ? existingEvent.duration
        : null;
      const duration = getEditorExactDuration({ startDate, startTime, endDate, endTime }, existingDuration);
      if (!duration.ok) { setEndTimeError(duration.error.message); return false; }
      draft = { ...base, temporalType: 'exact', startTime, duration: duration.value };
    }

    if (calendarId === null) {
      setSaveError('カレンダーを読み込めませんでした。もう一度お試しください。');
      return false;
    }
    const timestamp = now();
    const parsedEvent = existingEvent === undefined
      ? createCalendarEvent({ id: newEventId, draft, now: timestamp })
      : parseCalendarEvent({
        ...draft,
        id: existingEvent.id,
        createdAt: existingEvent.createdAt,
        updatedAt: timestamp,
      });
    if (!parsedEvent.ok) {
      if (parsedEvent.error.field === 'title') setTitleError('タイトルを入力してください');
      else if (parsedEvent.error.field === 'anchorDate' || parsedEvent.error.field === 'endDate') {
        setDateError('日付を確認してください');
      } else setSaveError('入力内容を確認してください。');
      return false;
    }
    const builtReminders = buildEventReminders(parsedEvent.value.id, reminders);
    if (!builtReminders.ok) { setReminderError(builtReminders.error.message); return false; }

    operationRef.current = true;
    setIsSaving(true);
    try {
      const aggregate = { event: parsedEvent.value, reminders: builtReminders.value };
      if (existingEvent === undefined) await events.create(aggregate);
      else await events.update(aggregate);
      return true;
    } catch {
      setSaveError('保存できませんでした。もう一度お試しください。');
      return false;
    } finally {
      operationRef.current = false;
      setIsSaving(false);
    }
  }, [calendarId, clearErrors, colorId, editorTab, endDate, endTime, events, existingAggregate,
    getTimeZoneId, isAllDay, location, newEventId, notes, now, recurrenceDraft, reminders,
    selectedDefinitionId, startDate, startTime, status, title]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (operationRef.current || existingAggregate === null) return false;
    operationRef.current = true;
    setIsDeleting(true);
    setSaveError(null);
    try {
      await events.delete(existingAggregate.event.id);
      return true;
    } catch {
      setSaveError('削除できませんでした。もう一度お試しください。');
      return false;
    } finally {
      operationRef.current = false;
      setIsDeleting(false);
    }
  }, [events, existingAggregate]);

  return {
    status,
    mode: existingAggregate === null ? 'create' : 'edit',
    title,
    editorTab,
    isAllDay,
    isDateEditable: true,
    startDate,
    startTime,
    endDate,
    endTime,
    definitions,
    selectedDefinitionId,
    calendarName,
    calendarColorId,
    colorId,
    location,
    notes,
    recurrenceDraft,
    reminders,
    titleError,
    dateError,
    endTimeError,
    recurrenceError,
    reminderError,
    saveError,
    isSaving,
    isDeleting,
    setTitle,
    setEditorTab,
    setAllDay,
    setStartDate,
    setEndDate,
    setStartTime,
    setEndTime,
    selectDefinition,
    setColorId,
    setLocation,
    setNotes,
    setRecurrencePreset,
    setRecurrenceFrequency,
    setRecurrenceIntervalText,
    toggleRecurrenceWeekday,
    setRecurrenceEndType,
    setRecurrenceUntilDate,
    setRecurrenceCountText,
    addReminder,
    removeReminder,
    moveReminder,
    retry,
    save,
    remove,
  };
}
