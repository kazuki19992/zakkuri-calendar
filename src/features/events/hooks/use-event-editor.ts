import * as Crypto from 'expo-crypto';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createCalendarEvent,
  parseCalendarEvent,
  type CalendarEvent,
  type EventDraft,
  type EventEditorTab,
} from '@/domain/calendar/event';
import type { EventAggregate } from '@/domain/calendar/event-reminder';
import { isCalendarDate, offsetCalendarDate } from '@/domain/calendar/month';
import { createFixedDurationFromTimes, toMinutesOfDay, toWallClockTime } from '@/domain/calendar/time';
import type {
  CalendarRepository,
  EventRepository,
  SettingsRepository,
  TemporalDefinitionRepository,
} from '@/domain/calendar/repositories';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';

type EditorStatus = 'loading' | 'ready' | 'error';
type EditorTemporalType = EventDraft['temporalType'];

export type EventEditorState = Readonly<{
  status: EditorStatus;
  mode: 'create' | 'edit';
  title: string;
  anchorDate: string;
  temporalType: EditorTemporalType;
  startTime: string;
  endTime: string;
  definitions: readonly TemporalDefinition[];
  selectedDefinitionId: string | null;
  titleError: string | null;
  dateError: string | null;
  endTimeError: string | null;
  saveError: string | null;
  isSaving: boolean;
  isDeleting: boolean;
  setTitle(value: string): void;
  setAnchorDate(value: string): void;
  setTemporalType(value: EditorTemporalType): void;
  setStartTime(value: string): void;
  setEndTime(value: string): void;
  selectDefinition(id: string): void;
  retry(): void;
  save(): Promise<boolean>;
  remove(): Promise<boolean>;
}>;

type UseEventEditorInput = Readonly<{
  calendars: CalendarRepository;
  events: EventRepository;
  settings: SettingsRepository;
  temporalDefinitions: TemporalDefinitionRepository;
  initial: Readonly<{ date: string; startTime: string; endTime: string; temporalType: EditorTemporalType }>;
  initialTab?: EventEditorTab;
  eventId?: string;
  createId?: () => string;
  now?: () => string;
  getTimeZoneId?: () => string;
}>;

const defaultNow = (): string => new Date().toISOString();
const defaultTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

function endTimeForEvent(event: CalendarEvent): string {
  if (event.temporalType !== 'exact') return '10:00';
  if (event.duration.type !== 'fixed') return event.startTime;
  const startMinutes = toMinutesOfDay(event.startTime);
  if (startMinutes === null) return event.startTime;
  return toWallClockTime((startMinutes + event.duration.minutes) % (24 * 60)) ?? event.startTime;
}

function editorTabForTemporalType(temporalType: EditorTemporalType): EventEditorTab {
  return temporalType === 'fuzzy' ? 'fuzzy' : 'exact';
}

function movedAllDayEndDate(event: Extract<CalendarEvent, { temporalType: 'allDay' }>, anchorDate: string): string {
  if (anchorDate === event.anchorDate || !isCalendarDate(anchorDate)) return event.endDate;
  const inclusiveSpanOffset = differenceInCalendarDays(parseISO(event.endDate), parseISO(event.anchorDate));
  return offsetCalendarDate(anchorDate, inclusiveSpanOffset);
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
  now = defaultNow,
  getTimeZoneId = defaultTimeZone,
}: UseEventEditorInput): EventEditorState {
  const [status, setStatus] = useState<EditorStatus>('loading');
  const [title, setTitleValue] = useState('');
  const [anchorDate, setAnchorDateValue] = useState(initial.date);
  const [temporalType, setTemporalTypeValue] = useState<EditorTemporalType>(initial.temporalType);
  const [startTime, setStartTimeValue] = useState(initial.startTime);
  const [endTime, setEndTimeValue] = useState(initial.endTime);
  const [definitions, setDefinitions] = useState<readonly TemporalDefinition[]>([]);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null);
  const [existingAggregate, setExistingAggregate] = useState<EventAggregate | null>(null);
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [endTimeError, setEndTimeError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadRevision, setLoadRevision] = useState(0);
  const operationRef = useRef(false);

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      try {
        const [calendar, loadedEvent, savedTab] = await Promise.all([
          calendars.getDefault(),
          eventId === undefined ? Promise.resolve(null) : events.getById(eventId),
          eventId === undefined && initialTab === undefined
            ? settings.getLastEventEditorTab()
            : Promise.resolve(null),
        ]);
        if (!active) return;
        if (eventId !== undefined && loadedEvent === null) throw new Error('event not found');
        const targetCalendarId = loadedEvent?.event.calendarId ?? calendar.id;
        const loadedDefinitions = await temporalDefinitions.listEnabled(targetCalendarId);
        if (!active) return;
        const dayDefinitions = loadedDefinitions.filter((definition) => definition.granularity === 'day');
        setCalendarId(targetCalendarId);
        setDefinitions(dayDefinitions);
        setSelectedDefinitionId(dayDefinitions[0]?.id ?? null);
        if (loadedEvent !== null) {
          const existingEvent = loadedEvent.event;
          setExistingAggregate(loadedEvent);
          setTitleValue(existingEvent.title);
          setAnchorDateValue(existingEvent.anchorDate);
          setTemporalTypeValue(existingEvent.temporalType);
          if (existingEvent.temporalType === 'exact') {
            setStartTimeValue(existingEvent.startTime);
            setEndTimeValue(endTimeForEvent(existingEvent));
          } else if (existingEvent.temporalType === 'fuzzy') {
            setSelectedDefinitionId(existingEvent.temporalDefinitionId);
          }
        } else {
          setTemporalTypeValue(
            initial.temporalType === 'allDay'
              ? 'allDay'
              : (initialTab ?? savedTab ?? initial.temporalType),
          );
        }
        setStatus('ready');
      } catch {
        if (active) setStatus('error');
      }
    };
    void load();
    return () => { active = false; };
  }, [calendars, eventId, events, initial.temporalType, initialTab, loadRevision, settings, temporalDefinitions]);

  const clearErrors = useCallback(() => {
    setTitleError(null); setDateError(null); setEndTimeError(null); setSaveError(null);
  }, []);
  const setTitle = useCallback((value: string) => { setTitleValue(value); clearErrors(); }, [clearErrors]);
  const setAnchorDate = useCallback((value: string) => { setAnchorDateValue(value); clearErrors(); }, [clearErrors]);
  const setTemporalType = useCallback((value: EditorTemporalType) => {
    const previousTab = editorTabForTemporalType(temporalType);
    const nextTab = editorTabForTemporalType(value);
    setTemporalTypeValue(value);
    clearErrors();
    if (status === 'ready' && previousTab !== nextTab) {
      void settings.setLastEventEditorTab(nextTab, now()).catch(() => {});
    }
  }, [clearErrors, now, settings, status, temporalType]);
  const setStartTime = useCallback((value: string) => { setStartTimeValue(value); clearErrors(); }, [clearErrors]);
  const setEndTime = useCallback((value: string) => { setEndTimeValue(value); clearErrors(); }, [clearErrors]);
  const selectDefinition = useCallback((value: string) => { setSelectedDefinitionId(value); setSaveError(null); }, []);
  const retry = useCallback(() => { setStatus('loading'); setLoadRevision((value) => value + 1); }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (operationRef.current || status !== 'ready') return false;
    clearErrors();
    const existingEvent = existingAggregate?.event;
    const base = {
      calendarId: existingEvent?.calendarId,
      title: title.trim(),
      anchorDate,
      createdTimeZoneId: existingEvent?.createdTimeZoneId ?? getTimeZoneId(),
      location: existingEvent?.location ?? null,
      notes: existingEvent?.notes ?? null,
      colorId: existingEvent?.colorId ?? null,
      recurrenceRule: existingEvent?.recurrenceRule ?? null,
    };
    let draft: EventDraft | null = null;
    if (temporalType === 'exact') {
      const duration = existingEvent?.temporalType === 'exact' &&
          startTime === existingEvent.startTime &&
          endTime === endTimeForEvent(existingEvent)
        ? { ok: true as const, value: existingEvent.duration }
        : createFixedDurationFromTimes(startTime, endTime);
      if (!duration.ok) { setEndTimeError(duration.error.message); return false; }
      draft = { ...base, calendarId: base.calendarId ?? '', temporalType, startTime, duration: duration.value };
    } else if (temporalType === 'allDay') {
      draft = {
        ...base,
        calendarId: base.calendarId ?? '',
        temporalType,
        endDate: existingEvent?.temporalType === 'allDay'
          ? movedAllDayEndDate(existingEvent, anchorDate)
          : anchorDate,
      };
    } else if (selectedDefinitionId !== null) {
      draft = { ...base, calendarId: base.calendarId ?? '', temporalType, temporalDefinitionId: selectedDefinitionId };
    } else {
      setSaveError('時間帯を選択してください。'); return false;
    }
    if (calendarId === null) {
      setSaveError('カレンダーを読み込めませんでした。もう一度お試しください。');
      return false;
    }
    draft = { ...draft, calendarId: existingEvent?.calendarId ?? calendarId } as EventDraft;
    const timestamp = now();
    const event = existingEvent === undefined
      ? createCalendarEvent({ id: createId(), draft, now: timestamp })
      : parseCalendarEvent({ ...draft, id: existingEvent.id, createdAt: existingEvent.createdAt, updatedAt: timestamp });
    if (!event.ok) {
      if (event.error.field === 'title') setTitleError('タイトルを入力してください');
      else if (event.error.field === 'anchorDate') setDateError('日付を確認してください');
      else setSaveError('入力内容を確認してください。');
      return false;
    }
    operationRef.current = true; setIsSaving(true);
    try {
      const aggregate = { event: event.value, reminders: existingAggregate?.reminders ?? [] };
      if (existingEvent === undefined) await events.create(aggregate); else await events.update(aggregate);
      return true;
    } catch {
      setSaveError('保存できませんでした。もう一度お試しください。'); return false;
    } finally {
      operationRef.current = false; setIsSaving(false);
    }
  }, [anchorDate, calendarId, clearErrors, createId, endTime, events, existingAggregate, getTimeZoneId, now, selectedDefinitionId, startTime, status, temporalType, title]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (operationRef.current || existingAggregate === null) return false;
    operationRef.current = true; setIsDeleting(true); setSaveError(null);
    try { await events.delete(existingAggregate.event.id); return true; }
    catch { setSaveError('削除できませんでした。もう一度お試しください。'); return false; }
    finally { operationRef.current = false; setIsDeleting(false); }
  }, [events, existingAggregate]);

  return { status, mode: existingAggregate === null ? 'create' : 'edit', title, anchorDate, temporalType, startTime, endTime,
    definitions, selectedDefinitionId, titleError, dateError, endTimeError, saveError, isSaving, isDeleting,
    setTitle, setAnchorDate, setTemporalType, setStartTime, setEndTime, selectDefinition, retry, save, remove };
}
