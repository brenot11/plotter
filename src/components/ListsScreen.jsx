import { useState } from 'react'
import { blackstoneEntries, noteEntries } from '../utils/plotFlags'
import styles from './ChangeLogScreen.module.css'

const formatTime = (iso) => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function ListsScreen({
  log, flags,
  onClose, onNavigate, onCommit, onRevert, onDelete,
  onNavigatePlot, onClearBlackstone, onClearNote,
  generalNotes = [], onEditGeneralNote, onDeleteGeneralNote,
  initialTab = 'changes',
}) {
  const [tab, setTab] = useState(initialTab)

  const pending    = log.filter(e => !e.committed)
  const committed  = log.filter(e => e.committed)
  const stones     = blackstoneEntries(flags)
  const notes      = noteEntries(flags)

  const tabs = [
    { key: 'changes',     label: 'Changes',     count: pending.length },
    { key: 'blackstones', label: 'Blackstones', count: stones.length  },
    { key: 'notes',       label: 'Notes',       count: notes.length + generalNotes.length },
  ]

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 13, padding: '6px 12px' }}>← Back</button>
        <div className={styles.title}>Lists</div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className={styles.tabBar}>
        {tabs.map(t => (
          <button
            key={t.key}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.count > 0 && <span className={styles.tabCount}>{t.count}</span>}
          </button>
        ))}
      </div>

      <div className={styles.body}>
        {tab === 'changes' && (
          <ChangesTab
            pending={pending} committed={committed}
            onNavigate={onNavigate} onClose={onClose}
            onCommit={onCommit} onRevert={onRevert} onDelete={onDelete}
          />
        )}

        {tab === 'blackstones' && (
          <FlagTab
            entries={stones}
            kind="blackstone"
            emptyIcon="■"
            emptyTitle="No blackstones flagged"
            emptyDesc="Flag a plot from its info card while you're in the field, and it'll show up here so you can order and place the stone later."
            groupLabel="Needs a blackstone"
            doneLabel="Done"
            onNavigate={p => { onNavigatePlot(p); onClose() }}
            onClear={onClearBlackstone}
          />
        )}

        {tab === 'notes' && (
          <>
            {notes.length === 0 && generalNotes.length === 0 && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>✎</div>
                <div className={styles.emptyTitle}>No notes yet</div>
                <div className={styles.emptyDesc}>
                  Use <strong>+ Note</strong> in the top bar for a general note, or jot one on a
                  specific plot from its info card. Both collect here.
                </div>
              </div>
            )}

            {generalNotes.length > 0 && (
              <>
                <div className={styles.groupLabel}>General notes</div>
                {generalNotes.map(n => (
                  <div key={n.id} className={styles.entry}>
                    <div className={styles.entryMain} onClick={() => onEditGeneralNote(n)}>
                      <div className={styles.noteBody}>{n.text}</div>
                      <div className={styles.entryTime}>{formatTime(n.ts)}</div>
                    </div>
                    <div className={styles.entryActions}>
                      <button className={styles.commitBtn} onClick={() => onDeleteGeneralNote(n.id)}>
                        <span className={styles.commitCheck}>○</span>
                        <span>Clear</span>
                      </button>
                      <button className={styles.goBtn} onClick={() => onEditGeneralNote(n)}>Edit</button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {notes.length > 0 && (
              <FlagTab
                entries={notes}
                kind="note"
                groupLabel="Plot notes"
                groupStyle={{ marginTop: generalNotes.length > 0 ? 28 : 0 }}
                doneLabel="Clear"
                onNavigate={p => { onNavigatePlot(p); onClose() }}
                onClear={onClearNote}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Changes tab (existing behaviour, unchanged) ──────────────────────────────
function ChangesTab({ pending, committed, onNavigate, onClose, onCommit, onRevert, onDelete }) {
  if (pending.length === 0 && committed.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>✓</div>
        <div className={styles.emptyTitle}>No changes yet</div>
        <div className={styles.emptyDesc}>Edits you make to any plot or internment record will appear here so you can track what needs to be entered into The Crypt Keeper.</div>
      </div>
    )
  }

  return (
    <>
      {pending.length > 0 && (
        <>
          <div className={styles.groupLabel}>Pending — needs entry into TCK</div>
          {pending.map(entry => (
            <ChangeEntry
              key={entry.id}
              entry={entry}
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
              onNavigate={() => { onNavigate(entry); onClose() }}
              onCommit={null}
              onDelete={() => onDelete(entry.id)}
              committed
            />
          ))}
        </>
      )}
    </>
  )
}

function ChangeEntry({ entry, onNavigate, onCommit, onRevert, onDelete, committed }) {
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
        {committed && <span className={styles.committedLabel}>✓ Committed</span>}
        <button className={styles.goBtn} onClick={onNavigate}>View →</button>
        <button className={styles.deleteBtn} onClick={onDelete} title="Remove from list">✕</button>
      </div>
    </div>
  )
}

// ── Blackstones / Notes tab — same shape, different payload ──────────────────
function FlagTab({ entries, kind, emptyIcon, emptyTitle, emptyDesc, groupLabel, groupStyle, doneLabel, onNavigate, onClear }) {
  if (entries.length === 0) {
    if (!emptyTitle) return null
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>{emptyIcon}</div>
        <div className={styles.emptyTitle}>{emptyTitle}</div>
        <div className={styles.emptyDesc}>{emptyDesc}</div>
      </div>
    )
  }

  return (
    <>
      <div className={styles.groupLabel} style={groupStyle}>{groupLabel}</div>
      {entries.map(e => {
        const ts = kind === 'blackstone' ? e.blackstone?.ts : e.note?.ts
        return (
          <div key={e.plotId} className={styles.entry}>
            <div className={styles.entryMain} onClick={() => onNavigate(e)}>
              <div className={styles.entryName}>
                <span className={kind === 'blackstone' ? styles.stoneMark : styles.noteMark} />
                {e.displayName}
              </div>
              <div className={styles.entryFields}>{e.section} · Lot {e.lot}, Grave {e.grave}</div>
              {kind === 'note' && e.note?.text && (
                <div className={styles.noteBody}>{e.note.text}</div>
              )}
              {ts && <div className={styles.entryTime}>{formatTime(ts)}</div>}
            </div>

            <div className={styles.entryActions}>
              <button className={styles.commitBtn} onClick={() => onClear(e.plotId)} title="Remove from this list">
                <span className={styles.commitCheck}>○</span>
                <span>{doneLabel}</span>
              </button>
              <button className={styles.goBtn} onClick={() => onNavigate(e)}>View →</button>
            </div>
          </div>
        )
      })}
    </>
  )
}
