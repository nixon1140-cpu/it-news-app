-- ITニュース行動提案アプリ: articles テーブル定義
-- Supabase SQL Editor で実行してください。

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title varchar not null,
  url text not null,
  summary text not null,
  trend_diff text not null,
  action_individual text not null,
  action_enterprise text not null,
  category varchar not null,
  priority_label varchar not null check (priority_label in ('High', 'Mid', 'Low')),
  importance int not null,
  published_at timestamptz not null default now()
);

create index if not exists articles_priority_sort_idx
  on public.articles (importance desc, published_at desc);

alter table public.articles enable row level security;

-- 一覧・詳細表示はクライアント（anon key）からの読み取りのみ許可。
create policy "Public read access"
  on public.articles
  for select
  to anon, authenticated
  using (true);

-- INSERT/UPDATE/DELETE は service_role のみ（バックエンド/シードスクリプト経由）に限定し、
-- ポリシーを追加しないことでanon/authenticatedからの書き込みを拒否する。
