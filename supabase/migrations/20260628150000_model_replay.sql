create table if not exists public.model_replay_runs (
  id text primary key,
  candidate_model_version text not null,
  baseline_model_version text not null,
  start_month text not null,
  end_month text not null,
  status text not null default 'running',
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists model_replay_runs_created_at_idx
  on public.model_replay_runs(created_at desc);

create table if not exists public.model_replay_months (
  run_id text not null references public.model_replay_runs(id) on delete cascade,
  month text not null,
  as_of_date date not null,
  baseline_signals jsonb not null default '[]'::jsonb,
  candidate_signals jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (run_id, month)
);

create index if not exists model_replay_months_month_idx
  on public.model_replay_months(month);

alter table public.model_replay_runs enable row level security;
alter table public.model_replay_months enable row level security;
