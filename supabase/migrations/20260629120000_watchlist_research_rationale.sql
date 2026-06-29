alter table public.signal_watchlists
  add column if not exists value_chain_role text,
  add column if not exists causal_reason text,
  add column if not exists tracking_metrics jsonb not null default '[]'::jsonb,
  add column if not exists invalidation_conditions jsonb not null default '[]'::jsonb,
  add column if not exists direct_operating_link boolean not null default false;

comment on column public.signal_watchlists.value_chain_role is
  'Company position in the value chain relevant to the signal.';
comment on column public.signal_watchlists.causal_reason is
  'Direct operating mechanism connecting the signal to the company.';
comment on column public.signal_watchlists.tracking_metrics is
  'Observable metrics used to validate the mapping.';
comment on column public.signal_watchlists.invalidation_conditions is
  'Conditions that invalidate or weaken the mapping.';
comment on column public.signal_watchlists.direct_operating_link is
  'True only when a direct operating relationship has been established.';
