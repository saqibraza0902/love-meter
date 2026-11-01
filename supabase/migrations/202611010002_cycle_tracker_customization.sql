alter table public.period_tracker_preferences
  add column if not exists cycle_length integer not null default 28 check (cycle_length between 15 and 60),
  add column if not exists period_length integer not null default 5 check (period_length between 1 and 15);

create or replace function public.can_manage_shared_period(owner_id uuid, target_couple uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.period_tracker_preferences pref
    join public.couple_members cm on cm.couple_id = pref.couple_id
    join public.couples c on c.id = cm.couple_id
    where pref.user_id = owner_id and pref.couple_id = target_couple
      and pref.share_with_partner and cm.user_id = auth.uid()
      and cm.user_id <> owner_id and cm.left_at is null and c.status = 'active'
  );
$$;
revoke all on function public.can_manage_shared_period(uuid, uuid) from public;
grant execute on function public.can_manage_shared_period(uuid, uuid) to authenticated;

drop policy if exists "users add own cycle logs" on public.period_logs;
drop policy if exists "users update own cycle logs" on public.period_logs;
drop policy if exists "users delete own cycle logs" on public.period_logs;

create policy "owners or consented partners add cycle logs" on public.period_logs
  for insert to authenticated
  with check ((user_id = auth.uid() and public.is_couple_member(couple_id)) or public.can_manage_shared_period(user_id, couple_id));
create policy "owners or consented partners update cycle logs" on public.period_logs
  for update to authenticated
  using ((user_id = auth.uid() and public.is_couple_member(couple_id)) or public.can_manage_shared_period(user_id, couple_id))
  with check ((user_id = auth.uid() and public.is_couple_member(couple_id)) or public.can_manage_shared_period(user_id, couple_id));
create policy "owners or consented partners delete cycle logs" on public.period_logs
  for delete to authenticated
  using ((user_id = auth.uid() and public.is_couple_member(couple_id)) or public.can_manage_shared_period(user_id, couple_id));
