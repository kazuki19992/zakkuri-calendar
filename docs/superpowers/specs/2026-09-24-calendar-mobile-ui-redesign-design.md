# iOSモバイルカレンダーUI設計

## 1. 目的

既存の「ざっくりカレンダー」のカレンダー画面を、iOSのモバイルカレンダーに近い視覚階層、情報密度、操作感へ変更する。

特定サービスそのものを複製するのではなく、次の既存価値を最優先で維持する。

1. ざっくり日時を示す縦方向のグラデーション
2. 2日を同時表示し、基準日を1日ずつ移動する連続カルーセル
3. 24時間を初期状態で画面内へ収める表示
4. ライト・ダーク両テーマ、祝日、現在時刻、アクセシビリティ

一般的なモバイルカレンダーから取り入れるのは、Top App Bar、日付ヘッダー、タイポグラフィ、余白、罫線、予定ブロック、FAB、ビュー切替、date pickerの情報設計である。第三者ブランドの名称、ロゴ、アカウント画像、独自フォントは使用しない。

## 2. 優先順位と対象外

優先順位は次のとおりとする。

1. ざっくり日時の範囲とfade表現を壊さない
2. 2日表示と1日単位の連続スワイプを壊さない
3. iOSのモバイルカレンダーに近い見た目と操作階層にする
4. 保守可能な責務分離と意味のある自動テストを保つ
5. 追加的なカレンダー表示機能を検討する

今回の対象外は、DB schema、Repository契約、`CalendarEvent`、`TemporalDefinition`、fade計算規則、予定作成フロー、navigation architectureの全面変更、3日・週ビュー、2日単位paging、新しい大型UIライブラリ、倍率の永続化である。

## 3. 現行実装から維持する境界

次の実装はUI変更のために再設計しない。

- `resolveEventTime`によるexact・fuzzy・未定時間の解決
- `createDayTimelineItems`による位置、高さ、重複レーン、opacity stopの計算
- `computePeakOpacityOffset`と`resolveTextAnchor`による濃い領域上の文字配置
- `undeterminedFadeMinutes`の取得と表示への反映
- `TWO_DAY_SWIPE_BUFFER_DAYS = 1`による前1列・表示2列・後1列の4列構成
- `useTwoDayCarousel`の1日分移動、取得失敗時の復帰、多重入力防止、Reduce Motion対応
- 時刻軸48ptを除いた`day-columns-viewport`からの`columnWidth`計算
- `leadingDate`変更後の`useLayoutEffect`による見えない基準位置同期
- `useNowIndicator`と`computeNowLineTop`
- 画面ルート1か所でのsafe area管理

日付ヘッダーや予定上からも横スワイプできる既存のPanResponder受付範囲を維持する。Pressable、縦スクロール、ピンチ操作を追加する際も、横操作、タップ、縦操作、2本指操作が相互に奪い合わない構成にする。

## 4. コンポーネント構成

```text
CalendarScreen
├─ CalendarTopBar
│  ├─ CalendarViewMenu
│  └─ CalendarDatePicker
├─ TwoDayView
│  ├─ TimelineAxis
│  ├─ TwoDayColumn
│  └─ TimelineEventBlock
├─ MonthGrid
├─ SelectedDayAgenda
└─ CalendarAddEventButton
```

`CalendarScreen`は状態と表示コンポーネントの接続、2日・月ビューの切替、overlayの開閉を担う。Top Bar、ビュー選択、date pickerの表示責務を個別コンポーネントへ分離し、画面ファイルへ描画詳細を集中させない。

`CalendarViewSwitcher`と`CalendarPeriodToolbar`は常時表示から外す。`showPreviousPeriod`と`showNextPeriod`は、既存carousel、月スワイプ、date pickerの月移動などから再利用できる状態で残す。旧UIコンポーネントは参照がなくなり、テスト移行が完了した後に削除する。

## 5. Top App Bar

Top Barはsafe area直下の1行、高さ約52ptとする。

- 左: ハンバーガーボタン
- 中央寄り: 基準日の月名と展開記号。必要な場合だけ小さな年表示
- 右: 今日へ戻るボタン

2日ビューでは`anchorDate`側の月を表示する。`9/30 | 10/1`の場合もTop Barは「9月」とする。月ビューでは`visibleMonth`を表示する。表示年が今日の年と異なる場合だけ、月名の上へ年を小さく補助表示する。date picker内の見出しには年を常に表示する。月名は20〜22pt、操作アイコンは視覚的に小さくしても44pt以上の操作領域を確保する。実在しない機能の三点メニュー、検索、アカウント画像は追加しない。

今日ボタンは`showToday()`を呼ぶ。ロード中や移動中は多重入力を防止し、無効状態を読み上げへ反映する。

## 6. ビュー切替メニュー

左上のハンバーガーから、画面上へ重なるコンパクトなモーダルを開く。

```text
表示
✓ 2日
  月
```

このアプリに存在する2日・月だけを表示する。現在値はチェック、文字、`accessibilityState.selected`で示し、色だけに依存しない。選択時は`selectMode()`を呼んでメニューを閉じる。背景タップ、閉じる操作、Android backでも閉じられるようにする。

空のナビゲーションドロワーや、スケジュール、日、3日、週などのダミー項目は追加しない。

## 7. 月名から開くdate picker

月名を押すとTop Bar直下へdate pickerを重ねる。背後のタイムラインを押し下げず、表示中は背後のカレンダー操作を無効化する。

- 月曜始まりの7列×6行
- 前月・翌月の日も表示
- 前月・次月へ移動する小さな操作
- 今日、選択日、予定あり、土曜、日曜・祝日の既存意味を維持
- 背景タップ、月名の再タップ、日付選択で閉じる

日付セルの見た目とアクセシビリティは、月ビューと共有可能な表示部品へ切り出す。picker固有の表示月は画面内の一時状態とし、開いた時点の`anchorDate`または`visibleMonth`から初期化する。

`useCalendarView`へ`showDate(date)`を追加する。

- 2日ビュー: `anchorDate`と`selectedDate`を選択日にし、予備列を含む表示範囲を取得する
- 月ビュー: `visibleMonth`、`anchorDate`、`selectedDate`を選択日に同期する
- 成功時: pickerを閉じる
- 失敗時: 現在表示を保持し、pickerを開いたまま期間エラーを表示する
- 古い非同期応答が新しい選択結果を上書きしない既存制御を維持する

## 8. 2日ビューの日付・終日ヘッダー

時刻軸の上へ、複数日表示に適した日付ヘッダーを置く。

1. 11〜12ptの曜日
2. 20〜24ptの日付数字
3. 9〜11ptの祝日名または祝日情報未対応
4. compactな終日・未解決予定

今日の日付数字は円形のaccent背景で表す。「今日」という文字ラベルは表示しないが、日付ヘッダーの読み上げには「今日」を残す。月跨ぎ・年跨ぎでも各列の完全な日付を読み上げられるようにする。

日付列はカードとして分離せず、時刻軸と2日分の列が一枚の連続gridに見えるhairline境界を使う。終日予定と、時間軸へ解決できないfuzzy予定はヘッダー下から消さない。

## 9. タイムラインと予定表示

初期状態では現在どおり24時間を画面内へ収める。時刻軸は48ptを維持し、1時間ごとのラベルを10〜11ptで表示する。1時間ごとの罫線は物理ピクセル境界への吸着、0:00〜24:00の25本、下端のクリップ防止を維持する。

罫線と日付列境界は低コントラストのhairlineとし、予定より前面に描画しても主張しすぎない色にする。現在時刻は今日の列だけにaccent色のドットと線を表示し、時刻軸のラベルと位置を揃える。

### 9.1 exact予定

- 小さい角丸
- 少ないpadding
- shadowなし
- 上寄せのタイトルと時刻
- カレンダー用semantic colorによる不透明な背景
- タイムライン上の時間領域として見せ、カード状の外枠を付けない

### 9.2 fuzzy予定

exact予定と同じタイポグラフィ、padding、radiusを基礎とし、既存の`opacityStops`を縦方向の`LinearGradient`へ適用する。開始・終了・外縁のfadeを単色または一様な半透明へ置き換えない。

タイトルと時間表現ラベルは、既存どおり最も濃い領域へ配置する。「午後」の予定を見たとき、正確な開始時刻は未定だが午後の範囲にあることを、文字だけでなく形状と濃淡から理解できることを完成条件とする。

## 10. 2日ビューのピンチ拡大・縮小

ピンチ対象は2日ビューのタイムライン部分だけとする。Top Bar、日付・終日ヘッダー、FAB、月ビューは拡大しない。

```text
固定: Top Bar
固定: 日付・終日ヘッダー
可変: TimelineViewport
      └─ 縦ScrollView
          └─ 時刻軸 + 2日列
```

倍率は永続化せず、2日ビューを開いた初期状態では24時間フィットに戻す。

- 最小倍率: `computeTimelineScale(availableHeight)`が返すフィット倍率
- 最大倍率: `Math.max(fitScale, 1)`。通常のiPhoneでは既存の基準値である1時間56pt相当、すなわち描画倍率1まで拡大できる
- 実効倍率: `fitScale`以上`Math.max(fitScale, 1)`以下
- 表示高変更時: 新しい`fitScale`未満にならないよう補正する
- ピンチ終了時: 範囲外の値を境界へ戻す

拡大後に内容がviewportを超えた場合だけ縦スクロールを有効にする。時刻軸と2日列を同じScrollView内の1行として扱い、縦位置を常に同期する。

既存依存の`react-native-gesture-handler`を使用し、倍率計算とclampを専用hookへ分離する。カルーセルhookには倍率状態を混ぜない。

- 2本指: pinch
- 1本指の縦移動: 拡大時の縦スクロール
- 1本指の横移動: 既存の1日カルーセル
- eventのtap: 予定編集
- 空き領域のdouble tap: 正確な予定作成

横移動の閾値、4列バッファ、移動距離、取得失敗時の復帰、Reduce Motionは変更しない。VoiceOver/TalkBackからも倍率変更できるよう、タイムラインへ「拡大」「縮小」のaccessibility actionを提供する。

## 11. 月ビュー

7列×6行、月曜始まり、前後月の日付、今日、選択日、予定あり、土日祝、`SelectedDayAgenda`を維持する。

- セルごとのカード状borderと角丸をなくす
- 連続した薄いgridとして見せる
- 日付数字と余白を小さくする
- 今日を円形accentで示す
- 選択日は淡い面またはringと読み上げ状態で区別する
- 予定ありは小さなdotで示す
- `SelectedDayAgenda`の余白と文字階層をcompactにする

月ビューも2日ビューと同じTop Bar、view menu、date picker、FABを使用する。月ビューの横スワイプは既存の`useHorizontalSwipeTransition`を継続し、縦ScrollViewの祖先にPanResponderを置く。

## 12. FABとsafe area

`CalendarAddEventButton`の既存作成処理は変更しない。

- 約56×56pt
- 右16〜20pt
- 下端は画面ルートで確保したsafe area内の16〜24pt
- 軽いelevation／shadow
- 細めの`+`
- 明確なpressed state

safe areaは`CalendarScreen`のルート1か所で管理する。子コンポーネントでtop/bottom insetを再加算しない。

## 13. テーマとタイポグラフィ

ライトは白を基調に`#202124`前後の本文、`#5F6368`前後の補助文字、`#DADCE0`前後の境界、青系accentへ寄せる。ダークは黒から濃いグレーの背景、低コントラストgrid、明るい本文、暗背景でも識別可能なevent色とgradientを使用する。

色は既存semantic tokenを使用し、意味が不足する場合だけカレンダー専用tokenを追加する。既存の予定編集画面などが共有するtokenの意味を不用意に変えない。

文字サイズの目安は次のとおりとする。

- Top Bar月名: 20〜22pt
- 曜日: 11〜12pt
- 日付: 20〜24pt
- 時刻軸: 10〜11pt
- 予定タイトル: 11〜14pt
- 予定補助情報: 10〜12pt
- 祝日: 9〜11pt

iOSではsystem fontを使用し、外部の独自フォントを追加しない。

## 14. エラー処理

- 初回取得失敗: 既存の画面全体エラーと再試行
- 期間・date picker移動失敗: 現在表示を維持し、移動を取り消して期間エラーを表示
- carousel取得失敗: 基準位置へ戻す既存挙動を維持
- fuzzy定義不在・日内時間へ未解決: 終日領域へ「ざっくり」として残す
- picker／view menu: 背景タップとOSの戻る操作で安全に閉じる
- ピンチ: 非数・範囲外倍率を表示へ渡さずclampする

予定タイトルなどの個人データをログや外部サービスへ送らない。

## 15. テスト

featureとbug fixは失敗するテストを先に追加し、期待した理由で失敗することを確認してから最小実装を行う。

### 15.1 Top Barとoverlay

- anchorまたはvisible monthに対応する月・年
- 月跨ぎ・年跨ぎ
- 今日ボタン
- 44pt以上の操作領域とaccessibility label
- view menuが2日・月だけを表示する
- 選択状態、切替、背景タップで閉じる
- date pickerの前後月、日付選択、表示維持、取得失敗

### 15.2 2日ビュー

- 常に表示2列、予備列はviewport外
- 時刻軸を除いたviewportの半分をcolumn widthにする
- 左右とも1日だけ移動する
- Reduce Motion、取得失敗、多重入力防止、基準位置同期
- event上からの横スワイプ
- 曜日、日付、今日、祝日、月・年境界
- 現在時刻のdot、線、ラベル

### 15.3 exact・fuzzy予定

- exactは不透明な通常イベント形状
- fuzzyは既存のgradient stopを保つ
- 4種類のfadeと日跨ぎclip
- `undeterminedFadeMinutes`の反映
- temporal definition変更時の位置・高さ・gradient
- 濃い領域への文字配置
- ライト・ダーク双方で意味が失われないこと

### 15.4 ピンチと縦スクロール

- 最小が現在のフィット倍率で、それ未満にならない
- 最大が描画倍率1を超えない
- 表示高変更時の補正
- 拡大時だけ縦スクロール可能
- 時刻軸と2日列が同じ倍率・縦位置になる
- pinch、縦scroll、横carousel、tap、double tapの競合防止
- accessibility actionによる拡大・縮小

### 15.5 月ビュー

- 7列×6行
- 日付選択、今日、選択日、予定dot、土日祝
- `SelectedDayAgenda`連携
- 月横スワイプと縦スクロール

## 16. 検証と完了条件

自動検証は次を実行する。

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
git diff --check
```

UIとgesture変更のため、iOS・Android exportも行う。自動テストやexportは実機の見た目、操作感、パフォーマンス、アクセシビリティの証明にはしない。可能ならiPhone SE相当、標準6.1インチ、大型iPhone、ライト・ダーク、文字拡大、Reduce Motionで確認する。実行できない確認はPRへ未確認事項として明記する。

完了時には次を自己レビューする。

1. 「午後」の予定が時間軸の範囲とfadeから理解できる
2. `9/24 | 9/25`から1回の横スワイプで`9/25 | 9/26`へ連続移動する
3. 初期状態で24時間が現在と同じ高さに収まり、ピンチインしてもそれ未満にならない
4. ピンチアウト後に時刻軸と2日列が同期して縦スクロールする
5. iOSのモバイルカレンダーに近いTop Bar、日付ヘッダー、grid、予定、FAB、情報密度になっている
6. 高密度モバイルUIの外観によって、ざっくり日時、gradient、2日表示、1日移動が弱くなっていない

## 17. 関連

- `docs/superpowers/specs/2026-09-07-zakkuri-calendar-mvp-design.md`
- `docs/superpowers/specs/2026-09-09-two-day-calendar-ui-design.md`
- `docs/superpowers/specs/2026-09-09-time-axis-gradients-design.md`
- `src/features/calendar/screens/calendar-screen.tsx`
- `src/features/calendar/components/two-day-view.tsx`
- `src/features/calendar/hooks/use-two-day-carousel.ts`
- `src/features/calendar/timeline-layout.ts`
