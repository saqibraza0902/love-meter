alter table public.quizzes
  add column if not exists quiz_mode text not null default 'scored'
  check (quiz_mode in ('scored', 'conversation'));

create or replace function public.create_conversation_quiz(target_couple uuid, quiz_name text, quiz_questions jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare quiz_uuid uuid; q jsonb; o jsonb; question_uuid uuid; q_position integer; o_position integer;
begin
  if not public.is_couple_member(target_couple) then raise exception 'Not a member of this couple'; end if;
  if jsonb_typeof(quiz_questions) <> 'array' or jsonb_array_length(quiz_questions) = 0 then raise exception 'Quiz needs at least one question'; end if;
  insert into public.quizzes (couple_id, creator_id, name, quiz_mode)
    values (target_couple, auth.uid(), trim(quiz_name), 'conversation') returning id into quiz_uuid;
  q_position := 0;
  for q in select value from jsonb_array_elements(quiz_questions) loop
    if jsonb_typeof(q->'options') <> 'array' or jsonb_array_length(q->'options') < 2 then
      raise exception 'Each question needs at least two options';
    end if;
    insert into public.quiz_questions (quiz_id, position, question)
      values (quiz_uuid, q_position, q->>'question') returning id into question_uuid;
    o_position := 0;
    for o in select value from jsonb_array_elements(q->'options') loop
      insert into public.quiz_options (question_id, position, text, image_path)
        values (question_uuid, o_position, coalesce(o->>'text',''), o->>'image_path');
      o_position := o_position + 1;
    end loop;
    q_position := q_position + 1;
  end loop;
  return quiz_uuid;
end;
$$;
revoke all on function public.create_conversation_quiz(uuid, text, jsonb) from public;
grant execute on function public.create_conversation_quiz(uuid, text, jsonb) to authenticated;
