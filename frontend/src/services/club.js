import { apiRequest } from '../lib/apiClient'

export async function createClub({ clubName, password }) {
  return apiRequest('/api/rpc', {
    method: 'POST',
    body: JSON.stringify({
      functionName: 'create_club',
      payload: {
        p_club_name: clubName,
        p_password: password,
      },
    }),
  })
}

export async function joinClub({ clubName, password }) {
  return apiRequest('/api/rpc', {
    method: 'POST',
    body: JSON.stringify({
      functionName: 'join_club',
      payload: {
        p_club_name: clubName,
        p_password: password,
      },
    }),
  })
}

export async function createFillCourt({
  title,
  details,
  visibility,
  inviteeIds,
  dayOfWeek,
  startTime,
  endTime,
  maxPlayers,
}) {
  return apiRequest('/api/rpc', {
    method: 'POST',
    body: JSON.stringify({
      functionName: 'create_fill_court',
      payload: {
        p_title: title,
        p_details: details?.trim() || null,
        p_visibility: visibility,
        p_invitee_ids: inviteeIds,
        p_day_of_week: dayOfWeek,
        p_start_time: startTime,
        p_end_time: endTime,
        p_max_players: maxPlayers,
      },
    }),
  })
}

export async function joinFillCourt(courtId) {
  return apiRequest('/api/rpc', {
    method: 'POST',
    body: JSON.stringify({
      functionName: 'join_fill_court',
      payload: {
        p_court_id: courtId,
      },
    }),
  })
}
