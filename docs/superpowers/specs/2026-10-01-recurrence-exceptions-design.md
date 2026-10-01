# 繰り返し予定の個別・途中編集 Design

## 1. 目的

Issue #26として、繰り返し予定の発生回を編集・削除するときに、次の対象範囲を選べるようにする。

- この予定だけ。
- これ以降。
- シリーズ全体。

個別変更を元シリーズの規則へ混ぜず、発生回例外として保存する。「これ以降」は例外の入れ子にせず、現在のシリーズを境界で分割して新しい通常シリーズを作る。分割後のシリーズから、さらに個別例外やシリーズ分割を作成できる構造にする。

本設計は次を前提とする。

- `2026-09-30-recurrence-occurrence-display-design.md`で実装した規則からの発生回展開。
- `2026-09-30-event-editor-ui-design.md`で実装した予定編集画面。
- `2026-09-30-relative-fuzzy-dates-design.md`で定めた、複数日相対予定は繰り返さない境界。

## 2. 対象範囲

### 2.1 対象

- 繰り返し発生回を元シリーズIDと本来の発生日で識別する。
- 個別編集を置換例外、個別削除を削除例外として保存する。
- 「これ以降」の編集でシリーズを分割する。
- 「これ以降」の削除で境界以降を終了させる。
- 現在のシリーズ全体の編集・削除。
- きっちり、終日、日内ざっくり予定で共通の操作境界を使う。
- 個別変更していない項目へ、後続のシリーズ変更を継承する。
- schema version 4への非破壊migration。

シリーズ変更planは、旧シリーズの更新値と削除意図を別々に持つ。
`previousSeries === null`を削除の意味に兼用せず、全体更新で例外のcascade削除を起こさない。

### 2.2 対象外

- 複数日相対予定の意味ベース繰り返し。
- 例外の入れ子。
- 分割前後のシリーズを再結合する操作。
- 複数シリーズを一括編集する操作。
- 外部カレンダーとの例外同期やiCalendar import/export。
- 操作の取り消し、変更履歴、監査ログ。
- 端末通知の予約・解除。通知設定データの保存と継承だけを扱う。

## 3. 利用者向け挙動

### 3.1 編集画面を開く

繰り返し予定の発生回をタップした時点では対象範囲を尋ねない。選択した発生回の日付・内容を通常の予定編集画面へ表示する。

- 通常予定は従来どおり`eventId`で開く。
- 繰り返し発生回は`seriesEventId`と`originalOccurrenceDate`で開く。
- 個別編集で別の日へ移動済みでも、同じ`originalOccurrenceDate`を使って同じ例外を再編集する。
- 例外がない発生回は、元シリーズと発生日から編集表示値を作る。
- 置換例外がある発生回は、シリーズとoverride maskと置換予定から編集表示値を作る。
- 削除例外はカレンダーに表示しないため、通常導線から編集画面を開かない。

### 3.2 保存対象の選択

保存ボタンを押した時点で対象範囲の選択sheetを表示する。sheetをキャンセルした場合は入力を保持して編集画面へ戻る。

繰り返し規則を変更していない場合は、3つすべてを選べる。

- この予定だけ。
- これ以降。
- シリーズ全体。

曜日、頻度、間隔、終了条件など、繰り返し規則を変更した場合は次の2つだけを選べる。

- これ以降。
- シリーズ全体。

「この予定だけ」は選択不可とし、「1件だけの予定には繰り返し設定を適用できません」と説明する。変更した規則を暗黙に無視しない。

### 3.3 削除対象の選択

削除ボタンを押した場合は常に次の3つを表示する。

- この予定だけ: 対象発生回を削除例外にする。
- これ以降: 現シリーズを境界直前までに短縮し、境界以降の例外と置換予定を削除する。
- シリーズ全体: 現在のシリーズ、その例外、置換予定を削除する。

分割前のシリーズと分割後のシリーズは別シリーズである。「シリーズ全体」は現在開いているシリーズだけを対象とし、分割前の過去シリーズへ遡らない。

### 3.4 繰り返し規則変更と既存例外

- タイトル、場所、メモ、色、通知など、繰り返し規則以外だけを変更する場合、対象範囲の既存例外を維持する。
- 「これ以降」で内容だけを変更する場合、境界以降の例外を新シリーズへ付け替える。
- 繰り返し規則を変更する場合は、対象範囲の既存例外をリセットする確認を表示する。
- 「これ以降」の規則変更では境界以降だけをリセットし、過去側の例外を変更しない。
- 「シリーズ全体」の規則変更では現在のシリーズに属する例外をすべてリセットする。

### 3.5 再編集と再分割

- 同じ個別例外を再編集した場合は、既存例外と置換予定を更新する。新しい例外階層を作らない。
- 個別編集済み予定を削除した場合は、置換予定を削除し、同じ元発生日の例外を`deleted`へ変更する。
- 分割後の新シリーズは通常シリーズとして扱い、そこから再び個別編集、個別削除、「これ以降」、シリーズ全体操作を行える。
- シリーズ分割の履歴を利用者へ階層として見せない。

## 4. Domain model

### 4.1 発生回ID

発生回の永続的な識別子は、表示日ではなく元シリーズと規則から生成された本来の開始日を使う。

```ts
type OccurrenceIdentity = Readonly<{
  seriesEventId: string;
  originalOccurrenceDate: string;
}>;
```

`originalOccurrenceDate`は実在する`yyyy-MM-dd`とする。個別編集で日付を変更しても値を変えない。

### 4.2 例外

```ts
type RecurrenceException =
  | Readonly<{
      seriesEventId: string;
      originalOccurrenceDate: string;
      kind: 'deleted';
      replacementEventId: null;
      overrideFields: readonly [];
      createdAt: string;
      updatedAt: string;
    }>
  | Readonly<{
      seriesEventId: string;
      originalOccurrenceDate: string;
      kind: 'replaced';
      replacementEventId: string;
      overrideFields: readonly EventOverrideField[];
      createdAt: string;
      updatedAt: string;
    }>;

type EventOverrideField =
  | 'title'
  | 'temporal'
  | 'location'
  | 'notes'
  | 'color'
  | 'reminders';
```

`temporal`は予定種別、開始日、終了日、開始時刻、長さ、時間表現定義を1単位として扱う。相互依存する日時列を個別maskに分解しない。繰り返し規則は個別例外へ含めない。

`overrideFields`は重複のない安定順へ正規化する。個別編集で値を現在のシリーズと同じへ戻した項目はmaskから外す。置換例外でmaskが空になる場合は例外と置換予定を削除し、通常発生回へ戻す。

### 4.3 置換予定

置換内容は`events`と`event_reminders`へ、繰り返し規則を持たない通常の予定集約として保存する。

- 既存の予定validation、row mapper、通知の並び順を再利用する。
- `replacementEventId`は1つの例外だけから参照できる。
- 置換予定は通常予定検索からそのまま表示せず、例外適用時だけmaterializeする。
- 置換予定の未override項目はsnapshotとして保持しても表示の正にはしない。表示時は現在のシリーズ値を継承する。

### 4.4 materialize

置換例外の表示用予定は純粋関数で作る。

1. 現在のシリーズから対象発生回を作る。
2. maskにない項目はシリーズ発生回から取得する。
3. maskにある項目だけ置換予定から取得する。
4. `temporal`がmaskにある場合は、置換予定の保存済み開始日・終了日・時刻表現を使う。
5. `reminders`がmaskにない場合はシリーズの通知、ある場合は置換予定の通知を使う。

これにより、時刻だけ個別変更した後にシリーズ全体のタイトルを変えても、新タイトルを継承しつつ個別時刻を維持できる。

### 4.5 編集セッションの変更項目

既存例外を開いた場合、画面にはシリーズから継承した値と個別override値が混在する。保存scopeを選んだだけで、過去の個別overrideをシリーズ全体へ広げないようにする。

編集hookは初期materialize値と現在値を比較し、今回の編集セッションで変更された`changedFields`を作る。

- `single`: `changedFields`を既存override maskへmergeし、現在のシリーズ値と一致した項目をmaskから外す。
- `following`: 今回変更した項目だけを新シリーズの基準値へ適用する。以前からある個別overrideは例外として維持する。
- `series`: 今回変更した項目だけを現在のシリーズへ適用する。他の個別overrideをシリーズ値で上書きしない。

今回変更した値と既存override値が新シリーズ値と同じになった場合は、そのmaskを正規化して外す。利用者が明示的に繰り返し規則を変更したかどうかは、`changedFields`とは別に判定する。

### 4.6 mutation scope

```ts
type RecurrenceEditScope = 'single' | 'following' | 'series';
```

domainの純粋plannerは、シリーズ集約、対象発生回、既存例外、編集後集約、scopeを入力とし、次の永続化計画を返す。

- 作成・更新・削除する予定集約。
- upsert・削除・付け替えする例外。
- 元シリーズの終了条件変更。
- 新シリーズの作成。

plannerはSQL、React state、SQLite rowを参照しない。

## 5. 発生回展開

### 5.1 schedule snapshot

カレンダー取得境界は次をまとめて返す。

```ts
type CalendarScheduleSnapshot = Readonly<{
  events: readonly CalendarEvent[];
  exceptions: readonly RecurrenceException[];
  replacementEvents: readonly CalendarEvent[];
}>;
```

`events`は通常予定と元シリーズだけを含み、`replacementEvents`と重複させない。実装時は通知を必要としないカレンダー表示用snapshotと、通知を含む編集用aggregateを分ける。UIへSQLite rowを渡さない。

### 5.2 展開順序

1. 通常予定とシリーズを既存規則で展開する。
2. 各繰り返し発生回を`seriesEventId + originalOccurrenceDate`で例外へ照合する。
3. `deleted`は結果から除外する。
4. `replaced`はmaterializeした予定へ置き換える。
5. 置換後の期間と要求表示期間が交差する場合だけ結果へ含める。
6. 単独予定と置換済み発生回を同じ表示順規則でsortする。

置換予定が別の日へ移動した場合、元発生日が表示範囲外でも移動先が表示範囲内なら取得・表示する。反対に、元発生日が範囲内で移動先が範囲外なら元発生回を抑止し、何も表示しない。

### 5.3 取得範囲

Repositoryは表示候補となる繰り返しシリーズを取得し、そのシリーズに属する例外と置換予定をまとめて返す。例外は通常予定より少ないことを前提に、MVPでは候補シリーズの例外を全件取得してdomainで範囲filterする。これにより、遠い日へ移動した置換予定も欠落しない。

次のindexを用意する。

- `(series_event_id, original_occurrence_date)`の主キーまたは一意index。
- `replacement_event_id`の一意index。
- series単位で例外を取得するindex。主キー順で満たせる場合は重複indexを追加しない。

実測で例外件数が問題になった場合は、元発生日と置換予定期間の両方を使う範囲queryへ変更する。将来最適化のためだけに複雑な先行queryは実装しない。

## 6. 編集操作

### 6.1 この予定だけを編集

1. 元シリーズの対象発生回と現在のmaterialize結果を取得する。
2. 編集後集約との差分からoverride maskを作る。
3. 差分がなければ永続化せず成功扱いにする。
4. 既存置換例外がなければ、繰り返しなしの置換予定と例外を作る。
5. 既存置換例外があれば、同じ置換予定と例外を更新する。
6. 既存削除例外は通常導線から編集しない。

### 6.2 この予定だけを削除

- 例外がなければ`deleted`例外を作る。
- 置換例外があれば、例外を`deleted`へ変更して置換予定とその通知を削除する。
- 同じ元発生日へ例外を追加せずupsertする。

### 6.3 これ以降を編集

境界は選択した発生回の`originalOccurrenceDate`とする。

1. 元シリーズを境界直前で終了させる。
2. 編集後の選択発生回を先頭とする新シリーズを作る。
3. 繰り返し規則を変更していなければ、境界以降の例外を新シリーズへ付け替える。
4. 開始日を移動した場合は、新旧の対応する発生回ordinalを使って例外の元発生日をrekeyする。
5. 繰り返し規則を変更した場合は、確認後に境界以降の例外と置換予定を削除する。

境界発生回に既存例外がある場合も、以前のoverrideを暗黙に新シリーズ全体へ広げない。今回の編集で変更した項目だけを新シリーズへ適用し、既存overrideは新シリーズに属する境界例外として再評価する。新シリーズ値と同じになったoverrideは削除する。

元シリーズの終了条件は、既存の`never`、`until`、`count`にかかわらず、境界直前の`until`へ変換する。境界より前に開始した複数日発生回は保持する。

境界より前に規則上の発生回が1件もない場合は、空の過去シリーズを残さない。例外の付け替えまたはリセット後に元シリーズを削除し、新しい側だけを保存する。「これ以降」の削除で同じ条件になった場合は、現在のシリーズ全体削除と同じ結果にする。

新シリーズの終了条件は次のとおりとする。

- `never`: `never`を維持する。
- `until`: シリーズ全体を日付移動した場合は同じ暦日差だけ終了日も移動する。日付未変更なら元の終了日を維持する。
- `count`: 境界までに規則上消化した回数を差し引き、選択発生回を含む残回数を新シリーズへ設定する。

削除例外も規則上の発生回数には数える。`count`は例外適用前の規則上の回数を表す。

編集後の繰り返し規則が`null`になった場合、新しい側はシリーズではなく選択発生回を基にした通常の単発予定とする。

- `following`: 過去側を境界直前で終了し、選択発生回を単発予定として保存する。境界より後の発生回は作らない。
- `series`: 現在のシリーズと例外を削除し、選択発生回を単発予定として保存する。

いずれも影響範囲を確認画面へ明記する。週・月の相対fuzzyへ変更した場合も、繰り返し規則を持たない単発予定としてだけ保存できる。

### 6.4 シリーズ全体を編集

- タイトルなど内容だけの変更ではシリーズを更新し、例外maskを維持する。
- 既存例外を開いてシリーズ全体を選んでも、今回の編集セッションで変更していない個別overrideをシリーズへ広げない。
- 日付を移動し規則自体を変えない場合は、全例外を発生回ordinalで新しい元発生日へrekeyする。
- 繰り返し規則を変更した場合は、確認後に現在のシリーズの例外と置換予定をすべて削除する。
- 分割前後の別シリーズは更新しない。

週次規則を日付移動する場合、曜日集合を同じ暦日差だけ循環移動する。月次・年次は新しいanchorの日番号・月日を基準に展開する。規則validation後に発生回が作れない場合は保存しない。

### 6.5 これ以降・シリーズ全体を削除

- これ以降: 元シリーズを境界直前の`until`へ変更し、境界以降の例外と置換予定を削除する。
- シリーズ全体: 現シリーズの例外、置換予定、シリーズ予定、各通知を削除する。
- 分割済みの別シリーズを探索して削除しない。

## 7. SQLite

### 7.1 schema version 4

```sql
CREATE TABLE recurrence_exceptions (
  series_event_id TEXT NOT NULL REFERENCES events(id),
  original_occurrence_date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('deleted', 'replaced')),
  replacement_event_id TEXT REFERENCES events(id),
  override_fields_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (series_event_id, original_occurrence_date),
  UNIQUE (replacement_event_id),
  CHECK (
    (kind = 'deleted' AND replacement_event_id IS NULL)
    OR (kind = 'replaced' AND replacement_event_id IS NOT NULL)
  )
);
```

SQLiteの`UNIQUE`は複数の`NULL`を許可するため、複数の削除例外を保存できる。`override_fields_json`の構造はrow mapperで検証し、SQLのJSON関数へ依存しない。

### 7.2 migration

- version 3の既存events、reminders、定義、設定を変更しない。
- `recurrence_exceptions`と必要なindexだけを追加する。
- 既存の繰り返し予定は例外なしのまま従来どおり展開する。
- migrationは1 transactionで一度だけ実行し、再実行しても既存行を上書きしない。
- schema version 4を最後に記録する。

### 7.3 row mappingとvalidation

- 日付、kind、replacementの組み合わせ、override maskを検証する。
- `series_event_id`は繰り返し規則を持つ予定を参照する。
- `replacement_event_id`は繰り返し規則を持たない予定を参照する。
- 置換予定とシリーズは同じカレンダーに所属する。
- 置換予定を別の例外のシリーズとして使わない。
- 不正rowは`CorruptDatabaseRowError`とし、タイトル、場所、メモをerrorへ含めない。

複数tableの意味検証はRepository transaction内で行う。row mapper単体では参照先予定の意味を推測しない。

### 7.4 transaction境界

次は必ず同じexclusive transactionで行う。

- 置換予定・通知と例外の作成または更新。
- 置換予定の削除と削除例外への変更。
- 元シリーズ短縮、新シリーズ作成、例外付け替え。
- 規則変更時の例外・置換予定リセット。
- シリーズ、例外、置換予定、通知の一括削除。

Repositoryは例外行を先に削除して参照を外し、その後に不要な置換予定を削除する。部分成功を許可しない。通常操作でeventsを直接削除して孤立置換予定を作らないよう、削除APIをscope付きcommandへ集約する。

## 8. Repositoryとfeature境界

### 8.1 Repository契約

既存の単体予定CRUDは維持し、繰り返し発生回向けにdomain型の契約を追加する。

- 表示範囲の`CalendarScheduleSnapshot`取得。
- `OccurrenceIdentity`による編集用aggregate取得。
- scope付き編集commandのtransaction適用。
- scope付き削除commandのtransaction適用。

SQL、row、JSON列をfeatureへ公開しない。scope付きcommandは、現在のシリーズと例外をtransaction内で再取得してからdomain plannerへ渡し、編集画面を開いてから保存するまでに状態が変わっていても古いsnapshotを上書きしない。

commandには編集開始時の`expectedSeriesUpdatedAt`と、例外がある場合は`expectedExceptionUpdatedAt`を含める。transaction内の現在値と一致しなければstale errorとしてrollbackし、最新状態の再読み込みを促す。

### 8.2 EventOccurrence

表示用`EventOccurrence`は少なくとも次を区別できるようにする。

- 表示内容のevent。
- 通常予定か繰り返し発生回か。
- 元シリーズID。
- 元発生日。
- 置換例外かどうか。

既存の表示keyは一意性を保つ。置換後の表示日ではなく、シリーズIDと元発生日をkeyの正とし、日付移動後もReact keyと編集対象を安定させる。

### 8.3 feature hook

予定編集hookは次を担当する。

- 通常予定または発生回の編集値を読み込む。
- 初期値と現在値から、繰り返し規則が変更されたかを判定する。
- 保存・削除scope sheetの状態を管理する。
- 規則変更時の例外リセット確認を管理する。
- command実行中の二重送信を同期的に防ぐ。
- 成功後にカレンダーをrefreshして画面を閉じる。
- 失敗時に入力を保持し、再試行可能なprivate errorを表示する。

screenは表示とcallbackに限定し、series分割や例外mergeを行わない。

## 9. UIとアクセシビリティ

- scope sheetの各項目は44pt以上の操作領域を持つ。
- 「この予定だけ」「これ以降」「シリーズ全体」を文字で明示する。
- 選択不可項目は`accessibilityState.disabled`と理由文を持つ。
- 規則変更で例外をリセットする確認は、影響対象が「これ以降」か「現在のシリーズ全体」かを明記する。
- destructiveな削除操作は色だけで示さず、文言と確認を併用する。
- Reduce Motion設定を尊重し、sheet表示に必須の意味をanimationだけへ持たせない。
- screen reader向け発生回ラベルに「繰り返し予定」「個別に変更済み」を必要に応じて含める。

## 10. エラー処理

- シリーズまたは対象発生回が存在しない場合は、予定本文を含まない「予定を更新できませんでした」を表示する。
- 保存対象の発生回が現在の規則から生成できない場合はstale stateとして保存せず、再読み込みを促す。
- 一意制約、外部キー、validation、transaction失敗は成功状態へ遷移させない。
- 失敗後も編集値と選択中scopeを保持し、再試行またはキャンセルできる。
- タイトル、場所、メモ、通知内容をログ、error message、外部サービスへ送らない。

## 11. テスト方針

### 11.1 Domain

- 日次、複数曜日の週次、月次、年次の例外適用。
- 個別削除、個別置換、移動後の再編集。
- override maskの作成、正規化、シリーズ変更の継承。
- 同じ例外の再編集で入れ子や重複を作らないこと。
- 内容変更を伴うシリーズ分割と例外付け替え。
- 規則変更時の例外リセット。
- `never`、`until`、`count`の分割。
- 月末、年末、閏年、存在しない月日、複数日発生回。
- 分割後のシリーズからの再分割。

期待値は手計算したliteralを使い、実装関数でexpectedを生成しない。

### 11.2 SQLite

- schema version 3から4へのmigrationと再実行。
- 例外、置換予定、通知のround-trip。
- 不正kind、日付、mask、参照関係の拒否。
- 移動先だけが範囲内にある置換予定の取得。
- transaction途中失敗時にシリーズ、例外、置換予定、通知がすべて元へ戻ること。
- シリーズ削除後に孤立置換予定が残らないこと。

### 11.3 FeatureとUI

- 発生回の初期値読み込み。
- 保存時までscopeを尋ねないこと。
- 規則未変更時の3選択肢。
- 規則変更時に「この予定だけ」が無効で理由を読めること。
- 例外リセット確認のキャンセルと実行。
- 保存・削除の二重送信防止。
- 失敗時の入力保持。
- 成功後のrefreshとclose。

### 11.4 手動確認

- iOS、Android実機でのsheet操作と戻る操作。
- 小画面、文字拡大、ライト・ダーク表示。
- VoiceOver、TalkBackでscopeと無効理由を理解できること。
- 実端末DBのversion 3から4へのmigration。

自動テスト成功を実機の見た目、操作感、migration成功の証明として扱わない。

## 12. 完了条件

- 繰り返し発生回の保存・削除時に3つの対象範囲を選べる。
- 繰り返し規則変更時は「この予定だけ」を選べず、理由を確認できる。
- 個別編集・削除が元シリーズの規則を壊さない。
- 同じ例外を再編集しても例外の入れ子を作らない。
- 「これ以降」が通常シリーズへの分割として保存され、分割後に再び個別操作と分割を行える。
- 分割後の「シリーズ全体」が現在のシリーズだけを変更する。
- シリーズ全体の変更を、個別overrideしていない項目へ継承する。
- 既存の繰り返し予定と通常予定を失わずschema version 4へ移行できる。
- きっちり、終日、日内ざっくり予定が同じ操作境界で動作する。
- SQLite rowや例外内部構造をUIへ漏らさない。
- lint、typecheck、全自動テストが成功する。
