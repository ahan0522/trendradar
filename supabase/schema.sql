-- TrendRadar Supabase / PostgreSQL schema
-- 在 Supabase SQL Editor 執行本檔案即可建立資料表。

create extension if not exists pgcrypto;

create table if not exists public.articles (
  id text primary key,
  title text not null,
  link text not null unique,
  source_id text not null,
  source_name text not null,
  category text not null,
  region text not null,
  published_at timestamptz,
  description text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_articles_published_at on public.articles (published_at desc nulls last);
create index if not exists idx_articles_category on public.articles (category);
create index if not exists idx_articles_region on public.articles (region);
create index if not exists idx_articles_source_id on public.articles (source_id);

create table if not exists public.topics (
  id text primary key,
  title text not null,
  category text not null,
  region text not null,
  trend_score numeric not null default 0,
  velocity numeric not null default 0,
  sentiment text not null default '待分析',
  summary text default '',
  bullets jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_topics_score on public.topics (trend_score desc);
create index if not exists idx_topics_last_seen_at on public.topics (last_seen_at desc);
create index if not exists idx_topics_category on public.topics (category);
create index if not exists idx_topics_region on public.topics (region);

create table if not exists public.topic_articles (
  topic_id text not null references public.topics(id) on delete cascade,
  article_id text not null references public.articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (topic_id, article_id)
);

create index if not exists idx_topic_articles_article_id on public.topic_articles (article_id);

create table if not exists public.trend_metrics (
  id uuid primary key default gen_random_uuid(),
  topic_id text not null references public.topics(id) on delete cascade,
  measured_at timestamptz not null default now(),
  search_score numeric not null default 0,
  news_score numeric not null default 0,
  social_score numeric not null default 0,
  engagement_score numeric not null default 0,
  velocity_score numeric not null default 0,
  diversity_score numeric not null default 0,
  total_score numeric not null default 0
);

create index if not exists idx_trend_metrics_topic_time on public.trend_metrics (topic_id, measured_at desc);

-- 開發階段可以先不開 RLS。正式上線前建議依照使用場景改成 RLS + service role 寫入。
alter table public.articles disable row level security;
alter table public.topics disable row level security;
alter table public.topic_articles disable row level security;
alter table public.trend_metrics disable row level security;
