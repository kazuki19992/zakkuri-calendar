import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { EventValidationError, ExactDuration } from './event';
import { isCalendarDate } from './month';
import type { Result } from '@/domain/shared/result';

const MINUTES_PER_DAY = 24 * 60;
const WALL_CLOCK_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function durationError(): Result<never, EventValidationError> {
  return {
    ok: false,
    error: { field: 'duration', message: '終了時刻を開始時刻と異なる時刻にしてください' },
  };
}

export function toMinutesOfDay(value: string): number | null {
  if (!WALL_CLOCK_TIME_PATTERN.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

export function toWallClockTime(minutes: number): string | null {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= MINUTES_PER_DAY) return null;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function createFixedDurationFromTimes(
  startTime: string,
  endTime: string,
): Result<ExactDuration, EventValidationError> {
  const startMinutes = toMinutesOfDay(startTime);
  const endMinutes = toMinutesOfDay(endTime);
  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) return durationError();

  const durationMinutes = endMinutes > startMinutes
    ? endMinutes - startMinutes
    : endMinutes + MINUTES_PER_DAY - startMinutes;
  return { ok: true, value: { type: 'fixed', minutes: durationMinutes } };
}

export function createFixedDurationFromDateTimes(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
): Result<ExactDuration, EventValidationError> {
  const startMinutes = toMinutesOfDay(startTime);
  const endMinutes = toMinutesOfDay(endTime);
  if (!isCalendarDate(startDate) || !isCalendarDate(endDate)) return durationError();
  const calendarDayDifference = differenceInCalendarDays(parseISO(endDate), parseISO(startDate));
  if (startMinutes === null || endMinutes === null || !Number.isSafeInteger(calendarDayDifference)) {
    return durationError();
  }

  const durationMinutes = calendarDayDifference * MINUTES_PER_DAY + endMinutes - startMinutes;
  if (!Number.isSafeInteger(durationMinutes) || durationMinutes < 1) return durationError();
  return { ok: true, value: { type: 'fixed', minutes: durationMinutes } };
}
