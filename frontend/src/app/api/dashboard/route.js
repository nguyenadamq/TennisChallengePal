import { NextResponse } from 'next/server'
import { requireProfile } from '../../../lib/serverSupabase'

const JSON_HEADERS = {
  'Cache-Control': 'no-store',
}

export async function GET(request) {
  try {
    const { user, profile, supabaseUser } = await requireProfile(request)
    const friendRequestsQuery = supabaseUser
      .from('friend_requests_view')
      .select('*')
      .order('created_at', { ascending: false })
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)

    const requestsQuery = profile.club_id
      ? supabaseUser
          .from('ladder_requests_view')
          .select('*')
          .eq('club_id', profile.club_id)
          .order('created_at', { ascending: false })
      : null

    if (requestsQuery && profile.role !== 'officer') {
      requestsQuery.or(`requester_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    }

    const [
      clubResult,
      laddersResult,
      entriesResult,
      requestsResult,
      profilesResult,
      friendsResult,
      friendRequestsResult,
      notificationsResult,
      visibleCourtsResult,
    ] = await Promise.all([
      profile.club_id
        ? supabaseUser
            .from('clubs')
            .select('id, name, created_at')
            .eq('id', profile.club_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      profile.club_id
        ? supabaseUser
            .from('ladders')
            .select('*')
            .eq('club_id', profile.club_id)
            .order('sort_order', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      profile.club_id
        ? supabaseUser
            .from('leaderboard_entries_view')
            .select('*')
            .eq('club_id', profile.club_id)
            .order('ladder_sort_order', { ascending: true })
            .order('rank_position', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      requestsQuery ?? Promise.resolve({ data: [], error: null }),
      profile.role === 'officer' && profile.club_id
        ? supabaseUser
            .from('profiles')
            .select('id, display_name, username, gender, role, club_id')
            .eq('club_id', profile.club_id)
            .order('display_name', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      supabaseUser
        .from('friendships_view')
        .select('*')
        .eq('owner_id', user.id)
        .order('friend_username', { ascending: true }),
      friendRequestsQuery,
      supabaseUser
        .from('app_notifications_view')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      profile.club_id
        ? supabaseUser
            .from('fill_courts_visible_view')
            .select('*')
            .eq('club_id', profile.club_id)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ])

    for (const result of [
      clubResult,
      laddersResult,
      entriesResult,
      requestsResult,
      profilesResult,
      friendsResult,
      friendRequestsResult,
      notificationsResult,
      visibleCourtsResult,
    ]) {
      if (result.error) {
        throw result.error
      }
    }

    return NextResponse.json(
      {
        profile,
        club: clubResult.data ?? null,
        ladders: laddersResult.data ?? [],
        entries: entriesResult.data ?? [],
        requests: requestsResult.data ?? [],
        profiles: profilesResult.data ?? [],
        friends: friendsResult.data ?? [],
        friendRequests: friendRequestsResult.data ?? [],
        notifications: notificationsResult.data ?? [],
        visibleCourts: visibleCourtsResult.data ?? [],
      },
      { headers: JSON_HEADERS },
    )
  } catch (error) {
    console.error('DASHBOARD API ERROR:', error)

    return NextResponse.json(
      { error: error.message || 'Unable to load dashboard.' },
      { status: 500, headers: JSON_HEADERS },
    )
  }
}
