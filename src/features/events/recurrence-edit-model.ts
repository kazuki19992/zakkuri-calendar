export type RecurrenceEditScope = 'occurrence' | 'following' | 'series';

export type ScopeRequest = Readonly<{
  operation: 'save' | 'delete';
  options: readonly Readonly<{
    scope: RecurrenceEditScope;
    label: string;
  }>[];
  needsExceptionResetConfirmation: boolean;
}>;

const OPTIONS: ScopeRequest['options'] = [
  { scope: 'occurrence', label: 'この予定' },
  { scope: 'following', label: 'これ以降の予定' },
  { scope: 'series', label: 'すべての予定' },
];

export function createScopeRequest(
  operation: ScopeRequest['operation'],
  recurrenceChanged: boolean,
): ScopeRequest {
  return {
    operation,
    options: recurrenceChanged
      ? OPTIONS.filter((option) => option.scope !== 'occurrence')
      : OPTIONS,
    needsExceptionResetConfirmation: recurrenceChanged,
  };
}
