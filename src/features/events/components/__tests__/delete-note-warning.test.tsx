import {Alert} from 'react-native';
import {render,fireEvent} from '@testing-library/react-native';
import {DeleteEventButton} from '../delete-event-button';
import {RecurrenceScopeDialog} from '../recurrence-scope-dialog';
import {createScopeRequest} from '../../recurrence-edit-model';
jest.mock('@/global.css',()=>({}));
it('予定削除の確認で未保存のメモも破棄されることを示す',async()=>{const alert=jest.spyOn(Alert,'alert').mockImplementation(()=>{});const view=await render(<DeleteEventButton title="予定" disabled={false} onDelete={jest.fn()}/>);await fireEvent.press(view.getByLabelText('予定を削除'));expect(alert.mock.calls[0][1]).toContain('保存していないメモ');alert.mockRestore();});
it('範囲を選んで削除する場合も未保存メモの破棄を説明する',async()=>{const view=await render(<RecurrenceScopeDialog request={createScopeRequest('delete',false)} busy={false} onSelect={jest.fn()} onCancel={jest.fn()}/>);expect(view.getByText('保存していないメモの変更も破棄されます。')).toBeTruthy();});
