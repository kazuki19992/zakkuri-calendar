# 予定画面内の書式付きメモの検証記録

## 対象

Issue #62。全画面Modalを予定フォーム内のエディタへ置き換え、予定全体の保存・取消へ統合する。DBの文書JSON・テキスト投影・schema version 7・既存の対応書式とURL制限は維持する。依存追加・migrationはない。

設計: `docs/superpowers/specs/2026-11-17-inline-event-notes-design.md`。計画: `docs/superpowers/plans/2026-11-17-inline-event-notes.md`。

## 自動検証

- `npm run typecheck`: 成功。
- `npm run lint`: 成功、警告なし。
- `npm test -- --runInBand`: 115 suites・984 tests成功。既存のTZ条件付き1 suite・2 testsはskip。
- `TZ=America/New_York npx jest --runInBand --runTestsByPath src/domain/notifications/__tests__/dst.test.ts`: 上記のDST 2 testsが成功。
- `git diff --check`: 成功。
- `npx expo export --platform ios --output-dir /tmp/zakkuri-inline-final-ios --clear`: 成功。DOM bundleを含む。
- `npx expo export --platform android --output-dir /tmp/zakkuri-inline-final-android`: 成功。DOM bundleを含む。

独立レビューを実施し、Important 2件を修正した。native build・実機操作は実行していない。

## 回帰確認

- 文書セッション: 最新本文の応答待ち、古いsession/revision/要求ID、不正payload、5000ms timeout、再試行、離脱後の無効化、空文書のnull正規化。
- DOM境界: 最新JSON取得、IME composition中の保留と確定後の取得、timeout解除後の古い確定イベント、変換失敗、範囲選択中のreadonly。
- 予定hook: 取得待ちの同期ロック、最後の文字、DB・入力エラー後の保持、通知・場所・色の保持、各変更範囲の本文とnotes mask、範囲取消、確認中のDOM固定、メモ再試行と予定保存の競合防止。
- 破棄: 最新本文を比較し、変更あり／変更不明時に予定全体の破棄を1回だけ確認する。保存・削除成功後の戻るでは再確認しない。
- 画面: 本文の常時表示、専用完了なし、準備前の操作遮断、focus中のtoolbar、状態とcommand、disabled変更時の非remount、初回準備失敗の案内、編集後のfatal再読込確認とcheckpoint復元。
- 既存のadapter・文書domain・URL/navigation・toolbar・Repository・全カレンダー・通知等の回帰テストを維持する。旧Modal専用テストは新しい境界のテストへ置き換えた。

新規機能のテストは未実装で失敗することを確認してから実装した。追加で、範囲確認中に固定を解除する問題と、メモ側の再試行へ保存が重なる問題を失敗テストで確認し、修正後の全体成功を確認した。

DOM editorとOSのWebViewはcomponent/hookテストで境界をmockしている。IMEの確定待ちは注入したDOM controllerの状態・イベント順で検証したものであり、実際の日本語キーボードの確定を確認した結果ではない。

## 独立レビューの修正

head `b892a58`に対して一度の独立レビューを行い、Important 2件を検証・修正した。修正前に3 testsの失敗、修正後にその成功と全体984 testsの成功を確認した。Minorの保留指摘はない。

1. Expo DOMはnative props受信ごとにcallback proxyを生成するため、callback依存のeffectがcontroller・購読を再作成し、readyと選択通知の通信ループやIME待機要求の消失を起こす。最新callbackをlayout effectでrefへ反映し、controller・購読はeditor/session単位の寿命へ固定するhookへ分離した。高さ通知もstable callbackへ分けた。proxyだけの更新で初期通知を再送せず、保留したIME要求は最新callbackへ返信することを確認した。
2. 保存成功直後、busy解除の再描画前に戻る操作が走ると古いbusy値が成功済みのrefより先に評価される。成功済みの同期判定を先にし、busyがtrueのrenderでも保存・削除成功後は戻れることを確認した。

レビュー対象外の実際のIME・スクロール・読み上げ・native buildは、次項の未確認事項として維持する。自動検証を実機の証拠へ読み替えず、端末固有の差があれば別途修正する。

## 実機未確認

- iOS／Androidの小画面・横向き・文字拡大・ライト／ダークで本文とtoolbarへ到達できること。
- 日本語・絵文字等の入力直後、未確定のIMEのまま保存・キャンセルし、最後の文字・チェック・書式を失わないこと。
- キーボード開閉、ハードウェアキーボード、toolbarの選択保持、長文のカーソル追従、本文内と予定フォームのスクロール。
- VoiceOver／TalkBackで本文・書式・チェック・リンク・保存・戻る・破棄確認を操作できること。
- ざっくり／きっちり切替、通常／単回／これ以降／全体の保存、再起動後の文書とテキスト投影。
- WebView停止時の復旧案内、再読込確認、最後のcheckpointと未受信文字の違い。

OSのWebView自体が失われた場合、最後にnativeが検証した文書は保持するが、未受信の文字は復元を保証できない。確認後にcheckpointから再読み込みする。アプリ終了後の未保存メモ復元は対象外で、メモだけの永続化は行わない。

## 参照した公式資料

- [Expo SDK 57 Router](https://docs.expo.dev/versions/v57.0.0/sdk/router/)
- [Expo SDK 57のDOM型](https://github.com/expo/expo/blob/sdk-57/packages/expo/src/dom/dom.types.ts): void commandと非同期JSON callbackの境界。
- [Expo DOM Components](https://docs.expo.dev/guides/dom-components/): SDK 57の実ソースとも照合する。
- [Tiptap 3 Editor](https://tiptap.dev/docs/editor/api/editor): 既存のgetJSON/setEditableを利用。
- [react-native-webview 13.16.1 Reference](https://github.com/react-native-webview/react-native-webview/blob/v13.16.1/docs/Reference.md): WebViewの失敗・process終了・スクロール通知。
- [React Navigationの戻る抑止](https://reactnavigation.org/docs/preventing-going-back/): 元のnavigation actionを確認後に再開する。
