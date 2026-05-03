import { useState, useEffect } from 'react'
import StatusBadge from './StatusBadge'
import {
  STATUSES, LOT_TYPES, MARKER_TYPES, UNDERTAKERS,
  CAUSES, VETERAN_BRANCHES, GENDERS, BURIAL_POSITIONS,
  derivePlotStatus, makeEmptyInternment,
} from '../data/cemeteryData'
import {
  diffFields, INTERNMENT_TRACKED_FIELDS, PLOT_TRACKED_FIELDS,
} from '../utils/changeLog'
import styles from './DetailScreen.module.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

// Returns true if this field has been edited vs _original
function isEdited(obj, field) {
  if (!obj._original) return false
  const orig = (obj._original[field] ?? '').toString().trim()
  const curr = (obj[field] ?? '').toString().trim()
  return orig !== curr
}

const EDITED_COLOR = '#f87171'   // red for edited fields (matches danger button)
const NORMAL_COLOR = 'var(--text-primary)'

// ── Top-level screen ──────────────────────────────────────────────────────────
export default function DetailScreen({ plotAndInt, onBack, onSave, onChangeLog, onReloadFromTCK }) {
  const { plot: initPlot, internment: initInt, openAdd } = plotAndInt

  const [plot,        setPlot]        = useState(initPlot)
  const [activeInt,   setActiveInt]   = useState(initInt ?? null)
  const [editingPlot, setEditingPlot] = useState(false)

  // When plotAndInt changes from outside (e.g. after a commit updates _original),
  // sync plot and activeInt so colors refresh immediately.
  useEffect(() => {
    setPlot(initPlot)
    // Only sync activeInt if we're not editing — don't wipe in-progress edits
    setActiveInt(prev => {
      if (prev === null) return initInt ?? null
      // Find the updated version of the active internment from the new plot
      const fresh = initPlot.internments.find(i => i.id === prev.id)
      return fresh ?? prev
    })
  }, [initPlot])

  if (activeInt !== null) {
    // key includes a snapshot of _original so the component remounts
    // when _original is updated after a commit, clearing the red color
    const intKey = `${activeInt.id}_${JSON.stringify(activeInt._original ?? {})}`
    return (
      <InternmentDetail
        key={intKey}
        plot={plot}
        internment={activeInt}
        isNew={activeInt._isNew ?? false}
        onBack={() => setActiveInt(null)}
        onReloadFromTCK={onReloadFromTCK ? () => onReloadFromTCK(plot.id, activeInt.id) : null}
        onSave={(updatedInt, changes) => {
          const arr = plot.internments.filter(i => i.id !== updatedInt.id)
          arr.push({ ...updatedInt, _isNew: undefined })
          arr.sort((a, b) => a.graveLabel.localeCompare(b.graveLabel, undefined, { numeric: true }))
          const updatedPlot = { ...plot, internments: arr }
          setPlot(updatedPlot)
          // Pass internmentId explicitly so App knows exactly which one was edited
          onSave(updatedPlot, changes?.length > 0 ? { internmentId: updatedInt.id, changes } : null)
          setActiveInt({ ...updatedInt, _isNew: undefined })
        }}
        onDelete={(intId) => {
          const arr = plot.internments.filter(i => i.id !== intId)
          const updatedPlot = { ...plot, internments: arr }
          setPlot(updatedPlot)
          onSave(updatedPlot, null)
          setActiveInt(null)
        }}
      />
    )
  }

  const status = derivePlotStatus(plot)

  const handleAddInternment = () => {
    const base     = String(plot.grave)
    const existing = plot.internments.map(i => i.graveLabel)
    let label = base
    if (existing.includes(base)) {
      for (const l of 'ABCDEFGHIJ') {
        if (!existing.includes(`${base}${l}`)) { label = `${base}${l}`; break }
      }
    }
    const newInt = { ...makeEmptyInternment(plot.id, label), _isNew: true }
    setActiveInt(newInt)
  }

  const handleSavePlot = (updatedPlot) => {
    const changes = diffFields(updatedPlot._original ?? {}, updatedPlot, PLOT_TRACKED_FIELDS)
    setPlot(updatedPlot)
    onSave(updatedPlot, changes.length > 0 ? { target: 'plot', changes } : null)
    setEditingPlot(false)
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '6px 12px', fontSize: 13 }}>
          ← Map
        </button>
        <div className={styles.headerTitle}>
          <div className={styles.titleName}>
            Lot {plot.lot}, Grave {plot.grave}
            <span className={styles.titleCem}> · {plot.cemetery}</span>
          </div>
          <div className={styles.titleSub}>{plot.section} · {plot.lotType}</div>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className={styles.body}>
        <div className={styles.sectionTitle}>Internments</div>

        {plot.internments.length === 0 && (
          <div className={styles.emptyState}>No internments recorded for this plot.</div>
        )}

        {plot.internments.map(int => {
          const name   = [int.interredFirstName, int.interredLastName].filter(Boolean).join(' ') || 'Unknown'
          const birthY = int.birthDate?.split('/')[2]
          const deathY = int.deathDate?.split('/')[2]
          const years  = (birthY && deathY) ? `${birthY} – ${deathY}` : null
          const hasEdits = int._original && INTERNMENT_TRACKED_FIELDS.some(f => isEdited(int, f))
          return (
            <button key={int.id} className={styles.internmentRow} onClick={() => setActiveInt(int)}>
              <div className={styles.intGraveLabel} style={{ color: hasEdits ? 'var(--accent)' : undefined }}>
                {int.graveLabel}
              </div>
              <div className={styles.intInfo}>
                <div className={styles.intName} style={{ color: hasEdits ? 'var(--accent)' : undefined }}>
                  {name}
                  {hasEdits && <span className={styles.editedBadge}>edited</span>}
                </div>
                <div className={styles.intMeta}>
                  {years && <span>{years}</span>}
                  {int.isCremains === 'Yes' && <span className={styles.tag}>Cremains</span>}
                  {int.veteran    && <span className={styles.tagVet}>{int.veteran}</span>}
                </div>
              </div>
              <div className={styles.intArrow}>›</div>
            </button>
          )
        })}

        <button className={styles.addInternmentBtn} onClick={handleAddInternment}>
          + Add Internment
        </button>

        <PlotInfoSection
          plot={plot}
          editing={editingPlot}
          onEdit={() => setEditingPlot(true)}
          onSave={handleSavePlot}
          onCancel={() => setEditingPlot(false)}
          derivedStatus={status}
        />
      </div>
    </div>
  )
}

// ── Plot info / ownership section ─────────────────────────────────────────────
function PlotInfoSection({ plot, editing, onEdit, onSave, onCancel, derivedStatus }) {
  const [draft, setDraft] = useState(plot)
  const set = (f, v) => setDraft(p => ({ ...p, [f]: v }))

  const handleSave  = () => onSave(draft)
  const handleCancel = () => { setDraft(plot); onCancel() }

  const fv = (field) => ({
    color: !editing && isEdited(draft, field) ? EDITED_COLOR : NORMAL_COLOR
  })

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className={styles.sectionTitle} style={{ margin: 0 }}>Plot &amp; Ownership</div>
        {!editing && (
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={onEdit}>Edit</button>
        )}
      </div>

      <Grid>
        <F label="Lot Type">
          {editing ? <Sel value={draft.lotType} options={LOT_TYPES} onChange={v => set('lotType', v)} />
            : <span style={fv('lotType')}>{draft.lotType || <Em />}</span>}
        </F>
        <F label="Status Override">
          {editing
            ? <Sel value={draft.statusOverride ?? ''} options={['', ...STATUSES]}
                onChange={v => set('statusOverride', v || null)} allowEmpty emptyLabel="Auto" />
            : draft.statusOverride
              ? <StatusBadge status={draft.statusOverride} small />
              : <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Auto ({derivedStatus})</span>
          }
        </F>
        <F label="Marker Type">
          {editing ? <Sel value={draft.markerType} options={MARKER_TYPES} onChange={v => set('markerType', v)} allowEmpty />
            : <span style={fv('markerType')}>{draft.markerType || <Em />}</span>}
        </F>
        <F label="Purchase Price">
          {editing ? <In value={draft.purchasePrice} onChange={v => set('purchasePrice', v)} />
            : <span style={fv('purchasePrice')}>{draft.purchasePrice || <Em />}</span>}
        </F>
        <F label="Purchaser Last">
          {editing ? <In value={draft.purchaserLastName} onChange={v => set('purchaserLastName', v)} />
            : <span style={fv('purchaserLastName')}>{draft.purchaserLastName || <Em />}</span>}
        </F>
        <F label="Purchaser First">
          {editing ? <In value={draft.purchaserFirstName} onChange={v => set('purchaserFirstName', v)} />
            : <span style={fv('purchaserFirstName')}>{draft.purchaserFirstName || <Em />}</span>}
        </F>
        <F label="Owner Phone">
          {editing ? <In value={draft.ownerPhone} onChange={v => set('ownerPhone', v)} />
            : <span style={fv('ownerPhone')}>{draft.ownerPhone || <Em />}</span>}
        </F>
        <F label="Purchase Date">
          {editing ? <In value={draft.purchaseDate} onChange={v => set('purchaseDate', v)} />
            : <span style={fv('purchaseDate')}>{draft.purchaseDate || <Em />}</span>}
        </F>
        <F label="Address" full>
          {editing ? <In value={draft.purchaserAddress} onChange={v => set('purchaserAddress', v)} />
            : <span style={fv('purchaserAddress')}>{draft.purchaserAddress || <Em />}</span>}
        </F>
      </Grid>

      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>
          Remarks
        </div>
        {editing
          ? <textarea className="field-input" rows={3} value={draft.remarks}
              onChange={e => set('remarks', e.target.value)} placeholder="Notes..." />
          : <div style={{ fontSize: 14, lineHeight: 1.6, color: draft.remarks ? (isEdited(draft,'remarks') ? EDITED_COLOR : NORMAL_COLOR) : 'var(--text-muted)', fontStyle: draft.remarks ? 'normal':'italic' }}>
              {draft.remarks || 'No remarks.'}
            </div>
        }
      </div>

      {editing && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSave}>Save Plot Info</button>
          <button className="btn btn-ghost" onClick={handleCancel}>Cancel</button>
        </div>
      )}
    </div>
  )
}

// ── Individual internment detail + edit ───────────────────────────────────────
function InternmentDetail({ plot, internment: initInt, isNew, onBack, onSave, onDelete, onReloadFromTCK }) {
  const [int,     setInt]     = useState(initInt)
  const [editing, setEditing] = useState(isNew)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = (f, v) => setInt(p => ({ ...p, [f]: v }))

  const fv = (field) => ({
    color: !editing && isEdited(int, field) ? EDITED_COLOR : NORMAL_COLOR
  })

  const name = [int.interredFirstName, int.interredLastName].filter(Boolean).join(' ') || 'New Internment'

  const handleSave = () => {
    const changes = diffFields(int._original ?? {}, int, INTERNMENT_TRACKED_FIELDS)
    const saved = int._original ? int : { ...int, _original: { ...int } }
    setInt(saved)      // update local state with saved version
    setEditing(false)  // exit edit mode so it's clear the save happened
    onSave(saved, changes)
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '6px 12px', fontSize: 13 }}>← Plot</button>
        <div className={styles.headerTitle}>
          <div className={styles.titleName}>{name}</div>
          <div className={styles.titleSub}>
            {plot.cemetery} · {plot.section} · Lot {plot.lot}, Grave <span style={{ color: 'var(--accent)' }}>{int.graveLabel}</span>
          </div>
        </div>
        {int.isCremains === 'Yes' && (
          <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: 'rgba(0,212,200,0.1)', border: '1px solid rgba(0,212,200,0.2)', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
            Cremains
          </span>
        )}
      </div>

      <div className={styles.body}>
        <Section title="Identification">
          <Grid>
            <F label="Grave Label">
              {editing ? <In value={int.graveLabel} onChange={v => set('graveLabel', v)} />
                : <Mono style={fv('graveLabel')}>{int.graveLabel}</Mono>}
            </F>
            <F label="Internment #">
              {editing ? <In value={int.internmentNumber} onChange={v => set('internmentNumber', v)} />
                : <Mono style={fv('internmentNumber')}>{int.internmentNumber || <Em />}</Mono>}
            </F>
            <F label="Is Cremains">
              {editing ? <Sel value={int.isCremains} options={['No','Yes']} onChange={v => set('isCremains', v)} />
                : <span style={fv('isCremains')}>{int.isCremains || <Em />}</span>}
            </F>
            <F label="Interred Date">
              {editing ? <In value={int.interredDate} onChange={v => set('interredDate', v)} placeholder="MM/DD/YYYY" />
                : <span style={fv('interredDate')}>{int.interredDate || <Em />}</span>}
            </F>
            <F label="Burial Position">
              {editing ? <Sel value={int.burialPosition} options={BURIAL_POSITIONS} onChange={v => set('burialPosition', v)} allowEmpty />
                : <span style={fv('burialPosition')}>{int.burialPosition || <Em />}</span>}
            </F>
            <F label="Undertaker">
              {editing ? <Sel value={int.undertaker} options={UNDERTAKERS} onChange={v => set('undertaker', v)} allowEmpty />
                : <span style={fv('undertaker')}>{int.undertaker || <Em />}</span>}
            </F>
          </Grid>
        </Section>

        <Section title="Person">
          <Grid>
            <F label="Last Name">
              {editing ? <In value={int.interredLastName} onChange={v => set('interredLastName', v)} />
                : <span style={fv('interredLastName')}>{int.interredLastName || <Em />}</span>}
            </F>
            <F label="First Name">
              {editing ? <In value={int.interredFirstName} onChange={v => set('interredFirstName', v)} />
                : <span style={fv('interredFirstName')}>{int.interredFirstName || <Em />}</span>}
            </F>
            <F label="Birth Date">
              {editing ? <In value={int.birthDate} onChange={v => set('birthDate', v)} placeholder="MM/DD/YYYY" />
                : <span style={fv('birthDate')}>{int.birthDate || <Em />}</span>}
            </F>
            <F label="Death Date">
              {editing ? <In value={int.deathDate} onChange={v => set('deathDate', v)} placeholder="MM/DD/YYYY" />
                : <span style={fv('deathDate')}>{int.deathDate || <Em />}</span>}
            </F>
            <F label="Age">
              {editing ? <In value={int.age} onChange={v => set('age', v)} />
                : <span style={fv('age')}>{int.age || <Em />}</span>}
            </F>
            <F label="Gender">
              {editing ? <Sel value={int.gender} options={GENDERS} onChange={v => set('gender', v)} allowEmpty />
                : <span style={fv('gender')}>{int.gender || <Em />}</span>}
            </F>
            <F label="Birth Place">
              {editing ? <In value={int.birthPlace} onChange={v => set('birthPlace', v)} />
                : <span style={fv('birthPlace')}>{int.birthPlace || <Em />}</span>}
            </F>
            <F label="Late Residence">
              {editing ? <In value={int.lateResidence} onChange={v => set('lateResidence', v)} />
                : <span style={fv('lateResidence')}>{int.lateResidence || <Em />}</span>}
            </F>
            <F label="Veteran">
              {editing
                ? <Sel value={int.veteran} options={['', ...VETERAN_BRANCHES]} onChange={v => set('veteran', v)} allowEmpty emptyLabel="No" />
                : <span style={int.veteran ? { color: isEdited(int,'veteran') ? EDITED_COLOR : '#fcd34d' } : { color: 'var(--text-secondary)', fontSize: 13 }}>
                    {int.veteran || 'No'}
                  </span>
              }
            </F>
            <F label="Cause of Death">
              {editing ? <Sel value={int.causeOfDeath} options={CAUSES} onChange={v => set('causeOfDeath', v)} allowEmpty />
                : <span style={fv('causeOfDeath')}>{int.causeOfDeath || <Em />}</span>}
            </F>
            <F label="Nearest Relative" full>
              {editing ? <In value={int.nearestRelative} onChange={v => set('nearestRelative', v)} />
                : <span style={fv('nearestRelative')}>{int.nearestRelative || <Em />}</span>}
            </F>
          </Grid>
        </Section>

        <Section title="Notes">
          {editing
            ? <textarea className="field-input" rows={4} value={int.remarks}
                onChange={e => set('remarks', e.target.value)} placeholder="Add notes about this internment..." />
            : <div style={{ fontSize: 14, lineHeight: 1.65, color: int.remarks ? (isEdited(int,'remarks') ? EDITED_COLOR : NORMAL_COLOR) : 'var(--text-muted)', fontStyle: int.remarks ? 'normal' : 'italic' }}>
                {int.remarks || 'No notes.'}
              </div>
          }
        </Section>

        {!isNew && !editing && !confirmDelete && (
          <div style={{ marginTop: 8 }}>
            <button className="btn btn-danger" style={{ fontSize: 12 }} onClick={() => setConfirmDelete(true)}>
              Delete this internment record
            </button>
          </div>
        )}
        {confirmDelete && (
          <div style={{ marginTop: 12, padding: '12px 14px', background: '#1a0808', border: '1px solid #7f1d1d', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: 13, color: '#f87171', marginBottom: 10 }}>Delete this internment record? This cannot be undone.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-danger" onClick={() => onDelete(int.id)}>Yes, delete</button>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        {editing ? (
          <>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSave}>
              Save
            </button>
            <button className="btn btn-ghost" onClick={() => { if (isNew) onBack(); else setEditing(false) }}>Cancel</button>
          </>
        ) : (
          <>
            <button className="btn btn-primary" onClick={() => setEditing(true)} style={{ minWidth: 130, justifyContent: 'center' }}>
              Edit Record
            </button>
            {onReloadFromTCK && !isNew && (
              <button className="btn btn-ghost" onClick={onReloadFromTCK}
                style={{ fontSize: 12, color: '#f87171', borderColor: '#7f3a3a' }}
                title="Discard all edits and restore original TCK import data">
                ↺ Reload from TCK
              </button>
            )}
            <button className="btn btn-ghost" onClick={onBack}>← Back</button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--accent-dim)', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)', fontWeight: 500 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Grid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>{children}</div>
}

function F({ label, children, full }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--bg-surface)', gridColumn: full ? '1 / -1' : undefined }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{children}</div>
    </div>
  )
}

const Em   = () => <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>—</span>
const Mono = ({ children, style }) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, ...style }}>{children}</span>

function In({ value, onChange, placeholder }) {
  return <input className="field-input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
}

function Sel({ value, options, onChange, allowEmpty, emptyLabel = '—' }) {
  return (
    <select className="field-input" value={value} onChange={e => onChange(e.target.value)}>
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
