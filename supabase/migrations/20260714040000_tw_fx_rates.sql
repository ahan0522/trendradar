create table if not exists public.tw_fx_rates (
  trade_date date not null,
  pair text not null,
  rate numeric,
  change_amount numeric,
  change_pct numeric,
  provider text,
  source_url text,
  fetched_at timestamptz,
  quality_status text not null default 'unverified',
  verified_at timestamptz,
  verification_provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trade_date, pair)
);

alter table public.tw_fx_rates disable row level security;
