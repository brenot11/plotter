// CSV import / export helpers

const CSV_HEADERS = [
  'Cemetery','Section','Lot','Grave','Lot Type','Internment Number','Status',
  'Interred Last Name','Interred First Name','Birth Date','Death Date','Age','Gender',
  'Is Cremains','Interred Date','Purchaser Last Name','Purchaser First Name',
  'Purchaser Address','Owner Phone','Purchase Date','Purchase Price',
  'Undertaker','Cause of Death','Veteran','Birth Place','Late Residence',
  'Marker Type','Nearest Relative','Burial Position','Remarks',
]

function escape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}

export function exportToCSV(allData) {
  const rows = [CSV_HEADERS.map(escape).join(',')]
  for (const sections of Object.values(allData)) {
    for (const plots of Object.values(sections)) {
      for (const p of plots) {
        rows.push([
          p.cemetery, p.section, p.lot, p.graveLabel, p.lotType, p.internmentNumber,
          p.status, p.interredLastName, p.interredFirstName, p.birthDate, p.deathDate,
          p.age, p.gender, p.isCremains, p.interredDate, p.purchaserLastName,
          p.purchaserFirstName, p.purchaserAddress, p.ownerPhone, p.purchaseDate,
          p.purchasePrice, p.undertaker, p.causeOfDeath, p.veteran, p.birthPlace,
          p.lateResidence, p.markerType, p.nearestRelative, p.burialPosition, p.remarks,
        ].map(escape).join(','))
      }
    }
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `cemetery_export_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Parse a raw CSV string into an array of objects keyed by header row
export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) throw new Error('CSV appears empty')

  const headers = splitCSVLine(lines[0]).map(h => h.trim().toLowerCase())
  const records = []

  for (let i = 1; i < lines.length; i++) {
    const vals = splitCSVLine(lines[i])
    const obj  = {}
    headers.forEach((h, idx) => { obj[h] = vals[idx] ?? '' })
    records.push(obj)
  }
  return records
}

function splitCSVLine(line) {
  const result = []
  let cur = '', inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      result.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

// Map a parsed CSV record (from TCK or our own export) onto a plot object.
// Column name aliases handle both our export headers and common TCK variants.
export function mapRecordToPlot(rec) {
  const g = (keys) => {
    for (const k of keys) {
      const val = rec[k.toLowerCase()]
      if (val !== undefined && val !== '') return val
    }
    return ''
  }

  return {
    cemetery:           g(['Cemetery']),
    section:            g(['Section']),
    lot:                parseInt(g(['Lot'])) || 0,
    graveLabel:         g(['Grave']),
    grave:              parseInt(g(['Grave'])) || 0,
    lotType:            g(['Lot Type','LotType','Type']),
    internmentNumber:   g(['Internment Number','InternmentNo','Internment#']),
    status:             g(['Status']).toLowerCase() || 'available',
    interredLastName:   g(['Interred Last Name','Last Name','InterredLast']),
    interredFirstName:  g(['Interred First Name','First Name','InterredFirst']),
    birthDate:          g(['Birth Date','BirthDate','DOB']),
    deathDate:          g(['Death Date','DeathDate','DOD']),
    age:                g(['Age']),
    gender:             g(['Gender','Sex']),
    isCremains:         g(['Is Cremains','Cremains','Cremation']),
    interredDate:       g(['Interred Date','InterredDate','BurialDate']),
    purchaserLastName:  g(['Purchaser Last Name','Purchaser Last','BuyerLast']),
    purchaserFirstName: g(['Purchaser First Name','Purchaser First','BuyerFirst']),
    purchaserAddress:   g(['Purchaser Address','Address']),
    ownerPhone:         g(['Owner Phone','Phone','OwnerPhone']),
    purchaseDate:       g(['Purchase Date','PurchaseDate']),
    purchasePrice:      g(['Purchase Price','Price']),
    undertaker:         g(['Undertaker','FuneralHome']),
    causeOfDeath:       g(['Cause of Death','CauseOfDeath','Cause']),
    veteran:            g(['Veteran','VeteranBranch']),
    birthPlace:         g(['Birth Place','BirthPlace']),
    lateResidence:      g(['Late Residence','LateResidence','Residence']),
    markerType:         g(['Marker Type','MarkerType','Marker']),
    nearestRelative:    g(['Nearest Relative','NextOfKin']),
    burialPosition:     g(['Burial Position','BurialPosition']),
    remarks:            g(['Remarks','Notes','Comments']),
    photos: [],
  }
}
