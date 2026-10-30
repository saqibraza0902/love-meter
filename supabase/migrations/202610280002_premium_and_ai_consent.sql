alter table public.profiles add column ai_consent_at timestamptz;
grant update (ai_consent_at) on public.profiles to authenticated;
alter publication supabase_realtime add table public.entitlements;

-- Subscription state is written only by the RevenueCat webhook using the
-- service role. Client sessions may read their own entitlement, never grant it.
revoke insert, update, delete on public.entitlements from authenticated, anon;

drop policy if exists "couple members upload private media" on storage.objects;
create policy "active members upload private media" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'private-media'
    and exists (
      select 1 from public.couple_members cm
      where cm.user_id = auth.uid() and cm.left_at is null
        and (storage.foldername(name))[1] = cm.couple_id::text
    )
    and (
      (storage.foldername(name))[2] <> 'quizzes'
      or exists (
        select 1 from public.entitlements e
        where e.user_id = auth.uid() and e.active
      )
    )
  );

create or replace function public.create_quiz(target_couple uuid, quiz_name text, quiz_questions jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare quiz_uuid uuid; q jsonb; o jsonb; question_uuid uuid; option_uuid uuid; q_position integer; o_position integer;
begin
  if not public.is_couple_member(target_couple) then raise exception 'Not a member of this couple'; end if;
  if jsonb_typeof(quiz_questions) <> 'array' or jsonb_array_length(quiz_questions) = 0 then raise exception 'Quiz needs at least one question'; end if;
  if exists (
    select 1 from jsonb_array_elements(quiz_questions) questions
    cross join lateral jsonb_array_elements(questions.value->'options') options
    where options.value ? 'image_path'
  ) and not exists (
    select 1 from public.entitlements e where e.user_id = auth.uid() and e.active
  ) then
    raise exception 'An active subscription is required to add quiz images';
  end if;
  insert into public.quizzes (couple_id, creator_id, name)
    values (target_couple, auth.uid(), trim(quiz_name)) returning id into quiz_uuid;
  q_position := 0;
  for q in select value from jsonb_array_elements(quiz_questions) loop
    insert into public.quiz_questions (quiz_id, position, question)
      values (quiz_uuid, q_position, q->>'question') returning id into question_uuid;
    o_position := 0;
    for o in select value from jsonb_array_elements(q->'options') loop
      insert into public.quiz_options (question_id, position, text, image_path)
        values (question_uuid, o_position, coalesce(o->>'text',''), o->>'image_path') returning id into option_uuid;
      if o_position = (q->>'correctIndex')::integer then
        insert into public.quiz_answer_keys (question_id, correct_option_id) values (question_uuid, option_uuid);
      end if;
      o_position := o_position + 1;
    end loop;
    if not exists (select 1 from public.quiz_answer_keys k where k.question_id = question_uuid) then raise exception 'Invalid correct option'; end if;
    q_position := q_position + 1;
  end loop;
  return quiz_uuid;
end;
$$;
revoke all on function public.create_quiz(uuid, text, jsonb) from public;
grant execute on function public.create_quiz(uuid, text, jsonb) to authenticated;
