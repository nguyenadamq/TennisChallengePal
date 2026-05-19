import { NextResponse } from 'next/server'
import { requireProfile } from '../../../lib/serverSupabase'

const JSON_HEADERS = { 'Cache-Control': 'no-store' }

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: JSON_HEADERS })
}

function fullName(profile) {
  if (!profile) {
    return 'Unknown player'
  }

  return `${profile.first_name} ${profile.last_name}`.trim()
}

function emptyResult(data = []) {
  return { data, error: null }
}

function ensureNoError(results) {
  for (const result of results) {
    if (result.error) {
      throw result.error
    }
  }
}

function roleCanManage(role) {
  return role === 'officer' || role === 'president'
}

function isAuthError(error) {
  const message = String(error?.message || '').toLowerCase()

  return (
    message.includes('logged in') ||
    message.includes('session') ||
    message.includes('profile not found') ||
    message.includes('jwt')
  )
}

async function cleanupExpiredCourts(supabaseAdmin) {
  const { error } = await supabaseAdmin.rpc('cleanup_expired_courts')

  if (error) {
    console.warn('Expired court cleanup skipped:', error.message)
  }
}

function formatFriendRow(friendship, currentUserId, profilesById) {
  const friendId =
    friendship.user_one_id === currentUserId ? friendship.user_two_id : friendship.user_one_id
  const profile = profilesById.get(friendId)

  return {
    friendship_id: friendship.id,
    friend_id: friendId,
    friend_username: profile?.username || '',
    friend_full_name: fullName(profile),
    friend_sex: profile?.sex || '',
    friend_age_group: profile?.age_group || '',
  }
}

export async function GET(request) {
  try {
    const { user, profile, supabaseAdmin } = await requireProfile(request)
    await cleanupExpiredCourts(supabaseAdmin)

    const [
      membershipsResult,
      laddersResult,
      notificationsResult,
      friendshipsResult,
      friendRequestsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('club_memberships')
        .select('id, club_id, user_id, role, created_at, clubs(id, name, created_at)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
      supabaseAdmin.from('ladders').select('*').order('sort_order', { ascending: true }),
      supabaseAdmin
        .from('app_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(80),
      supabaseAdmin
        .from('friendships')
        .select('*')
        .or(`user_one_id.eq.${user.id},user_two_id.eq.${user.id}`)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('friend_requests')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false }),
    ])

    ensureNoError([
      membershipsResult,
      laddersResult,
      notificationsResult,
      friendshipsResult,
      friendRequestsResult,
    ])

    const memberships = membershipsResult.data ?? []
    const clubIds = memberships.map((membership) => membership.club_id)
    const clubRoles = new Map(memberships.map((membership) => [membership.club_id, membership.role]))
    const friendIds = (friendshipsResult.data ?? []).map((friendship) =>
      friendship.user_one_id === user.id ? friendship.user_two_id : friendship.user_one_id,
    )

    const [
      clubMembersResult,
      entriesResult,
      ladderRequestsResult,
      friendProfilesResult,
      friendRequestProfilesResult,
      courtsResult,
    ] = await Promise.all([
      clubIds.length
        ? supabaseAdmin
            .from('club_memberships')
            .select('id, club_id, user_id, role, created_at, profiles(id, username, first_name, last_name, sex, age_group)')
            .in('club_id', clubIds)
            .order('created_at', { ascending: true })
        : emptyResult(),
      clubIds.length
        ? supabaseAdmin
            .from('ladder_entries')
            .select('*')
            .in('club_id', clubIds)
            .order('rank_position', { ascending: true })
        : emptyResult(),
      clubIds.length
        ? supabaseAdmin
            .from('ladder_requests')
            .select('*')
            .in('club_id', clubIds)
            .order('created_at', { ascending: false })
        : emptyResult(),
      friendIds.length
        ? supabaseAdmin
            .from('profiles')
            .select('id, username, first_name, last_name, sex, age_group')
            .in('id', friendIds)
        : emptyResult(),
      friendRequestsResult.data?.length
        ? supabaseAdmin
            .from('profiles')
            .select('id, username, first_name, last_name, sex, age_group')
            .in(
              'id',
              [
                ...new Set(
                  friendRequestsResult.data.flatMap((requestRow) => [
                    requestRow.sender_id,
                    requestRow.receiver_id,
                  ]),
                ),
              ],
            )
        : emptyResult(),
      supabaseAdmin
        .from('courts')
        .select('*')
        .gt('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(120),
    ])

    ensureNoError([
      clubMembersResult,
      entriesResult,
      ladderRequestsResult,
      friendProfilesResult,
      friendRequestProfilesResult,
      courtsResult,
    ])

    const clubMemberRows = clubMembersResult.data ?? []
    const profilesById = new Map([[profile.id, profile]])

    for (const member of clubMemberRows) {
      if (member.profiles) {
        profilesById.set(member.profiles.id, member.profiles)
      }
    }

    for (const friendProfile of friendProfilesResult.data ?? []) {
      profilesById.set(friendProfile.id, friendProfile)
    }

    for (const requestProfile of friendRequestProfilesResult.data ?? []) {
      profilesById.set(requestProfile.id, requestProfile)
    }

    const ladderMap = new Map((laddersResult.data ?? []).map((ladder) => [ladder.id, ladder]))
    const courtRows = courtsResult.data ?? []
    const courtIds = courtRows.map((court) => court.id)
    const [
      courtAudiencesResult,
      courtClubsResult,
      courtInvitesResult,
      courtJoinRequestsResult,
      courtCreatorProfilesResult,
    ] = await Promise.all([
      courtIds.length
        ? supabaseAdmin.from('court_audiences').select('*').in('court_id', courtIds)
        : emptyResult(),
      courtIds.length
        ? supabaseAdmin.from('court_clubs').select('*').in('court_id', courtIds)
        : emptyResult(),
      courtIds.length
        ? supabaseAdmin.from('court_invites').select('*').in('court_id', courtIds)
        : emptyResult(),
      courtIds.length
        ? supabaseAdmin.from('court_join_requests').select('*').in('court_id', courtIds)
        : emptyResult(),
      courtRows.length
        ? supabaseAdmin
            .from('profiles')
            .select('id, username, first_name, last_name, sex, age_group')
            .in('id', [...new Set(courtRows.map((court) => court.creator_id))])
        : emptyResult(),
    ])

    ensureNoError([
      courtAudiencesResult,
      courtClubsResult,
      courtInvitesResult,
      courtJoinRequestsResult,
      courtCreatorProfilesResult,
    ])

    for (const creatorProfile of courtCreatorProfilesResult.data ?? []) {
      profilesById.set(creatorProfile.id, creatorProfile)
    }

    const requestUserIds = [
      ...(courtInvitesResult.data ?? []).map((invite) => invite.invited_user_id),
      ...(courtJoinRequestsResult.data ?? []).map((joinRequest) => joinRequest.requester_id),
    ]
    const missingCourtProfileIds = [...new Set(requestUserIds)].filter((id) => !profilesById.has(id))

    if (missingCourtProfileIds.length) {
      const extraProfilesResult = await supabaseAdmin
        .from('profiles')
        .select('id, username, first_name, last_name, sex, age_group')
        .in('id', missingCourtProfileIds)

      if (extraProfilesResult.error) {
        throw extraProfilesResult.error
      }

      for (const extraProfile of extraProfilesResult.data ?? []) {
        profilesById.set(extraProfile.id, extraProfile)
      }
    }

    const courtAudiencesByCourt = new Map()
    for (const audience of courtAudiencesResult.data ?? []) {
      const list = courtAudiencesByCourt.get(audience.court_id) ?? []
      list.push(audience.audience)
      courtAudiencesByCourt.set(audience.court_id, list)
    }

    const courtClubsByCourt = new Map()
    for (const courtClub of courtClubsResult.data ?? []) {
      const list = courtClubsByCourt.get(courtClub.court_id) ?? []
      list.push(courtClub.club_id)
      courtClubsByCourt.set(courtClub.court_id, list)
    }

    const invitesByCourt = new Map()
    for (const invite of courtInvitesResult.data ?? []) {
      const list = invitesByCourt.get(invite.court_id) ?? []
      list.push(invite)
      invitesByCourt.set(invite.court_id, list)
    }

    const joinsByCourt = new Map()
    for (const joinRequest of courtJoinRequestsResult.data ?? []) {
      const list = joinsByCourt.get(joinRequest.court_id) ?? []
      list.push(joinRequest)
      joinsByCourt.set(joinRequest.court_id, list)
    }

    const friends = (friendshipsResult.data ?? [])
      .map((friendship) => formatFriendRow(friendship, user.id, profilesById))
      .sort((left, right) => left.friend_username.localeCompare(right.friend_username))

    const friendRequests = (friendRequestsResult.data ?? []).map((requestRow) => {
      const sender = profilesById.get(requestRow.sender_id)
      const receiver = profilesById.get(requestRow.receiver_id)

      return {
        request_id: requestRow.id,
        sender_id: requestRow.sender_id,
        receiver_id: requestRow.receiver_id,
        status: requestRow.status,
        created_at: requestRow.created_at,
        sender_username: sender?.username || '',
        sender_full_name: fullName(sender),
        receiver_username: receiver?.username || '',
        receiver_full_name: fullName(receiver),
      }
    })

    const clubs = memberships.map((membership) => {
      const memberCount = clubMemberRows.filter((member) => member.club_id === membership.club_id).length

      return {
        id: membership.club_id,
        name: membership.clubs?.name || 'Club',
        role: membership.role,
        member_count: memberCount,
        created_at: membership.clubs?.created_at || membership.created_at,
      }
    })

    const clubMembers = clubMemberRows.map((member) => ({
      membership_id: member.id,
      club_id: member.club_id,
      user_id: member.user_id,
      role: member.role,
      username: member.profiles?.username || '',
      full_name: fullName(member.profiles),
      sex: member.profiles?.sex || '',
      age_group: member.profiles?.age_group || '',
    }))

    const entries = (entriesResult.data ?? []).map((entry) => {
      const ladder = ladderMap.get(entry.ladder_id)
      const player = profilesById.get(entry.user_id)
      const partner = profilesById.get(entry.partner_user_id)

      return {
        entry_id: entry.id,
        club_id: entry.club_id,
        ladder_id: entry.ladder_id,
        ladder_code: ladder?.code,
        ladder_name: ladder?.name,
        ladder_sort_order: ladder?.sort_order,
        rank_position: entry.rank_position,
        user_id: entry.user_id,
        partner_user_id: entry.partner_user_id,
        team_label: partner ? `${fullName(player)} / ${fullName(partner)}` : fullName(player),
        created_at: entry.created_at,
      }
    })

    const ladderRequests = (ladderRequestsResult.data ?? [])
      .filter((requestRow) => {
        const role = clubRoles.get(requestRow.club_id)
        return (
          requestRow.requester_id === user.id ||
          requestRow.partner_user_id === user.id ||
          roleCanManage(role)
        )
      })
      .map((requestRow) => {
        const requester = profilesById.get(requestRow.requester_id)
        const partner = profilesById.get(requestRow.partner_user_id)
        const ladder = ladderMap.get(requestRow.ladder_id)
        const requesterDrop = ladderMap.get(requestRow.requester_drop_ladder_id)
        const partnerDrop = ladderMap.get(requestRow.partner_drop_ladder_id)

        return {
          request_id: requestRow.id,
          club_id: requestRow.club_id,
          requester_id: requestRow.requester_id,
          requester_username: requester?.username || '',
          requester_name: fullName(requester),
          ladder_id: requestRow.ladder_id,
          ladder_code: ladder?.code,
          ladder_name: ladder?.name,
          request_type: requestRow.request_type,
          status: requestRow.status,
          target_rank: requestRow.target_rank,
          message: requestRow.message,
          partner_user_id: requestRow.partner_user_id,
          partner_username: partner?.username || '',
          partner_name: partner ? fullName(partner) : '',
          requester_drop_ladder_name: requesterDrop?.name || '',
          partner_drop_ladder_name: partnerDrop?.name || '',
          created_at: requestRow.created_at,
        }
      })

    const courts = courtRows
      .map((court) => {
        const audiences = courtAudiencesByCourt.get(court.id) ?? []
        const courtClubIds = courtClubsByCourt.get(court.id) ?? []
        const invites = invitesByCourt.get(court.id) ?? []
        const joinRequests = joinsByCourt.get(court.id) ?? []
        const isCreator = court.creator_id === user.id
        const directInvite = invites.find((invite) => invite.invited_user_id === user.id)
        const visibleByPublic = audiences.includes('public')
        const visibleByFriends = audiences.includes('friends') && friendIds.includes(court.creator_id)
        const visibleByClub = courtClubIds.some((clubId) => clubIds.includes(clubId))
        const visible = isCreator || directInvite || visibleByPublic || visibleByFriends || visibleByClub

        if (!visible) {
          return null
        }

        const creator = profilesById.get(court.creator_id)
        const acceptedInvites = invites.filter((invite) => invite.status === 'accepted')
        const acceptedJoins = joinRequests.filter((joinRequest) => joinRequest.status === 'accepted')
        const capacity = court.play_type === 'singles' ? 2 : 4
        const participantCount = 1 + acceptedInvites.length + acceptedJoins.length

        return {
          id: court.id,
          creator_id: court.creator_id,
          creator_username: creator?.username || '',
          creator_name: fullName(creator),
          play_type: court.play_type,
          description: court.description,
          scheduled_at: court.scheduled_at,
          location_type: court.location_type,
          location_label: court.location_label,
          osu_court_number: court.osu_court_number,
          audiences,
          club_ids: courtClubIds,
          capacity,
          participant_count: participantCount,
          is_full: participantCount >= capacity,
          is_creator: isCreator,
          my_invite: directInvite
            ? {
                invite_id: directInvite.id,
                status: directInvite.status,
              }
            : null,
          my_join_request:
            joinRequests.find((joinRequest) => joinRequest.requester_id === user.id) || null,
          invites: invites.map((invite) => {
            const invitedProfile = profilesById.get(invite.invited_user_id)

            return {
              invite_id: invite.id,
              invited_user_id: invite.invited_user_id,
              invited_username: invitedProfile?.username || '',
              invited_name: fullName(invitedProfile),
              status: invite.status,
            }
          }),
          join_requests: joinRequests.map((joinRequest) => {
            const requester = profilesById.get(joinRequest.requester_id)

            return {
              request_id: joinRequest.id,
              requester_id: joinRequest.requester_id,
              requester_username: requester?.username || '',
              requester_name: fullName(requester),
              status: joinRequest.status,
            }
          }),
        }
      })
      .filter(Boolean)

    return json({
      profile: {
        ...profile,
        full_name: fullName(profile),
      },
      clubs,
      clubMembers,
      ladders: laddersResult.data ?? [],
      entries,
      ladderRequests,
      friends,
      friendRequests,
      notifications: notificationsResult.data ?? [],
      courts,
    })
  } catch (error) {
    const status = isAuthError(error) ? 401 : 500

    console.error('Dashboard API failed:', error)

    return json({ error: error.message || 'Unable to load dashboard.' }, status)
  }
}
