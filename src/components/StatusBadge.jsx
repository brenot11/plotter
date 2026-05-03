import { STATUS_META } from '../data/cemeteryData'

export default function StatusBadge({ status, small }) {
  const meta = STATUS_META[status] ?? STATUS_META.unavailable
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: small ? '2px 7px' : '3px 10px',
      borderRadius: 'var(--radius-sm)',
      background: meta.bg,
      border: `1px solid ${meta.color}`,
      color: meta.text,
      fontSize: small ? 10 : 11,
      fontWeight: 500,
      letterSpacing: '0.07em',
      textTransform: 'uppercase',
      fontFamily: 'var(--font-sans)',
      whiteSpace: 'nowrap',
    }}>
      {meta.label}
    </span>
  )
}
