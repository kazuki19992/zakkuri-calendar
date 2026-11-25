import type { EventEditorTab } from '@/domain/calendar/event';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { SegmentedControl } from '@/shared/components/segmented-control';

const options = [
  { value: 'fuzzy', label: 'ざっくり' },
  { value: 'exact', label: 'きっちり' },
] as const;

export function EventEditorTabs({ value, disabled, onChange }: Readonly<{
  value: EventEditorTab;
  disabled: boolean;
  onChange(value: EventEditorTab): void;
}>) {
  const reduceMotion = useReduceMotion();
  return <SegmentedControl options={options} value={value} disabled={disabled}
    label="予定の時間形式" role="tab" animateSelection={!reduceMotion} onSelect={onChange} />;
}
