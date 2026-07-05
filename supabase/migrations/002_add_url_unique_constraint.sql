-- クローラーがURLで重複判定してUPSERTできるようにする制約追加。
-- Supabase SQL Editor で実行してください（schema.sql 実行後に1回のみ）。

alter table public.articles
  add constraint articles_url_unique unique (url);
