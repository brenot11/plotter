import styles from './ChangeLogScreen.module.css'

export default function ChangeLogScreen({ log, onClose, onNavigate, onCommit, onRevert, onDelete }) {
  const pending   = log.filter(e => !e.committed)
  const committed = log.filter(e => e.committed)

  const formatTime = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 13, padding: '6px 12px' }}>← Back</button>
        <div className={styles.title}>Change List</div>
        {pending.length > 0 && (
          <div className={styles.pendingCount}>{pending.length} pending</div>
        )}
      </div>

      <div className={styles.body}>
        {pending.length === 0 && committed.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>✓</div>
            <div className={styles.emptyTitle}>No changes yet</div>
            <div className={styles.emptyDesc}>Edits you make to any plot or internment record will appear here so you can track what needs to be entered into The Crypt Keeper.</div>
          </div>
        )}

        {pending.length > 0 && (
          <>
            <div className={styles.groupLabel}>Pending — needs entry into TCK</div>
            {pending.map(entry => (
              <ChangeEntry
                key={entry.id}
                entry={entry}
                formatTime={formatTime}
                onNavigate={() => { onNavigate(entry); onClose() }}
                onCommit={() => onCommit(entry.id)}
                onRevert={() => onRevert(entry.id)}
                onDelete={() => onDelete(entry.id)}
              />
            ))}
          </>
        )}

        {committed.length > 0 && (
          <>
            <div className={styles.groupLabel} style={{ marginTop: pending.length > 0 ? 28 : 0 }}>
              Committed — will clear on next reload
            </div>
            {committed.map(entry => (
              <ChangeEntry
                key={entry.id}
                entry={entry}
                formatTime={formatTime}
                onNavigate={() => { onNavigate(entry); onClose() }}
                onCommit={null}
                onDelete={() => onDelete(entry.id)}
                committed
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function ChangeEntry({ entry, formatTime, onNavigate, onCommit, onRevert, onDelete, committed }) {
  const fieldList = entry.changes.map(c => c.label).join(', ')

  return (
    <div className={`${styles.entry} ${committed ? styles.entryCommitted : ''}`}>
      <div className={styles.entryMain} onClick={onNavigate}>
        <div className={styles.entryName}>{entry.displayName}</div>
        <div className={styles.entryFields}>{fieldList}</div>
        <div className={styles.entryChanges}>
          {entry.changes.slice(0, 4).map(c => (
            <div key={c.field} className={styles.entryChange}>
              <span className={styles.changeLabel}>{c.label}</span>
              <span className={styles.changeValue}>{c.newValue || '—'}</span>
            </div>
          ))}
          {entry.changes.length > 4 && (
            <div className={styles.entryChange}>
              <span className={styles.changeLabel}>+{entry.changes.length - 4} more fields</span>
            </div>
          )}
        </div>
        <div className={styles.entryTime}>{formatTime(entry.timestamp)}</div>
      </div>

      <div className={styles.entryActions}>
        {!committed && onCommit && (
          <button className={styles.commitBtn} onClick={onCommit} title="Mark as entered in TCK">
            <span className={styles.commitCheck}>○</span>
            <span>Commit</span>
          </button>
        )}
        {!committed && onRevert && (
          <button className={styles.revertBtn} onClick={onRevert} title="Roll back to last committed state">
            ↩ Revert
          </button>
        )}
        {committed && (
          <span className={styles.committedLabel}>✓ Committed</span>
        )}
        <button className={styles.goBtn} onClick={onNavigate}>View →</button>
        <button className={styles.deleteBtn} onClick={onDelete} title="Remove from list">✕</button>
      </div>
    </div>
  )
}
