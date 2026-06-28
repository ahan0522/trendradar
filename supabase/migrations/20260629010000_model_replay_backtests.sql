create table if not exists public.model_replay_signal_results (
  run_id text not null references public.model_replay_runs(id) on delete cascade,
  signal_id text not null,
  month text not null,
  signal_date date not null,
  topic text not null,
  family text not null,
  model_version text not null,
  mapping_status text not null,
  watchlist jsonb not null default '[]'::jsonb,
  outcomes jsonb not null default '[]'::jsonb,
  missing_prices jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (run_id, model_version, signal_id)
);

create index if not exists model_replay_signal_results_month_idx
  on public.model_replay_signal_results(run_id, month);

create index if not exists model_replay_signal_results_status_idx
  on public.model_replay_signal_results(run_id, mapping_status);

alter table public.model_replay_signal_results enable row level security;
