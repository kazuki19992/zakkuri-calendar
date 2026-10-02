# Rich Text Event Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Markdownを知らない利用者が、太字・斜体・3種類のリスト・安全なURLリンクを全画面エディタで編集し、予定保存時だけ端末内SQLiteへ保存できるようにする。

**Architecture:** アプリ所有の`EventNoteDocumentV1`をdomainとDBの正とし、Tiptap JSONはfeature内adapterへ閉じ込める。Expo DOM Components上のTiptap editorは最新文書を完了時にnativeへ返し、`useEventEditor`が予定保存までインメモリで保持する。SQLite v5はversion付きJSONと既存`notes`列へのプレーンテキスト投影を同じtransactionでdual-writeする。

**Tech Stack:** TypeScript 6、React 19、React Native 0.86、Expo SDK 57 / Expo DOM Components、Tiptap 3、expo-sqlite、expo-web-browser、Jest / Testing Library

**Spec:** `docs/superpowers/specs/2026-10-02-rich-text-event-notes-design.md`

## Global Constraints

- 保存形式はアプリ所有の`EventNoteDocumentV1`とし、Tiptap JSON・HTML・MarkdownをdomainまたはSQLiteの正にしない。
- 対応書式は太字、斜体、箇条書き、番号付きリスト、チェックリスト、http(s)リンク、段落内改行だけとする。
- 見出し、コード、画像、任意HTML、リストの入れ子、独自URL schemeを追加しない。
- メモエディタの「完了」は`useEventEditor`のdraftだけを変更し、予定全体の「保存」成功時だけDBへ書く。
- 既存`events.notes`は削除せずプレーンテキスト投影に使い、schema version 5の`notes_document_json`とdual-writeする。
- 既存のプレーンテキスト、繰り返し予定、単一例外、「これ以降」の分割を壊さない。
- privateなメモ本文・JSON・URLをroute parameter、ログ、エラー文、外部サービスへ送らない。
- linkは`http:`と`https:`だけをnativeで再検証し、編集中の通常タップでは開かない。
- 各操作領域は44pt以上とし、選択・無効・checkbox状態を色だけで示さない。
- 依存は同じTiptap 3 versionへ揃え、Expo SDK 57が内包する`@expo/dom-webview`を使う。

## Review Focus

- 最後の日本語IME入力直後に「完了」を押しても、遅延native stateではなくDOMの最新文書がdraftへ入る。
- 不正または未知versionのJSONがあっても、旧`notes`があれば本文を失わずプレーンテキスト文書へfallbackする。
- unsupported pasteやnested listを保存してもTiptap固有node・mark・HTMLがapp schemaへ漏れない。
- 既存の繰り返し例外で`'notes'` overrideがある場合だけreplacementの文書を使い、構造が同じ文書を変更扱いにしない。
- `javascript:`、`mailto:`、相対URL、DOM anchor clickから外部遷移せず、明示操作したhttp(s)だけを開く。

---

### Task 1: EventNote domain modelと決定的な変換

**Files:**
- Create: `src/domain/calendar/event-note.ts`
- Create: `src/domain/calendar/__tests__/event-note.test.ts`
- Modify: `src/domain/calendar/event.ts`
- Modify: `src/domain/calendar/__tests__/event.test.ts`
- Modify: `src/features/events/hooks/use-quick-create-event.ts`
- Modify: `src/features/events/hooks/__tests__/use-quick-create-event.test.tsx`

**Interfaces:**
- Consumes: `Result`と既存`parseEventDraft()`。
- Produces: `EventNoteDocumentV1`、`parseSafeEventNoteUrl()`、`parseEventNoteDocument()`、`normalizeEventNoteDocument()`、`eventNoteFromPlainText()`、`projectEventNoteToPlainText()`、`areEventNotesEqual()`、`CalendarEvent.noteDocument`。

- [ ] **Step 1: parser、正規化、投影、旧本文変換の失敗testを書く**

```ts
const parsed = parseEventNoteDocument({ version: 1, blocks: [
  { type: 'paragraph', content: [
    { text: '確認', bold: true }, { text: 'する', bold: true },
    { text: ' https://example.com', link: 'https://example.com/' },
  ] },
  { type: 'checkList', items: [{ checked: true, content: [{ text: '完了' }] }] },
] });
expect(parsed.ok && parsed.value.blocks[0]).toEqual({
  type: 'paragraph',
  content: [{ text: '確認する', bold: true }, { text: ' https://example.com', link: 'https://example.com/' }],
});
expect(parsed.ok && projectEventNoteToPlainText(parsed.value)).toBe(
  '確認する https://example.com\n☑ 完了',
);
expect(parseEventNoteDocument({ version: 1, blocks: [
  { type: 'paragraph', content: [{ text: '危険', link: 'javascript:alert(1)' }] },
] }).ok).toBe(false);
expect(eventNoteFromPlainText('# 見出し\n`code`')).toEqual({
  version: 1,
  blocks: [{ type: 'paragraph', content: [{ text: '# 見出し\n`code`' }] }],
});
```

空文書、空行、http/https以外、unknown block/mark、adjacent mark、check状態、list投影、構造等価も個別testにする。

- [ ] **Step 2: `npm test -- src/domain/calendar/__tests__/event-note.test.ts src/domain/calendar/__tests__/event.test.ts --runInBand`を実行し、module未実装または`notes` contractでFAILすることを確認する**
- [ ] **Step 3: 次の最小型と純粋関数を実装し、`EventDraftBase.notes`を`noteDocument`へ置換する**

```ts
export type EventNoteInlineV1 = Readonly<{
  text: string; bold?: true; italic?: true; link?: string;
}>;
export type EventNoteBlockV1 =
  | Readonly<{ type: 'paragraph'; content: readonly EventNoteInlineV1[] }>
  | Readonly<{ type: 'bulletList' | 'orderedList'; items: readonly (readonly EventNoteInlineV1[])[] }>
  | Readonly<{ type: 'checkList'; items: readonly Readonly<{
      checked: boolean; content: readonly EventNoteInlineV1[];
    }>[] }>;
export type EventNoteDocumentV1 = Readonly<{ version: 1; blocks: readonly EventNoteBlockV1[] }>;

export function parseSafeEventNoteUrl(value: unknown): string | null;
export function parseEventNoteDocument(value: unknown): Result<EventNoteDocumentV1, EventNoteValidationError>;
export function normalizeEventNoteDocument(value: EventNoteDocumentV1): EventNoteDocumentV1 | null;
export function eventNoteFromPlainText(value: string): EventNoteDocumentV1 | null;
export function projectEventNoteToPlainText(value: EventNoteDocumentV1 | null): string | null;
export function areEventNotesEqual(a: EventNoteDocumentV1 | null, b: EventNoteDocumentV1 | null): boolean;
```

URLは`new URL()`後にprotocolを厳密比較し、正規化済みhrefを保存する。quick createは`noteDocument: null`を渡す。

- [ ] **Step 4: Step 2のtest commandを再実行してPASSを確認する**
- [ ] **Step 5: `git commit -m "feat(domain): 書式付き予定メモの文書形式を追加"`で対象fileをcommitする**

### Task 2: SQLite schema v5と旧メモ互換dual-write

**Files:**
- Modify: `src/data/sqlite/migrations.ts`
- Modify: `src/data/sqlite/row-mappers.ts`
- Modify: `src/data/sqlite/event-repository.ts`
- Modify: `src/data/sqlite/__tests__/migrations.test.ts`
- Modify: `src/data/sqlite/__tests__/row-mappers.test.ts`
- Modify: `src/data/sqlite/__tests__/repositories.test.ts`

**Interfaces:**
- Consumes: Task 1のparser、旧本文変換、プレーンテキスト投影、`CalendarEvent.noteDocument`。
- Produces: schema v5の`events.notes_document_json`、JSON優先・旧`notes` fallback mapper、全event write pathのdual-write。

- [ ] **Step 1: migration・mapping・repositoryの失敗testを書く**

```ts
expect(LATEST_SCHEMA_VERSION).toBe(5);
expect(schemaSql).toContain('ALTER TABLE events ADD COLUMN notes_document_json TEXT');
expect(mapEventRow({ ...eventRow, notes: '旧メモ', notes_document_json: null }).noteDocument)
  .toEqual({ version: 1, blocks: [{ type: 'paragraph', content: [{ text: '旧メモ' }] }] });
expect(mapEventRow({
  ...eventRow, notes: 'fallback', notes_document_json: '{broken',
}).noteDocument).toEqual({
  version: 1, blocks: [{ type: 'paragraph', content: [{ text: 'fallback' }] }],
});
expect(database.run).toHaveBeenCalledWith(expect.stringContaining('notes_document_json'),
  expect.objectContaining({
    $notes: '☐ 確認',
    $notesDocumentJson: JSON.stringify(document),
  }));
```

valid JSON優先、unknown version fallback、両列NULL、create/update/replacement、空文書NULL、runtime値boundも分けて検証する。

- [ ] **Step 2: `npm test -- src/data/sqlite/__tests__/migrations.test.ts src/data/sqlite/__tests__/row-mappers.test.ts src/data/sqlite/__tests__/repositories.test.ts --runInBand`を実行し、schema v4・列不足・旧parameterでFAILすることを確認する**
- [ ] **Step 3: version 5 migrationとrow mapperを実装する**

```sql
ALTER TABLE events ADD COLUMN notes_document_json TEXT;
```

`EventRow`へ`notes_document_json: string | null`を追加する。JSON parseまたはdomain parseに失敗したらraw値をerrorへ含めず、`eventNoteFromPlainText(row.notes ?? '')`へfallbackする。

- [ ] **Step 4: `eventParameters()`、INSERT、UPDATE、replacement用writeへ`$notesDocumentJson`を追加し、`$notes`を投影関数から導出する**

```ts
const noteDocument = normalizeEventNoteDocument(event.noteDocument);
return {
  $notes: projectEventNoteToPlainText(noteDocument),
  $notesDocumentJson: noteDocument === null ? null : JSON.stringify(noteDocument),
};
```

- [ ] **Step 5: Step 2のtest commandを再実行してPASSを確認する**
- [ ] **Step 6: `git commit -m "feat(sqlite): 書式付きメモをversion付きJSONで保存"`でcommitする**

### Task 3: Tiptap JSON adapterと許可schema

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/features/events/event-note/tiptap-note-adapter.ts`
- Create: `src/features/events/event-note/__tests__/tiptap-note-adapter.test.ts`
- Create: `src/features/events/event-note/editor-extensions.ts`

**Interfaces:**
- Consumes: Task 1の`EventNoteDocumentV1`とdomain parser。
- Produces: `toTiptapDocument()`、`fromTiptapDocument()`、`createEventNoteExtensions()`。

- [ ] **Step 1: 同じ安定版へ揃えたTiptap 3依存をinstallする**

Run:

```bash
npm install @tiptap/core@^3.31.3 @tiptap/react@^3.31.3 @tiptap/pm@^3.31.3 \
  @tiptap/extension-document@^3.31.3 @tiptap/extension-paragraph@^3.31.3 \
  @tiptap/extension-text@^3.31.3 @tiptap/extension-bold@^3.31.3 \
  @tiptap/extension-italic@^3.31.3 @tiptap/extension-hard-break@^3.31.3 \
  @tiptap/extension-list@^3.31.3 @tiptap/extension-link@^3.31.3 \
  @tiptap/extensions@^3.31.3
```

Expected: package群が同じ3.x minorへ解決され、peer dependency errorがない。npm registryのlatestが3.31.3より新しい場合も`package-lock.json`で全Tiptap packageが同一versionへ揃うことを確認する。

- [ ] **Step 2: round trip、unsupported paste、nested list、link protocolの失敗testを書く**

```ts
expect(fromTiptapDocument(toTiptapDocument(document))).toEqual({ ok: true, value: document });
expect(fromTiptapDocument({ type: 'doc', content: [
  { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '# 予定' }] },
  { type: 'paragraph', content: [{ type: 'text', text: '危険', marks: [
    { type: 'link', attrs: { href: 'javascript:alert(1)' } },
  ] }] },
] })).toEqual({ ok: true, value: { version: 1, blocks: [
  { type: 'paragraph', content: [{ text: '# 予定' }] },
  { type: 'paragraph', content: [{ text: '危険' }] },
] } });
```

bold+italic+link重複、hardBreak、task checked、空段落、nested listの平坦化もliteral expectationで追加する。

- [ ] **Step 3: `npm test -- src/features/events/event-note/__tests__/tiptap-note-adapter.test.ts --runInBand`を実行し、module未実装でFAILすることを確認する**
- [ ] **Step 4: adapterと許可extension factoryを実装する**

```ts
export function toTiptapDocument(document: EventNoteDocumentV1 | null): JSONContent;
export function fromTiptapDocument(value: unknown):
  | { ok: true; value: EventNoteDocumentV1 }
  | { ok: false; error: { message: string } };

export const createEventNoteExtensions = () => [
  Document, Paragraph, Text, HardBreak, Bold, Italic,
  BulletList.configure({ keepMarks: true }), OrderedList.configure({ keepMarks: true }),
  ListItem, TaskList, TaskItem.configure({ nested: false }), ListKeymap,
  Link.configure({ openOnClick: false, enableClickSelection: true,
    autolink: true, linkOnPaste: true,
    isAllowedUri: (url) => parseSafeEventNoteUrl(url) !== null,
    shouldAutoLink: (url) => parseSafeEventNoteUrl(url) !== null,
  }),
  UndoRedo, Placeholder.configure({ placeholder: 'メモを入力' }),
];
```

adapterはTiptap型をdomainへexportせず、unknown nodeは再帰的に読めるtextをparagraphへ縮退し、未知markを捨てる。

- [ ] **Step 5: Step 3のtest commandを再実行してPASSを確認する**
- [ ] **Step 6: `git commit -m "feat(editor): Tiptapメモ変換境界を追加"`でcommitする**

### Task 4: Expo DOM editorとnative全画面Modal

**Files:**
- Create: `src/features/events/components/formatted-note-editor/formatted-note-editor.dom.tsx`
- Create: `src/features/events/components/formatted-note-editor/formatted-note-editor.tsx`
- Create: `src/features/events/components/formatted-note-editor/formatted-note-toolbar.tsx`
- Create: `src/features/events/components/formatted-note-editor/formatted-note-editor-modal.tsx`
- Create: `src/features/events/components/__tests__/formatted-note-toolbar.test.tsx`
- Create: `src/features/events/components/__tests__/formatted-note-editor-modal.test.tsx`
- Modify: test setup or Jest mocks only if the real DOM proxy cannot load in Jest.

**Interfaces:**
- Consumes: Task 3のadapterとextension factory、`EventNoteDocumentV1`。
- Produces: `FormattedNoteEditorModal({ visible, initialDocument, disabled, onCancel, onComplete })`。

- [ ] **Step 1: native toolbar・Modal lifecycle・accessibilityの失敗testを書く**

```tsx
fireEvent.press(screen.getByRole('button', { name: '太字' }));
expect(editorRef.current?.toggleBold).toHaveBeenCalledTimes(1);
expect(screen.getByRole('button', { name: '太字' })).toHaveAccessibilityState({ selected: true });
fireEvent.press(screen.getByRole('button', { name: '完了' }));
expect(editorRef.current?.requestComplete).toHaveBeenCalledTimes(1);
expect(onComplete).not.toHaveBeenCalled();
fireEvent(domProxy, 'complete', serializedDocument);
expect(onComplete).toHaveBeenCalledWith(document);
```

ready前の完了disabled、完了連打、変換失敗時に閉じない、dirty cancel確認、link操作disabled、44pt style、checkbox state payloadも分ける。DOM componentはbridgeだけをfakeにし、Modal/toolbarの実挙動をassertする。

- [ ] **Step 2: `npm test -- src/features/events/components/__tests__/formatted-note-toolbar.test.tsx src/features/events/components/__tests__/formatted-note-editor-modal.test.tsx --runInBand`を実行し、component未実装でFAILすることを確認する**
- [ ] **Step 3: `'use dom'` editorを実装する**

```ts
export type FormattedNoteEditorDOMRef = Readonly<{
  toggleBold(): void; toggleItalic(): void;
  toggleBulletList(): void; toggleOrderedList(): void; toggleTaskList(): void;
  requestComplete(): void;
}>;
type Props = Readonly<{
  initialDocument: EventNoteDocumentV1 | null;
  theme: EditorTheme;
  onReady(): Promise<void>;
  onStateChange(state: EditorSelectionState): Promise<void>;
  onComplete(document: unknown): Promise<void>;
  onFailure(): Promise<void>;
  dom?: import('expo/dom').DOMProps;
}>;
```

`useEditor({ immediatelyRender: false })`へ許可extensionと`toTiptapDocument()`を渡す。transaction/selection updateでactive状態と現在linkを通知し、`requestComplete()`内で直接`editor.getJSON()`を`fromTiptapDocument()`へ渡す。anchor clickは`preventDefault()`し、native action以外で開かない。

- [ ] **Step 4: native wrapper、header、toolbar、loading/error/retry、dirty cancel確認を実装する**

DOMへ渡す`dom` propで不要なscrollを止め、外部navigation要求を拒否する。native側はDOM callbackをdomain parserで再検証し、validな最新文書だけを`onComplete`する。error文へpayloadを含めない。

- [ ] **Step 5: Step 2のtest commandを再実行してPASSを確認する**
- [ ] **Step 6: `git commit -m "feat(editor): 全画面の書式付きメモ編集を追加"`でcommitする**

### Task 5: 予定編集draft・安全なlink表示・繰り返し連携

**Files:**
- Modify: `src/features/events/hooks/use-event-editor.ts`
- Modify: `src/features/events/hooks/__tests__/use-event-editor.test.tsx`
- Modify: `src/features/events/components/event-metadata-fields.tsx`
- Modify: `src/features/events/components/__tests__/event-editor-additional-fields.test.tsx`
- Modify: `src/features/events/screens/event-editor-screen.tsx`
- Modify: `src/features/events/screens/__tests__/event-editor-screen.test.tsx`
- Modify: `src/domain/calendar/recurrence-change.ts`
- Modify: `src/domain/calendar/recurrence-exception.ts`
- Modify: `src/domain/calendar/__tests__/recurrence-change.test.ts`
- Modify: `src/domain/calendar/__tests__/recurrence-exception.test.ts`

**Interfaces:**
- Consumes: Task 1の文書・比較・投影、Task 4のModal。
- Produces: `EventEditorState.noteDocument`、`isNoteEditorOpen`、`openNoteEditor()`、`cancelNoteEditor()`、`completeNoteEditor()`、安全なlink open action。

- [ ] **Step 1: hookのインメモリ保存境界と繰り返し文書比較の失敗testを書く**

```ts
act(() => result.current.openNoteEditor());
act(() => result.current.completeNoteEditor(document));
expect(repositories.events.update).not.toHaveBeenCalled();
await act(async () => { expect(await result.current.save()).toBe(true); });
expect(repositories.events.update).toHaveBeenCalledWith(expect.objectContaining({
  event: expect.objectContaining({ noteDocument: document }),
}));
expect(getChangedEventFields(before, { ...after, noteDocument: structurallyEqualCopy }))
  .not.toContain('notes');
```

editor cancel、予定cancel相当のunmount、save失敗draft保持、quick create null、replacement override、`notes` mask互換も追加する。

- [ ] **Step 2: `npm test -- src/features/events/hooks/__tests__/use-event-editor.test.tsx src/domain/calendar/__tests__/recurrence-change.test.ts src/domain/calendar/__tests__/recurrence-exception.test.ts --runInBand`を実行し、旧`notes` stateと参照比較でFAILすることを確認する**
- [ ] **Step 3: `useEventEditor`を文書draftへ変更し、メモ行とModalをscreenへ接続する**

```ts
noteDocument: EventNoteDocumentV1 | null;
noteSummary: string;
isNoteEditorOpen: boolean;
openNoteEditor(): void;
cancelNoteEditor(): void;
completeNoteEditor(value: EventNoteDocumentV1 | null): void;
```

メモ行は投影した要約と「メモを追加／編集」を表示する。Modal完了ではdraftだけを更新し、予定saveで`noteDocument`を`EventDraft`へ渡す。

- [ ] **Step 4: recurrence比較・materializeを`noteDocument`へ変更し、永続mask文字列`'notes'`は維持する**
- [ ] **Step 5: link open actionを実装する**

```ts
const safeUrl = parseSafeEventNoteUrl(selectionState.linkUrl);
if (safeUrl !== null) await WebBrowser.openBrowserAsync(safeUrl);
```

Modalの明示ボタンだけが再検証済みURLを`WebBrowser.openBrowserAsync()`へ渡す。通常tap、invalid scheme、open failureのtestを追加し、failure時は固定文言を表示する。

- [ ] **Step 6: `npm test -- src/features/events src/domain/calendar --runInBand`を実行してPASSを確認する**
- [ ] **Step 7: `git commit -m "feat(events): 書式付きメモを予定編集へ接続"`でcommitする**

### Task 6: 文書更新・回帰検証・native export

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-09-07-zakkuri-calendar-mvp-design.md`
- Modify: `docs/superpowers/specs/2026-10-02-rich-text-event-notes-design.md`（実装差分が生じた場合だけ）
- Modify: 回帰test fixtures中の`notes`を`noteDocument`へ更新した全file。

**Interfaces:**
- Consumes: Tasks 1-5の完成機能。
- Produces: schema v5と対応書式を説明する文書、全repository回帰がgreenなPR候補。

- [ ] **Step 1: `rg -n "notes:|event\.notes|schema version|LATEST_SCHEMA_VERSION|予定.*メモ" README.md docs/superpowers/specs/2026-09-07-zakkuri-calendar-mvp-design.md src`で旧contractがREADME、MVP正本、fixtureのどこに残るか列挙する**
- [ ] **Step 2: 既存test fixtureを`noteDocument`へ更新し、機能一覧・schema・互換性・対象外をREADME/現行docsへ反映する**
- [ ] **Step 3: 依存・型・静的検証を実行する**

Run:

```bash
npm run typecheck
npm run lint
git diff --check
```

Expected: すべてexit 0、error 0件。

- [ ] **Step 4: 全testを実行する**

Run: `npm test -- --runInBand`

Expected: 全suite PASS、失敗0件。

- [ ] **Step 5: DOM/native bundle境界を含むexportを実行する**

Run:

```bash
npx expo export --platform ios --output-dir /tmp/zakkuri-rich-note-ios
npx expo export --platform android --output-dir /tmp/zakkuri-rich-note-android
```

Expected: iOS・Androidともbundle/export成功。署名や実機操作はこのcommandでは確認したことにしない。

- [ ] **Step 6: `git commit -m "docs: 書式付き予定メモの保存仕様を更新"`で文書・fixture調整をcommitする**

- [ ] **Step 7: 設計の受け入れ条件を差分とtestへ1項目ずつ照合し、未実機確認項目をPR本文へ記録する**
