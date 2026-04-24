import { apiRequest } from '../lib/apiClient'

export async function fetchDashboardData() {
  const result = await apiRequest('/api/dashboard')

  return {
    club: result.club ?? null,
    ladders: result.ladders ?? [],
    entries: result.entries ?? [],
    requests: result.requests ?? [],
    profiles: result.profiles ?? [],
    friends: result.friends ?? [],
    friendRequests: result.friendRequests ?? [],
    notifications: result.notifications ?? [],
    visibleCourts: result.visibleCourts ?? [],
  }
}
