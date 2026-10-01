import { createScopeRequest } from '../recurrence-edit-model';

describe('繰り返し編集の範囲選択', () => {
  test('内容変更では3つの範囲を表示する', () => {
    expect(createScopeRequest('save', false).options.map((item) => item.scope))
      .toEqual(['occurrence', 'following', 'series']);
  });

  test('規則変更では単発を除外して例外resetを明示する', () => {
    expect(createScopeRequest('save', true)).toMatchObject({
      needsExceptionResetConfirmation: true,
      options: [{ scope: 'following' }, { scope: 'series' }],
    });
  });

  test('削除では3つの削除範囲を返す', () => {
    expect(createScopeRequest('delete', false).options).toEqual([
      { scope: 'occurrence', label: 'この予定' },
      { scope: 'following', label: 'これ以降の予定' },
      { scope: 'series', label: 'すべての予定' },
    ]);
  });
});
