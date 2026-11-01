-- Preserve existing date-only cycle records while allowing entries to carry
-- the owner's local start/end time as a timezone-aware instant.
alter table public.period_logs
  add column if not exists period_start_at timestamptz,
  add column if not exists period_end_at timestamptz;

alter table public.period_tracker_preferences
  add column if not exists tracks_periods boolean not null default false;

update public.period_tracker_preferences pref
set tracks_periods = true
where pref.share_with_partner
   or exists (select 1 from public.period_logs logs where logs.user_id = pref.user_id and logs.couple_id = pref.couple_id);

create index if not exists period_logs_couple_start_instant
  on public.period_logs(couple_id, period_start_at desc);
