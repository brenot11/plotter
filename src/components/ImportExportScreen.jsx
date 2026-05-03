import { useRef, useState } from 'react'
import { exportToCSV } from '../utils/csvUtils'
import { parseTCKBackup, getTCKImportStats, REAL_CEMETERIES, REAL_SECTIONS } from '../utils/tckImport'
import styles from './ImportExportScreen.module.css'

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
  const fileRefs = useRef({})

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

  const handlePreview = () => {
    setLoading(true)
    setStatus(null)
    try {
      const result = parseTCKBackup({
        records:    files.records.content,
        purchasers: files.purchasers.content,
        cemetery:   files.cemetery?.content || '',
        lots:       files.lots.content,
        maps:       files.maps?.content || '',
      })
      const stats = getTCKImportStats(result.appData)
      setPreview({ result, stats })
      setStatus({ type: 'ok', msg: `Parsed successfully. Review the summary below before importing.` })
    } catch (err) {
      setStatus({ type: 'err', msg: `Parse error: ${err.message}` })
    }
    setLoading(false)
  }

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
        <div className={styles.card}>
          <div className={styles.cardTitle}>Import from Crypt Keeper Backup</div>
          <p className={styles.cardDesc}>
            Select the tab-delimited text files from your TCK backup zip. You need all five files below.
            The app will join them together and load all real cemetery data.
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

function StatBox({ label, value }) {
  return (
    <div className={styles.statBox}>
      <div className={styles.statBoxVal}>{value.toLocaleString()}</div>
      <div className={styles.statBoxLabel}>{label}</div>
    </div>
  )
}
