alter table public.messages
  add column edited_at timestamptz,
  add column deleted_at timestamptz,
  add column reply_to_id uuid references public.messages(id) on delete set null;

create index messages_reply_to_id on public.messages(reply_to_id) where reply_to_id is not null;

drop policy if exists "members update message read receipt" on public.messages;
create policy "couple members update message receipt or own message" on public.messages
  for update to authenticated
  using (public.is_couple_participant(couple_id))
  with check (public.is_couple_participant(couple_id));

revoke update on public.messages from authenticated;
grant update (read_at, body, edited_at, deleted_at) on public.messages to authenticated;

create function public.guard_message_changes()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if (new.body is distinct from old.body or new.edited_at is distinct from old.edited_at or new.deleted_at is distinct from old.deleted_at)
     and old.sender_id <> auth.uid() then
    raise exception 'Only the sender can edit or delete this message';
  end if;
  return new;
end;
$$;
create trigger messages_guard_changes before update on public.messages
  for each row execute procedure public.guard_message_changes();
