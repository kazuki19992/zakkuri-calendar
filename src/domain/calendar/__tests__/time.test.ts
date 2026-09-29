import {
  createFixedDurationFromDateTimes,
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

  it('暦日と壁時計時刻から24時間超の固定長を作る', () => {
    expect(createFixedDurationFromDateTimes('2026-09-30', '23:30', '2026-10-02', '00:30')).toEqual({
      ok: true,
      value: { type: 'fixed', minutes: 1500 },
    });
  });

  it.each([
    ['年境界', '2026-12-31', '23:30', '2027-01-02', '00:30'],
    ['うるう日', '2024-02-28', '23:30', '2024-03-01', '00:30'],
  ])('%sをまたぐ日時から暦日基準の固定長を作る', (_, startDate, startTime, endDate, endTime) => {
    expect(createFixedDurationFromDateTimes(startDate, startTime, endDate, endTime)).toEqual({
      ok: true,
      value: { type: 'fixed', minutes: 1500 },
    });
  });

  it('日時またはoffsetを含む日付入力を受け付けない', () => {
    expect(
      createFixedDurationFromDateTimes('2026-09-30T23:00:00-01:00', '23:30', '2026-10-02', '00:30'),
    ).toEqual({
      ok: false,
      error: { field: 'duration', message: '終了時刻を開始時刻と異なる時刻にしてください' },
    });
  });

  it('終了日時が開始日時以下なら拒否する', () => {
    expect(createFixedDurationFromDateTimes('2026-10-02', '00:30', '2026-10-02', '00:30')).toEqual({
      ok: false,
      error: { field: 'duration', message: '終了時刻を開始時刻と異なる時刻にしてください' },
    });
  });
});
