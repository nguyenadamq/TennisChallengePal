'use client'

import { Fragment } from 'react'

export default function LadderTable({
  ladder,
  entries,
  isAdmin,
  currentUserId,
  busyAction,
  onMove,
  onRemove,
  expandedSelfDropEntryId,
  onToggleSelfDrop,
  onConfirmSelfDrop,
}) {
  return (
    <article className="ladder-table-card">
      <div className="ladder-table-header">
        <div>
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
              {isAdmin ? <th>Officer</th> : null}
            </tr>
          </thead>
          <tbody>
            {entries.length ? (
              entries.map((entry, index) => {
                const isOwnEntry =
                  entry.user_id === currentUserId || entry.partner_user_id === currentUserId
                const isExpanded = expandedSelfDropEntryId === entry.entry_id

                return (
                  <Fragment key={entry.entry_id}>
                    <tr
                      className={`${isOwnEntry ? 'ladder-row-active ladder-row-clickable' : ''}${isExpanded ? ' ladder-row-expanded' : ''}`}
                      onClick={
                        !isAdmin && isOwnEntry && onToggleSelfDrop
                          ? () => onToggleSelfDrop(entry.entry_id)
                          : undefined
                      }
                    >
                      <td className="rank-cell">#{entry.rank_position}</td>
                      <td>
                        <div className="team-cell">
                          <strong>{entry.team_label}</strong>
                          {isOwnEntry ? (
                            <span>{isExpanded ? 'Close drop menu' : 'Your active spot'}</span>
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
                      ) : null}
                    </tr>
                    {!isAdmin && isOwnEntry && isExpanded ? (
                      <tr key={`${entry.entry_id}-drop`} className="ladder-inline-drop-row">
                        <td colSpan={2} className="ladder-inline-drop-cell">
                          <div className="ladder-inline-drop">
                            <div>
                              <strong>Drop this spot?</strong>
                              <p className="muted-text">
                                {entry.partner_user_id
                                  ? 'This is a doubles entry, so dropping it removes the full team from the ladder.'
                                  : 'This removes your current ladder position and closes the gap below you.'}
                              </p>
                            </div>
                            <div className="inline-actions">
                              <button
                                className="tiny-button"
                                type="button"
                                onClick={() => onToggleSelfDrop(entry.entry_id)}
                              >
                                Cancel
                              </button>
                              <button
                                className="tiny-button tiny-button-danger"
                                type="button"
                                disabled={busyAction === `self-drop-${entry.entry_id}`}
                                onClick={() => onConfirmSelfDrop(entry)}
                              >
                                {busyAction === `self-drop-${entry.entry_id}` ? 'Dropping...' : 'Drop this spot'}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })
            ) : (
              <tr>
                <td colSpan={isAdmin ? 3 : 2} className="empty-cell">
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
