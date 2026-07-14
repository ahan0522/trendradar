-- Supabase flagged these tables as publicly readable/writable/deletable by
-- anyone with the project URL, because Row Level Security was never enabled
-- on them. This was low-risk while no anon key was configured anywhere in
-- the app (the anon key is what actually lets a browser talk to Supabase
-- directly), but as of 2026-07-14 this project has a live, public
-- NEXT_PUBLIC_SUPABASE_ANON_KEY (added for the new /account sign-in flow),
-- so the exposure is now real and must be closed.
--
-- Every one of these tables is read/written exclusively via the server-side
-- admin client (SUPABASE_SERVICE_ROLE_KEY in lib/supabase-server.ts), which
-- always bypasses RLS regardless of policies. Enabling RLS with zero
-- policies below therefore blocks all anon/authenticated access (the
-- default-deny) without breaking any existing server-side functionality --
-- confirmed no app code queries any of these tables through the anon-key
-- browser/server client (lib/supabase/client.ts, lib/supabase/server.ts),
-- which is only used for auth and the already-RLS-protected
-- `subscriptions` table.

alter table public.commodity_quotes enable row level security;
alter table public.company_actions enable row level security;
alter table public.industry_observations enable row level security;
alter table public.market_brief_snapshots enable row level security;
alter table public.research_sources enable row level security;
alter table public.signal_events enable row level security;
alter table public.signal_evidence_items enable row level security;
alter table public.signal_lessons enable row level security;
alter table public.signal_outcomes enable row level security;
alter table public.signal_publication_reviews enable row level security;
alter table public.signal_score_components enable row level security;
alter table public.signal_timeline_events enable row level security;
alter table public.signal_watchlists enable row level security;
alter table public.stock_prices enable row level security;
alter table public.taifex_futures_institutional_oi enable row level security;
alter table public.taifex_options_put_call_ratio enable row level security;
alter table public.tw_fx_rates enable row level security;
alter table public.tw_institutional_value_flows enable row level security;
alter table public.tw_margin_trading_balance enable row level security;
