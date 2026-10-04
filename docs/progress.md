# it-news-app 作業進捗（2026-10-04 時点）

新しいセッションで続きから再開するためのメモ。秘密の値（キー・パスワード）は書かない。

## 今の状況
- 現在のブランチ: `chore/d1-test-setup`（`main` はまだ最新に進めていない・push もしていない）
- `origin/main` は `64c41a1`。ローカルの `chore/d1-test-setup` はその先に2コミット
  - `8e4c2db` `.gitignore` に `supabase/*.txt` と `*.bak*` を追加
  - `f617c9c` Vitest + React Testing Library 導入、`extractJson` のテスト追加（`npm run test` は10件パス）
- 本番（3001）・開発（3000）の起動状態は毎回確認が必要（バックグラウンドのプロセスはセッションをまたぐと止まりやすい）

## 終わったこと
- フェーズ1: Pythonで記事本文抽出（trafilatura）と重複検出（rapidfuzz）をクローラーに追加、本番反映・push済み
- 「過去のニュース」ページ（`/archive`）追加、README とポートフォリオ反映、push済み
- パスワードを書いたファイルが公開履歴に入っていた件: パスワードを変更し、`git filter-repo` で履歴から除去、force push 済み。ローカルの古いブランチ5本と古い履歴（reflog・gc 含む）も削除済み。作業用コピーとバックアップも削除済み
- `.gitignore` 整備（`supabase/*.txt`、`*.bak*`）
- D1 Step 1〜2: Vitest 導入と `extractJson` テスト（コミット済み・未push）
- G0（フェーズG の変更提案20件・要判断12件）を作成済み。**未承認**
- Ollama診断（Step 2）完了。**変更提案10件・要判断6件は未承認**

## 残っている課題（優先順）
1. **【最優先・重大】`.claude/settings.local.json` に本番の `service_role` キー（全権限のキー）と `anon` キーが書かれたまま、公開リポジトリ（`origin/main`、初回コミット `86bc486`）に 2026-07-05 から載っている**
   - 現在の `.env.local` と同じキー（有効期限は未来＝まだ使える）
   - 他に password/token 系の行3つも `.env.local` の値と一致
   - 未実施: キーのローテーション、追跡解除（`git rm --cached`）、`.gitignore` 追加、履歴からの除去、push
   - `.claude/launch.json`・`.claude/scheduled_tasks.lock` は機密なし
2. `chore/d1-test-setup` を `main` へ反映する作業は保留中（上の件が先。`git checkout` で追跡解除前のファイルが消えないよう注意）
3. Ollama が動かない（本体 `ollama.exe` が6/17版のまま、`llama-server` が9/29版で食い違い、`--no-mmap` エラー）。トレイアプリとタスクの二重起動で約18,000件のエラーログ。直すには管理者権限での再インストールが必要
4. `/api/trends` はモデル未指定のため古い `llama3.1:8b`（無限反復バグ報告あり）が使われる
5. D1 の残り: Step 3 pytest導入、Step 4〜6 Pythonのテスト、Step 7 RLSテスト（`.env.test` にテスト用Supabaseの接続情報は設定済み）
6. 脆弱性警告（`npm audit`）: Next.js 16.2.9 など。別途対応が必要
7. `supabase/` に接続情報メモの `.txt` が過去にあった。現在は作業ツリーに0件、`.gitignore` で除外済み

## 次にやること
1. service_role キーのローテーション（Supabase側）→ `.env.local` 更新 → `.claude/settings.local.json` の追跡解除と履歴除去（再度 filter-repo）→ push
2. 上記が終わったら `chore/d1-test-setup` を main に反映して push
3. Ollama を直す（再インストール、起動の一本化）→ 提案10件の承認・実装
4. D1 Step 3〜7（pytest、RLSテスト）→ G0 提案の承認 → G1〜G4（ソース拡張・話題度・手動投入・定期実行）

## 作業ルール（このプロジェクト）
- コミット前にブランチ確認、`git add` はファイル名指定（`-A` は使わない）、push は承認後
- 秘密の値は表示・保存しない。`<PW-FILE>`（パスワードを含むファイル名）は伏せ字
- 同じエラーを2回直しても解決しなければ止めて報告
