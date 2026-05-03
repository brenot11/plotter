import { useState, useEffect, useRef } from 'react'
import { savePhoto, loadPhoto, deletePhoto, compressImage, getPhotoKey } from '../utils/photoStorage'
import { MARKER_TYPES } from '../data/cemeteryData'
import styles from './MarkerPanel.module.css'

export default function MarkerPanel({ internment, editing, onChange }) {
  const [photoUrl,     setPhotoUrl]     = useState(null)
  const [photoLoading, setPhotoLoading] = useState(true)
  const [fullscreen,   setFullscreen]   = useState(false)
  const [uploading,    setUploading]    = useState(false)
  const cameraRef  = useRef(null)
  const galleryRef = useRef(null)

  const photoKey = getPhotoKey(internment)

  // Load photo from IndexedDB on mount / when internment changes
  useEffect(() => {
    setPhotoLoading(true)
    loadPhoto(photoKey).then(url => {
      setPhotoUrl(url)
      setPhotoLoading(false)
    })
  }, [photoKey])

  const handleFile = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const compressed = await compressImage(file)
      await savePhoto(photoKey, compressed)
      setPhotoUrl(compressed)
    } catch (e) {
      console.error('[Plotter] Photo upload failed:', e)
    }
    setUploading(false)
  }

  const handleDelete = async () => {
    await deletePhoto(photoKey)
    setPhotoUrl(null)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.sectionTitle}>Marker</div>

      {/* ── Photo area ──────────────────────────────────────────── */}
      <div className={styles.photoArea}>
        {photoLoading ? (
          <div className={styles.photoPlaceholder}>
            <div className={styles.loadingDot} />
          </div>
        ) : photoUrl ? (
          <img
            src={photoUrl}
            alt="Marker"
            className={styles.photo}
            onClick={() => setFullscreen(true)}
          />
        ) : (
          <div className={styles.photoPlaceholder}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <span>No photo</span>
          </div>
        )}

        {/* Upload buttons — always visible */}
        <div className={styles.photoButtons}>
          <button
            className={styles.photoBtn}
            onClick={() => cameraRef.current?.click()}
            title="Take photo"
            disabled={uploading}
          >
            {uploading ? '…' : '📷'}
            <span>Camera</span>
          </button>
          <button
            className={styles.photoBtn}
            onClick={() => galleryRef.current?.click()}
            title="Choose from gallery"
            disabled={uploading}
          >
            🖼
            <span>Gallery</span>
          </button>
          {photoUrl && (
            <button
              className={`${styles.photoBtn} ${styles.photoBtnDelete}`}
              onClick={handleDelete}
              title="Remove photo"
            >
              ✕
              <span>Remove</span>
            </button>
          )}
        </div>

        {/* Hidden file inputs */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />
      </div>

      {/* ── Marker Type ─────────────────────────────────────────── */}
      <div className={styles.field}>
        <div className={styles.fieldLabel}>Marker Type</div>
        {editing ? (
          <select
            className="field-input"
            value={internment.markerType ?? ''}
            onChange={e => onChange('markerType', e.target.value)}
          >
            <option value="">—</option>
            {MARKER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        ) : (
          <div className={styles.fieldValue} style={{
            color: internment.markerType ? 'var(--text-primary)' : 'var(--text-muted)',
            fontStyle: internment.markerType ? 'normal' : 'italic',
          }}>
            {internment.markerType || '—'}
          </div>
        )}
      </div>

      {/* ── Marker Notes ────────────────────────────────────────── */}
      <div className={styles.field}>
        <div className={styles.fieldLabel}>Marker Notes</div>
        {editing ? (
          <textarea
            className="field-input"
            rows={4}
            value={internment.markerNotes ?? ''}
            onChange={e => onChange('markerNotes', e.target.value)}
            placeholder="Notes about the marker..."
          />
        ) : (
          <div className={styles.fieldValue} style={{
            color: internment.markerNotes ? 'var(--text-primary)' : 'var(--text-muted)',
            fontStyle: internment.markerNotes ? 'normal' : 'italic',
            lineHeight: 1.6,
          }}>
            {internment.markerNotes || 'No notes.'}
          </div>
        )}
      </div>

      {/* ── Fullscreen photo viewer ──────────────────────────────── */}
      {fullscreen && photoUrl && (
        <div className={styles.fullscreen} onClick={() => setFullscreen(false)}>
          <button className={styles.fullscreenClose} onClick={() => setFullscreen(false)}>×</button>
          <img
            src={photoUrl}
            alt="Marker"
            className={styles.fullscreenPhoto}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
