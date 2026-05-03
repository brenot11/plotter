import { useState } from 'react'
import styles from './PinScreen.module.css'

// PIN hash is stored in .env.local (never committed to git)
// To change the PIN: update VITE_PIN_HASH in .env.local
// Generate a new hash: open browser console and type btoa('your-pin')
const CORRECT_HASH = import.meta.env.VITE_PIN_HASH ?? 'NjkwMg=='
const SESSION_KEY  = 'plotter_auth_v1'

export function checkAuth() {
  return sessionStorage.getItem(SESSION_KEY) === 'ok'
}

export function setAuth() {
  sessionStorage.setItem(SESSION_KEY, 'ok')
}

export default function PinScreen({ onUnlock }) {
  const [pin,    setPin]    = useState('')
  const [error,  setError]  = useState(false)
  const [shake,  setShake]  = useState(false)

  const handleDigit = (d) => {
    if (pin.length >= 6) return
    const next = pin + d
    setPin(next)
    setError(false)

    // Auto-submit when PIN reaches expected length
    if (next.length === atob(CORRECT_HASH).length) {
      setTimeout(() => attempt(next), 120)
    }
  }

  const attempt = (code) => {
    if (btoa(code) === CORRECT_HASH) {
      setAuth()
      onUnlock()
    } else {
      setShake(true)
      setError(true)
      setPin('')
      setTimeout(() => setShake(false), 500)
    }
  }

  const handleDelete = () => {
    setPin(p => p.slice(0, -1))
    setError(false)
  }

  const dots = atob(CORRECT_HASH).length

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.symbol} />
        <div className={styles.title}>Plotter</div>
        <div className={styles.subtitle}>Clark County Cemetery District #6</div>

        <div className={`${styles.dots} ${shake ? styles.shake : ''}`}>
          {Array.from({ length: dots }).map((_, i) => (
            <div key={i} className={`${styles.dot} ${i < pin.length ? styles.dotFilled : ''} ${error ? styles.dotError : ''}`} />
          ))}
        </div>

        {error && <div className={styles.error}>Incorrect PIN</div>}

        <div className={styles.keypad}>
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, i) => (
            <button
              key={i}
              className={`${styles.key} ${key === '' ? styles.keyEmpty : ''}`}
              onClick={() => key === '⌫' ? handleDelete() : key !== '' ? handleDigit(key) : null}
              disabled={key === ''}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
