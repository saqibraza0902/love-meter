-- Shared, couple-scoped planning tools. Sensitive cycle data remains private
-- unless its owner explicitly enables sharing with their active partner.

alter table public.profiles add column if not exists time_zone text not null default 'UTC';
grant update (time_zone) on public.profiles to authenticated;

create table public.shared_statuses (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 180),
  updated_at timestamptz not null default now(),
  unique (couple_id, user_id)
);

create table public.shared_calendar_events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 1 and 120),
  details text not null default '',
  event_kind text not null default 'plan' check (event_kind in ('plan','work','reminder','call','watch')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  link_url text,
  created_at timestamptz not null default now()
);
create index shared_calendar_couple_start on public.shared_calendar_events(couple_id, starts_at);

create table public.shared_goals (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 1 and 120),
  details text not null default '',
  target_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index shared_goals_couple_created on public.shared_goals(couple_id, created_at desc);

create table public.shared_notes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 1 and 140),
  content text not null default '',
  category text not null default 'note' check (category in ('note','immigration','checklist','playlist','watch')),
  link_url text,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shared_notes_couple_updated on public.shared_notes(couple_id, pinned desc, updated_at desc);

create table public.shared_links (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 1 and 140),
  url text not null check (url ~ '^https?://'),
  kind text not null check (kind in ('watch','playlist')),
  created_at timestamptz not null default now()
);
create index shared_links_couple_created on public.shared_links(couple_id, created_at desc);

create table public.shared_sketchboards (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  strokes jsonb not null default '[]'::jsonb check (jsonb_typeof(strokes) = 'array'),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.period_tracker_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  share_with_partner boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.period_logs (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  period_start date not null,
  period_end date,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (period_end is null or period_end >= period_start)
);
create unique index period_logs_owner_start_unique on public.period_logs(user_id, period_start);
create index period_logs_owner_date on public.period_logs(user_id, period_start desc);

create function public.guard_shared_life_author()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.created_by <> auth.uid() then
    raise exception 'Shared items must be created by the signed-in user';
  end if;
  if tg_op = 'UPDATE' and new.created_by is distinct from old.created_by then
    raise exception 'The creator of a shared item cannot be changed';
  end if;
  return new;
end;
$$;
create trigger shared_calendar_author before insert or update on public.shared_calendar_events
  for each row execute procedure public.guard_shared_life_author();
create trigger shared_goals_author before insert or update on public.shared_goals
  for each row execute procedure public.guard_shared_life_author();
create trigger shared_notes_author before insert or update on public.shared_notes
  for each row execute procedure public.guard_shared_life_author();
create trigger shared_links_author before insert or update on public.shared_links
  for each row execute procedure public.guard_shared_life_author();

create function public.can_read_shared_period(owner_id uuid, target_couple uuid)
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
revoke all on function public.can_read_shared_period(uuid, uuid) from public;
grant execute on function public.can_read_shared_period(uuid, uuid) to authenticated;

alter table public.shared_statuses enable row level security;
alter table public.shared_calendar_events enable row level security;
alter table public.shared_goals enable row level security;
alter table public.shared_notes enable row level security;
alter table public.shared_links enable row level security;
alter table public.shared_sketchboards enable row level security;
alter table public.period_tracker_preferences enable row level security;
alter table public.period_logs enable row level security;

create policy "active couple members read statuses" on public.shared_statuses
  for select to authenticated using (public.is_couple_member(couple_id));
create policy "users publish own status" on public.shared_statuses
  for insert to authenticated with check (user_id = auth.uid() and public.is_couple_member(couple_id));
create policy "users update own status" on public.shared_statuses
  for update to authenticated using (user_id = auth.uid() and public.is_couple_member(couple_id))
  with check (user_id = auth.uid() and public.is_couple_member(couple_id));
create policy "users remove own status" on public.shared_statuses
  for delete to authenticated using (user_id = auth.uid() and public.is_couple_member(couple_id));

create policy "couples manage calendar" on public.shared_calendar_events
  for all to authenticated using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));
create policy "couples manage future goals" on public.shared_goals
  for all to authenticated using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));
create policy "couples manage shared notes" on public.shared_notes
  for all to authenticated using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));
create policy "couples manage shared links" on public.shared_links
  for all to authenticated using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));
create policy "active couples read shared sketchboard" on public.shared_sketchboards
  for select to authenticated using (public.is_couple_member(couple_id));
create policy "users manage own cycle sharing preference" on public.period_tracker_preferences
  for all to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_couple_member(couple_id));
create policy "partners see cycle sharing consent" on public.period_tracker_preferences
  for select to authenticated using (user_id <> auth.uid() and public.is_couple_member(couple_id));
create policy "users read own or consented partner cycle logs" on public.period_logs
  for select to authenticated using (user_id = auth.uid() or public.can_read_shared_period(user_id, couple_id));
create policy "users add own cycle logs" on public.period_logs
  for insert to authenticated with check (user_id = auth.uid() and public.is_couple_member(couple_id));
create policy "users update own cycle logs" on public.period_logs
  for update to authenticated using (user_id = auth.uid() and public.is_couple_member(couple_id))
  with check (user_id = auth.uid() and public.is_couple_member(couple_id));
create policy "users delete own cycle logs" on public.period_logs
  for delete to authenticated using (user_id = auth.uid() and public.is_couple_member(couple_id));

grant select, insert, update, delete on public.shared_statuses, public.shared_calendar_events,
  public.shared_goals, public.shared_notes, public.shared_links, public.period_tracker_preferences, public.period_logs
  to authenticated;
revoke all on public.shared_sketchboards from anon, authenticated;
grant select on public.shared_sketchboards to authenticated;

create function public.append_shared_sketch_stroke(target_couple uuid, stroke jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare latest jsonb;
begin
  if not public.is_couple_member(target_couple) then raise exception 'Active couple membership required'; end if;
  if jsonb_typeof(stroke) is distinct from 'object' then
    raise exception 'Invalid sketch stroke';
  end if;
  if jsonb_typeof(stroke -> 'points') is distinct from 'array' then
    raise exception 'Invalid sketch stroke points';
  end if;
  if jsonb_array_length(stroke -> 'points') not between 1 and 500 then
    raise exception 'Sketch strokes must contain between 1 and 500 points';
  end if;
  if exists (select 1 from public.shared_sketchboards where couple_id = target_couple and jsonb_array_length(strokes) >= 5000) then
    raise exception 'The shared canvas is full; clear it before adding more';
  end if;
  insert into public.shared_sketchboards as existing(couple_id, strokes, updated_by)
    values (target_couple, jsonb_build_array(stroke), auth.uid())
  on conflict (couple_id) do update
    set strokes = existing.strokes || excluded.strokes,
        updated_by = auth.uid(), updated_at = now()
  returning strokes into latest;
  return latest;
end;
$$;
create function public.clear_shared_sketchboard(target_couple uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_couple_member(target_couple) then raise exception 'Active couple membership required'; end if;
  insert into public.shared_sketchboards(couple_id, strokes, updated_by)
    values (target_couple, '[]'::jsonb, auth.uid())
  on conflict (couple_id) do update
    set strokes = '[]'::jsonb, updated_by = auth.uid(), updated_at = now();
  return '[]'::jsonb;
end;
$$;
revoke all on function public.append_shared_sketch_stroke(uuid, jsonb) from public;
revoke all on function public.clear_shared_sketchboard(uuid) from public;
grant execute on function public.append_shared_sketch_stroke(uuid, jsonb) to authenticated;
grant execute on function public.clear_shared_sketchboard(uuid) to authenticated;
alter publication supabase_realtime add table public.shared_statuses, public.shared_calendar_events,
  public.shared_goals, public.shared_notes, public.shared_links, public.period_logs, public.period_tracker_preferences;
alter publication supabase_realtime add table public.shared_sketchboards;
