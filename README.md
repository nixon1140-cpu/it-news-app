# IT News Navigator

IT/AI関連のニュースを自動収集し、ローカルLLM（Ollama）で要約・行動提案を生成して表示する、意思決定支援ダッシュボードです。

## コンセプト・制約

- **アプリ本体：API課金ゼロで運用**。アプリ自体が有料API（OpenAI等）を呼び出す実装は一切ありません。AI推論はローカルLLM（Ollama）、DBはSupabase無料枠のみで完結します。
- **UIとデータフェッチの分離**: Supabaseへの問い合わせは `lib/api` にServer Actionsとして集約し、UIコンポーネントは受け取ったPropsを描画するだけです。
- 記事の「深掘り分析」は、このアプリからGemini APIを呼び出す実装（＝アプリ側の従量課金）を避けるため、プロンプトをクリップボードにコピーして [Gemini](https://gemini.google.com/app) を別タブで開く「プロンプト・ハンドオフ」方式を採用しています。この方式は、利用者が既にGeminiのアカウント（無料/Pro等）を持っていることを前提にしており、Gemini自体の利用料金（Proサブスク等）を代替・不要にするものではありません。

## 主な機能

- **ダッシュボード**（`/`）: 優先度（最重要/重要/低）・カテゴリ（AI/Cloud/Frontend/Backend/Infrastructure/Security/General）でのフィルターと、優先度別のセクション表示
- **エンジニア視点/ビジネス視点**の切り替え（ヘッダーのモードトグル。個人向け/企業向けで行動提案の表示を切り替え）
- **ブックマーク**（`/bookmarks`）: 記事をローカル保存して後から一覧参照
- **トレンド分析**（`/trends`）: 直近の記事群からAIが業界トレンドを3件抽出（12時間キャッシュ）
- **記事詳細ダイアログ**: 要約・変化・行動提案タブ＋「深掘り分析」プロンプトハンドオフ

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数（`.env.local`）

```bash
NEXT_PUBLIC_SUPABASE_URL=あなたのSupabaseプロジェクトURL
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon key

# サーバー/バッチ専用（NEXT_PUBLIC_を付けずクライアントバンドルへの漏洩を防止）
SUPABASE_URL=あなたのSupabaseプロジェクトURL
SUPABASE_SERVICE_ROLE_KEY=service_role key（クローラーのUPSERT専用。絶対にクライアントに公開しないこと）
```

DBスキーマは `supabase/schema.sql` を参照し、SupabaseのSQL Editorで実行してください。

### 3. Ollama（ローカルLLM）のセットアップ

1. [ollama.com](https://ollama.com/download) からインストール
2. 使用モデルをpull

   ```bash
   ollama pull gemma4:e4b-it-q4_K_M
   ```

3. Ollamaを起動しておく（`ollama serve`、または常駐アプリとして起動）

#### モデル選定について

現在のクローラーは `gemma4:e4b-it-q4_K_M` を使用しています。当初 `llama3.1:8b` を採用していましたが、日本語のみの記事（翻訳ではなく要約のみが必要なケース）で低頻度に出力が同一文字列の無限反復ループへ陥り破綻する不具合が実機で確認されたため、同じ条件で安定した日本語品質と高速性を両立した `gemma4:e4b-it-q4_K_M` に切り替えました。

### 4. 開発サーバーの起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いてください。

## クローラー（ニュース自動収集バッチ）

```bash
npm run crawl
```

RSSフィード（Zenn/Qiita/はてなブックマーク/Google AI Blog/ITmedia AI+/TechCrunch AI）から記事を取得し、Ollamaで要約・優先度・行動提案を推論してSupabaseへUPSERTします。30日以上前の記事は自動的に除外されます。

Windows起動時に自動実行させたい場合は、タスクスケジューラで以下を設定してください。

- **Ollama起動タスク**: 起動時トリガーで `ollama serve` を実行するバッチファイルを登録（`OLLAMA_MODELS` 環境変数をバッチ内で明示的に設定することを推奨。Machine環境変数だけに依存すると、Ollamaの実行ユーザー（SYSTEM等）によっては反映されないことがあります）
- **クローラー実行タスク**: サインオン時などのトリガーで `npm run crawl` を実行

### クローラーのトラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| `Ollamaに接続できません` | Ollamaが起動していない | `ollama serve` を実行、または自動起動タスクを確認 |
| `Ollama API エラー: 404 Not Found` | 指定モデルが見つからない、または `OLLAMA_MODELS` のパスがズレている | `ollama list` でモデル一覧を確認。`OLLAMA_MODELS` 環境変数が実際のモデル格納フォルダを指しているか確認 |
| `Ollama API エラー: 500 Internal Server Error`（`llama-server binary not found` 等） | Ollama本体のインストールが不完全・破損している | [ollama.com](https://ollama.com/download) からインストーラーを再ダウンロードし、上書きインストール（修復）を実行 |
| 記事の一部が文字化け・支離滅裂な日本語になる | ローカルLLMの非決定性による低頻度の生成崩れ | クローラーは自動リトライ（最大2回）と英語混入検知＋再翻訳を行いますが、稀に残る場合はモデル自体の品質限界です |

## 本番環境への展開

このアプリはローカルLLM（Ollama）に依存しているため、Vercel等のサーバーレス環境へそのまま全機能をデプロイすることはできません。用途に応じて以下のいずれかを選んでください。

### A. 自宅（ローカルPC）で常時運用する（推奨・現状の構成に忠実）

このPC上でアプリとOllama・クローラーをすべて動かし続ける方式です。

```bash
npm run build
npm run start
```

- 同一LAN内から見る場合はこのPCのIPアドレス＋ポート（既定3000）でアクセスできます。
- 社外・他拠点からも見せたい場合は、ポート開放の代わりに [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) 等の無料トンネルサービスで公開すると安全です。
- クローラー（`npm run crawl`）とOllamaはこれまで通りタスクスケジューラでこのPC上に常駐させます。

### B. Vercel無料枠 + Supabaseでダッシュボード部分のみ公開する

`/`（ダッシュボード）・`/bookmarks`・記事詳細は、事前にSupabaseへ保存済みのデータを読むだけなので、Vercelにそのままデプロイできます。ただし **`/trends`（AIトレンド分析）は、リクエスト時にOllamaへ直接アクセスする実装のため、Vercel上では動作しません**（VercelからこのPCのOllamaには到達できないため）。Bも運用する場合は、トレンド生成をクローラーバッチ側で事前計算してSupabaseに保存する方式へ変更する対応が別途必要です（現状未実装）。

## 営業・第三者へのレビュー

実際の画面を見てもらう場合は、まず **`/`（ダッシュボード）** を見てもらってください。ニュースの優先度・カテゴリ分類、AIによる行動提案の見え方が一番伝わりやすいページです。次点で `/trends`（AIトレンド分析）、`/bookmarks`（ブックマーク一覧）の順にご案内すると良いです。

## スクリーンショット

### ダッシュボード

優先度（最重要/重要/低）・カテゴリでのフィルターとセクション分け表示。

![ダッシュボード](docs/screenshots/dashboard.png)

### ブックマーク

![ブックマーク](docs/screenshots/bookmarks.png)

### 記事詳細（行動提案）

要約・変化・行動提案・深掘り分析の4タブ構成。

![記事詳細・行動提案タブ](docs/screenshots/article-detail.png)

### 深掘り分析（プロンプト・ハンドオフ）

API課金なしで、プロンプトをコピーしてGeminiの公式Web画面に貼り付ける方式。

![深掘り分析タブ](docs/screenshots/deep-analysis.png)

![Geminiへの貼り付け例](docs/screenshots/gemini-handoff.png)

### トレンド分析

直近の記事群からAIが抽出したIT業界のマクロトレンド。

![トレンド分析](docs/screenshots/trends.png)

## セキュリティに関する補足

`.env.local`（SupabaseのURL・APIキーを含む）は `.gitignore` で除外されており、これまでGitの履歴にコミットされたことはありません。GitHub上のこのリポジトリからDBの接続情報が漏れることはありません。

## 技術スタック

Next.js 16 (App Router / Turbopack) / TypeScript / Tailwind CSS / shadcn/ui / Supabase / Zustand / Ollama
