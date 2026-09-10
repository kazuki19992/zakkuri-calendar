import { HOUR_HEIGHT } from './timeline-layout';

export function resolveNearestTimelineHour(y: number, scale: number): string {
  const minutes = Math.round(y / (HOUR_HEIGHT * scale)) * 60;
  const hour = Math.max(0, Math.min(23, Math.round(minutes / 60)));
  return `${String(hour).padStart(2, '0')}:00`;
}
