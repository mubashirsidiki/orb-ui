import type { OrbAdapter, OrbState, AdapterCallbacks } from '../types'

// Minimal interface for the Vapi client from @vapi-ai/web.
// We define our own so orb-ui doesn't require @vapi-ai/web as a dependency —
// users already have it installed.
interface VapiClient {
  on(event: 'call-start', listener: () => void): void
  on(event: 'call-end', listener: () => void): void
  on(event: 'speech-start', listener: () => void): void
  on(event: 'speech-end', listener: () => void): void
  on(event: 'volume-level', listener: (volume: number) => void): void
  on(event: 'message', listener: (message: VapiMessage) => void): void
  on(event: 'error', listener: (error: unknown) => void): void
  removeListener(event: string, listener: (...args: unknown[]) => void): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  start(...args: any[]): Promise<unknown>
}

interface VapiMessage {
  type: string
  role?: string
  transcriptType?: 'partial' | 'final'
  transcript?: string
}

// ─── Vapi-specific volume normalization ───────────────────────────────────────
//
// Vapi's volume-level events have two quirks that must be handled before the
// signal reaches the visual layer:
//
// 1. QUANTIZED VALUES — Vapi only ever emits 6 discrete levels:
//       0, 0.000667, 0.00667, 0.0667, 0.667, 1.0   (each ~10× the previous)
//    These are not a continuous signal; they're essentially log-scale buckets.
//
// 2. ALTERNATING PATTERN — During speech, values frequently alternate between
//    loud (0.667 / 1.0) and near-zero every ~100ms. This is a Vapi artifact,
//    not actual silence between words. Without treatment it causes visible
//    jitter in any animation driven by this signal.
//
// Normalization pipeline (runs at Vapi tick rate, ~10 Hz):
//   a. Noise gate — anything below NOISE_FLOOR is treated as silence (→ 0).
//   b. Linear ramp — rescales the gated value to the full 0–1 range.
//   c. EMA — smooths the alternating loud/silent pattern.
//      Fast attack (0.65) catches new speech; slow release (0.12) bridges dips.

const NOISE_FLOOR = 0.12

// ─── Vapi-specific state debouncing ──────────────────────────────────────────
//
// Vapi fires  speaking → listening → speaking  within ~200 ms at every
// turn boundary. Fix: debounce the speaking → listening transition by 350 ms.

function makeStateEmitter(onStateChange: (s: OrbState) => void) {
  let lastEmitted: OrbState = 'idle'
  let timer: ReturnType<typeof setTimeout> | null = null

  function emitState(next: OrbState) {
    if (timer) { clearTimeout(timer); timer = null }

    if (lastEmitted === 'speaking' && next === 'listening') {
      timer = setTimeout(() => {
        lastEmitted = next
        onStateChange(next)
        timer = null
      }, 350)
      return
    }

    lastEmitted = next
    onStateChange(next)
  }

  function clearTimer() {
    if (timer) { clearTimeout(timer); timer = null }
  }

  return { emitState, clearTimer }
}

/**
 * Creates an OrbAdapter for Vapi voice agents.
 *
 * State mapping:
 *   vapi.start() called (intercepted)      → 'connecting'
 *   call-start                             → 'listening'
 *   message (final user transcript)        → 'thinking'
 *   speech-start                           → 'speaking'
 *   speech-end                             → 'listening'  (debounced 350 ms)
 *   call-end                               → 'disconnected'
 *   error                                  → 'error'
 *
 * Volume: raw Vapi values are normalized (noise gate + EMA) before being
 * passed to onVolumeChange, so themes receive a clean 0–1 signal.
 *
 * @param client - A Vapi instance from @vapi-ai/web
 */
export function createVapiAdapter(client: VapiClient): OrbAdapter {
  // ── Per-adapter EMA state ────────────────────────────────────────────────
  // Kept inside the factory so multiple adapter instances never share state.
  let emaVol = 0

  function normalizeVapiVolume(raw: number): number {
    const gated = raw < NOISE_FLOOR ? 0 : (raw - NOISE_FLOOR) / (1 - NOISE_FLOOR)
    const rate  = gated > emaVol ? 0.65 : 0.12
    emaVol      = emaVol + (gated - emaVol) * rate
    return emaVol
  }

  // ── Mic leak prevention ──────────────────────────────────────────────────
  // Vapi's WebRTC teardown doesn't always release the microphone track,
  // especially on repeated start/stop cycles. We intercept getUserMedia to
  // capture the stream reference, then explicitly stop all tracks on call-end.
  let latestAudioStream: MediaStream | null = null

  if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
    const _origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await _origGUM(constraints)
      if (constraints?.audio) latestAudioStream = stream
      return stream
    }
  }

  function releaseMic() {
    latestAudioStream?.getTracks().forEach(track => {
      if (track.readyState === 'live') track.stop()
    })
    latestAudioStream = null
  }

  return {
    subscribe({ onStateChange, onVolumeChange }: AdapterCallbacks) {
      const { emitState, clearTimer } = makeStateEmitter(onStateChange)

      const onCallStart  = () => emitState('listening')

      const onCallEnd = () => {
        emitState('disconnected')
        onVolumeChange(0)
        emaVol = 0
        releaseMic()
      }

      const onSpeechStart = () => emitState('speaking')

      const onSpeechEnd = () => {
        emitState('listening')   // debounced — may be suppressed if speaking fires again quickly
        onVolumeChange(0)
      }

      const onVolumeLevel = (volume: number) => {
        onVolumeChange(normalizeVapiVolume(volume))
      }

      const onMessage = (message: VapiMessage) => {
        if (
          message.type === 'transcript' &&
          message.transcriptType === 'final' &&
          message.role === 'user'
        ) {
          emitState('thinking')
          onVolumeChange(0)
        }
      }

      const onError = (error: unknown) => {
        console.error('[orb-ui/vapi] Error:', error)
        emitState('error')
        onVolumeChange(0)
        emaVol = 0
        releaseMic()
      }

      client.on('call-start',   onCallStart)
      client.on('call-end',     onCallEnd)
      client.on('speech-start', onSpeechStart)
      client.on('speech-end',   onSpeechEnd)
      client.on('volume-level', onVolumeLevel)
      client.on('message',      onMessage)
      client.on('error',        onError)

      // Intercept vapi.start() to emit 'connecting' immediately
      const originalStart = client.start.bind(client)
      client.start = async (...args) => {
        emitState('connecting')
        return originalStart(...args)
      }

      return () => {
        clearTimer()
        client.removeListener('call-start',   onCallStart as () => void)
        client.removeListener('call-end',     onCallEnd as () => void)
        client.removeListener('speech-start', onSpeechStart as () => void)
        client.removeListener('speech-end',   onSpeechEnd as () => void)
        client.removeListener('volume-level', onVolumeLevel as (...args: unknown[]) => void)
        client.removeListener('message',      onMessage as (...args: unknown[]) => void)
        client.removeListener('error',        onError as (...args: unknown[]) => void)
        client.start = originalStart
        releaseMic()
      }
    },
  }
}
