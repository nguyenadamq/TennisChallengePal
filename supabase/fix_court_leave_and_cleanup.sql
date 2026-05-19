create or replace function public.cleanup_expired_courts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.courts
  where scheduled_at <= timezone('utc', now());

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.leave_court(p_court_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_court public.courts;
  v_profile public.profiles;
  v_removed boolean := false;
begin
  perform public.cleanup_expired_courts();

  select * into v_court from public.courts where id = p_court_id;

  if v_court.id is null then
    raise exception 'Court not found.';
  end if;

  if v_court.creator_id = auth.uid() then
    raise exception 'Court creators cannot leave their own court.';
  end if;

  delete from public.court_invites
  where court_id = p_court_id
    and invited_user_id = auth.uid()
    and status in ('pending', 'accepted');

  if found then
    v_removed := true;
  end if;

  delete from public.court_join_requests
  where court_id = p_court_id
    and requester_id = auth.uid()
    and status in ('pending', 'accepted');

  if found then
    v_removed := true;
  end if;

  if not v_removed then
    raise exception 'You are not joined to this court.';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();

  perform public.add_notification(
    v_court.creator_id,
    'court',
    'Player left court',
    public.full_name(v_profile) || ' left your court.',
    jsonb_build_object('court_id', p_court_id)
  );
end;
$$;

create or replace function public.remove_user_from_court(p_court_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_court public.courts;
  v_removed boolean := false;
begin
  perform public.cleanup_expired_courts();

  select * into v_court from public.courts where id = p_court_id;

  if v_court.id is null then
    raise exception 'Court not found.';
  end if;

  if v_court.creator_id <> auth.uid() then
    raise exception 'Only the court creator can remove players.';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Court creators cannot remove themselves.';
  end if;

  delete from public.court_invites
  where court_id = p_court_id
    and invited_user_id = p_user_id
    and status in ('pending', 'accepted');

  if found then
    v_removed := true;
  end if;

  delete from public.court_join_requests
  where court_id = p_court_id
    and requester_id = p_user_id
    and status in ('pending', 'accepted');

  if found then
    v_removed := true;
  end if;

  if not v_removed then
    raise exception 'That player is not on this court.';
  end if;

  perform public.add_notification(
    p_user_id,
    'court',
    'Removed from court',
    'The court creator removed you from a court.',
    jsonb_build_object('court_id', p_court_id)
  );
end;
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
  perform public.cleanup_expired_courts();

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
  perform public.cleanup_expired_courts();

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
  perform public.cleanup_expired_courts();

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
  set status = case
        when p_accept then 'accepted'::public.court_response_status
        else 'rejected'::public.court_response_status
      end,
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
  perform public.cleanup_expired_courts();

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
  set status = case
        when p_accept then 'accepted'::public.court_response_status
        else 'rejected'::public.court_response_status
      end,
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

grant execute on function public.cleanup_expired_courts() to authenticated;
grant execute on function public.leave_court(uuid) to authenticated;
grant execute on function public.remove_user_from_court(uuid, uuid) to authenticated;
