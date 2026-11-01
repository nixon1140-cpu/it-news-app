# it-news-app 作業進捗（2026-11-01 時点）

新しいセッションで続きから再開するためのメモ。秘密の値（キー・パスワード）は書かない。

## 今の状況
- 現在のブランチ: `feature/g4-scheduled-crawl`（G4 の実装6コミット。**未push・未マージ**）。`main` は D1 まで push 済み
- **G4（定期実行）は実装済みだが、本番DBへの `crawl_runs` 作成が済むまで有効にしない**。順序は下の「G4 を有効にする手順」。それまで `start-app.bat` の収集判定は「確認失敗 → 安全側でスキップ」になり、収集は走らない（手動の `npm run crawl` も `crawl_runs` が無いと中止する）
- main に入っている Ollama 安定化（O-1〜O-4）:
  - O-1 Ollamaクライアントにタイムアウト（5分）・リトライ（最大3回、待機2秒→4秒）・keep_alive（30分）
  - O-2 クローラー開始時に Ollama 起動待ち（最大120秒）→ モデル存在確認 → 試し生成（`lib/ollama/health.ts`）
  - O-3 `/api/health`（アプリ・Ollama・モデルの状態を返す）
  - O-4 `start-app.bat` にニュース集め前の Ollama 待機（最大120秒、ping方式、失敗しても起動は止めない）
- `npm test` は10ファイル75件パス（lib=node / components=jsdom の2プロジェクト、外部接続なし）。`python/venv/Scripts/python.exe -m pytest python/tests` は14件パス。`npx tsc --noEmit` も問題なし
- RLS テスト（`npm run test:rls`）は実装済み。`.env.test` に3値（URL / anon / `TEST_SUPABASE_SERVICE_ROLE_KEY`）が揃っているときだけ実行、本番URLと同じなら即停止。テスト用DBに schema.sql（GRANT 込み）を適用済みで、6件パス。実行後に `test-` 行は残らない
- 3001（本番）は古いビルドのまま。`/api/health` を出すには `npm run build` → `npm run start` が必要
- architect-ai 側の進捗メモも更新・push済み（`3fdc412`）

## 終わったこと
- Supabase キーのローテーション（新方式 publishable/secret に交換、旧キー無効化、`.claude/settings.local.json` を追跡解除）。履歴からの除去は未実施（キーは無効化済みのため任意）。**legacy JWT secret も失効済み（2026-11-01）**。`.claude/settings.local.json`（コミット対象外）から古いキー（eyJ で始まる値）を含む許可項目4件を削除済み（バックアップ `.bak` もコミット対象外）
- パスワードファイルを公開履歴から除去済み
- Ollama 修理（0.35.1、トレイアプリのみで起動）。ニュース集め 15/15 件成功。内蔵GPUは遅くなったため元に戻した（CPUのみ、約2.5分/記事）
- Ollama 安定化 O-1〜O-4（上記）
- `/api/trends` も新モデル `gemma4:e4b-it-q4_K_M` を使用
- D1: Vitest 環境分離 / extractJson テスト追加 / pytest 導入（`python/tests`、保存済みHTML）/ `schema.sql` に url UNIQUE を統合（再実行可）/ RLS テスト / spec 更新
- G4（実装のみ。未適用）: `schema.sql` に `crawl_runs`（部分一意索引で二重実行を防止、RLS 有効・ポリシーなし、service_role のみ）/ `lib/crawl/`（記録・時間上限つきループ・スキップ判定・伏せ字・ローカルログ・Supabase 版ストア）/ crawler が開始・終了を記録（全体の時間上限1時間50分、Ollama 呼び出しごとに残り時間を再計算、残り30秒未満は未処理として打ち切り）/ `npm run crawl:check`（終了コード 0=実行・10=スキップ）/ `start-app.bat` を起動時刻マーカーから crawl:check に置き換え / `scripts/run-crawl.bat` と `scripts/register-crawl-task.ps1`（登録は手動）

## 残っている課題
1. 実機で `start-app.bat` 全体とクローラーを通しで動かす確認は未実施
2. `.claude/settings.local.json` は公開履歴に残っている（キーは無効。履歴除去は任意）
3. `npm audit` の重大・高の脆弱性（Next.js 16.2.9 など）
4. `extractJson` は null/undefined を渡すと TypeError（既知・未修正）。空文字は空文字を返し、例外は後段の JSON.parse で出る（現行動作をテストで固定）
5. G0 の要判断12件は回答済み（docs/spec.md 5.1 参照）。G1〜G5 は未着手（5.2 に未決定の案が残る）
6. 環境変数 OLLAMA_MODELS のマシン側とユーザー側で値が違う（トレイ起動のみなら実害なし）
7. Ollama API エラーは、PC再起動後は発生していない。6番（OLLAMA_MODELS のずれ）と関係している可能性があるので、再発したら6番から確認する
8. `schema.sql`（articles の GRANT と `crawl_runs`）は本番DBには未適用。G4 を有効にするため、下の手順で本番に流す（本番は it-news-app 専用・anon の書き込みは無いので、articles の権限変更によるアプリへの影響は無い見込み）
9. 重複判定の「失敗時に除外しない」動作は crawler.ts 側にあり、テスト未整備（pytest は終了コード1・標準出力なしまで確認）
10. `supabase/migrations/002` は schema.sql に統合済み。既存DB向けの履歴として残している（新規DBでは実行しない）
11. G4 の bat / ps1 は自動テストできない（`register-crawl-task.ps1` は構文とログオン時刻の解釈のみ確認、`start-app.bat` は未実行）。手動確認は上の手順5〜7
12. 上限（1時間50分）を超えて長引いた場合の安全策は「`finishRun` が自分の id かつ running の行だけ更新し、0件ならローカルログに残す」まで。実行中の定期的な生存記録（ハートビート）は無い
13. `last_boot_marker.txt` は使わなくなったが、`%LOCALAPPDATA%\it-news-app\` に残っている（削除は任意）
14. `npm run lint` は以前からの5エラー（components 配下の5ファイルで「effect 内の setState」）と警告8件が残っている。G4 の変更とは無関係で、今回は触っていない

## 次にやること
1. 下の「G4 を有効にする手順」を実施（テストDB → 本番DB → 手動確認 → タスク登録）
2. G4 を main にマージ・push（承認後）
3. G1 → G2 → G5（G3 は G1 の `source` 列の後）。決定内容は docs/spec.md 5.1
4. 必要なら 3001 を再ビルドして `/api/health` を確認

## G4 を有効にする手順（すべてユーザーが手で実施。AI は本番に実行しない）
1. **テスト用DB**: SQL Editor に最新の `supabase/schema.sql` 全文を貼って実行 → もう一度実行（2回とも成功すること）→ `npm run test:rls`（articles 6件＋crawl_runs 5件が全部パスすること。**crawl_runs 側は実DBで未確認**）
2. **本番の事前確認（読み取りのみ）**: ①`select conname from pg_constraint where conrelid='public.articles'::regclass;` に `articles_url_unique` があること（無い／名前が違うと schema.sql が重複した一意制約を作ろうとする）②現在の権限を控える `select grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='articles';`（元に戻す材料）③クローラーが動いていないこと
3. **本番に適用**: SQL Editor で `supabase/schema.sql` 全文を実行 → ②の権限確認をもう一度実行して差分を見る（anon / authenticated は SELECT のみ、service_role は全権限になる）。`crawl_runs` が作られること
4. **画面確認**: `/`・`/archive`・`/trends`・ブックマークが表示されること。戻すときは控えた権限を `GRANT ... ON public.articles TO anon, authenticated;` で戻す
5. **手動確認**: ①`npm run crawl:check`（終了コード 0 か 10。`echo %ERRORLEVEL%`）②Ollama を止めた状態で `npm run crawl` → 失敗で終わり、Supabase 管理画面の `crawl_runs` に `failed` が残る ③2つ同時に `npm run crawl` → 後の方が「別の収集が実行中」でスキップ ④通常の `npm run crawl` が最後まで通り `success` が残る
6. **タスク登録**: PowerShell で `.\scripts\register-crawl-task.ps1`（既定 12:00。変更は `-At 07:30`、解除は `-Remove`）→ `Get-ScheduledTask -TaskName it-news-app-crawl` で確認
7. 実機で `start-app.bat` を通しで動かし、`%LOCALAPPDATA%\it-news-app\start-app.log` に判定の理由（`crawl:check exit code=...`）が出ること

## 作業ルール（このプロジェクト）
- コミット前にブランチ確認、`git add` はファイル名指定（`-A` は使わない）、コミット後 `git show --stat` で README/.env の混入確認
- push は承認後。秘密の値は表示・保存しない
- 同じエラーを2回直しても解決しなければ止めて報告（Opus 5.5 の新セッション切替の意見も添える）

## G0 要判断12件（回答済み（spec 5.1 参照））
注意: 元の G0 提案書（20件・要判断12件）の一覧は、リポジトリにも git 履歴にも残っていなかった。ここでは docs/spec.md の 4章（G1〜G5）と 5章（検討中の案）から、決めるべき点を12件に**再構成**した。元の一覧と違う点があれば、その差分も教えてほしい。**回答は docs/spec.md 5.1 に反映済み。以下は当時の論点・選択肢・推奨案の記録で、決定内容と違う場合は spec 5.1 を正とする。**

### 1. 出どころ名（source）の持ち方【G1】
- 論点: 記事の出どころ（Zenn・Qiita など）をどう保存するか。
- 選択肢: A) `articles` に `source` 列（文字列）を追加 / B) 別テーブルで管理 / C) 持たない（カテゴリのまま）
- 推奨: A。列は1つで済み、画面の表示も簡単。既存記事は空（NULL）のままにして、新しい記事から入れる。

### 2. 既存記事の出どころの埋め直し【G1】
- 論点: すでにある記事の source をどうするか。
- 選択肢: A) 空のまま / B) URL のドメインから推定して一括更新 / C) 全記事を取り直す
- 推奨: B。URL から推定でき、取り直し（約2.5分/記事のAI処理）のコストが要らない。実行は1回だけ。

### 3. 収集元（RSS）の数と範囲【G1】
- 論点: 今の6本のまま増やすか。
- 選択肢: A) 6本のまま / B) 数本追加（インフラ・クラウド系など、画面に出ているカテゴリで記事が少ないもの） / C) 設定ファイルで増減できるようにする
- 推奨: A のまま G1 を終え、C（設定ファイル化）を次に検討。AI処理が約2.5分/記事なので、増やすと収集時間が直接伸びる。

### 4. 話題度の指標【G2】
- 論点: 何を「話題度」とするか。
- 選択肢: A) はてなブックマーク数の7日間の増加量（無料・キー不要） / B) A に加えて Qiita のいいね数などを合算 / C) X（旧Twitter）の投稿数
- 推奨: A。spec の案と同じ。C は有料・規約の面で課金ゼロの方針に合わない。

### 5. 話題度の保存と保存期間【G2】
- 論点: 毎日の数を残す場所と期間。
- 選択肢: A) `article_metrics`（article_id, measured_at, hatena_count）に毎日1行 / B) `articles` に最新値だけ上書き / C) 保存しない
- 推奨: A。増加量を出すには履歴が必要。保存期間は30日（古い行は自動削除）。無料枠の容量を守る。

### 6. 並び順と優先度（priority_label / importance）の整理【G2】
- 論点: 並びを決める値が2つ（priority_label と importance）あり、効くのは priority_label だけ。話題度をどこに入れるか。
- 選択肢: A) 今のまま、話題度は表示だけ / B) priority_label の中で話題度の高い順に並べる / C) importance を廃止し、priority_label と話題度から並びを決める
- 推奨: B。見た目が最小の変更で、`/api/trends` が importance を使っているので C はまだ早い。

### 7. 手動URL投入の入口【G3】
- 論点: どこから記事を入れるか。
- 選択肢: A) 画面に入力欄を作る（サーバー側APIで書き込み） / B) コマンド（`npm run add -- <URL>`） / C) 両方
- 推奨: B。書き込みは service_role の鍵が要り、鍵をブラウザに出せない。A にする場合は API route を作り、誰でも使えないよう保護が必要で、手間が大きい。

### 8. 手動投入した記事の扱い【G3】
- 論点: 自動収集の記事と区別するか。同じURLが既にある場合は。
- 選択肢: A) `source` を `manual` にして区別、既存URLなら上書き / B) 区別しない、既存URLならスキップ / C) 区別しない、上書き
- 推奨: A。#1 の source 列でそのまま実現でき、url の一意制約（upsert）とも噛み合う。

### 9. 定期実行の方式【G4】
- 論点: 自動収集をどう動かすか。
- 選択肢: A) Windows タスクスケジューラ / B) `start-app.bat` の延長（PC起動時のみ） / C) GitHub Actions
- 推奨: A。AIがローカルの Ollama なので、C は届かない。B は今もある。頻度は1日1〜3回。

### 10. PCが止まっていたとき・Ollamaが動いていないときの挙動【G4】
- 論点: 実行時刻にPCが落ちている、またはOllamaが起動していない場合。
- 選択肢: A) 起動後に取りこぼしを1回だけ実行（タスクスケジューラの「時刻を逃したら実行」） / B) 何もしない（次の予定時刻まで待つ） / C) 通知を出す
- 推奨: A。Ollama待機（最大120秒）は実装済みなので、失敗時はログに残して次回に回す。

### 11. 実行履歴（crawl_runs）の残し方【G4】
- 論点: いつ・何件成功／失敗したかが、今は残らない。
- 選択肢: A) `crawl_runs` テーブル（種別・開始/終了時刻・成功/失敗件数・エラー概要） / B) ログファイル / C) 残さない
- 推奨: A。定期実行にすると、手元にいない間の結果を見る手段が必要。ログファイルは見落としやすい。

### 12. 週次まとめ（G5）と trend_diff の方針
- 論点: 週次まとめの保存先と、`trend_diff`（今は1記事だけから推測した差分）の扱い。
- 選択肢: A) `weekly_digests` に保存（読み取りのみ公開）し、trend_diff は今のまま / B) A に加えて trend_diff を「過去記事との比較」に作り直す / C) 週次まとめは保存せず、毎回その場で作る
- 推奨: A。G2（話題度）ができてから着手。B は記事の検索・比較が要り、AI処理も増える。必要になった時点で別に判断する。
