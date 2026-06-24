create extension if not exists pgcrypto;

create table if not exists public.signal_events (
  id text primary key,
  signal_date date not null,
  as_of_date date not null,
  topic text not null,
  signal_type text not null,
  signal_strength numeric not null default 0,
  confidence_score numeric not null default 0,
  hypothesis text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  model_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_signal_events_signal_date on public.signal_events (signal_date desc);
create index if not exists idx_signal_events_strength on public.signal_events (signal_strength desc);
create index if not exists idx_signal_events_status on public.signal_events (status);

create table if not exists public.signal_watchlists (
  id text primary key,
  signal_event_id text not null references public.signal_events(id) on delete cascade,
  symbol text not null,
  company_name text not null,
  market text not null,
  thesis text not null default '',
  weight numeric not null default 1,
  source text not null default 'rule-based',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (signal_event_id, symbol, market)
);

create index if not exists idx_signal_watchlists_signal_event on public.signal_watchlists (signal_event_id);
create index if not exists idx_signal_watchlists_symbol_market on public.signal_watchlists (symbol, market);

create table if not exists public.stock_prices (
  symbol text not null,
  market text not null,
  price_date date not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric not null,
  adj_close numeric,
  volume numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (symbol, market, price_date)
);

create index if not exists idx_stock_prices_lookup on public.stock_prices (symbol, market, price_date);

create table if not exists public.signal_outcomes (
  signal_event_id text not null references public.signal_events(id) on delete cascade,
  horizon_days integer not null,
  basket_return numeric not null default 0,
  benchmark_symbol text,
  benchmark_market text,
  benchmark_return numeric not null default 0,
  excess_return numeric not null default 0,
  outcome text not null default 'pending',
  details jsonb not null default '[]'::jsonb,
  evaluated_at timestamptz not null default now(),
  primary key (signal_event_id, horizon_days)
);

create index if not exists idx_signal_outcomes_signal_event on public.signal_outcomes (signal_event_id);

alter table public.signal_events disable row level security;
alter table public.signal_watchlists disable row level security;
alter table public.stock_prices disable row level security;
alter table public.signal_outcomes disable row level security;

