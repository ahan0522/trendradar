alter table public.model_replay_signal_results
  drop constraint if exists model_replay_signal_results_pkey;

alter table public.model_replay_signal_results
  add primary key (run_id, model_version, signal_id);
