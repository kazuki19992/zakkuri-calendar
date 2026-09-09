import { useCallback, useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import type { Calendar } from '@/domain/calendar/calendar';
import { createCalendarEvent, type EventDraft } from '@/domain/calendar/event';
import type {
  CalendarRepository,
  EventRepository,
  TemporalDefinitionRepository,
} from '@/domain/calendar/repositories';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';

type QuickCreateStatus = 'loading' | 'ready' | 'error';

type UseQuickCreateEventInput = Readonly<{
  calendars: CalendarRepository;
  temporalDefinitions: TemporalDefinitionRepository;
  events: EventRepository;
  initialDate: string;
  createId?: () => string;
  now?: () => string;
  getTimeZoneId?: () => string;
}>;

export type QuickCreateEventState = Readonly<{
  status: QuickCreateStatus;
  title: string;
  anchorDate: string;
  definitions: readonly TemporalDefinition[];
  selectedDefinitionId: string | null;
  titleError: string | null;
  anchorDateError: string | null;
  saveError: string | null;
  isSaving: boolean;
  setTitle(value: string): void;
  setAnchorDate(value: string): void;
  selectDefinition(id: string): void;
  retry(): void;
  save(): Promise<boolean>;
}>;

const defaultNow = (): string => new Date().toISOString();
const defaultTimeZoneId = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function useQuickCreateEvent({
  calendars,
  temporalDefinitions,
  events,
  initialDate,
  createId = Crypto.randomUUID,
  now = defaultNow,
  getTimeZoneId = defaultTimeZoneId,
}: UseQuickCreateEventInput): QuickCreateEventState {
  const [status, setStatus] = useState<QuickCreateStatus>('loading');
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [definitions, setDefinitions] = useState<readonly TemporalDefinition[]>([]);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null);
  const [title, setTitleValue] = useState('');
  const [anchorDate, setAnchorDateValue] = useState(initialDate);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [anchorDateError, setAnchorDateError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadRevision, setLoadRevision] = useState(0);
  const savingRef = useRef(false);

  useEffect(() => {
    let isActive = true;

    const load = async (): Promise<void> => {
      try {
        const loadedCalendar = await calendars.getDefault();
        const loadedDefinitions = await temporalDefinitions.listEnabled(loadedCalendar.id);
        if (!isActive) return;

        const dayDefinitions = loadedDefinitions.filter(
          (definition) => definition.granularity === 'day',
        );
        setCalendar(loadedCalendar);
        setDefinitions(dayDefinitions);
        setSelectedDefinitionId(dayDefinitions[0]?.id ?? null);
        setStatus('ready');
      } catch {
        if (isActive) setStatus('error');
      }
    };

    void load();
    return () => {
      isActive = false;
    };
  }, [calendars, loadRevision, temporalDefinitions]);

  const setTitle = useCallback((value: string): void => {
    setTitleValue(value);
    setTitleError(null);
    setSaveError(null);
  }, []);

  const setAnchorDate = useCallback((value: string): void => {
    setAnchorDateValue(value);
    setAnchorDateError(null);
    setSaveError(null);
  }, []);

  const selectDefinition = useCallback((id: string): void => {
    setSelectedDefinitionId(id);
    setSaveError(null);
  }, []);

  const retry = useCallback((): void => {
    setStatus('loading');
    setLoadRevision((current) => current + 1);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (savingRef.current || status !== 'ready' || calendar === null) return false;

    setTitleError(null);
    setAnchorDateError(null);
    setSaveError(null);

    if (selectedDefinitionId === null) {
      setSaveError('時間帯を選択してください。');
      return false;
    }

    const draft: EventDraft = {
      calendarId: calendar.id,
      title: title.trim(),
      anchorDate,
      temporalType: 'fuzzy',
      temporalDefinitionId: selectedDefinitionId,
      createdTimeZoneId: getTimeZoneId(),
    };
    const event = createCalendarEvent({ id: createId(), draft, now: now() });
    if (!event.ok) {
      if (event.error.field === 'title') {
        setTitleError('タイトルを入力してください');
      } else if (event.error.field === 'anchorDate') {
        setAnchorDateError('日付をYYYY-MM-DD形式で入力してください');
      } else {
        setSaveError('入力内容を確認してください。');
      }
      return false;
    }

    savingRef.current = true;
    setIsSaving(true);
    try {
      await events.create(event.value);
      return true;
    } catch {
      setSaveError('保存できませんでした。もう一度お試しください。');
      return false;
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [anchorDate, calendar, createId, events, getTimeZoneId, now, selectedDefinitionId, status, title]);

  return {
    status,
    title,
    anchorDate,
    definitions,
    selectedDefinitionId,
    titleError,
    anchorDateError,
    saveError,
    isSaving,
    setTitle,
    setAnchorDate,
    selectDefinition,
    retry,
    save,
  };
}
