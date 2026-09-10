import {
  createFixedDurationFromTimes,
  toMinutesOfDay,
  toWallClockTime,
} from '../time';

describe('予定時刻の変換', () => {
  it('壁時計の時刻と0時からの分数を相互変換する', () => {
    expect(toMinutesOfDay('09:30')).toBe(570);
    expect(toWallClockTime(570)).toBe('09:30');
  });

  it('同日内の開始時刻と終了時刻から任意分数の長さを作る', () => {
    expect(createFixedDurationFromTimes('09:30', '11:45')).toEqual({
      ok: true,
      value: { type: 'fixed', minutes: 135 },
    });
  });

  it('終了時刻が開始より前なら翌日に継続する長さを作る', () => {
    expect(createFixedDurationFromTimes('23:30', '00:30')).toEqual({
      ok: true,
      value: { type: 'fixed', minutes: 60 },
    });
  });

  it.each([
    ['同じ開始終了時刻', '09:30', '09:30'],
    ['不正な開始時刻', '24:00', '09:30'],
    ['不正な終了時刻', '09:30', '24:00'],
  ])('%sを受け付けない', (_, startTime, endTime) => {
    expect(createFixedDurationFromTimes(startTime, endTime)).toEqual({
      ok: false,
      error: { field: 'duration', message: '終了時刻を開始時刻と異なる時刻にしてください' },
    });
  });
});
