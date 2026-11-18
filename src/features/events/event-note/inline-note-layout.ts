export const INLINE_NOTE_MIN_HEIGHT=120;
export const INLINE_NOTE_MAX_HEIGHT=320;
/** 利用可能な高さが最小値より小さくても、キーボードの裏へ領域を押し出さない。 */
export function computeInlineNoteHeight(content:number,available:number):number{
  const maximum=Math.max(0,Math.min(INLINE_NOTE_MAX_HEIGHT,available));
  return Math.min(maximum,Math.max(INLINE_NOTE_MIN_HEIGHT,Number.isFinite(content)?content:INLINE_NOTE_MIN_HEIGHT));
}
