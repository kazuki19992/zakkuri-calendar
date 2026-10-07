import { render, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { EventEditorState } from '../../hooks/use-event-editor';
import { EventEditorScreen } from '../event-editor-screen';

jest.mock('@/global.css', () => ({}));
jest.mock('@expo/ui/community/datetime-picker', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { __esModule: true, default: View };
});

const state: EventEditorState = {
  status: 'ready', mode: 'create', title: '', editorTab: 'exact', isAllDay: false, isDateEditable: true,
  isRecurrenceEditable: true, relativeDatePreview: null,
  startDate: '2026-09-25', startTime: '09:30', endDate: '2026-09-26', endTime: '11:45',
  definitions: [], selectedDefinitionId: null, calendarName: 'マイカレンダー', calendarColorId: 'blue',
  colorId: null, location: '', noteDocument: null, noteSummary: '', isNoteEditorOpen: false,
  noteLinkError: null,
  recurrenceDraft: { preset: 'none', frequency: 'weekly', intervalText: '1', weekdays: [5], endType: 'never', untilDate: '2026-09-25', countText: '1' },
  reminders: [], titleError: null, dateError: null, endTimeError: null, recurrenceError: null, reminderError: null, saveError: null,
  isSaving: false, isDeleting: false, usesRecurrenceScope: false, scopeRequest: null,
  setTitle: jest.fn(), setEditorTab: jest.fn(), setAllDay: jest.fn(), setStartDate: jest.fn(), setEndDate: jest.fn(),
  setStartTime: jest.fn(), setEndTime: jest.fn(), selectDefinition: jest.fn(), setColorId: jest.fn(), setLocation: jest.fn(),
  openNoteEditor: jest.fn(), cancelNoteEditor: jest.fn(), completeNoteEditor: jest.fn(), openNoteLink: jest.fn(),
  setRecurrencePreset: jest.fn(), setRecurrenceFrequency: jest.fn(), setRecurrenceIntervalText: jest.fn(), toggleRecurrenceWeekday: jest.fn(),
  setRecurrenceEndType: jest.fn(), setRecurrenceUntilDate: jest.fn(), setRecurrenceCountText: jest.fn(),
  addReminder: jest.fn(), removeReminder: jest.fn(), moveReminder: jest.fn(), retry: jest.fn(), save: jest.fn(), remove: jest.fn(),
  selectScope: jest.fn(), cancelScope: jest.fn(),
};

describe('予定編集フォーム', () => {
  it('設計順の作成フォームと日本語日時を表示する', async () => {
    const view = await render(<EventEditorScreen state={state} onSave={jest.fn()} onDelete={jest.fn()} onCancel={jest.fn()} />);

    expect(view.getByText('予定を追加')).toBeOnTheScreen();
    expect(view.getByText('9月25日（金）')).toBeOnTheScreen();
    expect(view.getByTestId('event-editor.tab-content')).toBeOnTheScreen();
    expect(view.getByText('繰り返し')).toBeOnTheScreen();
    expect(view.getByText('マイカレンダー')).toBeOnTheScreen();
    expect(view.getByText('設定は保存されますが、端末への通知はまだ行われません')).toBeOnTheScreen();
    expect(view.getByLabelText('メモを追加')).toBeOnTheScreen();
    expect(view.queryByLabelText('予定を削除')).toBeNull();
  });

  it('タブより下の全項目をひとまとめに横スライドする', async () => {
    const view = await render(<EventEditorScreen state={state} onSave={jest.fn()}
      onDelete={jest.fn()} onCancel={jest.fn()} />);
    const tabContent = view.getByTestId('event-editor.tab-content');

    expect(within(tabContent).getByText('日時')).toBeOnTheScreen();
    expect(within(tabContent).getByText('繰り返し')).toBeOnTheScreen();
    expect(within(tabContent).getByText('カレンダーと色')).toBeOnTheScreen();
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

  it('編集時はシリーズ全体の削除操作を表示する', async () => {
    const view = await render(<EventEditorScreen state={{ ...state, mode: 'edit', title: '定例', recurrenceDraft: { ...state.recurrenceDraft, preset: 'weekly' } }} onSave={jest.fn()} onDelete={jest.fn()} onCancel={jest.fn()} />);
    expect(view.getByLabelText('繰り返し予定を削除')).toBeOnTheScreen();
  });

  it('相対日付の解決期間と繰り返し不可理由を表示する', async () => {
    const view = await render(<EventEditorScreen state={{
      ...state,
      editorTab: 'fuzzy',
      isDateEditable: false,
      isRecurrenceEditable: false,
      relativeDatePreview: '10月5日（月）〜10月7日（水）',
    }} onSave={jest.fn()} onDelete={jest.fn()} onCancel={jest.fn()} />);

    expect(view.getByText('10月5日（月）〜10月7日（水）')).toBeOnTheScreen();
    expect(view.getByText('複数日のざっくり予定では現在利用できません')).toBeOnTheScreen();
    expect(view.getByLabelText('日付 9月25日（金）').props.accessibilityState.disabled).toBe(true);
  });
});
