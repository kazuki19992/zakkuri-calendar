import { createDateRangeOpacityStops } from '../date-range-gradient';

describe('日付範囲のグラデーション', () => {
  it('週をまたいで切り出しても保存期間全体の濃度を引き継ぐ', () => {
    const firstWeek = createDateRangeOpacityStops({
      rangeStartDate: '2026-09-01', rangeThroughDate: '2026-09-10',
      clipStartDate: '2026-09-01', clipThroughDate: '2026-09-06',
      fadeInRatio: 1, fadeOutRatio: 0,
    });
    const secondWeek = createDateRangeOpacityStops({
      rangeStartDate: '2026-09-01', rangeThroughDate: '2026-09-10',
      clipStartDate: '2026-09-07', clipThroughDate: '2026-09-10',
      fadeInRatio: 1, fadeOutRatio: 0,
    });

    expect(firstWeek).toEqual([{ offset: 0, opacity: 0 }, { offset: 1, opacity: 0.6 }]);
    expect(secondWeek).toEqual([{ offset: 0, opacity: 0.6 }, { offset: 1, opacity: 1 }]);
  });

  it('単日とフェードなしの期間は不透明で表示する', () => {
    expect(createDateRangeOpacityStops({
      rangeStartDate: '2026-09-01', rangeThroughDate: '2026-09-01',
      clipStartDate: '2026-09-01', clipThroughDate: '2026-09-01',
      fadeInRatio: 1, fadeOutRatio: 0,
    })).toEqual([{ offset: 0, opacity: 1 }, { offset: 1, opacity: 1 }]);
  });
});
