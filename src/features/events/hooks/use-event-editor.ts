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
import {
  getChangedEventFields,
  planFollowingMutation,
  planSeriesMutation,
} from '@/domain/calendar/recurrence-change';
import {
  materializeOccurrenceReplacement,
  type EventOverrideField,
} from '@/domain/calendar/recurrence-exception';
import { offsetCalendarDate } from '@/domain/calendar/month';
import type { RecurrenceRuleV1 } from '@/domain/calendar/recurrence';
import type {
  CalendarRepository,
  EventRepository,
  OccurrenceEditData,
  SettingsRepository,
  TemporalDefinitionRepository,
} from '@/domain/calendar/repositories';
import { toMinutesOfDay } from '@/domain/calendar/time';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import {
  resolveRelativeDateRange,
  type RelativeDateResolution,
  type ThisWeekDeadlineWeekday,
} from '@/domain/temporal/relative-date-resolution';
import {
  buildEventReminders,
  buildRecurrenceRule,
  getEditorExactDuration,
  getExactEditorRange,
  getRecurrenceDraft,
  getReminderDrafts,
  moveEditorRangeStart,
  moveReminderDraft,
  formatEditorDate,
  type RecurrenceDraft,
  type RecurrencePreset,
  type ReminderDraft,
} from '../event-editor-model';
import {
  createScopeRequest,
  type RecurrenceEditScope,
  type ScopeRequest,
} from '../recurrence-edit-model';

type EditorStatus = 'loading' | 'ready' | 'error';

export type EventEditorState = Readonly<{
  status: EditorStatus;
  mode: 'create' | 'edit';
  title: string;
  editorTab: EventEditorTab;
  isAllDay: boolean;
  isDateEditable: boolean;
  isRecurrenceEditable: boolean;
  relativeDatePreview: string | null;
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
  scopeRequest: ScopeRequest | null;
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
  selectScope(scope: RecurrenceEditScope): Promise<boolean>;
  cancelScope(): void;
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
  occurrenceDate?: string;
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
  occurrenceDate,
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
  const [occurrenceEditData, setOccurrenceEditData] = useState<OccurrenceEditData | null>(null);
  const [pendingAggregate, setPendingAggregate] = useState<EventAggregate | null>(null);
  const [scopeRequest, setScopeRequest] = useState<ScopeRequest | null>(null);
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
  const [thisWeekDeadlineWeekday, setThisWeekDeadlineWeekday] = useState<ThisWeekDeadlineWeekday>(5);
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
        const [calendar, loadedValue, savedTab, deadlineWeekday] = await Promise.all([
          calendars.getDefault(),
          eventId === undefined
            ? Promise.resolve(null)
            : occurrenceDate === undefined
              ? events.getById(eventId)
              : events.getOccurrenceEditData({
                seriesEventId: eventId,
                originalOccurrenceDate: occurrenceDate,
              }),
          eventId === undefined && initialEditorTab === undefined
            ? settings.getLastEventEditorTab()
            : Promise.resolve(null),
          settings.getThisWeekDeadlineWeekday(),
        ]);
        if (!active) return;
        const loadedOccurrenceData = occurrenceDate === undefined
          ? null
          : loadedValue as OccurrenceEditData | null;
        let loadedAggregate = occurrenceDate === undefined
          ? loadedValue as EventAggregate | null
          : null;
        if (loadedOccurrenceData !== null && occurrenceDate !== undefined) {
          const replacement = loadedOccurrenceData.replacement?.event
            ?? loadedOccurrenceData.series.event;
          const fields = loadedOccurrenceData.exception?.overrideFields ?? [];
          const materialized = materializeOccurrenceReplacement({
            seriesEvent: loadedOccurrenceData.series.event,
            replacementEvent: replacement,
            overrideFields: fields,
            occurrenceDate,
          });
          loadedAggregate = {
            event: {
              ...materialized,
              id: loadedOccurrenceData.series.event.id,
              recurrenceRule: loadedOccurrenceData.series.event.recurrenceRule,
            },
            reminders: fields.includes('reminders')
              ? loadedOccurrenceData.replacement?.reminders ?? []
              : loadedOccurrenceData.series.reminders,
          };
          setOccurrenceEditData(loadedOccurrenceData);
        }
        if (eventId !== undefined && loadedAggregate === null) throw new Error('event not found');
        const targetCalendarId = loadedAggregate?.event.calendarId ?? calendar.id;
        let loadedDefinitions = await temporalDefinitions.listEnabled(targetCalendarId);
        const existingDefinitionId = loadedAggregate?.event.temporalType === 'fuzzy'
          ? loadedAggregate.event.temporalDefinitionId
          : null;
        if (existingDefinitionId !== null &&
            !loadedDefinitions.some((definition) => definition.id === existingDefinitionId)) {
          const existingDefinition = await temporalDefinitions.getById(existingDefinitionId);
          if (existingDefinition !== null) loadedDefinitions = [...loadedDefinitions, existingDefinition];
        }
        if (!active) return;

        setCalendarId(targetCalendarId);
        setCalendarName(calendar.name);
        setCalendarColorId(calendar.colorId);
        setDefinitions(loadedDefinitions);
        setThisWeekDeadlineWeekday(deadlineWeekday);
        setSelectedDefinitionId(
          loadedDefinitions.find((definition) => definition.granularity === 'day')?.id
            ?? loadedDefinitions[0]?.id
            ?? null,
        );

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
            setStartDateValue(event.resolutionContext?.referenceDate ?? event.anchorDate);
            setEndDateValue(event.endDate);
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
  }, [calendars, eventId, events, initialEditorTab, initialValues, loadRevision,
    occurrenceDate, settings, temporalDefinitions]);

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

  const selectedDefinition = definitions.find((definition) => definition.id === selectedDefinitionId) ?? null;
  const existingRelativeEvent = existingAggregate?.event.temporalType === 'fuzzy' &&
    existingAggregate.event.temporalDefinitionId === selectedDefinitionId &&
    existingAggregate.event.resolutionContext !== null
    ? existingAggregate.event
    : null;
  const isRelativeDefinition = editorTab === 'fuzzy' && (
    (selectedDefinition !== null && selectedDefinition.granularity !== 'day') ||
    existingRelativeEvent !== null
  );
  let relativeResolution: RelativeDateResolution | null = null;
  if (isRelativeDefinition) {
    const existingEvent = existingRelativeEvent;
    if (existingEvent !== null && existingEvent.resolutionContext !== null) {
      const context = existingEvent.resolutionContext;
      relativeResolution = {
        referenceDate: context.referenceDate,
        periodAnchorDate: context.periodAnchorDate,
        startDate: existingEvent.anchorDate,
        endDate: existingEvent.endDate,
        parameterSnapshot: context.parameterSnapshot,
      };
    } else if (selectedDefinition !== null) {
      const resolution = resolveRelativeDateRange(startDate, selectedDefinition, thisWeekDeadlineWeekday);
      if (resolution.ok) relativeResolution = resolution.value;
    }
  }
  const relativeDatePreview = relativeResolution === null
    ? null
    : `${formatEditorDate(relativeResolution.startDate)}〜${formatEditorDate(relativeResolution.endDate)}`;

  const save = useCallback(async (): Promise<boolean> => {
    if (operationRef.current || status !== 'ready') return false;
    clearErrors();
    const existingEvent = existingAggregate?.event;
    const targetDefinition = definitions.find((definition) => definition.id === selectedDefinitionId) ?? null;
    const isExistingRelative = existingEvent?.temporalType === 'fuzzy' &&
      existingEvent.temporalDefinitionId === selectedDefinitionId &&
      existingEvent.resolutionContext !== null;
    const isRelative = editorTab === 'fuzzy' && (
      (targetDefinition !== null && targetDefinition.granularity !== 'day') || isExistingRelative
    );
    const recurrence = isRelative
      ? { ok: true as const, value: null }
      : buildRecurrenceRule(recurrenceDraft, startDate);
    if (!recurrence.ok) { setRecurrenceError(recurrence.error.message); return false; }

    const base = {
      calendarId: existingEvent?.calendarId ?? calendarId ?? '',
      title: title.trim(),
      anchorDate: isRelative ? relativeResolution?.startDate ?? startDate : startDate,
      createdTimeZoneId: existingEvent?.createdTimeZoneId ?? getTimeZoneId(),
      location: optionalText(location),
      notes: optionalText(notes),
      colorId,
      recurrenceRule: recurrence.value,
    };
    let draft: EventDraft;
    if (editorTab === 'fuzzy') {
      if (selectedDefinitionId === null) { setSaveError('時間帯を選択してください。'); return false; }
      if (isRelative && relativeResolution === null) { setDateError('相対日付の期間を確認してください'); return false; }
      draft = {
        ...base, temporalType: 'fuzzy', temporalDefinitionId: selectedDefinitionId,
        endDate: relativeResolution?.endDate ?? startDate,
        resolutionContext: relativeResolution === null ? null : {
          version: 1,
          referenceDate: relativeResolution.referenceDate,
          periodAnchorDate: relativeResolution.periodAnchorDate,
          parameterSnapshot: relativeResolution.parameterSnapshot,
        },
      };
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
      else if (occurrenceEditData !== null && existingAggregate !== null) {
        const recurrenceChanged = getChangedEventFields(existingAggregate, aggregate)
          .includes('recurrence');
        setPendingAggregate(aggregate);
        setScopeRequest(createScopeRequest('save', recurrenceChanged));
        return false;
      } else await events.update(aggregate);
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
    definitions, existingAggregate, occurrenceEditData, relativeResolution, selectedDefinitionId,
    startDate, startTime, status, title]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (operationRef.current || existingAggregate === null) return false;
    if (occurrenceEditData !== null) {
      setScopeRequest(createScopeRequest('delete', false));
      return false;
    }
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
  }, [events, existingAggregate, occurrenceEditData]);

  const cancelScope = useCallback(() => {
    setScopeRequest(null);
    setPendingAggregate(null);
  }, []);

  const selectScope = useCallback(async (scope: RecurrenceEditScope): Promise<boolean> => {
    if (operationRef.current || scopeRequest === null || occurrenceEditData === null
        || existingAggregate === null
        || occurrenceDate === undefined) return false;
    operationRef.current = true;
    const deleting = scopeRequest.operation === 'delete';
    if (deleting) setIsDeleting(true);
    else setIsSaving(true);
    setSaveError(null);
    try {
      const identity = {
        seriesEventId: occurrenceEditData.series.event.id,
        originalOccurrenceDate: occurrenceDate,
      };
      if (deleting && scope === 'occurrence') {
        await events.deleteOccurrenceException({
          identity,
          expectedSeriesUpdatedAt: occurrenceEditData.series.event.updatedAt,
          now: now(),
        });
      } else if (!deleting && scope === 'occurrence' && pendingAggregate !== null) {
        const overrideFields = getChangedEventFields(existingAggregate, pendingAggregate)
          .filter((field): field is EventOverrideField => field !== 'recurrence');
        const replacementId = occurrenceEditData.replacement?.event.id ?? newEventId;
        await events.saveOccurrenceException({
          identity,
          replacement: {
            event: { ...pendingAggregate.event, id: replacementId, recurrenceRule: null },
            reminders: pendingAggregate.reminders.map((reminder) => ({
              ...reminder,
              eventId: replacementId,
            })),
          },
          overrideFields,
          expectedSeriesUpdatedAt: occurrenceEditData.series.event.updatedAt,
          now: now(),
        });
      } else {
        const submitted = pendingAggregate ?? existingAggregate;
        let plan = scope === 'following'
          ? planFollowingMutation({
            series: occurrenceEditData.series,
            boundaryDate: occurrenceDate,
            submitted,
            exceptions: occurrenceEditData.exceptions,
            createSeriesId: createId,
            now: now(),
          })
          : planSeriesMutation({
            series: occurrenceEditData.series,
            submitted,
            exceptions: occurrenceEditData.exceptions,
            now: now(),
          });
        if (deleting) {
          const affected = scope === 'following'
            ? occurrenceEditData.exceptions.filter((exception) =>
              exception.originalOccurrenceDate >= occurrenceDate)
            : occurrenceEditData.exceptions;
          plan = {
            ...plan,
            nextSeries: null,
            upsertExceptions: [],
            deleteExceptionIdentities: affected.map((exception) => ({
              seriesEventId: exception.seriesEventId,
              originalOccurrenceDate: exception.originalOccurrenceDate,
            })),
            deleteReplacementEventIds: affected.flatMap((exception) =>
              exception.replacementEventId === null ? [] : [exception.replacementEventId]),
          };
        }
        await events.applyRecurrenceMutation({
          seriesId: occurrenceEditData.series.event.id,
          expectedSeriesUpdatedAt: occurrenceEditData.series.event.updatedAt,
          plan,
        });
      }
      setScopeRequest(null);
      setPendingAggregate(null);
      return true;
    } catch {
      setSaveError(deleting
        ? '削除できませんでした。もう一度お試しください。'
        : '保存できませんでした。もう一度お試しください。');
      return false;
    } finally {
      operationRef.current = false;
      setIsSaving(false);
      setIsDeleting(false);
    }
  }, [createId, events, existingAggregate, newEventId, now, occurrenceDate,
    occurrenceEditData, pendingAggregate, scopeRequest]);

  return {
    status,
    mode: existingAggregate === null ? 'create' : 'edit',
    title,
    editorTab,
    isAllDay,
    isDateEditable: !isRelativeDefinition,
    isRecurrenceEditable: !isRelativeDefinition,
    relativeDatePreview,
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
    scopeRequest,
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
    selectScope,
    cancelScope,
  };
}
