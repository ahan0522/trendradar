create table if not exists public.signal_publication_reviews (
  id uuid primary key default gen_random_uuid(),
  signal_event_id text not null references public.signal_events(id) on delete cascade,
  version integer not null,
  status text not null default 'draft'
    check (status in ('draft', 'reviewed', 'approved', 'rejected', 'published')),
  quality_score numeric not null default 0,
  gate_results jsonb not null default '[]'::jsonb,
  publishing_brief jsonb not null default '{}'::jsonb,
  review_note text,
  reviewed_by text,
  created_at timestamptz not null default now(),
  unique (signal_event_id, version)
);

create index if not exists idx_signal_publication_reviews_signal_version
  on public.signal_publication_reviews (signal_event_id, version desc);

create index if not exists idx_signal_publication_reviews_status
  on public.signal_publication_reviews (status, created_at desc);

alter table public.signal_publication_reviews disable row level security;
