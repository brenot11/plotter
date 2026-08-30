import { useRef, useEffect, useCallback } from 'react'
import { MAP_PLOT, MAP_PLOT_FIELD, CANVAS_DARK, CANVAS_FIELD, derivePlotStatus } from '../data/cemeteryData'
import styles from './MapCanvas.module.css'

const PLOT_W = 22
const PLOT_H = 36
const GAP_X  = 4
const GAP_Y  = 3
const LOT_LABEL_W  = 38
const GRAVE_LABEL_H = 22

export default function MapCanvas({ plots, onPlotClick, changeLog = [], flipped = false, flippedRows = false, activePlotId = null, cardOpen = false, fieldMode = false, blackstoneIds = null, noteIds = null }) {
  // Active palettes for this render
  const C  = fieldMode ? CANVAS_FIELD : CANVAS_DARK
  const MP = fieldMode ? MAP_PLOT_FIELD : MAP_PLOT
  const canvasRef = useRef(null)
  const state = useRef({ offsetX: 0, offsetY: 0, scale: 1, dragging: false, lastX: 0, lastY: 0, moved: false })
  const plotsRef    = useRef(plots)
  const changeRef   = useRef(changeLog)
  const activeIdRef = useRef(activePlotId)
  const cardOpenRef     = useRef(cardOpen)
  const blackstoneIdsRef = useRef(blackstoneIds ?? new Set())
  const noteIdsRef       = useRef(noteIds ?? new Set())
  plotsRef.current    = plots
  changeRef.current   = changeLog
  activeIdRef.current = activePlotId
  cardOpenRef.current       = cardOpen
  blackstoneIdsRef.current  = blackstoneIds ?? new Set()
  noteIdsRef.current        = noteIds ?? new Set()

  // Pre-compute set of plotIds with pending changes for fast lookup
  const pendingPlotIds = useRef(new Set())
  const pendingIntIds  = useRef(new Set())
  pendingPlotIds.current = new Set(changeLog.filter(e => !e.committed).map(e => e.plotId))
  pendingIntIds.current  = new Set(changeLog.filter(e => !e.committed && e.internmentId).map(e => e.internmentId))

  // ── Build lookup map ───────────────────────────────────────────────────────
  const getPlotMap = useCallback(() => {
    const m = {}
    for (const p of plotsRef.current) {
      const i = p.lotIndex ?? (parseInt(p.lot, 10) || 1) - 1
      m[`${i}_${p.grave}`] = p
    }
    return m
  }, [])

  // Rows are addressed by lotIndex, not by lot number, because lot labels are
  // not always numeric ('7W', 'T3'). rowLabels maps a row back to its label
  // for the gutter. Older data without lotIndex falls back to the numeric lot.
  const getLayoutInfo = useCallback(() => {
    const ps = plotsRef.current
    if (!ps || ps.length === 0) return { rowCount: 0, maxGrave: 0, rowLabels: [] }

    const labels = []
    for (const p of ps) {
      const i = p.lotIndex ?? (parseInt(p.lot, 10) || 1) - 1
      if (labels[i] === undefined) labels[i] = String(p.lot)
    }
    return {
      rowCount:  labels.length,
      maxGrave:  Math.max(...ps.map(p => p.grave)),
      rowLabels: labels,
    }
  }, [])

  // ── Draw ───────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx   = canvas.getContext('2d')
    const { offsetX, offsetY, scale } = state.current
    const W = canvas.width, H = canvas.height

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = C.background
    ctx.fillRect(0, 0, W, H)

    const ps = plotsRef.current
    if (!ps || ps.length === 0) return

    const { rowCount, maxGrave, rowLabels } = getLayoutInfo()
    const pw  = PLOT_W  * scale
    const ph  = PLOT_H  * scale
    const gx  = GAP_X   * scale
    const gy  = GAP_Y   * scale
    const llw = LOT_LABEL_W   * scale
    const glh = GRAVE_LABEL_H * scale
    const startX = offsetX + llw
    const startY = offsetY + glh

    // Grid background tint for alternate rows
    for (let row = 0; row < rowCount; row++) {
      const y = startY + row * (ph + gy)
      if (y + ph < 0 || y > H) continue
      if (row % 2 === 1) {
        ctx.fillStyle = C.altRowTint
        ctx.fillRect(offsetX, y - gy / 2, W - offsetX, ph + gy)
      }
    }

    // Grave number headers
    ctx.font = `${Math.max(8, 9 * scale)}px 'JetBrains Mono', monospace`
    ctx.fillStyle = C.headerLabel
    ctx.textAlign = 'center'
    for (let g = 5; g <= maxGrave; g += 5) {
      const displayCol = flipped ? (maxGrave - g) : (g - 1)
      const x = startX + displayCol * (pw + gx) + pw / 2
      if (x < 0 || x > W) continue
      ctx.fillText(String(g), x, offsetY + glh - 5 * scale)
    }

    // Lot row labels
    ctx.font = `${Math.max(7, 9 * scale)}px 'JetBrains Mono', monospace`
    ctx.fillStyle = C.headerLabel
    ctx.textAlign = 'right'

    const plotMap = getPlotMap()

    for (let row = 0; row < rowCount; row++) {
      const displayRow = flippedRows ? (rowCount - 1 - row) : row
      const y = startY + displayRow * (ph + gy)
      if (y + ph < 0 || y > H) continue

      const lotLabel = rowLabels[row] ?? ''

      // Lot label — brighter and larger
      const lotFontSize = Math.max(9, 11 * scale)
      ctx.fillStyle = C.lotLabel
      ctx.textAlign = 'right'
      ctx.font = `500 ${lotFontSize}px 'JetBrains Mono', monospace`
      ctx.fillText(lotLabel, offsetX + llw - 5 * scale, y + ph * 0.67)

      for (let grave = 1; grave <= maxGrave; grave++) {
        const displayCol = flipped ? (maxGrave - grave) : (grave - 1)
        const x = startX + displayCol * (pw + gx)
        if (x + pw < 0 || x > W) continue

        const plot   = plotMap[`${row}_${grave}`]
        const status = plot ? derivePlotStatus(plot) : null
        const mp     = MP[status ?? 'unavailable'] ?? MP.unavailable
        const r      = Math.max(1, 2 * scale)

        // Check for pending changes on this plot
        const hasPending = plot && pendingPlotIds.current.has(plot.id)

        // Fill
        ctx.fillStyle = mp.fill
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(x, y, pw, ph, r)
        else               ctx.rect(x, y, pw, ph)
        ctx.fill()

        // Stroke — red if pending changes, otherwise normal status stroke
        if (hasPending) {
          ctx.strokeStyle = C.pendingStroke
          ctx.lineWidth   = C.pendingWidth * scale
          ctx.beginPath()
          if (ctx.roundRect) ctx.roundRect(x, y, pw, ph, r)
          else               ctx.rect(x, y, pw, ph)
          ctx.stroke()
        } else if (mp.stroke && mp.strokeWidth > 0) {
          ctx.strokeStyle = mp.stroke
          ctx.lineWidth   = mp.strokeWidth * scale
          ctx.beginPath()
          if (ctx.roundRect) ctx.roundRect(x, y, pw, ph, r)
          else               ctx.rect(x, y, pw, ph)
          ctx.stroke()
        }

        // Grave number — always visible at top of plot
        const graveLabel = plot ? String(plot.grave) : String(grave)
        const numFontSize = Math.max(6, Math.min(10, pw * 0.42))
        ctx.fillStyle = plot ? C.graveNum : C.graveNumEmpty
        ctx.font = `${numFontSize}px 'JetBrains Mono', monospace`
        ctx.textAlign = 'center'
        ctx.fillText(graveLabel, x + pw / 2, y + numFontSize + 2 * scale)

        // Which flag icons does this plot carry? They occupy the plot's
        // centre, so the lot number steps aside when any are present.
        const iconVet   = !!plot?.internments?.some(i => i.veteran)
        const iconStone = !!(plot && blackstoneIdsRef.current.has(plot.id))
        const iconNote  = !!(plot && noteIdsRef.current.has(plot.id))
        const iconMulti = (plot?.internments?.length ?? 0) > 1
        const anyIcon   = iconVet || iconStone || iconNote || iconMulti

        // Lot number — rotated in the centre, only when zoomed in and unobstructed
        if (scale > 1.2 && !anyIcon) {
          const lotNumSize = Math.max(5, Math.min(ph * 0.45, 9 * scale))
          ctx.save()
          ctx.translate(x + pw / 2, y + ph / 2)
          ctx.rotate(-Math.PI / 2)
          ctx.fillStyle = C.lotNumInPlot
          ctx.font = `${lotNumSize}px 'JetBrains Mono', monospace`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(lotLabel, 0, 0)
          ctx.restore()
          ctx.textBaseline = 'alphabetic'
        }

        // Surname label in lower portion at higher zoom
        const primaryInt = plot?.internments?.[0]
        if (primaryInt?.interredLastName && scale > 1.0) {
          ctx.fillStyle = C.surname
          const nameFontSize = Math.max(5, 5 * scale)
          ctx.font = `${nameFontSize}px 'JetBrains Mono', monospace`
          ctx.textAlign = 'center'
          ctx.fillText(
            primaryInt.interredLastName.substring(0, 5).toUpperCase(),
            x + pw / 2,
            y + ph - 4 * scale
          )
        }

        // Active plot highlight — white outline, drawn on top of everything
        if (plot?.id === activeIdRef.current) {
          ctx.strokeStyle = C.activeStroke
          ctx.lineWidth   = C.activeWidth * scale
          ctx.beginPath()
          if (ctx.roundRect) ctx.roundRect(x, y, pw, ph, r)
          else               ctx.rect(x, y, pw, ph)
          ctx.stroke()
        }
        // ── Flag icons — fixed 2×2 grid in the plot's centre.
        // Slots are fixed rather than packed, so an icon always means the
        // same thing in the same place:
        //     ★ veteran   |  + multiple internments
        //     ■ blackstone|  ■ note
        if (anyIcon && scale > 0.6) {
          const sz   = Math.min(pw * 0.28, ph * 0.17)
          const colL = x + pw * 0.29
          const colR = x + pw * 0.71
          const rowT = y + ph * 0.42
          const rowB = y + ph * 0.62

          // Veteran — top left
          if (iconVet) {
            const r1 = sz * 0.62, r2 = sz * 0.27, pts = 5
            ctx.fillStyle = C.veteranStar
            ctx.beginPath()
            for (let i = 0; i < pts * 2; i++) {
              const a = (i * Math.PI / pts) - Math.PI / 2
              const r = i % 2 === 0 ? r1 : r2
              const sx = colL + Math.cos(a) * r
              const sy = rowT + Math.sin(a) * r
              i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy)
            }
            ctx.closePath()
            ctx.fill()
          }

          // Multiple internments — top right, green plus
          if (iconMulti) {
            const arm = sz * 0.40
            ctx.strokeStyle = C.multiDot
            ctx.lineWidth   = Math.max(1, sz * 0.22)
            ctx.lineCap     = 'round'
            ctx.beginPath()
            ctx.moveTo(colR - arm, rowT); ctx.lineTo(colR + arm, rowT)
            ctx.moveTo(colR, rowT - arm); ctx.lineTo(colR, rowT + arm)
            ctx.stroke()
            ctx.lineCap = 'butt'
          }

          // Blackstone — bottom left
          if (iconStone) {
            ctx.fillStyle = C.blackstone
            ctx.beginPath()
            const bx = colL - sz / 2, by = rowB - sz / 2
            if (ctx.roundRect) ctx.roundRect(bx, by, sz, sz, sz * 0.18)
            else               ctx.rect(bx, by, sz, sz)
            ctx.fill()
          }

          // Note — bottom right
          if (iconNote) {
            ctx.fillStyle = C.noteDot
            ctx.beginPath()
            const nx = colR - sz / 2, ny = rowB - sz / 2
            if (ctx.roundRect) ctx.roundRect(nx, ny, sz, sz, sz * 0.18)
            else               ctx.rect(nx, ny, sz, sz)
            ctx.fill()
          }
        }
      }
    }

    // Section label watermark
    const secName = ps[0]?.section ?? ''
    ctx.font = `600 ${Math.max(11, 14 * scale)}px 'Geist', sans-serif`
    ctx.fillStyle = C.watermark
    ctx.textAlign = 'center'
    ctx.fillText(secName.toUpperCase(), W / 2, H - 14)
  }, [getLayoutInfo, getPlotMap, flipped, flippedRows, fieldMode])

  // ── Resize observer ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas.parentElement
    const center = () => {
      canvas.width  = parent.clientWidth
      canvas.height = parent.clientHeight
      const { rowCount, maxGrave } = getLayoutInfo()
      const totalW = LOT_LABEL_W + maxGrave * (PLOT_W + GAP_X)
      const totalH = GRAVE_LABEL_H + rowCount * (PLOT_H + GAP_Y)
      state.current.offsetX = (canvas.width  - totalW)  / 2
      state.current.offsetY = (canvas.height - totalH) / 2
      draw()
    }
    const ro = new ResizeObserver(center)
    ro.observe(parent)
    center()
    return () => ro.disconnect()
  }, [draw, getLayoutInfo])

  useEffect(() => { draw() }, [draw, plots, flipped, flippedRows, activePlotId, fieldMode, blackstoneIds, noteIds])

  // ── Hit-test ───────────────────────────────────────────────────────────────
  const getPlotAt = useCallback((cx, cy) => {
    const { offsetX, offsetY, scale } = state.current
    const pw  = PLOT_W  * scale, ph  = PLOT_H  * scale
    const gx  = GAP_X   * scale, gy  = GAP_Y   * scale
    const llw = LOT_LABEL_W   * scale
    const glh = GRAVE_LABEL_H * scale
    const rx  = cx - (offsetX + llw)
    const ry  = cy - (offsetY + glh)
    if (rx < 0 || ry < 0) return null

    // Reject clicks in the gap
    if ((rx % (pw + gx)) / (pw + gx) > pw / (pw + gx)) return null
    if ((ry % (ph + gy)) / (ph + gy) > ph / (ph + gy)) return null

    const { rowCount, maxGrave } = getLayoutInfo()
    const colIdx = Math.floor(rx / (pw + gx))
    const rowIdx = Math.floor(ry / (ph + gy))

    // Convert display position back to data coordinates, accounting for flips
    const grave = flipped ? (maxGrave - colIdx) : (colIdx + 1)
    const row   = flippedRows ? (rowCount - 1 - rowIdx) : rowIdx
    if (row < 0 || row >= rowCount) return null

    return plotsRef.current.find(p => {
      const i = p.lotIndex ?? (parseInt(p.lot, 10) || 1) - 1
      return i === row && p.grave === grave
    }) ?? null
  }, [getLayoutInfo, flipped, flippedRows])

  // ── Mouse events ───────────────────────────────────────────────────────────
  const onMouseDown  = useCallback((e) => {
    state.current.dragging      = true
    state.current.lastX         = e.clientX
    state.current.lastY         = e.clientY
    state.current.moved         = false
    state.current.cardWasOpen   = cardOpenRef.current  // snapshot at tap start
  }, [])

  const onMouseMove  = useCallback((e) => {
    if (!state.current.dragging) return
    const dx = e.clientX - state.current.lastX
    const dy = e.clientY - state.current.lastY
    if (Math.abs(dx) + Math.abs(dy) > 3) state.current.moved = true
    state.current.offsetX += dx
    state.current.offsetY += dy
    state.current.lastX    = e.clientX
    state.current.lastY    = e.clientY
    draw()
  }, [draw])

  const onMouseUp = useCallback((e) => {
    if (!state.current.moved) {
      if (state.current.cardWasOpen) {
        state.current.dragging = false
        state.current.moved    = false
        return
      }
      const rect  = canvasRef.current.getBoundingClientRect()
      const plot  = getPlotAt(e.clientX - rect.left, e.clientY - rect.top)
      onPlotClick(plot)
    }
    state.current.dragging = false
    state.current.moved    = false
  }, [getPlotAt, onPlotClick])

  // ── Wheel zoom ─────────────────────────────────────────────────────────────
  const onWheel = useCallback((e) => {
    e.preventDefault()
    const rect   = canvasRef.current.getBoundingClientRect()
    const mx     = e.clientX - rect.left
    const my     = e.clientY - rect.top
    const factor = e.deltaY > 0 ? 0.9 : 1.11
    const s      = state.current
    const ns     = Math.max(0.28, Math.min(4, s.scale * factor))
    s.offsetX    = mx - (mx - s.offsetX) * (ns / s.scale)
    s.offsetY    = my - (my - s.offsetY) * (ns / s.scale)
    s.scale      = ns
    draw()
  }, [draw])

  // ── Touch events ───────────────────────────────────────────────────────────
  const touch = useRef({ lastDist: null, wasPinching: false })

  const onTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      if (!touch.current.wasPinching) {
        state.current.dragging    = true
        state.current.lastX       = e.touches[0].clientX
        state.current.lastY       = e.touches[0].clientY
        state.current.moved       = false
        state.current.cardWasOpen = cardOpenRef.current  // snapshot at tap start
      }
    }
    if (e.touches.length === 2) {
      touch.current.wasPinching  = true
      touch.current.lastDist     = null
      state.current.dragging     = false
      state.current.moved        = true
    }
  }, [])

  const onTouchMove = useCallback((e) => {
    e.preventDefault()
    if (e.touches.length === 2) {
      const dx   = e.touches[0].clientX - e.touches[1].clientX
      const dy   = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      if (touch.current.lastDist !== null) {
        const factor = dist / touch.current.lastDist
        const s      = state.current
        const rect   = canvasRef.current.getBoundingClientRect()
        const mx     = midX - rect.left
        const my     = midY - rect.top
        const ns     = Math.max(0.28, Math.min(4, s.scale * factor))
        s.offsetX    = mx - (mx - s.offsetX) * (ns / s.scale)
        s.offsetY    = my - (my - s.offsetY) * (ns / s.scale)
        s.scale      = ns
        draw()
      }
      touch.current.lastDist = dist
      state.current.dragging = false
    } else if (e.touches.length === 1 && state.current.dragging) {
      const dx = e.touches[0].clientX - state.current.lastX
      const dy = e.touches[0].clientY - state.current.lastY
      if (Math.abs(dx) + Math.abs(dy) > 3) state.current.moved = true
      state.current.offsetX += dx
      state.current.offsetY += dy
      state.current.lastX    = e.touches[0].clientX
      state.current.lastY    = e.touches[0].clientY
      draw()
    }
  }, [draw])

  const onTouchEnd = useCallback((e) => {
    touch.current.lastDist = null

    if (e.touches.length === 0) {
      // All fingers lifted — if we were pinching, suppress tap and reset flag
      if (touch.current.wasPinching) {
        touch.current.wasPinching = false
        state.current.dragging    = false
        state.current.moved       = false
        return
      }
    }

    // Still has fingers on screen (one finger lifted during pinch) — suppress tap
    if (touch.current.wasPinching) return

    if (!state.current.moved && e.changedTouches.length === 1) {
      if (state.current.cardWasOpen) {
        state.current.dragging = false
        state.current.moved    = false
        return
      }
      const rect = canvasRef.current.getBoundingClientRect()
      const plot = getPlotAt(
        e.changedTouches[0].clientX - rect.left,
        e.changedTouches[0].clientY - rect.top
      )
      onPlotClick(plot)
    }
    state.current.dragging = false
    state.current.moved    = false
  }, [getPlotAt, onPlotClick])

  // ── Register passive-false listeners ──────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    canvas.addEventListener('wheel',      onWheel,     { passive: false })
    canvas.addEventListener('touchmove',  onTouchMove, { passive: false })
    return () => {
      canvas.removeEventListener('wheel',     onWheel)
      canvas.removeEventListener('touchmove', onTouchMove)
    }
  }, [onWheel, onTouchMove])

  const zoomBy = useCallback((factor) => {
    const canvas = canvasRef.current
    const cx = canvas.width / 2, cy = canvas.height / 2
    const s  = state.current
    const ns = Math.max(0.28, Math.min(4, s.scale * factor))
    s.offsetX = cx - (cx - s.offsetX) * (ns / s.scale)
    s.offsetY = cy - (cy - s.offsetY) * (ns / s.scale)
    s.scale   = ns
    draw()
  }, [draw])

  const resetView = useCallback(() => {
    const canvas = canvasRef.current
    state.current.scale = 1
    const { rowCount, maxGrave } = getLayoutInfo()
    const totalW = LOT_LABEL_W + maxGrave * (PLOT_W + GAP_X)
    const totalH = GRAVE_LABEL_H + rowCount * (PLOT_H + GAP_Y)
    state.current.offsetX = (canvas.width  - totalW) / 2
    state.current.offsetY = (canvas.height - totalH) / 2
    draw()
  }, [draw, getLayoutInfo])

  return (
    <div className={styles.container} style={{ pointerEvents: cardOpen ? 'none' : 'auto' }}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { state.current.dragging = false }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      />
      <div className={styles.zoomControls}>
        <button className={styles.zoomBtn} onClick={() => zoomBy(1.25)} title="Zoom in">+</button>
        <button className={styles.zoomBtn} onClick={resetView}          title="Reset view">⌂</button>
        <button className={styles.zoomBtn} onClick={() => zoomBy(0.8)}  title="Zoom out">−</button>
      </div>
    </div>
  )
}
