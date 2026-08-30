import { useState } from 'react'
import StatusBadge from './StatusBadge'
import { derivePlotStatus } from '../data/cemeteryData'
import styles from './PlotCard.module.css'

export default function PlotCard({
  plot, onClose, onViewFull, pendingIntIds = new Set(),
  hasBlackstone = false, noteText = '',
  onToggleBlackstone, onSaveNote,
  isUnavailable = false, onToggleUnavailable,
}) {
  const status       = derivePlotStatus(plot)
  const internments  = plot.internments ?? []
  const count        = internments.length
  const [picking, setPicking] = useState(count > 1)

  // Single internment or already chosen — show the detail card
  const [chosen, setChosen] = useState(count === 1 ? internments[0] : null)

  const handlePick = (int) => {
    setChosen(int)
    setPicking(false)
  }


  // ── Field flag controls (blackstone + quick note) — per plot ───────────────
  const [noteOpen,  setNoteOpen]  = useState(false)
  const [noteDraft, setNoteDraft] = useState(noteText ?? '')

  const flagRow = (
    <div className={styles.flagArea}>
      <div className={styles.flagButtons}>
        <button
          className={`${styles.flagBtn} ${hasBlackstone ? styles.flagBtnBlackstoneOn : ''}`}
          onClick={() => onToggleBlackstone?.(plot)}
        >
          <span className={styles.flagSwatch} />
          {hasBlackstone ? 'Blackstone needed' : 'Needs blackstone'}
        </button>
        <button
          className={`${styles.flagBtn} ${noteText ? styles.flagBtnNoteOn : ''}`}
          onClick={() => { setNoteDraft(noteText ?? ''); setNoteOpen(o => !o) }}
        >
          <span className={styles.flagDot} />
          {noteText ? 'Edit note' : 'Add note'}
        </button>
      </div>

      <button
        className={`${styles.flagBtn} ${styles.unavailBtn} ${isUnavailable ? styles.unavailBtnOn : ''}`}
        onClick={() => onToggleUnavailable?.(plot)}
      >
        {isUnavailable ? '✓ Marked unavailable' : 'Mark plot unavailable'}
      </button>

      {noteText && !noteOpen && (
        <div className={styles.notePreview}>{noteText}</div>
      )}

      {noteOpen && (
        <div className={styles.noteEditor}>
          <textarea
            className="field-input"
            rows={3}
            autoFocus
            value={noteDraft}
            onChange={e => setNoteDraft(e.target.value)}
            placeholder="Quick note about this plot…"
          />
          <div className={styles.noteEditorBtns}>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => { onSaveNote?.(plot, noteDraft); setNoteOpen(false) }}>
              Save note
            </button>
            {noteText && (
              <button className="btn btn-ghost"
                onClick={() => { onSaveNote?.(plot, ''); setNoteDraft(''); setNoteOpen(false) }}>
                Clear
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => setNoteOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )

  // ── Picker view — shown when multiple internments ──────────────────────────
  if (picking) {
    return (
      <div className={styles.overlay}
        onPointerDown={e => { e.stopPropagation(); if (e.target === e.currentTarget) onClose() }}>
        <div className={styles.card}>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.location}>{plot.cemetery} · {plot.section}</div>
              <div className={styles.lotGrave}>Lot {plot.lot}, Grave {plot.grave}</div>
              <div className={styles.name}>{count} internments in this plot</div>
            </div>
            <button className={styles.closeBtn} onClick={onClose}>×</button>
          </div>

          <div className={styles.body} style={{ padding: '8px 0' }}>
            {internments.map((int) => {
              const name    = [int.interredFirstName, int.interredLastName].filter(Boolean).join(' ') || 'Unknown'
              const years   = (int.birthDate && int.deathDate)
                ? `${int.birthDate.split('/')[2]} – ${int.deathDate.split('/')[2]}`
                : null
              const isPending = pendingIntIds.has(int.id)
              return (
                <button key={int.id} className={styles.pickRow} onClick={() => handlePick(int)}>
                  <div className={styles.pickGraveLabel} style={{ color: isPending ? '#f87171' : undefined }}>
                    {int.graveLabel}
                  </div>
                  <div className={styles.pickInfo}>
                    <div className={styles.pickName} style={{ color: isPending ? '#f87171' : undefined }}>
                      {name}
                      {isPending && (
                        <span style={{
                          display: 'inline-block',
                          width: 7, height: 7,
                          borderRadius: '50%',
                          background: '#f87171',
                          marginLeft: 7,
                          flexShrink: 0,
                          verticalAlign: 'middle',
                        }} />
                      )}
                    </div>
                    {years && <div className={styles.pickYears}>{years}</div>}
                    {int.isCremains === 'Yes' && (
                      <span className={styles.cremainsBadge}>Cremains</span>
                    )}
                  </div>
                  <div className={styles.pickArrow}>›</div>
                </button>
              )
            })}
            <button className={styles.pickRow} onClick={() => onViewFull({ plot, internment: null, openAdd: true })}>
              <div className={styles.pickGraveLabel} style={{ color: 'var(--accent)', opacity: 0.7 }}>+</div>
              <div className={styles.pickInfo}>
                <div className={styles.pickName} style={{ color: 'var(--accent)' }}>Add new internment</div>
              </div>
              <div className={styles.pickArrow}>›</div>
            </button>
          </div>

          {flagRow}

          <div className={styles.footer}>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => onViewFull({ plot, internment: null })}>
              View Plot Record →
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Single / chosen internment card ───────────────────────────────────────
  const int   = chosen
  const name  = int
    ? [int.interredFirstName, int.interredLastName].filter(Boolean).join(' ')
    : null
  const birthY = int?.birthDate?.split('/')[2]
  const deathY = int?.deathDate?.split('/')[2]
  const years  = (birthY && deathY) ? `${birthY} – ${deathY}` : null

  return (
    <div className={styles.overlay}
      onPointerDown={e => { e.stopPropagation(); if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.card}>

        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.location}>{plot.cemetery} · {plot.section}</div>
            <div className={styles.lotGrave}>
              Lot {plot.lot}, Grave {int?.graveLabel ?? plot.grave}
              {count > 1 && (
                <button className={styles.multiBtn} onClick={() => setPicking(true)}>
                  +{count - 1} more
                </button>
              )}
            </div>
            <div className={styles.name}>{name ?? '— Unoccupied —'}</div>
            {years && <div className={styles.years}>{years}</div>}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.body}>
          <Row label="Status"><StatusBadge status={status} /></Row>
          <Row label="Lot type">{plot.lotType || '—'}</Row>
          {int?.internmentNumber && (
            <Row label="Internment #">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{int.internmentNumber}</span>
            </Row>
          )}
          {int?.isCremains === 'Yes' && (
            <Row label="Type"><span style={{ color: 'var(--accent)' }}>Cremains</span></Row>
          )}
          {(plot.purchaserFirstName || plot.purchaserLastName) && (
            <Row label="Owner">{plot.purchaserFirstName} {plot.purchaserLastName}</Row>
          )}
          {plot.purchaseDate && <Row label="Purchased">{plot.purchaseDate}</Row>}
          {int?.veteran && (
            <Row label="Veteran"><span style={{ color: '#fcd34d' }}>{int.veteran}</span></Row>
          )}
          {plot.markerType && <Row label="Marker">{plot.markerType}</Row>}
        </div>

        {flagRow}

        <div className={styles.footer}>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => onViewFull({ plot, internment: int })}>
            Full Record →
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 0', borderBottom: '1px solid var(--bg-surface)', gap: 12,
    }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)', textAlign: 'right' }}>{children}</span>
    </div>
  )
}
