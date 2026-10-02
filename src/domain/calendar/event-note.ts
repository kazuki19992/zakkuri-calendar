import type { Result } from '@/domain/shared/result';

export type EventNoteInlineV1 = Readonly<{
  text: string;
  bold?: true;
  italic?: true;
  link?: string;
}>;

export type EventNoteBlockV1 =
  | Readonly<{ type: 'paragraph'; content: readonly EventNoteInlineV1[] }>
  | Readonly<{
      type: 'bulletList' | 'orderedList';
      items: readonly (readonly EventNoteInlineV1[])[];
    }>
  | Readonly<{
      type: 'checkList';
      items: readonly Readonly<{
        checked: boolean;
        content: readonly EventNoteInlineV1[];
      }>[];
    }>;

export type EventNoteDocumentV1 = Readonly<{
  version: 1;
  blocks: readonly EventNoteBlockV1[];
}>;

export type EventNoteValidationError = Readonly<{ message: string }>;

const fail = (): Result<never, EventNoteValidationError> => ({
  ok: false,
  error: { message: 'invalid event note document' },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

export function parseSafeEventNoteUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function normalizeInlineContent(
  value: unknown,
): readonly EventNoteInlineV1[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized: EventNoteInlineV1[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate) || !hasOnlyKeys(candidate, ['text', 'bold', 'italic', 'link']) ||
        typeof candidate.text !== 'string' ||
        (candidate.bold !== undefined && candidate.bold !== true) ||
        (candidate.italic !== undefined && candidate.italic !== true)) {
      return undefined;
    }
    const link = candidate.link === undefined ? undefined : parseSafeEventNoteUrl(candidate.link);
    if (candidate.link !== undefined && link === null) return undefined;
    if (candidate.text.length === 0) continue;
    const inline: EventNoteInlineV1 = {
      text: candidate.text,
      ...(candidate.bold === true ? { bold: true as const } : {}),
      ...(candidate.italic === true ? { italic: true as const } : {}),
      ...(link === null || link === undefined ? {} : { link }),
    };
    const previous = normalized.at(-1);
    if (previous !== undefined && previous.bold === inline.bold &&
        previous.italic === inline.italic && previous.link === inline.link) {
      normalized[normalized.length - 1] = { ...previous, text: previous.text + inline.text };
    } else {
      normalized.push(inline);
    }
  }
  return normalized;
}

function parseBlock(value: unknown): EventNoteBlockV1 | undefined {
  if (!isRecord(value) || typeof value.type !== 'string') return undefined;
  if (value.type === 'paragraph') {
    if (!hasOnlyKeys(value, ['type', 'content'])) return undefined;
    const content = normalizeInlineContent(value.content);
    return content === undefined ? undefined : { type: 'paragraph', content };
  }
  if (value.type === 'bulletList' || value.type === 'orderedList') {
    if (!hasOnlyKeys(value, ['type', 'items']) || !Array.isArray(value.items)) return undefined;
    const items: EventNoteInlineV1[][] = [];
    for (const item of value.items) {
      const content = normalizeInlineContent(item);
      if (content === undefined) return undefined;
      items.push([...content]);
    }
    return { type: value.type, items };
  }
  if (value.type === 'checkList') {
    if (!hasOnlyKeys(value, ['type', 'items']) || !Array.isArray(value.items)) return undefined;
    const items: Readonly<{ checked: boolean; content: readonly EventNoteInlineV1[] }>[] = [];
    for (const item of value.items) {
      if (!isRecord(item) || !hasOnlyKeys(item, ['checked', 'content']) ||
          typeof item.checked !== 'boolean') return undefined;
      const content = normalizeInlineContent(item.content);
      if (content === undefined) return undefined;
      items.push({ checked: item.checked, content });
    }
    return { type: 'checkList', items };
  }
  return undefined;
}

export function parseEventNoteDocument(
  value: unknown,
): Result<EventNoteDocumentV1, EventNoteValidationError> {
  if (!isRecord(value) || !hasOnlyKeys(value, ['version', 'blocks']) ||
      value.version !== 1 || !Array.isArray(value.blocks)) return fail();
  const blocks: EventNoteBlockV1[] = [];
  for (const candidate of value.blocks) {
    const block = parseBlock(candidate);
    if (block === undefined) return fail();
    blocks.push(block);
  }
  return { ok: true, value: { version: 1, blocks } };
}

export function normalizeEventNoteDocument(
  value: EventNoteDocumentV1,
): EventNoteDocumentV1 | null {
  const parsed = parseEventNoteDocument(value);
  if (!parsed.ok) return null;
  const document = parsed.value;
  return projectEventNoteToPlainText(document)?.trim() ? document : null;
}

export function eventNoteFromPlainText(value: string): EventNoteDocumentV1 | null {
  if (value.trim().length === 0) return null;
  return { version: 1, blocks: [{ type: 'paragraph', content: [{ text: value }] }] };
}

const inlineText = (content: readonly EventNoteInlineV1[]): string =>
  content.map((inline) => inline.text).join('');

export function projectEventNoteToPlainText(
  value: EventNoteDocumentV1 | null,
): string | null {
  if (value === null) return null;
  const lines: string[] = [];
  for (const block of value.blocks) {
    if (block.type === 'paragraph') {
      lines.push(inlineText(block.content));
    } else if (block.type === 'bulletList') {
      lines.push(...block.items.map((item) => `• ${inlineText(item)}`));
    } else if (block.type === 'orderedList') {
      lines.push(...block.items.map((item, index) => `${index + 1}. ${inlineText(item)}`));
    } else if (block.type === 'checkList') {
      lines.push(...block.items.map((item) => `${item.checked ? '☑' : '☐'} ${inlineText(item.content)}`));
    }
  }
  return lines.join('\n');
}

export function areEventNotesEqual(
  first: EventNoteDocumentV1 | null,
  second: EventNoteDocumentV1 | null,
): boolean {
  const normalizedFirst = first === null ? null : normalizeEventNoteDocument(first);
  const normalizedSecond = second === null ? null : normalizeEventNoteDocument(second);
  return JSON.stringify(normalizedFirst) === JSON.stringify(normalizedSecond);
}
