import { supabase } from '../lib/supabaseClient'

async function callRpc(functionName, payload = {}) {
  const { data, error } = await supabase.rpc(functionName, payload)

  if (error) {
    throw error
  }

  return data
}

export async function searchUsersByUsername(query) {
  if (!query.trim()) {
    return []
  }

  const { data, error } = await supabase.rpc('search_users_by_username', {
    p_query: query.trim().toLowerCase(),
  })

  if (error) {
    throw error
  }

  return data ?? []
}

export async function sendFriendRequest(username) {
  return callRpc('send_friend_request', {
    p_username: username.trim().toLowerCase(),
  })
}

export async function respondToFriendRequest(requestId, accept) {
  return callRpc('respond_to_friend_request', {
    p_request_id: requestId,
    p_accept: accept,
  })
}

export async function markNotificationRead(notificationId) {
  return callRpc('mark_notification_read', {
    p_notification_id: notificationId,
  })
}
