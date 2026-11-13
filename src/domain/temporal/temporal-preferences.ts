import {getISODay,parse} from 'date-fns';
import type { CalendarEvent } from '@/domain/calendar/event';
import { isCalendarDate } from '@/domain/calendar/month';
import { parseTemporalDefinition, type TemporalDefinition, type TemporalResolverConfig } from './temporal-definition';
import { resolveRelativeDateRange } from './relative-date-resolution';

export type TemporalDefinitionPatch = Readonly<{
  resolverConfig?: TemporalResolverConfig;
  fadeInRatio?: number;
  fadeOutRatio?: number;
}>;
export type DefinitionExpectation = Readonly<{ id: string; token: string }>;
export class TemporalConflictError extends Error {
  constructor() { super('時間表現または予定が更新されました。内容を再確認してください。'); }
}
export const DEFAULT_UNDETERMINED_MINUTES = 120;
export function parseUndeterminedMinutes(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 1440 ? value : null;
}
export const temporalDefinitionToken = (definition: TemporalDefinition): string => JSON.stringify(definition);
export function applyTemporalPatch(definition: TemporalDefinition, patch: TemporalDefinitionPatch): TemporalDefinition {
  const config = patch.resolverConfig ?? definition.resolverConfig;
  const previous = definition.resolverConfig;
  if (config.kind !== previous.kind ||
    ('selectionWeekOffset' in config && 'selectionWeekOffset' in previous && config.selectionWeekOffset !== previous.selectionWeekOffset) ||
    ('selectionMonthOffset' in config && 'selectionMonthOffset' in previous && config.selectionMonthOffset !== previous.selectionMonthOffset)) {
    throw new Error('時間表現の種類や対象期間は変更できません');
  }
  const parsed = parseTemporalDefinition({ ...definition, resolverConfig: config,
    fadeInRatio: patch.fadeInRatio ?? definition.fadeInRatio, fadeOutRatio: patch.fadeOutRatio ?? definition.fadeOutRatio });
  if (!parsed.ok) throw new Error('範囲とぼかしの値を確認してください');
  return parsed.value;
}
/** 選択時offsetを再適用せず、保存した対象週・月内でのみ再解決する。 */
export function reResolveTemporalEvent(event: CalendarEvent, definition: TemporalDefinition): CalendarEvent {
  if (event.temporalType !== 'fuzzy' || event.temporalDefinitionId !== definition.id) throw new Error('時間表現の参照が不正です');
  if (definition.granularity === 'day') {
    if (event.resolutionContext !== null) throw new Error('時間表現の保存形式が不正です');
    return event;
  }
  const context = event.resolutionContext;
  if (context === null || event.recurrenceRule !== null || !isCalendarDate(context.periodAnchorDate)) throw new Error('対象期間を再解決できません');
  const period = parse(context.periodAnchorDate, 'yyyy-MM-dd', new Date());
  if ((definition.granularity === 'week' && getISODay(period) !== 1) || (definition.granularity === 'month' && period.getDate() !== 1)) throw new Error('対象期間の起点が不正です');
  if (definition.resolverConfig.kind === 'weekRemainder') return event;
  const config = definition.resolverConfig;
  const anchored = { ...definition, resolverConfig: 'selectionWeekOffset' in config
    ? { ...config, selectionWeekOffset: 0 as const }
    : 'selectionMonthOffset' in config ? { ...config, selectionMonthOffset: 0 as const } : config };
  const result = resolveRelativeDateRange(context.periodAnchorDate, anchored, context.parameterSnapshot.thisWeekDeadlineWeekday ?? 5);
  if (!result.ok) throw new Error('対象期間を再解決できません');
  return { ...event, anchorDate: result.value.startDate, endDate: result.value.endDate };
}
