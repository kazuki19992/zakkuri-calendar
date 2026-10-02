import type { EventNoteDocumentV1 } from '@/domain/calendar/event-note';
import { createEventNoteExtensions } from '../editor-extensions';
import { fromTiptapDocument, toTiptapDocument } from '../tiptap-note-adapter';

const document: EventNoteDocumentV1 = {
  version: 1,
  blocks: [
    {
      type: 'paragraph',
      content: [
        { text: '重要', bold: true, italic: true },
        { text: '\nhttps://example.com', link: 'https://example.com/' },
      ],
    },
    { type: 'bulletList', items: [[{ text: '箇条書き' }]] },
    { type: 'orderedList', items: [[{ text: '番号付き' }]] },
    { type: 'checkList', items: [{ checked: true, content: [{ text: '完了' }] }] },
  ],
};

describe('Tiptap予定メモadapter', () => {
  test('全対応書式をTiptap JSON経由で同じcanonical文書へ戻す', () => {
    expect(fromTiptapDocument(toTiptapDocument(document))).toEqual(document);
  });

  test('空文書と意味のある空段落を区別する', () => {
    expect(toTiptapDocument(null)).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    });
    expect(fromTiptapDocument({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '前' }] },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: '後' }] },
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

  test('未対応blockは文字を段落として残し未対応markと危険なlinkを除去する', () => {
    expect(fromTiptapDocument({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '# 予定' }] },
        {
          type: 'paragraph',
          content: [{
            type: 'text',
            text: '危険',
            marks: [
              { type: 'underline' },
              { type: 'link', attrs: { href: 'javascript:alert(1)' } },
            ],
          }],
        },
      ],
    })).toEqual({
      version: 1,
      blocks: [
        { type: 'paragraph', content: [{ text: '# 予定' }] },
        { type: 'paragraph', content: [{ text: '危険' }] },
      ],
    });
  });

  test('入れ子の箇条書きを入力順の平坦な項目へ変換する', () => {
    expect(fromTiptapDocument({
      type: 'doc',
      content: [{
        type: 'bulletList',
        content: [{
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: '親' }] },
            {
              type: 'bulletList',
              content: [{
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: '子' }] }],
              }],
            },
          ],
        }],
      }],
    })).toEqual({
      version: 1,
      blocks: [{ type: 'bulletList', items: [[{ text: '親' }], [{ text: '子' }]] }],
    });
  });

  test('入れ子のチェックリストもチェック状態を保って平坦化する', () => {
    expect(fromTiptapDocument({
      type: 'doc',
      content: [{
        type: 'taskList',
        content: [{
          type: 'taskItem',
          attrs: { checked: false },
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: '親' }] },
            {
              type: 'taskList',
              content: [{
                type: 'taskItem',
                attrs: { checked: true },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: '子' }] }],
              }],
            },
          ],
        }],
      }],
    })).toEqual({
      version: 1,
      blocks: [{ type: 'checkList', items: [
        { checked: false, content: [{ text: '親' }] },
        { checked: true, content: [{ text: '子' }] },
      ] }],
    });
  });

  test('許可したnode・mark・編集補助だけを登録する', () => {
    expect(createEventNoteExtensions().map((extension) => extension.name)).toEqual([
      'doc', 'paragraph', 'text', 'hardBreak', 'bold', 'italic',
      'bulletList', 'orderedList', 'listItem', 'taskList', 'taskItem', 'listKeymap',
      'link', 'undoRedo', 'placeholder',
    ]);
  });
});
