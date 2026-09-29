import {
  DEFAULT_EVENT_COLOR_ID,
  EVENT_COLOR_IDS,
  parseEventColorId,
} from '../event-color';

describe('予定色ID', () => {
  it('表示パレットで使う安定した色IDだけを受け付ける', () => {
    expect(parseEventColorId('blue')).toEqual({ ok: true, value: 'blue' });
    expect(parseEventColorId('removed-color')).toEqual({
      ok: false,
      error: { field: 'colorId', message: 'unknown event color id' },
    });
  });

  it('既定色を含む8色のIDを公開する', () => {
    expect(EVENT_COLOR_IDS).toContain(DEFAULT_EVENT_COLOR_ID);
    expect(EVENT_COLOR_IDS).toHaveLength(8);
  });
});
