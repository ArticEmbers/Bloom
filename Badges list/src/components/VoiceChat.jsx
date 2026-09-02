import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createMicrophonePipeline } from './VoiceAudioProcessor'
import './VoiceChat.css'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

function VoiceChat({ open, session, profile, context, inputDeviceId = '', outputDeviceId = '', noiseMode = 'rnnoise', noiseSuppressionLevel = 85, onClose }) {
  const [participants, setParticipants] = useState({})
  const [muted, setMuted] = useState(false)
  const [deafened, setDeafened] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [usingRnnoise, setUsingRnnoise] = useState(false)
  const localStreamRef = useRef(null)
  const processedStreamRef = useRef(null)
  const pipelineRef = useRef(null)
  const peersRef = useRef(new Map())
  const channelRef = useRef(null)
  const deafenedRef = useRef(false)
  const voiceKey = useMemo(() => `voice-${context.kind}-${context.id}`, [context.kind, context.id])

  useEffect(() => { deafenedRef.current = deafened }, [deafened])

  useEffect(() => {
    if (!open || !session?.user?.id) return
    let disposed = false
    const channel = supabase.channel(voiceKey)
    channelRef.current = channel

    const removePeer = (userId) => {
      const peer = peersRef.current.get(userId)
      peer?.close()
      peersRef.current.delete(userId)
      document.querySelectorAll(`audio[data-voice-peer="${userId}"]`).forEach((node) => node.remove())
      setParticipants((current) => { const next = { ...current }; delete next[userId]; return next })
    }

    const attachPeer = (remoteUserId, initiator) => {
      if (!remoteUserId || remoteUserId === session.user.id) return null
      if (peersRef.current.has(remoteUserId)) return peersRef.current.get(remoteUserId)
      const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      peersRef.current.set(remoteUserId, peer)
      processedStreamRef.current?.getTracks().forEach((track) => peer.addTrack(track, processedStreamRef.current))
      peer.ontrack = ({ streams }) => {
        let audio = document.querySelector(`audio[data-voice-peer="${remoteUserId}"]`)
        if (!audio) {
          audio = document.createElement('audio')
          audio.autoplay = true
          audio.playsInline = true
          audio.dataset.voicePeer = remoteUserId
          document.body.appendChild(audio)
        }
        audio.srcObject = streams[0]
        audio.volume = deafenedRef.current ? 0 : 1
        if (outputDeviceId && typeof audio.setSinkId === 'function') audio.setSinkId(outputDeviceId).catch(() => {})
        setParticipants((current) => ({ ...current, [remoteUserId]: { username: current[remoteUserId]?.username || 'Connected' } }))
      }
      peer.onicecandidate = ({ candidate }) => {
        if (candidate) channel.send({ type: 'broadcast', event: 'voice-signal', payload: { kind: 'ice', from: session.user.id, to: remoteUserId, candidate } })
      }
      peer.onconnectionstatechange = () => { if (['failed', 'closed'].includes(peer.connectionState)) removePeer(remoteUserId) }
      if (initiator) peer.createOffer().then((offer) => peer.setLocalDescription(offer)).then(() => channel.send({ type: 'broadcast', event: 'voice-signal', payload: { kind: 'offer', from: session.user.id, to: remoteUserId, sdp: peer.localDescription } })).catch((e) => setError(e.message))
      return peer
    }

    const onSignal = async ({ payload }) => {
      if (!payload || payload.to !== session.user.id) return
      try {
        const peer = attachPeer(payload.from, payload.kind === 'offer')
        if (!peer) return
        if (payload.kind === 'offer') {
          await peer.setRemoteDescription(payload.sdp)
          const answer = await peer.createAnswer()
          await peer.setLocalDescription(answer)
          await channel.send({ type: 'broadcast', event: 'voice-signal', payload: { kind: 'answer', from: session.user.id, to: payload.from, sdp: peer.localDescription } })
        } else if (payload.kind === 'answer') await peer.setRemoteDescription(payload.sdp)
        else if (payload.kind === 'ice' && payload.candidate) await peer.addIceCandidate(payload.candidate)
        else if (payload.kind === 'hangup') removePeer(payload.from)
      } catch (e) { setError(e.message || 'Voice signaling failed.') }
    }

    const syncPresence = () => {
      const entries = Object.values(channel.presenceState()).flat().filter(Boolean)
      const others = entries.filter((entry) => entry.user_id && entry.user_id !== session.user.id)
      setParticipants((current) => {
        const next = {}
        others.forEach((entry) => { next[entry.user_id] = { username: entry.username || current[entry.user_id]?.username || 'Participant' } })
        return next
      })
      others.forEach((entry) => { if (session.user.id < entry.user_id) attachPeer(entry.user_id, true) })
    }

    channel.on('broadcast', { event: 'voice-signal' }, onSignal)
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, syncPresence)
      .on('presence', { event: 'leave' }, syncPresence)
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED' || disposed) return
        try {
          const pipeline = await createMicrophonePipeline({ inputDeviceId, mode: noiseMode, noiseSuppressionLevel })
          if (disposed) { pipeline.stop(); return }
          pipelineRef.current = pipeline
          localStreamRef.current = pipeline.stream
          processedStreamRef.current = pipeline.processedStream
          setUsingRnnoise(pipeline.usingRnnoise)
          await channel.track({ user_id: session.user.id, username: profile?.username || 'User' })
          setConnected(true)
          setTimeout(syncPresence, 80)
        } catch (e) {
          setError(e.message || 'Microphone permission was denied or audio processing could not start.')
        }
      })

    return () => {
      disposed = true
      channel.send({ type: 'broadcast', event: 'voice-signal', payload: { kind: 'hangup', from: session.user.id, to: '*' } }).catch(() => {})
      peersRef.current.forEach((peer) => peer.close())
      peersRef.current.clear()
      document.querySelectorAll('audio[data-voice-peer]').forEach((node) => node.remove())
      pipelineRef.current?.stop?.()
      pipelineRef.current = null
      localStreamRef.current = null
      processedStreamRef.current = null
      channelRef.current = null
      setConnected(false)
      supabase.removeChannel(channel)
    }
  }, [open, session?.user?.id, voiceKey, inputDeviceId, outputDeviceId, noiseMode, noiseSuppressionLevel])

  useEffect(() => { processedStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !muted }) }, [muted])
  useEffect(() => { document.querySelectorAll('audio[data-voice-peer]').forEach((node) => { node.volume = deafened ? 0 : 1 }) }, [deafened])

  if (!open) return null
  const title = context.kind === 'channel' ? `🔊 ${context.label}` : `☎ ${context.label}`
  const userCount = Object.keys(participants).length + (connected ? 1 : 0)

  return <div className="voice-overlay" role="dialog" aria-modal="true" aria-label="Voice chat">
    <div className="voice-modal" onClick={(event) => event.stopPropagation()}>
      <div className="voice-header"><div><span className="settings-kicker">VOICE</span><h2>{title}</h2><p>{connected ? `${userCount} participant${userCount === 1 ? '' : 's'}` : 'Connecting…'}</p></div><button className="modal-close" onClick={onClose}>×</button></div>
      <div className="voice-body">
        <div className="voice-status-card"><div className="voice-live-dot"/><div><strong>{connected ? 'Voice connected' : 'Connecting to voice'}</strong><small>{usingRnnoise ? 'RNNoise local noise cancellation' : 'Browser echo cancellation + processing'} • low-latency audio</small></div></div>
        {error && <div className="voice-error">{error}</div>}
        <div className="voice-participants">
          <div className="voice-participant-card local"><div className="voice-avatar">{profile?.username?.[0]?.toUpperCase() || '?'}</div><div><strong>{profile?.username || 'You'}</strong><small>You</small></div><span className="voice-mic">{muted ? '🔇' : '🎙'}</span></div>
          {Object.entries(participants).map(([id, info]) => <div className="voice-participant-card" key={id}><div className="voice-avatar">•</div><div><strong>{info.username || 'Participant'}</strong><small>Connected</small></div><span className="voice-mic">🎙</span></div>)}
        </div>
      </div>
      <div className="voice-controls"><button className={`voice-control ${muted ? 'active' : ''}`} onClick={() => setMuted((v) => !v)}>{muted ? '🔇 Unmute' : '🎙 Mute'}</button><button className={`voice-control ${deafened ? 'active' : ''}`} onClick={() => setDeafened((v) => !v)}>{deafened ? '🔇 Undeafen' : '🔊 Deafen'}</button><button className="voice-control danger" onClick={onClose}>☎ Leave</button></div>
    </div>
  </div>
}
export default VoiceChat
