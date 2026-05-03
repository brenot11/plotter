// ── Photo Storage ─────────────────────────────────────────────────────────────
//
// Photos are stored in a separate IndexedDB store, keyed by _tckRecID.
// This means they survive a full TCK reimport — the import just reattaches
// them by matching _tckRecID after rebuilding the data.
//
// For new internments (no TCK record), we use the internment's app ID instead.

const DB_NAME    = 'plotter_photos'
const DB_VERSION = 1
const STORE_NAME = 'photos'

function openPhotoDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

// Save a photo for an internment
// photoKey: _tckRecID if available, otherwise internment id
export async function savePhoto(photoKey, dataUrl) {
  try {
    const db    = await openPhotoDB()
    const tx    = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(dataUrl, String(photoKey))
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve
      tx.onerror    = e => reject(e.target.error)
    })
    console.log('[Plotter] Photo saved for key:', photoKey)
  } catch (e) {
    console.error('[Plotter] Failed to save photo:', e)
  }
}

// Load a photo by key
export async function loadPhoto(photoKey) {
  try {
    const db  = await openPhotoDB()
    const tx  = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(String(photoKey))
    return await new Promise((resolve, reject) => {
      req.onsuccess = e => resolve(e.target.result ?? null)
      req.onerror   = e => reject(e.target.error)
    })
  } catch (e) {
    console.error('[Plotter] Failed to load photo:', e)
    return null
  }
}

// Delete a photo by key
export async function deletePhoto(photoKey) {
  try {
    const db = await openPhotoDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(String(photoKey))
  } catch (e) {
    console.error('[Plotter] Failed to delete photo:', e)
  }
}

// Get all photo keys (used when reattaching after reimport)
export async function getAllPhotoKeys() {
  try {
    const db  = await openPhotoDB()
    const tx  = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAllKeys()
    return await new Promise((resolve, reject) => {
      req.onsuccess = e => resolve(e.target.result ?? [])
      req.onerror   = e => reject(e.target.error)
    })
  } catch (e) {
    console.error('[Plotter] Failed to get photo keys:', e)
    return []
  }
}

// ── Image compression ─────────────────────────────────────────────────────────
// Resizes and compresses an image file to a max width of 1400px at 85% quality.
// Returns a base64 data URL.

export function compressImage(file) {
  return new Promise((resolve, reject) => {
    const MAX_WIDTH  = 1400
    const QUALITY    = 0.85
    const reader     = new FileReader()

    reader.onerror = reject
    reader.onload  = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload  = () => {
        const scale  = Math.min(1, MAX_WIDTH / img.width)
        const width  = Math.round(img.width  * scale)
        const height = Math.round(img.height * scale)

        const canvas    = document.createElement('canvas')
        canvas.width    = width
        canvas.height   = height
        const ctx       = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        resolve(canvas.toDataURL('image/jpeg', QUALITY))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

// Get the photo key for an internment
// Prefers _tckRecID since it survives reimport
export function getPhotoKey(internment) {
  return internment._tckRecID || internment.id
}
