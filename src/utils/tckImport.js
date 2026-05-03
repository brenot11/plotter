// ── TCK Full Database Importer ────────────────────────────────────────────────
//
// Parses the raw tab-delimited files from The Crypt Keeper backup and
// builds the app's internal data structure.
//
// Files required:
//   Records.txt       — one row per internment (main data)
//   Purchasers.txt    — owner/purchaser contact info
//   Cemetery.txt      — cemetery IDs and names
//   Lots.txt          — lot type definitions
//   Maps.txt          — grid layout (row/col per plot)
//
// Usage:
//   import { parseTCKBackup } from './tckImport'
//   const appData = parseTCKBackup({ records, purchasers, cemetery, lots, maps })
//   // each value is the raw string content of that file

// ── Cemetery / Section mappings ───────────────────────────────────────────────

const CEMETERY_ID_TO_NAME = {
  140: 'Highland',
  141: 'Crawford',
  142: 'Crawford',
  143: 'Crawford',
  144: 'Lewisville',
  145: 'Lewisville',
  146: 'La Center',
  147: 'La Center',
  148: 'La Center',
  149: 'Crawford',   // Crawford Baby (alt ID)
  339: 'Crawford',   // Crawford Baby
}

const CEMETERY_ID_TO_SECTION = {
  140: 'Highland',
  141: 'Crawford East',
  142: 'Crawford Center',
  143: 'Crawford South',
  144: 'Lewisville North',
  145: 'Lewisville South',
  146: 'La Center East',
  147: 'La Center Center',
  148: 'La Center West',
  149: 'Crawford Baby',
  339: 'Crawford Baby',
}

// cSection codes within CemeteryID 147 (La Center Center) that map to sub-sections
const LA_CENTER_SUBSECTION = {
  'LC':  'La Center Center',
  'C':   'La Center Center',   // data entry error, treat as LC
  'LCN': 'La Center North',
  '7W':  'La Center Center',   // row variant, still LC
  'E':   'La Center East',
  'W':   'La Center West',
}

export const REAL_CEMETERIES = ['Highland', 'Crawford', 'Lewisville', 'La Center']

export const REAL_SECTIONS = {
  Highland:   ['Highland'],
  Crawford:   ['Crawford East', 'Crawford Center', 'Crawford South', 'Crawford Baby'],
  Lewisville: ['Lewisville North', 'Lewisville South'],
  'La Center':['La Center East', 'La Center Center', 'La Center North', 'La Center West'],
}

// ── Tab-delimited parser ──────────────────────────────────────────────────────

function parseTSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split('\t').map(h => h.trim())
  return lines.slice(1).map(line => {
    const vals = line.split('\t')
    const obj = {}
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').trim() })
    return obj
  })
}

// ── Date cleaner ──────────────────────────────────────────────────────────────

function cleanDate(raw) {
  if (!raw || raw === '0' || raw === '') return ''
  // TCK format: "8/26/2024 12:00:00 AM"
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!match) return ''
  return `${match[1].padStart(2,'0')}/${match[2].padStart(2,'0')}/${match[3]}`
}

// ── Price cleaner ─────────────────────────────────────────────────────────────

function cleanPrice(raw) {
  if (!raw || raw === '0' || raw === '0.0000') return ''
  const n = parseFloat(raw)
  if (isNaN(n) || n === 0) return ''
  return `$${n.toFixed(2).replace(/\.00$/, '')}`
}

// ── Veteran cleaner ───────────────────────────────────────────────────────────
// TCK Vault field has free text: "Army, WWII", "Navy", "Veteran?", etc.

function cleanVeteran(raw) {
  if (!raw || raw.trim() === '') return ''
  return raw.trim()
}

// ── Grave base extractor ──────────────────────────────────────────────────────
// "17A" -> base=17, suffix="A"
// "17"  -> base=17, suffix=""

function parseGrave(graveStr) {
  const s = String(graveStr).trim()
  const match = s.match(/^(\d+)([A-Za-z]*)$/)
  if (!match) return { base: 0, label: s }
  return { base: parseInt(match[1]), label: s }
}

// ── Main import function ──────────────────────────────────────────────────────

export function parseTCKBackup({ records, purchasers, cemetery, lots, maps }) {

  // 1. Parse all files
  const recordRows    = parseTSV(records)
  const purchaserRows = parseTSV(purchasers)
  const lotRows       = parseTSV(lots)
  const mapRows       = parseTSV(maps)

  // 2. Build lookup maps
  const purchaserMap = {}
  for (const p of purchaserRows) {
    purchaserMap[p.PurchaserID] = p
  }

  const lotMap = {}
  for (const l of lotRows) {
    lotMap[l.LotID] = `${l.LotDesc}${l.LotSize ? ' ' + l.LotSize : ''}`
  }

  // 3. Build Maps grid: cemId -> { "row_col": { gridId, gridColor } }
  //    Also build the actual grid dimensions per section
  const mapGrid = {}      // cemId -> Map of "row_col" -> gridId
  const mapDims = {}      // cemId -> { maxRow, maxCol }

  for (const m of mapRows) {
    const cemId = m.CemeteryID
    const row   = parseInt(m.MapRow)
    const col   = parseInt(m.MapCol)
    const color = m.GridColor
    const gridId = (m.GridID || '').trim()

    if (!mapGrid[cemId]) mapGrid[cemId] = {}
    if (!mapDims[cemId]) mapDims[cemId] = { maxRow: 0, maxCol: 0 }

    mapGrid[cemId][`${row}_${col}`] = { color, gridId }
    if (row > mapDims[cemId].maxRow) mapDims[cemId].maxRow = row
    if (col > mapDims[cemId].maxCol) mapDims[cemId].maxCol = col
  }

  // 4. Group records by cemetery+section+lot+graveBase -> internments[]
  //    Key: "cemName|sectionName|lot|graveBase"
  const plotMap = {}

  for (const rec of recordRows) {
    const cemId     = parseInt(rec.CemeteryID)
    const cemName   = CEMETERY_ID_TO_NAME[cemId]
    let   secName   = CEMETERY_ID_TO_SECTION[cemId]
    if (!cemName || !secName) continue

    // La Center Center (147) has multiple sub-sections identified by cSection code
    if (cemId === 147 && rec.cSection) {
      secName = LA_CENTER_SUBSECTION[rec.cSection] ?? 'La Center Center'
    }   // unknown cemetery, skip

    const lotNum    = parseInt(rec.Lot) || 0
    const { base: graveBase, label: graveLabel } = parseGrave(rec.Grave)
    const plotKey   = `${cemName}|${secName}|${lotNum}|${graveBase}`

    // Look up purchaser
    const purch = purchaserMap[rec.PurchaserID] || null

    // Build internment record
    const birthDate = cleanDate(rec.BirthDate)
    const deathDate = cleanDate(rec.DeathDate)
    let age = rec.Age && rec.Age !== '0' ? rec.Age : ''
    if (!age && birthDate && deathDate) {
      const by = parseInt(birthDate.split('/')[2])
      const dy = parseInt(deathDate.split('/')[2])
      if (!isNaN(by) && !isNaN(dy)) age = String(dy - by)
    }

    const internment = {
      id:                `tck_${rec.RecID}`,
      graveLabel,
      internmentNumber:  rec.InterNum || '',
      interredDate:      cleanDate(rec.InterDate),
      isCremains:        rec.IsCremains === 'True' ? 'Yes' : 'No',
      interredLastName:  rec.InterLastName || '',
      interredFirstName: rec.InterFirstName || '',
      birthDate,
      deathDate,
      age,
      gender:            rec.Sex === 'M' ? 'Male' : rec.Sex === 'F' ? 'Female' : '',
      veteran:           cleanVeteran(rec.Vault),
      birthPlace:        rec.BirthPlace || '',
      lateResidence:     rec.LateReside || '',
      undertaker:        rec.Undertaker || '',
      causeOfDeath:      rec.DeathCause || '',
      nearestRelative:   rec.NearestRelative || '',
      burialPosition:    '',   // comes from CustomFieldsData — add later
      markerType:        rec.SocialState || '',
      markerNotes:       '',
      remarks:           rec.Remarks || '',
      // Extra TCK fields preserved for reference
      _tckRecID:         rec.RecID,
      _tckFamilyID:      rec.FamilyID || '',
      _tckSaveID:        rec.SaveID || '',
      _tckStatus:        rec.Status || '',
      _tckDeedBook:      rec.DeedBook || '',
      _tckDeedPage:      rec.DeedPage || '',
      _tckCertNum:       rec.CertNum || '',
      _tckSocialState:   rec.SocialState || '',
      _tckBurialFee:     cleanPrice(rec.BurialFee),
      _tckAmtPaid:       cleanPrice(rec.AmtPaid),
    }

    if (!plotMap[plotKey]) {
      // First internment for this plot — create the plot shell
      plotMap[plotKey] = {
        id:          `${cemName.replace(/\s/g,'_')}_${secName.replace(/\s/g,'_')}_L${lotNum}_G${graveBase}`,
        cemetery:    cemName,
        section:     secName,
        lot:         lotNum,
        grave:       graveBase,
        lotType:     lotMap[rec.LotID] || '',
        statusOverride: null,
        purchaserLastName:  purch?.OwnerLastName  || '',
        purchaserFirstName: purch?.OwnerFirstName || '',
        purchaserAddress:   [purch?.OwnerAddress1, purch?.OwnerAddress2].filter(Boolean).join(', ') || '',
        purchaserCity:      purch?.OwnerCity  || '',
        purchaserState:     purch?.OwnerState || '',
        purchaserZip:       purch?.OwnerZip   || '',
        ownerPhone:         purch?.OwnerPhone || '',
        ownerEmail:         purch?.OwnerEmail || '',
        purchaseDate:       cleanDate(rec.PurchDate),
        purchasePrice:      cleanPrice(rec.PurchPrice),
        remarks:            '',
        photos:             [],
        internments:        [],
        _tckCemeteryID:     cemId,
        _tckLotID:          rec.LotID,
      }
      // Stamp _original and _tckOriginal for change tracking
      const p = plotMap[plotKey]
      const plotSnap = {
        lotType:            p.lotType,
        statusOverride:     p.statusOverride,
        markerType:         p.markerType,
        purchaserLastName:  p.purchaserLastName,
        purchaserFirstName: p.purchaserFirstName,
        purchaserAddress:   p.purchaserAddress,
        ownerPhone:         p.ownerPhone,
        ownerEmail:         p.ownerEmail,
        purchaseDate:       p.purchaseDate,
        purchasePrice:      p.purchasePrice,
        remarks:            p.remarks,
      }
      p._original    = { ...plotSnap }  // updated on commit
      p._tckOriginal = { ...plotSnap }  // frozen forever
    } else {
      // Subsequent internment — update purchaser info if we now have it
      if (purch && !plotMap[plotKey].purchaserLastName) {
        plotMap[plotKey].purchaserLastName  = purch.OwnerLastName  || ''
        plotMap[plotKey].purchaserFirstName = purch.OwnerFirstName || ''
        plotMap[plotKey].purchaserAddress   = [purch?.OwnerAddress1, purch?.OwnerAddress2].filter(Boolean).join(', ') || ''
        plotMap[plotKey].purchaserCity      = purch?.OwnerCity  || ''
        plotMap[plotKey].purchaserState     = purch?.OwnerState || ''
        plotMap[plotKey].purchaserZip       = purch?.OwnerZip   || ''
        plotMap[plotKey].ownerPhone         = purch?.OwnerPhone || ''
        plotMap[plotKey].ownerEmail         = purch?.OwnerEmail || ''
        plotMap[plotKey].purchaseDate       = plotMap[plotKey].purchaseDate || cleanDate(rec.PurchDate)
        plotMap[plotKey].purchasePrice      = plotMap[plotKey].purchasePrice || cleanPrice(rec.PurchPrice)
      }
    }

    const hasInterred = !!(rec.InterLastName?.trim() || rec.InterFirstName?.trim())
    if (hasInterred) {
      const snap = {
        graveLabel:        internment.graveLabel,
        internmentNumber:  internment.internmentNumber,
        interredDate:      internment.interredDate,
        isCremains:        internment.isCremains,
        interredLastName:  internment.interredLastName,
        interredFirstName: internment.interredFirstName,
        birthDate:         internment.birthDate,
        deathDate:         internment.deathDate,
        age:               internment.age,
        gender:            internment.gender,
        veteran:           internment.veteran,
        birthPlace:        internment.birthPlace,
        lateResidence:     internment.lateResidence,
        undertaker:        internment.undertaker,
        causeOfDeath:      internment.causeOfDeath,
        nearestRelative:   internment.nearestRelative,
        burialPosition:    internment.burialPosition,
        markerType:        internment.markerType,
        markerNotes:       internment.markerNotes,
        remarks:           internment.remarks,
      }
      internment._original    = { ...snap }  // updated on commit
      internment._tckOriginal = { ...snap }  // frozen forever — raw TCK import
      plotMap[plotKey].internments.push(internment)
    }
  }

  // 5. Sort internments within each plot by graveLabel (15 < 15A < 15B)
  for (const plot of Object.values(plotMap)) {
    plot.internments.sort((a, b) =>
      a.graveLabel.localeCompare(b.graveLabel, undefined, { numeric: true })
    )
  }

  // 6. Build the Maps grid per section — used by MapCanvas for real layout
  //    Structure: { cemName: { secName: { rows, cols, cells: [{row,col,gridId,hasPlot}] } } }
  const sectionGrids = {}

  for (const [cemIdStr, grid] of Object.entries(mapGrid)) {
    const cemId   = parseInt(cemIdStr)
    const cemName = CEMETERY_ID_TO_NAME[cemId]
    const secName = CEMETERY_ID_TO_SECTION[cemId]
    if (!cemName || !secName) continue

    if (!sectionGrids[cemName]) sectionGrids[cemName] = {}

    const dims = mapDims[cemIdStr] || mapDims[cemId] || { maxRow: 0, maxCol: 0 }
    const cells = []

    for (const [key, cell] of Object.entries(grid)) {
      const [row, col] = key.split('_').map(Number)
      cells.push({ row, col, gridId: cell.gridId, color: cell.color, isPlot: cell.color === 'White' })
    }

    sectionGrids[cemName][secName] = {
      rows: dims.maxRow,
      cols: dims.maxCol,
      cells,
    }
  }

  // 7. Organise plots into the app data structure using Maps as source of truth.
  //    Every White cell in Maps is a real plot. If it has a matching Record it
  //    gets that data; if not, it's an available plot.
  const appData = {}
  for (const cem of REAL_CEMETERIES) {
    appData[cem] = {}
    for (const sec of REAL_SECTIONS[cem]) {
      appData[cem][sec] = []
    }
  }

  // Build a lookup from plotKey -> plot (from Records)
  // plotKey in Maps context: "cemName|secName|lot|grave" using GridID components
  const SECTION_CODE_TO_NAME = {
    'H':   { cem: 'Highland',   sec: 'Highland'          },
    'CE':  { cem: 'Crawford',   sec: 'Crawford East'      },
    'C':   { cem: 'Crawford',   sec: 'Crawford Center'    },
    'CC':  { cem: 'Crawford',   sec: 'Crawford Center'    },
    'CS':  { cem: 'Crawford',   sec: 'Crawford South'     },
    'CB':  { cem: 'Crawford',   sec: 'Crawford Baby'      },
    'N':   { cem: 'Lewisville', sec: 'Lewisville North'   },
    'S':   { cem: 'Lewisville', sec: 'Lewisville South'   },
    'E':   { cem: 'La Center',  sec: 'La Center East'     },
    'LC':  { cem: 'La Center',  sec: 'La Center Center'   },
    'LCN': { cem: 'La Center',  sec: 'La Center North'    },
    'W':   { cem: 'La Center',  sec: 'La Center West'     },
    '.':   null,  // placeholder cells
  }

  // Process every White cell in Maps
  for (const [cemIdStr, grid] of Object.entries(mapGrid)) {
    const cemId = parseInt(cemIdStr)

    for (const [posKey, cell] of Object.entries(grid)) {
      if (cell.color !== 'White' || !cell.gridId?.trim() || cell.gridId.startsWith('.')) continue

      const gridId = cell.gridId.trim()
      const parts  = gridId.split(',')
      if (parts.length !== 3) continue

      const [sectionCode, lotStr, graveStr] = parts
      const mapping = SECTION_CODE_TO_NAME[sectionCode]
      if (!mapping) continue

      const { cem: cemName, sec: secName } = mapping
      if (!appData[cemName]?.[secName]) continue

      const { base: graveBase, label: graveLabel } = parseGrave(graveStr)
      const lotNum  = parseInt(lotStr) || 0
      const plotKey = `${cemName}|${secName}|${lotNum}|${graveBase}`

      if (plotMap[plotKey]) {
        // Plot exists in Records — add to appData if not already there
        const sec = appData[cemName][secName]
        if (!sec.find(p => p.id === plotMap[plotKey].id)) {
          sec.push(plotMap[plotKey])
        }
      } else {
        // No matching Record — this is a genuinely available plot
        const [mapRow, mapCol] = posKey.split('_').map(Number)
        const availPlot = {
          id:          `${cemName.replace(/\s/g,'_')}_${secName.replace(/\s/g,'_')}_L${lotNum}_G${graveBase}`,
          cemetery:    cemName,
          section:     secName,
          lot:         lotNum,
          grave:       graveBase,
          lotType:     '',
          statusOverride: null,
          markerType:  '',
          purchaserLastName:  '',
          purchaserFirstName: '',
          purchaserAddress:   '',
          purchaserCity:      '',
          purchaserState:     '',
          purchaserZip:       '',
          ownerPhone:         '',
          ownerEmail:         '',
          purchaseDate:       '',
          purchasePrice:      '',
          remarks:            '',
          photos:             [],
          internments:        [],
          _mapRow: mapRow,
          _mapCol: mapCol,
        }
        appData[cemName][secName].push(availPlot)
        // Add to plotMap so duplicates don't get added
        plotMap[plotKey] = availPlot
      }
    }
  }

  // Also add any Records-based plots that didn't appear in Maps
  // (edge cases like LCN records that may not have Map entries)
  for (const plot of Object.values(plotMap)) {
    if (appData[plot.cemetery]?.[plot.section]) {
      const sec = appData[plot.cemetery][plot.section]
      if (!sec.find(p => p.id === plot.id)) {
        sec.push(plot)
      }
    }
  }

  // Sort plots within each section by lot then grave
  for (const cem of Object.values(appData)) {
    for (const sec of Object.values(cem)) {
      sec.sort((a, b) => a.lot !== b.lot ? a.lot - b.lot : a.grave - b.grave)
    }
  }

  return { appData, sectionGrids }
}

// ── Stats helper ──────────────────────────────────────────────────────────────

export function getTCKImportStats(appData) {
  let plots = 0, internments = 0, withPurchaser = 0, cremains = 0, veterans = 0
  for (const cem of Object.values(appData)) {
    for (const sec of Object.values(cem)) {
      for (const plot of sec) {
        plots++
        if (plot.purchaserLastName) withPurchaser++
        for (const int of plot.internments) {
          internments++
          if (int.isCremains === 'Yes') cremains++
          if (int.veteran) veterans++
        }
      }
    }
  }
  return { plots, internments, withPurchaser, cremains, veterans }
}
