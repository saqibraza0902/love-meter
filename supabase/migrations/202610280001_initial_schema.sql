-- Initial relational schema for Love Meter.
-- Apply with `supabase db push` after linking this directory to your project.

create extension if not exists pgcrypto;

create type public.pairing_request_status as enum ('pending', 'accepted', 'rejected', 'cancelled');
create type public.couple_status as enum ('active', 'ended');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null default '',
  bio text not null default '',
  photo_path text,
  verified boolean not null default false,
  paid boolean not null default false,
  score integer not null default 0 check (score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id),
  status public.couple_status not null default 'active',
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (couple_id, user_id)
);

create unique index one_active_couple_per_user
  on public.couple_members(user_id)
  where left_at is null;

create table public.pairing_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  from_user_email text not null,
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  status public.pairing_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint pairing_request_distinct_users check (from_user_id <> to_user_id)
);

create unique index one_pending_pair_request_per_direction
  on public.pairing_requests(from_user_id, to_user_id)
  where status = 'pending';
create index pairing_requests_recipient_status_created
  on public.pairing_requests(to_user_id, status, created_at desc);

create function public.set_pairing_sender_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and auth.uid() <> new.from_user_id then
    raise exception 'Cannot create a request for another user';
  end if;
  select p.email into new.from_user_email from public.profiles p where p.id = new.from_user_id;
  return new;
end;
$$;
create trigger pairing_requests_set_sender_email before insert on public.pairing_requests
  for each row execute procedure public.set_pairing_sender_email();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  sender_name text not null default '',
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  client_request_id uuid,
  unique (sender_id, client_request_id)
);
create index messages_couple_created_id
  on public.messages(couple_id, created_at desc, id desc);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  memory_date date not null,
  text text not null default '',
  image_path text,
  created_at timestamptz not null default now()
);
create index memories_couple_date on public.memories(couple_id, memory_date desc, created_at desc);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  creator_id uuid not null references public.profiles(id),
  name text not null check (char_length(name) between 1 and 160),
  created_at timestamptz not null default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position integer not null check (position >= 0),
  question text not null,
  unique (quiz_id, position)
);

create table public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  position integer not null check (position >= 0),
  text text not null default '',
  image_path text,
  unique (id, question_id),
  unique (question_id, position)
);

create table public.quiz_answer_keys (
  question_id uuid primary key references public.quiz_questions(id) on delete cascade,
  correct_option_id uuid not null references public.quiz_options(id)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (quiz_id, user_id)
);

create table public.quiz_answers (
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  option_id uuid not null references public.quiz_options(id),
  primary key (attempt_id, question_id)
);

create table public.things_to_do (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  description text,
  link text,
  image_path text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index things_to_do_slug_created on public.things_to_do(slug, created_at desc);

create table public.entitlements (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan text not null default 'free',
  active boolean not null default false,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

-- A profile is created atomically with each Supabase Auth user.
create function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- Membership helper used by row-level security policies.
create function public.is_couple_member(target_couple uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.couple_members cm
    join public.couples c on c.id = cm.couple_id
    where cm.couple_id = target_couple and cm.user_id = auth.uid()
      and cm.left_at is null and c.status = 'active'
  );
$$;

create function public.is_couple_participant(target_couple uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.couple_members cm
    where cm.couple_id = target_couple and cm.user_id = auth.uid()
  );
$$;
revoke all on function public.is_couple_member(uuid) from public;
revoke all on function public.is_couple_participant(uuid) from public;
grant execute on function public.is_couple_member(uuid) to authenticated;
grant execute on function public.is_couple_participant(uuid) to authenticated;

create function public.set_message_sender_name()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and auth.uid() <> new.sender_id then
    raise exception 'Cannot send a message as another user';
  end if;
  select p.name into new.sender_name from public.profiles p where p.id = new.sender_id;
  return new;
end;
$$;
create trigger messages_set_sender_name before insert on public.messages
  for each row execute procedure public.set_message_sender_name();

alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.pairing_requests enable row level security;
alter table public.messages enable row level security;
alter table public.memories enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.quiz_answer_keys enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.things_to_do enable row level security;
alter table public.entitlements enable row level security;

create policy "profiles visible to self and active partner" on public.profiles
  for select to authenticated using (
    id = auth.uid() or exists (
      select 1 from public.couple_members mine
      join public.couple_members theirs on theirs.couple_id = mine.couple_id
      join public.couples c on c.id = mine.couple_id
      where mine.user_id = auth.uid() and mine.left_at is null
        and theirs.user_id = profiles.id and theirs.left_at is null and c.status = 'active'
    )
  );
create policy "users update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "members read couples" on public.couples
  for select to authenticated using (public.is_couple_participant(id));
create policy "members read membership" on public.couple_members
  for select to authenticated using (public.is_couple_participant(couple_id) or user_id = auth.uid());

create policy "participants read pairing requests" on public.pairing_requests
  for select to authenticated using (from_user_id = auth.uid() or to_user_id = auth.uid());
create policy "sender creates pairing request" on public.pairing_requests
  for insert to authenticated with check (from_user_id = auth.uid());
create policy "recipient responds to request" on public.pairing_requests
  for update to authenticated using (to_user_id = auth.uid() and status = 'pending')
  with check (to_user_id = auth.uid() and status = 'rejected');

create policy "couple members read messages" on public.messages
  for select to authenticated using (public.is_couple_participant(couple_id));
create policy "couple members send messages as self" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid() and public.is_couple_member(couple_id)
  );
create policy "members update message read receipt" on public.messages
  for update to authenticated using (public.is_couple_participant(couple_id))
  with check (public.is_couple_participant(couple_id));

create policy "couple participants read memories" on public.memories
  for select to authenticated using (public.is_couple_participant(couple_id));
create policy "active couple members add memories" on public.memories
  for insert to authenticated with check (public.is_couple_member(couple_id) and created_by = auth.uid());
create policy "active couple members manage memories" on public.memories
  for update to authenticated using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id));
create policy "active couple members delete memories" on public.memories
  for delete to authenticated using (public.is_couple_member(couple_id));

create policy "couple members read quizzes" on public.quizzes
  for select to authenticated using (public.is_couple_participant(couple_id));
create policy "couple members create quizzes" on public.quizzes
  for insert to authenticated with check (
    creator_id = auth.uid() and public.is_couple_member(couple_id)
  );
create policy "creator edits quizzes" on public.quizzes
  for update to authenticated using (creator_id = auth.uid())
  with check (creator_id = auth.uid());
create policy "couple members read quiz questions" on public.quiz_questions
  for select to authenticated using (exists (
    select 1 from public.quizzes q where q.id = quiz_id and public.is_couple_participant(q.couple_id)
  ));
create policy "quiz creator manages questions" on public.quiz_questions
  for all to authenticated using (exists (
    select 1 from public.quizzes q where q.id = quiz_id and q.creator_id = auth.uid()
  )) with check (exists (
    select 1 from public.quizzes q where q.id = quiz_id and q.creator_id = auth.uid()
  ));
create policy "couple members read options" on public.quiz_options
  for select to authenticated using (exists (
    select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
    where qq.id = question_id and public.is_couple_participant(q.couple_id)
  ));
create policy "quiz creator manages options" on public.quiz_options
  for all to authenticated using (exists (
    select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
    where qq.id = question_id and q.creator_id = auth.uid()
  )) with check (exists (
    select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
    where qq.id = question_id and q.creator_id = auth.uid()
  ));
create policy "quiz creator alone reads answer keys" on public.quiz_answer_keys
  for select to authenticated using (exists (
    select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
    where qq.id = question_id and q.creator_id = auth.uid()
  ));
create policy "quiz creator manages answer keys" on public.quiz_answer_keys
  for all to authenticated using (exists (
    select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
    where qq.id = question_id and q.creator_id = auth.uid()
  )) with check (exists (
    select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
    where qq.id = question_id and q.creator_id = auth.uid()
  ));
create policy "user reads own quiz attempts" on public.quiz_attempts
  for select to authenticated using (user_id = auth.uid() or exists (
    select 1 from public.quizzes q where q.id = quiz_id and q.creator_id = auth.uid()
  ));
create policy "user manages own quiz attempt" on public.quiz_attempts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "attempt owner manages answers" on public.quiz_answers
  for all to authenticated using (exists (
    select 1 from public.quiz_attempts a where a.id = attempt_id and a.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.quiz_attempts a where a.id = attempt_id and a.user_id = auth.uid()
  ));
create policy "quiz creator reads submitted answers" on public.quiz_answers
  for select to authenticated using (exists (
    select 1 from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
    where a.id = attempt_id and q.creator_id = auth.uid() and a.submitted_at is not null
  ));

create policy "authenticated users read activities" on public.things_to_do
  for select to authenticated using (true);
create policy "authenticated users create activities" on public.things_to_do
  for insert to authenticated with check (created_by = auth.uid());

create policy "users read own entitlements" on public.entitlements
  for select to authenticated using (user_id = auth.uid());

-- Keep sensitive account and message fields out of direct client updates.
revoke update on public.profiles from authenticated;
grant update (name, bio, photo_path) on public.profiles to authenticated;
revoke update, delete on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;

-- Score increments happen in the database, so simultaneous sends cannot lose points.
create function public.add_message_score()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles
  set score = score + cardinality(regexp_split_to_array(trim(new.body), '\s+'))
  where id = new.sender_id;
  return new;
end;
$$;
create trigger messages_add_score after insert on public.messages
  for each row execute procedure public.add_message_score();

-- Restrict profile email discovery to a controlled function instead of exposing all emails.
create function public.find_profile_by_email(target_email text)
returns table (id uuid, name text, email text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.email from public.profiles p
  where lower(p.email) = lower(trim(target_email)) and p.id <> auth.uid()
  limit 1;
$$;
revoke all on function public.find_profile_by_email(text) from public;
grant execute on function public.find_profile_by_email(text) to authenticated;

-- Atomic acceptance: both members are inserted in one transaction; the partial
-- unique index prevents either user from acquiring a second active couple.
create function public.accept_pairing_request(request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare req public.pairing_requests%rowtype; new_couple uuid;
begin
  select * into req from public.pairing_requests
  where id = request_id and to_user_id = auth.uid() and status = 'pending'
  for update;
  if not found then raise exception 'Pairing request not found or already handled'; end if;
  if exists (select 1 from public.couple_members where user_id in (req.from_user_id, req.to_user_id) and left_at is null) then
    raise exception 'One of these users is already paired';
  end if;
  insert into public.couples (created_by) values (req.to_user_id) returning id into new_couple;
  insert into public.couple_members (couple_id, user_id)
    values (new_couple, req.from_user_id), (new_couple, req.to_user_id);
  update public.pairing_requests set status = 'accepted', responded_at = now() where id = request_id;
  return new_couple;
end;
$$;
revoke all on function public.accept_pairing_request(uuid) from public;
grant execute on function public.accept_pairing_request(uuid) to authenticated;

create function public.end_active_couple()
returns void language plpgsql security definer set search_path = '' as $$
declare active_couple uuid;
begin
  select cm.couple_id into active_couple from public.couple_members cm
  join public.couples c on c.id = cm.couple_id
  where cm.user_id = auth.uid() and cm.left_at is null and c.status = 'active'
  for update of c;
  if active_couple is null then raise exception 'No active couple'; end if;
  update public.couple_members set left_at = now()
    where couple_id = active_couple and left_at is null;
  update public.couples set status = 'ended', ended_at = now() where id = active_couple;
end;
$$;
revoke all on function public.end_active_couple() from public;
grant execute on function public.end_active_couple() to authenticated;

create function public.create_quiz(target_couple uuid, quiz_name text, quiz_questions jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare quiz_uuid uuid; q jsonb; o jsonb; question_uuid uuid; option_uuid uuid; q_position integer; o_position integer;
begin
  if not public.is_couple_member(target_couple) then raise exception 'Not a member of this couple'; end if;
  if jsonb_typeof(quiz_questions) <> 'array' or jsonb_array_length(quiz_questions) = 0 then raise exception 'Quiz needs at least one question'; end if;
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

create function public.submit_quiz(target_quiz uuid, submitted_answers jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare quiz_row public.quizzes%rowtype; attempt_uuid uuid; answer jsonb;
begin
  select * into quiz_row from public.quizzes where id = target_quiz;
  if not found or not public.is_couple_member(quiz_row.couple_id) then raise exception 'Quiz not found'; end if;
  if quiz_row.creator_id = auth.uid() then raise exception 'Quiz creator cannot submit their own quiz'; end if;
  if exists (select 1 from public.quiz_attempts where quiz_id = target_quiz and user_id = auth.uid()) then raise exception 'Quiz already submitted'; end if;
  insert into public.quiz_attempts (quiz_id, user_id) values (target_quiz, auth.uid()) returning id into attempt_uuid;
  for answer in select value from jsonb_array_elements(submitted_answers) loop
    if not exists (
      select 1 from public.quiz_questions qq join public.quiz_options qo on qo.question_id = qq.id
      where qq.quiz_id = target_quiz and qq.id = (answer->>'question_id')::uuid and qo.id = (answer->>'option_id')::uuid
    ) then raise exception 'Answer does not belong to this quiz'; end if;
    insert into public.quiz_answers (attempt_id, question_id, option_id)
      values (attempt_uuid, (answer->>'question_id')::uuid, (answer->>'option_id')::uuid);
  end loop;
  if (select count(*) from public.quiz_answers where attempt_id = attempt_uuid) <
     (select count(*) from public.quiz_questions where quiz_id = target_quiz) then
    raise exception 'Answer every question before submitting';
  end if;
  update public.quiz_attempts set submitted_at = now() where id = attempt_uuid;
  return attempt_uuid;
end;
$$;
revoke all on function public.submit_quiz(uuid, jsonb) from public;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;

create function public.get_quiz_results(target_attempt uuid)
returns table (question_id uuid, correct_option_position integer, answer_position integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.quiz_attempts a where a.id = target_attempt
      and a.user_id = auth.uid() and a.submitted_at is not null) then
    raise exception 'Submitted attempt not found';
  end if;
  return query
    select qq.id, correct.position, answer.position
    from public.quiz_attempts a
    join public.quiz_questions qq on qq.quiz_id = a.quiz_id
    join public.quiz_answer_keys k on k.question_id = qq.id
    join public.quiz_options correct on correct.id = k.correct_option_id
    left join public.quiz_answers qa on qa.attempt_id = a.id and qa.question_id = qq.id
    left join public.quiz_options answer on answer.id = qa.option_id
    where a.id = target_attempt;
end;
$$;
revoke all on function public.get_quiz_results(uuid) from public;
grant execute on function public.get_quiz_results(uuid) to authenticated;

-- Explicit API privileges complement RLS and avoid relying on project defaults.
grant usage on schema public to authenticated;
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.couples, public.couple_members,
  public.pairing_requests, public.messages, public.memories, public.quizzes,
  public.quiz_questions, public.quiz_options, public.quiz_answer_keys,
  public.quiz_attempts, public.quiz_answers, public.things_to_do, public.entitlements
  to authenticated;
grant update (name, bio, photo_path) on public.profiles to authenticated;
grant insert on public.pairing_requests to authenticated;
grant update (status, responded_at) on public.pairing_requests to authenticated;
grant insert on public.messages, public.memories, public.things_to_do to authenticated;
grant update (read_at) on public.messages to authenticated;

-- Enable realtime for append-only messages; each message is an independent row.
alter publication supabase_realtime add table
  public.messages,
  public.couple_members,
  public.pairing_requests,
  public.quizzes,
  public.quiz_attempts;

insert into storage.buckets (id, name, public)
values ('private-media', 'private-media', false)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
values ('public-content', 'public-content', true)
on conflict (id) do nothing;

create policy "couple members access private media" on storage.objects
  for select to authenticated using (
    bucket_id = 'private-media' and exists (
      select 1 from public.couple_members cm
      where cm.user_id = auth.uid()
        and (storage.foldername(name))[1] = cm.couple_id::text
    )
  );
create policy "couple members upload private media" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'private-media' and exists (
      select 1 from public.couple_members cm
      where cm.user_id = auth.uid() and cm.left_at is null
        and (storage.foldername(name))[1] = cm.couple_id::text
    )
  );
create policy "authenticated users upload public content" on storage.objects
  for insert to authenticated with check (bucket_id = 'public-content');
create policy "public content is readable" on storage.objects
  for select using (bucket_id = 'public-content');
