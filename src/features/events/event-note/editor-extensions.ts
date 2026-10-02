import Bold from '@tiptap/extension-bold';
import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import Italic from '@tiptap/extension-italic';
import Link from '@tiptap/extension-link';
import {
  BulletList,
  ListItem,
  ListKeymap,
  OrderedList,
  TaskItem,
  TaskList,
} from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Placeholder, UndoRedo } from '@tiptap/extensions';
import { parseSafeEventNoteUrl } from '@/domain/calendar/event-note';

export const createEventNoteExtensions = () => [
  Document,
  Paragraph,
  Text,
  HardBreak,
  Bold,
  Italic,
  BulletList.configure({ keepMarks: true }),
  OrderedList.configure({ keepMarks: true }),
  ListItem,
  TaskList,
  TaskItem.configure({ nested: false }),
  ListKeymap,
  Link.configure({
    openOnClick: false,
    enableClickSelection: true,
    autolink: true,
    linkOnPaste: true,
    isAllowedUri: (url) => parseSafeEventNoteUrl(url) !== null,
    shouldAutoLink: (url) => parseSafeEventNoteUrl(url) !== null,
  }),
  UndoRedo,
  Placeholder.configure({ placeholder: 'メモを入力' }),
];
