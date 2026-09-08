# MVP アプリシェル・月ビュー設計

## 1. 目的

MVPタスク3として、後続の予定作成、日ビュー、週ビューを接続できるアプリシェルと月ビューを構築する。

このタスクで利用者ができることは次のとおり。

1. アプリを開いて当月を確認する
2. 前月・次月へ移動する
3. 今日へ戻る
4. 日付を選択する
5. 選択日の予定と日本の祝日名を確認する
6. 読み込みに失敗した場合は再試行する

関連Issue: [#1](https://github.com/kazuki19992/zakkuri-calendar/issues/1)、[#8](https://github.com/kazuki19992/zakkuri-calendar/issues/8)、[#9](https://github.com/kazuki19992/zakkuri-calendar/issues/9)、[#10](https://github.com/kazuki19992/zakkuri-calendar/issues/10)

## 2. スコープ

### 対象

- Expo Routerの通常の`Stack`を使うアプリシェル
- 月曜始まり・6週間固定の月グリッド
- 前月、次月、今日への移動
- 日付選択
- 表示月の予定読み込み
- 選択日の予定一覧
- 読み込み、空、失敗、再試行状態
- 土曜、日曜、日本の国民の祝日の識別
- 選択日の祝日名とアクセシビリティ表現

### 対象外

- 予定の作成、編集、削除
- 日ビュー、週ビュー
- グラデーション表示
- 設定画面
- 日本以外の祝日カレンダー
- 祝日を避ける期間計算や業務日計算
- Webの動作保証

## 3. 採用ライブラリ

### `react-native-calendars`

月グリッド、月移動、日付選択、マーキングの基盤として使用する。Pure JavaScriptでExpoから利用でき、カレンダー固有の境界条件や操作を独自実装しない。

ライブラリのコンポーネントをrouteやhookから直接操作せず、featureの`MonthGrid`で包む。これにより、表示要件が合わなくなった場合でもfeature内で交換できる。

### `date-fns`

月初、月末、月移動、日付比較、表示用書式に使用する。永続化境界では常に壁時計日付の`YYYY-MM-DD`を使用し、`Date#toISOString()`で日付へ戻さない。

日付変換は`src/domain/calendar/month.ts`へ集約し、UIコンポーネントから直接呼ばない。

### `@gahojin-inc/holiday-japanese`

日本の国民の祝日を実行時通信なしで判定する。祝日は予定ではないためSQLiteへ保存しない。

ライブラリ固有の`Date`と戻り値は`JapaneseHolidayProvider`内へ閉じ込め、アプリ内では次の契約だけを扱う。

```ts
type Holiday = Readonly<{
  date: string;
  name: string;
}>;

type HolidayRangeResult =
  | Readonly<{ status: 'available'; holidays: readonly Holiday[] }>
  | Readonly<{ status: 'unsupported' }>;

interface HolidayProvider {
  list(from: string, through: string): HolidayRangeResult;
}
```

採用時点の上流データは1970年から2050年までを収録している。この範囲はadapter内の定数として明示し、範囲外を祝日なしとは扱わず`unsupported`として返す。月ビュー自体と予定読み込みは継続し、選択日の見出しに`祝日情報未対応`を表示する。

MVPの実装には次の追跡コメントをproviderのcomposition pointへ残す。

```ts
// TODO(v1, #9): 祝日カレンダーと、ざっくり期間・業務日計算への反映を設定可能にする。
```

## 4. 画面とナビゲーション

`src/app/_layout.tsx`は、テーマ、スプラッシュ、DB providerを維持しながら、サンプルのNative Tabsを通常の`Stack`へ置き換える。SDK 57で試験提供されている`ExperimentalStack`は使用しない。

`src/app/index.tsx`は依存関係を組み立てて`MonthCalendarScreen`を配置するだけの薄いrouteとする。サンプルの`explore` routeと不要になったサンプルTab構成は削除する。予定作成や設定の空routeは先行作成しない。

## 5. アーキテクチャ

```text
src/app/index.tsx
  -> MonthCalendarScreen
     -> useMonthCalendar
        -> EventRepository
        -> TemporalDefinitionRepository
        -> HolidayProvider
        -> month domain functions
     -> MonthHeader
     -> MonthGrid
     -> SelectedDayAgenda
```

- routeは依存のcompositionとscreen配置だけを担当する。
- `useMonthCalendar`は表示月、選択日、読み込み、再試行、競合する非同期結果の破棄を担当する。
- domain関数は月範囲と日付遷移を純粋関数として扱う。
- `JapaneseHolidayProvider`は外部ライブラリとの変換だけを担当する。
- 表示コンポーネントは表示用値とcallbackだけを受け取り、Repositoryや外部ライブラリを参照しない。

グローバル状態管理ライブラリは追加しない。SQLiteを予定のsource of truthとし、この画面の状態はfeature hookに閉じ込める。

## 6. 状態とデータフロー

初回表示では端末の壁時計上の今日を、表示月と選択日にする。

- 前月・次月へ移動した場合は、移動先月の1日を選択する。
- カレンダー上の日付を押した場合は、その日を選択する。前後月の日付なら表示月も追従する。
- 「今日」を押した場合は、表示月と選択日を現在日に戻す。
- 表示月が変わるたび、月初から月末までを`EventRepository.listByAnchorRange`で取得する。
- 先に開始した読み込みが後から完了しても、現在の表示月の状態を上書きしない。
- fuzzy予定の表示ラベルは、月内で参照される定義IDを重複排除して取得する。無効化済み定義も`getById`で解決する。
- 永続化された予定は変更せず、選択日に一致するものをhookで抽出して表示する。

## 7. 表示仕様

月グリッドはMVPでは月曜始まりの6週間固定とする。月の高さを安定させ、同一画面下部の予定一覧へ到達しやすくする。

v1では月曜日始まりと日曜日始まりをユーザー設定で選べるようにする。このタスクでは設定や永続化を先行実装せず、`MonthGrid`へ固定値を渡すcomposition pointに次の追跡コメントを残す。

```ts
// TODO(v1, #10): 永続化したカレンダー設定から週の開始曜日を取得する。
```

- 今日: 枠とスクリーンリーダー文言で示す
- 選択日: 背景、選択状態、スクリーンリーダー文言で示す
- 予定あり: dotとアクセシビリティ文言で示す
- 土曜: 青系の文字
- 日曜・祝日: 赤系の文字
- 祝日と選択状態が重なっても、祝日情報をアクセシビリティラベルから失わない

選択日の見出しには日付と、該当する場合は祝日名を表示する。予定行にはタイトルと時間表現を表示する。

- exact: 開始時刻
- allDay: `終日`
- fuzzy: 時間表現定義のラベル
- 定義が見つからないfuzzy予定: `ざっくり`へ安全にフォールバック

このタスクでは祝日を表示情報としてのみ扱う。「来週前半」などの範囲から祝日を除外しない。

## 8. コード表記

- コードコメントは日本語で記述する。
- Jestの`describe`、`it`、`test`に渡す説明文は日本語で記述する。
- 型、関数、変数、ファイル名などのコード識別子は既存方針どおり英語で記述する。

## 9. エラーとプライバシー

- 初回読み込み中はカレンダー操作を成功状態として見せない。
- 読み込み失敗時は予定タイトルやSQLを表示せず、再試行ボタンを表示する。
- 月移動後の読み込み失敗では、別の月の予定を現在月の予定として残さない。
- 祝日providerの対応範囲外は`祝日情報未対応`と表示し、通常日として黙って確定しない。予定読み込みと月操作は継続する。
- 祝日providerが対応範囲内で例外を返した場合は画面読み込み失敗として扱う。
- 予定本文と選択履歴をログや外部サービスへ送信しない。
- 祝日判定は端末内だけで完結する。

## 10. テスト

実装はTDDで進める。

### domain

- 月初・月末、年境界、閏年
- 前月・次月移動
- 今日への復帰
- 壁時計日付がタイムゾーン変換でずれないこと

### holiday adapter

- 元日、振替休日、国民の休日
- 年境界を含む範囲取得
- ライブラリの値を`YYYY-MM-DD`へ変換すること
- 1970年から2050年までをavailableとし、範囲外を`unsupported`として通常日扱いしないこと

### hook

- 初期読み込み
- 月移動と日付選択
- 今日への復帰
- 選択日の予定抽出
- fuzzyラベル解決
- 失敗と再試行
- 古い非同期結果の破棄

### UI / route

- Stack構成
- 月、曜日、選択状態
- 予定あり、空、読み込み、失敗状態
- 土日・祝日の表示
- 祝日名を含むアクセシビリティラベル

最後にrepository全体のtypecheck、lint、testと、iOS・Android exportを実行する。SimulatorまたはEmulatorが利用できる場合だけ実画面を確認し、未確認の場合はPRへ明記する。

## 11. 完了条件

- Issue #8の受け入れ条件を満たす。
- 外部ライブラリの型、Jest、Metro、iOS・Android bundleとの互換性が確認できる。
- UIからSQLite、祝日ライブラリ、日付ライブラリへ直接アクセスしていない。
- v1の設定化がIssue #9と`TODO(v1, #9)`で追跡できる。
- v1の週開始曜日設定がIssue #10と`TODO(v1, #10)`で追跡できる。
- 自動テスト結果と実機・Simulator確認結果を区別してPRへ記載する。
