import type { JSONContent } from '@tiptap/core';
import {
  normalizeEventNoteDocument,
  parseEventNoteDocument,
  parseSafeEventNoteUrl,
  type EventNoteBlockV1,
  type EventNoteDocumentV1,
  type EventNoteInlineV1,
} from '@/domain/calendar/event-note';

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function marksForInline(inline: EventNoteInlineV1): JSONContent['marks'] {
  const marks: NonNullable<JSONContent['marks']> = [];
  if (inline.bold === true) marks.push({ type: 'bold' });
  if (inline.italic === true) marks.push({ type: 'italic' });
  if (inline.link !== undefined) marks.push({ type: 'link', attrs: { href: inline.link } });
  return marks.length === 0 ? undefined : marks;
}

function toTiptapInline(content: readonly EventNoteInlineV1[]): JSONContent[] | undefined {
  const nodes: JSONContent[] = [];
  for (const inline of content) {
    const parts = inline.text.split('\n');
    parts.forEach((part, index) => {
      if (index > 0) nodes.push({ type: 'hardBreak', marks: marksForInline(inline) });
      if (part.length > 0) nodes.push({ type: 'text', text: part, marks: marksForInline(inline) });
    });
  }
  return nodes.length === 0 ? undefined : nodes;
}

function paragraph(content: readonly EventNoteInlineV1[]): JSONContent {
  return { type: 'paragraph', content: toTiptapInline(content) };
}

export function toTiptapDocument(document: EventNoteDocumentV1 | null): JSONContent {
  if (document === null || document.blocks.length === 0) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }
  return {
    type: 'doc',
    content: document.blocks.map((block): JSONContent => {
      if (block.type === 'paragraph') return paragraph(block.content);
      if (block.type === 'bulletList' || block.type === 'orderedList') {
        return {
          type: block.type,
          content: block.items.map((item) => ({
            type: 'listItem',
            content: [paragraph(item)],
          })),
        };
      }
      if (block.type === 'checkList') return {
        type: 'taskList',
        content: block.items.map((item) => ({
          type: 'taskItem',
          attrs: { checked: item.checked },
          content: [paragraph(item.content)],
        })),
      };
      return { type: 'paragraph' };
    }),
  };
}

function parseMarks(value: unknown): Omit<EventNoteInlineV1, 'text'> {
  if (!Array.isArray(value)) return {};
  let bold = false;
  let italic = false;
  let link: string | null = null;
  for (const mark of value) {
    if (!isRecord(mark) || typeof mark.type !== 'string') continue;
    if (mark.type === 'bold') bold = true;
    if (mark.type === 'italic') italic = true;
    if (mark.type === 'link' && isRecord(mark.attrs)) {
      link = parseSafeEventNoteUrl(mark.attrs.href);
    }
  }
  return {
    ...(bold ? { bold: true as const } : {}),
    ...(italic ? { italic: true as const } : {}),
    ...(link === null ? {} : { link }),
  };
}

function collectInline(value: unknown): EventNoteInlineV1[] {
  if (!isRecord(value)) return [];
  if (value.type === 'text' && typeof value.text === 'string') {
    return value.text.length === 0 ? [] : [{ text: value.text, ...parseMarks(value.marks) }];
  }
  if (value.type === 'hardBreak') return [{ text: '\n', ...parseMarks(value.marks) }];
  if (!Array.isArray(value.content)) return [];
  return value.content.flatMap(collectInline);
}

function parseListItemsInOrder(
  value: JsonRecord,
  itemType: 'listItem' | 'taskItem',
): EventNoteInlineV1[][] {
  if (!Array.isArray(value.content)) return [];
  const items: EventNoteInlineV1[][] = [];
  for (const item of value.content) {
    if (!isRecord(item) || item.type !== itemType || !Array.isArray(item.content)) continue;
    const direct: EventNoteInlineV1[] = [];
    const nested: EventNoteInlineV1[][] = [];
    for (const child of item.content) {
      if (!isRecord(child)) continue;
      if (child.type === 'bulletList' || child.type === 'orderedList') {
        nested.push(...parseListItemsInOrder(child, 'listItem'));
      } else if (child.type === 'taskList') {
        nested.push(...parseListItemsInOrder(child, 'taskItem'));
      } else {
        direct.push(...collectInline(child));
      }
    }
    items.push(direct, ...nested);
  }
  return items;
}

function parseTaskItems(value: JsonRecord): Readonly<{
  checked: boolean;
  content: readonly EventNoteInlineV1[];
}>[] {
  if (!Array.isArray(value.content)) return [];
  const items: Readonly<{ checked: boolean; content: readonly EventNoteInlineV1[] }>[] = [];
  for (const item of value.content) {
    if (!isRecord(item) || item.type !== 'taskItem' || !Array.isArray(item.content)) continue;
    const attrs = isRecord(item.attrs) ? item.attrs : {};
    const direct: EventNoteInlineV1[] = [];
    const nested: Readonly<{ checked: boolean; content: readonly EventNoteInlineV1[] }>[] = [];
    for (const child of item.content) {
      if (isRecord(child) && child.type === 'taskList') {
        nested.push(...parseTaskItems(child));
      } else if (isRecord(child) &&
          (child.type === 'bulletList' || child.type === 'orderedList')) {
        nested.push(...parseListItemsInOrder(child, 'listItem').map((content) => ({
          checked: false,
          content,
        })));
      } else {
        direct.push(...collectInline(child));
      }
    }
    items.push({ checked: attrs.checked === true, content: direct }, ...nested);
  }
  return items;
}

function parseTopLevelBlock(value: unknown): EventNoteBlockV1 | null {
  if (!isRecord(value)) return null;
  if (value.type === 'paragraph') return { type: 'paragraph', content: collectInline(value) };
  if (value.type === 'bulletList' || value.type === 'orderedList') {
    return { type: value.type, items: parseListItemsInOrder(value, 'listItem') };
  }
  if (value.type === 'taskList') return { type: 'checkList', items: parseTaskItems(value) };
  return { type: 'paragraph', content: collectInline(value) };
}

export function fromTiptapDocument(value: unknown): EventNoteDocumentV1 | null {
  if (!isRecord(value) || value.type !== 'doc' || !Array.isArray(value.content)) return null;
  const candidate = {
    version: 1,
    blocks: value.content.map(parseTopLevelBlock).filter((block): block is EventNoteBlockV1 =>
      block !== null),
  } as const;
  const parsed = parseEventNoteDocument(candidate);
  return parsed.ok ? normalizeEventNoteDocument(parsed.value) : null;
}
