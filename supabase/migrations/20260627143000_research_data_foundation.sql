create table if not exists public.research_sources (
  id text primary key,
  name text not null,
  source_type text not null,
  base_url text,
  authority_level text not null default 'secondary',
  reliability_score numeric not null default 50 check (reliability_score between 0 and 100),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.industry_observations (
  id text primary key,
  industry text not null,
  metric_name text not null,
  metric_value numeric,
  metric_text text,
  unit text,
  period_start date,
  period_end date,
  published_at timestamptz not null,
  observed_at timestamptz not null default now(),
  known_at timestamptz not null,
  source_id text references public.research_sources(id),
  source_url text not null,
  quality_status text not null default 'unverified',
  confidence_score numeric not null default 50 check (confidence_score between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (metric_value is not null or nullif(trim(metric_text), '') is not null),
  check (known_at >= published_at)
);

create index if not exists idx_industry_observations_industry_date
  on public.industry_observations(industry, known_at desc);
create index if not exists idx_industry_observations_metric_date
  on public.industry_observations(metric_name, known_at desc);

create table if not exists public.commodity_quotes (
  id text primary key,
  commodity_code text not null,
  commodity_name text not null,
  quote_date date not null,
  quote_type text not null default 'spot',
  price numeric not null check (price > 0),
  currency text not null,
  unit text not null,
  published_at timestamptz not null,
  observed_at timestamptz not null default now(),
  known_at timestamptz not null,
  source_id text references public.research_sources(id),
  source_url text not null,
  quality_status text not null default 'unverified',
  verification_source_id text references public.research_sources(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (commodity_code, quote_date, quote_type, source_id),
  check (known_at >= published_at)
);

create index if not exists idx_commodity_quotes_lookup
  on public.commodity_quotes(commodity_code, quote_date desc);

create table if not exists public.company_actions (
  id text primary key,
  company_symbol text not null,
  market text not null,
  company_name text not null,
  action_type text not null,
  title text not null,
  summary text,
  effective_date date,
  published_at timestamptz not null,
  observed_at timestamptz not null default now(),
  known_at timestamptz not null,
  source_id text references public.research_sources(id),
  source_url text not null,
  quality_status text not null default 'unverified',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (known_at >= published_at)
);

create index if not exists idx_company_actions_symbol_date
  on public.company_actions(company_symbol, market, known_at desc);
create index if not exists idx_company_actions_type_date
  on public.company_actions(action_type, known_at desc);

create table if not exists public.signal_score_components (
  signal_event_id text not null references public.signal_events(id) on delete cascade,
  component_name text not null,
  raw_value numeric not null default 0,
  normalized_score numeric not null default 0 check (normalized_score between 0 and 100),
  weight numeric not null default 0 check (weight between 0 and 1),
  contribution numeric not null default 0,
  calculation_version text not null,
  calculated_at timestamptz not null default now(),
  input_snapshot jsonb not null default '{}'::jsonb,
  primary key (signal_event_id, component_name)
);

create table if not exists public.signal_evidence_items (
  id text primary key,
  signal_event_id text not null references public.signal_events(id) on delete cascade,
  evidence_date date,
  source_name text,
  source_url text,
  source_type text not null default 'news',
  title text not null,
  summary text,
  why_it_matters text,
  known_at_signal_time boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists signal_evidence_items_signal_event_id_idx
  on public.signal_evidence_items(signal_event_id);
create index if not exists signal_evidence_items_evidence_date_idx
  on public.signal_evidence_items(evidence_date);

create table if not exists public.signal_timeline_events (
  id text primary key,
  signal_event_id text not null references public.signal_events(id) on delete cascade,
  event_date date,
  event_type text not null default 'evidence',
  title text not null,
  description text,
  source_url text,
  known_at_signal_time boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists signal_timeline_events_signal_event_id_idx
  on public.signal_timeline_events(signal_event_id);
create index if not exists signal_timeline_events_event_date_idx
  on public.signal_timeline_events(event_date);

create table if not exists public.signal_lessons (
  id text primary key,
  signal_event_id text not null references public.signal_events(id) on delete cascade,
  lesson_type text not null default 'observation',
  title text not null,
  description text,
  impact text,
  created_at timestamptz not null default now()
);

create index if not exists signal_lessons_signal_event_id_idx
  on public.signal_lessons(signal_event_id);

alter table public.stock_prices
  add column if not exists provider text,
  add column if not exists source_url text,
  add column if not exists fetched_at timestamptz,
  add column if not exists quality_status text not null default 'unverified',
  add column if not exists verified_at timestamptz,
  add column if not exists verification_provider text;

alter table public.research_sources disable row level security;
alter table public.industry_observations disable row level security;
alter table public.commodity_quotes disable row level security;
alter table public.company_actions disable row level security;
alter table public.signal_score_components disable row level security;
alter table public.signal_evidence_items disable row level security;
alter table public.signal_timeline_events disable row level security;
alter table public.signal_lessons disable row level security;
