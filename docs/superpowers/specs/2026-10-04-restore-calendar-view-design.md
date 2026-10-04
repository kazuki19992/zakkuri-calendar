# 最後に開いたカレンダービューの復元 Design

## 1. 目的

Issue #16として、利用者が最後に正常表示したカレンダービューを端末内へ保存し、次回起動時に同じビューを復元する。

- 2日ビューと月ビューの切替結果を保存する。
- 初回起動、未保存、不正な保存値では2日ビューを表示する。
- 保存済みの月ビューを起動時から直接読み込み、2日ビューを一瞬表示してから切り替わる挙動を避ける。
- 設定の読み書きに失敗しても、カレンダーの基本操作を可能な限り継続する。

本設計は、`2026-09-09-two-day-calendar-ui-design.md`でv1へ分離した表示モード復元を具体化する。

## 2. 対象範囲

### 2.1 対象

- `twoDay`または`month`の最後に正常表示したモードの保存。
- アプリ起動時の保存済みモード復元。
- 未保存、不正値、設定取得失敗時の2日ビューへのfallback。
- 表示切替成功後の設定保存と、保存だけ失敗した場合の非破壊error表示。
- Repository、calendar hook、screen、サイドメニューの回帰テスト。
- Issue #16とREADMEの実装状況更新。

### 2.2 対象外

- 表示していた日付、月、選択日、タイムライン位置、月画面のscroll位置の復元。
- 1日、3日、週など未実装ビューの追加。
- 設定画面へ表示モード項目を追加すること。
- 端末間同期、cloud保存、analytics。
- 週開始曜日、祝日calendar、themeなどIssue #9／#10の設定。
- SQLite schema version、table、column、migrationの変更。

## 3. 採用方針

表示モードの復元と保存は`useCalendarView`が調整する。UIやExpo Router routeからSQLiteへ直接アクセスせず、既存の`SettingsRepository`と`app_settings`を利用する。

比較した案は次のとおりである。

1. **`useCalendarView`で復元・保存する（採用）**
   - calendar表示の初期読み込みと表示切替を担う既存責務へ収まる。
   - routeを薄く維持し、設定と表示dataの順序を1か所で管理できる。
2. **設定専用hookを別に作る**
   - 将来の再利用余地はあるが、現時点の利用箇所はcalendar画面だけであり、2つのhook間のloading、error、競合調整が増える。
3. **routeで設定を先読みする**
   - 初期modeを渡せる一方、routeへ設定loadingと保存責務が漏れ、既存の薄いroute方針に反する。

## 4. DomainとRepository境界

### 4.1 表示モード型

現在feature hook内にある表示モード型を、Repository contractからも参照できる`src/domain/calendar/calendar-view-mode.ts`へ移す。

```ts
export type CalendarViewMode = 'twoDay' | 'month';
```

UI固有の表示文言やiconはdomainへ移さない。新しいビューを追加する場合はunion、validation、fallback、サイドメニューを同じ変更で更新する。

### 4.2 SettingsRepository

`SettingsRepository`へ次のcontractを追加する。

```ts
getLastCalendarViewMode(): Promise<CalendarViewMode>;
setLastCalendarViewMode(
  mode: CalendarViewMode,
  updatedAt: string,
): Promise<void>;
```

SQLite実装は`app_settings`の次の値を利用する。

| 項目 | 値 |
| --- | --- |
| key | `last_calendar_view_mode` |
| value_json | `"twoDay"`または`"month"` |
| default | `twoDay` |

- rowがない場合は`twoDay`を返す。
- JSONとして不正、または既知のunion以外の場合も`twoDay`を返す。
- setterは有効値だけを受け入れ、bound parameterを使ってupsertする。
- 生の不正値をlogや利用者向けerrorへ含めない。
- 汎用key-value tableを再利用するためmigrationは追加しない。

## 5. 初期復元

`useCalendarView`の初期状態は現在と同じ`loading`とする。最初の予定snapshotを取得する前に、保存済み表示モードを読み込む。

```text
getLastCalendarViewMode
  ├─ twoDay / month ─→ 対象モードを初期targetにする
  └─ 取得失敗 ───────→ twoDayを初期targetにする
                              ↓
                    対象期間のsnapshotを取得
                              ↓
                            ready
```

- `twoDay`では今日を`anchorDate`と`selectedDate`にする。
- `month`では今月を`visibleMonth`、今日を`selectedDate`にする。
- `month`を復元する場合も、過去の選択日や表示月は復元しない。
- 設定取得失敗だけではerror画面やalertを表示せず、2日ビューのsnapshot取得を試みる。
- snapshot取得に失敗した場合は、既存どおりcalendar全体の読み込みerrorとretryを表示する。
- retryは確定済みのfallbackまたは復元済みmodeでsnapshotを再取得し、設定読み込みだけを繰り返さない。
- 予定保存後などの`refreshRevision`更新でも現在modeを維持し、保存値を再適用しない。保存失敗後の画面を古い保存値へ戻さないため、設定復元はhookの初期化時に1回だけ行う。

初期`loading`中は`CalendarLoadState`がcalendar本体を表示しないため、2日ビューから月ビューへの視覚的な切替は発生しない。

## 6. 表示切替と保存

別modeを選択した場合は、表示dataの取得を先に完了させ、その後で設定を保存する。

```text
利用者がmodeを選択
        ↓
対象modeのsnapshotを取得
  ├─ 失敗 → 現在modeを維持、保存しない、メニューを維持
  └─ 成功 → 対象modeを表示
                    ↓
          last_calendar_view_modeを保存
            ├─ 成功 → errorを消してメニューを閉じる
            └─ 失敗 → 表示は維持し、errorを出してメニューを閉じる
```

- 同じmodeを再選択した場合はsnapshot取得と保存を行わず、成功としてメニューを閉じる。
- 保存時刻は既存設定と同じく`now().toISOString()`を使う。
- 保存失敗時も`selectMode`は表示切替成功として`true`を返す。これによりサイドメニューは通常どおり閉じる。
- snapshot取得失敗時は`false`を返し、既存の期間取得errorとメニュー維持を保つ。
- 自動retryは行わない。次に異なるmodeの保存へ成功した時点で、最新modeが正になる。

## 7. Error表示とアクセシビリティ

期間取得errorと設定保存errorを混同しないため、`CalendarViewState`へ次を追加する。

```ts
viewModePersistenceError: string | null;
```

保存失敗時の文面は次で固定する。

> 表示設定を保存できませんでした

- `CalendarScreen`のtop bar直下に、既存の期間取得errorと同じ視覚階層で表示する。
- `accessibilityRole="alert"`を付ける。
- 「表示切替に失敗した」と誤解させる文面や、内部error詳細は表示しない。
- 次の設定保存開始時に古いerrorを消し、成功時は`null`を維持する。失敗時は同じ文面を再設定する。
- 初期設定の取得失敗では、このerrorを表示しない。

期間取得errorと設定保存errorが同時に存在する場合は、両方を独立したalertとして表示する。前者は現在の移動操作、後者は次回起動向け設定に関する別の事実であり、一方で他方を消さない。

## 8. 非同期競合とlifecycle

- `selectMode`用の同期的なbusy refを設け、Reactの再描画前に連続入力されても複数のmode切替・保存を開始しない。
- `CalendarSideMenu`は`onSelectMode`のPromise完了まで既存の`isSelecting`を維持し、表示項目とcalendar visibility switchを無効にする。
- mode切替中にmenuが閉じられても、進行中のRepository保存は中断しない。ただしunmount後にReact stateを更新しない。
- 既存の`requestIdRef`で古いsnapshot取得結果を破棄する。設定保存完了も、開始時より新しいmode操作が存在する場合は古いerror状態で上書きしない。
- calendar visibility設定用のbusy/version refとは分離し、異なる設定操作の意味を混ぜない。

## 9. ファイル境界

- `src/domain/calendar/calendar-view-mode.ts`: `CalendarViewMode`型、default、validation。
- `src/domain/calendar/repositories.ts`: SettingsRepository contract。
- `src/data/sqlite/settings-repository.ts`: key、default、parse、upsert。
- `src/features/calendar/hooks/use-calendar-view.ts`: 初期復元、切替後保存、error、競合調整。
- `src/features/calendar/screens/calendar-screen.tsx`: 保存errorの表示だけ。
- `src/features/calendar/components/calendar-side-menu.tsx`: 既存のPromise待機と閉じる条件を維持し、永続化へ直接依存しない。
- `src/app/index.tsx`: Repository注入だけを維持し、設定取得や保存を追加しない。

設定画面、SQLite schema、migration、共有UIは変更しない。

## 10. テスト

### 10.1 Repository

- 未保存時は`twoDay`。
- 保存済み`twoDay`／`month`を取得できる。
- JSON不正、未知の文字列、文字列以外は`twoDay`へfallbackする。
- 有効値をbound parameterでupsertし、再取得できる。
- setterへ不正値が渡された場合は保存しない。

### 10.2 useCalendarView

- 未保存では今日と明日の2日ビューを初期表示する。
- 保存済み`month`では、初回snapshotから今月の月範囲を取得する。
- 設定取得失敗では2日ビューを読み込み、設定errorを表示しない。
- 別modeのsnapshot取得成功後に設定を保存する。
- snapshot取得失敗時はmodeを変更せず、設定を保存しない。
- 設定保存失敗時は新modeを維持し、`true`と固定errorを返す。
- 次の保存成功で設定errorを消す。
- 同じmodeの選択では再取得・保存を行わない。
- 連続操作、unmount、古い非同期完了で新しいstateを上書きしない。
- retry時に初期設定取得を無用に繰り返さない。

### 10.3 UI

- 復元済みmodeがサイドメニューのselected stateへ反映される。
- 設定保存失敗でも切替先のビューを表示し、メニューを閉じる。
- 「表示設定を保存できませんでした」をalertとしてtop bar直下へ表示する。
- 保存中はmode項目とcalendar visibility switchを無効にする。

### 10.4 全体検証

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
git diff --check
```

UIを変更するため、iOS／Android exportも確認する。自動テストとexportから、実機での初回起動、再起動後のSQLite永続化、VoiceOver／TalkBackの読み上げを確認済みとは断定しない。

## 11. 文書とIssue

- READMEの「2日／月の最後に開いた表示を復元する機能はIssue #16」という未実装記述を、実装結果へ更新する。
- `useCalendarView`の`TODO(v1, #16)`は実装と同時に削除する。
- PRは`Closes #16`を含む`develop`向けOpen PRとする。
- PR本文ではcode検証、export、実機未確認を分けて記載する。

## 12. 完了条件

- 初回または不正値では2日ビューで起動する。
- 最後に正常表示し保存できた2日／月ビューを次回起動時に直接復元する。
- 表示data取得失敗時に現在modeと保存値を変更しない。
- 設定保存失敗時も切替後の表示を維持し、固定文面をalert表示する。
- UIとrouteがSQLiteへ直接依存しない。
- 新しいschema migrationや別の永続化経路を追加しない。
- Repository、hook、UIの回帰testと全体検証が成功する。
- 実機未確認事項をPRで明示する。
