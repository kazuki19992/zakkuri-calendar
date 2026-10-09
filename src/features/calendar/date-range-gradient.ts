import { differenceInCalendarDays, parseISO } from 'date-fns';

export type DateRangeOpacityStop = Readonly<{ offset: number; opacity: number }>;

const round = (value: number): number => Math.round(value * 1_000_000) / 1_000_000;

function opacityAt(position: number, fadeInRatio: number, fadeOutRatio: number): number {
  if (fadeInRatio > 0 && position < fadeInRatio) return position / fadeInRatio;
  const fadeOutStart = 1 - fadeOutRatio;
  if (fadeOutRatio > 0 && position > fadeOutStart) return (1 - position) / fadeOutRatio;
  return 1;
}

/** 保存済み期間を基準に、画面内へ切り出した帯の透明度を返す。 */
export function createDateRangeOpacityStops(input: Readonly<{
  rangeStartDate: string;
  rangeThroughDate: string;
  clipStartDate: string;
  clipThroughDate: string;
  fadeInRatio: number;
  fadeOutRatio: number;
}>): readonly DateRangeOpacityStop[] {
  const totalDays = differenceInCalendarDays(parseISO(input.rangeThroughDate), parseISO(input.rangeStartDate)) + 1;
  if (totalDays <= 1 || (input.fadeInRatio === 0 && input.fadeOutRatio === 0)) {
    return [{ offset: 0, opacity: 1 }, { offset: 1, opacity: 1 }];
  }
  const clipStart = differenceInCalendarDays(parseISO(input.clipStartDate), parseISO(input.rangeStartDate)) / totalDays;
  const clipEnd = (differenceInCalendarDays(parseISO(input.clipThroughDate), parseISO(input.rangeStartDate)) + 1) / totalDays;
  const positions = [clipStart, clipEnd];
  if (input.fadeInRatio > clipStart && input.fadeInRatio < clipEnd) positions.push(input.fadeInRatio);
  const fadeOutStart = 1 - input.fadeOutRatio;
  if (fadeOutStart > clipStart && fadeOutStart < clipEnd) positions.push(fadeOutStart);
  return [...new Set(positions)].sort((a, b) => a - b).map((position) => ({
    offset: round((position - clipStart) / (clipEnd - clipStart)),
    opacity: round(opacityAt(position, input.fadeInRatio, input.fadeOutRatio)),
  }));
}
