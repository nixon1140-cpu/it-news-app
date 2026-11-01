# it-news-app 作業進捗（2026-11-01 時点）

新しいセッションで続きから再開するためのメモ。秘密の値（キー・パスワード）は書かない。

## 今の状況
- 現在のブランチ: `main`（D1 のコミットは push 済み）。`feature/ollama-stability` は push済みで main に反映済み
- main に入っている Ollama 安定化（O-1〜O-4）:
  - O-1 Ollamaクライアントにタイムアウト（5分）・リトライ（最大3回、待機2秒→4秒）・keep_alive（30分）
  - O-2 クローラー開始時に Ollama 起動待ち（最大120秒）→ モデル存在確認 → 試し生成（`lib/ollama/health.ts`）
  - O-3 `/api/health`（アプリ・Ollama・モデルの状態を返す）
  - O-4 `start-app.bat` にニュース集め前の Ollama 待機（最大120秒、ping方式、失敗しても起動は止めない）
- `npm test` は5ファイル31件パス（lib=node / components=jsdom の2プロジェクト、外部接続なし）。`python/venv/Scripts/python.exe -m pytest python/tests` は14件パス。`npx tsc --noEmit` も問題なし
- RLS テスト（`npm run test:rls`）は実装済み。`.env.test` に3値（URL / anon / `TEST_SUPABASE_SERVICE_ROLE_KEY`）が揃っているときだけ実行、本番URLと同じなら即停止。テスト用DBに schema.sql（GRANT 込み）を適用済みで、6件パス。実行後に `test-` 行は残らない
- 3001（本番）は古いビルドのまま。`/api/health` を出すには `npm run build` → `npm run start` が必要
- architect-ai 側の進捗メモも更新・push済み（`3fdc412`）

## 終わったこと
- Supabase キーのローテーション（新方式 publishable/secret に交換、旧キー無効化、`.claude/settings.local.json` を追跡解除）。履歴からの除去は未実施（キーは無効化済みのため任意）
- パスワードファイルを公開履歴から除去済み
- Ollama 修理（0.35.1、トレイアプリのみで起動）。ニュース集め 15/15 件成功。内蔵GPUは遅くなったため元に戻した（CPUのみ、約2.5分/記事）
- Ollama 安定化 O-1〜O-4（上記）
- `/api/trends` も新モデル `gemma4:e4b-it-q4_K_M` を使用
- D1: Vitest 環境分離 / extractJson テスト追加 / pytest 導入（`python/tests`、保存済みHTML）/ `schema.sql` に url UNIQUE を統合（再実行可）/ RLS テスト / spec 更新

## 残っている課題
1. 実機で `start-app.bat` 全体とクローラーを通しで動かす確認は未実施
2. `.claude/settings.local.json` は公開履歴に残っている（キーは無効。履歴除去は任意）
3. `npm audit` の重大・高の脆弱性（Next.js 16.2.9 など）
4. `extractJson` は null/undefined を渡すと TypeError（既知・未修正）。空文字は空文字を返し、例外は後段の JSON.parse で出る（現行動作をテストで固定）
5. G0 の要判断12件は未回答（回答後に G1〜G4）
6. 環境変数 OLLAMA_MODELS のマシン側とユーザー側で値が違う（トレイ起動のみなら実害なし）
7. Ollama API エラーは、PC再起動後は発生していない。6番（OLLAMA_MODELS のずれ）と関係している可能性があるので、再発したら6番から確認する
8. `schema.sql` の GRANT は本番DBには未適用（本番の権限は従来のまま）。本番に適用するかは別途判断
9. 重複判定の「失敗時に除外しない」動作は crawler.ts 側にあり、テスト未整備（pytest は終了コード1・標準出力なしまで確認）
10. `supabase/migrations/002` は schema.sql に統合済み。既存DB向けの履歴として残している（新規DBでは実行しない）

## 次にやること
1. G0 の要判断に回答 → G1〜G4（想定順序: G4 → G1 → G2 → G5。ソース拡張・話題度・手動投入・定期実行）
2. 必要なら 3001 を再ビルドして `/api/health` を確認

## 作業ルール（このプロジェクト）
- コミット前にブランチ確認、`git add` はファイル名指定（`-A` は使わない）、コミット後 `git show --stat` で README/.env の混入確認
- push は承認後。秘密の値は表示・保存しない
- 同じエラーを2回直しても解決しなければ止めて報告（Opus 5.5 の新セッション切替の意見も添える）
