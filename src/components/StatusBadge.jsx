import { STATUS_META } from '../data/cemeteryData'

// Colors come from CSS variables so the badge follows the active theme
// (dark vs field mode) without needing to know which one is on.
export default function StatusBadge({ status, small }) {
  const key   = STATUS_META[status] ? status : 'unavailable'
  const label = (STATUS_META[key] ?? STATUS_META.unavailable).label

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: small ? '2px 7px' : '3px 10px',
      borderRadius: 'var(--radius-sm)',
      background: `var(--status-${key}-bg)`,
      border: `1px solid var(--status-${key})`,
      color: `var(--status-${key}-txt)`,
      fontSize: small ? 10 : 11,
      fontWeight: 600,
      letterSpacing: '0.07em',
      textTransform: 'uppercase',
      fontFamily: 'var(--font-sans)',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}
