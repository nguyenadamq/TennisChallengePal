import { apiRequest } from '../lib/apiClient'

export async function fetchDashboardData() {
  return apiRequest('/api/dashboard')
}

function rpc(functionName, payload) {
  return apiRequest('/api/rpc', {
    method: 'POST',
    body: JSON.stringify({ functionName, payload }),
  })
}

export function createClub({ name, password }) {
  return rpc('create_club', {
    p_name: name,
    p_password: password,
  })
}

export function joinClub({ name, password }) {
  return rpc('join_club', {
    p_name: name,
    p_password: password,
  })
}

export function setClubMemberRole({ clubId, memberId, role }) {
  return rpc('set_club_member_role', {
    p_club_id: clubId,
    p_member_id: memberId,
    p_role: role,
  })
}

export function transferClubPresidency({ clubId, newPresidentId }) {
  return rpc('transfer_club_presidency', {
    p_club_id: clubId,
    p_new_president_id: newPresidentId,
  })
}

export function searchUsersByUsername(query) {
  return rpc('search_users_by_username', {
    p_query: query,
  }).then((result) => result.data ?? [])
}

export function sendFriendRequest(username) {
  return rpc('send_friend_request', {
    p_username: username,
  })
}

export function respondToFriendRequest(requestId, accept) {
  return rpc('respond_to_friend_request', {
    p_request_id: requestId,
    p_accept: accept,
  })
}

export function markNotificationRead(notificationId) {
  return rpc('mark_notification_read', {
    p_notification_id: notificationId,
  })
}

export function markCategoryNotificationsRead(category) {
  return rpc('mark_category_notifications_read', {
    p_category: category,
  })
}

export function submitLadderRequest(payload) {
  return rpc('submit_ladder_request', {
    p_club_id: payload.clubId,
    p_ladder_code: payload.ladderCode,
    p_request_type: payload.requestType,
    p_target_rank: payload.targetRank,
    p_message: payload.message,
    p_partner_username: payload.partnerUsername,
    p_drop_ladder_code: payload.dropLadderCode,
  })
}

export function respondToPartnerLadderInvite({ requestId, accept, dropLadderCode }) {
  return rpc('respond_to_partner_ladder_invite', {
    p_request_id: requestId,
    p_accept: accept,
    p_drop_ladder_code: dropLadderCode,
  })
}

export function officerAddLadderEntry(payload) {
  return rpc('officer_add_ladder_entry', {
    p_club_id: payload.clubId,
    p_ladder_code: payload.ladderCode,
    p_user_id: payload.userId,
    p_partner_user_id: payload.partnerUserId,
    p_rank: payload.rank,
  })
}

export function officerMoveLadderEntry(entryId, newRank) {
  return rpc('officer_move_ladder_entry', {
    p_entry_id: entryId,
    p_new_rank: newRank,
  })
}

export function officerRemoveLadderEntry(entryId) {
  return rpc('officer_remove_ladder_entry', {
    p_entry_id: entryId,
  })
}

export function officerResolveLadderRequest({ requestId, decision, rank }) {
  return rpc('officer_resolve_ladder_request', {
    p_request_id: requestId,
    p_decision: decision,
    p_rank: rank,
  })
}

export function memberDropOwnLadderEntry(entryId) {
  return rpc('member_drop_own_ladder_entry', {
    p_entry_id: entryId,
  })
}

export function createCourt(payload) {
  return rpc('create_court', {
    p_play_type: payload.playType,
    p_description: payload.description,
    p_scheduled_at: payload.scheduledAt,
    p_location_type: payload.locationType,
    p_custom_location: payload.customLocation,
    p_osu_court_number: payload.osuCourtNumber,
    p_broadcast_public: payload.broadcastPublic,
    p_broadcast_friends: payload.broadcastFriends,
    p_broadcast_club_ids: payload.broadcastClubIds,
    p_invited_friend_ids: payload.invitedFriendIds,
  })
}

export function requestJoinCourt(courtId) {
  return rpc('request_join_court', {
    p_court_id: courtId,
  })
}

export function respondCourtJoinRequest(requestId, accept) {
  return rpc('respond_court_join_request', {
    p_request_id: requestId,
    p_accept: accept,
  })
}

export function respondCourtInvite(inviteId, accept) {
  return rpc('respond_court_invite', {
    p_invite_id: inviteId,
    p_accept: accept,
  })
}
