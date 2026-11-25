import type { Editor } from '@tiptap/core';
import { find } from 'linkifyjs';
import { parseSafeEventNoteUrl } from '@/domain/calendar/event-note';

const japaneseDelimiters = /[。、（）「」『』【】〈〉《》]/gu;

function parseAutolinkUrl(value: string) {
  return /^https?:\/\//i.test(value) ? parseSafeEventNoteUrl(value) : null;
}

export function shouldAutoLinkEventNoteUrl(value: string): boolean {
  return value.search(japaneseDelimiters) === -1 && parseAutolinkUrl(value) !== null;
}

/** 空白で確定されなかったURLを、編集終了や保存の直前にリンクへ変換する。 */
export function applyEventNoteAutolinks(editor: Editor): void {
  const { state } = editor;
  const link = state.schema.marks.link;
  const transaction = state.tr;
  state.doc.descendants((node, position) => {
    if (!node.isTextblock) return;
    // 全角の句読点や改行は、位置を保ったままURLの区切りにする。
    const text = node.textBetween(0, node.content.size, '', ' ')
      .replace(japaneseDelimiters, ' ');
    for (const match of find(text, 'url')) {
      const href = parseAutolinkUrl(match.value);
      const from = position + 1 + match.start;
      const to = position + 1 + match.end;
      if (href !== null && !state.doc.rangeHasMark(from, to, link)) {
        transaction.addMark(from, to, link.create({ href }));
      }
    }
    return false;
  });
  if (transaction.docChanged) editor.view.dispatch(transaction.setMeta('preventAutolink', true));
}
