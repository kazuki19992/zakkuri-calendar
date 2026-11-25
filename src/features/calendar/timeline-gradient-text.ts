import { getContrastRatio } from '@/constants/event-colors';
import type { TimelineOpacityStop } from './timeline-layout';

function getOpacityAt(stops: readonly TimelineOpacityStop[], offset: number): number {
  const nextIndex = stops.findIndex((stop) => stop.offset >= offset);
  if (nextIndex <= 0) return (nextIndex === 0 ? stops[0] : stops.at(-1))?.opacity ?? 1;
  const { offset: from, opacity } = stops[nextIndex - 1];
  const next = stops[nextIndex];
  return opacity + (next.opacity - opacity) * (offset - from) / (next.offset - from);
}

export function getTimelineGradientTextStyle(
  stops: readonly TimelineOpacityStop[],
  offset: number,
  eventColor: string,
  theme: Readonly<{ text: string; background: string; calendarEventText: string }>,
) {
  const opacity = getOpacityAt(stops, offset);
  const composite = [1, 3, 5].map((index) => {
    const event = Number.parseInt(eventColor.slice(index, index + 2), 16);
    const background = Number.parseInt(theme.background.slice(index, index + 2), 16);
    return Math.round(background + (event - background) * opacity).toString(16).padStart(2, '0');
  }).join('');
  const prefersRegularText = getContrastRatio(theme.text, `#${composite}`) >= getContrastRatio(theme.calendarEventText, `#${composite}`);
  return { color: prefersRegularText ? theme.text : theme.calendarEventText };
}
