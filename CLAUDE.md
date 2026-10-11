# Role
「ITニュース行動提案・意思決定ダッシュボード」のコードベースを編集します。設計・実装の両方をClaudeが担当します。

# Tech Stack
- Frontend: Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui
- Backend (BaaS): Supabase (PostgreSQL)
- AI推論: Ollama（ローカルで動かす無料のAIモデル。課金ゼロを保つため）

# 守ってほしいこと
1. 既存の動いているコードやファイルは、許可なく削除・大幅な変更をしない（作業中のコードを失わないため）。
2. Server ComponentsとClient Components（`"use client"`が付くもの）は分ける（不要な処理をブラウザに送らず表示を速くするため）。
3. UIコンポーネントにSupabase/AI APIの呼び出しを直接書かず、`lib/api`等にまとめる（UIとデータ取得の役割を分け、テストや修正をしやすくするため）。
4. Supabaseのキーなどは`.env.local`経由で読む（コードに秘密情報を残さないため）。
5. AIの処理待ちにはSkeleton Loader（読み込み中の骨組み表示）を入れ、AIの出力はエラー処理をする（AIの応答が遅い・失敗することがあるため）。

# 進め方
- コマンド（npm installなど）を実行する前に、何をするか説明して承認を得る。
