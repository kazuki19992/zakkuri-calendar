import { useEffect, useState } from 'react';

// 分単位で十分なため、これより短い間隔での再計算は行わない。
const UPDATE_INTERVAL_MS = 60_000;

export type NowIndicator = Readonly<{
  minutesOfDay: number;
  label: string;
}>;

function getSystemTime(): Date {
  return new Date();
}

function toIndicator(date: Date): NowIndicator {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return {
    minutesOfDay: hours * 60 + minutes,
    label: `${hours}:${String(minutes).padStart(2, '0')}`,
  };
}

/**
 * 現在時刻を0時起点の分数と表示ラベルへ変換し、一定間隔で更新する。
 * `now`はテストで時刻を固定・進行させるための依存注入で、既定では実時刻を使う。
 */
export function useNowIndicator(now: () => Date = getSystemTime): NowIndicator {
  const [indicator, setIndicator] = useState(() => toIndicator(now()));

  useEffect(() => {
    const id = setInterval(() => setIndicator(toIndicator(now())), UPDATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [now]);

  return indicator;
}
