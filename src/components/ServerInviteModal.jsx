import { useState } from 'react'

function ServerInviteModal({ open, server, isOwner, onClose, onRegenerate }) {
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!open || !server) return null

  async function copyCode() {
    if (!server.invite_code) return
    try {
      await navigator.clipboard.writeText(server.invite_code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  async function regenerate() {
    if (!isOwner || busy) return
    setBusy(true)
    try {
      await onRegenerate?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay bloom-create-overlay" onClick={onClose}>
      <div className="create-modal invite-code-modal" onClick={(event) => event.stopPropagation()}>
        <div className="create-modal-art">🔗</div>
        <div className="create-modal-header">
          <span className="settings-kicker">INVITE TO {server.name?.toUpperCase()}</span>
          <h2>Share this Space</h2>
          <p>Give this code to someone you want to invite.</p>
        </div>

        <div className="invite-code-box">
          <span>{server.invite_code || 'Generating…'}</span>
          <button type="button" onClick={copyCode} disabled={!server.invite_code}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        {isOwner && (
          <button type="button" className="invite-regenerate-button" onClick={regenerate} disabled={busy}>
            {busy ? 'Generating…' : '↻ Generate a new code'}
          </button>
        )}

        <div className="create-modal-actions">
          <button type="button" className="small-button primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

export default ServerInviteModal
