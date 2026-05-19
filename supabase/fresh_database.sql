create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.profile_sex as enum ('man', 'woman');
create type public.age_group as enum ('high_school', 'college', 'adult');
create type public.club_role as enum ('member', 'officer', 'president');
create type public.notification_category as enum ('social', 'club', 'court');
create type public.friend_request_status as enum ('pending', 'accepted', 'rejected');
create type public.ladder_code as enum (
  'mens_singles',
  'mens_doubles',
  'mixed_doubles',
  'womens_singles',
  'womens_doubles'
);
create type public.ladder_request_type as enum ('join', 'challenge');
create type public.ladder_request_status as enum (
  'pending_partner',
  'pending_officer',
  'approved',
  'rejected'
);
create type public.court_play_type as enum ('singles', 'doubles', 'either');
create type public.court_location_type as enum ('osu', 'custom');
create type public.court_audience as enum ('public', 'friends', 'club');
create type public.court_response_status as enum ('pending', 'accepted', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  email text not null unique,
  first_name text not null,
  last_name text not null,
  sex public.profile_sex not null,
  age_group public.age_group not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_username_format check (
    username ~ '^[a-z0-9_]{3,24}$'
    and username !~ '^[0-9]+$'
    and username not like 'player\_%'
  )
);

create unique index profiles_username_lower_unique
  on public.profiles (lower(username));

create unique index profiles_email_lower_unique
  on public.profiles (lower(email));

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  password_hash text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint clubs_name_length check (length(trim(name)) between 3 and 80)
);

create unique index clubs_name_lower_unique
  on public.clubs (lower(name));

create table public.club_memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.club_role not null default 'member',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (club_id, user_id)
);

create unique index club_memberships_one_president_per_club
  on public.club_memberships (club_id)
  where role = 'president';

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  status public.friend_request_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz,
  constraint friend_requests_not_self check (sender_id <> receiver_id)
);

create unique index friend_requests_pending_pair_unique
  on public.friend_requests (
    least(sender_id::text, receiver_id::text),
    greatest(sender_id::text, receiver_id::text)
  )
  where status = 'pending';

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_one_id uuid not null references public.profiles (id) on delete cascade,
  user_two_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint friendships_ordered_pair check (user_one_id::text < user_two_id::text),
  unique (user_one_id, user_two_id)
);

create table public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category public.notification_category not null,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.ladders (
  id uuid primary key default gen_random_uuid(),
  code public.ladder_code not null unique,
  name text not null,
  description text not null,
  sort_order integer not null unique
);

create table public.ladder_entries (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  ladder_id uuid not null references public.ladders (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  partner_user_id uuid references public.profiles (id) on delete cascade,
  rank_position integer not null check (rank_position > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ladder_entries_distinct_partner check (partner_user_id is null or partner_user_id <> user_id),
  unique (club_id, ladder_id, rank_position) deferrable initially immediate
);

create table public.ladder_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  ladder_id uuid not null references public.ladders (id) on delete cascade,
  request_type public.ladder_request_type not null,
  status public.ladder_request_status not null,
  target_rank integer,
  message text,
  partner_user_id uuid references public.profiles (id) on delete cascade,
  requester_drop_ladder_id uuid references public.ladders (id) on delete set null,
  partner_drop_ladder_id uuid references public.ladders (id) on delete set null,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ladder_requests_challenge_target check (
    (request_type = 'join' and target_rank is null)
    or (request_type = 'challenge' and target_rank is not null and target_rank > 0)
  )
);

create unique index ladder_requests_open_unique
  on public.ladder_requests (club_id, requester_id, ladder_id, request_type)
  where status in ('pending_partner', 'pending_officer');

create table public.courts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  play_type public.court_play_type not null,
  description text,
  scheduled_at timestamptz not null,
  location_type public.court_location_type not null,
  location_label text not null,
  osu_court_number integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint courts_osu_number_check check (
    (location_type = 'osu' and osu_court_number between 1 and 10)
    or (location_type = 'custom' and osu_court_number is null)
  )
);

create table public.court_audiences (
  court_id uuid not null references public.courts (id) on delete cascade,
  audience public.court_audience not null,
  primary key (court_id, audience)
);

create table public.court_clubs (
  court_id uuid not null references public.courts (id) on delete cascade,
  club_id uuid not null references public.clubs (id) on delete cascade,
  primary key (court_id, club_id)
);

create table public.court_invites (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts (id) on delete cascade,
  invited_user_id uuid not null references public.profiles (id) on delete cascade,
  status public.court_response_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz,
  unique (court_id, invited_user_id)
);

create table public.court_join_requests (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  status public.court_response_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz,
  unique (court_id, requester_id)
);

insert into public.ladders (code, name, description, sort_order)
values
  ('mens_singles', 'Mens Singles', 'Singles ladder for men.', 1),
  ('mens_doubles', 'Mens Doubles', 'Doubles ladder for men.', 2),
  ('mixed_doubles', 'Mixed Doubles', 'Doubles ladder with one man and one woman.', 3),
  ('womens_singles', 'Womens Singles', 'Singles ladder for women.', 4),
  ('womens_doubles', 'Womens Doubles', 'Doubles ladder for women.', 5);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create trigger clubs_set_updated_at
before update on public.clubs
for each row execute procedure public.set_updated_at();

create trigger club_memberships_set_updated_at
before update on public.club_memberships
for each row execute procedure public.set_updated_at();

create trigger ladder_entries_set_updated_at
before update on public.ladder_entries
for each row execute procedure public.set_updated_at();

create trigger ladder_requests_set_updated_at
before update on public.ladder_requests
for each row execute procedure public.set_updated_at();

create trigger courts_set_updated_at
before update on public.courts
for each row execute procedure public.set_updated_at();

create or replace function public.normalize_username(p_username text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(coalesce(trim(p_username), ''), '[^a-zA-Z0-9_]', '', 'g'));
$$;

create or replace function public.assert_valid_username(p_username text)
returns void
language plpgsql
immutable
as $$
declare
  v_blocked text[] := array[
    'admin', 'officer', 'moderator', 'support', 'staff', 'system', 'root', 'guest',
    'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'pussy', 'cunt',
    'nigger', 'nigga', 'faggot', 'retard', 'slut', 'whore', 'rape', 'rapist',
    'hitler', 'nazi', 'kkk'
  ];
  v_part text;
begin
  if p_username is null
    or p_username !~ '^[a-z0-9_]{3,24}$'
    or p_username ~ '^[0-9]+$'
    or p_username like 'player\_%'
  then
    raise exception 'Choose a username with 3-24 lowercase letters, numbers, or underscores.';
  end if;

  foreach v_part in array v_blocked loop
    if position(v_part in p_username) > 0 then
      raise exception 'Choose a different username.';
    end if;
  end loop;
end;
$$;

create or replace function public.full_name(p_profile public.profiles)
returns text
language sql
stable
as $$
  select trim(p_profile.first_name || ' ' || p_profile.last_name);
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_first_name text;
  v_last_name text;
  v_sex public.profile_sex;
  v_age_group public.age_group;
begin
  v_username := public.normalize_username(new.raw_user_meta_data ->> 'username');
  perform public.assert_valid_username(v_username);

  v_first_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), '');
  v_last_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), '');

  if v_first_name is null or v_last_name is null then
    raise exception 'First and last name are required.';
  end if;

  v_sex := case
    when new.raw_user_meta_data ->> 'sex' in ('man', 'woman')
      then (new.raw_user_meta_data ->> 'sex')::public.profile_sex
    else 'man'::public.profile_sex
  end;

  v_age_group := case
    when new.raw_user_meta_data ->> 'age_group' in ('high_school', 'college', 'adult')
      then (new.raw_user_meta_data ->> 'age_group')::public.age_group
    else 'adult'::public.age_group
  end;

  insert into public.profiles (id, username, email, first_name, last_name, sex, age_group)
  values (new.id, v_username, lower(new.email), v_first_name, v_last_name, v_sex, v_age_group);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.add_notification(
  p_user_id uuid,
  p_category public.notification_category,
  p_title text,
  p_body text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.app_notifications (user_id, category, title, body, metadata)
  values (p_user_id, p_category, left(trim(p_title), 120), left(trim(p_body), 500), coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.app_notifications
  set read_at = coalesce(read_at, timezone('utc', now()))
  where id = p_notification_id
    and user_id = auth.uid();
end;
$$;

create or replace function public.mark_category_notifications_read(p_category public.notification_category)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.app_notifications
  set read_at = coalesce(read_at, timezone('utc', now()))
  where user_id = auth.uid()
    and category = p_category
    and read_at is null;
end;
$$;

create or replace function public.are_friends(p_left uuid, p_right uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.friendships
    where (user_one_id = least(p_left::text, p_right::text)::uuid
      and user_two_id = greatest(p_left::text, p_right::text)::uuid)
  );
$$;

create or replace function public.is_club_member(p_user_id uuid, p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_memberships
    where user_id = p_user_id
      and club_id = p_club_id
  );
$$;

create or replace function public.club_role_for(p_user_id uuid, p_club_id uuid)
returns public.club_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.club_memberships
  where user_id = p_user_id
    and club_id = p_club_id;
$$;

create or replace function public.assert_club_officer(p_club_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.club_role_for(auth.uid(), p_club_id) not in ('officer', 'president') then
    raise exception 'Officer access is required for this club.';
  end if;
end;
$$;

create or replace function public.assert_club_president(p_club_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.club_role_for(auth.uid(), p_club_id) <> 'president' then
    raise exception 'Only the club president can do that.';
  end if;
end;
$$;

create or replace function public.create_club(p_name text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_club_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in.';
  end if;

  if length(v_name) < 3 or length(v_name) > 80 then
    raise exception 'Club name must be 3-80 characters.';
  end if;

  if p_password is null or length(trim(p_password)) < 4 then
    raise exception 'Club password must be at least 4 characters.';
  end if;

  insert into public.clubs (name, password_hash, created_by)
  values (v_name, extensions.crypt(trim(p_password), extensions.gen_salt('bf')), auth.uid())
  returning id into v_club_id;

  insert into public.club_memberships (club_id, user_id, role)
  values (v_club_id, auth.uid(), 'president');

  perform public.add_notification(auth.uid(), 'club', 'Club created', 'You are the president of ' || v_name || '.', jsonb_build_object('club_id', v_club_id));

  return v_club_id;
exception
  when unique_violation then
    raise exception 'A club with that name already exists.';
end;
$$;

create or replace function public.join_club(p_name text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_club public.clubs;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in.';
  end if;

  select *
  into v_club
  from public.clubs
  where lower(name) = lower(v_name);

  if v_club.id is null then
    raise exception 'Club not found.';
  end if;

  if p_password is null or extensions.crypt(trim(p_password), v_club.password_hash) <> v_club.password_hash then
    raise exception 'Invalid club password.';
  end if;

  insert into public.club_memberships (club_id, user_id, role)
  values (v_club.id, auth.uid(), 'member');

  perform public.add_notification(auth.uid(), 'club', 'Club joined', 'You joined ' || v_club.name || '.', jsonb_build_object('club_id', v_club.id));

  insert into public.app_notifications (user_id, category, title, body, metadata)
  select user_id, 'club', 'New club member', public.full_name(p) || ' joined ' || v_club.name || '.', jsonb_build_object('club_id', v_club.id)
  from public.club_memberships m
  join public.profiles p on p.id = auth.uid()
  where m.club_id = v_club.id
    and m.role in ('officer', 'president')
    and m.user_id <> auth.uid();

  return v_club.id;
exception
  when unique_violation then
    raise exception 'You are already in this club.';
end;
$$;

create or replace function public.set_club_member_role(
  p_club_id uuid,
  p_member_id uuid,
  p_role public.club_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_name text;
begin
  perform public.assert_club_president(p_club_id);

  if p_role = 'president' then
    raise exception 'Use transfer presidency instead.';
  end if;

  if p_member_id = auth.uid() then
    raise exception 'Use transfer presidency to change your own president role.';
  end if;

  select name into v_club_name from public.clubs where id = p_club_id;

  update public.club_memberships
  set role = p_role
  where club_id = p_club_id
    and user_id = p_member_id
    and role <> 'president';

  if not found then
    raise exception 'Club member not found.';
  end if;

  perform public.add_notification(
    p_member_id,
    'club',
    'Club role updated',
    'Your role in ' || v_club_name || ' is now ' || p_role::text || '.',
    jsonb_build_object('club_id', p_club_id)
  );
end;
$$;

create or replace function public.transfer_club_presidency(p_club_id uuid, p_new_president_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_name text;
begin
  perform public.assert_club_president(p_club_id);

  if p_new_president_id = auth.uid() then
    raise exception 'Choose a different member.';
  end if;

  if not public.is_club_member(p_new_president_id, p_club_id) then
    raise exception 'Choose a member of this club.';
  end if;

  select name into v_club_name from public.clubs where id = p_club_id;

  update public.club_memberships
  set role = 'officer'
  where club_id = p_club_id
    and user_id = auth.uid();

  update public.club_memberships
  set role = 'president'
  where club_id = p_club_id
    and user_id = p_new_president_id;

  perform public.add_notification(
    p_new_president_id,
    'club',
    'Club presidency transferred',
    'You are now president of ' || v_club_name || '.',
    jsonb_build_object('club_id', p_club_id)
  );
end;
$$;

create or replace function public.search_users_by_username(p_query text)
returns table (
  id uuid,
  username text,
  first_name text,
  last_name text,
  full_name text,
  sex public.profile_sex,
  age_group public.age_group,
  is_friend boolean,
  has_pending_request boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.first_name,
    p.last_name,
    public.full_name(p),
    p.sex,
    p.age_group,
    public.are_friends(auth.uid(), p.id),
    exists (
      select 1
      from public.friend_requests fr
      where fr.status = 'pending'
        and (
          (fr.sender_id = auth.uid() and fr.receiver_id = p.id)
          or (fr.sender_id = p.id and fr.receiver_id = auth.uid())
        )
    )
  from public.profiles p
  where p.username = public.normalize_username(p_query)
    and p.id <> auth.uid();
$$;

create or replace function public.send_friend_request(p_username text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receiver_id uuid;
  v_request_id uuid;
  v_sender public.profiles;
begin
  select id into v_receiver_id
  from public.profiles
  where username = public.normalize_username(p_username);

  if v_receiver_id is null or v_receiver_id = auth.uid() then
    raise exception 'User not found.';
  end if;

  if public.are_friends(auth.uid(), v_receiver_id) then
    raise exception 'You are already friends.';
  end if;

  if exists (
    select 1
    from public.friend_requests
    where status = 'pending'
      and least(sender_id::text, receiver_id::text) = least(auth.uid()::text, v_receiver_id::text)
      and greatest(sender_id::text, receiver_id::text) = greatest(auth.uid()::text, v_receiver_id::text)
  ) then
    raise exception 'A friend request already exists.';
  end if;

  select * into v_sender from public.profiles where id = auth.uid();

  insert into public.friend_requests (sender_id, receiver_id)
  values (auth.uid(), v_receiver_id)
  returning id into v_request_id;

  perform public.add_notification(
    v_receiver_id,
    'social',
    'Friend request',
    public.full_name(v_sender) || ' sent you a friend request.',
    jsonb_build_object('friend_request_id', v_request_id)
  );

  return v_request_id;
exception
  when unique_violation then
    raise exception 'A friend request already exists.';
end;
$$;

create or replace function public.respond_to_friend_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.friend_requests;
  v_low uuid;
  v_high uuid;
  v_receiver public.profiles;
begin
  select *
  into v_request
  from public.friend_requests
  where id = p_request_id
    and receiver_id = auth.uid()
    and status = 'pending';

  if v_request.id is null then
    raise exception 'Friend request not found.';
  end if;

  update public.friend_requests
  set status = case when p_accept then 'accepted' else 'rejected' end,
      responded_at = timezone('utc', now())
  where id = p_request_id;

  if p_accept then
    v_low := least(v_request.sender_id::text, v_request.receiver_id::text)::uuid;
    v_high := greatest(v_request.sender_id::text, v_request.receiver_id::text)::uuid;

    insert into public.friendships (user_one_id, user_two_id)
    values (v_low, v_high)
    on conflict do nothing;

    select * into v_receiver from public.profiles where id = auth.uid();

    perform public.add_notification(
      v_request.sender_id,
      'social',
      'Friend request accepted',
      public.full_name(v_receiver) || ' accepted your friend request.',
      jsonb_build_object('friend_request_id', p_request_id)
    );
  end if;
end;
$$;

create or replace function public.ladder_code_for(p_ladder_id uuid)
returns public.ladder_code
language sql
stable
security definer
set search_path = public
as $$
  select code from public.ladders where id = p_ladder_id;
$$;

create or replace function public.is_doubles_ladder(p_ladder_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.ladder_code_for(p_ladder_id) in ('mens_doubles', 'mixed_doubles', 'womens_doubles');
$$;

create or replace function public.assert_ladder_eligible(
  p_user_id uuid,
  p_partner_user_id uuid,
  p_ladder_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.ladder_code;
  v_user_sex public.profile_sex;
  v_partner_sex public.profile_sex;
begin
  select code into v_code from public.ladders where id = p_ladder_id;
  select sex into v_user_sex from public.profiles where id = p_user_id;

  if v_code in ('mens_singles', 'mens_doubles') and v_user_sex <> 'man' then
    raise exception 'This ladder is only open to men.';
  end if;

  if v_code in ('womens_singles', 'womens_doubles') and v_user_sex <> 'woman' then
    raise exception 'This ladder is only open to women.';
  end if;

  if public.is_doubles_ladder(p_ladder_id) then
    if p_partner_user_id is null or p_partner_user_id = p_user_id then
      raise exception 'Doubles ladders require a partner.';
    end if;

    select sex into v_partner_sex from public.profiles where id = p_partner_user_id;

    if v_code = 'mens_doubles' and v_partner_sex <> 'man' then
      raise exception 'Mens doubles requires two men.';
    end if;

    if v_code = 'womens_doubles' and v_partner_sex <> 'woman' then
      raise exception 'Womens doubles requires two women.';
    end if;

    if v_code = 'mixed_doubles' and v_partner_sex = v_user_sex then
      raise exception 'Mixed doubles requires one man and one woman.';
    end if;
  elsif p_partner_user_id is not null then
    raise exception 'Singles ladders do not use a partner.';
  end if;
end;
$$;

create or replace function public.user_active_ladder_count(p_user_id uuid, p_club_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.ladder_entries
  where club_id = p_club_id
    and (user_id = p_user_id or partner_user_id = p_user_id);
$$;

create or replace function public.user_ladder_entry_id(p_user_id uuid, p_club_id uuid, p_ladder_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.ladder_entries
  where club_id = p_club_id
    and ladder_id = p_ladder_id
    and (user_id = p_user_id or partner_user_id = p_user_id)
  limit 1;
$$;

create or replace function public.remove_ladder_entry(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.ladder_entries;
begin
  select * into v_entry from public.ladder_entries where id = p_entry_id;

  if v_entry.id is null then
    return;
  end if;

  set constraints ladder_entries_club_id_ladder_id_rank_position_key deferred;

  delete from public.ladder_entries where id = p_entry_id;

  update public.ladder_entries
  set rank_position = rank_position - 1
  where club_id = v_entry.club_id
    and ladder_id = v_entry.ladder_id
    and rank_position > v_entry.rank_position;
end;
$$;

create or replace function public.remove_user_ladder_entry(
  p_user_id uuid,
  p_club_id uuid,
  p_ladder_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
begin
  v_entry_id := public.user_ladder_entry_id(p_user_id, p_club_id, p_ladder_id);

  if v_entry_id is not null then
    perform public.remove_ladder_entry(v_entry_id);
  end if;
end;
$$;

create or replace function public.insert_ladder_entry(
  p_club_id uuid,
  p_ladder_id uuid,
  p_user_id uuid,
  p_partner_user_id uuid,
  p_rank integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rank integer;
  v_entry_id uuid;
  v_count integer;
begin
  if not public.is_club_member(p_user_id, p_club_id) then
    raise exception 'Player must be in this club.';
  end if;

  if p_partner_user_id is not null and not public.is_club_member(p_partner_user_id, p_club_id) then
    raise exception 'Partner must be in this club.';
  end if;

  perform public.assert_ladder_eligible(p_user_id, p_partner_user_id, p_ladder_id);

  if public.user_ladder_entry_id(p_user_id, p_club_id, p_ladder_id) is not null
    or (p_partner_user_id is not null and public.user_ladder_entry_id(p_partner_user_id, p_club_id, p_ladder_id) is not null)
  then
    raise exception 'A player is already on that ladder.';
  end if;

  if public.user_active_ladder_count(p_user_id, p_club_id) >= 2 then
    raise exception 'Players can only be on two ladders per club.';
  end if;

  if p_partner_user_id is not null and public.user_active_ladder_count(p_partner_user_id, p_club_id) >= 2 then
    raise exception 'Partners can only be on two ladders per club.';
  end if;

  select count(*)::integer into v_count
  from public.ladder_entries
  where club_id = p_club_id
    and ladder_id = p_ladder_id;

  v_rank := coalesce(p_rank, v_count + 1);
  v_rank := greatest(1, least(v_rank, v_count + 1));

  set constraints ladder_entries_club_id_ladder_id_rank_position_key deferred;

  update public.ladder_entries
  set rank_position = rank_position + 1
  where club_id = p_club_id
    and ladder_id = p_ladder_id
    and rank_position >= v_rank;

  insert into public.ladder_entries (club_id, ladder_id, user_id, partner_user_id, rank_position)
  values (p_club_id, p_ladder_id, p_user_id, p_partner_user_id, v_rank)
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

create or replace function public.move_ladder_entry(p_entry_id uuid, p_new_rank integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.ladder_entries;
  v_max_rank integer;
  v_rank integer;
begin
  select * into v_entry from public.ladder_entries where id = p_entry_id;

  if v_entry.id is null then
    raise exception 'Ladder entry not found.';
  end if;

  select count(*)::integer into v_max_rank
  from public.ladder_entries
  where club_id = v_entry.club_id
    and ladder_id = v_entry.ladder_id;

  v_rank := greatest(1, least(p_new_rank, v_max_rank));

  if v_rank = v_entry.rank_position then
    return;
  end if;

  set constraints ladder_entries_club_id_ladder_id_rank_position_key deferred;

  if v_rank < v_entry.rank_position then
    update public.ladder_entries
    set rank_position = rank_position + 1
    where club_id = v_entry.club_id
      and ladder_id = v_entry.ladder_id
      and rank_position >= v_rank
      and rank_position < v_entry.rank_position;
  else
    update public.ladder_entries
    set rank_position = rank_position - 1
    where club_id = v_entry.club_id
      and ladder_id = v_entry.ladder_id
      and rank_position <= v_rank
      and rank_position > v_entry.rank_position;
  end if;

  update public.ladder_entries
  set rank_position = v_rank
  where id = p_entry_id;
end;
$$;

create or replace function public.notify_club_officers(
  p_club_id uuid,
  p_title text,
  p_body text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.app_notifications (user_id, category, title, body, metadata)
  select user_id, 'club', left(trim(p_title), 120), left(trim(p_body), 500), coalesce(p_metadata, '{}'::jsonb)
  from public.club_memberships
  where club_id = p_club_id
    and role in ('officer', 'president');
$$;

create or replace function public.submit_ladder_request(
  p_club_id uuid,
  p_ladder_code public.ladder_code,
  p_request_type public.ladder_request_type,
  p_target_rank integer default null,
  p_message text default null,
  p_partner_username text default null,
  p_drop_ladder_code public.ladder_code default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ladder_id uuid;
  v_partner_id uuid;
  v_status public.ladder_request_status;
  v_request_id uuid;
  v_drop_ladder_id uuid;
  v_profile public.profiles;
  v_current_rank integer;
  v_min_rank integer;
  v_max_rank integer;
begin
  if not public.is_club_member(auth.uid(), p_club_id) then
    raise exception 'Join this club before using its ladders.';
  end if;

  select id into v_ladder_id from public.ladders where code = p_ladder_code;

  if v_ladder_id is null then
    raise exception 'Ladder not found.';
  end if;

  if p_request_type = 'join' then
    if public.is_doubles_ladder(v_ladder_id) then
      select id into v_partner_id
      from public.profiles
      where username = public.normalize_username(p_partner_username);

      if v_partner_id is null then
        raise exception 'Choose an eligible friend for doubles.';
      end if;

      if not public.are_friends(auth.uid(), v_partner_id) then
        raise exception 'Doubles partners must be friends.';
      end if;

      if not public.is_club_member(v_partner_id, p_club_id) then
        raise exception 'Doubles partners must be in the same club.';
      end if;
    end if;

    perform public.assert_ladder_eligible(auth.uid(), v_partner_id, v_ladder_id);

    if public.user_active_ladder_count(auth.uid(), p_club_id) >= 2 then
      if p_drop_ladder_code is null then
        raise exception 'Choose a ladder to drop if this request is approved.';
      end if;

      select id into v_drop_ladder_id from public.ladders where code = p_drop_ladder_code;

      if public.user_ladder_entry_id(auth.uid(), p_club_id, v_drop_ladder_id) is null then
        raise exception 'Choose one of your active ladders to drop.';
      end if;
    end if;

    v_status := case when v_partner_id is null then 'pending_officer' else 'pending_partner' end;
  else
    if public.is_doubles_ladder(v_ladder_id) then
      select partner_user_id into v_partner_id
      from public.ladder_entries
      where club_id = p_club_id
        and ladder_id = v_ladder_id
        and (user_id = auth.uid() or partner_user_id = auth.uid());
    end if;

    select rank_position into v_current_rank
    from public.ladder_entries
    where club_id = p_club_id
      and ladder_id = v_ladder_id
      and (user_id = auth.uid() or partner_user_id = auth.uid());

    if v_current_rank is null or v_current_rank <= 1 then
      raise exception 'You need an active ladder spot below rank 1 to challenge.';
    end if;

    v_min_rank := case when v_current_rank > 7 then 1 else greatest(1, v_current_rank - 3) end;
    v_max_rank := case when v_current_rank > 7 then 7 else v_current_rank - 1 end;

    if p_target_rank is null or p_target_rank < v_min_rank or p_target_rank > v_max_rank then
      raise exception 'Choose a valid challenge rank.';
    end if;

    v_status := 'pending_officer';
  end if;

  insert into public.ladder_requests (
    club_id,
    requester_id,
    ladder_id,
    request_type,
    status,
    target_rank,
    message,
    partner_user_id,
    requester_drop_ladder_id
  )
  values (
    p_club_id,
    auth.uid(),
    v_ladder_id,
    p_request_type,
    v_status,
    case when p_request_type = 'challenge' then p_target_rank else null end,
    nullif(trim(coalesce(p_message, '')), ''),
    v_partner_id,
    v_drop_ladder_id
  )
  returning id into v_request_id;

  select * into v_profile from public.profiles where id = auth.uid();

  if v_status = 'pending_partner' then
    perform public.add_notification(
      v_partner_id,
      'club',
      'Doubles ladder invite',
      public.full_name(v_profile) || ' invited you to a doubles ladder.',
      jsonb_build_object('ladder_request_id', v_request_id, 'club_id', p_club_id)
    );
  else
    perform public.notify_club_officers(
      p_club_id,
      'Ladder request ready',
      public.full_name(v_profile) || ' submitted a ladder request.',
      jsonb_build_object('ladder_request_id', v_request_id, 'club_id', p_club_id)
    );
  end if;

  return v_request_id;
end;
$$;

create or replace function public.respond_to_partner_ladder_invite(
  p_request_id uuid,
  p_accept boolean,
  p_drop_ladder_code public.ladder_code default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.ladder_requests;
  v_drop_ladder_id uuid;
  v_partner public.profiles;
begin
  select * into v_request
  from public.ladder_requests
  where id = p_request_id
    and partner_user_id = auth.uid()
    and status = 'pending_partner';

  if v_request.id is null then
    raise exception 'Partner invite not found.';
  end if;

  if p_accept then
    if public.user_active_ladder_count(auth.uid(), v_request.club_id) >= 2 then
      if p_drop_ladder_code is null then
        raise exception 'Choose a ladder to drop if this request is approved.';
      end if;

      select id into v_drop_ladder_id from public.ladders where code = p_drop_ladder_code;

      if public.user_ladder_entry_id(auth.uid(), v_request.club_id, v_drop_ladder_id) is null then
        raise exception 'Choose one of your active ladders to drop.';
      end if;
    end if;

    update public.ladder_requests
    set status = 'pending_officer',
        partner_drop_ladder_id = v_drop_ladder_id
    where id = p_request_id;

    select * into v_partner from public.profiles where id = auth.uid();

    perform public.add_notification(
      v_request.requester_id,
      'club',
      'Doubles invite accepted',
      public.full_name(v_partner) || ' accepted your doubles ladder invite.',
      jsonb_build_object('ladder_request_id', p_request_id, 'club_id', v_request.club_id)
    );

    perform public.notify_club_officers(
      v_request.club_id,
      'Ladder request ready',
      'A doubles ladder request is ready for review.',
      jsonb_build_object('ladder_request_id', p_request_id, 'club_id', v_request.club_id)
    );
  else
    update public.ladder_requests
    set status = 'rejected',
        resolved_at = timezone('utc', now())
    where id = p_request_id;

    perform public.add_notification(
      v_request.requester_id,
      'club',
      'Doubles invite declined',
      'Your doubles partner declined the ladder invite.',
      jsonb_build_object('ladder_request_id', p_request_id, 'club_id', v_request.club_id)
    );
  end if;
end;
$$;

create or replace function public.officer_add_ladder_entry(
  p_club_id uuid,
  p_ladder_code public.ladder_code,
  p_user_id uuid,
  p_partner_user_id uuid default null,
  p_rank integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ladder_id uuid;
begin
  perform public.assert_club_officer(p_club_id);

  select id into v_ladder_id from public.ladders where code = p_ladder_code;

  return public.insert_ladder_entry(p_club_id, v_ladder_id, p_user_id, p_partner_user_id, p_rank);
end;
$$;

create or replace function public.officer_move_ladder_entry(p_entry_id uuid, p_new_rank integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
begin
  select club_id into v_club_id from public.ladder_entries where id = p_entry_id;
  perform public.assert_club_officer(v_club_id);
  perform public.move_ladder_entry(p_entry_id, p_new_rank);
end;
$$;

create or replace function public.officer_remove_ladder_entry(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
begin
  select club_id into v_club_id from public.ladder_entries where id = p_entry_id;
  perform public.assert_club_officer(v_club_id);
  perform public.remove_ladder_entry(p_entry_id);
end;
$$;

create or replace function public.member_drop_own_ladder_entry(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.ladder_entries;
begin
  select * into v_entry
  from public.ladder_entries
  where id = p_entry_id
    and (user_id = auth.uid() or partner_user_id = auth.uid());

  if v_entry.id is null then
    raise exception 'Ladder entry not found.';
  end if;

  perform public.remove_ladder_entry(p_entry_id);
end;
$$;

create or replace function public.officer_resolve_ladder_request(
  p_request_id uuid,
  p_decision text,
  p_rank integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.ladder_requests;
  v_ladder public.ladders;
begin
  select * into v_request
  from public.ladder_requests
  where id = p_request_id
    and status = 'pending_officer';

  if v_request.id is null then
    raise exception 'Ladder request not found.';
  end if;

  perform public.assert_club_officer(v_request.club_id);

  select * into v_ladder from public.ladders where id = v_request.ladder_id;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected.';
  end if;

  if p_decision = 'approved' then
    if v_request.request_type = 'join' then
      if v_request.requester_drop_ladder_id is not null then
        perform public.remove_user_ladder_entry(v_request.requester_id, v_request.club_id, v_request.requester_drop_ladder_id);
      end if;

      if v_request.partner_user_id is not null and v_request.partner_drop_ladder_id is not null then
        perform public.remove_user_ladder_entry(v_request.partner_user_id, v_request.club_id, v_request.partner_drop_ladder_id);
      end if;

      perform public.insert_ladder_entry(
        v_request.club_id,
        v_request.ladder_id,
        v_request.requester_id,
        v_request.partner_user_id,
        p_rank
      );
    else
      perform public.move_ladder_entry(
        public.user_ladder_entry_id(v_request.requester_id, v_request.club_id, v_request.ladder_id),
        coalesce(p_rank, v_request.target_rank)
      );
    end if;
  end if;

  update public.ladder_requests
  set status = p_decision::public.ladder_request_status,
      resolved_by = auth.uid(),
      resolved_at = timezone('utc', now())
  where id = p_request_id;

  perform public.add_notification(
    v_request.requester_id,
    'club',
    'Ladder request ' || p_decision,
    'Your ' || v_ladder.name || ' request was ' || p_decision || '.',
    jsonb_build_object('ladder_request_id', p_request_id, 'club_id', v_request.club_id)
  );

  if v_request.partner_user_id is not null then
    perform public.add_notification(
      v_request.partner_user_id,
      'club',
      'Ladder request ' || p_decision,
      'Your ' || v_ladder.name || ' request was ' || p_decision || '.',
      jsonb_build_object('ladder_request_id', p_request_id, 'club_id', v_request.club_id)
    );
  end if;
end;
$$;

create or replace function public.court_capacity(p_court_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when play_type = 'singles' then 2 else 4 end
  from public.courts
  where id = p_court_id;
$$;

create or replace function public.court_participant_count(p_court_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select 1
    + (select count(*)::integer from public.court_invites where court_id = p_court_id and status = 'accepted')
    + (select count(*)::integer from public.court_join_requests where court_id = p_court_id and status = 'accepted');
$$;

create or replace function public.can_user_see_court(p_user_id uuid, p_court_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.courts c
    where c.id = p_court_id
      and (
        c.creator_id = p_user_id
        or exists (
          select 1 from public.court_invites i
          where i.court_id = c.id and i.invited_user_id = p_user_id
        )
        or exists (
          select 1 from public.court_audiences a
          where a.court_id = c.id and a.audience = 'public'
        )
        or (
          exists (
            select 1 from public.court_audiences a
            where a.court_id = c.id and a.audience = 'friends'
          )
          and public.are_friends(c.creator_id, p_user_id)
        )
        or exists (
          select 1
          from public.court_audiences a
          join public.court_clubs cc on cc.court_id = a.court_id
          join public.club_memberships cm on cm.club_id = cc.club_id
          where a.court_id = c.id
            and a.audience = 'club'
            and cm.user_id = p_user_id
        )
      )
  );
$$;

create or replace function public.create_court(
  p_play_type public.court_play_type,
  p_description text,
  p_scheduled_at timestamptz,
  p_location_type public.court_location_type,
  p_custom_location text default null,
  p_osu_court_number integer default null,
  p_broadcast_public boolean default false,
  p_broadcast_friends boolean default false,
  p_broadcast_club_ids uuid[] default '{}',
  p_invited_friend_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_court_id uuid;
  v_location_label text;
  v_club_id uuid;
  v_friend_id uuid;
  v_invites uuid[] := coalesce(p_invited_friend_ids, '{}');
begin
  if auth.uid() is null then
    raise exception 'You must be logged in.';
  end if;

  if p_scheduled_at <= timezone('utc', now()) then
    raise exception 'Choose a future date and time.';
  end if;

  if p_location_type = 'osu' then
    if p_osu_court_number is null or p_osu_court_number < 1 or p_osu_court_number > 10 then
      raise exception 'Choose an OSU court number from 1-10.';
    end if;
    v_location_label := 'OSU Courts #' || p_osu_court_number::text;
  else
    v_location_label := nullif(trim(coalesce(p_custom_location, '')), '');
    if v_location_label is null then
      raise exception 'Enter a custom court location.';
    end if;
  end if;

  if not p_broadcast_public
    and not p_broadcast_friends
    and coalesce(array_length(p_broadcast_club_ids, 1), 0) = 0
    and coalesce(array_length(v_invites, 1), 0) = 0
  then
    raise exception 'Choose at least one audience or invite a friend.';
  end if;

  if coalesce(array_length(v_invites, 1), 0) > 0 then
    if p_play_type = 'doubles' and array_length(v_invites, 1) < 3 then
      raise exception 'Doubles friend invites need at least 3 friends.';
    end if;

    if p_play_type in ('singles', 'either') and array_length(v_invites, 1) < 1 then
      raise exception 'Choose at least one friend to invite.';
    end if;
  end if;

  insert into public.courts (
    creator_id,
    play_type,
    description,
    scheduled_at,
    location_type,
    location_label,
    osu_court_number
  )
  values (
    auth.uid(),
    p_play_type,
    nullif(trim(coalesce(p_description, '')), ''),
    p_scheduled_at,
    p_location_type,
    v_location_label,
    case when p_location_type = 'osu' then p_osu_court_number else null end
  )
  returning id into v_court_id;

  if p_broadcast_public then
    insert into public.court_audiences (court_id, audience) values (v_court_id, 'public');
  end if;

  if p_broadcast_friends then
    insert into public.court_audiences (court_id, audience) values (v_court_id, 'friends');
  end if;

  foreach v_club_id in array coalesce(p_broadcast_club_ids, '{}') loop
    if not public.is_club_member(auth.uid(), v_club_id) then
      raise exception 'You can only broadcast to your clubs.';
    end if;

    insert into public.court_audiences (court_id, audience) values (v_court_id, 'club')
    on conflict do nothing;
    insert into public.court_clubs (court_id, club_id) values (v_court_id, v_club_id)
    on conflict do nothing;
  end loop;

  foreach v_friend_id in array v_invites loop
    if v_friend_id = auth.uid() or not public.are_friends(auth.uid(), v_friend_id) then
      raise exception 'Court invites can only go to friends.';
    end if;

    insert into public.court_invites (court_id, invited_user_id)
    values (v_court_id, v_friend_id)
    on conflict do nothing;

    perform public.add_notification(
      v_friend_id,
      'court',
      'Court invite',
      'You were invited to play at ' || v_location_label || '.',
      jsonb_build_object('court_id', v_court_id)
    );
  end loop;

  return v_court_id;
end;
$$;

create or replace function public.request_join_court(p_court_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_court public.courts;
  v_request_id uuid;
  v_profile public.profiles;
begin
  select * into v_court from public.courts where id = p_court_id;

  if v_court.id is null then
    raise exception 'Court not found.';
  end if;

  if v_court.creator_id = auth.uid() then
    raise exception 'You created this court.';
  end if;

  if exists (
    select 1 from public.court_invites
    where court_id = p_court_id and invited_user_id = auth.uid()
  ) then
    raise exception 'Respond to your direct invite instead.';
  end if;

  if not public.can_user_see_court(auth.uid(), p_court_id) then
    raise exception 'You cannot request this court.';
  end if;

  if public.court_participant_count(p_court_id) >= public.court_capacity(p_court_id) then
    raise exception 'This court is already full.';
  end if;

  insert into public.court_join_requests (court_id, requester_id)
  values (p_court_id, auth.uid())
  returning id into v_request_id;

  select * into v_profile from public.profiles where id = auth.uid();

  perform public.add_notification(
    v_court.creator_id,
    'court',
    'Court join request',
    public.full_name(v_profile) || ' asked to join your court.',
    jsonb_build_object('court_id', p_court_id, 'join_request_id', v_request_id)
  );

  return v_request_id;
exception
  when unique_violation then
    raise exception 'You already sent a join request.';
end;
$$;

create or replace function public.respond_court_join_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.court_join_requests;
  v_court public.courts;
begin
  select * into v_request
  from public.court_join_requests
  where id = p_request_id
    and status = 'pending';

  if v_request.id is null then
    raise exception 'Court join request not found.';
  end if;

  select * into v_court from public.courts where id = v_request.court_id;

  if v_court.creator_id <> auth.uid() then
    raise exception 'Only the court creator can respond.';
  end if;

  if p_accept and public.court_participant_count(v_court.id) >= public.court_capacity(v_court.id) then
    raise exception 'This court is already full.';
  end if;

  update public.court_join_requests
  set status = case when p_accept then 'accepted' else 'rejected' end,
      responded_at = timezone('utc', now())
  where id = p_request_id;

  perform public.add_notification(
    v_request.requester_id,
    'court',
    case when p_accept then 'Court request accepted' else 'Court request rejected' end,
    case when p_accept then 'Your request to join a court was accepted.' else 'Your request to join a court was rejected.' end,
    jsonb_build_object('court_id', v_court.id, 'join_request_id', p_request_id)
  );
end;
$$;

create or replace function public.respond_court_invite(p_invite_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.court_invites;
  v_court public.courts;
  v_profile public.profiles;
begin
  select * into v_invite
  from public.court_invites
  where id = p_invite_id
    and invited_user_id = auth.uid()
    and status = 'pending';

  if v_invite.id is null then
    raise exception 'Court invite not found.';
  end if;

  select * into v_court from public.courts where id = v_invite.court_id;

  if p_accept and public.court_participant_count(v_court.id) >= public.court_capacity(v_court.id) then
    raise exception 'This court is already full.';
  end if;

  update public.court_invites
  set status = case when p_accept then 'accepted' else 'rejected' end,
      responded_at = timezone('utc', now())
  where id = p_invite_id;

  select * into v_profile from public.profiles where id = auth.uid();

  perform public.add_notification(
    v_court.creator_id,
    'court',
    case when p_accept then 'Court invite accepted' else 'Court invite declined' end,
    public.full_name(v_profile) || case when p_accept then ' accepted your court invite.' else ' declined your court invite.' end,
    jsonb_build_object('court_id', v_court.id, 'invite_id', p_invite_id)
  );
end;
$$;

alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.club_memberships enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.app_notifications enable row level security;
alter table public.ladders enable row level security;
alter table public.ladder_entries enable row level security;
alter table public.ladder_requests enable row level security;
alter table public.courts enable row level security;
alter table public.court_audiences enable row level security;
alter table public.court_clubs enable row level security;
alter table public.court_invites enable row level security;
alter table public.court_join_requests enable row level security;

create policy "profiles can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "ladders are readable"
on public.ladders for select
to authenticated
using (true);

grant usage on schema public to anon, authenticated;
grant select on public.ladders to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_category_notifications_read(public.notification_category) to authenticated;
grant execute on function public.create_club(text, text) to authenticated;
grant execute on function public.join_club(text, text) to authenticated;
grant execute on function public.set_club_member_role(uuid, uuid, public.club_role) to authenticated;
grant execute on function public.transfer_club_presidency(uuid, uuid) to authenticated;
grant execute on function public.search_users_by_username(text) to authenticated;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_to_friend_request(uuid, boolean) to authenticated;
grant execute on function public.submit_ladder_request(uuid, public.ladder_code, public.ladder_request_type, integer, text, text, public.ladder_code) to authenticated;
grant execute on function public.respond_to_partner_ladder_invite(uuid, boolean, public.ladder_code) to authenticated;
grant execute on function public.officer_add_ladder_entry(uuid, public.ladder_code, uuid, uuid, integer) to authenticated;
grant execute on function public.officer_move_ladder_entry(uuid, integer) to authenticated;
grant execute on function public.officer_remove_ladder_entry(uuid) to authenticated;
grant execute on function public.officer_resolve_ladder_request(uuid, text, integer) to authenticated;
grant execute on function public.member_drop_own_ladder_entry(uuid) to authenticated;
grant execute on function public.create_court(public.court_play_type, text, timestamptz, public.court_location_type, text, integer, boolean, boolean, uuid[], uuid[]) to authenticated;
grant execute on function public.request_join_court(uuid) to authenticated;
grant execute on function public.respond_court_join_request(uuid, boolean) to authenticated;
grant execute on function public.respond_court_invite(uuid, boolean) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.app_notifications;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.friend_requests;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.club_memberships;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ladder_entries;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ladder_requests;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.courts;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.court_invites;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.court_join_requests;
exception
  when duplicate_object then null;
end $$;
