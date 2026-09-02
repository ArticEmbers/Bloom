import { useEffect, useState } from 'react'

function JoinServerModal({ open, onClose, onJoin }) {
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (open) {
      setCode('')
      setJoining(false)
    }
  }, [open])

  if (!open) return null

  async function handleSubmit(event) {
    event.preventDefault()
    if (!code.trim() || joining) return
    setJoining(true)
    try {
      await onJoin(code)
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="modal-overlay bloom-create-overlay" onClick={onClose}>
      <div className="create-modal join-space-modal" onClick={(event) => event.stopPropagation()}>
        <div className="create-modal-art">✦</div>
        <div className="create-modal-header">
          <span className="settings-kicker">JOIN A SPACE</span>
          <h2>Enter an invite code</h2>
          <p>Use the code shared by the Space owner to join their community.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="create-modal-label">Space code</label>
          <input
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
            placeholder="e.g. A7K9Q2M4"
            maxLength={16}
            autoComplete="off"
            spellCheck="false"
          />
          <p className="join-space-hint">Codes are generated automatically when a Space is created.</p>

          <div className="create-modal-actions">
            <button type="button" className="small-button" onClick={onClose}>Cancel</button>
            <button className="small-button primary" disabled={!code.trim() || joining}>
              {joining ? 'Joining…' : 'Join Space'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default JoinServerModal
