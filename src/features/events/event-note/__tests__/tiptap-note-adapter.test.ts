import { Editor } from '@tiptap/core';
import { applyEventNoteAutolinks } from '../event-note-autolink';
import type { EventNoteDocumentV1 } from '@/domain/calendar/event-note';
import { createEventNoteExtensions, shouldBlockListNesting } from '../editor-extensions';
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
    expect(fromTiptapDocument(toTiptapDocument(document))).toEqual({ ok: true, value: document });
  });

  test('正常な空文書を変換失敗と区別できる文書として返す', () => {
    expect(toTiptapDocument(null)).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    });
    expect(fromTiptapDocument(toTiptapDocument(null))).toEqual({
      ok: true,
      value: { version: 1, blocks: [{ type: 'paragraph', content: [] }] },
    });
    expect(fromTiptapDocument({ type: 'paragraph' })).toEqual({
      ok: false,
      error: { message: 'invalid Tiptap event note document' },
    });
  });

  test('空白で終わらないURLをリンク化し、書式・既存リンク・本文を保持する', () => {
    const editor = new Editor({
      element: null,
      extensions: createEventNoteExtensions(),
      content: toTiptapDocument({ version: 1, blocks: [{ type: 'paragraph', content: [
        { text: 'すでにリンク', link: 'https://example.org/' },
        { text: ' （http://example.net） と ' },
        { text: 'https://example.com/a?b=1', bold: true },
      ] }] }),
    });
    try {
      applyEventNoteAutolinks(editor);
      applyEventNoteAutolinks(editor);
      expect(fromTiptapDocument(editor.getJSON())).toEqual({ ok: true, value: { version: 1, blocks: [{
        type: 'paragraph', content: [
          { text: 'すでにリンク', link: 'https://example.org/' },
          { text: ' （' },
          { text: 'http://example.net', link: 'http://example.net/' },
          { text: '） と ' },
          { text: 'https://example.com/a?b=1', link: 'https://example.com/a?b=1', bold: true },
        ],
      }] } });
    } finally {
      editor.destroy();
    }
  });

  test('危険なスキームやURLに似た通常の文字列はリンク化しない', () => {
    const text = 'javascript:alert(1) ftp://example.com example.org https://';
    const editor = new Editor({ element: null, extensions: createEventNoteExtensions(),
      content: toTiptapDocument({ version: 1, blocks: [{ type: 'paragraph', content: [{ text }] }] }) });
    try {
      applyEventNoteAutolinks(editor);
      expect(fromTiptapDocument(editor.getJSON())).toEqual({
        ok: true, value: { version: 1, blocks: [{ type: 'paragraph', content: [{ text }] }] },
      });
    } finally {
      editor.destroy();
    }
  });

  test('意味のある空段落を維持する', () => {
    expect(fromTiptapDocument({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '前' }] },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: '後' }] },
      ],
    })).toEqual({
      ok: true,
      value: {
        version: 1,
        blocks: [
          { type: 'paragraph', content: [{ text: '前' }] },
          { type: 'paragraph', content: [] },
          { type: 'paragraph', content: [{ text: '後' }] },
        ],
      },
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
      ok: true,
      value: {
        version: 1,
        blocks: [
          { type: 'paragraph', content: [{ text: '# 予定' }] },
          { type: 'paragraph', content: [{ text: '危険' }] },
        ],
      },
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
      ok: true,
      value: {
        version: 1,
        blocks: [{ type: 'bulletList', items: [[{ text: '親' }], [{ text: '子' }]] }],
      },
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
      ok: true,
      value: {
        version: 1,
        blocks: [{ type: 'checkList', items: [
          { checked: false, content: [{ text: '親' }] },
          { checked: true, content: [{ text: '子' }] },
        ] }],
      },
    });
  });

  test('許可したnode・mark・編集補助だけを登録する', () => {
    expect(createEventNoteExtensions().map((extension) => extension.name)).toEqual([
      'doc', 'paragraph', 'text', 'hardBreak', 'bold', 'italic',
      'bulletList', 'orderedList', 'listItem', 'taskList', 'taskItem', 'flatListKeyboardGuard',
      'listKeymap',
      'link', 'undoRedo', 'placeholder',
    ]);
  });

  test('通常listとchecklistではTabによる入れ子化を遮断する', () => {
    expect(shouldBlockListNesting((name) => name === 'bulletList')).toBe(true);
    expect(shouldBlockListNesting((name) => name === 'orderedList')).toBe(true);
    expect(shouldBlockListNesting((name) => name === 'taskList')).toBe(true);
    expect(shouldBlockListNesting(() => false)).toBe(false);
  });
});
