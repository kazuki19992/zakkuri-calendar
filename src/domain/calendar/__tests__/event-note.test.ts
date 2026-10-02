import {
  areEventNotesEqual,
  eventNoteFromPlainText,
  normalizeEventNoteDocument,
  parseEventNoteDocument,
  parseSafeEventNoteUrl,
  projectEventNoteToPlainText,
  type EventNoteDocumentV1,
} from '../event-note';

describe('予定メモ文書', () => {
  test('対応する書式とチェック状態を検証して隣接する同じ書式を結合する', () => {
    const parsed = parseEventNoteDocument({
      version: 1,
      blocks: [
        {
          type: 'paragraph',
          content: [
            { text: '確認', bold: true },
            { text: '', bold: true },
            { text: 'する', bold: true },
            { text: ' URL', italic: true, link: 'https://example.com' },
          ],
        },
        { type: 'checkList', items: [{ checked: true, content: [{ text: '完了' }] }] },
      ],
    });

    expect(parsed).toEqual({
      ok: true,
      value: {
        version: 1,
        blocks: [
          {
            type: 'paragraph',
            content: [
              { text: '確認する', bold: true },
              { text: ' URL', italic: true, link: 'https://example.com/' },
            ],
          },
          { type: 'checkList', items: [{ checked: true, content: [{ text: '完了' }] }] },
        ],
      },
    });
  });

  test.each([
    ['javascript:alert(1)'],
    ['mailto:test@example.com'],
    ['/relative'],
    ['not a url'],
  ])('httpとhttps以外のリンクを拒否する: %s', (link) => {
    expect(parseSafeEventNoteUrl(link)).toBeNull();
    expect(parseEventNoteDocument({
      version: 1,
      blocks: [{ type: 'paragraph', content: [{ text: '危険', link }] }],
    }).ok).toBe(false);
  });

  test('未知のversion・block・mark属性・不正なチェック状態を拒否する', () => {
    expect(parseEventNoteDocument({ version: 2, blocks: [] }).ok).toBe(false);
    expect(parseEventNoteDocument({
      version: 1,
      blocks: [{ type: 'heading', content: [{ text: '見出し' }] }],
    }).ok).toBe(false);
    expect(parseEventNoteDocument({
      version: 1,
      blocks: [{ type: 'paragraph', content: [{ text: '下線', underline: true }] }],
    }).ok).toBe(false);
    expect(parseEventNoteDocument({
      version: 1,
      blocks: [{ type: 'checkList', items: [{ checked: 'yes', content: [] }] }],
    }).ok).toBe(false);
  });

  test('空文書はnullへ正規化し意味のある空行は保持する', () => {
    expect(normalizeEventNoteDocument({ version: 1, blocks: [] })).toBeNull();
    expect(normalizeEventNoteDocument({
      version: 1,
      blocks: [
        { type: 'paragraph', content: [{ text: '前' }] },
        { type: 'paragraph', content: [] },
        { type: 'paragraph', content: [{ text: '後' }] },
      ],
    })).toEqual({
      version: 1,
      blocks: [
        { type: 'paragraph', content: [{ text: '前' }] },
        { type: 'paragraph', content: [] },
        { type: 'paragraph', content: [{ text: '後' }] },
      ],
    });
  });

  test('旧本文をMarkdownとして解釈せず1つの段落へ変換する', () => {
    expect(eventNoteFromPlainText('# 見出し\n- 項目\n`code`')).toEqual({
      version: 1,
      blocks: [{ type: 'paragraph', content: [{ text: '# 見出し\n- 項目\n`code`' }] }],
    });
    expect(eventNoteFromPlainText(' \n\t')).toBeNull();
  });

  test('全blockを決定的なプレーンテキストへ投影する', () => {
    const document: EventNoteDocumentV1 = {
      version: 1,
      blocks: [
        { type: 'paragraph', content: [{ text: '本文', bold: true }] },
        { type: 'bulletList', items: [[{ text: '箇条書き' }]] },
        { type: 'orderedList', items: [[{ text: '一つ' }], [{ text: '二つ' }]] },
        { type: 'checkList', items: [
          { checked: false, content: [{ text: '未完了' }] },
          { checked: true, content: [{ text: '完了' }] },
        ] },
      ],
    };

    expect(projectEventNoteToPlainText(document)).toBe(
      '本文\n• 箇条書き\n1. 一つ\n2. 二つ\n☐ 未完了\n☑ 完了',
    );
    expect(projectEventNoteToPlainText(null)).toBeNull();
  });

  test('正規化後の構造が同じ文書を等価とみなす', () => {
    const first: EventNoteDocumentV1 = {
      version: 1,
      blocks: [{ type: 'paragraph', content: [{ text: '同じ' }, { text: '本文' }] }],
    };
    const second: EventNoteDocumentV1 = {
      version: 1,
      blocks: [{ type: 'paragraph', content: [{ text: '同じ本文' }] }],
    };

    expect(areEventNotesEqual(first, second)).toBe(true);
    expect(areEventNotesEqual(first, null)).toBe(false);
  });
});
