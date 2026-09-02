import { NoiseSuppressorWorklet_Name } from '@timephy/rnnoise-wasm'
import NoiseSuppressorWorklet from '@timephy/rnnoise-wasm/NoiseSuppressorWorklet?worker&url'

function getAudioContext() {
  return window.AudioContext || window.webkitAudioContext
}

export async function createMicrophonePipeline({
  inputDeviceId = '',
  mode = 'rnnoise',
  noiseSuppressionLevel = 85,
}) {
  const AudioContextCtor = getAudioContext()
  if (!AudioContextCtor) throw new Error('Web Audio is not supported by this browser.')

  const context = new AudioContextCtor({ latencyHint: 'interactive' })
  if (context.state === 'suspended') await context.resume()

  const wantsRnnoise = mode === 'rnnoise'
  let rnnoiseNode = null
  let usingRnnoise = false

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: inputDeviceId ? { exact: inputDeviceId } : undefined,
      // RNNoise handles noise suppression locally. Keep browser echo
      // cancellation enabled to prevent speaker-to-mic feedback during calls.
      echoCancellation: true,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
      latency: 0,
    },
  })

  const source = context.createMediaStreamSource(stream)

  const highpass = context.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 75
  highpass.Q.value = 0.7

  const compressor = context.createDynamicsCompressor()
  compressor.threshold.value = -30
  compressor.knee.value = 16
  compressor.ratio.value = 2.5
  compressor.attack.value = 0.003
  compressor.release.value = 0.12

  const gain = context.createGain()
  gain.gain.value = 1.35

  const destination = context.createMediaStreamDestination()

  if (wantsRnnoise) {
    try {
      await context.audioWorklet.addModule(NoiseSuppressorWorklet)
      rnnoiseNode = new AudioWorkletNode(context, NoiseSuppressorWorklet_Name, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
      })
      source.connect(rnnoiseNode)
      rnnoiseNode.connect(highpass)
      usingRnnoise = true
      // Current RNNoise worklet does not expose a continuous 0–100 strength
      // control, so keep the setting for UI compatibility and future tuning.
      rnnoiseNode.port?.postMessage?.({
        type: 'noise-suppression-level',
        level: Math.max(0, Math.min(100, Number(noiseSuppressionLevel) || 85)),
      })
    } catch (error) {
      // Graceful fallback to browser DSP if RNNoise cannot initialize.
      console.warn('RNNoise initialization failed; using browser processing.', error)
      source.connect(highpass)
    }
  } else {
    source.connect(highpass)
  }

  highpass.connect(compressor)
  compressor.connect(gain)
  gain.connect(destination)

  return {
    stream,
    processedStream: destination.stream,
    context,
    nodes: { source, rnnoiseNode, highpass, compressor, gain, destination },
    usingRnnoise,
    usingKrisp: false,
    async setNoiseSuppressionLevel() {
      // RNNoise's neural model does not expose a user-facing intensity control.
    },
    stop() {
      try {
        rnnoiseNode?.disconnect()
        source.disconnect()
        highpass.disconnect()
        compressor.disconnect()
        gain.disconnect()
        destination.disconnect?.()
      } catch (error) {
        console.debug('Voice audio node cleanup skipped:', error)
      }
      stream.getTracks().forEach((track) => track.stop())
      try { context.close() } catch (error) { console.debug('AudioContext close skipped:', error) }
    },
  }
}

export async function createMonitorPipeline({
  inputDeviceId = '',
  outputDeviceId = '',
  noiseSuppressionLevel = 85,
  mode = 'rnnoise',
}) {
  const pipeline = await createMicrophonePipeline({
    inputDeviceId,
    mode,
    noiseSuppressionLevel,
  })

  if (outputDeviceId && typeof pipeline.context.setSinkId === 'function') {
    try { await pipeline.context.setSinkId(outputDeviceId) } catch (error) { console.debug('Output device selection unavailable:', error) }
  }

  const source = pipeline.context.createMediaStreamSource(pipeline.processedStream)
  const outputGain = pipeline.context.createGain()
  outputGain.gain.value = 0.38
  source.connect(outputGain).connect(pipeline.context.destination)

  const stop = pipeline.stop
  pipeline.stop = () => {
    try { source.disconnect(); outputGain.disconnect() } catch (error) { console.debug('Monitor node cleanup skipped:', error) }
    stop()
  }
  return pipeline
}
