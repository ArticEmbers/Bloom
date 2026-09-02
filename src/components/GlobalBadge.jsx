import { useState } from 'react'

export default function GlobalBadge({ badge }) {
  const [open, setOpen] = useState(false)
  if (!badge) return null
  return (
    <span className="global-badge-wrap">
      <button
        type="button"
        className="global-badge"
        aria-label={badge.name}
        onClick={() => setOpen((value) => !value)}
        title={badge.name}
      >
        {badge.icon || '✦'}
      </button>
      <span className={`global-badge-tooltip ${open ? 'open' : ''}`}>
        <strong>{badge.name}</strong>
        <small>{badge.description || ''}</small>
      </span>
    </span>
  )
}
