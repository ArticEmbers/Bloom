import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const SCOPES = 'user-read-currently-playing user-read-playback-state'
const TOKEN_KEY = 'bloom-spotify-token'
const VERIFIER_KEY = 'bloom-spotify-verifier'
const STATE_KEY = 'bloom-spotify-state'

function base64Url(bytes) {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function sha256(value) {
  const data = new TextEncoder().encode(value)
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data))
}

function randomString(length = 64) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

function getConfig() {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID
  const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI || window.location.origin
  return { clientId, redirectUri }
}

async function tokenRequest(body) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error_description || data.error || 'Spotify authorization failed')
  return data
}

function loadToken() {
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null') } catch { return null }
}

function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ ...token, savedAt: Date.now() }))
}

async function refreshToken(token, clientId) {
  if (!token?.refresh_token) return null
  const data = await tokenRequest({ grant_type: 'refresh_token', refresh_token: token.refresh_token, client_id: clientId })
  const next = { ...token, ...data, refresh_token: data.refresh_token || token.refresh_token }
  saveToken(next)
  return next
}

function tokenExpired(token) {
  return !token?.access_token || Date.now() > Number(token.savedAt || 0) + (Number(token.expires_in || 3600) - 30) * 1000
}

export default function SpotifyActivity({ profile, editable = false, onProfileUpdated }) {
  const [token, setToken] = useState(loadToken)
  const [error, setError] = useState('')
  const config = useMemo(getConfig, [])

  useEffect(() => {
    let cancelled = false
    async function handleCallback() {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (!code) return
      const state = params.get('state')
      const expectedState = localStorage.getItem(STATE_KEY)
      const verifier = localStorage.getItem(VERIFIER_KEY)
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash)
      if (!config.clientId || !verifier || !state || state !== expectedState) return
      try {
        const next = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: config.redirectUri, client_id: config.clientId, code_verifier: verifier })
        if (!cancelled) setToken(next)
        saveToken(next)
      } catch (callbackError) {
        if (!cancelled) setError(callbackError.message)
      } finally {
        localStorage.removeItem(VERIFIER_KEY)
        localStorage.removeItem(STATE_KEY)
      }
    }
    handleCallback()
    return () => { cancelled = true }
  }, [config.clientId, config.redirectUri])

  useEffect(() => {
    if (!editable || !profile?.id || !token?.access_token) return undefined
    let cancelled = false
    const poll = async () => {
      try {
        let activeToken = token
        if (tokenExpired(activeToken)) activeToken = await refreshToken(activeToken, config.clientId)
        if (!activeToken?.access_token) return
        if (activeToken !== token && !cancelled) setToken(activeToken)
        const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
          headers: { Authorization: `Bearer ${activeToken.access_token}` },
        })
        if (response.status === 204) {
          await supabase.from('profiles').update({ spotify_is_playing: false }).eq('id', profile.id)
          onProfileUpdated?.({ ...profile, spotify_is_playing: false })
          return
        }
        if (response.status === 401) {
          localStorage.removeItem(TOKEN_KEY)
          setToken(null)
          return
        }
        const data = await response.json()
        if (!data?.item) return
        const next = {
          spotify_show: true,
          spotify_is_playing: Boolean(data.is_playing),
          spotify_track_name: data.item.name || null,
          spotify_artists: (data.item.artists || []).map((artist) => artist.name).join(', ') || null,
          spotify_album_name: data.item.album?.name || null,
          spotify_album_image: data.item.album?.images?.[0]?.url || null,
          spotify_track_url: data.item.external_urls?.spotify || null,
          spotify_progress_ms: Number(data.progress_ms || 0),
          spotify_duration_ms: Number(data.item.duration_ms || 0),
        }
        await supabase.from('profiles').update(next).eq('id', profile.id)
        onProfileUpdated?.({ ...profile, ...next })
      } catch (pollError) {
        if (!cancelled) setError(pollError.message)
      }
    }
    poll()
    const timer = window.setInterval(poll, 15000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [profile?.id, token?.access_token, config.clientId])

  async function connect() {
    if (!config.clientId) return setError('Spotify is not configured. Add VITE_SPOTIFY_CLIENT_ID in your environment.')
    const verifier = randomString(96)
    const challenge = base64Url(await sha256(verifier))
    const state = randomString(32)
    localStorage.setItem(VERIFIER_KEY, verifier)
    localStorage.setItem(STATE_KEY, state)
    const url = new URL('https://accounts.spotify.com/authorize')
    url.search = new URLSearchParams({ response_type: 'code', client_id: config.clientId, scope: SCOPES, redirect_uri: config.redirectUri, code_challenge_method: 'S256', code_challenge: challenge, state }).toString()
    window.location.href = url.toString()
  }

  async function disconnect() {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    const cleared = { spotify_show: false, spotify_is_playing: false, spotify_track_name: null, spotify_artists: null, spotify_album_name: null, spotify_album_image: null, spotify_track_url: null, spotify_progress_ms: 0, spotify_duration_ms: 0 }
    await supabase.from('profiles').update(cleared).eq('id', profile.id)
    onProfileUpdated?.({ ...profile, ...cleared })
  }

  if (!profile?.spotify_show || !profile?.spotify_is_playing || !profile?.spotify_track_name) return null
  const progress = Math.max(0, Math.min(100, (Number(profile.spotify_progress_ms || 0) / Math.max(1, Number(profile.spotify_duration_ms || 1))) * 100))
  return (
    <div className="spotify-activity-card">
      {profile.spotify_album_image && <img src={profile.spotify_album_image} alt="" className="spotify-activity-art" />}
      <div className="spotify-activity-copy">
        <span>♫ Listening to Spotify</span>
        <strong>{profile.spotify_track_name}</strong>
        <small>{profile.spotify_artists || 'Unknown artist'}</small>
        <div className="spotify-progress"><i style={{ width: `${progress}%` }} /></div>
      </div>
      {profile.spotify_track_url && <a href={profile.spotify_track_url} target="_blank" rel="noreferrer">Open</a>}
    </div>
  )
}

export function SpotifyConnect({ profile, onProfileUpdated }) {
  const [token] = useState(loadToken)
  const [error, setError] = useState('')
  const config = getConfig()

  async function connect() {
    setError('')
    if (!config.clientId) {
      setError('Spotify is not configured for this Bloom deployment. Add VITE_SPOTIFY_CLIENT_ID in Vercel/local .env.')
      return
    }
    try {
      const verifier = randomString(96)
      const challenge = base64Url(await sha256(verifier))
      const state = randomString(32)
      localStorage.setItem(VERIFIER_KEY, verifier)
      localStorage.setItem(STATE_KEY, state)
      const url = new URL('https://accounts.spotify.com/authorize')
      url.search = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        scope: SCOPES,
        redirect_uri: config.redirectUri,
        code_challenge_method: 'S256',
        code_challenge: challenge,
        state,
      }).toString()
      window.location.assign(url.toString())
    } catch (connectError) {
      setError(connectError?.message || 'Unable to start Spotify authorization.')
    }
  }

  return (
    <div className="spotify-connect-panel">
      <div>
        <strong>Spotify activity</strong>
        <p>Show what you're currently listening to on your Bloom profile.</p>
        {!token && !config.clientId && (
          <div className="spotify-connect-error">Spotify is not configured yet.</div>
        )}
        {error && <div className="spotify-connect-error">{error}</div>}
      </div>
      {token ? (
        <span className="spotify-connected">Connected</span>
      ) : (
        <button type="button" className="secondary-button" onClick={connect}>Connect Spotify</button>
      )}
      {token && <small className="spotify-connect-note">Reconnect by clearing the Spotify connection in this browser.</small>}
    </div>
  )
}
