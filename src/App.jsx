import { useState, useMemo, useEffect, useRef } from 'react'
import { CEMETERIES, SECTIONS, STATUS_META, MAP_PLOT_FIELD, derivePlotStatus, loadData, saveData, generateAllData } from './data/cemeteryData'
import { REAL_CEMETERIES, REAL_SECTIONS } from './utils/tckImport'
import { loadChangeLog, saveChangeLog, upsertChangeLogEntry, commitChangeLogEntry, revertChangeLogEntry, removeChangeLogEntry, clearCommittedEntries } from './utils/changeLog'
import MapCanvas          from './components/MapCanvas'
import PlotCard           from './components/PlotCard'
import DetailScreen       from './components/DetailScreen'
import ImportExportScreen from './components/ImportExportScreen'
import ListsScreen        from './components/ListsScreen'
import {
  loadPlotFlags, toggleBlackstone, setPlotNote,
  clearBlackstone, clearNote, blackstonePlotIds, notePlotIds,
  setPlotStatusOverride, applyFlagsToData,
  loadGeneralNotes, addGeneralNote, updateGeneralNote, removeGeneralNote,
} from './utils/plotFlags'
import styles             from './App.module.css'

export default function App() {
  const [allData,       setAllData]       = useState(null)
  const [dataReady,     setDataReady]     = useState(false)
  const [changeLog,     setChangeLog]     = useState(() => clearCommittedEntries(loadChangeLog()))
  const [search,        setSearch]        = useState('')
  const [selectedPlot,  setSelectedPlot]  = useState(null)
  const [activePlotId,  setActivePlotId]  = useState(null)
  const suppressNextClick = useRef(false)
  const [detailTarget,  setDetailTarget]  = useState(null)
  const [showImport,    setShowImport]    = useState(false)
  const [showChangeLog, setShowChangeLog] = useState(false)
  const [listsTab,      setListsTab]      = useState('changes')
  const [plotFlags,     setPlotFlags]     = useState(() => loadPlotFlags())
  const [generalNotes,  setGeneralNotes]  = useState(() => loadGeneralNotes())
  const [noteModal,     setNoteModal]     = useState(null)   // null | {id?, text}
  const [activeCem,     setActiveCem]     = useState(CEMETERIES[0])
  const [activeSection, setActiveSection] = useState(SECTIONS[CEMETERIES[0]][0])

  // Field mode — light, high-contrast palette for outdoor use
  const [fieldMode, setFieldMode] = useState(() => {
    try { return localStorage.getItem('plotter_field_mode') === '1' }
    catch { return false }
  })

  // Keep the <html data-theme> attribute in sync so CSS variables switch
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', fieldMode ? 'field' : 'dark')
    try { localStorage.setItem('plotter_field_mode', fieldMode ? '1' : '0') } catch {}
  }, [fieldMode])

  // Per-section flip preferences — stored in localStorage (tiny, fine)
  const [flippedSections, setFlippedSections] = useState(() => {
    try { return JSON.parse(localStorage.getItem('plotter_flipped') ?? '{}') }
    catch { return {} }
  })
  const [flippedRows, setFlippedRows] = useState(() => {
    try { return JSON.parse(localStorage.getItem('plotter_flipped_rows') ?? '{}') }
    catch { return {} }
  })

  const flipKey      = `${activeCem}|${activeSection}`
  const isFlipped    = !!flippedSections[flipKey]
  const isFlippedRows = !!flippedRows[flipKey]

  const toggleFlip = () => {
    setFlippedSections(prev => {
      const next = { ...prev, [flipKey]: !prev[flipKey] }
      localStorage.setItem('plotter_flipped', JSON.stringify(next))
      return next
    })
  }

  const toggleFlipRows = () => {
    setFlippedRows(prev => {
      const next = { ...prev, [flipKey]: !prev[flipKey] }
      localStorage.setItem('plotter_flipped_rows', JSON.stringify(next))
      return next
    })
  }

  // Load data async from IndexedDB on mount
  useEffect(() => {
    loadData()
      .then(data => {
        console.log('[Plotter] App data ready, keys:', Object.keys(data).slice(0, 5))
        // Re-apply Plotter-only status overrides, which survive TCK reimports
        applyFlagsToData(data, loadPlotFlags())
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

  // Does a plot match the current query? Shared by the section filter and
  // the cross-cemetery hit count so the two can never disagree.
  const plotMatches = (p, q) => {
    if (`${p.purchaserFirstName} ${p.purchaserLastName}`.toLowerCase().includes(q)) return true
    return p.internments.some(i =>
      `${i.interredFirstName} ${i.interredLastName}`.toLowerCase().includes(q) ||
      i.internmentNumber.toLowerCase().includes(q)
    )
  }

  const filteredPlots = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length < 2) return currentPlots
    return currentPlots.filter(p => plotMatches(p, q))
  }, [currentPlots, search])

  // Hit counts for every section, so she can see at a glance whether a name
  // exists anywhere rather than paging through sections to find out.
  const searchHits = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length < 2 || !allData) return null

    const sections = []
    let total = 0
    for (const cem of activeCemeteries) {
      for (const sec of (activeSections[cem] ?? [])) {
        const plots = allData[cem]?.[sec] ?? []
        let n = 0
        for (const p of plots) if (plotMatches(p, q)) n++
        if (n > 0) sections.push({ cemetery: cem, section: sec, count: n })
        total += n
      }
    }
    return { total, sections }
  }, [allData, search, activeCemeteries, activeSections])

  const [cemStatsMode, setCemStatsMode] = useState(false)

  const sectionStats = useMemo(() => {
    const statuses = currentPlots.map(p => derivePlotStatus(p))
    return {
      total:     currentPlots.length,
      available: statuses.filter(s => s === 'available').length,
      occupied:  statuses.filter(s => s === 'occupied').length,
      sold:      statuses.filter(s => s === 'sold').length,
    }
  }, [currentPlots])

  const cemStats = useMemo(() => {
    if (!allData || !hasTCKData) return null
    const secs = activeSections[activeCem] ?? []
    let total = 0, available = 0, occupied = 0, sold = 0, veterans = 0
    for (const sec of secs) {
      const plots = allData[activeCem]?.[sec] ?? []
      for (const plot of plots) {
        total++
        const status = derivePlotStatus(plot)
        if (status === 'available') available++
        else if (status === 'occupied') occupied++
        else if (status === 'sold') sold++
        for (const int of plot.internments) {
          if (int.veteran) veterans++
        }
      }
    }
    return { total, available, occupied, sold, veterans }
  }, [allData, activeCem, activeSections, hasTCKData])

  const stats = cemStatsMode && cemStats ? cemStats : sectionStats
  const pendingCount = changeLog.filter(e => !e.committed).length

  // Per-plot field flags — blackstones and quick notes
  const blackstoneIds = useMemo(() => blackstonePlotIds(plotFlags), [plotFlags])
  const noteIds       = useMemo(() => notePlotIds(plotFlags),       [plotFlags])
  const listsCount    = pendingCount + blackstoneIds.size + noteIds.size + generalNotes.length

  const handleToggleBlackstone = (plot) => setPlotFlags(f => toggleBlackstone(f, plot))
  const handleSaveNote         = (plot, text) => setPlotFlags(f => setPlotNote(f, plot, text))
  const handleClearBlackstone  = (plotId) => setPlotFlags(f => clearBlackstone(f, plotId))
  const handleClearNote        = (plotId) => setPlotFlags(f => clearNote(f, plotId))

  // Status override lives in flags, but derivePlotStatus reads it off the plot,
  // so update both together.
  const handleSetStatusOverride = (plot, status) => {
    setPlotFlags(f => setPlotStatusOverride(f, plot, status))
    const updated = { ...plot, statusOverride: status || null }
    setAllData(prev => {
      if (!prev) return prev
      const next = { ...prev }
      const arr  = [...(next[plot.cemetery]?.[plot.section] ?? [])]
      const idx  = arr.findIndex(p => p.id === plot.id)
      if (idx < 0) return prev
      arr[idx] = updated
      next[plot.cemetery] = { ...next[plot.cemetery], [plot.section]: arr }
      saveData(next)
      return next
    })
    setSelectedPlot(sp => sp?.id === plot.id ? updated : sp)
    setDetailTarget(dt => dt?.plot?.id === plot.id ? { ...dt, plot: updated } : dt)
  }

  // General notes — not attached to any plot
  const handleSaveGeneralNote = (id, text) => {
    setGeneralNotes(n => id ? updateGeneralNote(n, id, text) : addGeneralNote(n, text))
    setNoteModal(null)
  }
  const handleDeleteGeneralNote = (id) => setGeneralNotes(n => removeGeneralNote(n, id))

  // Jump to a plot from one of the flag lists
  const handleNavigateToPlot = (entry) => {
    setActiveCem(entry.cemetery)
    setActiveSection(entry.section)
    const plots = allData?.[entry.cemetery]?.[entry.section] ?? []
    const plot  = plots.find(p => p.id === entry.plotId)
    if (plot) {
      setActivePlotId(plot.id)
      setSelectedPlot(plot)
    }
  }

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
    applyFlagsToData(newData, plotFlags)
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
    setActivePlotId(null)
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
          <div className={styles.searchWrap}>
            <input className={styles.searchInput} placeholder="Search name or #…"
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <button className={styles.searchClear} onClick={() => setSearch('')}
                title="Clear search" aria-label="Clear search">×</button>
            )}

            {searchHits && (
              <div className={styles.searchResults}>
                {searchHits.total === 0 ? (
                  <div className={styles.searchNone}>No matches in any cemetery</div>
                ) : (
                  <>
                    <div className={styles.searchCount}>
                      {searchHits.total} {searchHits.total === 1 ? 'match' : 'matches'}
                    </div>
                    {searchHits.sections.map(h => {
                      const isHere = h.cemetery === activeCem && h.section === activeSection
                      return (
                        <button
                          key={`${h.cemetery}|${h.section}`}
                          className={`${styles.searchHit} ${isHere ? styles.searchHitHere : ''}`}
                          onClick={() => {
                            setActiveCem(h.cemetery)
                            setActiveSection(h.section)
                            setSelectedPlot(null)
                            setActivePlotId(null)
                          }}
                        >
                          <span className={styles.searchHitName}>{h.section}</span>
                          <span className={styles.searchHitCount}>{h.count}</span>
                        </button>
                      )
                    })}
                  </>
                )}
              </div>
            )}
          </div>
          <button className={`btn btn-ghost ${styles.changelogBtn}`} style={{ fontSize: 12 }}
            onClick={() => { setListsTab('changes'); setShowChangeLog(true) }}>
            Lists
            {listsCount > 0 && (
              <span className={styles.badge}>{listsCount}</span>
            )}
          </button>
          <button className={`btn btn-ghost ${styles.addNoteBtn}`} style={{ fontSize: 12 }}
            onClick={() => setNoteModal({ text: '' })}>
            + Note
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowImport(true)}>
            Import / Export
          </button>
          <button
            className={`btn btn-ghost ${styles.fieldBtn} ${fieldMode ? styles.fieldBtnActive : ''}`}
            onClick={() => setFieldMode(m => !m)}
            title={fieldMode ? 'Switch to dark mode' : 'Switch to field mode (high contrast for outdoors)'}
          >
            {fieldMode ? '☾' : '☀'}
          </button>
        </div>
      </header>

      {/* ── Section bar ─────────────────────────────────────────── */}
      <div className={styles.sectionBar}>
        <span className={styles.sectionLabel}>{cemStatsMode ? 'Cemetery' : 'Section'}</span>
        {(activeSections[activeCem] ?? []).map(s => (
          <button key={s}
            className={`${styles.secBtn} ${activeSection === s ? styles.secBtnActive : ''} ${cemStatsMode ? styles.secBtnDim : ''}`}
            onClick={() => { setActiveSection(s); setSelectedPlot(null); setActivePlotId(null) }}>
            {s}
          </button>
        ))}
        <div className={styles.statsRow}>
          <Stat value={stats.total}     label="total" />
          <Stat value={stats.available} label="avail"    color="#6ee7b7" />
          <Stat value={stats.occupied}  label="occupied"  color="#93c5fd" />
          <Stat value={stats.sold}      label="sold"      color="#c4b5fd" />
          {cemStatsMode && cemStats && (
            <Stat value={cemStats.veterans} label="veterans" color="#fcd34d" />
          )}
        </div>
        <button
          className={`btn btn-ghost ${styles.flipBtn} ${cemStatsMode ? styles.flipBtnActive : ''}`}
          onClick={() => setCemStatsMode(m => !m)}
          title="Toggle cemetery-wide stats"
          style={{ fontSize: 11, letterSpacing: '0.04em' }}
        >
          CEM
        </button>
        <button
          className={`btn btn-ghost ${styles.flipBtn} ${isFlipped ? styles.flipBtnActive : ''}`}
          onClick={toggleFlip}
          title="Flip grave number order left-to-right"
        >
          ⇄
        </button>
        <button
          className={`btn btn-ghost ${styles.flipBtn} ${isFlippedRows ? styles.flipBtnActive : ''}`}
          onClick={toggleFlipRows}
          title="Flip row order top-to-bottom"
        >
          ⇅
        </button>
      </div>

      {/* ── Map ─────────────────────────────────────────────────── */}
      <main className={styles.main}>
        <MapCanvas
          plots={filteredPlots}
          onPlotClick={plot => {
            if (suppressNextClick.current) {
              suppressNextClick.current = false
              return
            }
            if (plot) {
              setSelectedPlot(plot)
              setActivePlotId(plot.id)
            } else {
              setSelectedPlot(null)
              setActivePlotId(null)
            }
          }}
          changeLog={changeLog}
          flipped={isFlipped}
          flippedRows={isFlippedRows}
          activePlotId={activePlotId}
          cardOpen={!!selectedPlot}
          fieldMode={fieldMode}
          blackstoneIds={blackstoneIds}
          noteIds={noteIds}
        />

        <div className={styles.legendStack}>
          {/* Plot fill colours */}
          <div className={styles.legend}>
            <span className={styles.legendTitle}>Status</span>
            {Object.entries(STATUS_META).map(([s, m]) => (
              <div key={s} className={styles.legendItem}>
                <span className={styles.legendDot} style={{
                  background: fieldMode ? MAP_PLOT_FIELD[s]?.fill : m.color,
                  border: fieldMode ? `2px solid ${MAP_PLOT_FIELD[s]?.stroke}` : 'none',
                }} />
                {m.label}
              </div>
            ))}
          </div>

          {/* Icons drawn on top of plots */}
          <div className={styles.legend}>
            <span className={styles.legendTitle}>Icons</span>
            <div className={styles.legendItem}>
              <span style={{ color: '#b45309', fontSize: 12, lineHeight: 1 }}>★</span>
              Veteran
            </div>
            <div className={styles.legendItem}>
              <span style={{
                display: 'inline-block', width: 9, height: 9, borderRadius: 2,
                background: fieldMode ? '#18181b' : '#a1a1aa', flexShrink: 0,
              }} />
              Blackstone
            </div>
            <div className={styles.legendItem}>
              <span style={{
                display: 'inline-block', width: 9, height: 9, borderRadius: 2,
                background: fieldMode ? '#eab308' : '#fde047', flexShrink: 0,
              }} />
              Note
            </div>
            <div className={styles.legendItem}>
              <span style={{
                color: fieldMode ? '#15803d' : '#4ade80',
                fontSize: 14, fontWeight: 700, lineHeight: 1,
              }}>+</span>
              2+ internments
            </div>
            <div className={styles.legendItem}>
              <span style={{
                display: 'inline-block', width: 9, height: 9, borderRadius: 2,
                background: 'transparent', flexShrink: 0,
                border: `2px solid ${fieldMode ? '#dc2626' : '#f87171'}`,
              }} />
              Pending edit
            </div>
          </div>
        </div>

        {selectedPlot && !detailTarget && (
          <PlotCard
            plot={selectedPlot}
            onClose={() => { suppressNextClick.current = true; setSelectedPlot(null) }}
            onViewFull={target => { setDetailTarget(target); setSelectedPlot(null) }}
            pendingIntIds={new Set(changeLog.filter(e => !e.committed && e.internmentId).map(e => e.internmentId))}
            hasBlackstone={blackstoneIds.has(selectedPlot.id)}
            noteText={plotFlags[selectedPlot.id]?.note?.text ?? ''}
            onToggleBlackstone={handleToggleBlackstone}
            onSaveNote={handleSaveNote}
            isUnavailable={selectedPlot.statusOverride === 'unavailable'}
            onToggleUnavailable={p =>
              handleSetStatusOverride(p, p.statusOverride === 'unavailable' ? null : 'unavailable')}
          />
        )}

        {detailTarget && (
          <DetailScreen
            plotAndInt={detailTarget}
            onBack={() => setDetailTarget(null)}
            onSave={handleSavePlotWithInt}
            onReloadFromTCK={handleReloadFromTCK}
            onSetStatusOverride={handleSetStatusOverride}
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
          <ListsScreen
            log={changeLog}
            flags={plotFlags}
            initialTab={listsTab}
            onNavigatePlot={handleNavigateToPlot}
            onClearBlackstone={handleClearBlackstone}
            onClearNote={handleClearNote}
            generalNotes={generalNotes}
            onEditGeneralNote={n => setNoteModal({ id: n.id, text: n.text })}
            onDeleteGeneralNote={handleDeleteGeneralNote}
            onClose={() => setShowChangeLog(false)}
            onNavigate={handleNavigateFromLog}
            onCommit={handleCommit}
            onRevert={handleRevert}
            onDelete={(id) => setChangeLog(prev => removeChangeLogEntry(prev, id))}
          />
        )}

        {noteModal && (
          <GeneralNoteModal
            initial={noteModal}
            onSave={handleSaveGeneralNote}
            onCancel={() => setNoteModal(null)}
          />
        )}
      </main>
    </div>
  )
}

// ── General note composer ─────────────────────────────────────────────────────
function GeneralNoteModal({ initial, onSave, onCancel }) {
  const [text, setText] = useState(initial.text ?? '')
  return (
    <div className={styles.modalOverlay} onPointerDown={e => {
      e.stopPropagation()
      if (e.target === e.currentTarget) onCancel()
    }}>
      <div className={styles.modalCard}>
        <div className={styles.modalTitle}>
          {initial.id ? 'Edit note' : 'New note'}
        </div>
        <textarea
          className="field-input"
          rows={6}
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Anything you want to remember — not tied to a specific plot."
        />
        <div className={styles.modalBtns}>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
            disabled={!text.trim()}
            onClick={() => onSave(initial.id, text)}>
            Save note
          </button>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
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
