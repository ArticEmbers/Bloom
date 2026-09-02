function CreateServerModal({ open, value, onChange, onClose, onSubmit }) {
  if (!open) return null
  return (
    <div className="modal-overlay bloom-create-overlay" onClick={onClose}>
      <div className="create-modal" onClick={(event) => event.stopPropagation()}>
        <div className="create-modal-art">🌸</div>
        <div className="create-modal-header">
          <span className="settings-kicker">NEW SPACE</span>
          <h2>Create your Space</h2>
          <p>A cozy place for your community to grow.</p>
        </div>
        <form onSubmit={onSubmit}>
          <label className="create-modal-label">Space name</label>
          <input autoFocus value={value} onChange={(event) => onChange(event.target.value)} placeholder="e.g. Moon Garden" maxLength={50} />
          <div className="create-modal-actions">
            <button type="button" className="small-button" onClick={onClose}>Cancel</button>
            <button className="small-button primary" disabled={!value.trim()}>Create Space</button>
          </div>
        </form>
      </div>
    </div>
  )
}
export default CreateServerModal
