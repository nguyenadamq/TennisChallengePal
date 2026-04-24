'use client'

import LadderTable from '../../components/LadderTable'
import { DOUBLES_LADDERS } from '../../lib/constants'

export default function ClubTab({
  profile,
  club,
  ladders,
  entries,
  requests,
  profiles,
  friends,
  friendRequests,
  busyAction,
  createClubForm,
  setCreateClubForm,
  joinClubForm,
  setJoinClubForm,
  friendSearch,
  setFriendSearch,
  searchResults,
  requestForm,
  setRequestForm,
  adminForm,
  setAdminForm,
  inviteDropChoices,
  setInviteDropChoices,
  adminRankInputs,
  setAdminRankInputs,
  expandedSelfDropEntryId,
  setExpandedSelfDropEntryId,
  myEntries,
  sameClubFriends,
  playerOptions,
  challengeableLadders,
  challengeOptions,
  joinAllowed,
  challengeAllowed,
  eligibleFriendOptions,
  needsDropChoice,
  getDropOptionsForUser,
  getEntriesForLadder,
  isEligibleForLadder,
  handleCreateClub,
  handleJoinClub,
  handleFriendSearch,
  runAction,
  setHitPartnerPreference,
  respondToFriendRequest,
  sendFriendRequest,
  respondToPartnerInvite,
  createManualEntryAction,
  moveEntryAction,
  removeEntryAction,
  resolveRequestAction,
  handleRequestSubmit,
  handleInlineSelfDrop,
  setDropConfirmEntry,
}) {
  const incomingFriendRequests = friendRequests.filter(
    (request) => request.receiver_id === profile.id && request.status === 'pending',
  )
  const partnerInvites = requests.filter(
    (request) => request.partner_user_id === profile.id && request.status === 'pending_partner',
  )
  const adminRequests = requests.filter((request) => request.status === 'pending_admin')

  return (
    <>
      {!profile.club_id ? (
        <section className="content-grid">
          <div className="panel panel-wide">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Club Access</p>
              </div>
            </div>
            <div className="split-panel-grid">
              <form className="panel panel-subtle club-form-panel" onSubmit={handleCreateClub}>
                <p className="eyebrow">Create Club</p>
                <label>
                  <span>Club name</span>
                  <input
                    value={createClubForm.clubName}
                    onChange={(event) =>
                      setCreateClubForm((current) => ({
                        ...current,
                        clubName: event.target.value,
                      }))
                    }
                    placeholder="Sunset Racquet Club"
                    required
                  />
                </label>
                <label>
                  <span>Club password</span>
                  <input
                    type="password"
                    value={createClubForm.password}
                    onChange={(event) =>
                      setCreateClubForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder="Create a club password"
                    required
                  />
                </label>
                <button className="primary-button" type="submit" disabled={busyAction === 'create-club'}>
                  {busyAction === 'create-club' ? 'Creating...' : 'Create club'}
                </button>
              </form>

              <form className="panel panel-subtle club-form-panel" onSubmit={handleJoinClub}>
                <p className="eyebrow">Join Club</p>
                <label>
                  <span>Club name</span>
                  <input
                    value={joinClubForm.clubName}
                    onChange={(event) =>
                      setJoinClubForm((current) => ({
                        ...current,
                        clubName: event.target.value,
                      }))
                    }
                    placeholder="Sunset Racquet Club"
                    required
                  />
                </label>
                <label>
                  <span>Club password</span>
                  <input
                    type="password"
                    value={joinClubForm.password}
                    onChange={(event) =>
                      setJoinClubForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder="Enter the club password"
                    required
                  />
                </label>
                <button className="primary-button" type="submit" disabled={busyAction === 'join-club'}>
                  {busyAction === 'join-club' ? 'Joining...' : 'Join club'}
                </button>
              </form>
            </div>
          </div>

          <aside className="sidebar-stack">
            <section className="panel">
              <p className="eyebrow">What unlocks next</p>
              <div className="mini-list">
                <div className="mini-item">
                  <strong>Club leaderboards</strong>
                  <span>Separate singles and doubles ladders for each club.</span>
                </div>
                <div className="mini-item">
                  <strong>Club-only challenges</strong>
                  <span>Members can only challenge and partner with players in the same club.</span>
                </div>
                <div className="mini-item">
                  <strong>Fill a Court</strong>
                  <span>Create open or invite-only courts and notify club players.</span>
                </div>
              </div>
            </section>
          </aside>
        </section>
      ) : (
        <>
          <section className="info-grid">
            <article className="panel">
              <p className="eyebrow">Current Club</p>
              <h2>{club?.name ?? profile.club_name}</h2>
              <p className="muted-text">Everything below is filtered to this club only.</p>
            </article>
            <article className="panel">
              <p className="eyebrow">Your Active Ladders</p>
              <h2>{myEntries.length} of 2</h2>
              <p className="muted-text">Only your club ladders count toward the limit.</p>
            </article>
            <article className="panel">
              <p className="eyebrow">Club Friends</p>
              <h2>{sameClubFriends.length}</h2>
              <p className="muted-text">Only same-club friends can be doubles partners or challenge opponents.</p>
            </article>
          </section>

          <section className="panel active-ladders-bar">
            <div className="active-ladders-bar-header">
              <p className="eyebrow">Your Club Ladder Spots</p>
              <h2>{myEntries.length} active</h2>
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
                  <p className="eyebrow">Club Leaderboards</p>
                  <h2>Live rankings for {club?.name ?? profile.club_name}</h2>
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
                      setExpandedSelfDropEntryId((current) => (current === entryId ? null : entryId))
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
                      {(requestForm.requestType === 'challenge' ? challengeableLadders : ladders).map((ladder) => (
                        <option
                          key={ladder.id}
                          value={ladder.code}
                          disabled={
                            requestForm.requestType === 'join' &&
                            !isEligibleForLadder(profile.gender, ladder.code)
                          }
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
                        setRequestForm((current) => {
                          const nextRequestType = event.target.value

                          return {
                            ...current,
                            requestType: nextRequestType,
                            ladderCode:
                              nextRequestType === 'challenge' && challengeableLadders.length
                                ? challengeableLadders[0].code
                                : current.ladderCode,
                            targetRank: '',
                            partnerUsername: '',
                            dropLadderCode: '',
                          }
                        })
                      }
                    >
                      <option value="join">Join ladder</option>
                      <option value="challenge">Challenge</option>
                    </select>
                  </label>

                  {requestForm.requestType === 'challenge' ? (
                    <label>
                      <span>Challenge player or team</span>
                      <select
                        value={requestForm.targetRank}
                        onChange={(event) =>
                          setRequestForm((current) => ({
                            ...current,
                            targetRank: event.target.value,
                          }))
                        }
                        required
                      >
                        <option value="">Choose who to challenge</option>
                        {challengeOptions.map((entry) => (
                          <option key={entry.entry_id} value={entry.rank_position}>
                            #{entry.rank_position} {entry.team_label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {requestForm.requestType === 'join' && DOUBLES_LADDERS.includes(requestForm.ladderCode) ? (
                    <label>
                      <span>Invite a same-club friend</span>
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
                  {requestForm.requestType === 'challenge' && challengeAllowed && !challengeOptions.length ? (
                    <p className="form-error">There is nobody eligible to challenge from this ladder right now.</p>
                  ) : null}

                  <button
                    className="primary-button"
                    type="submit"
                    disabled={
                      busyAction === 'request' ||
                      (requestForm.requestType === 'join'
                        ? !joinAllowed
                        : !challengeAllowed || !requestForm.targetRank)
                    }
                  >
                    {busyAction === 'request' ? 'Sending...' : 'Send request'}
                  </button>
                </form>
              </section>
            </aside>
          </section>
        </>
      )}

      <section className="friends-grid">
        <article className="panel panel-subtle">
          <p className="eyebrow">Friends List</p>
          <div className="friend-table">
            <div className="friend-table-row friend-table-header">
              <span>Player</span>
              <span>Club</span>
              <span>Hit Partner</span>
            </div>
            {friends.length ? (
              friends.map((friend) => (
                <div key={friend.friend_id} className="friend-table-row">
                  <div>
                    <strong>{friend.friend_display_name}</strong>
                    <p>
                      @{friend.friend_username} | {friend.friend_gender}
                    </p>
                  </div>
                  <span>{friend.friend_club_name ?? 'No club'}</span>
                  <button
                    className={`tiny-button${friend.hit_partner_enabled ? ' tiny-button-active' : ''}`}
                    type="button"
                    disabled={busyAction === `hit-partner-${friend.friend_id}`}
                    onClick={() =>
                      runAction(
                        `hit-partner-${friend.friend_id}`,
                        () =>
                          setHitPartnerPreference(friend.friend_id, !friend.hit_partner_enabled),
                        friend.hit_partner_enabled
                          ? 'Hit Partner disabled for that friend.'
                          : 'Hit Partner enabled for that friend.',
                      )
                    }
                  >
                    {friend.hit_partner_enabled ? 'On' : 'Off'}
                  </button>
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
                required
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
                      @{result.username} | {result.gender} | {result.club_name ?? 'No club'}
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
              <p className="muted-text">Search for a username to send a friend request.</p>
            )}
          </div>
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

      {profile.club_id && profile.role === 'officer' ? (
        <>
          <section className="info-grid">
            <article className="panel">
              <p className="eyebrow">Officer Queue</p>
              <h2>{adminRequests.length}</h2>
              <p className="muted-text">Only requests from your current club appear here.</p>
            </article>
            <article className="panel">
              <p className="eyebrow">Club Players</p>
              <h2>{profiles.length}</h2>
              <p className="muted-text">Officer controls are limited to members in your club.</p>
            </article>
            <article className="panel">
              <p className="eyebrow">Live Control</p>
              <h2>{entries.length}</h2>
              <p className="muted-text">Move, remove, and add entries for this club only.</p>
            </article>
          </section>

          <section className="content-grid">
            <div className="panel panel-wide">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Officer Leaderboards</p>
                  <h2>Manage {club?.name ?? profile.club_name}</h2>
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
                    onMove={(entryId, newRank) => moveEntryAction(entryId, newRank)}
                    onRemove={(entryId) => removeEntryAction(entryId)}
                  />
                ))}
              </div>
            </div>

            <aside className="sidebar-stack">
              <section className="panel">
                <p className="eyebrow">Officer Add</p>
                <h2>Add a ladder entry</h2>
                <form className="form-stack compact-form" onSubmit={createManualEntryAction}>
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
                              resolveRequestAction(
                                request.request_id,
                                'approved',
                                adminRankInputs[request.request_id]
                                  ? Number(adminRankInputs[request.request_id])
                                  : null,
                              )
                            }
                          >
                            Approve
                          </button>
                          <button
                            className="tiny-button tiny-button-danger"
                            type="button"
                            disabled={busyAction === `reject-${request.request_id}`}
                            onClick={() => resolveRequestAction(request.request_id, 'rejected', null)}
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
    </>
  )
}
