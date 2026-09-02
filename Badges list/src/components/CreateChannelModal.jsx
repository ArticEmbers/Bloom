import { useState } from 'react'

function CreateChannelModal({ open, value, onChange, onClose, onSubmit }) {
  const [channelType, setChannelType] = useState('text')
  if (!open) return null
  return (
    <div className="modal-overlay bloom-create-overlay" onClick={onClose}>
      <div className="create-modal create-channel-modal" onClick={(event) => event.stopPropagation()}>
        <div className="create-modal-art">✿</div>
        <div className="create-modal-header">
          <span className="settings-kicker">NEW ROOM</span>
          <h2>Create a Room</h2>
          <p>Give people a simple place to start talking.</p>
        </div>
        <form onSubmit={(event) => { event.channelType = channelType; onSubmit(event) }}>
          <label className="create-modal-label">Room name</label>
          <div className="create-name-input">
            <span>#</span>
            <input autoFocus value={value} onChange={(event) => onChange(event.target.value)} placeholder="general" maxLength={50} />
          </div>
          <div className="create-channel-type-grid">
            <button type="button" className={`create-channel-type-card ${channelType === 'text' ? 'active' : ''}`} onClick={() => setChannelType('text')}>
              <span>💬</span><div><strong>Text Room</strong><small>Chat, files, replies and reactions.</small></div>
            </button>
            <button type="button" className={`create-channel-type-card ${channelType === 'voice' ? 'active' : ''}`} onClick={() => setChannelType('voice')}>
              <span>🔊</span><div><strong>Voice Room</strong><small>Join a live voice conversation.</small></div>
            </button>
          </div>
          <div className="create-modal-actions">
            <button type="button" className="small-button" onClick={onClose}>Cancel</button>
            <button className="small-button primary" disabled={!value.trim()}>Create Room</button>
          </div>
        </form>
      </div>
    </div>
  )
}
export default CreateChannelModal
