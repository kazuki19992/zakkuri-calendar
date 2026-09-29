import type { Result } from '@/domain/shared/result';

export const EVENT_COLOR_IDS = [
  'blue',
  'teal',
  'green',
  'ochre',
  'orange',
  'red',
  'purple',
  'gray',
] as const;

export type EventColorId = (typeof EVENT_COLOR_IDS)[number];

export const DEFAULT_EVENT_COLOR_ID: EventColorId = 'blue';

export function parseEventColorId(
  value: unknown,
): Result<EventColorId, Readonly<{ field: string; message: string }>> {
  if (typeof value === 'string' && EVENT_COLOR_IDS.some((id) => id === value)) {
    return { ok: true, value: value as EventColorId };
  }
  return { ok: false, error: { field: 'colorId', message: 'unknown event color id' } };
}
