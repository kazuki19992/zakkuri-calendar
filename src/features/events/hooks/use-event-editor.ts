import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createCalendarEvent,
  parseCalendarEvent,
  type CalendarEvent,
  type EventDraft,
} from '@/domain/calendar/event';
import { createFixedDurationFromTimes, toMinutesOfDay, toWallClockTime } from '@/domain/calendar/time';
import type {
  CalendarRepository,
  EventRepository,
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
  temporalDefinitions: TemporalDefinitionRepository;
  initial: Readonly<{ date: string; startTime: string; endTime: string; temporalType: EditorTemporalType }>;
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

export function useEventEditor({
  calendars,
  events,
  temporalDefinitions,
  initial,
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
  const [existingEvent, setExistingEvent] = useState<CalendarEvent | null>(null);
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
        const [calendar, loadedEvent] = await Promise.all([
          calendars.getDefault(),
          eventId === undefined ? Promise.resolve(null) : events.getById(eventId),
        ]);
        if (!active) return;
        if (eventId !== undefined && loadedEvent === null) throw new Error('event not found');
        const targetCalendarId = loadedEvent?.calendarId ?? calendar.id;
        const loadedDefinitions = await temporalDefinitions.listEnabled(targetCalendarId);
        if (!active) return;
        const dayDefinitions = loadedDefinitions.filter((definition) => definition.granularity === 'day');
        setCalendarId(targetCalendarId);
        setDefinitions(dayDefinitions);
        setSelectedDefinitionId(dayDefinitions[0]?.id ?? null);
        if (loadedEvent !== null) {
          setExistingEvent(loadedEvent);
          setTitleValue(loadedEvent.title);
          setAnchorDateValue(loadedEvent.anchorDate);
          setTemporalTypeValue(loadedEvent.temporalType);
          if (loadedEvent.temporalType === 'exact') {
            setStartTimeValue(loadedEvent.startTime);
            setEndTimeValue(endTimeForEvent(loadedEvent));
          } else if (loadedEvent.temporalType === 'fuzzy') {
            setSelectedDefinitionId(loadedEvent.temporalDefinitionId);
          }
        }
        setStatus('ready');
      } catch {
        if (active) setStatus('error');
      }
    };
    void load();
    return () => { active = false; };
  }, [calendars, eventId, events, loadRevision, temporalDefinitions]);

  const clearErrors = useCallback(() => {
    setTitleError(null); setDateError(null); setEndTimeError(null); setSaveError(null);
  }, []);
  const setTitle = useCallback((value: string) => { setTitleValue(value); clearErrors(); }, [clearErrors]);
  const setAnchorDate = useCallback((value: string) => { setAnchorDateValue(value); clearErrors(); }, [clearErrors]);
  const setTemporalType = useCallback((value: EditorTemporalType) => { setTemporalTypeValue(value); clearErrors(); }, [clearErrors]);
  const setStartTime = useCallback((value: string) => { setStartTimeValue(value); clearErrors(); }, [clearErrors]);
  const setEndTime = useCallback((value: string) => { setEndTimeValue(value); clearErrors(); }, [clearErrors]);
  const selectDefinition = useCallback((value: string) => { setSelectedDefinitionId(value); setSaveError(null); }, []);
  const retry = useCallback(() => { setStatus('loading'); setLoadRevision((value) => value + 1); }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (operationRef.current || status !== 'ready') return false;
    clearErrors();
    const base = {
      calendarId: existingEvent?.calendarId,
      title: title.trim(),
      anchorDate,
      createdTimeZoneId: existingEvent?.createdTimeZoneId ?? getTimeZoneId(),
    };
    let draft: EventDraft | null = null;
    if (temporalType === 'exact') {
      const duration = createFixedDurationFromTimes(startTime, endTime);
      if (!duration.ok) { setEndTimeError(duration.error.message); return false; }
      draft = { ...base, calendarId: base.calendarId ?? '', temporalType, startTime, duration: duration.value };
    } else if (temporalType === 'allDay') {
      draft = { ...base, calendarId: base.calendarId ?? '', temporalType };
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
    const event = existingEvent === null
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
      if (existingEvent === null) await events.create(event.value); else await events.update(event.value);
      return true;
    } catch {
      setSaveError('保存できませんでした。もう一度お試しください。'); return false;
    } finally {
      operationRef.current = false; setIsSaving(false);
    }
  }, [anchorDate, calendarId, clearErrors, createId, endTime, events, existingEvent, getTimeZoneId, now, selectedDefinitionId, startTime, status, temporalType, title]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (operationRef.current || existingEvent === null) return false;
    operationRef.current = true; setIsDeleting(true); setSaveError(null);
    try { await events.delete(existingEvent.id); return true; }
    catch { setSaveError('削除できませんでした。もう一度お試しください。'); return false; }
    finally { operationRef.current = false; setIsDeleting(false); }
  }, [events, existingEvent]);

  return { status, mode: existingEvent === null ? 'create' : 'edit', title, anchorDate, temporalType, startTime, endTime,
    definitions, selectedDefinitionId, titleError, dateError, endTimeError, saveError, isSaving, isDeleting,
    setTitle, setAnchorDate, setTemporalType, setStartTime, setEndTime, selectDefinition, retry, save, remove };
}
