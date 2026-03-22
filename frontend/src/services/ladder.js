import { supabase } from '../lib/supabaseClient'

async function callRpc(functionName, payload = {}) {
  const { data, error } = await supabase.rpc(functionName, payload)

  if (error) {
    throw error
  }

  return data
}

export async function fetchDashboardData(userId, isAdmin) {
  const requestsQuery = supabase
    .from('ladder_requests_view')
    .select('*')
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    requestsQuery.or(`requester_id.eq.${userId},partner_user_id.eq.${userId}`)
  }

  const friendRequestsQuery = supabase
    .from('friend_requests_view')
    .select('*')
    .order('created_at', { ascending: false })
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)

  const [laddersResult, entriesResult, requestsResult, profilesResult, friendsResult, friendRequestsResult, notificationsResult] =
    await Promise.all([
      supabase.from('ladders').select('*').order('sort_order', { ascending: true }),
      supabase
        .from('leaderboard_entries_view')
        .select('*')
        .order('ladder_sort_order', { ascending: true })
        .order('rank_position', { ascending: true }),
      requestsQuery,
      isAdmin
        ? supabase
            .from('profiles')
            .select('id, display_name, username, gender, role')
            .order('display_name', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('friendships_view')
        .select('*')
        .eq('owner_id', userId)
        .order('friend_username', { ascending: true }),
      friendRequestsQuery,
      supabase
        .from('app_notifications_view')
        .select('*')
        .eq('user_id', userId)
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

  return {
    ladders: laddersResult.data ?? [],
    entries: entriesResult.data ?? [],
    requests: requestsResult.data ?? [],
    profiles: profilesResult.data ?? [],
    friends: friendsResult.data ?? [],
    friendRequests: friendRequestsResult.data ?? [],
    notifications: notificationsResult.data ?? [],
  }
}

export async function submitLadderRequest(payload) {
  return callRpc('submit_ladder_request', {
    p_ladder_code: payload.ladderCode,
    p_request_type: payload.requestType,
    p_target_rank: payload.targetRank,
    p_message: payload.message?.trim() || null,
    p_partner_username: payload.partnerUsername?.trim().toLowerCase() || null,
    p_drop_ladder_code: payload.dropLadderCode || null,
  })
}

export async function createManualEntry(payload) {
  return callRpc('admin_add_user_to_ladder', {
    p_ladder_code: payload.ladderCode,
    p_user_id: payload.userId,
    p_rank: payload.rankPosition,
    p_partner_user_id: payload.partnerUserId || null,
  })
}

export async function moveEntry(entryId, newRank) {
  return callRpc('admin_move_ladder_entry', {
    p_entry_id: entryId,
    p_new_rank: newRank,
  })
}

export async function removeEntry(entryId) {
  return callRpc('admin_remove_ladder_entry', {
    p_entry_id: entryId,
  })
}

export async function resolveRequest(requestId, decision, rank) {
  return callRpc('admin_resolve_request', {
    p_request_id: requestId,
    p_decision: decision,
    p_rank: rank,
  })
}

export async function respondToPartnerInvite(requestId, accept, dropLadderCode) {
  return callRpc('respond_to_partner_ladder_invite', {
    p_request_id: requestId,
    p_accept: accept,
    p_drop_ladder_code: dropLadderCode || null,
  })
}
