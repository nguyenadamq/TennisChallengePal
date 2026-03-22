import { NextResponse } from 'next/server'
import { requireProfile } from '../../../lib/serverSupabase'

export async function GET(request) {
  try {
    const { user, profile, supabaseUser } = await requireProfile(request)

    const requestsQuery = supabaseUser
      .from('ladder_requests_view')
      .select('*')
      .order('created_at', { ascending: false })

    if (profile.role !== 'admin') {
      requestsQuery.or(`requester_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    }

    const friendRequestsQuery = supabaseUser
      .from('friend_requests_view')
      .select('*')
      .order('created_at', { ascending: false })
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)

    const [
      laddersResult,
      entriesResult,
      requestsResult,
      profilesResult,
      friendsResult,
      friendRequestsResult,
      notificationsResult,
    ] = await Promise.all([
      supabaseUser.from('ladders').select('*').order('sort_order', { ascending: true }),
      supabaseUser
        .from('leaderboard_entries_view')
        .select('*')
        .order('ladder_sort_order', { ascending: true })
        .order('rank_position', { ascending: true }),
      requestsQuery,
      profile.role === 'admin'
        ? supabaseUser
            .from('profiles')
            .select('id, display_name, username, gender, role')
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
    ])

    for (const result of [
      laddersResult,
      entriesResult,
      requestsResult,
      profilesResult,
      friendsResult,
      friendRequestsResult,
      notificationsResult,
    ]) {
      if (result.error) {
        throw result.error
      }
    }

    return NextResponse.json({
      profile,
      ladders: laddersResult.data ?? [],
      entries: entriesResult.data ?? [],
      requests: requestsResult.data ?? [],
      profiles: profilesResult.data ?? [],
      friends: friendsResult.data ?? [],
      friendRequests: friendRequestsResult.data ?? [],
      notifications: notificationsResult.data ?? [],
    })
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Unable to load dashboard.' },
      { status: 401 },
    )
  }
}
