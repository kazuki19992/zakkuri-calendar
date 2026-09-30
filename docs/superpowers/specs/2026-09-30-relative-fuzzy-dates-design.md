# 複数日相対日付のざっくり予定 Design

## 1. 目的

Issue #25として、「今週中」「来週前半」「下旬」など、複数日にわたる相対日付のざっくり予定を選択・保存・表示できるようにする。

- 相対表現を予定作成時の基準日から具体的な開始日・終了日へ解決し、時間経過では動かない予定として保存する。
- 2日表示と月表示で、固定日付の予定とは異なるラベルと形状を使う。
- 「今週中」の締切曜日を金・土・日から設定できるようにする。
- 設定変更で保存済み予定の期間が変わらないようにする。
- 既存の日内ざっくり予定、終日予定、きっちり予定、繰り返し予定を壊さない。

本設計は`2026-09-07-zakkuri-calendar-mvp-design.md`の相対日付方針を具体化し、`2026-09-30-event-editor-ui-design.md`で後続へ分離したIssue #25を扱う。

## 2. 対象範囲

### 2.1 対象

- 週単位・月単位の標準`TemporalDefinition`の選択と期間解決。
- 「今週中」定義の追加。
- 相対日付選択中の日付入力無効化と解決結果のpreview。
- 解決済み期間と解決条件の予定への保存。
- 期間と重なる予定のRepository検索。
- 2日表示の終日領域と月表示での相対予定表示。
- 設定画面の「今週中の締切曜日」。
- schema version 3への非破壊migration。

### 2.2 対象外

- 利用者による相対日付定義の追加・編集・並べ替え。
- 複数日相対予定の繰り返し。
- 「月初を毎月」のように、各発生期間へ相対定義を再適用する繰り返し。
- 繰り返し予定の「この予定だけ」「これ以降」の編集。Issue #26で扱う。
- 週の開始曜日の設定。今回は既存方針どおり月曜固定とする。
- 外部カレンダー同期、自然言語入力、祝日や営業日を除外する計算。

## 3. 利用者向け挙動

### 3.1 選択肢

ざっくり予定の定義を次のグループで表示する。

- 日内: 朝、午前、昼前、昼ごろ、昼過ぎ、午後、夕方、夜、深夜。
- 週: 今週中、今週前半、今週後半、今週末、来週、来週前半、来週後半、再来週。
- 月: 月初、上旬、中旬、下旬、月末、来月。

既存の`sortOrder`を全体順序の正とし、presentation側で`granularity`ごとの見出しを付ける。定義が無効なグループは見出しごと表示しない。

### 3.2 基準日と日付入力

相対日付の基準日は、予定追加画面を開いた日またはrouteから渡された初期日とする。日内定義の選択中は従来どおり日付を編集できる。週・月定義の選択中は次の挙動とする。

- 日付pickerは値を表示したままdisabledにする。
- disabled状態を色だけで示さず、「相対日付では基準日から期間を決めます」と補足する。
- pickerの直下へ、`10月5日（月）〜10月7日（水）`の形式で解決結果を表示する。
- 相対定義同士を切り替えた場合は、同じ基準日からpreviewを再計算する。
- 日内定義へ戻した場合は、相対定義を選ぶ前の基準日を日付入力へ戻す。

既存相対予定の編集では、保存済みの基準日を使用する。画面を開いた現在日へ置き換えない。これにより、未変更保存で期間が移動しない。

### 3.3 「今週中」

「今週中」は他の固定的な週定義と異なり、設定と選択日を使って解決する。

- 開始日は基準日。
- 終了日は、基準日を含む月曜始まりの週にある設定済み締切曜日。
- 締切曜日は金曜日、土曜日、日曜日のいずれか。
- 既定値は金曜日。
- 基準日が締切曜日より後の場合は、開始日と終了日をともに基準日とする。
- 土日や祝日を営業日として除外する処理は行わない。

予定保存時に利用した締切曜日を解決条件へ保存する。設定を後から変更しても、既存予定の開始日・終了日と保存済み解決条件は変更しない。

### 3.4 繰り返し

日内ざっくり予定では既存の繰り返し機能を維持する。週・月の相対定義を選択中は繰り返し操作をdisabledにし、「複数日のざっくり予定では現在利用できません」と表示する。既に入力中の繰り返し規則は画面内に保持してもよいが、相対定義のまま保存するときは`null`を必須とし、暗黙に異なる規則を保存しない。

将来の意味ベース繰り返しでは、解決済みの日数幅を単純にずらさず、各対象週・月へ定義を再適用する。現行`RecurrenceRuleV1`へ曖昧なflagを追加せず、version付きの新しい規則または明示的な再解決modeとして後続設計する。

## 4. 期間解決

### 4.1 入出力

期間解決はUIやSQLiteから独立したdomain純粋関数とする。

```ts
type RelativeDateResolution = Readonly<{
  referenceDate: string;
  periodAnchorDate: string;
  startDate: string;
  endDate: string;
  parameterSnapshot: Readonly<{
    thisWeekDeadlineWeekday?: 5 | 6 | 7;
  }>;
}>;
```

入力は基準日、`TemporalDefinition`、必要な利用者設定とし、日付文字列は実在する`yyyy-MM-dd`だけを受け付ける。週・月のoffsetは作成時だけ適用し、保存後の表示時に現在日から再計算しない。

### 4.2 週定義

週は月曜日を1、日曜日を7とするISO形式で扱う。固定ミリ秒加算をせず、`date-fns`のcalendar date操作を使う。

- `periodAnchorDate`: offset適用後の週の月曜日。
- `startDate`: `periodAnchorDate`から`startWeekday`まで進めた日。
- `endDate`: `periodAnchorDate`から`endWeekday`まで進めた日。
- 月末、年末をまたいでも同じ規則で解決する。

「今週中」は専用の判別可能なresolver kindで表現し、汎用`week` resolverへ画面固有の例外を埋め込まない。

```ts
type WeekRemainderResolver = Readonly<{
  kind: 'weekRemainder';
  selectionWeekOffset: 0;
}>;
```

締切曜日は定義ではなく、設定から渡して`parameterSnapshot`へ保存する。

### 4.3 月定義

- `periodAnchorDate`: offset適用後の月の1日。
- `monthDays`: 指定開始日から指定終了日まで。`last`は対象月末へ解決する。
- 月に存在しない日番号は対象月末へclampする。
- `monthLastDays`: 対象月末を含む指定日数分を逆算する。
- `next_month`は基準日の翌月1日から翌月末までとする。

閏年、2月、30日・31日のない月、12月から翌年1月への境界を通常ケースとしてテストする。

### 4.4 定義変更時の規則

利用者向け定義編集UIは対象外だが、将来の定義更新規則を次で固定する。

- 定義更新時は、その定義を参照する相対予定を保存済み`periodAnchorDate`の期間内で再解決する。
- selection offsetを現在日へ再適用せず、別の週・月へ移動させない。
- 「今週中」は予定ごとの`parameterSnapshot`にある締切曜日を使い、現在設定を読まない。
- 再解決と定義更新は同じtransactionで行い、1件でも不正な範囲になる場合は全体をrollbackする。
- 既存予定のタイトル、metadata、通知、基準日、繰り返し規則は変更しない。

このリリースには定義更新commandやUIを追加しない。上記は将来のRepository操作が守る不変条件として文書化する。

## 5. Domain model

### 5.1 ざっくり予定

`fuzzy`予定へ包含終了日と任意の解決条件を追加する。

```ts
type FuzzyResolutionContextV1 = Readonly<{
  version: 1;
  referenceDate: string;
  periodAnchorDate: string;
  parameterSnapshot: Readonly<{
    thisWeekDeadlineWeekday?: 5 | 6 | 7;
  }>;
}>;

type FuzzyEventDraft = EventDraftBase & Readonly<{
  temporalType: 'fuzzy';
  temporalDefinitionId: string;
  endDate: string;
  resolutionContext: FuzzyResolutionContextV1 | null;
}>;
```

- `anchorDate`は解決済み包含開始日として維持する。
- `endDate`は解決済み包含終了日とし、`anchorDate`以降を必須とする。
- 日内ざっくり予定は`endDate === anchorDate`、`resolutionContext === null`とする。
- 週・月の相対予定は`resolutionContext`を必須とする。定義を伴わないevent parserだけではgranularityを検証できないため、保存commandで定義と突合する。
- `referenceDate`は編集時の再preview、`periodAnchorDate`は将来の定義変更時の再解決に使う。

`endDate`を保存済み表示期間の正とする。通常のカレンダー表示で定義や設定から再計算しない。定義が取得できない場合も保存済み期間は維持し、ラベルだけ安全なfallbackにする。

### 5.2 発生回

`EventOccurrence`の期間幅計算を拡張し、`fuzzy`では`anchorDate`から`endDate`までを使用する。複数日相対予定は`recurrenceRule === null`を保存条件とするため、初回リリースでは1つの保存済み期間だけを発生回として返す。

既存の日内ざっくり予定はmigration後に開始日と終了日が同じとなり、従来のタイムライン解決を維持する。

## 6. SQLiteとRepository

### 6.1 schema version 3

既存`events.end_date`を終日予定だけでなく、すべての`fuzzy`予定の包含終了日にも使用する。解決条件用に次を追加する。

- `events.fuzzy_resolution_context_json TEXT NULL`

migrationは次を1 transactionで行う。

1. `fuzzy_resolution_context_json`列を追加する。
2. 既存`fuzzy`予定の`end_date`が`NULL`なら`anchor_date`で補完する。
3. 全既存カレンダーへ`this_week`標準定義を`ON CONFLICT DO NOTHING`で追加する。
4. schema version 3を記録する。

新規DBでは標準定義作成関数から`this_week`もseedする。migrationを再実行しても定義を重複させず、既存予定を上書きしない。

### 6.2 row mapping

- `fuzzy_resolution_context_json`はrow mapper内でJSON parseし、versionと全日付、曜日値を検証する。
- 不正JSONや不正な相対予定rowは`CorruptDatabaseRowError`とし、保存内容をerrorへ含めない。
- 既存日内予定の`NULL` contextは正常値として扱う。
- exactとall-day予定ではcontextが`NULL`でなければ不正rowとして扱う。

### 6.3 範囲検索

`listByAnchorRange`は開始日だけでなく、表示期間と交差する非繰り返し予定を取得する。

```sql
anchor_date <= $through
AND COALESCE(end_date, anchor_date) >= $from
```

繰り返し予定は従来どおり元予定の`anchor_date <= $through`を取得し、domainで要求範囲へ展開する。検索結果の並び順は開始日、時刻、作成日時、IDを維持する。必要なindexは実行計画を確認して追加し、将来用途だけのindexは先行追加しない。

### 6.4 設定Repository

`SettingsRepository`へ型付きの次の操作を追加する。

```ts
type ThisWeekDeadlineWeekday = 5 | 6 | 7;

getThisWeekDeadlineWeekday(): Promise<ThisWeekDeadlineWeekday>;
setThisWeekDeadlineWeekday(
  value: ThisWeekDeadlineWeekday,
  updatedAt: string,
): Promise<void>;
```

`app_settings`のkeyは`this_week_deadline_weekday`、JSON値は`5 | 6 | 7`とする。未保存または不正値は金曜日の`5`へfallbackする。setterは不正値を拒否し、runtime値はbound parameterで保存する。設定変更時にeventsを更新しない。

## 7. 予定編集画面

### 7.1 状態と責務

`useEventEditor`が全定義と締切曜日設定を読み込み、選択中定義と基準日からpreviewを構築する。screenは表示済みグループ、disabled状態、preview、callbackだけを受け取り、期間計算やSQLiteへ直接アクセスしない。

相対定義の選択中は次を保証する。

- `isDateEditable`は`false`。
- 解決失敗時は期間欄へerrorを表示し、保存を無効にする。
- 繰り返し規則が残っていれば保存前に`null`へ正規化し、disabled理由を表示する。
- 保存時はpreviewと同じdomain resolverの結果から`anchorDate`、`endDate`、`resolutionContext`を作る。

編集時に定義を変更しなければ、保存済み期間とcontextをそのまま維持する。定義を変更した場合だけ、保存済み`referenceDate`と現在設定を使ってpreviewを作り直す。「今週中」へ変更した時点の締切曜日を新しいcontextへ保存する。

### 7.2 Presentation

既存の設定画面風の帯状フォームを維持し、カードUIは追加しない。定義pickerはグループ見出しと選択checkmarkを持ち、各操作領域は44pt以上とする。

- 日付行はdisabledでも現在の基準日を読み上げる。
- 解決結果は定義名と期間を併記する。
- 選択状態を色だけで示さず、checkmarkと`accessibilityState.selected`を使う。
- screen readerでは「来週前半、10月5日から10月7日、選択中」のように読み上げる。

## 8. 設定画面

現在の最小設定画面へ「ざっくり予定」sectionを追加し、「今週中の締切」行で金曜日・土曜日・日曜日を選択できるようにする。

- 初期表示はRepositoryから読み込み、読込中・失敗・保存中を明示する。
- 選択肢は日本語label、checkmark、selected stateを持つ。
- 保存中の連打は同期的なlockで防ぐ。
- 保存成功後だけ表示値を確定する。失敗時は以前の値を保ち、固定文言で再操作可能なerrorを表示する。
- 設定変更で既存予定を更新しない旨を補足する。

routeはRepository注入とnavigationだけを担当し、状態と非同期調整はsettings featureのhookへ置く。

## 9. カレンダー表示

### 9.1 2日表示

複数日相対予定はタイムラインではなく終日領域へ表示する。固定の終日予定と区別するため、表示モデルへ`kind: 'fuzzyRange'`と期間内位置`single | start | middle | end`を追加する。

- 項目には定義名とタイトルを表示する。例: `来週前半・旅行準備`。
- 外枠を破線にし、開始側・終了側だけ角丸にする。色だけで種別を表さない。
- 表示中の2日が期間途中なら継続形状を使う。
- タップは元予定IDで編集画面を開く。
- accessibility labelには「ざっくり予定」、定義名、タイトル、期間、開始・継続・終了の状態を含める。

日内ざっくり予定は従来どおりタイムライン、祝日は祝日専用項目、通常の終日予定は既存の終日形状を維持する。

### 9.2 月表示

現在の月gridの情報密度を維持するため、cell内へ長い予定名を直接配置しない。

- 固定日の予定は従来の丸いdotを維持する。
- 相対予定がある日は短い破線の丸角barを表示し、固定予定と形状を分ける。
- 固定予定と相対予定が同日にあればdotとbarを両方表示する。
- 日付cellのaccessibility labelへ相対予定の定義名と件数を加える。
- 日付選択後のagendaで`定義名・タイトル`と全期間を表示し、破線枠を使う。

これにより、月全体では形状、選択日のagendaではラベルと形状を併用する。祝日だけの日は従来どおり予定indicatorへ数えない。

## 10. Error処理とアクセシビリティ

- 不明または無効な定義を参照する既存予定は、保存済み期間で表示し、定義labelを「ざっくり予定」へfallbackする。
- resolver失敗、設定読込失敗、保存失敗を利用者の入力内容やDB値を含まない固定文言で表示する。
- 相対期間、disabled日付、繰り返し不可理由をscreen readerでも説明する。
- 操作領域は原則44pt以上とし、文字拡大時は定義と期間を折り返す。
- 色だけで固定予定・相対予定・祝日を区別しない。
- 新しい大きなanimationは追加せず、既存のReduce Motion方針を維持する。

## 11. テスト戦略

### 11.1 Domain

- 月曜始まりの週前半・後半・週末。
- 「今週中」の金・土・日締切と、締切前・当日・締切後。
- 来週、再来週が月末・年末をまたぐケース。
- 上旬・中旬・下旬・月末・来月と、2月・閏年・年末。
- 同じ入力から同じ期間とcontextを返す決定性。
- 不正日付、不一致granularity、不正設定値の拒否。
- fuzzy eventの終了日、context、相対予定の繰り返し拒否。
- fuzzy発生回が保存済み期間全体と交差すること。

### 11.2 SQLite

- version 2から3へのmigrationで既存fuzzy予定の`end_date`が補完される。
- 既存カレンダーへ`this_week`が1件だけ追加され、再実行しても重複しない。
- contextの保存・再読込と不正JSONの拒否。
- 表示範囲より前に始まり、範囲内まで続く予定を取得する。
- 設定の既定値、金・土・日の保存、不正値fallback、setterの拒否。
- 設定変更でevent rowが更新されない。

### 11.3 FeatureとUI

- 定義のグループ表示と選択状態。
- 週・月定義で日付pickerと繰り返しがdisabledになる。
- 定義切替でpreviewが更新され、日内定義へ戻すと基準日を維持する。
- 編集時に現在日や現在設定で保存済み期間が変わらない。
- 設定画面の読込、保存、失敗復帰、連打防止。
- 2日表示の開始・継続・終了形状とlabel。
- 月表示のdot・bar併存、agenda label、accessibility label。

### 11.4 全体検証と手動確認

実装時は少なくとも次を実行する。

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
git diff --check
```

実機ではライト・ダーク、文字拡大、VoiceOverまたはTalkBack、小画面、月末・年末の表示、disabled controlの理解しやすさを確認する。自動テストだけで実機の見た目や読み上げを確認済みとはしない。

## 12. 主な変更境界

- `src/domain/temporal`: 相対期間resolver、resolver config、標準定義。
- `src/domain/calendar`: fuzzy期間・解決context・発生回。
- `src/data/sqlite`: schema version 3、row mapper、Event／Settings Repository。
- `src/features/events`: 定義group、preview、disabled制御、保存変換。
- `src/features/settings`: 締切曜日の設定hookとscreen。
- `src/features/calendar`: 2日・月表示modelとpresentation。
- `docs/superpowers/specs/2026-09-07-zakkuri-calendar-mvp-design.md`: schema version 3と設定一覧を実装時の実態へ同期する。

## 13. 完了条件

- Issue #25の週・月相対定義を作成・編集・保存・再表示できる。
- 「今週中」は既定で金曜日までとなり、金・土・日へ変更できる。
- 設定変更で既存予定が変わらない。
- 保存済み期間が2日表示と月表示の両方へ現れ、ラベルと形状で固定予定と区別できる。
- 既存日内ざっくり予定と既存DBを非破壊で移行できる。
- 複数日相対予定の繰り返しが保存されない。
- 月末・年末・週開始・設定fallbackを自動テストで確認できる。
- 実機未確認項目をPRへ明記する。
