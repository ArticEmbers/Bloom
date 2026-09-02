import { useEffect, useState } from 'react'
import { createMonitorPipeline } from './VoiceAudioProcessor'

const STORAGE_KEY = 'bloom-voice-settings'

function readSavedSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return {
      inputDeviceId: saved.inputDeviceId || '',
      outputDeviceId: saved.outputDeviceId || '',
      noiseMode: saved.noiseMode || 'rnnoise',
      noiseSuppressionLevel: Number.isFinite(saved.noiseSuppressionLevel)
        ? saved.noiseSuppressionLevel
        : 85,
    }
  } catch {
    return { inputDeviceId: '', outputDeviceId: '', noiseMode: 'rnnoise', noiseSuppressionLevel: 85 }
  }
}

function VoiceSettings({ value, onChange }) {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(false)
  const [monitoring, setMonitoring] = useState(false)
  const [error, setError] = useState('')
  const [rnnoiseAvailable, setRnnoiseAvailable] = useState(true)
  const [monitorPipeline, setMonitorPipeline] = useState(null)

  useEffect(() => {
    const saved = readSavedSettings()
    onChange({ ...saved, ...(value || {}) })
  }, [])

  useEffect(() => {
    let cancelled = false
    import('@timephy/rnnoise-wasm')
      .then(() => { if (!cancelled) setRnnoiseAvailable(true) })
      .catch(() => { if (!cancelled) setRnnoiseAvailable(false) })
    return () => { cancelled = true }
  }, [])

  async function refreshDevices({ requestPermission = false } = {}) {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setError('Your browser does not support audio device selection.')
      return
    }
    setLoading(true)
    setError('')
    let permissionStream = null
    try {
      if (requestPermission) {
        permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      setDevices(await navigator.mediaDevices.enumerateDevices())
    } catch (err) {
      setError(err?.message || 'Unable to access audio devices.')
    } finally {
      permissionStream?.getTracks().forEach((track) => track.stop())
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial device enumeration is intentionally triggered after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshDevices()
    const handler = () => refreshDevices()
    navigator.mediaDevices?.addEventListener?.('devicechange', handler)
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', handler)
  }, [])

  useEffect(() => () => monitorPipeline?.stop?.(), [monitorPipeline])

  function persist(next) {
    const merged = { noiseMode: 'rnnoise', ...(value || {}), ...next }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    onChange(merged)
  }

  function stopMonitoring() {
    monitorPipeline?.stop?.()
    setMonitorPipeline(null)
    setMonitoring(false)
  }

  async function toggleMonitoring() {
    if (monitoring) return stopMonitoring()
    setError('')
    try {
      const mode = value?.noiseMode === 'browser' ? 'browser' : 'rnnoise'
      const pipeline = await createMonitorPipeline({
        inputDeviceId: value?.inputDeviceId || '',
        outputDeviceId: value?.outputDeviceId || '',
        noiseSuppressionLevel: 85,
        mode,
      })
      setMonitorPipeline(pipeline)
      setMonitoring(true)
    } catch (err) {
      setError(err?.message || 'Microphone test could not be started.')
      stopMonitoring()
    }
  }

  const inputs = devices.filter((device) => device.kind === 'audioinput')
  const outputs = devices.filter((device) => device.kind === 'audiooutput')

  return (
    <section className="voice-settings-panel">
      <div className="voice-settings-heading">
        <div>
          <span className="settings-kicker">VOICE & AUDIO</span>
          <h3>Audio devices & voice quality</h3>
          <p>Choose your devices and free local noise cancellation.</p>
        </div>
        <button type="button" className="small-button" onClick={() => refreshDevices({ requestPermission: true })} disabled={loading}>
          {loading ? 'Detecting…' : 'Refresh'}
        </button>
      </div>

      <div className="voice-device-grid">
        <label className="voice-device-field">
          <span>Microphone</span>
          <select value={value?.inputDeviceId || ''} onChange={(event) => { stopMonitoring(); persist({ inputDeviceId: event.target.value }) }}>
            <option value="">Default microphone</option>
            {inputs.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${device.deviceId.slice(0, 8)}`}</option>)}
          </select>
        </label>
        <label className="voice-device-field">
          <span>Speakers / output</span>
          <select value={value?.outputDeviceId || ''} onChange={(event) => { stopMonitoring(); persist({ outputDeviceId: event.target.value }) }}>
            <option value="">Default output</option>
            {outputs.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Output ${device.deviceId.slice(0, 8)}`}</option>)}
          </select>
        </label>
      </div>

      <div className="voice-device-grid">
        <label className="voice-device-field">
          <span>Noise cancellation</span>
          <select value={value?.noiseMode || 'rnnoise'} onChange={(event) => { stopMonitoring(); persist({ noiseMode: event.target.value }) }}>
            <option value="rnnoise" disabled={!rnnoiseAvailable}>RNNoise (free, local)</option>
            <option value="browser">Browser processing</option>
          </select>
        </label>
        <div className="voice-device-field voice-processing-info">
          <span>Processing</span>
          <div className="voice-processing-badge">{value?.noiseMode === 'browser' ? 'Browser DSP' : 'RNNoise WASM • local'}</div>
        </div>
      </div>

      <div className="voice-monitor-card">
        <div>
          <strong>Microphone test</strong>
          <small>{value?.noiseMode === 'browser' ? 'Browser echo cancellation + processing.' : 'RNNoise + echo cancellation.'} Headphones are strongly recommended to prevent acoustic feedback.</small>
        </div>
        <button type="button" className={`small-button ${monitoring ? 'primary' : ''}`} onClick={toggleMonitoring}>
          {monitoring ? 'Stop test' : 'Test microphone'}
        </button>
      </div>

      {!rnnoiseAvailable && (
        <p className="voice-settings-error">RNNoise is not installed. Run <code>npm install @timephy/rnnoise-wasm</code> in your project, then restart Vite.</p>
      )}
      {error && <p className="voice-settings-error">{error}</p>}
    </section>
  )
}

export default VoiceSettings
