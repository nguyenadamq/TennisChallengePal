'use client'

import { startTransition, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LadderTable from '../components/LadderTable'
import { DOUBLES_LADDERS, LADDER_ORDER, LADDER_RULE_COPY } from '../lib/constants'
import { supabase } from '../lib/supabaseClient'
import { claimAdminRole, signOut, waitForProfile } from '../services/auth'
import {
  createManualEntry,
  dropOwnEntry,
  fetchDashboardData,
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

function formatRoleLabel(value) {
  return value === 'officer' ? 'Officer' : 'Member'
}

function formatGenderShort(value) {
  return value === 'female' ? 'F' : 'M'
}

function HomeTab({
  profile,
  myEntries,
  adminPromotionPassword,
  setAdminPromotionPassword,
  busyAction,
  handleAdminPromotion,
}) {
  return (
    <>
      <section className="info-grid">
        <article className="panel">
          <p className="eyebrow">How It Works</p>
          <p>{LADDER_RULE_COPY[profile.gender].summary}</p>
          <p className="muted-text">{LADDER_RULE_COPY[profile.gender].challenge}</p>
        </article>
        <article className="panel">
          <p className="eyebrow">Doubles Requests</p>
          <p>Invite a confirmed friend for doubles. Your friend must accept before the request moves to officers.</p>
          <p className="muted-text">
            If either player is already on two ladders, they choose which ladder will drop only if the officer later approves the request.
          </p>
        </article>
        <article className="panel">
          <p className="eyebrow">Your Snapshot</p>
          <h2>{myEntries.length} active ladders</h2>
          <div className="mini-list">
            {myEntries.length ? (
              myEntries.map((entry) => (
                <div key={entry.entry_id} className="mini-item">
                  <strong>{entry.ladder_name}</strong>
                  <span>Rank #{entry.rank_position}</span>
                </div>
              ))
            ) : (
              null
            )}
          </div>
        </article>
      </section>

        <section className="content-grid">
          <div className="panel panel-wide">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Start Here</p>
            </div>
          </div>
          <div className="mini-list">
            <div className="mini-item start-here-row">
              <strong className="start-here-title">Browse live ladders</strong>
              <span className="start-here-copy">Use the Leaderboards tab to view all rankings, your active ladders, and submit requests.</span>
            </div>
            <div className="mini-item start-here-row">
              <strong className="start-here-title">Add friends</strong>
              <span className="start-here-copy">Use the Friends tab to search usernames, accept requests, manage partner invites, and review notifications.</span>
            </div>
            <div className="mini-item start-here-row">
              <strong className="start-here-title">Request a ladder move</strong>
              <span className="start-here-copy">Join or challenge from Leaderboards, then track status in your request list.</span>
            </div>
          </div>
        </div>

        <aside className="sidebar-stack">
          <section className="panel">
            <p className="eyebrow">Profile Settings</p>
            <h2>Officer access</h2>
            {profile.role === 'officer' ? (
              <p className="muted-text">This account already has officer access.</p>
            ) : (
              <form className="form-stack compact-form" onSubmit={handleAdminPromotion}>
                <label>
                  <input
                    type="password"
                    value={adminPromotionPassword}
                    onChange={(event) => setAdminPromotionPassword(event.target.value)}
                    placeholder="Enter officer password"
                    required
                  />
                </label>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={busyAction === 'claim-admin' || !adminPromotionPassword.trim()}
                >
                  {busyAction === 'claim-admin' ? 'Verifying...' : 'Promote to officer'}
                </button>
              </form>
            )}
          </section>
        </aside>
      </section>
    </>
  )
}

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const [ladders, setLadders] = useState([])
  const [entries, setEntries] = useState([])
  const [requests, setRequests] = useState([])
  const [profiles, setProfiles] = useState([])
  const [friends, setFriends] = useState([])
  const [friendRequests, setFriendRequests] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [requestForm, setRequestForm] = useState(requestDefaults)
  const [adminForm, setAdminForm] = useState(adminDefaults)
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
    const snapshot = await fetchDashboardData(session.user.id, nextProfile.role === 'officer')

    startTransition(() => {
      setProfile(nextProfile)
      setLadders(snapshot.ladders)
      setEntries(snapshot.entries)
      setRequests(snapshot.requests)
      setProfiles(snapshot.profiles)
      setFriends(snapshot.friends)
      setFriendRequests(snapshot.friendRequests)
      setNotifications(snapshot.notifications)
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ladder_entries' }, () => loadDashboard().catch(() => {}))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ladder_requests' }, () => loadDashboard().catch(() => {}))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => loadDashboard().catch(() => {}))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => loadDashboard().catch(() => {}))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_notifications' }, () => loadDashboard().catch(() => {}))
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [loadDashboard])

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

  function getEntriesForLadder(ladderId) {
    return entries
      .filter((entry) => entry.ladder_id === ladderId)
      .sort((left, right) => left.rank_position - right.rank_position)
  }

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
    if (!profile || !isEligibleForLadder(profile.gender, ladderCode)) {
      return false
    }

    return !getEntriesForUser(profile.id).some((entry) => entry.ladder_code === ladderCode)
  }

  function canChallengeLadder(ladderId, ladderCode) {
    if (!profile || !isEligibleForLadder(profile.gender, ladderCode)) {
      return false
    }

    const rank = getCurrentRank(ladderId)
    return Boolean(rank && rank > 1)
  }

  function getEligibleFriendsForLadder(ladderCode) {
    return friends.filter((friend) => {
      if (!isEligibleForLadder(friend.friend_gender, ladderCode)) {
        return false
      }

      return !entries.some(
        (entry) =>
          entry.ladder_code === ladderCode &&
          (entry.user_id === friend.friend_id || entry.partner_user_id === friend.friend_id),
      )
    })
  }

  async function handleRequestSubmit(event) {
    event.preventDefault()

    await runAction(
      'request',
      async () => {
        await submitLadderRequest({
          ladderCode: requestForm.ladderCode,
          requestType: requestForm.requestType,
          targetRank:
            requestForm.requestType === 'challenge' && requestForm.targetRank
              ? Number(requestForm.targetRank)
              : null,
          message: requestForm.message,
          partnerUsername:
            requestForm.requestType === 'join' && DOUBLES_LADDERS.includes(requestForm.ladderCode)
              ? requestForm.partnerUsername
              : null,
          dropLadderCode: requestForm.requestType === 'join' ? requestForm.dropLadderCode : null,
        })

        setRequestForm((current) => ({
          ...requestDefaults,
          ladderCode: current.ladderCode,
        }))
      },
      DOUBLES_LADDERS.includes(requestForm.ladderCode) && requestForm.requestType === 'join'
        ? 'Invite sent to your friend. The officer team sees it after your partner accepts.'
        : 'Request submitted to the officer queue.',
    )
  }

  async function handleAdminAdd(event) {
    event.preventDefault()

    await runAction(
      'admin-add',
      async () => {
        await createManualEntry({
          ladderCode: adminForm.ladderCode,
          userId: adminForm.userId,
          partnerUserId: DOUBLES_LADDERS.includes(adminForm.ladderCode) ? adminForm.partnerUserId : null,
          rankPosition: adminForm.rankPosition ? Number(adminForm.rankPosition) : null,
        })

        setAdminForm((current) => ({
          ...current,
          userId: '',
          partnerUserId: '',
          rankPosition: '',
        }))
      },
      'Leaderboard updated.',
    )
  }

  async function handleFriendSearch(event) {
    event.preventDefault()
    setBusyAction('friend-search')
    setErrorMessage('')

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

    await runAction(
      'claim-admin',
      async () => {
        await claimAdminRole(adminPromotionPassword)
        setAdminPromotionPassword('')
      },
      'Officer access enabled for this account.',
    )
  }

  async function confirmSelfDrop() {
    if (!dropConfirmEntry) {
      return
    }

    const currentEntry = dropConfirmEntry

    await runAction(
      `self-drop-${currentEntry.entry_id}`,
      async () => {
        await dropOwnEntry(currentEntry.entry_id)
        setDropConfirmEntry(null)
      },
      'Your ladder spot was dropped.',
    )
  }

  async function handleInlineSelfDrop(entry) {
    await runAction(
      `self-drop-${entry.entry_id}`,
      async () => {
        await dropOwnEntry(entry.entry_id)
        setExpandedSelfDropEntryId(null)
      },
      'Your ladder spot was dropped.',
    )
  }

  if (loading) {
    return <div className="app-loading">Loading Challenge Court...</div>
  }

  if (!profile) {
    return <div className="app-loading">Loading your player profile...</div>
  }

  const myEntries = getEntriesForUser(profile.id)
  const incomingFriendRequests = friendRequests.filter(
    (request) => request.receiver_id === profile.id && request.status === 'pending',
  )
  const partnerInvites = requests.filter(
    (request) => request.partner_user_id === profile.id && request.status === 'pending_partner',
  )
  const adminRequests = requests.filter((request) => request.status === 'pending_admin')
  const unreadNotifications = notifications.filter((item) => !item.read_at)
  const archivedNotifications = notifications.filter((item) => item.read_at)
  const selectedLadder = ladders.find((ladder) => ladder.code === requestForm.ladderCode)
  const joinAllowed = canJoinLadder(requestForm.ladderCode)
  const challengeAllowed = canChallengeLadder(selectedLadder?.id, requestForm.ladderCode)
  const needsDropChoice = requestForm.requestType === 'join' && myEntries.length >= 2 && joinAllowed
  const eligibleFriendOptions = getEligibleFriendsForLadder(requestForm.ladderCode)
  const unreadCount = unreadNotifications.length
  const pendingSocialCount = incomingFriendRequests.length + partnerInvites.length
  const playerOptions = profiles.map((entryProfile) => ({
    label: `${entryProfile.display_name} (@${entryProfile.username})`,
    value: entryProfile.id,
  }))
  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'leaderboards', label: 'Leaderboards' },
    { id: 'friends', label: 'Friends', badge: unreadCount > 0 ? unreadCount : null },
  ]

  if (profile.role === 'officer') {
    navItems.push({ id: 'admin', label: 'Officer' })
  }

  return (
    <main className="dashboard-shell">
      <section className="topbar">
        <div>
          <h1 className="brand-title">Challenge Court</h1>
        </div>

        <div className="topbar-actions">
          <div className="profile-area">
            <div className="notification-anchor">
              <div className="profile-chip">
                <strong>
                  {profile.display_name} - {formatGenderShort(profile.gender)}
                </strong>
                <span>
                  {profile.username} - {formatRoleLabel(profile.role)}
                </span>
                <button
                  className="notification-bell"
                  type="button"
                  onClick={() => setNotificationsOpen((current) => !current)}
                  aria-label="Notifications"
                >
                  <svg
                    className="notification-bell-icon"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 3.5a4 4 0 0 0-4 4v1.2c0 .9-.3 1.8-.8 2.5L5.7 13a1.2 1.2 0 0 0 .9 2h10.8a1.2 1.2 0 0 0 .9-2l-1.5-1.8a4.3 4.3 0 0 1-.8-2.5V7.5a4 4 0 0 0-4-4Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9.8 18a2.4 2.4 0 0 0 4.4 0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {unreadCount ? <span className="notification-badge">{unreadCount}</span> : null}
                </button>
              </div>
              {notificationsOpen ? (
                <div className="notification-popover">
                  <div className="notification-popover-header">
                    <div>
                      <p className="eyebrow">Notifications</p>
                    </div>
                    <button
                      className="tiny-button"
                      type="button"
                      onClick={() => setNotificationsOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                  <div className="notification-list">
                    {unreadNotifications.length ? (
                      unreadNotifications.map((notification) => (
                        <div key={notification.id} className="notification-item">
                          <div>
                            <strong>{notification.title}</strong>
                            <p>{notification.body}</p>
                          </div>
                          <button
                            className="tiny-button"
                            type="button"
                            disabled={busyAction === `notification-${notification.id}`}
                            onClick={() =>
                              runAction(
                                `notification-${notification.id}`,
                                () => markNotificationRead(notification.id),
                                'Notification archived.',
                              )
                            }
                          >
                            Mark read
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="muted-text">No unread notifications right now.</p>
                    )}
                  </div>
                  <button
                    className="section-toggle"
                    type="button"
                    onClick={() => setArchivedNotificationsOpen((current) => !current)}
                  >
                    <span>
                      <span className="eyebrow">Archived</span>
                    </span>
                    <span className="count-pill">
                      {archivedNotifications.length} {archivedNotificationsOpen ? 'Hide' : 'Show'}
                    </span>
                  </button>
                  {archivedNotificationsOpen ? (
                    <div className="notification-list">
                      {archivedNotifications.length ? (
                        archivedNotifications.map((notification) => (
                          <div key={notification.id} className="notification-item">
                            <div>
                              <strong>{notification.title}</strong>
                              <p>{notification.body}</p>
                            </div>
                            <span className="status-pill">Archived</span>
                          </div>
                        ))
                      ) : (
                        <p className="muted-text">No archived notifications yet.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <button className="secondary-button" onClick={handleSignOut} type="button">
            Sign out
          </button>
        </div>
      </section>

      <nav className="tab-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`tab-button${activeTab === item.id ? ' tab-button-active' : ''}`}
            onClick={() => setActiveTab(item.id)}
            type="button"
          >
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
          myEntries={myEntries}
          adminPromotionPassword={adminPromotionPassword}
          setAdminPromotionPassword={setAdminPromotionPassword}
          busyAction={busyAction}
          handleAdminPromotion={handleAdminPromotion}
        />
      ) : null}

      {activeTab === 'leaderboards' ? (
        <>
          <section className="panel active-ladders-bar">
            <div className="active-ladders-bar-header">
              <p className="eyebrow">Your Active Ladders</p>
              <h2>{myEntries.length} of 2</h2>
            </div>
            <div className="active-ladders-bar-list">
              {myEntries.length ? (
                myEntries.map((entry) => (
                  <div key={entry.entry_id} className="active-ladders-chip">
                    <div>
                      <strong>{entry.ladder_name}</strong>
                      <span>Rank #{entry.rank_position}</span>
                    </div>
                    <button
                      className="tiny-button tiny-button-danger"
                      type="button"
                      disabled={busyAction === `self-drop-${entry.entry_id}`}
                      onClick={() => setDropConfirmEntry(entry)}
                    >
                      Drop spot
                    </button>
                  </div>
                ))
              ) : (
                <p className="muted-text">No active ladder spots yet.</p>
              )}
            </div>
          </section>

          <section className="content-grid">
            <div className="panel panel-wide">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Leaderboard View</p>
                </div>
              </div>
              <div className="ladder-board-stack">
                {ladders.map((ladder) => (
                  <LadderTable
                    key={ladder.id}
                    ladder={ladder}
                    entries={getEntriesForLadder(ladder.id)}
                    isAdmin={false}
                    currentUserId={profile.id}
                    busyAction={busyAction}
                    onMove={() => {}}
                    onRemove={() => {}}
                    expandedSelfDropEntryId={expandedSelfDropEntryId}
                    onToggleSelfDrop={(entryId) =>
                      setExpandedSelfDropEntryId((current) =>
                        current === entryId ? null : entryId,
                      )
                    }
                    onConfirmSelfDrop={handleInlineSelfDrop}
                  />
                ))}
              </div>
            </div>

            <aside className="sidebar-stack">
              <section className="panel leaderboard-request-panel">
                <p className="eyebrow">Join or Challenge</p>
                <form className="form-stack compact-form" onSubmit={handleRequestSubmit}>
                  <label>
                    <span>Ladder</span>
                    <select
                      value={requestForm.ladderCode}
                      onChange={(event) =>
                        setRequestForm((current) => ({
                          ...current,
                          ladderCode: event.target.value,
                          partnerUsername: '',
                          dropLadderCode: '',
                          targetRank: '',
                        }))
                      }
                    >
                      {ladders.map((ladder) => (
                        <option
                          key={ladder.id}
                          value={ladder.code}
                          disabled={!isEligibleForLadder(profile.gender, ladder.code)}
                        >
                          {ladder.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Request type</span>
                    <select
                      value={requestForm.requestType}
                      onChange={(event) =>
                        setRequestForm((current) => ({
                          ...current,
                          requestType: event.target.value,
                          targetRank: '',
                          partnerUsername: '',
                          dropLadderCode: '',
                        }))
                      }
                    >
                      <option value="join">Join ladder</option>
                      <option value="challenge">Challenge</option>
                    </select>
                  </label>

                  {requestForm.requestType === 'challenge' ? (
                    <label>
                      <span>Target rank</span>
                      <input
                        type="number"
                        min="1"
                        max="7"
                        value={requestForm.targetRank}
                        onChange={(event) =>
                          setRequestForm((current) => ({
                            ...current,
                            targetRank: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                  ) : null}

                  {requestForm.requestType === 'join' && DOUBLES_LADDERS.includes(requestForm.ladderCode) ? (
                    <label>
                      <span>Invite a friend</span>
                      <select
                        value={requestForm.partnerUsername}
                        onChange={(event) =>
                          setRequestForm((current) => ({
                            ...current,
                            partnerUsername: event.target.value,
                          }))
                        }
                        required
                      >
                        <option value="">Choose an eligible friend</option>
                        {eligibleFriendOptions.map((friend) => (
                          <option key={friend.friend_id} value={friend.friend_username}>
                            {friend.friend_display_name} (@{friend.friend_username})
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {needsDropChoice ? (
                    <label>
                      <span>Choose the ladder to drop if this gets approved</span>
                      <select
                        value={requestForm.dropLadderCode}
                        onChange={(event) =>
                          setRequestForm((current) => ({
                            ...current,
                            dropLadderCode: event.target.value,
                          }))
                        }
                        required
                      >
                        <option value="">Select a ladder to drop</option>
                        {getDropOptionsForUser(profile.id).map((option) => (
                          <option key={option.ladderCode} value={option.ladderCode}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <label>
                    <span>Message for officers</span>
                    <textarea
                      rows="3"
                      value={requestForm.message}
                      onChange={(event) =>
                        setRequestForm((current) => ({
                          ...current,
                          message: event.target.value,
                        }))
                      }
                      placeholder="Optional context"
                    />
                  </label>

                  {requestForm.requestType === 'join' && !joinAllowed ? (
                    <p className="form-error">You are not eligible to join this ladder right now.</p>
                  ) : null}
                  {requestForm.requestType === 'challenge' && !challengeAllowed ? (
                    <p className="form-error">You need to already be ranked on this ladder before challenging.</p>
                  ) : null}

                  <button
                    className="primary-button"
                    type="submit"
                    disabled={
                      busyAction === 'request' ||
                      (requestForm.requestType === 'join' ? !joinAllowed : !challengeAllowed)
                    }
                  >
                    {busyAction === 'request' ? 'Sending...' : 'Send request'}
                  </button>
                </form>
              </section>
            </aside>
          </section>
        </>
      ) : null}

      {activeTab === 'friends' ? (
        <>
          <section className="friends-grid">
            <article className="panel panel-subtle">
              <p className="eyebrow">Friends List</p>
              <div className="request-list">
                {friends.length ? (
                  friends.map((friend) => (
                    <div key={friend.friend_id} className="request-item">
                      <div>
                        <strong>{friend.friend_display_name}</strong>
                        <p>
                          @{friend.friend_username} | {friend.friend_gender}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted-text">No confirmed friends yet.</p>
                )}
              </div>
            </article>

            <article className="panel panel-subtle">
              <p className="eyebrow">Add Friend</p>
              <form className="form-stack compact-form" onSubmit={handleFriendSearch}>
                <label>
                  <input
                    type="text"
                    value={friendSearch}
                    onChange={(event) => setFriendSearch(event.target.value)}
                    placeholder="Search by username"
                  />
                </label>
                <button className="primary-button" type="submit" disabled={busyAction === 'friend-search'}>
                  {busyAction === 'friend-search' ? 'Searching...' : 'Search'}
                </button>
              </form>
              <div className="request-list">
                {searchResults.length ? (
                  searchResults.map((result) => (
                    <div key={result.id} className="request-item">
                      <div>
                        <strong>{result.display_name}</strong>
                        <p>
                          @{result.username} | {result.gender}
                        </p>
                      </div>
                      <button
                        className="tiny-button"
                        type="button"
                        disabled={busyAction === `friend-${result.username}`}
                        onClick={() =>
                          runAction(
                            `friend-${result.username}`,
                            () => sendFriendRequest(result.username),
                            'Friend request sent.',
                          )
                        }
                      >
                        Add friend
                      </button>
                    </div>
                  ))
                ) : (
                  null
                )}
              </div>
            </article>

            <article className="panel">
              <p className="eyebrow">Friends</p>
              <h2>{friends.length}</h2>
            </article>
            <article className="panel">
              <p className="eyebrow">Pending</p>
              <h2>{pendingSocialCount}</h2>
            </article>

            <article className="panel panel-subtle">
              <p className="eyebrow">Friend Requests</p>
              <div className="request-list">
                {incomingFriendRequests.length ? (
                  incomingFriendRequests.map((request) => (
                    <div key={request.request_id} className="request-review">
                      <div>
                        <strong>{request.sender_name}</strong>
                        <p>@{request.sender_username}</p>
                      </div>
                      <div className="inline-actions">
                        <button
                          className="tiny-button"
                          type="button"
                          disabled={busyAction === `friend-accept-${request.request_id}`}
                          onClick={() =>
                            runAction(
                              `friend-accept-${request.request_id}`,
                              () => respondToFriendRequest(request.request_id, true),
                              'Friend request accepted.',
                            )
                          }
                        >
                          Accept
                        </button>
                        <button
                          className="tiny-button tiny-button-danger"
                          type="button"
                          disabled={busyAction === `friend-decline-${request.request_id}`}
                          onClick={() =>
                            runAction(
                              `friend-decline-${request.request_id}`,
                              () => respondToFriendRequest(request.request_id, false),
                              'Friend request declined.',
                            )
                          }
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted-text">No incoming friend requests.</p>
                )}
              </div>
            </article>

            <article className="panel panel-subtle">
              <p className="eyebrow">Doubles Invites</p>
              <div className="request-list">
                {partnerInvites.length ? (
                  partnerInvites.map((request) => {
                    const dropOptions = getDropOptionsForUser(profile.id)
                    const needsInviteDropChoice = dropOptions.length >= 2

                    return (
                      <div key={request.request_id} className="request-review">
                        <div>
                          <strong>{request.requester_name}</strong>
                          <p>
                            {request.ladder_name} | @{request.requester_username}
                          </p>
                          <p className="muted-text">
                            Accepting sends the request to officers and notifies your partner.
                          </p>
                          {needsInviteDropChoice ? (
                            <div className="inline-field">
                              <select
                                value={inviteDropChoices[request.request_id] || ''}
                                onChange={(event) =>
                                  setInviteDropChoices((current) => ({
                                    ...current,
                                    [request.request_id]: event.target.value,
                                  }))
                                }
                              >
                                <option value="">Choose the ladder to drop if approved</option>
                                {dropOptions.map((option) => (
                                  <option key={option.ladderCode} value={option.ladderCode}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : null}
                        </div>
                        <div className="inline-actions">
                          <button
                            className="tiny-button"
                            type="button"
                            disabled={
                              busyAction === `invite-accept-${request.request_id}` ||
                              (needsInviteDropChoice && !inviteDropChoices[request.request_id])
                            }
                            onClick={() =>
                              runAction(
                                `invite-accept-${request.request_id}`,
                                () =>
                                  respondToPartnerInvite(
                                    request.request_id,
                                    true,
                                    inviteDropChoices[request.request_id] || null,
                                  ),
                                'Invite accepted and sent to officers.',
                              )
                            }
                          >
                            Accept
                          </button>
                          <button
                            className="tiny-button tiny-button-danger"
                            type="button"
                            disabled={busyAction === `invite-decline-${request.request_id}`}
                            onClick={() =>
                              runAction(
                                `invite-decline-${request.request_id}`,
                                () => respondToPartnerInvite(request.request_id, false, null),
                                'Invite declined.',
                              )
                            }
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="muted-text">No partner invites waiting.</p>
                )}
              </div>
            </article>

          </section>
        </>
      ) : null}

      {activeTab === 'admin' && profile.role === 'officer' ? (
        <>
          <section className="info-grid">
            <article className="panel">
              <p className="eyebrow">Pending Requests</p>
              <h2>{adminRequests.length}</h2>
              <p className="muted-text">Requests only appear here after partner confirmation when doubles is involved.</p>
            </article>
            <article className="panel">
              <p className="eyebrow">Players</p>
              <h2>{profiles.length}</h2>
              <p className="muted-text">Officers can place members manually and adjust rankings from here.</p>
            </article>
            <article className="panel">
              <p className="eyebrow">Live Control</p>
              <h2>{entries.length}</h2>
              <p className="muted-text">Use the ladder tables below to move entries up, down, or remove them.</p>
            </article>
          </section>

          <section className="content-grid">
            <div className="panel panel-wide">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Officer Leaderboards</p>
                  <h2>Move and remove entries</h2>
                </div>
              </div>
              <div className="ladder-board-stack">
                {ladders.map((ladder) => (
                  <LadderTable
                    key={ladder.id}
                    ladder={ladder}
                    entries={getEntriesForLadder(ladder.id)}
                    isAdmin
                    currentUserId={profile.id}
                    busyAction={busyAction}
                    onMove={(entryId, newRank) =>
                      runAction(
                        `move-${entryId}`,
                        () => moveEntry(entryId, newRank),
                        'Leaderboard position updated.',
                      )
                    }
                    onRemove={(entryId) =>
                      runAction(
                        `remove-${entryId}`,
                        () => removeEntry(entryId),
                        'Leaderboard entry removed.',
                      )
                    }
                  />
                ))}
              </div>
            </div>

            <aside className="sidebar-stack">
              <section className="panel">
                <p className="eyebrow">Officer Add</p>
                <h2>Add a ladder entry</h2>
                <form className="form-stack compact-form" onSubmit={handleAdminAdd}>
                  <label>
                    <span>Ladder</span>
                    <select
                      value={adminForm.ladderCode}
                      onChange={(event) =>
                        setAdminForm((current) => ({
                          ...current,
                          ladderCode: event.target.value,
                          partnerUserId: '',
                        }))
                      }
                    >
                      {ladders.map((ladder) => (
                        <option key={ladder.id} value={ladder.code}>
                          {ladder.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Primary player</span>
                    <select
                      value={adminForm.userId}
                      onChange={(event) =>
                        setAdminForm((current) => ({
                          ...current,
                          userId: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Select a player</option>
                      {playerOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {DOUBLES_LADDERS.includes(adminForm.ladderCode) ? (
                    <label>
                      <span>Partner</span>
                      <select
                        value={adminForm.partnerUserId}
                        onChange={(event) =>
                          setAdminForm((current) => ({
                            ...current,
                            partnerUserId: event.target.value,
                          }))
                        }
                        required
                      >
                        <option value="">Select a partner</option>
                        {playerOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label>
                    <span>Starting rank</span>
                    <input
                      type="number"
                      min="1"
                      value={adminForm.rankPosition}
                      onChange={(event) =>
                        setAdminForm((current) => ({
                          ...current,
                          rankPosition: event.target.value,
                        }))
                      }
                      placeholder="Leave blank for bottom"
                    />
                  </label>
                  <button className="primary-button" type="submit" disabled={busyAction === 'admin-add'}>
                    {busyAction === 'admin-add' ? 'Adding...' : 'Add entry'}
                  </button>
                </form>
              </section>

              <section className="panel">
                <p className="eyebrow">Approval Queue</p>
                <h2>{adminRequests.length} ready for review</h2>
                <div className="request-list">
                  {adminRequests.length ? (
                    adminRequests.map((request) => (
                      <div className="request-review" key={request.request_id}>
                        <div>
                          <strong>{request.requester_name}</strong>
                          <p>
                            {request.ladder_name} | {request.request_type}
                            {request.partner_username ? ` | @${request.partner_username}` : ''}
                          </p>
                          {request.target_rank ? (
                            <p className="muted-text">Challenge target: #{request.target_rank}</p>
                          ) : null}
                          {request.requester_drop_ladder_name ? (
                            <p className="muted-text">Requester drop: {request.requester_drop_ladder_name}</p>
                          ) : null}
                          {request.partner_drop_ladder_name ? (
                            <p className="muted-text">Partner drop: {request.partner_drop_ladder_name}</p>
                          ) : null}
                          <div className="inline-field">
                            <input
                              type="number"
                              min="1"
                              value={adminRankInputs[request.request_id] || ''}
                              onChange={(event) =>
                                setAdminRankInputs((current) => ({
                                  ...current,
                                  [request.request_id]: event.target.value,
                                }))
                              }
                              placeholder="Optional rank override"
                            />
                          </div>
                        </div>
                        <div className="inline-actions">
                          <button
                            className="tiny-button"
                            type="button"
                            disabled={busyAction === `approve-${request.request_id}`}
                            onClick={() =>
                              runAction(
                                `approve-${request.request_id}`,
                                () =>
                                  resolveRequest(
                                    request.request_id,
                                    'approved',
                                    adminRankInputs[request.request_id]
                                      ? Number(adminRankInputs[request.request_id])
                                      : null,
                                  ),
                                'Officer request approved.',
                              )
                            }
                          >
                            Approve
                          </button>
                          <button
                            className="tiny-button tiny-button-danger"
                            type="button"
                            disabled={busyAction === `reject-${request.request_id}`}
                            onClick={() =>
                              runAction(
                                `reject-${request.request_id}`,
                                () => resolveRequest(request.request_id, 'rejected', null),
                                'Officer request rejected.',
                              )
                            }
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="muted-text">No officer-ready requests right now.</p>
                  )}
                </div>
              </section>
            </aside>
          </section>
        </>
      ) : null}

      {dropConfirmEntry ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setDropConfirmEntry(null)}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drop-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="eyebrow">Confirm Drop</p>
            <h2 id="drop-confirm-title">Remove your spot from {dropConfirmEntry.ladder_name}?</h2>
            <p>
              This will remove your current ladder position and close the gap exactly the same way an officer removal does.
            </p>
            {dropConfirmEntry.partner_user_id ? (
              <p className="muted-text">This is a doubles entry, so dropping it removes the full team from the ladder.</p>
            ) : null}
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setDropConfirmEntry(null)}>
                Cancel
              </button>
              <button
                className="primary-button danger-button"
                type="button"
                disabled={busyAction === `self-drop-${dropConfirmEntry.entry_id}`}
                onClick={confirmSelfDrop}
              >
                {busyAction === `self-drop-${dropConfirmEntry.entry_id}` ? 'Dropping...' : 'Yes, drop my spot'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
