import { useCallback, useEffect, useRef, useState } from 'react';
import type { CalendarRepository, TemporalDefinitionRepository } from '@/domain/calendar/repositories';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';

export function useTemporalPreferences({ calendars, definitions }: Readonly<{
  calendars: Pick<CalendarRepository, 'getDefault'>;
  definitions: Pick<TemporalDefinitionRepository, 'listEditable'>;
}>) {
  const [items, setItems] = useState<readonly TemporalDefinition[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const generation = useRef(0);
  useEffect(() => () => { generation.current += 1; }, []);

  const reload = useCallback(async () => {
    const version = ++generation.current;
    setStatus('loading');
    try {
      const calendar = await calendars.getDefault();
      const values = await definitions.listEditable(calendar.id);
      if (version !== generation.current) return;
      setItems(values);
      setStatus('ready');
    } catch {
      if (version === generation.current) setStatus('error');
    }
  }, [calendars, definitions]);

  return { items, status, reload };
}
