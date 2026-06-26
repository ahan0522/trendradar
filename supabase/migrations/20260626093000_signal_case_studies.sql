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
