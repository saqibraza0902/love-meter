-- Reuse the previous relationship row when the same two users reconnect.
-- This restores access to their existing messages and shared couple history
-- instead of creating a fresh, empty conversation.
create or replace function public.accept_pairing_request(request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  req public.pairing_requests%rowtype;
  relationship_id uuid;
begin
  select * into req from public.pairing_requests
  where id = request_id and to_user_id = auth.uid() and status = 'pending'
  for update;
  if not found then raise exception 'Pairing request not found or already handled'; end if;

  -- Serialize requests involving either account before checking active links.
  perform p.id from public.profiles p
  where p.id in (req.from_user_id, req.to_user_id)
  order by p.id
  for update;

  if exists (
    select 1 from public.couple_members
    where user_id in (req.from_user_id, req.to_user_id) and left_at is null
  ) then
    raise exception 'One of these users is already paired';
  end if;

  -- Pick the most recent ended relationship that contains exactly this pair.
  select c.id into relationship_id
  from public.couples c
  join public.couple_members sender_member
    on sender_member.couple_id = c.id and sender_member.user_id = req.from_user_id
  join public.couple_members recipient_member
    on recipient_member.couple_id = c.id and recipient_member.user_id = req.to_user_id
  where c.status = 'ended'
    and (select count(*) from public.couple_members cm where cm.couple_id = c.id) = 2
  order by c.ended_at desc nulls last, c.created_at desc
  limit 1
  for update of c;

  if relationship_id is null then
    insert into public.couples (created_by) values (req.to_user_id)
      returning id into relationship_id;
    insert into public.couple_members (couple_id, user_id)
      values (relationship_id, req.from_user_id), (relationship_id, req.to_user_id);
  else
    update public.couples set status = 'active', ended_at = null
      where id = relationship_id;
    update public.couple_members set left_at = null
      where couple_id = relationship_id;
  end if;

  update public.pairing_requests
    set status = 'accepted', responded_at = now()
    where id = request_id;
  return relationship_id;
end;
$$;

revoke all on function public.accept_pairing_request(uuid) from public;
grant execute on function public.accept_pairing_request(uuid) to authenticated;

-- Couple content is visible only during an active pairing. The same rows and
-- history become visible again if those two accounts reconnect.
create or replace function public.is_couple_participant(target_couple uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.couple_members cm
    join public.couples c on c.id = cm.couple_id
    where cm.couple_id = target_couple and cm.user_id = auth.uid()
      and cm.left_at is null and c.status = 'active'
  );
$$;
revoke all on function public.is_couple_participant(uuid) from public;
grant execute on function public.is_couple_participant(uuid) to authenticated;

drop policy if exists "couple members access private media" on storage.objects;
create policy "active couple members access private media" on storage.objects
  for select to authenticated using (
    bucket_id = 'private-media' and exists (
      select 1 from public.couple_members cm
      join public.couples c on c.id = cm.couple_id
      where cm.user_id = auth.uid() and cm.left_at is null and c.status = 'active'
        and (storage.foldername(name))[1] = cm.couple_id::text
    )
  );
