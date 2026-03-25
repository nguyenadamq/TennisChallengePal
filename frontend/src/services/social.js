import { apiRequest } from '../lib/apiClient'

export async function searchUsersByUsername(query) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    throw new Error('Enter an exact username to search.')
  }

  const result = await apiRequest('/api/rpc', {
    method: 'POST',
    body: JSON.stringify({
      functionName: 'search_users_by_username',
      payload: {
        p_query: normalizedQuery,
      },
    }),
  })

  return result.data ?? []
}

export async function sendFriendRequest(username) {
  return apiRequest('/api/rpc', {
    method: 'POST',
    body: JSON.stringify({
      functionName: 'send_friend_request',
      payload: {
        p_username: username.trim().toLowerCase(),
      },
    }),
  })
}

export async function respondToFriendRequest(requestId, accept) {
  return apiRequest('/api/rpc', {
    method: 'POST',
    body: JSON.stringify({
      functionName: 'respond_to_friend_request',
      payload: {
        p_request_id: requestId,
        p_accept: accept,
      },
    }),
  })
}

export async function markNotificationRead(notificationId) {
  return apiRequest('/api/rpc', {
    method: 'POST',
    body: JSON.stringify({
      functionName: 'mark_notification_read',
      payload: {
        p_notification_id: notificationId,
      },
    }),
  })
}
