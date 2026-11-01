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

-- 書き込みは「GRANT（表の権限）」と「RLS」の2段で防ぐ。
-- Supabase の設定によっては表の権限が自動では付かないため、明示する（何度実行しても同じ結果になる）。
-- anon / authenticated は SELECT のみ、service_role だけが全操作できる。
revoke all on public.articles from anon, authenticated;
grant select on public.articles to anon, authenticated;
grant all on public.articles to service_role;

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

-- ============================================================
-- crawl_runs: 収集などのバッチ処理の実行履歴と、二重実行の防止
-- ============================================================
-- 書き込み・読み取りとも service_role のみ（クローラー等のサーバー側）。
-- RLS は有効にし、ポリシーは作らない。anon / authenticated は権限も与えない（確認は管理画面）。
create table if not exists public.crawl_runs (
  id uuid primary key default gen_random_uuid(),
  job_type varchar not null check (job_type in ('crawl', 'metrics', 'digest')),
  status varchar not null check (status in ('running', 'success', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  success_count int not null default 0,
  failure_count int not null default 0,
  error_summary text
);

-- 同じ種別の running は1行だけ。2つ目の開始は一意制約違反（23505）になり、二重実行を防ぐ。
create unique index if not exists crawl_runs_one_running_idx
  on public.crawl_runs (job_type)
  where status = 'running';

-- 「直近の成功」を探すための索引。
create index if not exists crawl_runs_job_started_idx
  on public.crawl_runs (job_type, started_at desc);

alter table public.crawl_runs enable row level security;

revoke all on public.crawl_runs from anon, authenticated;
grant all on public.crawl_runs to service_role;
