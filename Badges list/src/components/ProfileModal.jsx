function ProfileModal({ user, onClose }) {
  if (!user) return null

  const username = user.username || 'Unknown'
  const initial = username.charAt(0).toUpperCase()

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    >
      <div
        className="profile-modal"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <button
          className="modal-close"
          onClick={onClose}
        >
          ×
        </button>

        <div
          className="profile-banner"
          style={
            user.banner_url
              ? {
                  backgroundImage: `url(${user.banner_url})`,
                }
              : {}
          }
        />

        <div className="profile-modal-content">
          <div className="profile-avatar-large profile-avatar-with-status">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={username}
              />
            ) : (
              initial
            )}
            <span
              className={`presence-indicator presence-profile status-${user.presence_status || 'offline'}`}
              aria-label={user.presence_status || 'offline'}
            />
          </div>

          <h2>{username}</h2>

          <div className="profile-status-line">
            <span className={`profile-status-dot status-${user.presence_status || 'offline'}`} aria-hidden="true" />
            <span>{user.custom_status || (user.presence_status || 'offline').replace('dnd', 'Do Not Disturb')}</span>
          </div>

          <div className="profile-section">
            <h4>ABOUT</h4>

            <p>
              {user.bio ||
                'This person has not written a bio yet.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfileModal