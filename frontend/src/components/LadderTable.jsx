'use client'

export default function LadderTable({
  ladder,
  entries,
  isAdmin,
  currentUserId,
  busyAction,
  onMove,
  onRemove,
  onSelfDrop,
}) {
  return (
    <article className="ladder-table-card">
      <div className="ladder-table-header">
        <div>
          <p className="eyebrow">{ladder.code.replaceAll('_', ' ')}</p>
          <h3>{ladder.name}</h3>
        </div>
        <span className="count-pill">{entries.length} spots</span>
      </div>

      <div className="ladder-table-wrap">
        <table className="ladder-table">
          <thead>
            <tr>
              <th>Rank #</th>
              <th>{ladder.name}</th>
              {isAdmin ? <th>Officer</th> : onSelfDrop ? <th>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {entries.length ? (
              entries.map((entry, index) => (
                <tr key={entry.entry_id} className={entry.user_id === currentUserId || entry.partner_user_id === currentUserId ? 'ladder-row-active' : ''}>
                  <td className="rank-cell">#{entry.rank_position}</td>
                  <td>
                    <div className="team-cell">
                      <strong>{entry.team_label}</strong>
                      {entry.user_id === currentUserId || entry.partner_user_id === currentUserId ? (
                        <span>Your active spot</span>
                      ) : null}
                    </div>
                  </td>
                  {isAdmin ? (
                    <td>
                      <div className="inline-actions">
                        <button
                          className="tiny-button"
                          onClick={() => onMove(entry.entry_id, entry.rank_position - 1)}
                          disabled={busyAction === `move-${entry.entry_id}` || index === 0}
                        >
                          Up
                        </button>
                        <button
                          className="tiny-button"
                          onClick={() => onMove(entry.entry_id, entry.rank_position + 1)}
                          disabled={
                            busyAction === `move-${entry.entry_id}` ||
                            index === entries.length - 1
                          }
                        >
                          Down
                        </button>
                        <button
                          className="tiny-button tiny-button-danger"
                          onClick={() => onRemove(entry.entry_id)}
                          disabled={busyAction === `remove-${entry.entry_id}`}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  ) : onSelfDrop ? (
                    <td>
                      {entry.user_id === currentUserId || entry.partner_user_id === currentUserId ? (
                        <button
                          className="tiny-button tiny-button-danger"
                          onClick={() => onSelfDrop(entry)}
                          disabled={busyAction === `self-drop-${entry.entry_id}`}
                          type="button"
                        >
                          Drop
                        </button>
                      ) : (
                        <span className="muted-inline">-</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={isAdmin || onSelfDrop ? 3 : 2} className="empty-cell">
                  No players ranked yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  )
}
