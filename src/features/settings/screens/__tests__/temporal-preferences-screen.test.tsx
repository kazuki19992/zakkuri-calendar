import { fireEvent, render } from '@testing-library/react-native';
import { createStandardTemporalDefinitions } from '@/domain/temporal/standard-definitions';
import { TemporalPreferencesScreen } from '../temporal-preferences-screen';

jest.mock('@/global.css', () => ({}));

it('今週中の現在の締切曜日を表示し、時間表現の詳細を開ける', async () => {
  const items = createStandardTemporalDefinitions('personal-default', '2026-11-13');
  const onOpen = jest.fn();
  const screen = await render(<TemporalPreferencesScreen state={{ items, status: 'ready', reload: jest.fn() }}
    deadlineWeekday={7} onOpen={onOpen} />);
  expect(screen.queryByText('未定の表示時間')).toBeNull();
  const weeklyHeading = screen.getByRole('header', { name: '週の時間表現' });
  const weeklyFooter = screen.getByText('初期設定では「来週後半」に週末を含みます。');
  expect(weeklyHeading.parent?.children.includes(weeklyFooter)).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: '今週中、日曜日まで' }));
  expect(onOpen).toHaveBeenCalledWith(items.find((item) => item.key === 'this_week')!.id);
});
