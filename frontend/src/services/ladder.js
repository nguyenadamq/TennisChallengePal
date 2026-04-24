import { apiRequest } from '../lib/apiClient'

export async function submitLadderRequest(payload) {
  return apiRequest('/api/rpc', {
    method: 'POST',
    body: JSON.stringify({
      functionName: 'submit_ladder_request',
      payload: {
        p_ladder_code: payload.ladderCode,
        p_request_type: payload.requestType,
        p_target_rank: payload.targetRank,
        p_message: payload.message?.trim() || null,
        p_partner_username: payload.partnerUsername?.trim().toLowerCase() || null,
        p_drop_ladder_code: payload.dropLadderCode || null,
      },
    }),
  })
}

export async function createManualEntry(payload) {
  return apiRequest('/api/rpc', {
    method: 'POST',
    body: JSON.stringify({
      functionName: 'admin_add_user_to_ladder',
      payload: {
        p_ladder_code: payload.ladderCode,
        p_user_id: payload.userId,
        p_rank: payload.rankPosition,
        p_partner_user_id: payload.partnerUserId || null,
      },
    }),
  })
}

export async function moveEntry(entryId, newRank) {
  return apiRequest('/api/rpc', {
    method: 'POST',
    body: JSON.stringify({
      functionName: 'admin_move_ladder_entry',
      payload: {
        p_entry_id: entryId,
        p_new_rank: newRank,
      },
    }),
  })
}

export async function removeEntry(entryId) {
  return apiRequest('/api/rpc', {
    method: 'POST',
    body: JSON.stringify({
      functionName: 'admin_remove_ladder_entry',
      payload: {
        p_entry_id: entryId,
      },
    }),
  })
}

export async function dropOwnEntry(entryId) {
  return apiRequest('/api/rpc', {
    method: 'POST',
    body: JSON.stringify({
      functionName: 'member_drop_own_ladder_entry',
      payload: {
        p_entry_id: entryId,
      },
    }),
  })
}

export async function resolveRequest(requestId, decision, rank) {
  return apiRequest('/api/rpc', {
    method: 'POST',
    body: JSON.stringify({
      functionName: 'admin_resolve_request',
      payload: {
        p_request_id: requestId,
        p_decision: decision,
        p_rank: rank,
      },
    }),
  })
}

export async function respondToPartnerInvite(requestId, accept, dropLadderCode) {
  return apiRequest('/api/rpc', {
    method: 'POST',
    body: JSON.stringify({
      functionName: 'respond_to_partner_ladder_invite',
      payload: {
        p_request_id: requestId,
        p_accept: accept,
        p_drop_ladder_code: dropLadderCode || null,
      },
    }),
  })
}
