import {InlineNoteSession} from '../../event-note/inline-note-session';
import { fireEvent, render, userEvent, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import type { EventEditorState } from '../../hooks/use-event-editor';
import { EventEditorScreen } from '../event-editor-screen';

jest.mock('@/global.css', () => ({}));
jest.mock('../../components/formatted-note-editor/formatted-note-editor',()=>({FormattedNoteEditor:()=>null}));
jest.mock('@expo/ui/community/datetime-picker', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { __esModule: true, default: View };
});

const state: EventEditorState = {
  noteSession:new InlineNoteSession(),isBusy:false,confirmLeave:jest.fn(),canLeave:()=>false,
  exactDurationType: 'fixed', exactDurationStatus: 'ready', setExactDurationType: jest.fn(), retryExactDuration: jest.fn(),
  reminderCategory: 'exact', allowReminderEnd: true, notificationDefaultStatus: 'ready', retryNotificationDefaults: jest.fn(), resetReminderDefaults: jest.fn(), updateReminder: jest.fn(),
  status: 'ready', mode: 'create', title: '', editorTab: 'exact', isAllDay: false, isDateEditable: true,
  isRecurrenceEditable: true, relativeDatePreview: null, relativeDateRange: null,
  startDate: '2026-09-25', startTime: '09:30', endDate: '2026-09-26', endTime: '11:45',
  definitions: [], selectedDefinitionId: null, calendarName: 'マイカレンダー', calendarColorId: 'blue',
  colorId: null, location: '', noteDocument: null, noteSummary: '',
  noteLinkError: null,
  recurrenceDraft: { preset: 'none', frequency: 'weekly', intervalText: '1', weekdays: [5], endType: 'never', untilDate: '2026-09-25', countText: '1' },
  reminders: [], titleError: null, dateError: null, endTimeError: null, recurrenceError: null, reminderError: null, saveError: null,
  isSaving: false, isSaveDisabled: false, isDeleting: false, usesRecurrenceScope: false, scopeRequest: null,
  setTitle: jest.fn(), setEditorTab: jest.fn(), setAllDay: jest.fn(), setStartDate: jest.fn(), setEndDate: jest.fn(),
  setStartTime: jest.fn(), setEndTime: jest.fn(), selectDefinition: jest.fn(), setColorId: jest.fn(), setLocation: jest.fn(),
  openNoteLink: jest.fn(),
  setRecurrencePreset: jest.fn(), setRecurrenceFrequency: jest.fn(), setRecurrenceIntervalText: jest.fn(), toggleRecurrenceWeekday: jest.fn(),
  setRecurrenceEndType: jest.fn(), setRecurrenceUntilDate: jest.fn(), setRecurrenceCountText: jest.fn(),
  addReminder: jest.fn(), removeReminder: jest.fn(), moveReminder: jest.fn(), retry: jest.fn(), save: jest.fn(), remove: jest.fn(),
  selectScope: jest.fn(), cancelScope: jest.fn(),
};

describe('予定編集フォーム', () => {
  it('調整不能の期間では保存を無効化し日時エラーを表示する', async () => {
    const view = await render(<EventEditorScreen state={{ ...state, isSaveDisabled: true, dateError: '対象となる平日がありません' }} onSave={jest.fn()} onDelete={jest.fn()} onCancel={jest.fn()} />);
    expect(view.getByRole('button', { name: '保存' })).toBeDisabled();
    expect(view.getByText('対象となる平日がありません')).toBeOnTheScreen();
  });
  it('設計順の作成フォームと日本語日時を表示する', async () => {
    const view = await render(<EventEditorScreen state={state} onSave={jest.fn()} onDelete={jest.fn()} onCancel={jest.fn()} />);

    expect(view.getByText('予定を追加')).toBeOnTheScreen();
    expect(view.getByText('9月25日（金）')).toBeOnTheScreen();
    expect(view.getByTestId('event-editor.tab-content')).toBeOnTheScreen();
    const labels = view.getAllByText(/開始時刻|^終了$|終了時刻/).map((element) => element.props.children);
    expect(labels).toEqual(['開始時刻', '終了', '終了時刻']);
    expect(view.getByLabelText('タイトル').props.autoFocus).toBe(true);
    expect(view.getByRole('button', { name: '保存' })).toBeDisabled();
    expect(view.queryByRole('button', { name: '詳細項目' })).toBeNull();
    expect(view.getByText('繰り返し')).toBeOnTheScreen();
    expect(view.queryByText('マイカレンダー')).toBeNull();
    expect(view.getByText('通知なし')).toBeOnTheScreen();
    expect(view.getByLabelText('メモエディタを読み込み中')).toBeOnTheScreen();
    expect(view.queryByText('完了')).toBeNull();
    expect(view.queryByLabelText('予定を削除')).toBeNull();
  });

  it('タブより下の全項目をひとまとめに横スライドする', async () => {
    const view = await render(<EventEditorScreen state={state} onSave={jest.fn()}
      onDelete={jest.fn()} onCancel={jest.fn()} />);
    const tabContent = view.getByTestId('event-editor.tab-content');

    expect(within(tabContent).getByText('日時')).toBeOnTheScreen();
    expect(within(tabContent).getByText('繰り返し')).toBeOnTheScreen();
    expect(within(tabContent).getByText('色')).toBeOnTheScreen();
    expect(within(tabContent).getByText('場所')).toBeOnTheScreen();
    expect(within(tabContent).getByText('通知')).toBeOnTheScreen();
    expect(within(tabContent).getByText('メモ')).toBeOnTheScreen();
  });

  it('フォーム外周を基準にタイトルと行ラベルの左端を揃える', async () => {
    const view = await render(<EventEditorScreen state={state} onSave={jest.fn()}
      onDelete={jest.fn()} onCancel={jest.fn()} />);

    expect(StyleSheet.flatten(view.getByLabelText('タイトル').props.style).paddingHorizontal)
      .toBe(0);
    expect(StyleSheet.flatten(view.getByText('開始日').parent?.props.style).paddingHorizontal)
      .toBe(0);
    expect(StyleSheet.flatten(view.getByText('パターン').parent?.props.style).paddingHorizontal)
      .toBe(0);
  });

  it('既存予定のタイトルは自動フォーカスせずタップで編集できる', async () => {
    const setTitle = jest.fn();
    const view = await render(<EventEditorScreen state={{ ...state, mode: 'edit', title: '定例', setTitle }}
      onSave={jest.fn()} onDelete={jest.fn()} onCancel={jest.fn()} />);
    const title = view.getByLabelText('タイトル');

    expect(title.props.autoFocus).toBe(false);
    await userEvent.setup().type(title, '会議');
    expect(setTitle).toHaveBeenCalled();
  });

  it('編集時はシリーズ全体の削除操作を表示する', async () => {
    const view = await render(<EventEditorScreen state={{ ...state, mode: 'edit', title: '定例', recurrenceDraft: { ...state.recurrenceDraft, preset: 'weekly' } }} onSave={jest.fn()} onDelete={jest.fn()} onCancel={jest.fn()} />);
    expect(view.getByLabelText('繰り返し予定を削除')).toBeOnTheScreen();
  });

  it.each(['fuzzy', 'exact'] as const)('%sタブの終日で開始日と終了日を表示する', async (editorTab) => {
    const setAllDay = jest.fn();
    const callbacks = { onSave: jest.fn(), onDelete: jest.fn(), onCancel: jest.fn() };
    const view = await render(<EventEditorScreen {...callbacks} state={{ ...state, editorTab, setAllDay }} />);

    const allDay = view.getByRole('switch', { name: '終日', checked: false });
    await fireEvent(allDay, 'valueChange', true);
    expect(setAllDay).toHaveBeenCalledWith(true);

    await view.rerender(<EventEditorScreen {...callbacks} state={{ ...state, editorTab, isAllDay: true, setAllDay }} />);
    expect(view.getByRole('switch', { name: '終日', checked: true })).toBeOnTheScreen();
    expect(view.getByText('開始日')).toBeOnTheScreen();
    expect(view.getByText('終了日')).toBeOnTheScreen();
    expect(view.getByTestId('event-editor.end-date-picker')).toBeOnTheScreen();
    expect(view.queryByText('開始時刻')).toBeNull();
    expect(view.queryByText('終了時刻')).toBeNull();
    expect(view.queryByText('ざっくり種別')).toBeNull();
    expect(view.queryByText('利用できる時間帯がありません')).toBeNull();
  });

  it('相対日付の解決期間と繰り返し不可理由を表示する', async () => {
    const definition: TemporalDefinition = {
      id: 'next-week', calendarId: 'personal-default', key: 'next_week', label: '来週前半', granularity: 'week',
      resolverConfig: { kind: 'week', selectionWeekOffset: 1, startWeekday: 1, endWeekday: 3 },
      fadeInRatio: 0.2, fadeOutRatio: 0.3, isSystem: true, isEnabled: true, sortOrder: 1,
      createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z',
    };
    const view = await render(<EventEditorScreen state={{
      ...state,
      editorTab: 'fuzzy',
      definitions: [definition], selectedDefinitionId: definition.id,
      isDateEditable: false,
      isRecurrenceEditable: false,
      relativeDatePreview: '10月5日（月）〜10月7日（水）',
      relativeDateRange: { startDate: '2026-10-05', endDate: '2026-10-07' },
    }} onSave={jest.fn()} onDelete={jest.fn()} onCancel={jest.fn()} />);

    expect(view.getByText('10月5日（月）〜10月7日（水）')).toBeOnTheScreen();
    const visualOnly = { includeHiddenElements: true };
    expect(view.getByTestId('event-editor.temporal-bar.next-week.relative', visualOnly)).toHaveProp('locations', [0, 0.2, 0.7, 1]);
    expect(view.getAllByTestId('event-editor.temporal-day-boundary', visualOnly)).toHaveLength(2);
    expect(view.getByText('複数日のざっくり予定では現在利用できません')).toBeOnTheScreen();
    expect(view.getByLabelText('日付 9月25日（金）').props.accessibilityState.disabled).toBe(true);
  });
});
