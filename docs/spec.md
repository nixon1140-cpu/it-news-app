# ITニュース行動提案アプリ - 仕様書・設計書

最終更新: 2026-10-11（実装に合わせて全面改訂）。実装と食い違う場合はコードを正とする。

## 1. 目的と守るべき方針
* **目的:** 単なるニュースリーダーではなく「今日何をすべきかが分かる」意思決定ツール。
* **課金ゼロ:** AI推論はローカルの Ollama（モデル `gemma4:e4b-it-q4_K_M`）で行い、外部AIのAPI課金は発生しない。インフラは Supabase 無料枠。
* **外部AIへの受け渡し:** ChatGPT / Gemini / Claude への深掘りは API を呼ばず、プロンプトをクリップボードにコピーして各社の Web 画面を新しいタブで開く方式（貼り付けはユーザーが行う）。
* **Supabase RLS:** 読み取りと書き込みを分離する（詳細は 3.2）。ブラウザ側は anon キー、書き込みはサーバー側（クローラー・シード）の service_role キーのみ。キーは `.env.local` から読む。
* **ポート:** 本番は 3001（`npm run start`）、開発は 3000（`npm run dev`）。`start-app.bat` が「ニュース収集（PC起動ごとに1回）→ビルド→本番起動→ブラウザ表示」を行う。

## 2. 画面・UI
* **テーマ:** 初期はダーク（ネオングリーン基調）。ライト/ダークの切替ボタンあり。
* **モード切替:** ヘッダーで「個人 / 企業」を切替。状態は Zustand persist（localStorage）に保存。
* **ページ:**
  * `/` ダッシュボード：公開から直近7日の記事。
  * `/archive` 過去のニュース：7日より前の記事（`lib/utils/article-recency.ts` で分離）。
  * `/bookmarks` ブックマーク（localStorage）。
  * `/trends` トレンド分析：`/api/trends` が記事上位30件からローカルLLMでトレンド3件を抽出（12時間のメモリキャッシュ。失敗時は古いキャッシュを返す）。
* **並び順:** `priority_label`（High→Mid→Low）、次に `published_at` の新しい順。`importance` は並べ替えに使わない。優先度・カテゴリの絞り込みチップあり。優先度「すべて」のときは最重要/重要/低のセクションに分けて表示。
* **記事カード:** 現在のモードに応じた行動提案のプレビューを表示。モード切替で全カードが即座に切り替わる。
* **記事詳細モーダル（4タブ）:** 要約 / 変化（trend_diff）/ 行動提案（モードで個人向け・企業向けを出し分け）/ 深掘り分析（外部AIへ受け渡し。選択サービスは localStorage に保存）。
* **レスポンシブ:** PCは記事グリッド、スマホは縦1列（ナビも画面幅で切替）。
* **読み込み表示:** データ取得中は Skeleton Loader を表示。

## 3. システム設計
### 3.1 技術スタック
Next.js 16.2.9（App Router）, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Zustand, Supabase, Ollama, rss-parser, Python（trafilatura・rapidfuzz）, Vitest。UI からのデータ取得は `lib/api` に集約し、Supabase クライアントは `lib/supabase`、Ollama は `lib/ollama` に置く。

### 3.2 DB（Supabase `articles` テーブル）
* `id` (UUID, PK), `title`, `url` (TEXT), `summary`, `trend_diff`, `action_individual`, `action_enterprise`, `category`
* `priority_label` (VARCHAR): High / Mid / Low（CHECK 制約）
* `importance` (INT): 1〜5。AI が出した 1〜10 の点数を 2 で割って丸めた値
* `published_at` (TIMESTAMPTZ): RSS の公開日時
* 索引: `(importance desc, published_at desc)`
* 制約: `url` の UNIQUE（`supabase/migrations/002_add_url_unique_constraint.sql` で追加。クローラーの upsert の基準）
* **RLS（行レベルセキュリティ）:** 有効。ポリシーは `Public read access`（SELECT のみ、対象は anon と authenticated）の1つだけ。INSERT / UPDATE / DELETE はポリシーを作らないことで anon・authenticated から拒否し、service_role（RLS を迂回する）だけが書き込める。
* **RLS のテスト:** 別プロジェクトを使う構想で、`.env.test` に `TEST_SUPABASE_URL` / `TEST_SUPABASE_ANON_KEY` を置く。**テストコードは未作成**（progress.md の D1 Step 7）。

### 3.3 データ収集（`npm run crawl` → `src/scripts/crawler.ts`）
1. Ollama の起動待ち（最大120秒）・モデル確認・試し生成。
2. RSS 6本（Zenn, Qiita, はてなブックマーク(IT), Google AI Blog, ITmedia AI+, TechCrunch AI）から合計最大18件を取得。30日より古い記事は除外。1本の取得失敗は他に影響させずスキップ。
3. Python で本文抽出（trafilatura）→ 失敗時は RSS の抜粋を使う。タイトルのあいまい一致（rapidfuzz、類似度90）で重複除外 → 失敗時は除外しない。Python 環境が無い場合は両方スキップ。
4. 1記事ずつ Ollama で推論（要約・変化・行動提案・カテゴリ・優先度・点数を日本語の JSON で出力）。JSON 不正や翻訳漏れの場合は最大2回試す。
5. `url` を基準に Supabase へ upsert。推論・保存に失敗した記事はスキップして続行。

### 3.4 trend_diff の意味
`trend_diff` は **DB の過去記事や前回の収集結果と比較して作った差分ではない**。AI が1記事の本文抜粋だけを読み、「前回や既存技術からの変化・差分」を推測して書いたもの。

### 3.5 ログとエラー処理
* **Ollama 呼び出し（`lib/ollama/client.ts`）:** タイムアウト5分。接続エラーと HTTP 5xx は最大3回試行（待機2秒→4秒、合計60秒以内）。タイムアウトと 4xx は再試行しない。失敗・再試行は JSON 1行の構造化ログ（timestamp, level, logger_name, message, model, attempt, error_type 等）で出力。プロンプトやキーは出さない。
* **起動確認（`lib/ollama/health.ts`）:** 接続不可・モデル未導入は種類別の例外で明示的に失敗。
* **`/api/health`:** アプリ・Ollama（ok / unreachable / model_missing）・モデル名・確認時刻を返す（常に HTTP 200）。
* **クローラー:** 進捗と失敗はコンソールにのみ出力。ファイルやDBには残らない。記事単位の失敗はスキップして続行し、致命的エラーは終了コード1で終了。
* **`start-app.bat`:** `%LOCALAPPDATA%\it-news-app\start-app.log` に時刻付きで記録（収集を実行/スキップした理由、Ollama 待機結果、Docker 起動の成否など）。
* **画面側:** 記事取得失敗はエラー文を表示。`/api/trends` 失敗時は HTTP 500 とエラー文。
* **未整備:** 収集の実行履歴（いつ・何件成功/失敗したか）を後から追える保存先は無い。

## 4. 実装状況
| 項目 | 状態 |
|---|---|
| 過去ニュースの分離（7日で `/archive` へ） | 実装済み |
| 外部AIへのコピー&ペースト受け渡し | 実装済み |
| Ollama の安定化（タイムアウト・再試行・起動待ち・`/api/health`） | 実装済み |
| ソース名の保存（今は `category` のみで、出どころ名の列は無い） | 未実装（予定 G1） |
| 話題度スコア | 未実装（予定 G2） |
| 手動URL投入 | 未実装（予定 G3） |
| 定期実行 | 未実装（予定 G4） |
| RLS テスト | 未実装（D1 Step 7） |

G1〜G4 は progress.md の「G0 の要判断12件」への回答後に着手する。

## 5. 検討中の案（未決定・本文の仕様ではない）
* `priority_label` と `importance` の重複：どちらも AI の出力から作られ、表示・並びに効くのは `priority_label` のみ（`importance` は `/api/trends` の抽出順と索引で使用）。案：片方を廃止、または `importance` を `priority_label` から導出する。
* `source`（出どころ名）、話題度、手動投入を示す列の追加（G1〜G3 と連動）。
* `trend_diff` を過去記事との比較に基づく内容にする。
* クローラーの実行履歴を DB またはログファイルに残す。
* `schema.sql` に `url` の UNIQUE を統合し、migrations との二重管理をやめる。
