# 画面内メモ編集の実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 書式付きメモを予定フォームへ埋め込み、予定全体の保存・破棄と一貫して扱う。

**Architecture:** feature内の純粋な文書セッションがDOMとの要求・revisionを管理し、useEventEditorが最新本文取得から既存保存までを調整する。DOM本体・adapter・toolbarを再利用し、routeは保存成功時の遷移だけを組み立てる。

**Tech Stack:** Expo SDK 57 / React Native / Tiptap 3.31.3 / react-native-webview 13.16.1 / Jest。依存・DB形式の追加なし。

**Spec:** `docs/superpowers/specs/2026-11-17-inline-event-notes-design.md`

## Global Constraints

- メモ専用の完了・キャンセルは廃止。予定保存前はインメモリ、schema version 7・EventNoteDocumentV1・許可書式とURL制限を維持。
- 起動時に自動focusしない。本文は120〜320ptを基本に利用可能高さへ制限。44pt・fontScale・Reduce Motionを維持。
- DOMは非同期JSON境界。session/request IDとrevisionで古い応答を捨て、最後の文字とIME確定後の文書を要求する。
- 文書取得timeoutは5000ms。取得中の連打・離脱・編集、範囲選択中の裏編集を抑止する。
- 失敗時も本文を空にしない。初回準備失敗の無編集保存と、編集後の未確定・変換失敗を区別する。
- 実機未確認・native build未実施を自動検証と区別する。

## Review Focus

- nativeへdirty通知が届く直前の保存・取消でも最新本文を取得する（Task 1/3）。
- composition中の保存は確定まで待ち、timeout後の遅延応答で次の保存を壊さない（Task 2）。
- DB失敗・入力エラー・範囲選択取消の後、未保存メモと他項目が残る（Task 3）。
- 再初期化・route離脱後の旧session callbackを受理せず、初回の失敗と編集後の失敗を混ぜない（Task 1/4）。
- タブ変更でDOMを再mountせず、キーボード・文字拡大・小画面でも編集領域へ到達する（Task 4）。

## Task 1: 文書セッションと寸法計算

**Files:** 新規`src/features/events/event-note/inline-note-session.ts`、`inline-note-layout.ts`、各`__tests__`。

**Interfaces:** `InlineNoteSession`: `getSnapshot/subscribe`, `reset(document)`, `attach(transport)`, `ready(sessionId)`, `change({sessionId,revision,document})`, `receive({sessionId,requestId,revision,document})`, `fail(sessionId,kind,requestId?)`, `capture():Promise<Document|null>`, `release()`, `restart()`, `dispose()`。snapshotはsessionId/seed/document/ready/pending/error/everReadyを持つ。transportはrequest/release/blurのcommandだけ。

- [x] 最新要求、変更通知の遅延、旧session/revision、連打、5000ms timeout、不正文書、初回失敗と編集後失敗、再試行・破棄をテストする。
- [x] `npx jest --runInBand --runTestsByPath src/features/events/event-note/__tests__/inline-note-session.test.ts src/features/events/event-note/__tests__/inline-note-layout.test.ts`。Expected: 未実装FAIL。
- [x] 純粋controllerと`computeInlineNoteHeight(content,available)`を実装。高さは利用可能枠内へclampし、120/320ptだけを別定数へ置く。
- [x] 同じコマンドでPASS、`feat(notes): インメモリ文書と最新本文要求を管理`をcommit。

## Task 2: DOMの文書要求・composition・focus・高さ

**Files:** DOM本体/FormattedNoteEditor、`formatted-note-editor-state.ts`、新規`event-note/inline-note-dom-session.ts`とテスト。

**Interfaces:** DOM refへ`requestSnapshot(requestId)`, `releaseSnapshot(requestId)`, `blur`を追加。callbackはsessionId/requestId/revision/documentを返す。文書更新callbackとfocus/height callbackを追加。snapshot処理は純粋DOM controllerへ分離し、editor APIは注入する。

- [x] composition中にはexportせず、composition終了後に最新JSONを変換するテスト、変換失敗・古いrelease・解除後の再要求を先行する。起動時にfocusしないことも検証する。
- [x] `npx jest --runInBand --runTestsByPath src/features/events/event-note/__tests__/inline-note-dom-session.test.ts`。Expected: FAIL。
- [x] DOMは要求時に入力を固定し、composition中ならblurして確定を待つ。compositionend後の次のevent loopでexportし、解除・timeoutからの古いcallbackを無効化する。本文はviewport高さを使わずResizeObserverで測り、fontScaleを反映する。
- [x] 対象テスト・既存adapter/toolbar/navigationテストPASS、`feat(notes): DOMの最新文書取得と埋め込み表示を追加`をcommit。

## Task 3: 予定の保存・破棄とセッションの接続

**Files:** `use-event-editor.ts`、新規`hooks/use-inline-note-session.ts`、`use-event-leave-guard.ts`、各テスト、既存route。

**Interfaces:** useEventEditorのstateへnote sessionを公開。saveは同期lock→session.capture→取得文書を引数とする既存保存処理→finally release。`confirmLeave():Promise<boolean>`と`canLeave`（保存・削除成功）を公開。routeはusePreventRemoveのfeature hookを使用する。

- [x] DOM応答待ちのisSaving、直後の最新本文、空への変更、連打、DB/入力失敗、単回/以降/全体と範囲取消の保持を先行テスト。取消は最新captureを比較し変更があれば1回だけ確認、取得不能も無言で破棄しない。
- [x] hookとleave-guardテストを実行。Expected: 新挙動のFAIL。
- [x] sessionをhookで保持しload時だけreset。saveはsetStateの反映待ちを使わず取得文書でaggregateを作る。usePreventRemoveは保存中を遮断し、成功した保存/削除後の遷移は許可。Androidでキーボードが開いていれば先に閉じる。
- [x] 全editor hook/routeテストPASS、`feat(events): メモを予定全体の保存と破棄へ統合`をcommit。

## Task 4: 画面内編集・toolbar・失敗表示

**Files:** 新規`components/formatted-note-editor/inline-formatted-note-editor.tsx`、画面、native viewport hook、対応componentテスト。未使用になるModal wrapperと専用テストを削除し旧note field/APIを整理。

**Interfaces:** inline componentはsession・disabled・theme・link callbacksを受ける。focus/height/keyboard調整はfeature hook。画面からdevice API・Repositoryを呼ばない。

- [x] 本文が常時表示され専用完了がない、準備失敗の案内、再読込確認、toolbarの選択保持、タブ変更時の非remount、忙しいときdisabledのテストを追加。
- [x] 画面/componentテストFAILを確認してから実装。
- [x] ScrollView内のinline editorと画面下のtoolbarを組み立てる。準備前はoverlayで編集を遮断。既存toolbarを再利用し、focusを奪う初期化を行わない。fatal再読込は最後の文書から、変更不明なら確認してから行う。
- [x] 対象・既存画面テストPASS、`feat(events): 予定フォームへ書式付きメモを埋め込む`をcommit。

## Task 5: 検証・独立レビュー・文書・PR

- [x] typecheck/lint/全Jest/diff check、iOS/Android export、DST専用TZを確認する。
- [x] README・旧メモ設計・本設計・検証記録を更新する。OSのスクロール・IME・アクセシビリティ・再起動は実機未確認として明示する。
- [x] 一度の独立レビューを行い、重要指摘は自分でRED→GREENと全体検証により一回の修正工程で解消する。
- [x] develop向け通常Open PR（Closes #62）を作成しattach。Issue #62と#1を根拠に沿って更新。Botの再レビューは待たない。

## 実行方針

承認済みの継続指示により、計画の再承認は求めない。担当内実装＋最後の独立レビュー1回とする。具体的なDOMとnativeのbridge・スクロールの実機結果は自動テストから推定しない。

- 2026-11-17: Tasks 1〜4完了。文書セッション、IME待機、最新本文の保存、範囲確認中の固定、取消・戻る、inline UIを接続した。全体981 tests成功。独立レビューとPR作成は未完了。

- 2026-11-17: 独立レビューの重要2件を3つの再現テストで修正。全体984 tests・型チェック・lint・iOS export成功。最終Android exportとPR作成を進める。

- 2026-11-17: 最終Android exportも成功。[PR #66](https://github.com/kazuki19992/zakkuri-calendar/pull/66)をdevelop向けOpen PRとして作成し、Issue #62と#1へ実装・自動検証と実機未確認の状態を反映。全タスク完了、マージ待ち。
