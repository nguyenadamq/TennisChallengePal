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
  set status = case
        when p_accept then 'accepted'::public.friend_request_status
        else 'rejected'::public.friend_request_status
      end,
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
