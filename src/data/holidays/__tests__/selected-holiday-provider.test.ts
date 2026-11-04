import { selectHolidayProvider } from '../selected-holiday-provider';
import { JapaneseHolidayProvider } from '../japanese-holiday-provider';

describe('祝日カレンダーの選択', () => {
  it('無効化した場合は対応年外でも既知の空集合を返す', () => {
    expect(selectHolidayProvider(new JapaneseHolidayProvider(), 'none').list('2051-01-01', '2051-01-31'))
      .toEqual({ status: 'available', holidays: [] });
  });
  it.each([['2026-05-06', '振替休日'], ['2026-09-22', '国民の休日']])('日本の%sを休日として扱う', (date) => {
    expect(selectHolidayProvider(new JapaneseHolidayProvider(), 'jp').list(date, date))
      .toMatchObject({ status: 'available', holidays: [expect.objectContaining({ date })] });
  });
});
