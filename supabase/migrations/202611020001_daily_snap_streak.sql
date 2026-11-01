create table public.shared_daily_snaps (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checkin_date date not null,
  status_text text not null check (char_length(status_text) between 1 and 180),
  image_path text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index shared_daily_snaps_expiry on public.shared_daily_snaps(expires_at);

create table public.shared_daily_streak_days (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checkin_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, checkin_date)
);
create index shared_daily_streak_days_history on public.shared_daily_streak_days(couple_id, user_id, checkin_date desc);

alter table public.shared_daily_snaps enable row level security;
alter table public.shared_daily_streak_days enable row level security;

create policy "couples read unexpired daily snaps" on public.shared_daily_snaps
  for select to authenticated
  using (expires_at > now() and public.is_couple_participant(couple_id));
create policy "users add own daily snaps" on public.shared_daily_snaps
  for insert to authenticated
  with check (
    user_id = auth.uid() and public.is_couple_member(couple_id)
    and expires_at > now() and expires_at <= now() + interval '24 hours'
  );
create policy "users remove own daily snaps" on public.shared_daily_snaps
  for delete to authenticated using (user_id = auth.uid() and public.is_couple_member(couple_id));

create policy "couples read shared streak history" on public.shared_daily_streak_days
  for select to authenticated using (public.is_couple_participant(couple_id));
create policy "users add own streak days" on public.shared_daily_streak_days
  for insert to authenticated with check (
    user_id = auth.uid() and public.is_couple_member(couple_id)
    and exists (
      select 1 from public.shared_daily_snaps snap
      where snap.couple_id = shared_daily_streak_days.couple_id
        and snap.user_id = auth.uid() and snap.checkin_date = shared_daily_streak_days.checkin_date
    )
  );

grant select, insert, delete on public.shared_daily_snaps to authenticated;
grant select, insert on public.shared_daily_streak_days to authenticated;
alter publication supabase_realtime add table public.shared_daily_snaps, public.shared_daily_streak_days;

-- Existing private media remains couple-only. Snap files become inaccessible as soon as their row expires.
drop policy if exists "active couple members access private media" on storage.objects;
create policy "active couple members access private media" on storage.objects
  for select to authenticated using (
    bucket_id = 'private-media' and exists (
      select 1 from public.couple_members cm
      join public.couples c on c.id = cm.couple_id
      where cm.user_id = auth.uid() and cm.left_at is null and c.status = 'active'
        and (storage.foldername(name))[1] = cm.couple_id::text
        and (
          (storage.foldername(name))[2] <> 'daily-snaps'
          or exists (
            select 1 from public.shared_daily_snaps snap
            where snap.image_path = name and snap.expires_at > now()
              and public.is_couple_participant(snap.couple_id)
          )
        )
    )
  );
