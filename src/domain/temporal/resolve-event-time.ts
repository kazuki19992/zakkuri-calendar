import type { CalendarEvent } from '@/domain/calendar/event';
import type { TemporalDefinition } from './temporal-definition';

export type ResolvedEventTime =
  | Readonly<{ kind: 'allDay' }>
  | Readonly<{
      kind: 'timed';
      startMinute: number;
      endMinute: number;
      fadeInRatio: number;
      fadeOutRatio: number;
      isInstant: boolean;
    }>
  | Readonly<{ kind: 'unresolved' }>;

function parseStartMinute(startTime: string): number {
  const [hour, minute] = startTime.split(':').map(Number);
  return hour * 60 + minute;
}

export function resolveEventTime(input: Readonly<{
  event: CalendarEvent;
  definition: TemporalDefinition | null;
  undeterminedFadeMinutes: number;
}>): ResolvedEventTime {
  const { event } = input;
  if (event.temporalType === 'allDay') return { kind: 'allDay' };

  if (event.temporalType === 'fuzzy') {
    const definition = input.definition;
    if (
      definition === null ||
      definition.id !== event.temporalDefinitionId ||
      definition.granularity !== 'day' ||
      definition.resolverConfig.kind !== 'timeOfDay'
    ) {
      return { kind: 'unresolved' };
    }
    return {
      kind: 'timed',
      startMinute: definition.resolverConfig.startMinute,
      endMinute: definition.resolverConfig.endMinute,
      fadeInRatio: definition.fadeInRatio,
      fadeOutRatio: definition.fadeOutRatio,
      isInstant: false,
    };
  }

  const startMinute = parseStartMinute(event.startTime);
  if (event.duration.type === 'instant') {
    return {
      kind: 'timed', startMinute, endMinute: startMinute,
      fadeInRatio: 0, fadeOutRatio: 0, isInstant: true,
    };
  }
  if (event.duration.type === 'undetermined') {
    return {
      kind: 'timed',
      startMinute,
      endMinute: startMinute + input.undeterminedFadeMinutes,
      fadeInRatio: 0,
      fadeOutRatio: 1,
      isInstant: false,
    };
  }
  return {
    kind: 'timed',
    startMinute,
    endMinute: startMinute + event.duration.minutes,
    fadeInRatio: 0,
    fadeOutRatio: 0,
    isInstant: false,
  };
}
