const STATUS_META = {
  online: { label: 'Online', color: '#57d989' },
  idle: { label: 'Idle', color: '#f1c75b' },
  dnd: { label: 'Do Not Disturb', color: '#ef5d67' },
  invisible: { label: 'Invisible', color: '#8f8a93' },
  offline: { label: 'Offline', color: '#8f8a93' },
}

function PresenceIndicator({ status = 'offline', size = 'small' }) {
  const normalized = STATUS_META[status] ? status : 'offline'
  const meta = STATUS_META[normalized]

  return (
    <span
      className={`presence-indicator presence-${size} status-${normalized}`}
      aria-label={meta.label}
      title={meta.label}
      style={{ '--presence-color': meta.color }}
    >
      <span className="presence-dot" aria-hidden="true" />
    </span>
  )
}

export default PresenceIndicator
