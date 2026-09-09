# AGENTS.md

このリポジトリで作業するAIエージェントは、Codex、Claude Code、その他の実行環境を問わず、以下のルールに従うこと。`CLAUDE.md`はこのファイルを参照するため、共通ルールの正本は`AGENTS.md`とする。

## 1. プロジェクト概要

「ざっくりカレンダー」は、曖昧な時間表現を扱うExpo + React Native製のローカルファーストカレンダーである。

- MVPの仕様とアーキテクチャは`docs/superpowers/specs/2026-09-07-zakkuri-calendar-mvp-design.md`を正とする。
- 承認済みのタスク設計は`docs/superpowers/specs/`、実装計画は`docs/superpowers/plans/`を確認する。
- Issue、設計書、実装計画、現在のコードが食い違う場合は、推測で進めず差分をユーザーへ示して確認する。
- MVPで対象外にした機能も後から追加できる境界を保つ。ただし、将来用途だけを理由に不要な仕組みを先行実装しない。

## 2. 作業開始時の確認

作業前に、最低限次を確認する。

1. `git status --short --branch`でユーザーや他エージェントの変更を確認する。
2. 関連するIssue、仕様書、実装計画、既存コード、テストを読む。
3. 該当する`.agents/skills/<skill-name>/SKILL.md`または`.claude/skills/<skill-name>/SKILL.md`を読む。
4. Expo APIや依存パッケージを扱う場合は、実装前にExpo SDK 57のバージョン固定ドキュメント`https://docs.expo.dev/versions/v57.0.0/`と対象パッケージの公式資料を確認する。
5. 依存追加時は、Expo SDKとの互換性があるメンテナンス中のライブラリを優先し、独自実装とのトレードオフを説明する。

古い会話、過去のPR、ローカルブランチの状態だけを現在の事実として扱わない。変更され得る情報は、コード、Git、GitHub、公式資料から再確認する。

## 3. Git、worktree、ブランチ

- `develop`を通常開発の統合先、`master`をリリース用ブランチとして扱い、どちらにも直接pushしない。
- 通常タスクは最新の`origin/develop`から開始し、PRのbaseを`develop`にする。
- 分離worktreeは必ず`git gtr new`で作成し、`git worktree add`は使わない。
- Codexのブランチ名は`codex/<task-name>`、Claude Codeは`claude/<task-name>`とする。
- worktree作成前に`git gtr list`と対象ブランチの有無を確認し、同じブランチのworktreeを重複作成しない。
- `.env.local`の内容は表示、推測、生成、コミットしない。元リポジトリに存在する場合は、新しいworktreeにも存在することだけを確認する。
- 各エージェントは自分のworktreeだけを編集し、別エージェントのworktreeや未コミット変更を上書きしない。
- PRがマージされるまでworktreeを保持する。マージ確認後は`post-merge-cleanup`スキルで対象のworktreeとローカルブランチだけを安全に削除する。
- 履歴改変、force push、未コミット変更の破棄、広範囲な削除は、ユーザーの明示承認なしに行わない。

## 4. コミットとPR

1コミットは1つの意味のある変更にまとめる。動かない途中状態や無関係な変更を混ぜない。

コミットメッセージはSemantic Commit Message形式を使う。

```text
type(scope): 日本語の説明
```

- `type`は`feat`、`fix`、`docs`、`test`、`refactor`、`chore`、`build`、`ci`などから選ぶ。
- `scope`は必要な場合だけ英語で付ける。
- 説明部分は日本語で簡潔に書く。

PRは、明示的にDraft指定されない限り通常のOpen PRとして作成する。PR本文は日本語で、少なくとも次を含める。

- 変更の目的と内容
- 主な設計判断と影響範囲
- 実行した検証と結果
- 自動検証では確認できない実機確認項目
- 対応するIssueがある場合は`Closes #<番号>`

リポジトリ設定により、マージ後の作業ブランチはGitHub上で自動削除される。ローカル側はマージ確認前に削除しない。

## 5. 設計原則とレイヤー境界

クリーンアーキテクチャ風の責務分離を維持し、DRY、KISS、SOLIDを意識する。YAGNIは重視するが、MVP後の拡張が合意済みの箇所では、値を外部化できる境界までは確保してよい。

- domainルールと純粋な日付・時間計算: `src/domain`
- Repository契約: domain側の適切な境界
- SQLite、row mapping、migration、Repository実装: `src/data/sqlite`
- feature固有のUI、表示モデル、custom hook: `src/features`
- 複数画面で本当に共用するUI: `src/shared/components`
- Expo Routerのroute: `src/app`。依存を組み立てる薄い層にする。

UIコンポーネントからSQLite、SQL、row型、祝日ライブラリ、業務ルールへ直接アクセスしない。画面操作と非同期調整はfeature custom hookへ、決定的な変換は純粋関数へ分ける。

共通化は実際に複数画面で共有するものに限る。画面固有コンポーネントを早すぎる段階で`src/shared/components`へ移動しない。

## 6. カレンダーと時間表現

- 日付・時刻計算では固定ミリ秒加算を避け、`date-fns`など既存の境界を利用して月末、年末、夏時間を考慮する。
- 週の開始曜日はMVPでは月曜固定だが、後から設定可能にする前提を壊さない。
- 日本の祝日は`@gahojin-inc/holiday-japanese`を`HolidayProvider`境界の内側で利用し、UIやdomainへライブラリ型を漏らさない。
- 「朝」「午後」などの時間範囲、フェード比率、未定時間の長さは、将来設定で変更できるデータとして扱う。画面ごとの条件分岐へ値を重複して埋め込まない。
- 時間表現は色だけで区別せず、タイトル、時間表現ラベル、形状、アクセシビリティ情報を併用する。
- 日跨ぎ、月跨ぎ、年跨ぎ、境界時刻、予定重複を通常ケースとして扱う。
- 月カレンダーのUIは独自コンポーネントを維持し、祝日データ取得だけをライブラリ境界へ委譲する。

## 7. UIとアクセシビリティ

- UIはNotionを参考にした落ち着いたsemantic color tokenを使い、高彩度の原色や画面固有の色を増やさない。
- ライト・ダークの両方で、文字、境界、選択状態、グラデーションの可読性を考慮する。
- 状態を色だけで伝えず、ラベル、枠、太さ、形状、`accessibilityState`などを併用する。
- 操作領域は原則44pt以上とし、小画面、文字拡大、VoiceOver、TalkBackを考慮する。
- アニメーションはOSのReduce Motion設定を尊重する。
- UIは今後変更される前提で、表示コンポーネントへ永続化や業務ロジックを閉じ込めない。

自動テスト、typecheck、export成功だけから実機の見た目、操作感、パフォーマンス、アクセシビリティを確認済みと断定しない。

## 8. SQLiteとローカルファースト

- カレンダーと予定は端末内SQLiteを正とし、サーバーの存在を前提にしない。
- migrationはversion管理し、既存データを壊さず、再実行可能にする。
- schema、migration、seed、row mapper、Repositoryを変更する場合は`db-schema-change`スキルを使う。
- DBに保持する設定値は、既定値、validation、不正値からのfallbackを定義する。
- 予定タイトルなどの個人データをログ、エラーメッセージ、外部サービスへ送信しない。
- 外部同期、分析、クラウド保存を追加する場合は、既存のローカルファースト方針を変更するものとして事前承認を得る。

## 9. 実装とテスト

- featureとbug fixはテストを先に書き、期待した理由で失敗することを確認してから最小実装を行う。
- domain計算、表示モデル、custom hook、Repository、row mapper、migration、重要なUI操作をテストする。
- 外部依存は境界の内側へ閉じ、境界外の純粋な挙動を優先してテストする。
- `describe`、`test`、`it`の説明文は日本語で、期待する挙動や境界条件が分かる文にする。
- コードコメントとJSDocは日本語で書く。自明な処理の説明ではなく、制約や「なぜ」を補足する。
- 実装と矛盾するコメントやTODOを残さない。後続IssueがあるTODOは、可能なら`TODO(v1, #<番号>)`のように追跡先を含める。
- テストが難しい場合は省略せず、責務分離を見直す。端末固有で自動化できない場合だけ、理由と手動確認項目をPRへ記載する。

## 10. 検証

完了報告、commit、push、PR作成の前に、変更リスクに応じて検証する。通常は次をすべて実行する。

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
git diff --check
```

現在の`package.json`にformat check scriptはない。将来追加された場合は、その時点で存在するformat commandも実行する。

UI、Expo設定、native依存を変更した場合は、必要に応じてiOS・Androidのexportまたはローカルdevelopment buildも確認する。buildとexport、実機動作、ストア審査は別の確認結果として報告する。

ローカルdevelopment buildはリポジトリのscriptを使う。

```bash
./scripts/build-local.sh development ios
./scripts/build-local.sh development android
```

scriptはローカルの`eas-cli`、`.env.local`の任意読み込み、`--non-interactive`を前提とする。署名情報が未登録の場合は、先に対話操作でEASへ登録する必要がある。

## 11. ドキュメント

- ユーザー向け挙動、MVP範囲、設計判断、DB schema、設定、ビルド手順を変更した場合は、関連する`README.md`と`docs/`を同じPRで更新する。
- 文書は原則日本語で書き、コード識別子や公式名称だけ英語を使う。
- 実装済み、計画済み、未実装、実機未確認を区別し、予定を完了済みとして書かない。
- 設計書と実装計画は、承認された内容と実際の差分が一致するよう更新する。

## 12. レビューコメント対応

`コメントを取得して修正`と依頼された場合は`pr-review`スキルを使う。

1. PRの最新headとbaseを確認する。
2. GitHub review thread、通常コメント、review bodyを取得する。
3. 指摘を現在のコードで再現・検証し、有効なものだけを修正する。
4. 関連テストを追加または更新し、全体検証を行う。
5. commit、push後に各threadへ日本語で根拠を返信し、解決済みにする。
6. Botの過去レビューが最新headを対象にしているとは限らないため、未解決threadが0件でも最新commitへのレビュー状況を別途確認する。

レビュー提案へ無条件に従わず、仕様、公式資料、実行結果、既存設計と照合する。採用しない場合は技術的根拠を日本語で説明する。

## 13. プロジェクトスキル

該当する作業では次のスキルを使う。`.agents/skills`と`.claude/skills`の同名スキルは同じ手順を保つ。片方を変更した場合は、もう片方も同じPRで更新する。

| スキル | 用途 |
| --- | --- |
| `worktree-setup` | `git gtr`によるタスクworktree作成 |
| `post-merge-cleanup` | マージ確認後のworktree・ローカルブランチ整理 |
| `create-issue` | MVPタスク、bug、改善、backlogのIssue作成 |
| `db-schema-change` | SQLite schema、migration、seed、Repository変更 |
| `add-screen` | Expo Router画面の追加・大幅な再構成 |
| `add-setting` | 永続化するユーザー設定の追加 |
| `pr-review` | PRレビュー、指摘取得、修正、返信、thread解決 |

新しい定型作業をスキル化するときは、Codex用とClaude用を同時に追加し、固有のツール名を除いて同じ安全条件と完了条件を持たせる。
