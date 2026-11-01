-- ITニュース行動提案アプリ: articles テーブル定義
-- Supabase SQL Editor で実行してください。何度実行しても壊れないように書いてあります。
-- （url の UNIQUE 制約は、以前 migrations/002 に分かれていたものをここに統合しました。）

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

-- クローラーが url で重複判定して upsert するための一意制約。
-- 既に作成済みのテーブルでも追加できるよう、無いときだけ追加する。
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'articles_url_unique'
      and conrelid = 'public.articles'::regclass
  ) then
    alter table public.articles
      add constraint articles_url_unique unique (url);
  end if;
end
$$;

create index if not exists articles_priority_sort_idx
  on public.articles (importance desc, published_at desc);

alter table public.articles enable row level security;

-- 一覧・詳細表示はクライアント（anon key）からの読み取りのみ許可。
-- create policy には if not exists が無いため、先に削除してから作り直す（再実行対策）。
drop policy if exists "Public read access" on public.articles;

create policy "Public read access"
  on public.articles
  for select
  to anon, authenticated
  using (true);

-- INSERT/UPDATE/DELETE は service_role のみ（バックエンド/シードスクリプト経由）に限定し、
-- ポリシーを追加しないことでanon/authenticatedからの書き込みを拒否する。
