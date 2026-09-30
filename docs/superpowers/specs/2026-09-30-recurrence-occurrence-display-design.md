# 繰り返し予定の発生回表示 Design

## 1. 目的

予定へ保存済みの`RecurrenceRuleV1`を要求期間内の発生回へ展開し、2日ビュー、月ビュー、選択日の予定一覧へ表示する。

- 日次、週次、月次、年次の繰り返しを同じdomain境界で扱う。
- 発生回をDBへ複製せず、保存済みシリーズと表示期間から純粋に算出する。
- 同じシリーズの複数発生回へ衝突しない表示keyを付ける。
- 発生回をタップしたときは元シリーズの編集画面を開く。
- 複数日のきっちり予定と終日予定は、各発生回でも元の期間を維持する。
- 月末、年末、うるう年、終了日、回数上限を決定的に扱う。

本設計は`2026-09-25-calendar-event-editor-expansion-design.md`の第4段階後半に当たる。前半の予定編集UIはPR #30で実装済みである。

## 2. 対象範囲

### 2.1 対象

- `RecurrenceRuleV1`から表示期間と交差する発生回を作る純粋domain関数。
- 既存の非繰り返し予定を含む、カレンダー表示向けの統一された発生回型。
- 2日ビューとスワイプ予備列のタイムライン・終日欄。
- 月ビューの予定あり表示。
- 月ビューで選択した日の予定一覧。
- 発生回から元シリーズIDを使う編集導線。
- 繰り返し予定であることを含むアクセシビリティ文言。
- 既存の期間候補query、カレンダー表示hook、表示モデルの接続。

### 2.2 対象外

- 「この予定だけ」「これ以降」の編集・削除。Issue #26で扱う。
- 例外日、除外日、シリーズ分割、個別発生回の永続化。
- 繰り返し規則のUI変更。
- 端末通知の発生回展開と予約。
- 相対日付のざっくり予定。Issue #25で扱う。
- 外部カレンダー形式とのimport／export。
- SQLite schema、migration、indexの変更。
- Repositoryの作成・更新・削除transactionの変更。

編集・削除は引き続きシリーズ全体だけを対象とする。発生回を開いた場合も、編集画面には発生日へ移動した複製ではなく保存済みの元シリーズを読み込む。

## 3. 採用する方式

### 3.1 検討した方式

1. **独立した発生回型を使う（採用）**
   - 元予定ID、表示key、発生開始日、表示終了日、元予定を分離する。
   - すべてのカレンダービューで同じ展開結果を利用できる。
   - 将来、Issue #26の例外識別子を追加しても保存済み予定型を壊さない。
2. **`CalendarEvent`を複製してIDと日付を書き換える**
   - 既存表示関数へ渡しやすいが、永続ID、表示key、編集対象IDが同じfieldへ混在する。
   - 表示用の値を誤ってRepositoryへ保存する危険があり、採用しない。
3. **2日ビューと月ビューで個別に展開する**
   - 変更は局所化できるが、月末、終了条件、countの解釈が重複しやすい。
   - ビュー間で発生日が食い違うため、採用しない。

### 3.2 Domain型

`src/domain/calendar/event-occurrence.ts`へ次の表示用domain型を追加する。

```ts
export type EventOccurrence = Readonly<{
  key: string;
  eventId: string;
  occurrenceStartDate: string;
  occurrenceThroughDate: string;
  isRecurring: boolean;
  event: CalendarEvent;
}>;
```

- `key`: 同じ表示配列内で一意かつ再計算しても安定するopaque key。
- `eventId`: 保存済みの元予定ID。編集・削除routeへ渡す値。
- `occurrenceStartDate`: この発生回の開始日。
- `occurrenceThroughDate`: この発生回が表示上占有する包含の終了日。
- `isRecurring`: アクセシビリティ文言などで繰り返し予定を識別する値。
- `event`: タイトル、時間種別、duration、色、時間表現IDなどを持つ保存済み予定。`anchorDate`や`id`を書き換えない。

発生回keyは、非繰り返し予定では既存IDをそのまま使い、繰り返し予定では元予定IDと発生開始日から作る。keyは将来の形式変更を許すopaque値として扱い、UIやRepositoryで分解しない。

## 4. 繰り返し規則の意味

### 4.1 共通規則

- シリーズの`anchorDate`を繰り返し計算の開始境界とする。
- `anchorDate`より前の発生回は作らない。
- `until`の日付は包含する。その日の条件に一致する発生回を表示できる。
- `count`は期間数ではなく発生回数である。週次で複数曜日を持つ場合は各曜日を1回として数える。
- `count`の先頭は、規則へ最初に一致する`anchorDate`以降の日である。`anchorDate`が週次曜日に含まれなければ、それ自体を1回に数えない。
- 要求期間外へ無制限に発生回を作らない。
- 日付計算はcalendar dateとして行い、固定ミリ秒加算やUTC変換を使わない。
- 同じ入力から同じ順序とkeyを返す。

### 4.2 日次

`anchorDate`から`interval`日ごとに発生する。`anchorDate`は最初の発生回である。

要求範囲が開始日より後の場合は、calendar day差から最初の候補indexを直接求める。開始日から1日ずつ走査しない。

### 4.3 週次

週は既存MVP方針と同じ月曜開始のcalendar weekとして扱う。将来、表示上の週開始曜日を設定可能にしても、保存済み規則の発生日が移動しないよう、`RecurrenceRuleV1` version 1の週周期は月曜開始で固定する。

- `anchorDate`を含む週を周期0とする。
- 周期が`interval`の倍数である週だけを対象にする。
- その週の`weekdays`に一致し、かつ`anchorDate`以降の日を発生回にする。
- 曜日は日曜0から土曜6の既存表現を利用する。
- 複数曜日は日付昇順で展開する。

平日のみは既に`[1, 2, 3, 4, 5]`の週次規則へ正規化されているため、特別な分岐を追加しない。

### 4.4 月次

`anchorDate`の日を基準日とし、`interval`か月ごとに発生する。

- 基準日が対象月に存在する場合だけ発生回を作る。
- 31日を30日や月末へ移動しない。
- 1月31日の毎月予定は、2月を飛ばして3月31日に発生する。
- `count`は実際に作られた発生回だけを数え、存在しない月を数えない。

### 4.5 年次

`anchorDate`の月日を基準とし、`interval`年ごとに発生する。

- 基準月日が対象年に存在する場合だけ発生回を作る。
- 2月29日の毎年予定は、うるう年だけに発生する。
- 2月28日や3月1日へ自動移動しない。
- `count`は実際に作られた発生回だけを数える。

## 5. 複数日の発生回

繰り返し周期は開始日に適用し、各発生回の期間は元予定から維持する。

### 5.1 終日予定

元予定の`anchorDate`から`endDate`までのcalendar day差を保持する。

例: 月曜から水曜までの3日間の毎週予定は、各対象週でも月曜から水曜までを占有する。

### 5.2 固定durationのきっちり予定

元の`startTime`と`duration.minutes`を維持する。`occurrenceThroughDate`は、終了境界がちょうど0時の場合に空の翌日を含めないよう、実際に時間を占有する最後の日とする。

例:

- 月曜23:00から120分: 月曜から火曜まで。
- 月曜00:00から1,440分: 月曜だけ。
- 月曜12:00から2,880分: 月曜から水曜まで。

### 5.3 `instant`、`undetermined`、日内ざっくり予定

開始日の1日だけを発生回期間とする。`undetermined`の表示上のフェードが翌日へ続く場合は既存タイムライン解決に委譲し、繰り返し周期自体の期間を広げない。

### 5.4 要求範囲との交差

開始日だけでなく発生回期間全体で要求範囲との交差を判定する。

```text
occurrenceStartDate <= requestedThrough
AND occurrenceThroughDate >= requestedFrom
```

これにより、表示期間の前に始まった複数日発生回も2日／月ビューへ表示できる。

## 6. 展開APIと処理境界

domainはRepositoryやReactへ依存しない純粋関数を提供する。

```ts
export function expandEventOccurrences(input: Readonly<{
  events: readonly CalendarEvent[];
  from: string;
  through: string;
}>): Result<readonly EventOccurrence[], EventOccurrenceExpansionError>;
```

### 6.1 入力検証

- `from`と`through`は実在するcalendar dateで、`from <= through`を必須とする。
- Repositoryから来る予定は既存row mapperで検証済みとする。
- 公開関数は不正範囲にfield errorを返し、空配列で異常を隠さない。
- 保存済みの不正・未知versionの規則はrow mapperで`null`へfallback済みであり、展開層では有効な`RecurrenceRuleV1`だけを扱う。

### 6.2 非繰り返し予定

要求期間と交差する予定を1つの`EventOccurrence`へ包む。既存予定IDをkeyとし、編集導線の挙動を変えない。

### 6.3 繰り返し予定

規則へ一致する開始日候補を作り、元予定の期間を移動して要求範囲と交差するものだけを返す。返却順は次で固定する。

1. `occurrenceStartDate`昇順。
2. 元予定の`createdAt`昇順。
3. `eventId`昇順。
4. `key`昇順。

### 6.4 計算量

日次と週次は要求範囲付近の周期へ直接移動する。月次と年次はcalendar month／year単位で候補を評価し、日単位では走査しない。

`count`規則では要求期間より前の有効発生数を求める必要がある。日次・週次は周期と曜日数から算出し、月次・年次は有効な基準日だけを月／年単位で数える。4桁年のcalendar date範囲内で決定的に完了し、発生回数に依存して巨大な配列を先に作らない。

返す配列の要素数は要求期間と交差する発生回だけに限定する。安全上の任意件数で正常な発生回を切り捨てない。

## 7. Repositoryと読み込み

既存の`EventRepository.listByAnchorRange`は次を返す。

- 通常予定: `anchor_date`が要求範囲内。
- 繰り返し予定: `recurrence_rule_json IS NOT NULL`かつ`anchor_date <= through`のシリーズ候補。

第3段階で追加済みのqueryとpartial indexを再利用し、SQL、Repository契約、schemaを変更しない。

このため、通常予定の候補取得範囲は既存挙動を維持する。今回保証するのは、要求範囲より前に`anchorDate`を持つ繰り返しシリーズから、要求範囲と交差する発生回を表示できることである。通常予定の候補取得範囲そのものを広げる改善は本設計へ含めない。

`useCalendarView`の`loadSnapshot`で候補予定を取得後、同じ要求範囲を`expandEventOccurrences`へ渡す。展開に失敗した場合は期間読み込み失敗として扱い、壊れた一部だけを黙って欠落させない。

時間表現定義は、展開後の発生回が参照する元予定から従来どおり重複除去して取得する。

## 8. カレンダー表示への接続

### 8.1 Snapshot

`CalendarSnapshot.events`を`CalendarSnapshot.occurrences`へ置き換える。カレンダー非表示時は発生回配列を空にし、祝日表示は維持する。

通常表示、期間移動、表示切替、日付ピッカー用月読み込み、refreshのすべてが`loadSnapshot`を通るため、個別の展開処理を追加しない。

### 8.2 2日ビュー

`createTwoDayViewModels`、`createTwoDayStripViewModels`、`createDayTimelineItems`は`EventOccurrence[]`を受け取る。

- timelineと終日項目の`id`には`occurrence.key`を使う。
- `eventId`には元予定IDを使う。
- 時刻解決は`occurrence.event`の種別と時間を使う。
- 日付差の起点には`occurrence.occurrenceStartDate`を使う。
- 複数日発生回は各日の既存継続表示へ分割する。
- タップ時は`eventId`で既存の`events/[id]`を開く。

祝日、重なりlane、ピンチズーム、スワイプ予備列の挙動は変更しない。

### 8.3 月ビュー

`createMonthDayViewModels`は発生回期間がその日と交差するかで`hasEvents`を決める。繰り返し元シリーズの`anchorDate`では判定しない。

祝日だけの日に予定点を出さない既存挙動を維持する。

### 8.4 選択日の予定一覧

選択日と交差する発生回からagenda itemを作る。

```ts
type AgendaItemViewModel = Readonly<{
  id: string;
  eventId: string;
  title: string;
  temporalLabel: string;
  accessibilityLabel: string;
}>;
```

- `id`は発生回key。
- `eventId`は元予定ID。
- 表示titleと時間labelは既存予定と同じ。
- 繰り返し発生回のアクセシビリティラベルへ「繰り返し予定」を加える。
- 視覚上の追加アイコンや色変更は行わず、現在の情報密度を維持する。

### 8.5 Timeline item

`TimelineItemViewModel`へ`eventId`を追加する。React keyとtest IDは発生回key、押下callbackは元予定IDを使う。

これにより、同じ2日表示内に同じシリーズの発生回が複数あってもkeyが衝突しない。

## 9. 編集・削除導線

- 発生回をタップすると元予定IDで編集モーダルを開く。
- モーダルは保存済みシリーズの`anchorDate`と規則を表示する。
- 保存はシリーズ全体を更新する。
- 削除確認はPR #30で実装済みの「繰り返しシリーズ全体」を維持する。
- 保存・削除成功後は既存のcalendar refreshで候補を再取得し、発生回を再計算する。

発生回の日付を編集画面の開始日に一時表示したり、「この予定だけ」と誤認させる導線は追加しない。

## 10. エラーと境界条件

- 不正な要求範囲はdomain errorとする。
- 行保存時に不正だった繰り返し規則は既存row mapperにより繰り返しなしとして扱う。
- domain展開失敗は期間読み込みerrorへ変換し、予定本文をログやエラーへ含めない。
- `until < anchorDate`は既存event validationで拒否済みである。
- 取得結果が空の場合は従来どおり予定なしを表示する。
- カレンダー非表示では利用者予定の発生回をすべて隠し、祝日は残す。
- 同じシリーズから同じ日付の発生回を複数作らない。
- 複数シリーズが同じ日・時刻に発生する場合は、既存の重なりlaneへ個別項目として渡す。

## 11. アクセシビリティ

- 繰り返し発生回のagenda、timeline、終日項目へ「繰り返し予定」を含む読み上げ文言を付ける。
- 繰り返しであることを色だけで伝えない。
- 視覚上の密度を増やす専用バッジは今回追加しない。
- 発生回のタップ領域と操作roleは既存予定と同じにする。
- 月ビューの日付読み上げでは発生回がある日を従来どおり「予定あり」とする。

## 12. テスト

### 12.1 Domain展開

- 繰り返しなしの予定を1発生回へ包む。
- 日次のinterval、要求範囲前のanchor、until包含、count上限。
- 週次の月曜開始周期、複数曜日、anchor以前の同一週曜日除外、interval、count。
- 平日規則の週末除外。
- 月次の28日、29日、30日、31日と存在しない月のskip。
- 年次の2月29日とうるう年。
- 月末、年末をまたぐ要求範囲。
- 3日間の終日予定が各発生回で3日間を維持する。
- 24時間超のfixed予定がdurationを維持する。
- 終了が0時ちょうどのfixed予定で空の翌日を含めない。
- 表示期間の前に開始し、期間内まで継続する発生回。
- 安定key、元予定ID、並び順、重複なし。
- 不正な要求日と逆転範囲。

### 12.2 表示モデル

- 2日timelineの各発生回が異なるkeyと同じ元予定IDを持つ。
- 2日終日欄で祝日より後に繰り返し予定を表示する。
- 月ビューで発生日と複数日継続日に予定点を出す。
- 発生しない月、until後、count超過の日に予定点を出さない。
- 選択日agendaの押下が元予定IDを返す。
- accessibility labelへ「繰り返し予定」を含める。
- 非繰り返し予定の表示、押下ID、重なりlaneを維持する。

### 12.3 HookとRepository境界

- `listByAnchorRange`へ従来の対象範囲を渡す。
- 範囲より前にanchorを持つ繰り返しシリーズ候補を展開する。
- 期間移動、2日／月切替、日付ピッカー月読み込み、refreshで再展開する。
- カレンダー非表示時に発生回を隠す。
- Repository失敗とdomain展開失敗を期間読み込みerrorにする。
- schema、migration、Repository SQLに差分がないことをscope監査する。

### 12.4 検証

通常の全体検証を行う。

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
git diff --check
```

UI表示モデルと押下導線を変更するため、iOS／Androidのstatic exportも実行する。自動テストとexportは、実機の表示密度、スクロール、性能、VoiceOver、TalkBackを確認した証拠として扱わない。

## 13. 実装境界

- `src/domain/calendar/event-occurrence.ts`: 発生回型、期間計算、規則展開、並び順。
- `src/domain/calendar/__tests__/event-occurrence.test.ts`: 繰り返し規則と境界条件。
- `src/features/calendar/calendar-view-model.ts`: agendaと日付交差判定。
- `src/features/calendar/timeline-layout.ts`: 発生開始日起点のtimeline項目。
- `src/features/calendar/two-day-view-model.ts`: 2日・予備列の発生回表示。
- `src/features/calendar/month-view-model.ts`: 月の日付ごとの発生回判定。
- `src/features/calendar/hooks/use-calendar-view.ts`: snapshot生成時の1回だけの展開。
- `src/features/calendar/components`: 表示keyと元予定IDの分離に必要な最小変更。
- `src/data/sqlite`: 変更しない。
- `src/features/events`: 変更しない。
- `src/app`: route追加・変更を行わない。

## 14. 完了条件

- 日次、週次、月次、年次の発生回が要求期間内だけ展開される。
- `until`と`count`が発生回単位で正しく制限される。
- 複数日の終日・fixed予定が各発生回でも同じ期間を維持する。
- 2日ビュー、月ビュー、選択日一覧が同じ発生回を表示する。
- 同じシリーズの複数発生回でReact keyが衝突しない。
- 発生回のタップで元シリーズ編集画面を開く。
- 非繰り返し予定と祝日の既存表示を壊さない。
- DB schema、migration、Repository SQLを変更しない。
- 端末通知と繰り返し例外を実装しない。
- 自動検証とstatic exportの結果、実機未確認項目をPRへ分けて記載する。
