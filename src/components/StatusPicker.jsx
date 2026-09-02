/* eslint-disable react-refresh/only-export-components */
const STATUS_OPTIONS = [
  { value: 'online', label: 'Online', color: '#57d989' },
  { value: 'idle', label: 'Idle', color: '#f1c75b' },
  { value: 'dnd', label: 'Do Not Disturb', color: '#ef5d67' },
  { value: 'invisible', label: 'Invisible', color: '#8f8a93' },
]

export { STATUS_OPTIONS }

function StatusPicker({ value, onChange }) {
  const current = STATUS_OPTIONS.find((item) => item.value === value) || STATUS_OPTIONS[0]

  return (
    <div className="status-picker">
      {STATUS_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`status-option status-${option.value} ${value === option.value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          <span
            className="status-option-dot"
            style={{ background: option.color }}
            aria-hidden="true"
          />
          <span>{option.label}</span>
        </button>
      ))}
      <span className="status-picker-current" aria-live="polite">
        <span className="status-option-dot" style={{ background: current.color }} aria-hidden="true" />
        {current.label}
      </span>
    </div>
  )
}

export default StatusPicker
