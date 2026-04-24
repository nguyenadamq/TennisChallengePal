'use client'

import { startTransition, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ClubTab from './dashboard/ClubTab'
import FillCourtTab from './dashboard/FillCourtTab'
import HomeTab from './dashboard/HomeTab'
import { createClub, createFillCourt, joinClub, joinFillCourt } from '../services/club'
import { fetchDashboardData } from '../services/dashboard'
import { DAYS_OF_WEEK, DOUBLES_LADDERS, LADDER_ORDER, LADDER_RULE_COPY } from '../lib/constants'
import { supabase } from '../lib/supabaseClient'
import { claimAdminRole, signOut, waitForProfile } from '../services/auth'
import {
  createManualEntry,
  dropOwnEntry,
  moveEntry,
  removeEntry,
  resolveRequest,
  respondToPartnerInvite,
  submitLadderRequest,
} from '../services/ladder'
import {
  markNotificationRead,
  respondToFriendRequest,
  searchUsersByUsername,
  sendFriendRequest,
  setHitPartnerPreference,
} from '../services/social'

const requestDefaults = {
  ladderCode: LADDER_ORDER[0],
  requestType: 'join',
  targetRank: '',
  message: '',
  partnerUsername: '',
  dropLadderCode: '',
}

const adminDefaults = {
  ladderCode: LADDER_ORDER[0],
  userId: '',
  partnerUserId: '',
  rankPosition: '',
}

const createClubDefaults = {
  clubName: '',
  password: '',
}

const joinClubDefaults = {
  clubName: '',
  password: '',
}

const courtDefaults = {
  title: '',
  details: '',
  visibility: 'open',
  inviteeIds: [],
  dayOfWeek: DAYS_OF_WEEK[0],
  startTime: '18:00',
  endTime: '19:30',
  maxPlayers: '4',
}

function formatRoleLabel(value) {
  return value === 'officer' ? 'Officer' : 'Member'
}

function formatGenderShort(value) {
  return value === 'female' ? 'F' : 'M'
}

function isValidDoublesPartnerForLadder(playerGender, partnerGender, ladderCode) {
  if (!partnerGender) {
    return false
  }

  if (ladderCode === 'mixed_doubles') {
    return playerGender !== partnerGender
  }

  if (ladderCode === 'mens_doubles') {
    return playerGender === 'male' && partnerGender === 'male'
  }

  if (ladderCode === 'womens_doubles') {
    return playerGender === 'female' && partnerGender === 'female'
  }

  return true
}

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const [club, setClub] = useState(null)
  const [ladders, setLadders] = useState([])
  const [entries, setEntries] = useState([])
  const [requests, setRequests] = useState([])
  const [profiles, setProfiles] = useState([])
  const [friends, setFriends] = useState([])
  const [friendRequests, setFriendRequests] = useState([])
  const [notifications, setNotifications] = useState([])
  const [visibleCourts, setVisibleCourts] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [requestForm, setRequestForm] = useState(requestDefaults)
  const [adminForm, setAdminForm] = useState(adminDefaults)
  const [createClubForm, setCreateClubForm] = useState(createClubDefaults)
  const [joinClubForm, setJoinClubForm] = useState(joinClubDefaults)
  const [courtForm, setCourtForm] = useState(courtDefaults)
  const [friendSearch, setFriendSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [busyAction, setBusyAction] = useState('')
  const [adminPromotionPassword, setAdminPromotionPassword] = useState('')
  const [inviteDropChoices, setInviteDropChoices] = useState({})
  const [adminRankInputs, setAdminRankInputs] = useState({})
  const [activeTab, setActiveTab] = useState('home')
  const [archivedNotificationsOpen, setArchivedNotificationsOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [dropConfirmEntry, setDropConfirmEntry] = useState(null)
  const [expandedSelfDropEntryId, setExpandedSelfDropEntryId] = useState(null)
  const router = useRouter()

  const loadDashboard = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      router.replace('/login')
      return
    }

    const nextProfile = await waitForProfile(session.user.id)
    const snapshot = await fetchDashboardData()

    startTransition(() => {
      setProfile(nextProfile)
      setClub(snapshot.club)
      setLadders(snapshot.ladders)
      setEntries(snapshot.entries)
      setRequests(snapshot.requests)
      setProfiles(snapshot.profiles)
      setFriends(snapshot.friends)
      setFriendRequests(snapshot.friendRequests)
      setNotifications(snapshot.notifications)
      setVisibleCourts(snapshot.visibleCourts)
    })
  }, [router])

  useEffect(() => {
    let active = true

    async function init() {
      try {
        await loadDashboard()
      } catch (error) {
        if (active) {
          setErrorMessage(error.message)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    init()

    const channel = supabase
      .channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadDashboard().catch(() => {}))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clubs' }, () => loadDashboard().catch(() => {}))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ladders' }, () => loadDashboard().catch(() => {}))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ladder_entries' }, () => loadDashboard().catch(() => {}))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ladder_requests' }, () => loadDashboard().catch(() => {}))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => loadDashboard().catch(() => {}))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => loadDashboard().catch(() => {}))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_notifications' }, () => loadDashboard().catch(() => {}))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fill_courts' }, () => loadDashboard().catch(() => {}))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fill_court_invites' }, () => loadDashboard().catch(() => {}))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fill_court_players' }, () => loadDashboard().catch(() => {}))
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [loadDashboard])

  const getEntriesForLadder = useCallback((ladderId) => {
    return entries
      .filter((entry) => entry.ladder_id === ladderId)
      .sort((left, right) => left.rank_position - right.rank_position)
  }, [entries])

  function getEntriesForUser(userId) {
    return entries.filter((entry) => entry.user_id === userId || entry.partner_user_id === userId)
  }

  function getDropOptionsForUser(userId) {
    return getEntriesForUser(userId).map((entry) => ({
      ladderCode: entry.ladder_code,
      label:
        entry.partner_user_id && (entry.user_id === userId || entry.partner_user_id === userId)
          ? `${entry.ladder_name} (drops the full doubles team)`
          : entry.ladder_name,
    }))
  }

  function isEligibleForLadder(gender, ladderCode) {
    return LADDER_RULE_COPY[gender]?.eligible.includes(ladderCode)
  }

  function getCurrentRank(ladderId) {
    return (
      getEntriesForLadder(ladderId).find(
        (entry) => entry.user_id === profile?.id || entry.partner_user_id === profile?.id,
      )?.rank_position || null
    )
  }

  function canJoinLadder(ladderCode) {
    if (!profile?.club_id || !profile || !isEligibleForLadder(profile.gender, ladderCode)) {
      return false
    }

    return !getEntriesForUser(profile.id).some((entry) => entry.ladder_code === ladderCode)
  }

  function canChallengeLadder(ladderId, ladderCode) {
    if (!profile?.club_id || !profile || !isEligibleForLadder(profile.gender, ladderCode)) {
      return false
    }

    const rank = getCurrentRank(ladderId)
    return Boolean(rank && rank > 1)
  }

  function getChallengeOptions(ladderId, ladderCode) {
    if (!canChallengeLadder(ladderId, ladderCode)) {
      return []
    }

    const currentRank = getCurrentRank(ladderId)
    const minimumAllowedRank = currentRank > 7 ? 1 : Math.max(1, currentRank - 3)
    const maximumAllowedRank = currentRank > 7 ? 7 : currentRank - 1

    return getEntriesForLadder(ladderId).filter(
      (entry) =>
        entry.rank_position >= minimumAllowedRank &&
        entry.rank_position <= maximumAllowedRank,
    )
  }

  const sameClubFriends = profile?.club_id
    ? friends.filter((friend) => friend.friend_club_id === profile.club_id)
    : []

  function getEligibleFriendsForLadder(ladderCode) {
    return sameClubFriends.filter((friend) => {
      if (!isEligibleForLadder(friend.friend_gender, ladderCode)) {
        return false
      }
      if (!isValidDoublesPartnerForLadder(profile?.gender, friend.friend_gender, ladderCode)) {
        return false
      }

      return !entries.some(
        (entry) =>
          entry.ladder_code === ladderCode &&
          (entry.user_id === friend.friend_id || entry.partner_user_id === friend.friend_id),
      )
    })
  }

  const myEntries = getEntriesForUser(profile?.id)
  const challengeableLadders = ladders.filter((ladder) => canChallengeLadder(ladder.id, ladder.code))
  const selectedChallengeLadder =
    challengeableLadders.find((ladder) => ladder.code === requestForm.ladderCode) ||
    challengeableLadders[0] ||
    null
  const selectedChallengeLadderRank = selectedChallengeLadder
    ? getCurrentRank(selectedChallengeLadder.id)
    : null

  useEffect(() => {
    if (!profile || requestForm.requestType !== 'challenge' || !challengeableLadders.length || !selectedChallengeLadder) {
      return
    }

    const nextChallengeOptions =
      selectedChallengeLadderRank
        ? getEntriesForLadder(selectedChallengeLadder.id).filter((entry) => {
            const minimumAllowedRank =
              selectedChallengeLadderRank > 7
                ? 1
                : Math.max(1, selectedChallengeLadderRank - 3)
            const maximumAllowedRank =
              selectedChallengeLadderRank > 7 ? 7 : selectedChallengeLadderRank - 1

            return entry.rank_position >= minimumAllowedRank && entry.rank_position <= maximumAllowedRank
          })
        : []
    const hasCurrentTarget = nextChallengeOptions.some(
      (entry) => String(entry.rank_position) === requestForm.targetRank,
    )

    if (selectedChallengeLadder.code !== requestForm.ladderCode || (!hasCurrentTarget && requestForm.targetRank)) {
      setRequestForm((current) => ({
        ...current,
        ladderCode: selectedChallengeLadder.code,
        targetRank: hasCurrentTarget ? current.targetRank : '',
      }))
    }
  }, [challengeableLadders, getEntriesForLadder, profile, requestForm.ladderCode, requestForm.requestType, requestForm.targetRank, selectedChallengeLadder, selectedChallengeLadderRank])

  async function runAction(actionKey, action, successText) {
    setBusyAction(actionKey)
    setErrorMessage('')

    try {
      await action()
      await loadDashboard()
      setSuccessMessage(successText)
    } catch (error) {
      setErrorMessage(error.message)
      setSuccessMessage('')
    } finally {
      setBusyAction('')
    }
  }

  async function handleSignOut() {
    await signOut()
    router.replace('/login')
  }

  async function handleRequestSubmit(event) {
    event.preventDefault()

    await runAction('request', async () => {
      if (!profile?.club_id) {
        throw new Error('Join a club before submitting ladder requests.')
      }

      if (requestForm.requestType === 'join' && DOUBLES_LADDERS.includes(requestForm.ladderCode)) {
        const selectedFriend = sameClubFriends.find((friend) => friend.friend_username === requestForm.partnerUsername)
        if (!selectedFriend) {
          throw new Error('Choose an eligible same-club friend for doubles requests.')
        }
      }

      await submitLadderRequest({
        ladderCode: requestForm.ladderCode,
        requestType: requestForm.requestType,
        targetRank: requestForm.requestType === 'challenge' && requestForm.targetRank ? Number(requestForm.targetRank) : null,
        message: requestForm.message,
        partnerUsername: requestForm.requestType === 'join' && DOUBLES_LADDERS.includes(requestForm.ladderCode) ? requestForm.partnerUsername : null,
        dropLadderCode: requestForm.requestType === 'join' ? requestForm.dropLadderCode : null,
      })

      setRequestForm((current) => ({ ...requestDefaults, ladderCode: current.ladderCode }))
    }, DOUBLES_LADDERS.includes(requestForm.ladderCode) && requestForm.requestType === 'join'
      ? 'Invite sent to your friend. The officer team sees it after your partner accepts.'
      : 'Request submitted to the officer queue.')
  }

  async function handleCreateClub(event) {
    event.preventDefault()
    await runAction('create-club', async () => {
      await createClub(createClubForm)
      setCreateClubForm(createClubDefaults)
      setActiveTab('club')
    }, 'Club created and joined successfully.')
  }

  async function handleJoinClub(event) {
    event.preventDefault()
    await runAction('join-club', async () => {
      await joinClub(joinClubForm)
      setJoinClubForm(joinClubDefaults)
      setActiveTab('club')
    }, 'Club joined successfully.')
  }

  async function handleFriendSearch(event) {
    event.preventDefault()
    setBusyAction('friend-search')
    setErrorMessage('')
    setSearchResults([])

    try {
      const results = await searchUsersByUsername(friendSearch)
      setSearchResults(results)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setBusyAction('')
    }
  }

  async function handleAdminPromotion(event) {
    event.preventDefault()
    await runAction('claim-admin', async () => {
      await claimAdminRole(adminPromotionPassword)
      setAdminPromotionPassword('')
    }, 'Officer access enabled for this account.')
  }

  async function handleCourtSubmit(event) {
    event.preventDefault()
    await runAction('create-court', async () => {
      if (!profile?.club_id) {
        throw new Error('Join a club before creating a court.')
      }
      if (courtForm.visibility === 'invite_only' && !courtForm.inviteeIds.length) {
        throw new Error('Choose at least one same-club friend for invite-only courts.')
      }
      await createFillCourt({
        ...courtForm,
        maxPlayers: Number(courtForm.maxPlayers),
      })
      setCourtForm(courtDefaults)
    }, courtForm.visibility === 'invite_only'
      ? 'Invite-only court created and notifications sent.'
      : 'Open court created for your hit partners.')
  }

  async function handleJoinCourt(courtId) {
    await runAction(
      `join-court-${courtId}`,
      () => joinFillCourt(courtId),
      'You joined the court.',
    )
  }

  async function createManualEntryAction(event) {
    event.preventDefault()
    await runAction('admin-add', async () => {
      await createManualEntry({
        ladderCode: adminForm.ladderCode,
        userId: adminForm.userId,
        partnerUserId: DOUBLES_LADDERS.includes(adminForm.ladderCode) ? adminForm.partnerUserId : null,
        rankPosition: adminForm.rankPosition ? Number(adminForm.rankPosition) : null,
      })
      setAdminForm((current) => ({ ...current, userId: '', partnerUserId: '', rankPosition: '' }))
    }, 'Leaderboard updated.')
  }

  async function moveEntryAction(entryId, newRank) {
    await runAction(`move-${entryId}`, () => moveEntry(entryId, newRank), 'Leaderboard position updated.')
  }

  async function removeEntryAction(entryId) {
    await runAction(`remove-${entryId}`, () => removeEntry(entryId), 'Leaderboard entry removed.')
  }

  async function resolveRequestAction(requestId, decision, rank) {
    await runAction(
      `${decision === 'approved' ? 'approve' : 'reject'}-${requestId}`,
      () => resolveRequest(requestId, decision, rank),
      decision === 'approved' ? 'Officer request approved.' : 'Officer request rejected.',
    )
  }

  async function confirmSelfDrop() {
    if (!dropConfirmEntry) {
      return
    }
    const currentEntry = dropConfirmEntry
    await runAction(`self-drop-${currentEntry.entry_id}`, async () => {
      await dropOwnEntry(currentEntry.entry_id)
      setDropConfirmEntry(null)
    }, 'Your ladder spot was dropped.')
  }

  async function handleInlineSelfDrop(entry) {
    await runAction(`self-drop-${entry.entry_id}`, async () => {
      await dropOwnEntry(entry.entry_id)
      setExpandedSelfDropEntryId(null)
    }, 'Your ladder spot was dropped.')
  }

  function toggleCourtInvitee(friendId) {
    setCourtForm((current) => ({
      ...current,
      inviteeIds: current.inviteeIds.includes(friendId)
        ? current.inviteeIds.filter((entryId) => entryId !== friendId)
        : [...current.inviteeIds, friendId],
    }))
  }

  if (loading) {
    return <div className="app-loading">Loading Tennis Challenge Pal...</div>
  }

  if (!profile) {
    return <div className="app-loading">Loading your player profile...</div>
  }

  const unreadNotifications = notifications.filter((item) => !item.read_at)
  const archivedNotifications = notifications.filter((item) => item.read_at)
  const unreadCount = unreadNotifications.length
  const selectedLadder = ladders.find((ladder) => ladder.code === requestForm.ladderCode)
  const joinAllowed = canJoinLadder(requestForm.ladderCode)
  const challengeAllowed = selectedLadder ? canChallengeLadder(selectedLadder.id, requestForm.ladderCode) : false
  const challengeOptions = selectedLadder ? getChallengeOptions(selectedLadder.id, selectedLadder.code) : []
  const needsDropChoice = requestForm.requestType === 'join' && myEntries.length >= 2 && joinAllowed
  const eligibleFriendOptions = getEligibleFriendsForLadder(requestForm.ladderCode)
  const pendingSocialCount =
    friendRequests.filter((request) => request.receiver_id === profile.id && request.status === 'pending').length +
    requests.filter((request) => request.partner_user_id === profile.id && request.status === 'pending_partner').length
  const playerOptions = profiles.map((entryProfile) => ({
    label: `${entryProfile.display_name} (@${entryProfile.username})`,
    value: entryProfile.id,
  }))

  return (
    <main className="dashboard-shell">
      <section className="topbar">
        <div>
          <h1 className="brand-title">Tennis Challenge Pal</h1>
          <p className="topbar-copy">
            {club ? `Club play is live inside ${club.name}.` : 'Create or join a club to unlock ladders and courts.'}
          </p>
        </div>

        <div className="topbar-actions">
          <div className="profile-area">
            <div className="notification-anchor">
              <div className="profile-chip">
                <strong>{profile.display_name} - {formatGenderShort(profile.gender)}</strong>
                <span>@{profile.username} - {formatRoleLabel(profile.role)}</span>
                <span>{profile.club_name ?? 'No club'}</span>
                <button className="notification-bell" type="button" onClick={() => setNotificationsOpen((current) => !current)} aria-label="Notifications">
                  <svg className="notification-bell-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 3.5a4 4 0 0 0-4 4v1.2c0 .9-.3 1.8-.8 2.5L5.7 13a1.2 1.2 0 0 0 .9 2h10.8a1.2 1.2 0 0 0 .9-2l-1.5-1.8a4.3 4.3 0 0 1-.8-2.5V7.5a4 4 0 0 0-4-4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9.8 18a2.4 2.4 0 0 0 4.4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {unreadCount ? <span className="notification-badge">{unreadCount}</span> : null}
                </button>
              </div>
              {notificationsOpen ? (
                <div className="notification-popover">
                  <div className="notification-popover-header">
                    <p className="eyebrow">Notifications</p>
                    <button className="tiny-button" type="button" onClick={() => setNotificationsOpen(false)}>Close</button>
                  </div>
                  <div className="notification-list">
                    {unreadNotifications.length ? unreadNotifications.map((notification) => (
                      <div key={notification.id} className="notification-item">
                        <div>
                          <strong>{notification.title}</strong>
                          <p>{notification.body}</p>
                        </div>
                        <button
                          className="tiny-button"
                          type="button"
                          disabled={busyAction === `notification-${notification.id}`}
                          onClick={() => runAction(`notification-${notification.id}`, () => markNotificationRead(notification.id), 'Notification archived.')}
                        >
                          Mark read
                        </button>
                      </div>
                    )) : <p className="muted-text">No unread notifications right now.</p>}
                  </div>
                  <button className="section-toggle" type="button" onClick={() => setArchivedNotificationsOpen((current) => !current)}>
                    <span className="eyebrow">Archived</span>
                    <span className="count-pill">{archivedNotifications.length} {archivedNotificationsOpen ? 'Hide' : 'Show'}</span>
                  </button>
                  {archivedNotificationsOpen ? (
                    <div className="notification-list">
                      {archivedNotifications.length ? archivedNotifications.map((notification) => (
                        <div key={notification.id} className="notification-item">
                          <div>
                            <strong>{notification.title}</strong>
                            <p>{notification.body}</p>
                          </div>
                          <span className="status-pill">Archived</span>
                        </div>
                      )) : <p className="muted-text">No archived notifications yet.</p>}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <button className="secondary-button" onClick={handleSignOut} type="button">Sign out</button>
        </div>
      </section>

      <nav className="tab-nav">
        {[
          { id: 'home', label: 'Home', badge: unreadCount > 0 ? unreadCount : null },
          { id: 'club', label: 'Club', badge: pendingSocialCount > 0 ? pendingSocialCount : null },
          { id: 'fill-court', label: 'Fill a Court' },
        ].map((item) => (
          <button key={item.id} className={`tab-button${activeTab === item.id ? ' tab-button-active' : ''}`} onClick={() => setActiveTab(item.id)} type="button">
            <span>{item.label}</span>
            {item.badge ? <span className="tab-badge">{item.badge}</span> : null}
          </button>
        ))}
      </nav>

      {errorMessage ? <p className="flash flash-error">{errorMessage}</p> : null}
      {successMessage ? <p className="flash flash-success">{successMessage}</p> : null}

      {activeTab === 'home' ? (
        <HomeTab
          profile={profile}
          club={club}
          myEntries={myEntries}
          unreadCount={unreadCount}
          visibleCourts={visibleCourts}
          pendingSocialCount={pendingSocialCount}
          adminPromotionPassword={adminPromotionPassword}
          setAdminPromotionPassword={setAdminPromotionPassword}
          busyAction={busyAction}
          handleAdminPromotion={handleAdminPromotion}
        />
      ) : null}

      {activeTab === 'club' ? (
        <ClubTab
          profile={profile}
          club={club}
          ladders={ladders}
          entries={entries}
          requests={requests}
          profiles={profiles}
          friends={friends}
          friendRequests={friendRequests}
          busyAction={busyAction}
          createClubForm={createClubForm}
          setCreateClubForm={setCreateClubForm}
          joinClubForm={joinClubForm}
          setJoinClubForm={setJoinClubForm}
          friendSearch={friendSearch}
          setFriendSearch={setFriendSearch}
          searchResults={searchResults}
          requestForm={requestForm}
          setRequestForm={setRequestForm}
          adminForm={adminForm}
          setAdminForm={setAdminForm}
          inviteDropChoices={inviteDropChoices}
          setInviteDropChoices={setInviteDropChoices}
          adminRankInputs={adminRankInputs}
          setAdminRankInputs={setAdminRankInputs}
          expandedSelfDropEntryId={expandedSelfDropEntryId}
          setExpandedSelfDropEntryId={setExpandedSelfDropEntryId}
          myEntries={myEntries}
          sameClubFriends={sameClubFriends}
          playerOptions={playerOptions}
          challengeableLadders={challengeableLadders}
          challengeOptions={challengeOptions}
          joinAllowed={joinAllowed}
          challengeAllowed={challengeAllowed}
          eligibleFriendOptions={eligibleFriendOptions}
          needsDropChoice={needsDropChoice}
          getDropOptionsForUser={getDropOptionsForUser}
          getEntriesForLadder={getEntriesForLadder}
          isEligibleForLadder={isEligibleForLadder}
          handleCreateClub={handleCreateClub}
          handleJoinClub={handleJoinClub}
          handleFriendSearch={handleFriendSearch}
          runAction={runAction}
          setHitPartnerPreference={setHitPartnerPreference}
          respondToFriendRequest={respondToFriendRequest}
          sendFriendRequest={sendFriendRequest}
          respondToPartnerInvite={respondToPartnerInvite}
          createManualEntryAction={createManualEntryAction}
          moveEntryAction={moveEntryAction}
          removeEntryAction={removeEntryAction}
          resolveRequestAction={resolveRequestAction}
          handleRequestSubmit={handleRequestSubmit}
          handleInlineSelfDrop={handleInlineSelfDrop}
          setDropConfirmEntry={setDropConfirmEntry}
        />
      ) : null}

      {activeTab === 'fill-court' ? (
        <FillCourtTab
          profile={profile}
          club={club}
          visibleCourts={visibleCourts}
          sameClubFriends={sameClubFriends}
          courtForm={courtForm}
          setCourtForm={setCourtForm}
          busyAction={busyAction}
          handleCourtSubmit={handleCourtSubmit}
          toggleCourtInvitee={toggleCourtInvitee}
          handleJoinCourt={handleJoinCourt}
        />
      ) : null}

      {dropConfirmEntry ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setDropConfirmEntry(null)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="drop-confirm-title" onClick={(event) => event.stopPropagation()}>
            <p className="eyebrow">Confirm Drop</p>
            <h2 id="drop-confirm-title">Remove your spot from {dropConfirmEntry.ladder_name}?</h2>
            <p>This will remove your current ladder position and close the gap exactly the same way an officer removal does.</p>
            {dropConfirmEntry.partner_user_id ? <p className="muted-text">This is a doubles entry, so dropping it removes the full team from the ladder.</p> : null}
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setDropConfirmEntry(null)}>Cancel</button>
              <button className="primary-button danger-button" type="button" disabled={busyAction === `self-drop-${dropConfirmEntry.entry_id}`} onClick={confirmSelfDrop}>
                {busyAction === `self-drop-${dropConfirmEntry.entry_id}` ? 'Dropping...' : 'Yes, drop my spot'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
