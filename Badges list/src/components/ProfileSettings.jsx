import { useState } from 'react'
import StatusPicker from './StatusPicker'
import { supabase } from '../lib/supabase'

function ProfileSettings({
  profile,
  user,
  onClose,
  onUpdated,
}) {
  const [username, setUsername] =
    useState(profile.username || '')

  const [bio, setBio] =
    useState(profile.bio || '')

  const [avatarUrl, setAvatarUrl] =
    useState(profile.avatar_url || '')

  const [bannerUrl, setBannerUrl] =
    useState(profile.banner_url || '')

  const [presenceStatus, setPresenceStatus] =
    useState(profile.presence_status || 'online')

  const [customStatus, setCustomStatus] =
    useState(profile.custom_status || '')

  const [saving, setSaving] =
    useState(false)

  async function saveProfile(event) {
    event.preventDefault()

    setSaving(true)

    const { data, error } = await supabase
      .from('profiles')
      .update({
        username: username.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl.trim() || null,
        banner_url: bannerUrl.trim() || null,
        presence_status: presenceStatus,
        custom_status: customStatus.trim() || null,
      })
      .eq('id', user.id)
      .select()
      .single()

    setSaving(false)

    if (error) {
      console.error(error)
      return
    }

    onUpdated(data)
    onClose()
  }

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    >
      <div
        className="settings-modal"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="settings-header">
          <div>
            <span className="settings-kicker">
              PERSONAL SPACE
            </span>

            <h2>Profile Settings</h2>
          </div>

          <button
            className="modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <form onSubmit={saveProfile}>
          <div className="profile-preview">
            <div
              className="preview-banner"
              style={
                bannerUrl
                  ? {
                      backgroundImage: `url(${bannerUrl})`,
                    }
                  : {}
              }
            />

            <div className="preview-avatar">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                />
              ) : (
                username
                  .charAt(0)
                  .toUpperCase() || '?'
              )}
            </div>
          </div>

          <div className="input-group">
            <label>Username</label>

            <input
              value={username}
              onChange={(event) =>
                setUsername(event.target.value)
              }
              maxLength={32}
            />
          </div>

          <div className="input-group">
            <label>Bio</label>

            <textarea
              className="profile-textarea"
              value={bio}
              onChange={(event) =>
                setBio(event.target.value)
              }
              placeholder="Tell people a little about yourself..."
              maxLength={300}
            />
          </div>

          <div className="input-group">
            <label>Profile picture URL</label>

            <input
              type="url"
              value={avatarUrl}
              onChange={(event) =>
                setAvatarUrl(event.target.value)
              }
              placeholder="https://..."
            />
          </div>

          <div className="input-group profile-status-settings">
            <label>Status</label>
            <StatusPicker value={presenceStatus} onChange={setPresenceStatus} />
          </div>

          <div className="input-group">
            <label>Custom status</label>
            <input
              value={customStatus}
              maxLength={128}
              onChange={(event) => setCustomStatus(event.target.value)}
              placeholder="What are you up to?"
            />
          </div>

          <div className="input-group">
            <label>Banner image URL</label>

            <input
              type="url"
              value={bannerUrl}
              onChange={(event) =>
                setBannerUrl(event.target.value)
              }
              placeholder="https://..."
            />
          </div>

          <div className="settings-actions">
            <button
              type="button"
              className="small-button"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="small-button primary"
              disabled={saving}
            >
              {saving
                ? 'Saving...'
                : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ProfileSettings