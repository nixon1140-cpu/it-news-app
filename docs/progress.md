# it-news-app 作業進捗（2026-10-11 時点）

新しいセッションで続きから再開するためのメモ。秘密の値（キー・パスワード）は書かない。

## 今の状況
- 現在のブランチ: `main`（`origin/main` と同じ `2a94d42`、push済み）。`feature/ollama-stability` も push済みで main に反映済み
- main に入っている Ollama 安定化（O-1〜O-4）:
  - O-1 Ollamaクライアントにタイムアウト（5分）・リトライ（最大3回、待機2秒→4秒）・keep_alive（30分）
  - O-2 クローラー開始時に Ollama 起動待ち（最大120秒）→ モデル存在確認 → 試し生成（`lib/ollama/health.ts`）
  - O-3 `/api/health`（アプリ・Ollama・モデルの状態を返す）
  - O-4 `start-app.bat` にニュース集め前の Ollama 待機（最大120秒、ping方式、失敗しても起動は止めない）
- Vitest は `npm run test` で22件パス、`npx tsc --noEmit` も問題なし
- 3001（本番）は古いビルドのまま。`/api/health` を出すには `npm run build` → `npm run start` が必要
- architect-ai 側の進捗メモも更新・push済み（`3fdc412`）

## 終わったこと
- Supabase キーのローテーション（新方式 publishable/secret に交換、旧キー無効化、`.claude/settings.local.json` を追跡解除）。履歴からの除去は未実施（キーは無効化済みのため任意）
- パスワードファイルを公開履歴から除去済み
- Ollama 修理（0.35.1、トレイアプリのみで起動）。ニュース集め 15/15 件成功。内蔵GPUは遅くなったため元に戻した（CPUのみ、約2.5分/記事）
- Ollama 安定化 O-1〜O-4（上記）
- `/api/trends` も新モデル `gemma4:e4b-it-q4_K_M` を使用

## 残っている課題
1. 実機で `start-app.bat` 全体とクローラーを通しで動かす確認は未実施
2. `.claude/settings.local.json` は公開履歴に残っている（キーは無効。履歴除去は任意）
3. `npm audit` の重大・高の脆弱性（Next.js 16.2.9 など）
4. `extractJson` は null/undefined を渡すと TypeError（既知・未修正）
5. G0 の要判断12件は未回答（回答後に G1〜G4）
6. 環境変数 OLLAMA_MODELS のマシン側とユーザー側で値が違う（トレイ起動のみなら実害なし）
7. Ollama API エラーは、PC再起動後は発生していない。6番（OLLAMA_MODELS のずれ）と関係している可能性があるので、再発したら6番から確認する

## 次にやること
1. D1 Step 3〜7（pytest 導入、Python のテスト、RLS テスト）
2. G0 の要判断に回答 → G1〜G4（ソース拡張・話題度・手動投入・定期実行）
3. 必要なら 3001 を再ビルドして `/api/health` を確認

## 作業ルール（このプロジェクト）
- コミット前にブランチ確認、`git add` はファイル名指定（`-A` は使わない）、コミット後 `git show --stat` で README/.env の混入確認
- push は承認後。秘密の値は表示・保存しない
- 同じエラーを2回直しても解決しなければ止めて報告（Opus 5.5 の新セッション切替の意見も添える）
