// ── Plot Flags ────────────────────────────────────────────────────────────────
//
// Field annotations attached to a PLOT (not an internment):
//   • blackstone — "this plot needs a blackstone ordered/placed"
//   • note       — a quick note jotted down in the field
//
// These are Plotter-only. The Crypt Keeper has no matching field, so unlike
// record edits they never appear in the Change List.
//
// Stored in localStorage, which is deliberate: a TCK reimport rewrites the
// cemetery data in IndexedDB but never touches localStorage, so flags survive
// automatically. Plot IDs are derived from cemetery/section/lot/grave, so they
// stay stable across reimports and keep pointing at the right plot.
//
// Shape:
// {
//   [plotId]: {
//     plotId, cemetery, section, lot, grave, displayName,
//     blackstone:     { ts } | null,
//     note:           { text, ts } | null,
//     statusOverride: 'unavailable' | null,
//   }
// }

const STORAGE_KEY = 'plotter_plot_flags'

export function loadPlotFlags() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.warn('[Plotter] Failed to load plot flags', e)
  }
  return {}
}

export function savePlotFlags(flags) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flags))
  } catch (e) {
    console.warn('[Plotter] Failed to save plot flags', e)
  }
}

// Human-readable label for list entries — primary interred name if there is one
export function plotDisplayName(plot) {
  const first = plot.internments?.[0]
  const name  = first
    ? [first.interredFirstName, first.interredLastName].filter(Boolean).join(' ')
    : ''
  const loc = `${plot.cemetery} · Lot ${plot.lot}, Grave ${plot.grave}`
  return name ? `${name} · ${loc}` : loc
}

// Base record for a plot, created on first flag
function baseEntry(flags, plot) {
  return flags[plot.id] ?? {
    plotId:      plot.id,
    cemetery:    plot.cemetery,
    section:     plot.section,
    lot:         plot.lot,
    grave:       plot.grave,
    displayName: plotDisplayName(plot),
    blackstone:     null,
    note:           null,
    statusOverride: null,
  }
}

// Drop the whole entry once nothing is flagged on it
function prune(flags, plotId) {
  const e = flags[plotId]
  if (e && !e.blackstone && !e.note && !e.statusOverride) delete flags[plotId]
  return flags
}

// ── Blackstone ────────────────────────────────────────────────────────────────

export function toggleBlackstone(flags, plot) {
  const next  = { ...flags }
  const entry = { ...baseEntry(next, plot) }
  entry.blackstone = entry.blackstone ? null : { ts: new Date().toISOString() }
  entry.displayName = plotDisplayName(plot)
  next[plot.id] = entry
  prune(next, plot.id)
  savePlotFlags(next)
  return next
}

export function clearBlackstone(flags, plotId) {
  const next = { ...flags }
  if (next[plotId]) {
    next[plotId] = { ...next[plotId], blackstone: null }
    prune(next, plotId)
  }
  savePlotFlags(next)
  return next
}

// ── Note ──────────────────────────────────────────────────────────────────────

export function setPlotNote(flags, plot, text) {
  const next  = { ...flags }
  const entry = { ...baseEntry(next, plot) }
  const clean = (text ?? '').trim()
  entry.note = clean ? { text: clean, ts: new Date().toISOString() } : null
  entry.displayName = plotDisplayName(plot)
  next[plot.id] = entry
  prune(next, plot.id)
  savePlotFlags(next)
  return next
}

export function clearNote(flags, plotId) {
  const next = { ...flags }
  if (next[plotId]) {
    next[plotId] = { ...next[plotId], note: null }
    prune(next, plotId)
  }
  savePlotFlags(next)
  return next
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function blackstoneEntries(flags) {
  return Object.values(flags)
    .filter(e => e.blackstone)
    .sort((a, b) => (b.blackstone.ts ?? '').localeCompare(a.blackstone.ts ?? ''))
}

export function noteEntries(flags) {
  return Object.values(flags)
    .filter(e => e.note)
    .sort((a, b) => (b.note.ts ?? '').localeCompare(a.note.ts ?? ''))
}

export function blackstonePlotIds(flags) {
  return new Set(Object.values(flags).filter(e => e.blackstone).map(e => e.plotId))
}

export function notePlotIds(flags) {
  return new Set(Object.values(flags).filter(e => e.note).map(e => e.plotId))
}


// ── Status override ───────────────────────────────────────────────────────────
// Kept here rather than on the plot record because TCK has no status field —
// an override is Plotter's own judgement and must outlive a reimport.

export function setPlotStatusOverride(flags, plot, status) {
  const next  = { ...flags }
  const entry = { ...baseEntry(next, plot) }
  entry.statusOverride = status || null
  entry.displayName    = plotDisplayName(plot)
  next[plot.id] = entry
  prune(next, plot.id)
  savePlotFlags(next)
  return next
}

export function statusOverrideMap(flags) {
  const m = {}
  for (const e of Object.values(flags)) {
    if (e.statusOverride) m[e.plotId] = e.statusOverride
  }
  return m
}

// Stamp saved overrides onto freshly loaded/imported plot data so that
// derivePlotStatus() keeps working from the plot object alone.
export function applyFlagsToData(data, flags) {
  const overrides = statusOverrideMap(flags)
  if (Object.keys(overrides).length === 0) return data

  for (const [cemName, sections] of Object.entries(data)) {
    if (cemName.startsWith('_') || typeof sections !== 'object' || Array.isArray(sections)) continue
    for (const plots of Object.values(sections)) {
      if (!Array.isArray(plots)) continue
      for (const plot of plots) {
        if (overrides[plot.id]) plot.statusOverride = overrides[plot.id]
      }
    }
  }
  return data
}

// ── General notes ─────────────────────────────────────────────────────────────
// Free-standing notes with no plot attached. Separate key, same rationale:
// localStorage survives a reimport.

const GENERAL_KEY = 'plotter_general_notes'

export function loadGeneralNotes() {
  try {
    const raw = localStorage.getItem(GENERAL_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.warn('[Plotter] Failed to load general notes', e)
  }
  return []
}

function saveGeneralNotes(notes) {
  try { localStorage.setItem(GENERAL_KEY, JSON.stringify(notes)) }
  catch (e) { console.warn('[Plotter] Failed to save general notes', e) }
}

export function addGeneralNote(notes, text) {
  const clean = (text ?? '').trim()
  if (!clean) return notes
  const next = [
    { id: `gn_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      text: clean, ts: new Date().toISOString() },
    ...notes,
  ]
  saveGeneralNotes(next)
  return next
}

export function updateGeneralNote(notes, id, text) {
  const clean = (text ?? '').trim()
  if (!clean) return removeGeneralNote(notes, id)
  const next = notes.map(n => n.id === id ? { ...n, text: clean } : n)
  saveGeneralNotes(next)
  return next
}

export function removeGeneralNote(notes, id) {
  const next = notes.filter(n => n.id !== id)
  saveGeneralNotes(next)
  return next
}
