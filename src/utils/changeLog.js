// ── Change Log ────────────────────────────────────────────────────────────────
//
// Tracks all edits made in the app so she can manually enter them into TCK.
// One entry per save session per internment or plot.
//
// Entry shape:
// {
//   id:          string (unique)
//   timestamp:   ISO string
//   cemetery:    string
//   section:     string
//   lot:         number
//   grave:       number
//   displayName: string  e.g. "John Smith · Highland · Lot 1, Grave 4"
//   target:      'internment' | 'plot'
//   internmentId: string | null
//   changes: [{ field, label, newValue }]
//   committed:   boolean
// }

const STORAGE_KEY = 'plotter_changelog_v1'

export function loadChangeLog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {}
  return []
}

export function saveChangeLog(log) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log))
  } catch (e) {
    console.warn('Failed to save change log', e)
  }
}

export function upsertChangeLogEntry(log, entry) {
  // Check if an uncommitted entry already exists for this plot/internment
  const existingIdx = log.findIndex(e =>
    !e.committed &&
    e.plotId === entry.plotId &&
    e.internmentId === entry.internmentId
  )

  let next
  if (existingIdx >= 0) {
    // Update existing entry — merge changes, update timestamp
    next = [...log]
    next[existingIdx] = {
      ...next[existingIdx],
      ...entry,
      id:        next[existingIdx].id,   // keep original id
      timestamp: new Date().toISOString(),
      committed: false,
    }
  } else {
    // New entry
    next = [
      { ...entry, id: `chg_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, timestamp: new Date().toISOString(), committed: false },
      ...log,
    ]
  }
  saveChangeLog(next)
  return next
}

// Keep old name as alias for compatibility
export const addChangeLogEntry = upsertChangeLogEntry

export function clearCommittedEntries(log) {
  const next = log.filter(e => !e.committed)
  saveChangeLog(next)
  return next
}

export function commitChangeLogEntry(log, id) {
  const next = log.map(e => e.id === id ? { ...e, committed: true } : e)
  saveChangeLog(next)
  return next
}

export function revertChangeLogEntry(log, id) {
  // Revert just removes the entry — the caller is responsible for
  // restoring the field values back to _original in the data
  const next = log.filter(e => e.id !== id)
  saveChangeLog(next)
  return next
}

export function removeChangeLogEntry(log, id) {
  const next = log.filter(e => e.id !== id)
  saveChangeLog(next)
  return next
}

// ── Field label map — human-readable names for each field key ─────────────────

export const FIELD_LABELS = {
  // Internment fields
  interredLastName:  'Last Name',
  interredFirstName: 'First Name',
  birthDate:         'Birth Date',
  deathDate:         'Death Date',
  age:               'Age',
  gender:            'Gender',
  isCremains:        'Is Cremains',
  interredDate:      'Interred Date',
  internmentNumber:  'Internment #',
  veteran:           'Veteran',
  birthPlace:        'Birth Place',
  lateResidence:     'Late Residence',
  undertaker:        'Undertaker',
  causeOfDeath:      'Cause of Death',
  nearestRelative:   'Nearest Relative',
  burialPosition:    'Burial Position',
  graveLabel:        'Grave Label',
  remarks:           'Remarks',
  // Plot fields
  lotType:           'Lot Type',
  statusOverride:    'Status Override',
  markerType:        'Marker Type',
  purchaserLastName: 'Purchaser Last Name',
  purchaserFirstName:'Purchaser First Name',
  purchaserAddress:  'Purchaser Address',
  ownerPhone:        'Owner Phone',
  ownerEmail:        'Owner Email',
  purchaseDate:      'Purchase Date',
  purchasePrice:     'Purchase Price',
  plotRemarks:       'Plot Remarks',
}

// ── Diff two objects, return list of changed fields ───────────────────────────
// Compares current values against original (TCK-imported) values.

export function diffFields(original, current, fields) {
  const changes = []
  for (const field of fields) {
    const orig = (original[field] ?? '').toString().trim()
    const curr = (current[field]  ?? '').toString().trim()
    if (orig !== curr) {
      changes.push({
        field,
        label:    FIELD_LABELS[field] ?? field,
        newValue: curr,
      })
    }
  }
  return changes
}

// Fields we track for internments
export const INTERNMENT_TRACKED_FIELDS = [
  'interredLastName','interredFirstName','birthDate','deathDate','age',
  'gender','isCremains','interredDate','internmentNumber','veteran',
  'birthPlace','lateResidence','undertaker','causeOfDeath',
  'nearestRelative','burialPosition','graveLabel','remarks',
]

// Fields we track for plots
export const PLOT_TRACKED_FIELDS = [
  'lotType','statusOverride','markerType','purchaserLastName',
  'purchaserFirstName','purchaserAddress','ownerPhone','ownerEmail',
  'purchaseDate','purchasePrice','remarks',
]
