import {Alert} from 'react-native';
import {useInlineNoteSession} from './use-inline-note-session';
import type {InlineNoteSession} from '../event-note/inline-note-session';
import {recurrenceStructureChanged,relativeMeaningChanged} from '@/domain/calendar/relative-recurrence-change';
import {buildRelativeRecurrenceRule,inheritRelativeRecurrenceRule,relativeEndDescription} from '../relative-recurrence-draft';
import {relativePeriodAt,resolveRelativeOccurrence,deadlineWarningLabel,type RelativeRecurrenceEnvironment} from '@/domain/calendar/relative-recurrence';
import { TemporalConflictError, temporalDefinitionToken, type DefinitionExpectation } from '@/domain/temporal/temporal-preferences';
import { useNewReminderDefaults } from './use-new-reminder-defaults';
import { getReminderTiming } from '@/domain/calendar/event-reminder';
import { notificationCategory, parseReminderTiming, sameReminderCondition, timingIsCompatible, type ReminderTiming, type NotificationCategory } from '@/domain/notifications/reminder-timing';
import { DEFAULT_EXACT_DURATION } from '@/domain/calendar/default-exact-duration';
import { rangeForExactDuration } from '../exact-duration-draft';
import { useNewEventDuration } from './use-new-event-duration';
import * as Crypto from 'expo-crypto';
import { openBrowserAsync } from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventColorId } from '@/domain/calendar/event-color';
import {
  areEventNotesEqual,
  parseSafeEventNoteUrl,
  projectEventNoteToPlainText,
  type EventNoteDocumentV1,
} from '@/domain/calendar/event-note';
import {
  createCalendarEvent,
  parseCalendarEvent,
  type EventDraft,
  type EventEditorTab,
  type ExactDuration,
} from '@/domain/calendar/event';
import type { EventAggregate } from '@/domain/calendar/event-reminder';
import type { HolidayProvider } from '@/domain/calendar/holiday';
import { DEFAULT_HOLIDAY_PREFERENCES, type HolidayPreferencesV1 } from '@/domain/calendar/holiday-preferences';
import { adjustThisWeekDeadline } from '@/domain/temporal/adjust-this-week-deadline';
import { selectHolidayProvider } from '@/data/holidays/selected-holiday-provider';
import {
  buildSeriesScopedAggregate,
  getChangedEventFields,
  planFollowingMutation,
  planSeriesMutation,
} from '@/domain/calendar/recurrence-change';
import {
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
import { createFixedDurationFromDateTimes, toMinutesOfDay, toWallClockTime } from '@/domain/calendar/time';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import {
  resolveRelativeDateRange,
  withoutRelativeSelectionOffset,
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
import { getEditableOccurrenceAggregate,
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
  relativeDateRange: Readonly<{ startDate: string; endDate: string }> | null;
  occurrenceRecurrenceNotice?: string | null;
  relativeRecurrence?: Readonly<{ frequency:'weekly'|'monthly'; periodAnchorDate:string; label:string; preview:readonly string[]; policyDescription:string|null; updatePolicy?():Promise<void>; notice:string|null }>;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  exactDurationType: ExactDuration['type'];
  exactDurationStatus: 'loading' | 'ready' | 'error';
  retryExactDuration(): Promise<void>;
  setExactDurationType(value: ExactDuration['type']): void;
  definitions: readonly TemporalDefinition[];
  selectedDefinitionId: string | null;
  calendarName: string;
  calendarColorId: EventColorId;
  colorId: EventColorId | null;
  location: string;
  noteDocument: EventNoteDocumentV1 | null;
  noteSession: InlineNoteSession;
  isBusy: boolean;
  confirmLeave(): Promise<boolean>;
  canLeave(): boolean;
  noteSummary: string;
  noteLinkError: string | null;
  recurrenceDraft: RecurrenceDraft;
  reminders: readonly ReminderDraft[];
  titleError: string | null;
  dateError: string | null;
  endTimeError: string | null;
  recurrenceError: string | null;
  reminderError: string | null;
  saveError: string | null;
  isSaving: boolean;
  isSaveDisabled: boolean;
  isDeleting: boolean;
  usesRecurrenceScope: boolean;
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
  openNoteLink(value: string): Promise<void>;
  setRecurrencePreset(value: RecurrencePreset): void;
  setRecurrenceFrequency(value: RecurrenceRuleV1['frequency']): void;
  setRecurrenceIntervalText(value: string): void;
  toggleRecurrenceWeekday(value: number): void;
  setRecurrenceEndType(value: RecurrenceRuleV1['end']['type']): void;
  setRecurrenceUntilDate(value: string): void;
  setRecurrenceCountText(value: string): void;
  reminderCategory: NotificationCategory;
  allowReminderEnd: boolean;
  notificationDefaultStatus: 'loading' | 'ready' | 'error';
  retryNotificationDefaults(): void;
  resetReminderDefaults(): void;
  updateReminder(id: string, timing: ReminderTiming): void;
  addReminder(value: number | ReminderTiming): void;
  removeReminder(id: string): void;
  moveReminder(id: string, offset: -1 | 1): void;
  retry(): void;
  save(): Promise<boolean>;
  getSavedEventLocation?(): Readonly<{ id: string; date: string }> | null;
  remove(): Promise<boolean>;
  selectScope(scope: RecurrenceEditScope): Promise<boolean>;
  cancelScope(): void;
}>;

type UseEventEditorInput = Readonly<{
  calendars: CalendarRepository;
  events: EventRepository;
  settings: SettingsRepository;
  temporalDefinitions: TemporalDefinitionRepository;
  holidayProvider?: HolidayProvider;
  initial: Readonly<{
    date: string;
    startTime: string;
    endTime?: string;
    temporalType: EventDraft['temporalType'];
  }>;
  eventId?: string;
  occurrenceDate?: string;
  createId?: () => string;
  createReminderId?: () => string;
  now?: () => string;
  getTimeZoneId?: () => string;
  openBrowser?: (url: string) => Promise<unknown>;
}>;

const defaultNow = (): string => new Date().toISOString();
const unsupportedHolidayProvider: HolidayProvider = { list: () => ({ status: 'unsupported' }) };
const defaultTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const optionalText = (value: string): string | null => value.trim() || null;

function initialEndDate(date: string, startTime: string, endTime: string): string {
  const start = toMinutesOfDay(startTime);
  const end = toMinutesOfDay(endTime);
  return start !== null && end !== null && end < start ? offsetCalendarDate(date, 1) : date;
}

/**
 * 明示終了と既存予定を優先し、新規draftにだけ既定長のsnapshotを適用する。
 * 終日と時刻付きの終了日を独立させ、遅い初期化でも入力を上書きしないようにする。
 */
export function useEventEditor({
  calendars,
  events,
  settings,
  temporalDefinitions,
  holidayProvider = unsupportedHolidayProvider,
  initial,
  eventId,
  occurrenceDate,
  createId = Crypto.randomUUID,
  createReminderId = Crypto.randomUUID,
  now = defaultNow,
  getTimeZoneId = defaultTimeZone,
  openBrowser = openBrowserAsync,
}: UseEventEditorInput): EventEditorState {
  const [initialValues] = useState(initial);
  const initialEditorTab = initialValues.temporalType === 'exact' ? 'exact' : 'fuzzy';
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
  const [editorTab, setEditorTabValue] = useState<EventEditorTab>(initialEditorTab);
  const [isAllDay, setAllDayValue] = useState(initialValues.temporalType === 'allDay');
  const [startDate, setStartDateValue] = useState(initialValues.date);
  const [startTime, setStartTimeValue] = useState(initialValues.startTime);
  const [endDate, setEndDateValue] = useState(() => initialEndDate(
    initialValues.date,
    initialValues.startTime,
    initialValues.endTime ?? initialValues.startTime,
  ));
  const [endTime, setEndTimeValue] = useState(initialValues.endTime ?? initialValues.startTime);
  const [allDayEndDate, setAllDayEndDate] = useState(initialValues.date);
  const allDayDraftInitialized = useRef(initialValues.temporalType === 'allDay');
  const [exactDurationType, setExactDurationTypeValue] = useState<ExactDuration['type']>('fixed');
  const lastFixedMinutes = useRef<number>(DEFAULT_EXACT_DURATION.minutes);
  const currentStartDate = useRef(initialValues.date);
  const initializeDuration = useCallback((duration: ExactDuration) => {
    const range = rangeForExactDuration(currentStartDate.current, initialValues.startTime, duration);
    setEndDateValue(range.endDate);
    setEndTimeValue(range.endTime);
    setExactDurationTypeValue(duration.type);
    if (duration.type === 'fixed') lastFixedMinutes.current = duration.minutes;
  }, [initialValues]);
  const initialDuration = useNewEventDuration({ settings,
    enabled: eventId === undefined && initialValues.endTime === undefined,
    onResolved: initializeDuration,
  });
  const [relativeReference,setRelativeReference]=useState<string|null>(null);
  const [relativeSelectionNotice,setRelativeSelectionNotice]=useState<string|null>(null);
  const [deadlinePolicyUpdated,setDeadlinePolicyUpdated]=useState(false);
  const [updatingPolicy,setUpdatingPolicy]=useState(false);
  const [definitions, setDefinitions] = useState<readonly TemporalDefinition[]>([]);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null);
  const [thisWeekDeadlineWeekday, setThisWeekDeadlineWeekday] = useState<ThisWeekDeadlineWeekday>(5);
  const [holidayPreferences, setHolidayPreferences] = useState<HolidayPreferencesV1>(DEFAULT_HOLIDAY_PREFERENCES);
  const [temporalReselected, setTemporalReselected] = useState(false);
  const [colorId, setColorIdValue] = useState<EventColorId | null>(null);
  const [location, setLocationValue] = useState('');
  const {session:noteSession,snapshot:noteSnapshot}=useInlineNoteSession();
  const noteDocument=noteSnapshot.document;
  const loadedNoteRef=useRef<EventNoteDocumentV1|null>(null);
  const completedRef=useRef(false);
  const draftBaselineRef = useRef<string | null>(null);
  const [isCheckingLeave,setIsCheckingLeave]=useState(false);
  const [noteLinkError, setNoteLinkError] = useState<string | null>(null);
  const [recurrenceDraft, setRecurrenceDraft] = useState<RecurrenceDraft>(() =>
    getRecurrenceDraft(null, initialValues.date));
  const [recurrenceEdited, setRecurrenceEdited] = useState(false);
  const [reminders, setReminders] = useState<readonly ReminderDraft[]>([]);
  const selectedDefinition = definitions.find((definition) => definition.id === selectedDefinitionId) ?? null;
  const existingRelativeEvent = (!temporalReselected || (existingAggregate?.event.recurrenceRule?.version===2 && !deadlinePolicyUpdated)) && existingAggregate?.event.temporalType === 'fuzzy' &&
    existingAggregate.event.temporalDefinitionId === selectedDefinitionId &&
    existingAggregate.event.resolutionContext !== null
    ? existingAggregate.event
    : null;
  const hasRelativeDefinition = (selectedDefinition !== null && selectedDefinition.granularity !== 'day') ||
    existingRelativeEvent !== null;
  const temporalType = isAllDay ? 'allDay' : editorTab;
  const isRelativeDefinition = temporalType === 'fuzzy' && hasRelativeDefinition;
  const reminderCategory = notificationCategory({
    temporalType,
    ...(selectedDefinitionId === null ? {} : { temporalDefinitionId: selectedDefinitionId }),
  }, definitions);
  const reminderDefaults = useNewReminderDefaults({ settings, isNew: eventId === undefined, category: reminderCategory, ready: status === 'ready', apply: setReminders, createId: createReminderId });
  const markReminderTouched = reminderDefaults.markTouched;

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
  const savedLocation = useRef<Readonly<{ id: string; date: string }> | null>(null);
  const getSavedEventLocation = useCallback(() => savedLocation.current, []);
  const scopeActiveRef=useRef(false);
  const updateScopeRequest=useCallback((request:ScopeRequest|null)=>{
    scopeActiveRef.current=request!==null;setScopeRequest(request);
    if(request===null)noteSession.release();
  },[noteSession]);

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      try {
        const [calendar, loadedValue, deadlineWeekday, loadedHolidayPreferences] = await Promise.all([
          calendars.getDefault(),
          eventId === undefined
            ? Promise.resolve(null)
            : occurrenceDate === undefined
              ? events.getById(eventId)
              : events.getOccurrenceEditData({
                seriesEventId: eventId,
                originalOccurrenceDate: occurrenceDate,
              }),
          settings.getThisWeekDeadlineWeekday(),
          settings.getHolidayPreferences(),
        ]);
        if (!active) return;
        const loadedOccurrenceData = occurrenceDate === undefined
          ? null
          : loadedValue as OccurrenceEditData | null;
        let loadedAggregate = occurrenceDate === undefined
          ? loadedValue as EventAggregate | null
          : null;
        if (loadedOccurrenceData !== null && occurrenceDate !== undefined) {
          loadedAggregate = getEditableOccurrenceAggregate(loadedOccurrenceData, occurrenceDate);
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
        const sourceId=loadedOccurrenceData?.series.event.temporalType==='fuzzy'?loadedOccurrenceData.series.event.temporalDefinitionId:null;
        if(sourceId&&!loadedDefinitions.some(item=>item.id===sourceId)){
          const sourceDefinition=await temporalDefinitions.getById(sourceId);if(sourceDefinition)loadedDefinitions=[...loadedDefinitions,sourceDefinition];
        }
        if (!active) return;

        setCalendarId(targetCalendarId);
        setCalendarName(calendar.name);
        setCalendarColorId(calendar.colorId);
        setDefinitions(loadedDefinitions);
        setRelativeReference(null);setDeadlinePolicyUpdated(false);setRelativeSelectionNotice(null);
        setThisWeekDeadlineWeekday(deadlineWeekday);
        setHolidayPreferences(loadedHolidayPreferences);
        setTemporalReselected(false);
        noteSession.reset(loadedAggregate?.event.noteDocument??null);
        loadedNoteRef.current=loadedAggregate?.event.noteDocument??null;
        completedRef.current=false;
        draftBaselineRef.current = null;
        setSelectedDefinitionId(
          loadedDefinitions.find((definition) => definition.granularity === 'day')?.id
            ?? loadedDefinitions[0]?.id
            ?? null,
        );

        if (loadedAggregate === null) {
          setEditorTabValue(initialEditorTab);
        } else {
          const event = loadedAggregate.event;
          setExistingAggregate(loadedAggregate);
          setTitleValue(event.title);
          if (event.temporalType === 'exact') {
            setExactDurationTypeValue(event.duration.type);
            if (event.duration.type === 'fixed') lastFixedMinutes.current = event.duration.minutes;
          }
          setStartDateValue(event.anchorDate);
          currentStartDate.current = event.anchorDate;
          setColorIdValue(event.colorId);
          setLocationValue(event.location ?? '');

          setRecurrenceDraft(getRecurrenceDraft(event.recurrenceRule, event.anchorDate));
          setRecurrenceEdited(false);
          setReminders(getReminderDrafts(loadedAggregate.reminders));
          if (event.temporalType === 'fuzzy') {
            setEditorTabValue('fuzzy');
            setAllDayValue(false);
            const fuzzyStartDate = event.resolutionContext?.referenceDate ?? event.anchorDate;
            setStartDateValue(fuzzyStartDate);
            currentStartDate.current = fuzzyStartDate;
            setEndDateValue(event.endDate);
            setAllDayEndDate(event.endDate);
            setSelectedDefinitionId(event.temporalDefinitionId);
            const definition = loadedDefinitions.find(({ id }) => id === event.temporalDefinitionId);
            const config = definition?.resolverConfig;
            if (config?.kind === 'timeOfDay') {
              const start = toWallClockTime(config.startMinute);
              if (start !== null) {
                const range = rangeForExactDuration(fuzzyStartDate, start, {
                  type: 'fixed', minutes: config.endMinute - config.startMinute,
                });
                setStartTimeValue(range.startTime);
                setEndDateValue(range.endDate);
                setEndTimeValue(range.endTime);
                setExactDurationTypeValue('fixed');
              }
            }
          } else if (event.temporalType === 'allDay') {
            setEditorTabValue('exact');
            setAllDayValue(true);
            allDayDraftInitialized.current = true;
            setEndDateValue(event.endDate);
            setAllDayEndDate(event.endDate);
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
  }, [calendars, eventId, events, initialEditorTab, loadRevision,
    occurrenceDate, settings, temporalDefinitions,noteSession]);

  type RecurrenceDraftKey = EventEditorTab | 'allDay';
  const recurrenceTabCache=useRef<Partial<Record<RecurrenceDraftKey,RecurrenceDraft>>>({});
  const recurrenceGranularityCache=useRef<Partial<Record<'day'|'week'|'month',RecurrenceDraft>>>({});
  const recurrenceTabIntent=useRef<Partial<Record<RecurrenceDraftKey,boolean>>>({});
  const recurrenceGranularityIntent=useRef<Partial<Record<'day'|'week'|'month',boolean>>>({});
  const clearErrors = useCallback(() => {
    setTitleError(null);
    setDateError(null);
    setEndTimeError(null);
    setRecurrenceError(null);
    setReminderError(null);
    setSaveError(null);
  }, []);
  const setTitle = useCallback((value: string) => { setTitleValue(value); clearErrors(); }, [clearErrors]);
  const switchRecurrenceDraft = useCallback((from: RecurrenceDraftKey, to: RecurrenceDraftKey) => {
    recurrenceTabCache.current[from] = recurrenceDraft;
    recurrenceTabIntent.current[from] = recurrenceEdited;
    setRecurrenceDraft(recurrenceTabCache.current[to] ?? getRecurrenceDraft(null, startDate));
    setRecurrenceEdited(recurrenceTabIntent.current[to] ?? false);
  }, [recurrenceDraft, recurrenceEdited, startDate]);
  const setEditorTab = useCallback((value: EventEditorTab) => {
    if (value === editorTab) return;
    if (!isAllDay) switchRecurrenceDraft(editorTab, value);
    setEditorTabValue(value);
    clearErrors();
  }, [clearErrors, editorTab, isAllDay, switchRecurrenceDraft]);
  const setAllDay = useCallback((value: boolean) => {
    if (value === isAllDay) return;
    if (value && !allDayDraftInitialized.current) {
      setAllDayEndDate(editorTab === 'fuzzy' ? startDate : endDate);
      allDayDraftInitialized.current = true;
    }
    // 相対期間の繰り返しと通常の繰り返しは保存形式が異なるため、それぞれの入力を保持する。
    if (editorTab === 'fuzzy' && hasRelativeDefinition) {
      switchRecurrenceDraft(value ? 'fuzzy' : 'allDay', value ? 'allDay' : 'fuzzy');
    } else {
      const key = value ? editorTab : 'allDay';
      recurrenceTabCache.current[key] = recurrenceDraft;
      recurrenceTabIntent.current[key] = recurrenceEdited;
    }
    setAllDayValue(value);
    clearErrors();
  }, [clearErrors, editorTab, endDate, hasRelativeDefinition, isAllDay, recurrenceDraft, recurrenceEdited, startDate, switchRecurrenceDraft]);
  const setStartDate = useCallback((value: string) => {
    const moved = moveEditorRangeStart({ startDate, startTime, endDate, endTime }, value);
    const movedAllDay = moveEditorRangeStart({ startDate, startTime, endDate: allDayEndDate, endTime }, value);
    setAllDayEndDate(movedAllDay.endDate);
    currentStartDate.current = moved.startDate;
    setStartDateValue(moved.startDate);
    setEndDateValue(moved.endDate);
    clearErrors();
  }, [allDayEndDate, clearErrors, endDate, endTime, startDate, startTime]);
  const setEndDate = useCallback((value: string) => { if (isAllDay) setAllDayEndDate(value); else if (initialDuration.status === 'ready') setEndDateValue(value); clearErrors(); }, [clearErrors, initialDuration.status, isAllDay]);
  const setStartTime = useCallback((value: string) => { if (initialDuration.status !== 'ready') return; setStartTimeValue(value); clearErrors(); }, [clearErrors, initialDuration.status]);
  const setEndTime = useCallback((value: string) => { if (initialDuration.status !== 'ready') return; setEndTimeValue(value); clearErrors(); }, [clearErrors, initialDuration.status]);

  useEffect(() => {
    if (exactDurationType !== 'fixed') return;
    const current = createFixedDurationFromDateTimes(startDate, startTime, endDate, endTime);
    if (current.ok && current.value.type === 'fixed') lastFixedMinutes.current = current.value.minutes;
  }, [endDate, endTime, exactDurationType, startDate, startTime]);

  const setExactDurationType = useCallback((value: ExactDuration['type']) => {
    if (initialDuration.status !== 'ready' || value === exactDurationType) return;
    if (exactDurationType === 'fixed') {
      const current = createFixedDurationFromDateTimes(startDate, startTime, endDate, endTime);
      if (current.ok && current.value.type === 'fixed') lastFixedMinutes.current = current.value.minutes;
    }
    if (value === 'fixed') {
      const range = rangeForExactDuration(startDate, startTime, { type: 'fixed', minutes: lastFixedMinutes.current });
      setEndDateValue(range.endDate);
      setEndTimeValue(range.endTime);
    }
    setExactDurationTypeValue(value);
    clearErrors();
  }, [clearErrors, endDate, endTime, exactDurationType, initialDuration.status, startDate, startTime]);
  const selectDefinition = useCallback((value: string) => {
    if (value === selectedDefinitionId) return;
    const previous=definitions.find(d=>d.id===selectedDefinitionId),next=definitions.find(d=>d.id===value);
    if(previous&&next&&previous.granularity!==next.granularity){
      const current=existingAggregate?.event;
      const visible=current?.temporalType==='fuzzy'&&current.temporalDefinitionId===selectedDefinitionId&&!temporalReselected?current.anchorDate:null;
      const oldRange=previous.granularity!=='day'?resolveRelativeDateRange(relativeReference??startDate,relativeReference===null?previous:withoutRelativeSelectionOffset(previous),thisWeekDeadlineWeekday):null;
      setRelativeReference(previous.granularity!=='day'&&next.granularity!=='day'?(visible??(oldRange?.ok?oldRange.value.startDate:startDate)):null);
      recurrenceGranularityCache.current[previous.granularity]=recurrenceDraft;
      recurrenceGranularityIntent.current[previous.granularity]=recurrenceEdited;
      const cached=recurrenceGranularityCache.current[next.granularity];
      setRecurrenceEdited(recurrenceGranularityIntent.current[next.granularity]??false);
      setRecurrenceDraft(cached??{...recurrenceDraft,preset:'none',frequency:next.granularity==='month'?'monthly':'weekly',untilDate:recurrenceDraft.endType==='until'?'':recurrenceDraft.untilDate});
      setRelativeSelectionNotice(cached?'以前の入力内容を復元しました。期間を再確認してください。':'単位が変わったため繰り返しを未設定にしました。新しい単位で選び直してください。');
    }
    if(previous&&next&&previous.granularity!=='day'&&previous.granularity===next.granularity&&existingAggregate?.event.recurrenceRule?.version===2)setRelativeReference(existingAggregate.event.anchorDate);
    setTemporalReselected(true);
    setSelectedDefinitionId(value); clearErrors();
  }, [clearErrors, selectedDefinitionId,definitions,existingAggregate,temporalReselected,relativeReference,startDate,thisWeekDeadlineWeekday,recurrenceDraft,recurrenceEdited]);
  const setColorId = useCallback((value: EventColorId | null) => { setColorIdValue(value); clearErrors(); }, [clearErrors]);
  const setLocation = useCallback((value: string) => { setLocationValue(value); clearErrors(); }, [clearErrors]);
  const openNoteLink = useCallback(async (value: string): Promise<void> => {
    const safeUrl = parseSafeEventNoteUrl(value);
    if (safeUrl === null) {
      setNoteLinkError('リンクを開けませんでした。');
      return;
    }
    try {
      await openBrowser(safeUrl);
      setNoteLinkError(null);
    } catch {
      setNoteLinkError('リンクを開けませんでした。');
    }
  }, [openBrowser]);
  const updateRecurrence = useCallback((update: Partial<RecurrenceDraft>) => {
    setRecurrenceEdited(true);
    setRecurrenceDraft((value) => {
      const frequency: RecurrenceDraft['frequency'] | null = isRelativeDefinition && selectedDefinition
        ? selectedDefinition.granularity === 'month' ? 'monthly' : 'weekly' : null;
      const base=frequency&&value.frequency!==frequency?{...value,preset:'none' as const,frequency,untilDate:value.endType==='until'?'':value.untilDate}:value;
      return {...base,...update,...(frequency?{frequency}:{})};
    });
    setRecurrenceError(null);
  }, [isRelativeDefinition, selectedDefinition]);
  const setRecurrencePreset = useCallback((value: RecurrencePreset) => updateRecurrence({ preset: value }), [updateRecurrence]);
  const setRecurrenceFrequency = useCallback((value: RecurrenceRuleV1['frequency']) => updateRecurrence({ frequency: value }), [updateRecurrence]);
  const setRecurrenceIntervalText = useCallback((value: string) => updateRecurrence({ intervalText: value }), [updateRecurrence]);
  const toggleRecurrenceWeekday = useCallback((value: number) => {
    setRecurrenceEdited(true);
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
  const addReminder = useCallback((value: number | ReminderTiming) => {
    if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0)) {
      setReminderError('通知時間は0以上の整数で入力してください'); return;
    }
    const timing = typeof value === 'number' ? { version: 1, kind: 'legacyStartOffset', minutesBefore: value } as const : parseReminderTiming(value);
    if (!timing) { setReminderError('通知時間を確認してください'); return; }
    markReminderTouched();
    setReminders(current => current.some(item => sameReminderCondition(getReminderTiming(item), timing, reminderCategory))
      ? current : [...current, typeof value === 'number' ? { id: createReminderId(), minutesBefore: value } : { id: createReminderId(), timing }]);
    setReminderError(null);
  }, [createReminderId, markReminderTouched, reminderCategory]);
  const updateReminder = useCallback((id: string, value: ReminderTiming) => {
    const timing = parseReminderTiming(value);
    if (!timing) { setReminderError('通知時間を確認してください'); return; }
    markReminderTouched();
    setReminders(current => {
      if(current.some(item => item.id !== id && sameReminderCondition(getReminderTiming(item), timing, reminderCategory))) return current;
      return current.map(item => item.id === id ? { id, timing } : item);
    });
    setReminderError(null);
  }, [markReminderTouched, reminderCategory]);
  const removeReminder = useCallback((id: string) => {
    markReminderTouched();
    setReminders(current => current.filter(item => item.id !== id)); setReminderError(null);
  }, [markReminderTouched]);
  const moveReminder = useCallback((id: string, offset: -1 | 1) => {
    markReminderTouched();
    setReminders(current => moveReminderDraft(current, current.findIndex(item => item.id === id), offset));
  }, [markReminderTouched]);
  const retry = useCallback(() => { setStatus('loading'); setLoadRevision((value) => value + 1); }, []);

  let relativeResolution: RelativeDateResolution | null = null;
  let relativeDateError: string | null = null;
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
      const selection=relativeReference===null?selectedDefinition:withoutRelativeSelectionOffset(selectedDefinition);
      const resolution = resolveRelativeDateRange(relativeReference??startDate, selection, thisWeekDeadlineWeekday);
      if (resolution.ok) {
        if (selectedDefinition.resolverConfig.kind === 'weekRemainder' && holidayPreferences.adjustThisWeekDeadline) {
          const provider = selectHolidayProvider(holidayProvider, holidayPreferences.calendarId);
          const adjusted = adjustThisWeekDeadline(resolution.value, holidayPreferences,
            provider.list(resolution.value.referenceDate, resolution.value.endDate));
          if (adjusted.ok) relativeResolution = adjusted.value;
          else if(recurrenceDraft.preset!=='none'||occurrenceEditData?.series.event.recurrenceRule?.version===2)relativeResolution={...resolution.value,parameterSnapshot:{...resolution.value.parameterSnapshot,deadlineAdjustment:{version:1,calendarId:holidayPreferences.calendarId,unadjustedDeadlineDate:resolution.value.endDate},deadlineWarning:adjusted.error}};
          else relativeDateError = adjusted.error === 'noBusinessDay'
            ? '対象となる平日がありません。基準日または締切設定を見直してください。'
            : 'この期間の祝日情報に対応していないため、締切を確定できません。';
        } else relativeResolution = resolution.value;
      }
    }
  }
  const relativeDatePreview = relativeResolution === null
    ? null
    : `${formatEditorDate(relativeResolution.startDate)}〜${formatEditorDate(relativeResolution.endDate)}${relativeResolution.parameterSnapshot.deadlineWarning ? '（締切を要確認）' : relativeResolution.parameterSnapshot.deadlineAdjustment === undefined ? '' : relativeResolution.parameterSnapshot.deadlineAdjustment.calendarId === 'none' ? '（土日を考慮した締切）' : '（土日祝を考慮した締切）'}`;

  const relativeEnvironment:RelativeRecurrenceEnvironment={definitions,holidayProvider};
  const relativeContext=relativeResolution?{version:1 as const,referenceDate:relativeResolution.referenceDate,periodAnchorDate:relativeResolution.periodAnchorDate,parameterSnapshot:relativeResolution.parameterSnapshot}:null;
  const sourceRelativeRule=occurrenceEditData?.series.event.recurrenceRule?.version===2?occurrenceEditData.series.event.recurrenceRule:null;
  const preservingSourceRule=sourceRelativeRule!==null&&!recurrenceEdited;
  const inheritedRule=sourceRelativeRule&&selectedDefinition&&relativeContext?inheritRelativeRecurrenceRule(sourceRelativeRule,selectedDefinition,relativeContext):null;
  const canInheritSource=isRelativeDefinition&&inheritedRule?.ok===true;
  const recurrenceDisplayDraft=preservingSourceRule&&isRelativeDefinition&&!canInheritSource
    ? {...recurrenceDraft,preset:'none' as const,frequency:selectedDefinition?.granularity==='month'?'monthly' as const:'weekly' as const}:recurrenceDraft;
  const relativeRule=preservingSourceRule?(canInheritSource?inheritedRule:{ok:true as const,value:null})
    :isRelativeDefinition&&selectedDefinition&&relativeContext?buildRelativeRecurrenceRule(recurrenceDraft,selectedDefinition,relativeContext):null;
  const occurrenceRecurrenceNotice=preservingSourceRule&&!canInheritSource?'この回の日時だけを変更できます。これ以降・全体を変更する場合は、新しい日時に対応する繰り返しを選び直してください。':null;
  const relativePreview:string[]=[];
  if(relativeRule?.ok&&relativeRule.value&&relativeResolution&&relativeContext&&selectedDefinition){
    const event={id:'preview',calendarId:calendarId??'',title:'',temporalType:'fuzzy' as const,temporalDefinitionId:selectedDefinition.id,anchorDate:relativeResolution.startDate,endDate:relativeResolution.endDate,resolutionContext:relativeContext,recurrenceRule:relativeRule.value,location:null,noteDocument:null,colorId:null,createdAt:'',updatedAt:'',createdTimeZoneId:'UTC'};
    for(let index=0;index<3;index++){
      const period=relativePeriodAt(event,index);if(!period)break;
      try{const resolved=resolveRelativeOccurrence(event,period,relativeEnvironment);if(resolved.temporalType==='fuzzy')relativePreview.push(`${formatEditorDate(resolved.anchorDate)}〜${formatEditorDate(resolved.endDate)}${deadlineWarningLabel(resolved)?'・締切を要確認':''}`);}catch{break;}
    }
  }
  const durationBlocked = editorTab === 'exact' && !isAllDay && initialDuration.status !== 'ready';

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const expectedDefinitionFor = useCallback((event: EventAggregate['event']): DefinitionExpectation | undefined => {
    if (event.temporalType !== 'fuzzy') return undefined;
    const expected = occurrenceEditData?.definitionExpectations?.find(item => item.id === event.temporalDefinitionId);
    if (expected) return expected;
    const definition = definitions.find(item => item.id === event.temporalDefinitionId);
    return definition ? { id: definition.id, token: temporalDefinitionToken(definition) } : undefined;
  }, [definitions, occurrenceEditData]);
  const recoverTemporalConflict = useCallback(async () => {
    try {
      const occurrence=eventId&&occurrenceDate?await events.getOccurrenceEditData({seriesEventId:eventId,originalOccurrenceDate:occurrenceDate}):null;
      let latest = await temporalDefinitions.listEnabled(calendarId ?? '');
      const ids=[selectedDefinitionId,occurrence?.series.event.temporalType==='fuzzy'?occurrence.series.event.temporalDefinitionId:null];
      for(const id of ids){if(id&&!latest.some(item=>item.id===id)){const definition=await temporalDefinitions.getById(id);if(definition)latest=[...latest,definition];}}
      let aggregate = eventId && occurrenceDate === undefined ? await events.getById(eventId) : null;
      if (occurrence && occurrenceDate) aggregate = getEditableOccurrenceAggregate(occurrence, occurrenceDate);
      if (!mountedRef.current) return;
      setDefinitions(latest);
      if (aggregate) setExistingAggregate(aggregate);
      if(occurrence)setOccurrenceEditData(occurrence);
      setPendingAggregate(null); updateScopeRequest(null);
      setSaveError('時間表現が更新されました。入力内容は保持しています。期間を再確認して保存してください。');
    } catch {
      if (mountedRef.current) setSaveError('時間表現を再読み込みできませんでした。入力内容を保持しています。再度保存してお試しください。');
    }
  }, [calendarId, eventId, events, occurrenceDate, selectedDefinitionId, temporalDefinitions,updateScopeRequest]);

  const savePrepared = useCallback(async (capturedNote:EventNoteDocumentV1|null): Promise<boolean> => {
    if (status !== 'ready' || durationBlocked || updatingPolicy) return false;
    clearErrors();
    if (relativeDateError !== null) { setDateError(relativeDateError); return false; }
    const existingEvent = existingAggregate?.event;
    const contextForSave=relativeResolution?{version:1 as const,referenceDate:relativeResolution.referenceDate,periodAnchorDate:relativeResolution.periodAnchorDate,parameterSnapshot:relativeResolution.parameterSnapshot}:null;
    const recurrence = preservingSourceRule ? {ok:true as const,value:null} : isRelativeDefinition
      ? selectedDefinition&&contextForSave?buildRelativeRecurrenceRule(recurrenceDraft,selectedDefinition,contextForSave):recurrenceDraft.preset==='none'?{ok:true as const,value:null}:{ok:false as const,error:{field:'recurrence',message:'対象期間を確認してください'}}
      : buildRecurrenceRule(recurrenceDraft, startDate);
    if (!recurrence.ok) { setRecurrenceError(recurrence.error.message); return false; }

    const base = {
      calendarId: existingEvent?.calendarId ?? calendarId ?? '',
      title: title.trim(),
      anchorDate: relativeResolution?.startDate ?? startDate,
      createdTimeZoneId: existingEvent?.createdTimeZoneId ?? getTimeZoneId(),
      location: optionalText(location),
      noteDocument:capturedNote,
      colorId,
      recurrenceRule: recurrence.value,
    };
    let draft: EventDraft;
    if (temporalType === 'fuzzy') {
      if (selectedDefinitionId === null) { setSaveError('時間帯を選択してください。'); return false; }
      if (isRelativeDefinition && relativeResolution === null) { setDateError('相対日付の期間を確認してください'); return false; }
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
    } else if (temporalType === 'allDay') {
      draft = { ...base, temporalType, endDate: allDayEndDate };
    } else {
      const duration = exactDurationType === 'fixed'
        ? getEditorExactDuration({ startDate, startTime, endDate, endTime }, null)
        : { ok: true as const, value: { type: exactDurationType } };
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
    if (reminderDefaults.status !== 'ready') { setReminderError('通知の初期値を読み込んでから保存してください'); return false; }
    if (reminders.some(reminder => !timingIsCompatible(getReminderTiming(reminder), parsedEvent.value, definitions))) {
      setReminderError('この予定では使えない通知があります。基準を変更・削除するか、初期値に置き換えてください。'); return false;
    }
    const builtReminders = buildEventReminders(parsedEvent.value.id, reminders);
    if (!builtReminders.ok) { setReminderError(builtReminders.error.message); return false; }

    try {
      const aggregate = { event: parsedEvent.value, reminders: builtReminders.value };
      if (existingEvent === undefined) {
        const expected = expectedDefinitionFor(aggregate.event);
        if (expected) await events.create(aggregate, expected); else await events.create(aggregate);
      }
      else if (occurrenceEditData !== null && existingAggregate !== null) {
        if(preservingSourceRule&&!canInheritSource){
          setPendingAggregate(aggregate);
          updateScopeRequest({operation:'save',options:[{scope:'occurrence',label:'この予定'}],needsExceptionResetConfirmation:false});
          return false;
        }
        const scopedCandidate=preservingSourceRule&&inheritedRule?.ok?{...aggregate,event:{...aggregate.event,recurrenceRule:inheritedRule.value}}:aggregate;
        setPendingAggregate(scopedCandidate);
        const scopedSubmitted=buildSeriesScopedAggregate({series:occurrenceEditData.series,occurrenceDate:occurrenceDate!,displayed:existingAggregate,submitted:scopedCandidate,environment:{definitions,holidayProvider}});
        const recurrenceChanged=recurrenceStructureChanged(occurrenceEditData.series.event.recurrenceRule,scopedCandidate.event.recurrenceRule);
        const request=createScopeRequest('save',recurrenceChanged,relativeMeaningChanged(occurrenceEditData.series.event,scopedSubmitted.event));
        if(occurrenceEditData.series.event.recurrenceRule?.version===2||aggregate.event.recurrenceRule?.version===2){
          const environment={definitions,holidayProvider};
          const submitted=scopedSubmitted;
          const common={series:occurrenceEditData.series,boundaryDate:occurrenceDate!,submitted,exceptions:occurrenceEditData.exceptions,now:timestamp,environment};
          const plans={following:planFollowingMutation({...common,createSeriesId:()=> 'relative-preview'}),series:planSeriesMutation(common)};
          const previews:Partial<Record<RecurrenceEditScope,readonly string[]>>={};
          for(const scope of ['following','series'] as const){
            const next=plans[scope].nextSeries?.event;if(!next)continue;
            const lines=[`基準の開始日: ${formatEditorDate(scope==='following'?existingAggregate.event.anchorDate:occurrenceEditData.series.event.anchorDate)}`];
            if(next.recurrenceRule?.version===2){for(let index=0;index<3;index++){
              const period=relativePeriodAt(next,index);if(!period)break;
              try{const resolved=resolveRelativeOccurrence(next,period,environment);if(resolved.temporalType==='fuzzy')lines.push(`${index===0?'初回':`次の${index}回目`}: ${formatEditorDate(resolved.anchorDate)}〜${formatEditorDate(resolved.endDate)}${deadlineWarningLabel(resolved)?'・締切を要確認':''}`);}catch{break;}
            }}else lines.push(`初回: ${formatEditorDate(next.anchorDate)}${next.temporalType!=='exact'?`〜${formatEditorDate(next.endDate)}`:''}`);
            lines.push(relativeEndDescription(next.recurrenceRule));previews[scope]=lines;
          }
          updateScopeRequest({...request,relativePreviews:previews});
        }else updateScopeRequest(request);
        return false;
      } else {
        const expected = expectedDefinitionFor(aggregate.event);
        if (expected) await events.update(aggregate, expected); else await events.update(aggregate);
      }
      savedLocation.current = { id: aggregate.event.id, date: aggregate.event.anchorDate };
      return true;
    } catch (error) {
      if (error instanceof TemporalConflictError) { await recoverTemporalConflict(); return false; }
      setSaveError('保存できませんでした。もう一度お試しください。');
      return false;
    }
  }, [updateScopeRequest,preservingSourceRule,canInheritSource,inheritedRule,expectedDefinitionFor, recoverTemporalConflict, updatingPolicy,allDayEndDate, durationBlocked, exactDurationType, calendarId, clearErrors, colorId, endDate, endTime, events, existingAggregate,
    getTimeZoneId, isRelativeDefinition, location, newEventId, now, recurrenceDraft, reminders, reminderDefaults.status,
    definitions, holidayProvider, occurrenceDate, occurrenceEditData, relativeResolution, relativeDateError, selectedDefinition, selectedDefinitionId,
    startDate, startTime, status, temporalType, title]);

  const save=useCallback(async():Promise<boolean>=>{
    if(operationRef.current||scopeActiveRef.current||noteSession.getSnapshot().pending||status!=='ready'||updatingPolicy)return false;
    savedLocation.current = null;
    operationRef.current=true;setIsSaving(true);
    try{
      const document=await noteSession.capture();
      if(!mountedRef.current)return false;
      const saved=await savePrepared(document);
      if(saved)completedRef.current=true;
      return saved;
    }catch{if(mountedRef.current)setSaveError('メモの内容を確認できませんでした。再度保存をお試しください。');return false;}
    finally{if(!scopeActiveRef.current)noteSession.release();operationRef.current=false;if(mountedRef.current)setIsSaving(false);}
  },[noteSession,savePrepared,status,updatingPolicy]);

  const recurrenceKey = recurrenceDraft.preset === 'custom' ? [
    recurrenceDraft.frequency,
    recurrenceDraft.intervalText,
    recurrenceDraft.frequency === 'weekly' ? recurrenceDraft.weekdays : null,
    recurrenceDraft.endType,
    recurrenceDraft.endType === 'until' ? recurrenceDraft.untilDate
      : recurrenceDraft.endType === 'count' ? recurrenceDraft.countText : null,
  ] : recurrenceDraft.preset;
  const draftKey = JSON.stringify([
    title, location, colorId, temporalType, startDate, recurrenceKey,
    reminders.map(({ timing, minutesBefore }) => timing ?? minutesBefore),
    temporalType === 'fuzzy'
      ? [selectedDefinitionId, relativeReference, deadlinePolicyUpdated]
      : temporalType === 'allDay' ? allDayEndDate
        : [startTime, exactDurationType, exactDurationType === 'fixed' ? [endDate, endTime] : null],
  ]);
  // 自動適用される初期値を編集と区別し、最初の入力前の値に戻した場合も確認を出さない。
  const markDraftEdit = () => {
    draftBaselineRef.current ??= draftKey;
  };

  const confirmLeave = useCallback(async (): Promise<boolean> => {
    if (completedRef.current) return true;
    if (scopeActiveRef.current || operationRef.current) return false;
    const draftChanged = draftBaselineRef.current !== null && draftBaselineRef.current !== draftKey;
    const checkNote = noteSession.needsLeaveSnapshot();
    if (!draftChanged && !checkNote) return true;

    operationRef.current = true;
    setIsCheckingLeave(true);
    try {
      let noteChanged = false;
      let noteUnconfirmed = false;
      if (checkNote) {
        try {
          noteChanged = !areEventNotesEqual(await noteSession.capture(), loadedNoteRef.current);
        } catch {
          noteUnconfirmed = true;
        }
      }
      if (!mountedRef.current) return false;
      if (!draftChanged && !noteChanged && !noteUnconfirmed) return true;
      return await new Promise<boolean>((resolve) => Alert.alert(
        '変更を破棄しますか？',
        noteUnconfirmed ? 'メモの最新の内容を確認できませんでした。' : '保存していない変更があります。',
        [
          { text: '編集を続ける', style: 'cancel', onPress: () => resolve(false) },
          { text: '破棄して戻る', style: 'destructive', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      ));
    } finally {
      if (checkNote) noteSession.release();
      operationRef.current = false;
      if (mountedRef.current) setIsCheckingLeave(false);
    }
  }, [draftKey, noteSession]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (operationRef.current || existingAggregate === null) return false;
    if (occurrenceEditData !== null) {
      updateScopeRequest(createScopeRequest('delete', false));
      return false;
    }
    operationRef.current = true;
    setIsDeleting(true);
    setSaveError(null);
    try {
      await events.delete(existingAggregate.event.id);
      completedRef.current=true;
      return true;
    } catch {
      setSaveError('削除できませんでした。もう一度お試しください。');
      return false;
    } finally {
      operationRef.current = false;
      setIsDeleting(false);
    }
  }, [events, existingAggregate, occurrenceEditData,updateScopeRequest]);

  const cancelScope = useCallback(() => {
    updateScopeRequest(null);
    setPendingAggregate(null);
  }, [updateScopeRequest]);

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
        const seriesOccurrence = buildSeriesScopedAggregate({
          series: occurrenceEditData.series,
          occurrenceDate,
          environment:{definitions,holidayProvider},
          displayed: pendingAggregate,
          submitted: pendingAggregate,
        });
        const overrideFields = getChangedEventFields(seriesOccurrence, pendingAggregate)
          .filter((field): field is EventOverrideField => field !== 'recurrence');
        const replacementId = occurrenceEditData.replacement?.event.id ?? newEventId;
        await events.saveOccurrenceException({
          identity,
          expectedDefinition: expectedDefinitionFor(pendingAggregate.event),
          ...(expectedDefinitionFor(occurrenceEditData.series.event)?{expectedDefinitions:[expectedDefinitionFor(occurrenceEditData.series.event)!]}:{}),
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
        savedLocation.current = { id: identity.seriesEventId, date: pendingAggregate.event.anchorDate };
      } else {
        const editorAggregate = pendingAggregate ?? existingAggregate;
        const submitted = buildSeriesScopedAggregate({
          series: occurrenceEditData.series,
          occurrenceDate,
          environment:{definitions,holidayProvider},
          displayed: existingAggregate,
          submitted: editorAggregate,
        });
        let plan = scope === 'following'
          ? planFollowingMutation({
            environment:{definitions,holidayProvider},
            series: occurrenceEditData.series,
            boundaryDate: occurrenceDate,
            submitted,
            exceptions: occurrenceEditData.exceptions,
            createSeriesId: createId,
            now: now(),
          })
          : planSeriesMutation({
            environment:{definitions,holidayProvider},
            series: occurrenceEditData.series,
            boundaryDate: occurrenceDate,
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
            removePreviousSeries: scope === 'series' || plan.removePreviousSeries,
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
          ...(expectedDefinitionFor(occurrenceEditData.series.event)?{expectedDefinitions:[expectedDefinitionFor(occurrenceEditData.series.event)!]}:{}),
          plan,
          ...(!deleting && pendingAggregate ? { expectedDefinition: expectedDefinitionFor(pendingAggregate.event) } : {}),
        });
        if (!deleting && plan.nextSeries) {
          savedLocation.current = { id: plan.nextSeries.event.id, date: editorAggregate.event.anchorDate };
        }
      }
      updateScopeRequest(null);
      setPendingAggregate(null);
      completedRef.current=true;
      return true;
    } catch (error) {
      if (error instanceof TemporalConflictError) { await recoverTemporalConflict(); return false; }
      setSaveError(deleting
        ? '削除できませんでした。もう一度お試しください。'
        : '保存できませんでした。もう一度お試しください。');
      return false;
    } finally {
      operationRef.current = false;
      setIsSaving(false);
      setIsDeleting(false);
    }
  }, [updateScopeRequest,definitions,holidayProvider,expectedDefinitionFor, recoverTemporalConflict, createId, events, existingAggregate, newEventId, now, occurrenceDate,
    occurrenceEditData, pendingAggregate, scopeRequest]);

  return {
    status,
    mode: existingAggregate === null ? 'create' : 'edit',
    title,
    editorTab,
    isAllDay,
    isDateEditable: !isRelativeDefinition,
    isRecurrenceEditable: !isRelativeDefinition || selectedDefinition!==null,
    relativeDatePreview,
    relativeDateRange: relativeResolution,
    occurrenceRecurrenceNotice,
    ...(isRelativeDefinition&&selectedDefinition?{relativeRecurrence:{frequency:selectedDefinition.granularity==='month'?'monthly' as const:'weekly' as const,periodAnchorDate:relativeContext?.periodAnchorDate??startDate,label:`${recurrenceDisplayDraft.preset==='none'?'繰り返しなし':recurrenceDisplayDraft.preset==='custom'?`${recurrenceDisplayDraft.intervalText}${selectedDefinition.granularity==='week'?'週':'か月'}ごと`:selectedDefinition.granularity==='week'?'毎週':'毎月'}・${selectedDefinition.label}`,preview:relativePreview,notice:relativeSelectionNotice,policyDescription:selectedDefinition.key==='this_week'&&relativeContext?`締切：${relativeContext.parameterSnapshot.thisWeekDeadlineWeekday===7?'日曜日':relativeContext.parameterSnapshot.thisWeekDeadlineWeekday===6?'土曜日':'金曜日'}、${relativeContext.parameterSnapshot.deadlineAdjustment?'土日を考慮'+(relativeContext.parameterSnapshot.deadlineAdjustment.calendarId==='jp'?'・日本の祝日を考慮':''):'休日調整なし'}（保存する条件）`:null,updatePolicy:async()=>{
      markDraftEdit();
      if(operationRef.current)return;operationRef.current=true;setUpdatingPolicy(true);
      try{const [weekday,prefs]=await Promise.all([settings.getThisWeekDeadlineWeekday(),settings.getHolidayPreferences()]);if(!mountedRef.current)return;setThisWeekDeadlineWeekday(weekday);setHolidayPreferences(prefs);setDeadlinePolicyUpdated(true);setTemporalReselected(true);setRelativeSelectionNotice('締切条件を現在の設定に更新しました。期間と変更範囲を確認して保存してください。');}catch{if(mountedRef.current)setSaveError('締切条件を読み込めませんでした。入力内容を保持しています。');}finally{operationRef.current=false;if(mountedRef.current)setUpdatingPolicy(false);}
    }}}:{}),
    startDate,
    startTime,
    endDate: isAllDay ? allDayEndDate : endDate,
    endTime,
    exactDurationType,
    exactDurationStatus: initialDuration.status,
    retryExactDuration: initialDuration.retry,
    setExactDurationType: (...args) => { markDraftEdit(); setExactDurationType(...args); },
    definitions,
    selectedDefinitionId,
    calendarName,
    calendarColorId,
    colorId,
    location,
    noteDocument,
    noteSession,
    isBusy:isSaving||isDeleting||isCheckingLeave||noteSnapshot.pending,
    confirmLeave,
    canLeave:()=>completedRef.current,
    noteSummary: projectEventNoteToPlainText(noteDocument) ?? '',
    noteLinkError,
    recurrenceDraft:recurrenceDisplayDraft,
    reminders,
    titleError,
    dateError: dateError ?? relativeDateError,
    endTimeError,
    recurrenceError: recurrenceError??(relativeRule&&!relativeRule.ok?relativeRule.error.message:null),
    reminderError,
    saveError,
    isSaving,
    isSaveDisabled: relativeDateError !== null || updatingPolicy || (relativeRule!==null&&!relativeRule.ok) || durationBlocked || reminderDefaults.status !== 'ready',
    reminderCategory,
    allowReminderEnd: reminderCategory !== 'exact' || exactDurationType === 'fixed',
    notificationDefaultStatus: reminderDefaults.status,
    retryNotificationDefaults: reminderDefaults.retry,
    resetReminderDefaults: () => { markDraftEdit(); void reminderDefaults.reset().then(ok => { if (ok !== null) setReminderError(ok ? null : '通知の初期値を読み込めませんでした。再試行してください。'); }); },
    updateReminder: (...args) => { markDraftEdit(); updateReminder(...args); },
    isDeleting,
    usesRecurrenceScope: occurrenceEditData !== null,
    scopeRequest,
    setTitle: (...args) => { markDraftEdit(); setTitle(...args); },
    setEditorTab: (value) => {
      if (existingAggregate !== null && value !== editorTab) markDraftEdit();
      setEditorTab(value);
    },
    setAllDay: (...args) => { markDraftEdit(); setAllDay(...args); },
    setStartDate: (...args) => { markDraftEdit(); setStartDate(...args); },
    setEndDate: (...args) => { markDraftEdit(); setEndDate(...args); },
    setStartTime: (...args) => { markDraftEdit(); setStartTime(...args); },
    setEndTime: (...args) => { markDraftEdit(); setEndTime(...args); },
    selectDefinition: (...args) => { markDraftEdit(); selectDefinition(...args); },
    setColorId: (...args) => { markDraftEdit(); setColorId(...args); },
    setLocation: (...args) => { markDraftEdit(); setLocation(...args); },
    openNoteLink,
    setRecurrencePreset: (...args) => { markDraftEdit(); setRecurrencePreset(...args); },
    setRecurrenceFrequency: (...args) => { markDraftEdit(); setRecurrenceFrequency(...args); },
    setRecurrenceIntervalText: (...args) => { markDraftEdit(); setRecurrenceIntervalText(...args); },
    toggleRecurrenceWeekday: (...args) => { markDraftEdit(); toggleRecurrenceWeekday(...args); },
    setRecurrenceEndType: (...args) => { markDraftEdit(); setRecurrenceEndType(...args); },
    setRecurrenceUntilDate: (...args) => { markDraftEdit(); setRecurrenceUntilDate(...args); },
    setRecurrenceCountText: (...args) => { markDraftEdit(); setRecurrenceCountText(...args); },
    addReminder: (...args) => { markDraftEdit(); addReminder(...args); },
    removeReminder: (...args) => { markDraftEdit(); removeReminder(...args); },
    moveReminder: (...args) => { markDraftEdit(); moveReminder(...args); },
    retry,
    save,
    remove,
    selectScope,
    getSavedEventLocation,
    cancelScope,
  };
}
