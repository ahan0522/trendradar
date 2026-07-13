create table if not exists public.taifex_futures_institutional_oi (
  trade_date date not null,
  contract_code text not null,
  investor text not null check (investor in ('外資','投信','自營商','三大法人')),
  long_contracts numeric,
  short_contracts numeric,
  net_contracts numeric,
  long_volume numeric,
  short_volume numeric,
  provider text,
  source_url text,
  fetched_at timestamptz,
  quality_status text not null default 'unverified',
  verified_at timestamptz,
  verification_provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trade_date, contract_code, investor)
);

create index if not exists idx_taifex_futures_institutional_oi_lookup
  on public.taifex_futures_institutional_oi (contract_code, investor, trade_date desc);

alter table public.taifex_futures_institutional_oi disable row level security;
