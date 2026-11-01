-- 【履歴として残しています】この制約は supabase/schema.sql に統合済みです。
-- 新しいDBでは schema.sql だけ実行してください。このファイルは既存DB向けの記録です。
-- クローラーがURLで重複判定してUPSERTできるようにする制約追加。
-- Supabase SQL Editor で実行してください（schema.sql 実行後に1回のみ）。

alter table public.articles
  add constraint articles_url_unique unique (url);
