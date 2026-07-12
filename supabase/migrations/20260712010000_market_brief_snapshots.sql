create table if not exists public.market_brief_snapshots (
  id uuid primary key default gen_random_uuid(),
  report_version text not null,
  period text not null check (period in ('daily', 'weekly', 'monthly')),
  period_key text not null,
  as_of_date date not null,
  revision integer not null check (revision > 0),
  content_hash text not null,
  quality_status text not null check (quality_status in ('ready', 'partial', 'pending')),
  report_payload jsonb not null,
  generated_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (report_version, period, period_key, revision),
  unique (report_version, period, period_key, content_hash)
);

create index if not exists idx_market_brief_snapshots_latest
  on public.market_brief_snapshots (period, period_key, revision desc);

comment on table public.market_brief_snapshots is
  'Append-only revisions of generated daily, weekly, and monthly market briefs.';

alter table public.market_brief_snapshots disable row level security;
