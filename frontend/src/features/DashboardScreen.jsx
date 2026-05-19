'use client'

import { startTransition, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import LadderTable from '../components/LadderTable'
import { DOUBLES_LADDERS, LADDER_ORDER, LADDER_RULE_COPY } from '../lib/constants'
import { supabase } from '../lib/supabaseClient'
import { signOut } from '../services/auth'
import {
  createClub,
  createCourt,
  fetchDashboardData,
  joinClub,
  leaveCourt,
  markCategoryNotificationsRead,
  markNotificationRead,
  memberDropOwnLadderEntry,
  officerAddLadderEntry,
  officerMoveLadderEntry,
  officerRemoveLadderEntry,
  officerResolveLadderRequest,
  requestJoinCourt,
  removeUserFromCourt,
  respondCourtInvite,
  respondCourtJoinRequest,
  respondToFriendRequest,
  respondToPartnerLadderInvite,
  searchUsersByUsername,
  sendFriendRequest,
  setClubMemberRole,
  submitLadderRequest,
  transferClubPresidency,
} from '../services/app'

const createClubDefaults = { name: '', password: '' }
const joinClubDefaults = { name: '', password: '' }
const ladderRequestDefaults = {
  ladderCode: LADDER_ORDER[0],
  requestType: 'join',
  targetRank: '',
  partnerUsername: '',
  dropLadderCode: '',
  message: '',
}
const adminEntryDefaults = {
  ladderCode: LADDER_ORDER[0],
  userId: '',
  partnerUserId: '',
  rank: '',
}
const courtDefaults = {
  playType: 'singles',
  description: '',
  date: '',
  time: '',
  locationType: 'osu',
  customLocation: '',
  osuCourtNumber: 1,
  broadcastPublic: false,
  broadcastFriends: true,
  broadcastClubIds: [],
  invitedFriendIds: [],
}
const EMPTY_LIST = []
const REALTIME_TABLES = [
  'app_notifications',
  'clubs',
  'club_memberships',
  'friend_requests',
  'friendships',
  'ladder_entries',
  'ladder_requests',
  'courts',
  'court_audiences',
  'court_clubs',
  'court_invites',
  'court_join_requests',
]

function formatSex(value) {
  return value === 'woman' ? 'Woman' : 'Man'
}

function formatAgeGroup(value) {
  if (value === 'high_school') {
    return 'High school'
  }

  if (value === 'college') {
    return 'College'
  }

  return 'Adult'
}

function formatRole(value) {
  if (value === 'president') {
    return 'President'
  }

  if (value === 'officer') {
    return 'Officer'
  }

  return 'Member'
}

function roleCanManage(role) {
  return role === 'officer' || role === 'president'
}

function formatDateTime(value) {
  if (!value) {
    return ''
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function notificationCounts(notifications) {
  return notifications
    .filter((notification) => !notification.read_at)
    .reduce(
      (counts, notification) => ({
        ...counts,
        total: counts.total + 1,
        [notification.category]: counts[notification.category] + 1,
      }),
      { total: 0, club: 0, social: 0, court: 0 },
    )
}

function NotificationList({ category, notifications, open, onToggle, onRead, onReadCategory }) {
  const categoryNotifications = notifications.filter((notification) => notification.category === category)
  const unreadCount = categoryNotifications.filter((notification) => !notification.read_at).length

  return (
    <section className="panel panel-subtle">
      <button className="section-toggle" type="button" onClick={onToggle}>
        <span>
          <span className="eyebrow">{category} notifications</span>
          <strong>{unreadCount} unread</strong>
        </span>
        <span className="count-pill">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open ? (
        <div className="notification-list">
          <div className="inline-actions">
            <button
              className="tiny-button"
              type="button"
              disabled={!unreadCount}
              onClick={() => onReadCategory(category)}
            >
              Mark category read
            </button>
          </div>
          {categoryNotifications.length ? (
            categoryNotifications.map((notification) => (
              <div className="notification-item" key={notification.id}>
                <div>
                  <strong>{notification.title}</strong>
                  <p className="muted-text">{notification.body}</p>
                </div>
                {!notification.read_at ? (
                  <button
                    className="tiny-button"
                    type="button"
                    onClick={() => onRead(notification.id)}
                  >
                    Read
                  </button>
                ) : (
                  <span className="status-pill">Read</span>
                )}
              </div>
            ))
          ) : (
            <p className="muted-text">No notifications in this category.</p>
          )}
        </div>
      ) : null}
    </section>
  )
}

export default function Dashboard() {
  const [snapshot, setSnapshot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [busyAction, setBusyAction] = useState('')
  const [activeTab, setActiveTab] = useState('club')
  const [selectedClubId, setSelectedClubId] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [categoryNotificationsOpen, setCategoryNotificationsOpen] = useState({
    club: false,
    social: false,
    court: false,
  })
  const [createClubForm, setCreateClubForm] = useState(createClubDefaults)
  const [joinClubForm, setJoinClubForm] = useState(joinClubDefaults)
  const [ladderForm, setLadderForm] = useState(ladderRequestDefaults)
  const [adminForm, setAdminForm] = useState(adminEntryDefaults)
  const [rankOverrides, setRankOverrides] = useState({})
  const [partnerDropChoices, setPartnerDropChoices] = useState({})
  const [expandedSelfDropEntryId, setExpandedSelfDropEntryId] = useState(null)
  const [friendSearch, setFriendSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [courtForm, setCourtForm] = useState(courtDefaults)
  const router = useRouter()

  const loadDashboard = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      router.replace('/login')
      return
    }

    const data = await fetchDashboardData()

    startTransition(() => {
      setSnapshot(data)
      setSelectedClubId((current) => current || data.clubs?.[0]?.id || '')
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

    let reloadTimer = null
    const scheduleReload = () => {
      window.clearTimeout(reloadTimer)
      reloadTimer = window.setTimeout(() => {
        loadDashboard().catch(() => {})
      }, 250)
    }

    const channel = REALTIME_TABLES.reduce(
      (nextChannel, table) =>
        nextChannel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleReload),
      supabase.channel('tennis-pal-live'),
    ).subscribe()
    const cleanupInterval = window.setInterval(() => {
      loadDashboard().catch(() => {})
    }, 60 * 1000)

    return () => {
      active = false
      window.clearTimeout(reloadTimer)
      window.clearInterval(cleanupInterval)
      supabase.removeChannel(channel)
    }
  }, [loadDashboard])

  const profile = snapshot?.profile
  const clubs = snapshot?.clubs ?? []
  const notifications = snapshot?.notifications ?? EMPTY_LIST
  const counts = useMemo(() => notificationCounts(notifications), [notifications])
  const selectedClub = clubs.find((club) => club.id === selectedClubId) || clubs[0] || null
  const activeClubId = selectedClub?.id || ''
  const selectedRole = selectedClub?.role || ''
  const selectedMembers = (snapshot?.clubMembers ?? []).filter((member) => member.club_id === activeClubId)
  const selectedEntries = (snapshot?.entries ?? []).filter((entry) => entry.club_id === activeClubId)
  const selectedRequests = (snapshot?.ladderRequests ?? []).filter((request) => request.club_id === activeClubId)
  const myEntries = selectedEntries.filter(
    (entry) => entry.user_id === profile?.id || entry.partner_user_id === profile?.id,
  )
  const isClubOfficer = roleCanManage(selectedRole)
  const isClubPresident = selectedRole === 'president'
  const selectedLadder = (snapshot?.ladders ?? []).find((ladder) => ladder.code === ladderForm.ladderCode)
  const selectedLadderEntries = selectedEntries.filter((entry) => entry.ladder_code === ladderForm.ladderCode)
  const currentRank = selectedLadderEntries.find(
    (entry) => entry.user_id === profile?.id || entry.partner_user_id === profile?.id,
  )?.rank_position
  const challengeOptions = currentRank
    ? selectedLadderEntries.filter((entry) => {
        const minRank = currentRank > 7 ? 1 : Math.max(1, currentRank - 3)
        const maxRank = currentRank > 7 ? 7 : currentRank - 1
        return entry.rank_position >= minRank && entry.rank_position <= maxRank
      })
    : []
  const pendingPartnerInvites = selectedRequests.filter(
    (request) => request.partner_user_id === profile?.id && request.status === 'pending_partner',
  )
  const pendingOfficerRequests = selectedRequests.filter((request) => request.status === 'pending_officer')
  const incomingFriendRequests = (snapshot?.friendRequests ?? []).filter(
    (request) => request.receiver_id === profile?.id && request.status === 'pending',
  )

  function setFlash(successText) {
    setSuccessMessage(successText)
    setErrorMessage('')
  }

  async function runAction(actionKey, action, successText) {
    setBusyAction(actionKey)
    setErrorMessage('')

    try {
      await action()
      await loadDashboard()
      setFlash(successText)
    } catch (error) {
      setErrorMessage(error.message)
      setSuccessMessage('')
    } finally {
      setBusyAction('')
    }
  }

  function updateCourtForm(field, value) {
    setCourtForm((current) => ({ ...current, [field]: value }))
  }

  function toggleCourtClub(clubId) {
    setCourtForm((current) => {
      const hasClub = current.broadcastClubIds.includes(clubId)
      return {
        ...current,
        broadcastClubIds: hasClub
          ? current.broadcastClubIds.filter((id) => id !== clubId)
          : [...current.broadcastClubIds, clubId],
      }
    })
  }

  function toggleCourtFriend(friendId) {
    setCourtForm((current) => {
      const hasFriend = current.invitedFriendIds.includes(friendId)
      return {
        ...current,
        invitedFriendIds: hasFriend
          ? current.invitedFriendIds.filter((id) => id !== friendId)
          : [...current.invitedFriendIds, friendId],
      }
    })
  }

  async function handleSignOut() {
    await signOut()
    router.replace('/login')
  }

  async function handleCreateClub(event) {
    event.preventDefault()
    await runAction(
      'create-club',
      async () => {
        await createClub(createClubForm)
        setCreateClubForm(createClubDefaults)
      },
      'Club created.',
    )
  }

  async function handleJoinClub(event) {
    event.preventDefault()
    await runAction(
      'join-club',
      async () => {
        await joinClub(joinClubForm)
        setJoinClubForm(joinClubDefaults)
      },
      'Club joined.',
    )
  }

  async function handleLadderSubmit(event) {
    event.preventDefault()
    await runAction(
      'ladder-request',
      async () => {
        await submitLadderRequest({
          clubId: activeClubId,
          ladderCode: ladderForm.ladderCode,
          requestType: ladderForm.requestType,
          targetRank:
            ladderForm.requestType === 'challenge' && ladderForm.targetRank
              ? Number(ladderForm.targetRank)
              : null,
          partnerUsername:
            ladderForm.requestType === 'join' && DOUBLES_LADDERS.includes(ladderForm.ladderCode)
              ? ladderForm.partnerUsername
              : null,
          dropLadderCode:
            ladderForm.requestType === 'join' && ladderForm.dropLadderCode
              ? ladderForm.dropLadderCode
              : null,
          message: ladderForm.message,
        })
        setLadderForm((current) => ({ ...ladderRequestDefaults, ladderCode: current.ladderCode }))
      },
      DOUBLES_LADDERS.includes(ladderForm.ladderCode) && ladderForm.requestType === 'join'
        ? 'Doubles invite sent.'
        : 'Ladder request submitted.',
    )
  }

  async function handleAdminAdd(event) {
    event.preventDefault()
    await runAction(
      'admin-add-entry',
      async () => {
        await officerAddLadderEntry({
          clubId: activeClubId,
          ladderCode: adminForm.ladderCode,
          userId: adminForm.userId,
          partnerUserId: DOUBLES_LADDERS.includes(adminForm.ladderCode)
            ? adminForm.partnerUserId
            : null,
          rank: adminForm.rank ? Number(adminForm.rank) : null,
        })
        setAdminForm((current) => ({ ...current, userId: '', partnerUserId: '', rank: '' }))
      },
      'Ladder entry added.',
    )
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

  async function handleCreateCourt(event) {
    event.preventDefault()

    await runAction(
      'create-court',
      async () => {
        if (!courtForm.date || !courtForm.time) {
          throw new Error('Choose a date and time.')
        }

        if (courtForm.playType === 'doubles' && courtForm.invitedFriendIds.length > 0 && courtForm.invitedFriendIds.length < 3) {
          throw new Error('Doubles friend invites need at least 3 friends.')
        }

        const scheduledAt = new Date(`${courtForm.date}T${courtForm.time}`).toISOString()

        await createCourt({
          playType: courtForm.playType,
          description: courtForm.description,
          scheduledAt,
          locationType: courtForm.locationType,
          customLocation: courtForm.locationType === 'custom' ? courtForm.customLocation : null,
          osuCourtNumber:
            courtForm.locationType === 'osu' ? Number(courtForm.osuCourtNumber) : null,
          broadcastPublic: courtForm.broadcastPublic,
          broadcastFriends: courtForm.broadcastFriends,
          broadcastClubIds: courtForm.broadcastClubIds,
          invitedFriendIds: courtForm.invitedFriendIds,
        })
        setCourtForm(courtDefaults)
      },
      'Court created.',
    )
  }

  if (loading) {
    return <div className="app-loading">Loading Tennis Challenge Pal...</div>
  }

  if (!profile) {
    return <div className="app-loading">Loading your profile...</div>
  }

  const navItems = [
    { id: 'club', label: 'Club', count: counts.club },
    { id: 'social', label: 'Social', count: counts.social },
    { id: 'court', label: 'Court Finder', count: counts.court },
  ]

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Tennis Challenge Pal</p>
          <h1>{profile.full_name}</h1>
          <p className="topbar-copy">
            @{profile.username} | {formatSex(profile.sex)} | {formatAgeGroup(profile.age_group)}
          </p>
        </div>
        <div className="topbar-actions">
          <div className="notification-anchor">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setNotificationsOpen((current) => !current)}
            >
              Notifications
              {counts.total ? <span className="tab-badge">{counts.total}</span> : null}
            </button>
            {notificationsOpen ? (
              <div className="notification-popover">
                <div className="notification-popover-header">
                  <div>
                    <p className="eyebrow">Universal</p>
                    <strong>{counts.total} unread</strong>
                  </div>
                </div>
                <div className="notification-list">
                  {notifications.length ? (
                    notifications.slice(0, 12).map((notification) => (
                      <div className="notification-item" key={notification.id}>
                        <div>
                          <strong>{notification.title}</strong>
                          <p className="muted-text">{notification.body}</p>
                        </div>
                        {!notification.read_at ? (
                          <button
                            className="tiny-button"
                            type="button"
                            onClick={() =>
                              runAction(
                                `read-${notification.id}`,
                                () => markNotificationRead(notification.id),
                                'Notification marked read.',
                              )
                            }
                          >
                            Read
                          </button>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="muted-text">No notifications yet.</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
          <button className="secondary-button" type="button" onClick={handleSignOut}>
            Log out
          </button>
        </div>
      </header>

      <nav className="tab-nav" aria-label="Main sections">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`tab-button ${activeTab === item.id ? 'tab-button-active' : ''}`}
            type="button"
            onClick={() => setActiveTab(item.id)}
          >
            {item.label}
            {item.count ? <span className="tab-badge">{item.count}</span> : null}
          </button>
        ))}
      </nav>

      {errorMessage ? <p className="flash flash-error">{errorMessage}</p> : null}
      {successMessage ? <p className="flash flash-success">{successMessage}</p> : null}

      {activeTab === 'club' ? (
        <section className="tab-panel">
          <NotificationList
            category="club"
            notifications={notifications}
            open={categoryNotificationsOpen.club}
            onToggle={() =>
              setCategoryNotificationsOpen((current) => ({ ...current, club: !current.club }))
            }
            onRead={(id) => runAction(`read-${id}`, () => markNotificationRead(id), 'Notification marked read.')}
            onReadCategory={(category) =>
              runAction(`read-${category}`, () => markCategoryNotificationsRead(category), 'Notifications marked read.')
            }
          />

          <section className="content-grid">
            <div className="panel panel-wide">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Clubs</p>
                  <h2>Create, join, and choose your active club</h2>
                </div>
              </div>

              <div className="form-grid club-action-grid">
                <form className="form-stack panel-subtle" onSubmit={handleCreateClub}>
                  <p className="eyebrow">Create club</p>
                  <label>
                    <span>Club name</span>
                    <input
                      value={createClubForm.name}
                      onChange={(event) =>
                        setCreateClubForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="OSU Tennis"
                      required
                    />
                  </label>
                  <label>
                    <span>Club password</span>
                    <input
                      type="password"
                      value={createClubForm.password}
                      onChange={(event) =>
                        setCreateClubForm((current) => ({ ...current, password: event.target.value }))
                      }
                      placeholder="Simple join password"
                      required
                    />
                  </label>
                  <button className="primary-button" type="submit" disabled={busyAction === 'create-club'}>
                    {busyAction === 'create-club' ? 'Creating...' : 'Create club'}
                  </button>
                </form>

                <form className="form-stack panel-subtle" onSubmit={handleJoinClub}>
                  <p className="eyebrow">Join club</p>
                  <label>
                    <span>Unique club name</span>
                    <input
                      value={joinClubForm.name}
                      onChange={(event) =>
                        setJoinClubForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Exact club name"
                      required
                    />
                  </label>
                  <label>
                    <span>Club password</span>
                    <input
                      type="password"
                      value={joinClubForm.password}
                      onChange={(event) =>
                        setJoinClubForm((current) => ({ ...current, password: event.target.value }))
                      }
                      placeholder="Join password"
                      required
                    />
                  </label>
                  <button className="primary-button" type="submit" disabled={busyAction === 'join-club'}>
                    {busyAction === 'join-club' ? 'Joining...' : 'Join club'}
                  </button>
                </form>
              </div>

              {clubs.length ? (
                <>
                  <div className="section-heading section-spaced">
                    <div>
                      <p className="eyebrow">Active club</p>
                      <h2>{selectedClub?.name}</h2>
                    </div>
                    <select
                      className="compact-select"
                      value={activeClubId}
                      onChange={(event) => setSelectedClubId(event.target.value)}
                    >
                      {clubs.map((club) => (
                        <option key={club.id} value={club.id}>
                          {club.name} ({formatRole(club.role)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <section className="info-grid">
                    <article className="panel-subtle">
                      <p className="eyebrow">Members</p>
                      <h2>{selectedMembers.length}</h2>
                    </article>
                    <article className="panel-subtle">
                      <p className="eyebrow">Your role</p>
                      <h2>{formatRole(selectedRole)}</h2>
                    </article>
                    <article className="panel-subtle">
                      <p className="eyebrow">Your spots</p>
                      <h2>{myEntries.length}</h2>
                    </article>
                  </section>

                  <section className="panel-subtle">
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">Roster</p>
                        <h2>Members and roles</h2>
                      </div>
                    </div>
                    <div className="request-list">
                      {selectedMembers.map((member) => (
                        <div className="request-review" key={member.membership_id}>
                          <div>
                            <strong>{member.full_name}</strong>
                            <p className="muted-text">
                              @{member.username} | {formatSex(member.sex)} | {formatAgeGroup(member.age_group)} | {formatRole(member.role)}
                            </p>
                          </div>
                          {isClubPresident && member.user_id !== profile.id ? (
                            <div className="inline-actions">
                              {member.role !== 'member' ? (
                                <button
                                  className="tiny-button"
                                  type="button"
                                  onClick={() =>
                                    runAction(
                                      `demote-${member.user_id}`,
                                      () =>
                                        setClubMemberRole({
                                          clubId: activeClubId,
                                          memberId: member.user_id,
                                          role: 'member',
                                        }),
                                      'Member demoted.',
                                    )
                                  }
                                >
                                  Make member
                                </button>
                              ) : (
                                <button
                                  className="tiny-button"
                                  type="button"
                                  onClick={() =>
                                    runAction(
                                      `promote-${member.user_id}`,
                                      () =>
                                        setClubMemberRole({
                                          clubId: activeClubId,
                                          memberId: member.user_id,
                                          role: 'officer',
                                        }),
                                      'Member promoted.',
                                    )
                                  }
                                >
                                  Make officer
                                </button>
                              )}
                              <button
                                className="tiny-button tiny-button-danger"
                                type="button"
                                onClick={() =>
                                  runAction(
                                    `transfer-${member.user_id}`,
                                    () =>
                                      transferClubPresidency({
                                        clubId: activeClubId,
                                        newPresidentId: member.user_id,
                                      }),
                                    'Presidency transferred.',
                                  )
                                }
                              >
                                Transfer president
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              ) : (
                <p className="muted-text section-spaced">Create or join a club to unlock club ladders.</p>
              )}
            </div>

            <aside className="sidebar-stack">
              <section className="panel">
                <p className="eyebrow">Ladder Guide</p>
                <h2>Club-scoped rankings</h2>
                <p className="muted-text">{LADDER_RULE_COPY[profile.sex]?.summary}</p>
              </section>
            </aside>
          </section>

          {activeClubId ? (
            <section className="content-grid section-spaced">
              <div className="panel panel-wide">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Club ladders</p>
                    <h2>Leaderboards</h2>
                  </div>
                </div>
                <div className="ladder-board-stack">
                  {(snapshot?.ladders ?? []).map((ladder) => (
                    <LadderTable
                      key={ladder.id}
                      ladder={ladder}
                      entries={selectedEntries
                        .filter((entry) => entry.ladder_id === ladder.id)
                        .sort((left, right) => left.rank_position - right.rank_position)}
                      isAdmin={isClubOfficer}
                      currentUserId={profile.id}
                      busyAction={busyAction}
                      expandedSelfDropEntryId={expandedSelfDropEntryId}
                      onToggleSelfDrop={(entryId) =>
                        setExpandedSelfDropEntryId((current) => (current === entryId ? null : entryId))
                      }
                      onConfirmSelfDrop={(entry) =>
                        runAction(
                          `self-drop-${entry.entry_id}`,
                          () => memberDropOwnLadderEntry(entry.entry_id),
                          'Ladder spot dropped.',
                        )
                      }
                      onMove={(entryId, newRank) =>
                        runAction(
                          `move-${entryId}`,
                          () => officerMoveLadderEntry(entryId, newRank),
                          'Ladder position updated.',
                        )
                      }
                      onRemove={(entryId) =>
                        runAction(
                          `remove-${entryId}`,
                          () => officerRemoveLadderEntry(entryId),
                          'Ladder entry removed.',
                        )
                      }
                    />
                  ))}
                </div>
              </div>

              <aside className="sidebar-stack">
                <section className="panel">
                  <p className="eyebrow">Request ladder access</p>
                  <form className="form-stack compact-form" onSubmit={handleLadderSubmit}>
                    <label>
                      <span>Ladder</span>
                      <select
                        value={ladderForm.ladderCode}
                        onChange={(event) =>
                          setLadderForm((current) => ({
                            ...current,
                            ladderCode: event.target.value,
                            targetRank: '',
                            partnerUsername: '',
                          }))
                        }
                      >
                        {(snapshot?.ladders ?? []).map((ladder) => (
                          <option key={ladder.id} value={ladder.code}>
                            {ladder.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Request type</span>
                      <select
                        value={ladderForm.requestType}
                        onChange={(event) =>
                          setLadderForm((current) => ({
                            ...current,
                            requestType: event.target.value,
                            targetRank: '',
                          }))
                        }
                      >
                        <option value="join">Join ladder</option>
                        <option value="challenge">Challenge rank</option>
                      </select>
                    </label>
                    {ladderForm.requestType === 'challenge' ? (
                      <label>
                        <span>Target rank</span>
                        <select
                          value={ladderForm.targetRank}
                          onChange={(event) =>
                            setLadderForm((current) => ({ ...current, targetRank: event.target.value }))
                          }
                          required
                        >
                          <option value="">Choose rank</option>
                          {challengeOptions.map((entry) => (
                            <option key={entry.entry_id} value={entry.rank_position}>
                              #{entry.rank_position} {entry.team_label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {ladderForm.requestType === 'join' && DOUBLES_LADDERS.includes(ladderForm.ladderCode) ? (
                      <label>
                        <span>Doubles friend</span>
                        <select
                          value={ladderForm.partnerUsername}
                          onChange={(event) =>
                            setLadderForm((current) => ({
                              ...current,
                              partnerUsername: event.target.value,
                            }))
                          }
                          required
                        >
                          <option value="">Choose friend</option>
                          {(snapshot?.friends ?? []).map((friend) => (
                            <option key={friend.friend_id} value={friend.friend_username}>
                              {friend.friend_full_name} (@{friend.friend_username})
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {ladderForm.requestType === 'join' && myEntries.length >= 2 ? (
                      <label>
                        <span>Drop if approved</span>
                        <select
                          value={ladderForm.dropLadderCode}
                          onChange={(event) =>
                            setLadderForm((current) => ({
                              ...current,
                              dropLadderCode: event.target.value,
                            }))
                          }
                          required
                        >
                          <option value="">Choose active ladder</option>
                          {myEntries.map((entry) => (
                            <option key={entry.entry_id} value={entry.ladder_code}>
                              {entry.ladder_name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label>
                      <span>Message</span>
                      <textarea
                        value={ladderForm.message}
                        onChange={(event) =>
                          setLadderForm((current) => ({ ...current, message: event.target.value }))
                        }
                        rows={3}
                        placeholder="Optional note"
                      />
                    </label>
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={busyAction === 'ladder-request' || !selectedLadder}
                    >
                      {busyAction === 'ladder-request' ? 'Sending...' : 'Submit request'}
                    </button>
                  </form>
                </section>

                <section className="panel">
                  <p className="eyebrow">Doubles invites</p>
                  <div className="request-list">
                    {pendingPartnerInvites.length ? (
                      pendingPartnerInvites.map((request) => {
                        const needsDrop = myEntries.length >= 2
                        return (
                          <div className="request-review" key={request.request_id}>
                            <div>
                              <strong>{request.requester_name}</strong>
                              <p className="muted-text">{request.ladder_name}</p>
                              {needsDrop ? (
                                <select
                                  className="compact-select"
                                  value={partnerDropChoices[request.request_id] || ''}
                                  onChange={(event) =>
                                    setPartnerDropChoices((current) => ({
                                      ...current,
                                      [request.request_id]: event.target.value,
                                    }))
                                  }
                                >
                                  <option value="">Choose drop ladder</option>
                                  {myEntries.map((entry) => (
                                    <option key={entry.entry_id} value={entry.ladder_code}>
                                      {entry.ladder_name}
                                    </option>
                                  ))}
                                </select>
                              ) : null}
                            </div>
                            <div className="inline-actions">
                              <button
                                className="tiny-button"
                                type="button"
                                disabled={needsDrop && !partnerDropChoices[request.request_id]}
                                onClick={() =>
                                  runAction(
                                    `partner-accept-${request.request_id}`,
                                    () =>
                                      respondToPartnerLadderInvite({
                                        requestId: request.request_id,
                                        accept: true,
                                        dropLadderCode: partnerDropChoices[request.request_id] || null,
                                      }),
                                    'Doubles invite accepted.',
                                  )
                                }
                              >
                                Accept
                              </button>
                              <button
                                className="tiny-button tiny-button-danger"
                                type="button"
                                onClick={() =>
                                  runAction(
                                    `partner-reject-${request.request_id}`,
                                    () =>
                                      respondToPartnerLadderInvite({
                                        requestId: request.request_id,
                                        accept: false,
                                        dropLadderCode: null,
                                      }),
                                    'Doubles invite declined.',
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
                      <p className="muted-text">No doubles invites waiting.</p>
                    )}
                  </div>
                </section>

                {isClubOfficer ? (
                  <>
                    <section className="panel">
                      <p className="eyebrow">Officer add</p>
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
                            {(snapshot?.ladders ?? []).map((ladder) => (
                              <option key={ladder.id} value={ladder.code}>
                                {ladder.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Player</span>
                          <select
                            value={adminForm.userId}
                            onChange={(event) =>
                              setAdminForm((current) => ({ ...current, userId: event.target.value }))
                            }
                            required
                          >
                            <option value="">Choose member</option>
                            {selectedMembers.map((member) => (
                              <option key={member.user_id} value={member.user_id}>
                                {member.full_name} (@{member.username})
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
                              <option value="">Choose partner</option>
                              {selectedMembers.map((member) => (
                                <option key={member.user_id} value={member.user_id}>
                                  {member.full_name} (@{member.username})
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        <label>
                          <span>Rank</span>
                          <input
                            type="number"
                            min="1"
                            value={adminForm.rank}
                            onChange={(event) =>
                              setAdminForm((current) => ({ ...current, rank: event.target.value }))
                            }
                            placeholder="Bottom if blank"
                          />
                        </label>
                        <button className="primary-button" type="submit" disabled={busyAction === 'admin-add-entry'}>
                          {busyAction === 'admin-add-entry' ? 'Adding...' : 'Add entry'}
                        </button>
                      </form>
                    </section>

                    <section className="panel">
                      <p className="eyebrow">Officer queue</p>
                      <div className="request-list">
                        {pendingOfficerRequests.length ? (
                          pendingOfficerRequests.map((request) => (
                            <div className="request-review" key={request.request_id}>
                              <div>
                                <strong>{request.requester_name}</strong>
                                <p className="muted-text">
                                  {request.ladder_name} | {request.request_type}
                                  {request.partner_name ? ` | ${request.partner_name}` : ''}
                                </p>
                                {request.target_rank ? <p>Target rank #{request.target_rank}</p> : null}
                                <input
                                  className="compact-input"
                                  type="number"
                                  min="1"
                                  value={rankOverrides[request.request_id] || ''}
                                  onChange={(event) =>
                                    setRankOverrides((current) => ({
                                      ...current,
                                      [request.request_id]: event.target.value,
                                    }))
                                  }
                                  placeholder="Optional rank"
                                />
                              </div>
                              <div className="inline-actions">
                                <button
                                  className="tiny-button"
                                  type="button"
                                  onClick={() =>
                                    runAction(
                                      `approve-${request.request_id}`,
                                      () =>
                                        officerResolveLadderRequest({
                                          requestId: request.request_id,
                                          decision: 'approved',
                                          rank: rankOverrides[request.request_id]
                                            ? Number(rankOverrides[request.request_id])
                                            : null,
                                        }),
                                      'Ladder request approved.',
                                    )
                                  }
                                >
                                  Approve
                                </button>
                                <button
                                  className="tiny-button tiny-button-danger"
                                  type="button"
                                  onClick={() =>
                                    runAction(
                                      `reject-${request.request_id}`,
                                      () =>
                                        officerResolveLadderRequest({
                                          requestId: request.request_id,
                                          decision: 'rejected',
                                          rank: null,
                                        }),
                                      'Ladder request rejected.',
                                    )
                                  }
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="muted-text">No officer-ready ladder requests.</p>
                        )}
                      </div>
                    </section>
                  </>
                ) : null}
              </aside>
            </section>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'social' ? (
        <section className="tab-panel">
          <NotificationList
            category="social"
            notifications={notifications}
            open={categoryNotificationsOpen.social}
            onToggle={() =>
              setCategoryNotificationsOpen((current) => ({ ...current, social: !current.social }))
            }
            onRead={(id) => runAction(`read-${id}`, () => markNotificationRead(id), 'Notification marked read.')}
            onReadCategory={(category) =>
              runAction(`read-${category}`, () => markCategoryNotificationsRead(category), 'Notifications marked read.')
            }
          />

          <section className="content-grid section-spaced">
            <div className="panel panel-wide">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Exact username search</p>
                  <h2>Find players</h2>
                </div>
              </div>
              <form className="inline-form" onSubmit={handleFriendSearch}>
                <input
                  value={friendSearch}
                  onChange={(event) =>
                    setFriendSearch(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                  }
                  placeholder="exact_username"
                  minLength={3}
                  maxLength={24}
                  required
                />
                <button className="primary-button" type="submit" disabled={busyAction === 'friend-search'}>
                  {busyAction === 'friend-search' ? 'Searching...' : 'Search'}
                </button>
              </form>

              <div className="request-list section-spaced">
                {searchResults.length ? (
                  searchResults.map((result) => (
                    <div className="request-review" key={result.id}>
                      <div>
                        <strong>{result.full_name}</strong>
                        <p className="muted-text">
                          @{result.username} | {formatSex(result.sex)} | {formatAgeGroup(result.age_group)}
                        </p>
                      </div>
                      <button
                        className="tiny-button"
                        type="button"
                        disabled={result.is_friend || result.has_pending_request}
                        onClick={() =>
                          runAction(
                            `friend-${result.username}`,
                            () => sendFriendRequest(result.username),
                            'Friend request sent.',
                          )
                        }
                      >
                        {result.is_friend ? 'Friend' : result.has_pending_request ? 'Pending' : 'Add friend'}
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="muted-text">Search an exact username to see a profile.</p>
                )}
              </div>
            </div>

            <aside className="sidebar-stack">
              <section className="panel">
                <p className="eyebrow">Friend requests</p>
                <div className="request-list">
                  {incomingFriendRequests.length ? (
                    incomingFriendRequests.map((request) => (
                      <div className="request-review" key={request.request_id}>
                        <div>
                          <strong>{request.sender_full_name}</strong>
                          <p className="muted-text">@{request.sender_username}</p>
                        </div>
                        <div className="inline-actions">
                          <button
                            className="tiny-button"
                            type="button"
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
                            onClick={() =>
                              runAction(
                                `friend-reject-${request.request_id}`,
                                () => respondToFriendRequest(request.request_id, false),
                                'Friend request rejected.',
                              )
                            }
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="muted-text">No incoming requests.</p>
                  )}
                </div>
              </section>
            </aside>
          </section>

          <section className="panel section-spaced">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Friends</p>
                <h2>{snapshot?.friends?.length ?? 0} connected players</h2>
              </div>
            </div>
            <div className="friends-grid">
              {(snapshot?.friends ?? []).length ? (
                snapshot.friends.map((friend) => (
                  <article className="panel-subtle" key={friend.friend_id}>
                    <strong>{friend.friend_full_name}</strong>
                    <p className="muted-text">
                      @{friend.friend_username} | {formatSex(friend.friend_sex)}
                    </p>
                  </article>
                ))
              ) : (
                <p className="muted-text">Accepted friends appear here.</p>
              )}
            </div>
          </section>
        </section>
      ) : null}

      {activeTab === 'court' ? (
        <section className="tab-panel">
          <NotificationList
            category="court"
            notifications={notifications}
            open={categoryNotificationsOpen.court}
            onToggle={() =>
              setCategoryNotificationsOpen((current) => ({ ...current, court: !current.court }))
            }
            onRead={(id) => runAction(`read-${id}`, () => markNotificationRead(id), 'Notification marked read.')}
            onReadCategory={(category) =>
              runAction(`read-${category}`, () => markCategoryNotificationsRead(category), 'Notifications marked read.')
            }
          />

          <section className="content-grid section-spaced">
            <div className="panel panel-wide">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Create court</p>
                  <h2>Post a time to play</h2>
                </div>
              </div>
              <form className="form-stack" onSubmit={handleCreateCourt}>
                <div className="form-grid">
                  <label>
                    <span>Play type</span>
                    <select
                      value={courtForm.playType}
                      onChange={(event) => updateCourtForm('playType', event.target.value)}
                    >
                      <option value="singles">Singles</option>
                      <option value="doubles">Doubles</option>
                      <option value="either">Either</option>
                    </select>
                  </label>
                  <label>
                    <span>Date</span>
                    <input
                      type="date"
                      value={courtForm.date}
                      onChange={(event) => updateCourtForm('date', event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    <span>Time</span>
                    <input
                      type="time"
                      value={courtForm.time}
                      onChange={(event) => updateCourtForm('time', event.target.value)}
                      required
                    />
                  </label>
                </div>

                <label>
                  <span>Description</span>
                  <textarea
                    value={courtForm.description}
                    onChange={(event) => updateCourtForm('description', event.target.value)}
                    rows={3}
                    placeholder="Short note about pace, format, or meetup details"
                  />
                </label>

                <div className="form-grid">
                  <label>
                    <span>Location</span>
                    <select
                      value={courtForm.locationType}
                      onChange={(event) => updateCourtForm('locationType', event.target.value)}
                    >
                      <option value="osu">OSU Courts</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>
                  {courtForm.locationType === 'osu' ? (
                    <label>
                      <span>OSU court number</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={courtForm.osuCourtNumber}
                        onChange={(event) => updateCourtForm('osuCourtNumber', event.target.value)}
                      />
                    </label>
                  ) : (
                    <label>
                      <span>Custom location</span>
                      <input
                        value={courtForm.customLocation}
                        onChange={(event) => updateCourtForm('customLocation', event.target.value)}
                        placeholder="Court location"
                        required
                      />
                    </label>
                  )}
                </div>

                <section className="panel-subtle">
                  <p className="eyebrow">Broadcast</p>
                  <div className="check-grid">
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={courtForm.broadcastPublic}
                        onChange={(event) => updateCourtForm('broadcastPublic', event.target.checked)}
                      />
                      <span>Public</span>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={courtForm.broadcastFriends}
                        onChange={(event) => updateCourtForm('broadcastFriends', event.target.checked)}
                      />
                      <span>Friends</span>
                    </label>
                  </div>
                  {clubs.length ? (
                    <div className="check-grid section-spaced-tight">
                      {clubs.map((club) => (
                        <label className="check-row" key={club.id}>
                          <input
                            type="checkbox"
                            checked={courtForm.broadcastClubIds.includes(club.id)}
                            onChange={() => toggleCourtClub(club.id)}
                          />
                          <span>{club.name}</span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </section>

                <section className="panel-subtle">
                  <p className="eyebrow">Invite specific friends</p>
                  <div className="check-grid">
                    {(snapshot?.friends ?? []).length ? (
                      snapshot.friends.map((friend) => (
                        <label className="check-row" key={friend.friend_id}>
                          <input
                            type="checkbox"
                            checked={courtForm.invitedFriendIds.includes(friend.friend_id)}
                            onChange={() => toggleCourtFriend(friend.friend_id)}
                          />
                          <span>{friend.friend_full_name}</span>
                        </label>
                      ))
                    ) : (
                      <p className="muted-text">Add friends from Social to invite them directly.</p>
                    )}
                  </div>
                </section>

                <button className="primary-button" type="submit" disabled={busyAction === 'create-court'}>
                  {busyAction === 'create-court' ? 'Creating...' : 'Create court'}
                </button>
              </form>
            </div>

            <aside className="sidebar-stack">
              <section className="panel">
                <p className="eyebrow">Court rules</p>
                <h2>Request or accept</h2>
                <p className="muted-text">
                  Broadcasted players request to join. Direct invitees accept the invite without a separate request.
                </p>
              </section>
            </aside>
          </section>

          <section className="panel section-spaced">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Visible courts</p>
                <h2>{snapshot?.courts?.length ?? 0} upcoming posts</h2>
              </div>
            </div>
            <div className="court-grid">
              {(snapshot?.courts ?? []).length ? (
                snapshot.courts.map((court) => {
                  const acceptedInvites = court.invites.filter((invite) => invite.status === 'accepted')
                  const acceptedJoinRequests = court.join_requests.filter(
                    (request) => request.status === 'accepted',
                  )
                  const participants = [
                    ...acceptedInvites.map((invite) => ({
                      userId: invite.invited_user_id,
                      name: invite.invited_name,
                      username: invite.invited_username,
                    })),
                    ...acceptedJoinRequests.map((request) => ({
                      userId: request.requester_id,
                      name: request.requester_name,
                      username: request.requester_username,
                    })),
                  ]
                  const hasJoined =
                    court.my_invite?.status === 'accepted' ||
                    court.my_join_request?.status === 'accepted'
                  const hasPendingJoin =
                    court.my_invite?.status === 'pending' ||
                    court.my_join_request?.status === 'pending'

                  return (
                  <article className="court-card" key={court.id}>
                    <div className="section-heading">
                      <div>
                        <strong>{court.location_label}</strong>
                        <p className="muted-text">
                          {formatDateTime(court.scheduled_at)} | {court.play_type} | {court.participant_count}/{court.capacity}
                        </p>
                      </div>
                      <span className="status-pill">{court.is_full ? 'Full' : 'Open'}</span>
                    </div>
                    <p className="muted-text">Created by {court.creator_name}</p>
                    {court.description ? <p>{court.description}</p> : null}
                    <p className="muted-text">
                      Audience: {[...court.audiences, court.club_ids.length ? 'selected clubs' : null]
                        .filter(Boolean)
                        .join(', ')}
                    </p>

                    {court.is_creator ? (
                      <div className="request-list">
                        <p className="eyebrow">Players</p>
                        {participants.length ? (
                          participants.map((participant) => (
                            <div className="request-review" key={participant.userId}>
                              <div>
                                <strong>{participant.name}</strong>
                                <p className="muted-text">@{participant.username}</p>
                              </div>
                              <button
                                className="tiny-button tiny-button-danger"
                                type="button"
                                onClick={() =>
                                  runAction(
                                    `court-remove-${court.id}-${participant.userId}`,
                                    () => removeUserFromCourt(court.id, participant.userId),
                                    'Player removed from court.',
                                  )
                                }
                              >
                                Remove
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="muted-text">No accepted players yet.</p>
                        )}
                        <p className="eyebrow">Join requests</p>
                        {court.join_requests.filter((request) => request.status === 'pending').length ? (
                          court.join_requests
                            .filter((request) => request.status === 'pending')
                            .map((request) => (
                              <div className="request-review" key={request.request_id}>
                                <div>
                                  <strong>{request.requester_name}</strong>
                                  <p className="muted-text">@{request.requester_username}</p>
                                </div>
                                <div className="inline-actions">
                                  <button
                                    className="tiny-button"
                                    type="button"
                                    onClick={() =>
                                      runAction(
                                        `court-join-accept-${request.request_id}`,
                                        () => respondCourtJoinRequest(request.request_id, true),
                                        'Court join request accepted.',
                                      )
                                    }
                                  >
                                    Accept
                                  </button>
                                  <button
                                    className="tiny-button tiny-button-danger"
                                    type="button"
                                    onClick={() =>
                                      runAction(
                                        `court-join-reject-${request.request_id}`,
                                        () => respondCourtJoinRequest(request.request_id, false),
                                        'Court join request rejected.',
                                      )
                                    }
                                  >
                                    Reject
                                  </button>
                                </div>
                              </div>
                            ))
                        ) : (
                          <p className="muted-text">No pending join requests.</p>
                        )}
                      </div>
                    ) : hasJoined ? (
                      <div className="inline-actions">
                        <span className="status-pill">Joined</span>
                        <button
                          className="tiny-button tiny-button-danger"
                          type="button"
                          onClick={() =>
                            runAction(
                              `court-leave-${court.id}`,
                              () => leaveCourt(court.id),
                              'You left the court.',
                            )
                          }
                        >
                          Leave court
                        </button>
                      </div>
                    ) : court.my_invite?.status === 'pending' ? (
                      <div className="inline-actions">
                        <button
                          className="tiny-button"
                          type="button"
                          onClick={() =>
                            runAction(
                              `invite-accept-${court.my_invite.invite_id}`,
                              () => respondCourtInvite(court.my_invite.invite_id, true),
                              'Court invite accepted.',
                            )
                          }
                        >
                          Accept invite
                        </button>
                        <button
                          className="tiny-button tiny-button-danger"
                          type="button"
                          onClick={() =>
                            runAction(
                              `invite-reject-${court.my_invite.invite_id}`,
                              () => respondCourtInvite(court.my_invite.invite_id, false),
                              'Court invite declined.',
                            )
                          }
                        >
                          Decline
                        </button>
                      </div>
                    ) : court.my_join_request ? (
                      <div className="inline-actions">
                      <span className="status-pill">Request {court.my_join_request.status}</span>
                        {hasPendingJoin ? (
                          <button
                            className="tiny-button tiny-button-danger"
                            type="button"
                            onClick={() =>
                              runAction(
                                `court-cancel-${court.id}`,
                                () => leaveCourt(court.id),
                                'Court request cancelled.',
                              )
                            }
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <button
                        className="tiny-button"
                        type="button"
                        disabled={court.is_full}
                        onClick={() =>
                          runAction(
                            `court-request-${court.id}`,
                            () => requestJoinCourt(court.id),
                            'Court join request sent.',
                          )
                        }
                      >
                        Request to join
                      </button>
                    )}
                  </article>
                  )
                })
              ) : (
                <p className="muted-text">No courts are visible yet.</p>
              )}
            </div>
          </section>
        </section>
      ) : null}
    </main>
  )
}
