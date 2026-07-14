create table if not exists public.taifex_options_put_call_ratio (
  trade_date date primary key,
  put_volume numeric,
  call_volume numeric,
  put_call_volume_ratio_pct numeric,
  put_open_interest numeric,
  call_open_interest numeric,
  put_call_oi_ratio_pct numeric,
  provider text,
  source_url text,
  fetched_at timestamptz,
  quality_status text not null default 'unverified',
  verified_at timestamptz,
  verification_provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.taifex_options_put_call_ratio disable row level security;
