'use client'

import { LADDER_RULE_COPY } from '../../lib/constants'

export default function HomeTab({
  profile,
  club,
  myEntries,
  unreadCount,
  visibleCourts,
  pendingSocialCount,
  adminPromotionPassword,
  setAdminPromotionPassword,
  busyAction,
  handleAdminPromotion,
}) {
  const openCourts = visibleCourts.filter(
    (court) => court.creator_id !== profile.id && court.visibility === 'open',
  )

  return (
    <>
      <section className="info-grid">
        <article className="panel">
          <p className="eyebrow">Your Home Base</p>
          <h2>{club?.name ?? 'No club yet'}</h2>
          <p className="muted-text">
            {club
              ? `You are currently playing inside ${club.name}. All ladders, challenges, officer actions, and courts now stay inside this club.`
              : 'Join or create a club from the Club tab to unlock ladders, challenge matches, and fill-a-court activity.'}
          </p>
        </article>
        <article className="panel">
          <p className="eyebrow">Your Snapshot</p>
          <h2>{myEntries.length} active ladders</h2>
          <p className="muted-text">
            {pendingSocialCount} pending social items and {unreadCount} unread notifications.
          </p>
        </article>
        <article className="panel">
          <p className="eyebrow">Court Pulse</p>
          <h2>{openCourts.length} open courts</h2>
          <p className="muted-text">
            Open courts only appear when a club friend has your Hit Partner toggle turned on.
          </p>
        </article>
      </section>

      <section className="content-grid">
        <div className="panel panel-wide">
          <div className="section-heading">
            <div>
              <p className="eyebrow">How It Works</p>
              <h2>Play inside one club at a time</h2>
            </div>
          </div>
          <div className="mini-list">
            <div className="mini-item start-here-row">
              <strong className="start-here-title">Club-gated play</strong>
              <span className="start-here-copy">
                Ladders, challenge requests, officer approvals, and fill-a-court posts are all scoped to your current club.
              </span>
            </div>
            <div className="mini-item start-here-row">
              <strong className="start-here-title">Friends still matter</strong>
              <span className="start-here-copy">
                You can keep friends across clubs, but doubles invites, challenge activity, and fill-a-court matching only work with friends in your current club.
              </span>
            </div>
            <div className="mini-item start-here-row">
              <strong className="start-here-title">Hit Partner toggle</strong>
              <span className="start-here-copy">
                Open courts are shown only to club friends you have explicitly marked as Hit Partner in your friends list.
              </span>
            </div>
            <div className="mini-item start-here-row">
              <strong className="start-here-title">Ladder rules</strong>
              <span className="start-here-copy">
                {LADDER_RULE_COPY[profile.gender].summary} {LADDER_RULE_COPY[profile.gender].challenge}
              </span>
            </div>
          </div>
        </div>

        <aside className="sidebar-stack">
          <section className="panel">
            <p className="eyebrow">Profile Settings</p>
            <h2>Officer access</h2>
            {profile.role === 'officer' ? (
              <p className="muted-text">This account already has officer access for the club you join.</p>
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
