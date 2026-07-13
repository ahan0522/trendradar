create table if not exists public.tw_institutional_value_flows (
  trade_date date not null,
  label text not null check (label in ('外資','投信','自營商','三大法人')),
  buy_amount_twd numeric,
  sell_amount_twd numeric,
  net_amount_twd numeric,
  provider text,
  source_url text,
  fetched_at timestamptz,
  quality_status text not null default 'unverified',
  verified_at timestamptz,
  verification_provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trade_date, label)
);

create index if not exists idx_tw_institutional_value_flows_lookup
  on public.tw_institutional_value_flows (label, trade_date desc);

alter table public.tw_institutional_value_flows disable row level security;
