import { render } from '@testing-library/react-native';
import type { EventEditorState } from '../../hooks/use-event-editor';
import { EventEditorScreen } from '../event-editor-screen';

jest.mock('@/global.css', () => ({}));
jest.mock('@expo/ui/community/datetime-picker', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { __esModule: true, default: View };
});

const state: EventEditorState = {
  status: 'ready', mode: 'create', title: '', anchorDate: '2026-09-09', temporalType: 'exact', startTime: '09:30', endTime: '11:45',
  definitions: [], selectedDefinitionId: null, titleError: null, dateError: null, endTimeError: null, saveError: null, isSaving: false, isDeleting: false,
  setTitle: jest.fn(), setAnchorDate: jest.fn(), setTemporalType: jest.fn(), setStartTime: jest.fn(), setEndTime: jest.fn(), selectDefinition: jest.fn(), retry: jest.fn(), save: jest.fn(), remove: jest.fn(),
};

describe('予定編集フォーム', () => {
  it('正確な予定では開始時刻と終了時刻のネイティブピッカーを表示する', async () => {
    const view = await render(<EventEditorScreen state={state} onSave={jest.fn()} onDelete={jest.fn()} onCancel={jest.fn()} />);

    expect(view.getByText('予定を追加')).toBeOnTheScreen();
    expect(view.getByTestId('event-editor.date-picker')).toBeOnTheScreen();
    expect(view.getByTestId('event-editor.start-time-picker')).toBeOnTheScreen();
    expect(view.getByTestId('event-editor.end-time-picker')).toBeOnTheScreen();
    expect(view.queryByLabelText('予定を削除')).toBeNull();
  });
});
