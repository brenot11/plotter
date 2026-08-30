import { useRef, useState } from 'react'
import JSZip from 'jszip'
import { exportToCSV } from '../utils/csvUtils'
import { parseTCKBackup, getTCKImportStats, REAL_CEMETERIES, REAL_SECTIONS } from '../utils/tckImport'
import styles from './ImportExportScreen.module.css'

// Backup filenames carry a timestamp suffix (Records1320260830021955.txt),
// so files are matched on prefix rather than exact name.
const FILE_PREFIXES = {
  records:    'records',
  purchasers: 'purchasers',
  cemetery:   'cemetery',
  lots:       'lots',
  maps:       'maps',
}

// 'Purchasers' also prefixes PurchasersActivity, PurchasersInvoices etc.
// Longer, more specific names are tested first so they can be excluded.
const EXCLUDE_PREFIXES = [
  'purchasersactivity', 'purchasersinvoices',
  'purchasersinvoicesdetails', 'purchasersterms',
]

function matchFileKey(filename) {
  const base = filename.split('/').pop().toLowerCase()
  if (!base.endsWith('.txt')) return null
  if (EXCLUDE_PREFIXES.some(p => base.startsWith(p))) return null
  for (const [key, prefix] of Object.entries(FILE_PREFIXES)) {
    if (base.startsWith(prefix)) return key
  }
  return null
}

const REQUIRED_FILES = [
  { key: 'records',    label: 'Records',    hint: 'Records*.txt — main internment data' },
  { key: 'purchasers', label: 'Purchasers', hint: 'Purchasers*.txt — owner contact info' },
  { key: 'cemetery',   label: 'Cemetery',   hint: 'Cemetery*.txt — cemetery names' },
  { key: 'lots',       label: 'Lots',       hint: 'Lots*.txt — lot type definitions' },
  { key: 'maps',       label: 'Maps',       hint: 'Maps*.txt — grid layout' },
]

export default function ImportExportScreen({ onClose, allData, onImport }) {
  const [files,   setFiles]   = useState({})   // key -> file content string
  const [status,  setStatus]  = useState(null) // { type, msg }
  const [preview, setPreview] = useState(null) // stats before committing
  const [loading, setLoading] = useState(false)
  const [zipInfo, setZipInfo] = useState(null)   // { name, found[], skipped }
  const [dragOver, setDragOver] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const fileRefs = useRef({})
  const zipRef   = useRef(null)

  // ── Whole-backup zip ────────────────────────────────────────────────────
  // Only the five .txt files are decompressed; any photos in the archive are
  // listed but never read, so a photo-heavy backup costs nothing to import.
  const handleZip = async (file) => {
    if (!file) return
    setLoading(true)
    setStatus(null)
    setPreview(null)
    try {
      const zip     = await JSZip.loadAsync(file)
      const entries = Object.values(zip.files).filter(f => !f.dir)

      const picked = {}
      let skipped  = 0
      for (const entry of entries) {
        const key = matchFileKey(entry.name)
        if (key && !picked[key]) picked[key] = entry
        else skipped++
      }

      const missing = REQUIRED_FILES
        .filter(f => f.key !== 'cemetery' && !picked[f.key])
        .map(f => f.label)

      if (missing.length > 0) {
        setStatus({ type: 'err', msg:
          `That archive is missing: ${missing.join(', ')}. ` +
          `Make sure it's the full backup from The Crypt Keeper.` })
        setLoading(false)
        return
      }

      const loaded = {}
      for (const [key, entry] of Object.entries(picked)) {
        loaded[key] = { name: entry.name.split('/').pop(), content: await entry.async('string') }
      }

      setFiles(loaded)
      setZipInfo({
        name: file.name,
        found: Object.entries(loaded).map(([k, v]) => v.name),
        skipped,
      })
      setStatus({ type: 'ok', msg: 'Archive read. Checking the data…' })
      setTimeout(() => runPreview(loaded), 0)
    } catch (err) {
      setStatus({ type: 'err', msg:
        `Couldn't read that archive: ${err.message}. It should be the .zip downloaded from The Crypt Keeper.` })
      setLoading(false)
    }
  }

  const handleFileSelect = (key, file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      setFiles(prev => ({ ...prev, [key]: { name: file.name, content: e.target.result } }))
      setStatus(null)
      setPreview(null)
    }
    reader.readAsText(file)
  }

  const readyKeys   = Object.keys(files)
  const missingKeys = REQUIRED_FILES.filter(f => !files[f.key]).map(f => f.label)
  const allLoaded   = missingKeys.length === 0

  const runPreview = (src) => {
    setLoading(true)
    try {
      const result = parseTCKBackup({
        records:    src.records.content,
        purchasers: src.purchasers.content,
        cemetery:   src.cemetery?.content || '',
        lots:       src.lots.content,
        maps:       src.maps?.content || '',
      })
      const stats = getTCKImportStats(result.appData)
      setPreview({ result, stats })
      setStatus({ type: 'ok', msg: 'Data read successfully. Review the report below before importing.' })
    } catch (err) {
      setStatus({ type: 'err', msg: `Parse error: ${err.message}` })
    }
    setLoading(false)
  }

  const handlePreview = () => runPreview(files)

  const handleImport = () => {
    if (!preview) return
    const dataWithGrids = { ...preview.result.appData, _sectionGrids: preview.result.sectionGrids }
    onImport(dataWithGrids)
    setStatus({ type: 'ok', msg: 'Import complete! Real cemetery data is now loaded.' })
    setPreview(null)
    setFiles({})
  }

  const handleExport = () => {
    exportToCSV(allData)
    setStatus({ type: 'ok', msg: 'CSV exported successfully.' })
  }

  const handleJSONExport = () => {
    const json = JSON.stringify(allData)
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `cemetery_data_${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setStatus({ type: 'ok', msg: 'JSON snapshot exported. Load it in any device via "Load JSON Snapshot" below.' })
  }

  const jsonFileRef = useRef(null)
  const handleJSONImport = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result)
        onImport(data)
        setStatus({ type: 'ok', msg: 'JSON snapshot loaded successfully!' })
      } catch (err) {
        setStatus({ type: 'err', msg: `Failed to load JSON: ${err.message}` })
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 13, padding: '6px 12px' }}>← Back</button>
        <div className={styles.title}>Import / Export</div>
      </div>

      <div className={styles.body}>

        {status && (
          <div className={`${styles.alert} ${status.type === 'err' ? styles.alertErr : styles.alertOk}`}>
            {status.msg}
          </div>
        )}

        {/* ── JSON Snapshot ─────────────────────────────────────── */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>Device Sync — JSON Snapshot</div>
          <p className={styles.cardDesc}>
            Export a snapshot of all current data as a single JSON file, then load it
            on any other device to skip the TCK import step. Good for getting another
            tablet or phone up and running quickly.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleJSONExport}>
              Export JSON Snapshot
            </button>
            <button className="btn btn-ghost" onClick={() => jsonFileRef.current?.click()}>
              Load JSON Snapshot
            </button>
          </div>
          <input
            type="file" accept=".json"
            style={{ display: 'none' }}
            ref={jsonFileRef}
            onChange={e => handleJSONImport(e.target.files[0])}
          />
        </div>
        {/* ── Zip import — the normal path ──────────────────────── */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>Import from Crypt Keeper</div>
          <p className={styles.cardDesc}>
            Download the full backup from The Crypt Keeper and load the .zip here.
            Plotter pulls out the five data files it needs and ignores everything
            else in the archive, including photos.
          </p>

          <div
            className={`${styles.zipZone} ${dragOver ? styles.zipZoneOver : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault(); setDragOver(false)
              const f = e.dataTransfer.files?.[0]
              if (f) handleZip(f)
            }}
          >
            <button className="btn btn-primary" onClick={() => zipRef.current?.click()} disabled={loading}>
              {loading ? 'Reading…' : 'Choose backup file'}
            </button>
            <div className={styles.zipHint}>or drag the .zip here</div>
          </div>

          <input ref={zipRef} type="file" accept=".zip,application/zip"
            style={{ display: 'none' }} onChange={e => handleZip(e.target.files[0])} />

          {zipInfo && (
            <div className={styles.zipFound}>
              <div className={styles.zipFoundName}>{zipInfo.name}</div>
              <div className={styles.zipFoundList}>
                Found: {zipInfo.found.join(', ')}
                {zipInfo.skipped > 0 && (
                  <span className={styles.zipSkipped}>
                    {' '}· ignored {zipInfo.skipped} other file{zipInfo.skipped === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </div>
          )}

          <button className={styles.manualToggle} onClick={() => setShowManual(v => !v)}>
            {showManual ? 'Hide individual file picker' : 'Or choose the five files individually'}
          </button>
        </div>

        {/* ── Manual per-file pickers — fallback ─────────────────── */}
        {showManual && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Choose files individually</div>
          <p className={styles.cardDesc}>
            Only needed if the .zip won't load. Pick each of the five .txt files
            from the unpacked backup folder.
          </p>

          <div className={styles.fileGrid}>
            {REQUIRED_FILES.map(({ key, label, hint }) => (
              <div key={key} className={`${styles.fileSlot} ${files[key] ? styles.fileSlotDone : ''}`}>
                <div className={styles.fileSlotTop}>
                  <span className={styles.fileSlotCheck}>{files[key] ? '✓' : '○'}</span>
                  <span className={styles.fileSlotLabel}>{label}</span>
                </div>
                <div className={styles.fileSlotHint}>{files[key] ? files[key].name : hint}</div>
                <button
                  className={styles.fileSlotBtn}
                  onClick={() => fileRefs.current[key]?.click()}
                >
                  {files[key] ? 'Replace' : 'Select file'}
                </button>
                <input
                  type="file" accept=".txt,.csv,.tsv"
                  style={{ display: 'none' }}
                  ref={el => fileRefs.current[key] = el}
                  onChange={e => handleFileSelect(key, e.target.files[0])}
                />
              </div>
            ))}
          </div>

          {allLoaded && !preview && (
            <button
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={handlePreview}
              disabled={loading}
            >
              {loading ? 'Parsing...' : 'Preview Import'}
            </button>
          )}

          {!allLoaded && readyKeys.length > 0 && (
            <p className={styles.missingNote}>Still needed: {missingKeys.join(', ')}</p>
          )}
        </div>
        )}

        {/* ── Preview / confirm ────────────────────────────────── */}
        {preview && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>Import Preview</div>
            <div className={styles.statGrid}>
              <StatBox label="Total plots"       value={preview.stats.plots} />
              <StatBox label="Internments"       value={preview.stats.internments} />
              <StatBox label="With owner"        value={preview.stats.withPurchaser} />
              <StatBox label="Cremains"          value={preview.stats.cremains} />
              <StatBox label="Veterans"          value={preview.stats.veterans} />
            </div>

            <div className={styles.cemBreakdown}>
              {REAL_CEMETERIES.map(cem => (
                <div key={cem} className={styles.cemRow}>
                  <span className={styles.cemRowName}>{cem}</span>
                  {REAL_SECTIONS[cem].map(sec => {
                    const count = preview.result.appData[cem]?.[sec]?.length ?? 0
                    return (
                      <span key={sec} className={styles.cemRowSec}>
                        {sec.replace(cem + ' ', '').replace(cem, '')}
                        <strong>{count}</strong>
                      </span>
                    )
                  })}
                </div>
              ))}
            </div>

            {preview.result.diag && (
              <ImportReport diag={preview.result.diag} />
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-primary" onClick={handleImport}>
                Import Now
              </button>
              <button className="btn btn-ghost" onClick={() => setPreview(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Export ───────────────────────────────────────────── */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>Export to CSV</div>
          <p className={styles.cardDesc}>
            Export all current data as a CSV file compatible with The Crypt Keeper's import format.
          </p>
          <button className="btn btn-primary" onClick={handleExport}>Download CSV Export</button>
        </div>

      </div>
    </div>
  )
}

// Plain-language summary of what the import found, including anything odd.
function ImportReport({ diag }) {
  const c = diag.counts ?? {}
  const warnings = diag.warnings ?? []
  const problems = warnings.filter(w => w.level === 'warn')

  return (
    <div className={styles.report}>
      <div className={styles.reportHead}>What this import will do</div>

      <p className={styles.reportText}>
        Read <strong>{(c.recordRows ?? 0).toLocaleString()}</strong> burial records and{' '}
        <strong>{(c.mapRows ?? 0).toLocaleString()}</strong> map cells from The Crypt Keeper,
        and built <strong>{(c.plots ?? 0).toLocaleString()}</strong> plots holding{' '}
        <strong>{(c.internments ?? 0).toLocaleString()}</strong> internments, of which{' '}
        <strong>{(c.available ?? 0).toLocaleString()}</strong> are still open.
      </p>

      <p className={styles.reportText}>
        This replaces all record data. Marker photos, blackstone flags, notes and
        unavailable marks are stored separately and will be kept. Anything still
        pending in your Changes list stays there — but the fresh data becomes the
        new baseline, so those edits will no longer show as changed.
      </p>

      {problems.length === 0 ? (
        <div className={styles.reportClean}>✓ No problems found in the data</div>
      ) : (
        <div className={styles.reportIssues}>
          {problems.length} thing{problems.length === 1 ? '' : 's'} worth a look
        </div>
      )}

      {warnings.map((w, i) => (
        <div key={i} className={w.level === 'warn' ? styles.warnRow : styles.infoRow}>
          <div className={styles.warnTitle}>
            <span className={styles.warnIcon}>{w.level === 'warn' ? '!' : 'i'}</span>
            {w.title}
          </div>
          <div className={styles.warnDetail}>{w.detail}</div>
        </div>
      ))}
    </div>
  )
}

function StatBox({ label, value }) {
  return (
    <div className={styles.statBox}>
      <div className={styles.statBoxVal}>{value.toLocaleString()}</div>
      <div className={styles.statBoxLabel}>{label}</div>
    </div>
  )
}
