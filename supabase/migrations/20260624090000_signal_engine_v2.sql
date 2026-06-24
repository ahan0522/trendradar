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

insert into public.signal_events (
  id,
  signal_date,
  as_of_date,
  topic,
  signal_type,
  signal_strength,
  confidence_score,
  hypothesis,
  evidence,
  status,
  model_version
) values
  (
    'seed-memory-price-dislocation',
    '2026-03-31',
    '2026-03-31',
    'Memory Price Dislocation',
    'price',
    95,
    92,
    'AI server and HBM demand are reallocating memory production capacity, creating structural DRAM/NAND price pressure.',
    '[{"source":"migration-seed","as_of_date":"2026-03-31","note":"Seed signal for TrendRadar v2 validation flow."}]'::jsonb,
    'active',
    'seed-v1'
  ),
  (
    'seed-ai-power-infrastructure',
    '2026-04-16',
    '2026-04-16',
    'AI Power Infrastructure',
    'mixed',
    89,
    86,
    'AI data center expansion is shifting the bottleneck from compute to power generation, grid equipment, transformers and data center power systems.',
    '[{"source":"migration-seed","as_of_date":"2026-04-16","note":"Seed signal for TrendRadar v2 validation flow."}]'::jsonb,
    'active',
    'seed-v1'
  ),
  (
    'seed-ai-cooling-infrastructure',
    '2026-05-31',
    '2026-05-31',
    'AI Cooling Infrastructure',
    'supply_chain',
    84,
    80,
    'High-density AI servers are increasing rack-level thermal loads, accelerating demand for liquid cooling and advanced thermal management.',
    '[{"source":"migration-seed","as_of_date":"2026-05-31","note":"Seed signal for TrendRadar v2 validation flow."}]'::jsonb,
    'active',
    'seed-v1'
  )
on conflict (id) do update set
  signal_date = excluded.signal_date,
  as_of_date = excluded.as_of_date,
  topic = excluded.topic,
  signal_type = excluded.signal_type,
  signal_strength = excluded.signal_strength,
  confidence_score = excluded.confidence_score,
  hypothesis = excluded.hypothesis,
  evidence = excluded.evidence,
  status = excluded.status,
  model_version = excluded.model_version,
  updated_at = now();

insert into public.signal_watchlists (
  id,
  signal_event_id,
  symbol,
  company_name,
  market,
  thesis,
  weight,
  source
) values
  ('seed-memory-price-dislocation-mu', 'seed-memory-price-dislocation', 'MU', 'Micron', 'US', 'AI server and HBM demand are reallocating memory production capacity, creating structural DRAM/NAND price pressure.', 0.1667, 'migration-seed'),
  ('seed-memory-price-dislocation-000660-ks', 'seed-memory-price-dislocation', '000660.KS', 'SK Hynix', 'KR', 'AI server and HBM demand are reallocating memory production capacity, creating structural DRAM/NAND price pressure.', 0.1667, 'migration-seed'),
  ('seed-memory-price-dislocation-005930-ks', 'seed-memory-price-dislocation', '005930.KS', 'Samsung Electronics', 'KR', 'AI server and HBM demand are reallocating memory production capacity, creating structural DRAM/NAND price pressure.', 0.1667, 'migration-seed'),
  ('seed-memory-price-dislocation-2408-tw', 'seed-memory-price-dislocation', '2408.TW', '南亞科', 'TW', 'AI server and HBM demand are reallocating memory production capacity, creating structural DRAM/NAND price pressure.', 0.1667, 'migration-seed'),
  ('seed-memory-price-dislocation-2344-tw', 'seed-memory-price-dislocation', '2344.TW', '華邦電', 'TW', 'AI server and HBM demand are reallocating memory production capacity, creating structural DRAM/NAND price pressure.', 0.1667, 'migration-seed'),
  ('seed-memory-price-dislocation-8299-tw', 'seed-memory-price-dislocation', '8299.TW', '群聯', 'TW', 'AI server and HBM demand are reallocating memory production capacity, creating structural DRAM/NAND price pressure.', 0.1667, 'migration-seed'),
  ('seed-ai-power-infrastructure-gev', 'seed-ai-power-infrastructure', 'GEV', 'GE Vernova', 'US', 'AI data center expansion is shifting the bottleneck from compute to power generation, grid equipment, transformers and data center power systems.', 0.1667, 'migration-seed'),
  ('seed-ai-power-infrastructure-etn', 'seed-ai-power-infrastructure', 'ETN', 'Eaton', 'US', 'AI data center expansion is shifting the bottleneck from compute to power generation, grid equipment, transformers and data center power systems.', 0.1667, 'migration-seed'),
  ('seed-ai-power-infrastructure-abb', 'seed-ai-power-infrastructure', 'ABB', 'ABB', 'US', 'AI data center expansion is shifting the bottleneck from compute to power generation, grid equipment, transformers and data center power systems.', 0.1667, 'migration-seed'),
  ('seed-ai-power-infrastructure-2308-tw', 'seed-ai-power-infrastructure', '2308.TW', '台達電', 'TW', 'AI data center expansion is shifting the bottleneck from compute to power generation, grid equipment, transformers and data center power systems.', 0.1667, 'migration-seed'),
  ('seed-ai-power-infrastructure-1513-tw', 'seed-ai-power-infrastructure', '1513.TW', '中興電', 'TW', 'AI data center expansion is shifting the bottleneck from compute to power generation, grid equipment, transformers and data center power systems.', 0.1667, 'migration-seed'),
  ('seed-ai-power-infrastructure-1519-tw', 'seed-ai-power-infrastructure', '1519.TW', '華城', 'TW', 'AI data center expansion is shifting the bottleneck from compute to power generation, grid equipment, transformers and data center power systems.', 0.1667, 'migration-seed'),
  ('seed-ai-cooling-infrastructure-vrt', 'seed-ai-cooling-infrastructure', 'VRT', 'Vertiv', 'US', 'High-density AI servers are increasing rack-level thermal loads, accelerating demand for liquid cooling and advanced thermal management.', 0.25, 'migration-seed'),
  ('seed-ai-cooling-infrastructure-3017-tw', 'seed-ai-cooling-infrastructure', '3017.TW', '奇鋐', 'TW', 'High-density AI servers are increasing rack-level thermal loads, accelerating demand for liquid cooling and advanced thermal management.', 0.25, 'migration-seed'),
  ('seed-ai-cooling-infrastructure-3324-tw', 'seed-ai-cooling-infrastructure', '3324.TW', '雙鴻', 'TW', 'High-density AI servers are increasing rack-level thermal loads, accelerating demand for liquid cooling and advanced thermal management.', 0.25, 'migration-seed'),
  ('seed-ai-cooling-infrastructure-2308-tw', 'seed-ai-cooling-infrastructure', '2308.TW', '台達電', 'TW', 'High-density AI servers are increasing rack-level thermal loads, accelerating demand for liquid cooling and advanced thermal management.', 0.25, 'migration-seed')
on conflict (signal_event_id, symbol, market) do update set
  company_name = excluded.company_name,
  thesis = excluded.thesis,
  weight = excluded.weight,
  source = excluded.source,
  updated_at = now();

insert into public.signal_outcomes (
  signal_event_id,
  horizon_days,
  basket_return,
  benchmark_symbol,
  benchmark_market,
  benchmark_return,
  excess_return,
  outcome,
  details
)
select signal_id, horizon_days, 0, 'SPY', 'US', 0, 0, 'pending', '[]'::jsonb
from (
  values
    ('seed-memory-price-dislocation'),
    ('seed-ai-power-infrastructure'),
    ('seed-ai-cooling-infrastructure')
) as signals(signal_id)
cross join (
  values (7), (14), (30), (60)
) as horizons(horizon_days)
on conflict (signal_event_id, horizon_days) do nothing;
