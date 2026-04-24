'use client'

import { DAYS_OF_WEEK } from '../../lib/constants'

function formatVisibilityLabel(value) {
  return value === 'invite_only' ? 'Invite only' : 'Open court'
}

function formatCourtTime(court) {
  return `${court.day_of_week} | ${court.start_time} - ${court.end_time}`
}

export default function FillCourtTab({
  profile,
  club,
  visibleCourts,
  sameClubFriends,
  courtForm,
  setCourtForm,
  busyAction,
  handleCourtSubmit,
  toggleCourtInvitee,
  handleJoinCourt,
}) {
  const myHostedCourts = visibleCourts.filter((court) => court.creator_id === profile.id)
  const openCourts = visibleCourts.filter(
    (court) => court.creator_id !== profile.id && court.visibility === 'open',
  )
  const invitedCourts = visibleCourts.filter(
    (court) => court.creator_id !== profile.id && court.visibility === 'invite_only',
  )

  if (!profile.club_id) {
    return (
      <section className="panel">
        <p className="eyebrow">Fill a Court</p>
        <h2>Join a club first</h2>
        <p className="muted-text">
          Court posts live inside clubs. Create or join a club from the Club tab before you host or view courts.
        </p>
      </section>
    )
  }

  return (
    <>
      <section className="info-grid">
        <article className="panel">
          <p className="eyebrow">Your Club</p>
          <h2>{club?.name ?? profile.club_name}</h2>
          <p className="muted-text">All court posts are scoped to your current club.</p>
        </article>
        <article className="panel">
          <p className="eyebrow">Hosted Courts</p>
          <h2>{myHostedCourts.length}</h2>
          <p className="muted-text">Courts you created for your club.</p>
        </article>
        <article className="panel">
          <p className="eyebrow">Available Courts</p>
          <h2>{openCourts.length + invitedCourts.length}</h2>
          <p className="muted-text">Eligible viewers can join courts and everyone who can see a court can track the current roster count.</p>
        </article>
      </section>

      <section className="content-grid">
        <div className="panel panel-wide">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Create Court</p>
              <h2>Open a court for your club</h2>
            </div>
          </div>
          <form className="form-stack" onSubmit={handleCourtSubmit}>
            <label>
              <span>Court title</span>
              <input
                value={courtForm.title}
                onChange={(event) =>
                  setCourtForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Tuesday night doubles"
                required
              />
            </label>
            <label>
              <span>Details</span>
              <textarea
                rows="4"
                value={courtForm.details}
                onChange={(event) =>
                  setCourtForm((current) => ({
                    ...current,
                    details: event.target.value,
                  }))
                }
                placeholder="Time, format, or anything your club should know."
              />
            </label>
            <div className="court-schedule-grid">
              <label>
                <span>Day of week</span>
                <select
                  value={courtForm.dayOfWeek}
                  onChange={(event) =>
                    setCourtForm((current) => ({
                      ...current,
                      dayOfWeek: event.target.value,
                    }))
                  }
                >
                  {DAYS_OF_WEEK.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Start time</span>
                <input
                  type="time"
                  value={courtForm.startTime}
                  onChange={(event) =>
                    setCourtForm((current) => ({
                      ...current,
                      startTime: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                <span>End time</span>
                <input
                  type="time"
                  value={courtForm.endTime}
                  onChange={(event) =>
                    setCourtForm((current) => ({
                      ...current,
                      endTime: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                <span>Maximum players</span>
                <input
                  type="number"
                  min="2"
                  max="24"
                  value={courtForm.maxPlayers}
                  onChange={(event) =>
                    setCourtForm((current) => ({
                      ...current,
                      maxPlayers: event.target.value,
                    }))
                  }
                  required
                />
              </label>
            </div>
            <label>
              <span>Visibility</span>
              <select
                value={courtForm.visibility}
                onChange={(event) =>
                  setCourtForm((current) => ({
                    ...current,
                    visibility: event.target.value,
                    inviteeIds: event.target.value === 'open' ? [] : current.inviteeIds,
                  }))
                }
              >
                <option value="open">Open court</option>
                <option value="invite_only">Invite only</option>
              </select>
            </label>

            {courtForm.visibility === 'invite_only' ? (
              <div className="invite-grid">
                {sameClubFriends.length ? (
                  sameClubFriends.map((friend) => (
                    <label key={friend.friend_id} className="invite-option">
                      <input
                        type="checkbox"
                        checked={courtForm.inviteeIds.includes(friend.friend_id)}
                        onChange={() => toggleCourtInvitee(friend.friend_id)}
                      />
                      <span>
                        {friend.friend_display_name} (@{friend.friend_username})
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="muted-text">You need same-club friends before you can send invite-only courts.</p>
                )}
              </div>
            ) : null}

            <button className="primary-button" type="submit" disabled={busyAction === 'create-court'}>
              {busyAction === 'create-court' ? 'Creating...' : 'Create court'}
            </button>
          </form>
        </div>

        <aside className="sidebar-stack">
          <section className="panel panel-subtle">
            <p className="eyebrow">Visible to you</p>
            <div className="request-list">
              {visibleCourts.length ? (
                visibleCourts.map((court) => {
                  const isOwnCourt = court.creator_id === profile.id
                  const isFull = Number(court.joined_count ?? 0) >= Number(court.max_players ?? 0)

                  return (
                    <div key={court.id} className="request-item court-card">
                      <div className="court-card-copy">
                        <strong>{court.title}</strong>
                        <p>
                          {court.creator_display_name ?? 'Club member'} | {formatVisibilityLabel(court.visibility)}
                        </p>
                        <p>{formatCourtTime(court)}</p>
                        <p>
                          Joined {court.joined_count ?? 0}/{court.max_players ?? 0}
                          {court.joined_by_viewer ? ' | You are in' : ''}
                        </p>
                        {court.details ? <p>{court.details}</p> : null}
                      </div>
                      <div className="court-card-actions">
                        <span className="status-pill">{formatVisibilityLabel(court.visibility)}</span>
                        {!isOwnCourt ? (
                          <button
                            className="tiny-button"
                            type="button"
                            disabled={
                              busyAction === `join-court-${court.id}` ||
                              court.joined_by_viewer ||
                              isFull
                            }
                            onClick={() => handleJoinCourt(court.id)}
                          >
                            {court.joined_by_viewer
                              ? 'Joined'
                              : busyAction === `join-court-${court.id}`
                                ? 'Joining...'
                                : isFull
                                  ? 'Full'
                                  : 'Join court'}
                          </button>
                        ) : (
                          <span className="count-pill">Host</span>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="muted-text">No courts are visible yet.</p>
              )}
            </div>
          </section>
        </aside>
      </section>
    </>
  )
}
