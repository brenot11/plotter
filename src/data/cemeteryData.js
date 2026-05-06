// ── Constants ────────────────────────────────────────────────────────────────

export const CEMETERIES = ['Crawford', 'Riverside', 'Oak Hill', 'Maple Grove']

export const SECTIONS = {
  Crawford:     ['Crawford North', 'Crawford South', 'Crawford East', 'Crawford West'],
  Riverside:    ['Riverside Main', 'Riverside Upper', 'Riverside Lower'],
  'Oak Hill':   ['Oak Hill A', 'Oak Hill B', 'Oak Hill C'],
  'Maple Grove':['Maple Grove Old', 'Maple Grove New', 'Maple Grove Veterans'],
}

export const CEMETERY_CONFIG = {
  Crawford:      { rows: 12, cols: 65 },
  Riverside:     { rows: 14, cols: 70 },
  'Oak Hill':    { rows: 11, cols: 58 },
  'Maple Grove': { rows: 13, cols: 62 },
}

export const STATUSES = ['occupied', 'available', 'sold', 'unavailable']

export const STATUS_META = {
  occupied:    { label: 'Occupied',    color: '#3b82f6', bg: '#0d1a35', text: '#93c5fd' },
  available:   { label: 'Available',   color: '#10b981', bg: '#042b1e', text: '#6ee7b7' },
  sold:        { label: 'Sold',        color: '#8b5cf6', bg: '#1a0d35', text: '#c4b5fd' },
  unavailable: { label: 'Unavailable', color: '#374151', bg: '#111318', text: '#4b5563' },
}

// MAP_PLOT: canvas-specific colors — dark and restrained, easy on the eyes.
export const MAP_PLOT = {
  occupied:    { fill: '#1a2133', stroke: '#2e4872', strokeWidth: 1.5 },
  available:   { fill: '#0d2118', stroke: '#1a5c35', strokeWidth: 1.2 },
  sold:        { fill: '#1e1428', stroke: '#4a2d7a', strokeWidth: 1.2 },
  unavailable: { fill: '#0e0f12', stroke: null,      strokeWidth: 0   },
}

export const LOT_TYPES        = ['Standard 4x8', 'Infant 3x3', 'Double 4x10', 'Veterans 4x8', 'Cremains 2x2']
export const MARKER_TYPES     = ['Granite Flat', 'Granite Upright', 'Marble Upright', 'Bronze Flat', 'Concrete', 'Fieldstone', 'None']
export const UNDERTAKERS      = ['McAllister Funeral Home', 'Valley Rest Mortuary', 'Hillside Chapel', 'Greenview Funeral Services']
export const CAUSES           = ['Natural causes', 'Heart disease', 'Cancer', 'Pneumonia', 'Stroke', 'Accident']
export const VETERAN_BRANCHES = ['Army', 'Navy', 'Air Force', 'Marines', 'Coast Guard']
export const GENDERS          = ['Male', 'Female', 'Unknown']
export const BURIAL_POSITIONS = ['Head West', 'Head East', 'Standard']

// ── Status derivation ────────────────────────────────────────────────────────
// statusOverride = null means auto-derive from data.
//
// Occupied  — any internment has interredDate OR deathDate present
// Sold      — internment has a name but neither interredDate nor deathDate,
//             AND purchase year >= 1970 (older records treated as occupied
//             since missing dates are unreliable, not meaningful)
// Available — no internments and no purchaser
// Unavailable — statusOverride only

function isPurchaseModern(plot) {
  // Use purchase date year to determine if "modern" (>= 1970)
  if (!plot.purchaseDate) return false
  const year = parseInt(plot.purchaseDate.split('/')[2])
  return !isNaN(year) && year >= 1970
}

export function derivePlotStatus(plot) {
  if (plot.statusOverride) return plot.statusOverride

  if (plot.internments && plot.internments.length > 0) {
    // Check each internment — if any has interredDate OR deathDate, it's occupied
    const hasConfirmedBurial = plot.internments.some(i =>
      (i.interredDate && i.interredDate.trim()) ||
      (i.deathDate    && i.deathDate.trim())
    )
    if (hasConfirmedBurial) return 'occupied'

    // All internments have names but no dates — sold if modern purchase
    if (isPurchaseModern(plot)) return 'sold'

    // Old record with missing dates — treat as occupied
    return 'occupied'
  }

  if (plot.purchaserLastName || plot.purchaserFirstName) return 'sold'
  return 'available'
}

// ── Internment factory ───────────────────────────────────────────────────────

export function makeEmptyInternment(plotId, graveLabel) {
  return {
    id: `${plotId}_int_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    graveLabel,
    internmentNumber:  '',
    interredDate:      '',
    isCremains:        'No',
    interredLastName:  '',
    interredFirstName: '',
    birthDate:         '',
    deathDate:         '',
    age:               '',
    gender:            '',
    veteran:           '',
    birthPlace:        '',
    lateResidence:     '',
    undertaker:        '',
    causeOfDeath:      '',
    nearestRelative:   '',
    burialPosition:    '',
    markerType:        '',
    markerNotes:       '',
    remarks:           '',
  }
}

// ── Seed data ────────────────────────────────────────────────────────────────

const FIRST = ['James','Mary','John','Patricia','Robert','Jennifer','Michael','Linda','William','Barbara','David','Susan','Richard','Dorothy','Joseph','Jessica','Thomas','Sarah','Charles','Karen','Christopher','Lisa','Daniel','Nancy','Matthew','Betty','Anthony','Margaret','Mark','Sandra','Donald','Ashley','Paul','Ruth','Steven','Kimberly','Andrew','Emily','Kenneth','Donna','Harold','Carol','George','Sharon','Larry','Michelle','Edward','Deborah','Eugene','Helen','Walter','Frances','Raymond','Gloria','Roy','Ann','Arthur','Teresa','Albert','Doris']
const LAST  = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Wilson','Anderson','Taylor','Thomas','Jackson','White','Harris','Martin','Thompson','Young','Lee','Walker','Hall','Allen','Wright','Scott','Green','Baker','Adams','Nelson','Carter','Mitchell','Roberts','Turner','Phillips','Campbell','Parker','Evans','Edwards','Collins','Stewart','Morris','Rogers','Reed','Cook','Bell','Cooper','Richardson','Cox','Howard','Ward','Torres']
const TOWNS = ['Springfield','Riverside','Oakdale','Maplewood','Cedarville','Millbrook','Harborview','Elmwood','Fairview','Greenfield']
const STREETS = ['Elm','Oak','Maple','Pine','Cedar','Main','Church','Mill','Ridge','Valley','Hillside','Meadow']
const STREET_TYPES = ['St','Ave','Rd','Ln','Dr','Way','Blvd']

const rnd    = arr => arr[Math.floor(Math.random() * arr.length)]
const rndInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a
const rndDate = y => `${String(rndInt(1,12)).padStart(2,'0')}/${String(rndInt(1,28)).padStart(2,'0')}/${y}`

let _seq = 1

function seedInternment(plotId, graveLabel, cremains = false) {
  const first  = rnd(FIRST)
  const last   = rnd(LAST)
  const birthY = rndInt(1890, 1975)
  const deathY = rndInt(birthY + 35, Math.min(birthY + 98, 2023))
  return {
    id: `${plotId}_int_${_seq++}`,
    graveLabel,
    internmentNumber:  `${plotId.substring(0,2).toUpperCase()}-${String(_seq).padStart(4,'0')}`,
    interredDate:      rndDate(deathY),
    isCremains:        cremains ? 'Yes' : (Math.random() < 0.15 ? 'Yes' : 'No'),
    interredLastName:  last,
    interredFirstName: first,
    birthDate:         rndDate(birthY),
    deathDate:         rndDate(deathY),
    age:               String(deathY - birthY),
    gender:            Math.random() < 0.5 ? 'Male' : 'Female',
    veteran:           Math.random() < 0.13 ? rnd(VETERAN_BRANCHES) : '',
    birthPlace:        Math.random() < 0.7  ? rnd(['Ohio','Indiana','Kentucky','Tennessee','Virginia','Pennsylvania','West Virginia','North Carolina','Missouri']) : '',
    lateResidence:     Math.random() < 0.6  ? rnd(TOWNS) : '',
    undertaker:        Math.random() < 0.8  ? rnd(UNDERTAKERS) : '',
    causeOfDeath:      Math.random() < 0.7  ? rnd(CAUSES) : '',
    nearestRelative:   `${rnd(FIRST)} ${last}`,
    burialPosition:    rnd(BURIAL_POSITIONS),
    remarks:           '',
  }
}

function makePlot(cemetery, section, lot, grave) {
  const id   = `${cemetery.replace(/\s/g,'_')}_${section.replace(/\s/g,'_')}_L${lot}_G${grave}`
  const roll = Math.random()

  const hasInternment = roll < 0.52
  const hasPurchaser  = roll < 0.90 && roll >= 0.12
  const isReserved    = roll >= 0.52 && roll < 0.62
  const isUnavailable = roll >= 0.90

  const internments = []
  if (hasInternment) {
    // Primary burial in base grave (e.g. "15")
    internments.push(seedInternment(id, String(grave), false))
    // ~12% chance of a second cremains internment ("15A")
    if (Math.random() < 0.12) {
      internments.push(seedInternment(id, `${grave}A`, true))
    }
  }

  const purchFirst = hasPurchaser ? rnd(FIRST) : ''
  const purchLast  = hasPurchaser ? rnd(LAST)  : ''

  let statusOverride = null
  if (isReserved)    statusOverride = 'reserved'
  if (isUnavailable) statusOverride = 'unavailable'

  return {
    id, cemetery, section, lot, grave,
    lotType:    rnd(LOT_TYPES),
    statusOverride,
    markerType: hasInternment ? rnd(MARKER_TYPES) : '',
    purchaserLastName:  purchLast,
    purchaserFirstName: purchFirst,
    purchaserAddress:   hasPurchaser ? `${rndInt(100,9999)} ${rnd(STREETS)} ${rnd(STREET_TYPES)}, ${rnd(TOWNS)}` : '',
    ownerPhone:         hasPurchaser ? `(${rndInt(200,999)}) ${rndInt(200,999)}-${rndInt(1000,9999)}` : '',
    purchaseDate:       hasPurchaser ? rndDate(rndInt(1950, 2020)) : '',
    purchasePrice:      hasPurchaser ? `$${rndInt(200, 2800)}` : '',
    remarks: '',
    photos:  [],
    internments,
  }
}

export function generateAllData() {
  const data = {}
  for (const cem of CEMETERIES) {
    data[cem] = {}
    const cfg = CEMETERY_CONFIG[cem]
    for (const sec of SECTIONS[cem]) {
      const plots = []
      for (let lot = 1; lot <= cfg.rows; lot++) {
        for (let grave = 1; grave <= cfg.cols; grave++) {
          plots.push(makePlot(cem, sec, lot, grave))
        }
      }
      data[cem][sec] = plots
    }
  }
  return data
}

// ── Storage — IndexedDB (handles large datasets, 50MB+) ──────────────────────

const DB_NAME    = 'plotter_db'
const DB_VERSION = 1
const STORE_NAME = 'app_data'
const DATA_KEY   = 'cemetery_data'

function openDB() {
  return new Promise((resolve, reject) => {
    console.log('[Plotter] Opening IndexedDB...')
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      console.log('[Plotter] Creating IndexedDB store...')
      e.target.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = e => {
      console.log('[Plotter] IndexedDB opened successfully')
      resolve(e.target.result)
    }
    req.onerror = e => {
      console.error('[Plotter] IndexedDB open error:', e.target.error)
      reject(e.target.error)
    }
  })
}

export async function saveData(data) {
  try {
    const db    = await openDB()
    const tx    = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put(data, DATA_KEY)
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => { console.log('[Plotter] Data saved to IndexedDB'); resolve() }
      tx.onerror    = e => { console.error('[Plotter] Save error:', e.target.error); reject(e.target.error) }
    })
  } catch (e) {
    console.error('[Plotter] Failed to save data to IndexedDB:', e)
  }
}

export async function loadData() {
  try {
    console.log('[Plotter] Loading data from IndexedDB...')
    const db    = await openDB()
    const tx    = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req   = store.get(DATA_KEY)
    const data  = await new Promise((resolve, reject) => {
      req.onsuccess = e => resolve(e.target.result)
      req.onerror   = e => reject(e.target.error)
    })
    if (data) {
      console.log('[Plotter] Data loaded from IndexedDB successfully')
      return data
    }
    console.log('[Plotter] No saved data found, using seed data')
  } catch (e) {
    console.error('[Plotter] Failed to load data from IndexedDB:', e)
  }
  return generateAllData()
}

export async function clearData() {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(DATA_KEY)
  } catch (e) {
    console.error('[Plotter] Failed to clear data:', e)
  }
}
