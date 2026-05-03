import { useState, useMemo, useEffect } from 'react'
import { CEMETERIES, SECTIONS, STATUS_META, derivePlotStatus, loadData, saveData, generateAllData } from './data/cemeteryData'
import { REAL_CEMETERIES, REAL_SECTIONS } from './utils/tckImport'
import { loadChangeLog, saveChangeLog, upsertChangeLogEntry, commitChangeLogEntry, revertChangeLogEntry, removeChangeLogEntry, clearCommittedEntries } from './utils/changeLog'
import MapCanvas          from './components/MapCanvas'
import PlotCard           from './components/PlotCard'
import DetailScreen       from './components/DetailScreen'
import ImportExportScreen from './components/ImportExportScreen'
import ChangeLogScreen    from './components/ChangeLogScreen'
import styles             from './App.module.css'

export default function App() {
  const [allData,       setAllData]       = useState(null)
  const [dataReady,     setDataReady]     = useState(false)
  const [changeLog,     setChangeLog]     = useState(() => clearCommittedEntries(loadChangeLog()))
  const [search,        setSearch]        = useState('')
  const [selectedPlot,  setSelectedPlot]  = useState(null)
  const [detailTarget,  setDetailTarget]  = useState(null)
  const [showImport,    setShowImport]    = useState(false)
  const [showChangeLog, setShowChangeLog] = useState(false)
  const [activeCem,     setActiveCem]     = useState(CEMETERIES[0])
  const [activeSection, setActiveSection] = useState(SECTIONS[CEMETERIES[0]][0])

  // Load data async from IndexedDB on mount
  useEffect(() => {
    loadData()
      .then(data => {
        console.log('[Plotter] App data ready, keys:', Object.keys(data).slice(0, 5))
        setAllData(data)
        // Switch to real cemetery names if TCK data is loaded
        if (data._sectionGrids) {
          setActiveCem(REAL_CEMETERIES[0])
          setActiveSection(REAL_SECTIONS[REAL_CEMETERIES[0]][0])
        }
        setDataReady(true)
      })
      .catch(err => {
        console.error('[Plotter] Fatal load error:', err)
        setAllData(generateAllData())
        setDataReady(true)
      })
  }, [])

  const hasTCKData       = !!(allData?._sectionGrids)
  const activeCemeteries = hasTCKData ? REAL_CEMETERIES : CEMETERIES
  const activeSections   = hasTCKData ? REAL_SECTIONS   : SECTIONS

  const currentPlots = allData?.[activeCem]?.[activeSection] ?? []

  const filteredPlots = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length < 2) return currentPlots
    return currentPlots.filter(p => {
      if (`${p.purchaserFirstName} ${p.purchaserLastName}`.toLowerCase().includes(q)) return true
      return p.internments.some(i =>
        `${i.interredFirstName} ${i.interredLastName}`.toLowerCase().includes(q) ||
        i.internmentNumber.toLowerCase().includes(q)
      )
    })
  }, [currentPlots, search])

  const stats = useMemo(() => {
    const statuses = currentPlots.map(p => derivePlotStatus(p))
    return {
      total:     currentPlots.length,
      available: statuses.filter(s => s === 'available').length,
      occupied:  statuses.filter(s => s === 'occupied').length,
      reserved:  statuses.filter(s => s === 'reserved' || s === 'sold').length,
    }
  }, [currentPlots])

  const pendingCount = changeLog.filter(e => !e.committed).length

  const handleSavePlot = (updatedPlot, changeInfo) => {
    setAllData(prev => {
      const next = { ...prev }
      const arr  = [...next[updatedPlot.cemetery][updatedPlot.section]]
      const idx  = arr.findIndex(p => p.id === updatedPlot.id)
      if (idx >= 0) arr[idx] = updatedPlot
      next[updatedPlot.cemetery] = { ...next[updatedPlot.cemetery], [updatedPlot.section]: arr }
      saveData(next)
      return next
    })
    // Keep detail screen open on the same record — do NOT navigate away
    setDetailTarget(dt => dt ? { ...dt, plot: updatedPlot } : null)

    if (changeInfo?.changes?.length > 0) {
      const int = changeInfo.target === 'internment' && changeInfo.internmentId
        ? updatedPlot.internments.find(i => i.id === changeInfo.internmentId)
        : null
      const displayName = int
        ? `${int.interredFirstName} ${int.interredLastName} · ${updatedPlot.cemetery} · Lot ${updatedPlot.lot}, Grave ${int.graveLabel}`
        : `Plot · ${updatedPlot.cemetery} · Lot ${updatedPlot.lot}, Grave ${updatedPlot.grave}`

      const entry = {
        cemetery:     updatedPlot.cemetery,
        section:      updatedPlot.section,
        lot:          updatedPlot.lot,
        grave:        updatedPlot.grave,
        displayName,
        target:       changeInfo.target ?? 'internment',
        internmentId: changeInfo.internmentId ?? null,
        changes:      changeInfo.changes,
        plotId:       updatedPlot.id,
      }
      setChangeLog(prev => upsertChangeLogEntry(prev, entry))
    }
  }

  // Called from DetailScreen when an internment is saved
  const handleSavePlotWithInt = (updatedPlot, changes) => {
    if (!changes) { handleSavePlot(updatedPlot, null); return }
    handleSavePlot(updatedPlot, {
      target:       'internment',
      internmentId: changes.internmentId,
      changes:      changes.changes,
    })
  }

  const handleCommit = (id) => {
    const entry = changeLog.find(e => e.id === id)
    if (!entry) return

    // Build the updated plot with _original synced to current values
    let updatedPlot = null

    setAllData(prev => {
      const next = { ...prev }
      const arr  = [...(next[entry.cemetery]?.[entry.section] ?? [])]
      const idx  = arr.findIndex(p => p.id === entry.plotId)
      if (idx < 0) return prev

      const plot = { ...arr[idx] }

      if (entry.target === 'internment' && entry.internmentId) {
        const ints  = [...plot.internments]
        const iIdx  = ints.findIndex(i => i.id === entry.internmentId)
        if (iIdx >= 0) {
          const int = { ...ints[iIdx] }
          int._original = { ...int._original }
          for (const chg of entry.changes) {
            int._original[chg.field] = int[chg.field]
          }
          ints[iIdx] = int
        }
        plot.internments = ints
      } else {
        plot._original = { ...plot._original }
        for (const chg of entry.changes) {
          plot._original[chg.field] = plot[chg.field]
        }
      }

      arr[idx] = plot
      next[entry.cemetery] = { ...next[entry.cemetery], [entry.section]: arr }
      saveData(next)
      updatedPlot = plot
      return next
    })

    // Sync detailTarget immediately so color updates without navigating away
    if (updatedPlot) {
      setDetailTarget(dt => {
        if (!dt) return null
        // Also find the updated internment if one was committed
        const updatedInt = entry.internmentId
          ? updatedPlot.internments.find(i => i.id === entry.internmentId) ?? dt.internment
          : dt.internment
        return { ...dt, plot: updatedPlot, internment: updatedInt }
      })
    }

    setChangeLog(prev => commitChangeLogEntry(prev, id))
  }

  const handleRevert = (id) => {
    const entry = changeLog.find(e => e.id === id)
    if (!entry) return

    // Roll fields back to _original (last committed state)
    let revertedPlot = null
    setAllData(prev => {
      const next = { ...prev }
      const arr  = [...(next[entry.cemetery]?.[entry.section] ?? [])]
      const idx  = arr.findIndex(p => p.id === entry.plotId)
      if (idx < 0) return prev

      const plot = { ...arr[idx] }

      if (entry.target === 'internment' && entry.internmentId) {
        const ints = [...plot.internments]
        const iIdx = ints.findIndex(i => i.id === entry.internmentId)
        if (iIdx >= 0) {
          const int = { ...ints[iIdx] }
          // Restore each changed field to its _original value
          for (const chg of entry.changes) {
            int[chg.field] = int._original?.[chg.field] ?? ''
          }
          ints[iIdx] = int
        }
        plot.internments = ints
      } else {
        for (const chg of entry.changes) {
          plot[chg.field] = plot._original?.[chg.field] ?? ''
        }
      }

      arr[idx] = plot
      next[entry.cemetery] = { ...next[entry.cemetery], [entry.section]: arr }
      saveData(next)
      revertedPlot = plot
      return next
    })

    if (revertedPlot) {
      setDetailTarget(dt => {
        if (!dt) return null
        const updatedInt = entry.internmentId
          ? revertedPlot.internments.find(i => i.id === entry.internmentId) ?? dt.internment
          : dt.internment
        return { ...dt, plot: revertedPlot, internment: updatedInt }
      })
    }

    setChangeLog(prev => revertChangeLogEntry(prev, id))
  }

  const handleReloadFromTCK = (plotId, internmentId) => {
    console.log('[Plotter] handleReloadFromTCK called', { plotId, internmentId })
    const prev = allData
    const next = { ...prev }
    let reloadedPlot = null

    outer: for (const [cemName, sections] of Object.entries(next)) {
      if (cemName.startsWith('_') || typeof sections !== 'object' || Array.isArray(sections)) continue
      for (const [secName, plots] of Object.entries(sections)) {
        if (!Array.isArray(plots)) continue
        const idx = plots.findIndex(p => p.id === plotId)
        if (idx < 0) continue

        console.log('[Plotter] Found plot at', cemName, secName, idx)
        const plot = { ...plots[idx] }

        if (internmentId) {
          const ints = [...plot.internments]
          const iIdx = ints.findIndex(i => i.id === internmentId)
          console.log('[Plotter] Found internment at index', iIdx)
          if (iIdx >= 0) {
            const int     = ints[iIdx]
            const tckSnap = int._tckOriginal
            console.log('[Plotter] _tckOriginal exists:', !!tckSnap)
            if (tckSnap) {
              ints[iIdx] = {
                ...int,
                ...tckSnap,
                _original:    { ...tckSnap },
                _tckOriginal: { ...tckSnap },
              }
            }
          }
          plot.internments = ints
        } else {
          const tckSnap = plot._tckOriginal
          console.log('[Plotter] Plot _tckOriginal exists:', !!tckSnap)
          if (tckSnap) {
            Object.assign(plot, tckSnap)
            plot._original    = { ...tckSnap }
            plot._tckOriginal = { ...tckSnap }
          }
        }

        const newPlots = [...plots]
        newPlots[idx]  = plot
        next[cemName]  = { ...next[cemName], [secName]: newPlots }
        reloadedPlot   = plot
        break outer
      }
    }

    console.log('[Plotter] reloadedPlot found:', !!reloadedPlot)
    if (!reloadedPlot) {
      console.log('[Plotter] No plot found — aborting')
      return
    }

    console.log('[Plotter] Saving and updating state...')
    saveData(next)
    setAllData(next)

    setChangeLog(prev => {
      const filtered = prev.filter(e =>
        !(e.plotId === plotId && (internmentId ? e.internmentId === internmentId : true))
      )
      saveChangeLog(filtered)
      return filtered
    })

    // Re-open the same record with freshly reloaded data
    const updatedInt = internmentId
      ? reloadedPlot.internments.find(i => i.id === internmentId) ?? null
      : detailTarget?.internment ?? null
    setDetailTarget({ plot: reloadedPlot, internment: updatedInt })
    setSelectedPlot(null)
    console.log('[Plotter] Done.')
  }

  const handleImport = (newData) => {
    setAllData(newData)
    saveData(newData)
    // Reset to first cemetery/section on fresh import
    const cems = newData._sectionGrids ? REAL_CEMETERIES : CEMETERIES
    const secs = newData._sectionGrids ? REAL_SECTIONS   : SECTIONS
    setActiveCem(cems[0])
    setActiveSection(secs[cems[0]][0])
  }

  const handleNavigateFromLog = (entry) => {
    // Switch to the right cemetery/section
    setActiveCem(entry.cemetery)
    setActiveSection(entry.section)
    // Find the plot
    const plots = allData[entry.cemetery]?.[entry.section] ?? []
    const plot  = plots.find(p => p.id === entry.plotId)
    if (plot) {
      const int = entry.internmentId
        ? plot.internments.find(i => i.id === entry.internmentId) ?? null
        : null
      setDetailTarget({ plot, internment: int })
    }
  }

  const switchCemetery = (cem) => {
    setActiveCem(cem)
    setActiveSection(activeSections[cem][0])
    setSelectedPlot(null)
  }

  // Loading screen — shown briefly while IndexedDB reads on startup
  if (!dataReady) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg-deep)',
        flexDirection: 'column', gap: 16,
      }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 16px var(--accent)' }} />
        <div style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-sans)' }}>Loading…</div>
      </div>
    )
  }

  return (
    <div className={styles.app}>

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className={styles.topbar}>
        <div className={styles.appTitle}>
          <span className={styles.titleSymbol} />
          Plotter
        </div>
        <div className={styles.divider} />
        <nav className={styles.cemTabs}>
          {activeCemeteries.map(c => (
            <button key={c}
              className={`${styles.cemTab} ${activeCem === c ? styles.cemTabActive : ''}`}
              onClick={() => switchCemetery(c)}>
              {c}
            </button>
          ))}
        </nav>
        <div className={styles.topRight}>
          <input className={styles.searchInput} placeholder="Search name or #…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <button className={`btn btn-ghost ${styles.changelogBtn}`} style={{ fontSize: 12 }}
            onClick={() => setShowChangeLog(true)}>
            Changes
            {pendingCount > 0 && (
              <span className={styles.badge}>{pendingCount}</span>
            )}
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowImport(true)}>
            Import / Export
          </button>
        </div>
      </header>

      {/* ── Section bar ─────────────────────────────────────────── */}
      <div className={styles.sectionBar}>
        <span className={styles.sectionLabel}>Section</span>
        {(activeSections[activeCem] ?? []).map(s => (
          <button key={s}
            className={`${styles.secBtn} ${activeSection === s ? styles.secBtnActive : ''}`}
            onClick={() => { setActiveSection(s); setSelectedPlot(null) }}>
            {s}
          </button>
        ))}
        <div className={styles.statsRow}>
          <Stat value={stats.total}     label="total" />
          <Stat value={stats.available} label="available" color="#6ee7b7" />
          <Stat value={stats.occupied}  label="occupied"  color="#93c5fd" />
          <Stat value={stats.reserved}  label="rsv/sold"  color="#fcd34d" />
        </div>
      </div>

      {/* ── Map ─────────────────────────────────────────────────── */}
      <main className={styles.main}>
        <MapCanvas plots={filteredPlots} onPlotClick={setSelectedPlot} changeLog={changeLog} />

        <div className={styles.legend}>
          {Object.entries(STATUS_META).map(([s, m]) => (
            <div key={s} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: m.color }} />
              {m.label}
            </div>
          ))}
          <div className={styles.legendItem}>
            <span style={{ color: '#fcd34d', fontSize: 11, lineHeight: 1 }}>★</span>
            Veteran
          </div>
          <div className={styles.legendItem}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f87171', flexShrink: 0 }} />
            Pending changes
          </div>
        </div>

        {selectedPlot && !detailTarget && (
          <PlotCard
            plot={selectedPlot}
            onClose={() => setSelectedPlot(null)}
            onViewFull={target => { setDetailTarget(target); setSelectedPlot(null) }}
            pendingIntIds={new Set(changeLog.filter(e => !e.committed && e.internmentId).map(e => e.internmentId))}
          />
        )}

        {detailTarget && (
          <DetailScreen
            plotAndInt={detailTarget}
            onBack={() => setDetailTarget(null)}
            onSave={handleSavePlotWithInt}
            onReloadFromTCK={handleReloadFromTCK}
          />
        )}

        {showImport && (
          <ImportExportScreen
            onClose={() => setShowImport(false)}
            allData={allData}
            onImport={handleImport}
          />
        )}

        {showChangeLog && (
          <ChangeLogScreen
            log={changeLog}
            onClose={() => setShowChangeLog(false)}
            onNavigate={handleNavigateFromLog}
            onCommit={handleCommit}
            onRevert={handleRevert}
            onDelete={(id) => setChangeLog(prev => removeChangeLogEntry(prev, id))}
          />
        )}
      </main>
    </div>
  )
}

function Stat({ value, label, color }) {
  return (
    <div className={styles.stat}>
      <strong style={{ color: color ?? 'var(--text-primary)' }}>{value}</strong>
      <span>{label}</span>
    </div>
  )
}
