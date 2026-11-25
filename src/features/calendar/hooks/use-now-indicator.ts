import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

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
 * 現在時刻を0時起点の分数と表示ラベルへ変換し、分の境目とフォアグラウンド復帰時に更新する。
 * `now`はテストで時刻を固定・進行させるための依存注入で、既定では実時刻を使う。
 */
export function useNowIndicator(now: () => Date = getSystemTime): NowIndicator {
  const [indicator, setIndicator] = useState(() => toIndicator(now()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const time = now();
      const nextIndicator = toIndicator(time);
      setIndicator((current) => current.label === nextIndicator.label ? current : nextIndicator);
      timer = setTimeout(update, UPDATE_INTERVAL_MS - time.getSeconds() * 1_000 - time.getMilliseconds());
    };
    update();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        clearTimeout(timer);
        update();
      }
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [now]);

  return indicator;
}
