create table if not exists public.tw_margin_trading_balance (
  trade_date date primary key,
  margin_balance_lots numeric,
  margin_balance_change_lots numeric,
  margin_balance_amount_thousand numeric,
  margin_balance_change_amount_thousand numeric,
  short_balance_lots numeric,
  short_balance_change_lots numeric,
  provider text,
  source_url text,
  fetched_at timestamptz,
  quality_status text not null default 'unverified',
  verified_at timestamptz,
  verification_provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tw_margin_trading_balance disable row level security;
