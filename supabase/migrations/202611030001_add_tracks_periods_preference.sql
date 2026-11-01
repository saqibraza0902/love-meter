alter table public.period_tracker_preferences
  add column if not exists tracks_periods boolean not null default false;

-- Keep existing cycle users visible in the tracker after adding the opt-in.
update public.period_tracker_preferences pref
set tracks_periods = true
where pref.share_with_partner
   or exists (
     select 1
     from public.period_logs logs
     where logs.user_id = pref.user_id
       and logs.couple_id = pref.couple_id
   );
