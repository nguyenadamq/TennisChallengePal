drop policy if exists "users can read relevant clubs" on public.clubs;
create policy "users can read relevant clubs"
on public.clubs for select
to authenticated
using (public.is_club_member(auth.uid(), id));

drop policy if exists "users can read club rosters" on public.club_memberships;
create policy "users can read club rosters"
on public.club_memberships for select
to authenticated
using (public.is_club_member(auth.uid(), club_id));

drop policy if exists "users can read their friend requests" on public.friend_requests;
create policy "users can read their friend requests"
on public.friend_requests for select
to authenticated
using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "users can read their friendships" on public.friendships;
create policy "users can read their friendships"
on public.friendships for select
to authenticated
using (user_one_id = auth.uid() or user_two_id = auth.uid());

drop policy if exists "users can read their notifications" on public.app_notifications;
create policy "users can read their notifications"
on public.app_notifications for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "club members can read ladder entries" on public.ladder_entries;
create policy "club members can read ladder entries"
on public.ladder_entries for select
to authenticated
using (public.is_club_member(auth.uid(), club_id));

drop policy if exists "users can read relevant ladder requests" on public.ladder_requests;
create policy "users can read relevant ladder requests"
on public.ladder_requests for select
to authenticated
using (
  requester_id = auth.uid()
  or partner_user_id = auth.uid()
  or public.club_role_for(auth.uid(), club_id) in ('officer', 'president')
);

drop policy if exists "users can read visible courts" on public.courts;
create policy "users can read visible courts"
on public.courts for select
to authenticated
using (public.can_user_see_court(auth.uid(), id));

drop policy if exists "users can read visible court audiences" on public.court_audiences;
create policy "users can read visible court audiences"
on public.court_audiences for select
to authenticated
using (public.can_user_see_court(auth.uid(), court_id));

drop policy if exists "users can read visible court clubs" on public.court_clubs;
create policy "users can read visible court clubs"
on public.court_clubs for select
to authenticated
using (public.can_user_see_court(auth.uid(), court_id));

drop policy if exists "users can read relevant court invites" on public.court_invites;
create policy "users can read relevant court invites"
on public.court_invites for select
to authenticated
using (public.can_user_see_court(auth.uid(), court_id));

drop policy if exists "users can read relevant court join requests" on public.court_join_requests;
create policy "users can read relevant court join requests"
on public.court_join_requests for select
to authenticated
using (
  requester_id = auth.uid()
  or exists (
    select 1
    from public.courts c
    where c.id = court_join_requests.court_id
      and c.creator_id = auth.uid()
  )
);

grant select on
  public.app_notifications,
  public.clubs,
  public.club_memberships,
  public.friend_requests,
  public.friendships,
  public.ladders,
  public.ladder_entries,
  public.ladder_requests,
  public.courts,
  public.court_audiences,
  public.court_clubs,
  public.court_invites,
  public.court_join_requests
to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.clubs;
exception
  when duplicate_object then null;
end $$;

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
  alter publication supabase_realtime add table public.friendships;
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
  alter publication supabase_realtime add table public.court_audiences;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.court_clubs;
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
