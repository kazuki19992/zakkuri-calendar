import {computeInlineNoteHeight} from '../inline-note-layout';
it('短文は120pt、長文は320ptを上限とする',()=>{expect(computeInlineNoteHeight(30,500)).toBe(120);expect(computeInlineNoteHeight(200,500)).toBe(200);expect(computeInlineNoteHeight(900,500)).toBe(320);});
it('キーボードで狭まった枠では最小値より利用可能高さを優先する',()=>{expect(computeInlineNoteHeight(900,80)).toBe(80);expect(computeInlineNoteHeight(30,80)).toBe(80);});
