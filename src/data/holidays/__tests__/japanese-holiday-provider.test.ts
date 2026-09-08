import { JapaneseHolidayProvider } from '../japanese-holiday-provider';

describe('日本の祝日provider', () => {
  it('元日と成人の日を日本語名付きで返す', () => {
    const result = new JapaneseHolidayProvider().list('2026-01-01', '2026-01-12');

    expect(result).toEqual({
      status: 'available',
      holidays: expect.arrayContaining([
        expect.objectContaining({ date: '2026-01-01', name: '元日' }),
        expect.objectContaining({ date: '2026-01-12', name: '成人の日' }),
      ]),
    });
  });

  it('収録範囲外を通常日として返さない', () => {
    expect(new JapaneseHolidayProvider().list('2051-01-01', '2051-01-31')).toEqual({
      status: 'unsupported',
    });
  });
});
