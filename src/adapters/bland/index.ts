import type { OrbAdapter, AdapterCallbacks } from '../types'

// Peer dep: @blandsdk/client
// npm install @blandsdk/client
//
// Bland requires a server-side session token for each call.
// Your server calls the Admin SDK to create a session, then passes the token
// to the client. See: https://github.com/CINTELLILABS/bland-client-js-sdk
//
// Usage:
//   import Bland from '@blandsdk/client'
//   import { useWebchat } from '@blandsdk/client/react'
//
//   // Server side (e.g. Express):
//   const bland = new Bland({ admin: { apiKey: process.env.BLAND_API_KEY } })
//   app.post('/api/agent-authorize', async (req, res) => {
//     const admin = await bland.AdminClient()
//     const session = await admin.sessions.create({ agentId: req.body.agentId })
//     res.json({ token: session.token })
//   })
//
//   // Client side:
//   const getToken = async () => fetch('/api/agent-authorize', { ... }).then(r => r.json())
//   const { start, stop, webchat } = useWebchat({ agentId, getToken })
//   const adapter = createBlandAdapter(webchat)
//   <VoiceOrb adapter={adapter} onStart={start} onStop={stop} />

interface BlandWebchatEmitter {
  on(event: string, handler: (...args: unknown[]) => void): () => void
}

// ─── Signal processing constants ──────────────────────────────────────────────
const POLL_HZ    = 30              // analyser poll rate
const NOISE_FLOOR = 0.08
const EMA_ATTACK  = 0.65
const EMA_RELEASE = 0.12

function normalizeLevel(raw: number, ema: { value: number }): number {
  if (raw < NOISE_FLOOR) {
    ema.value *= EMA_RELEASE
    return ema.value
  }
  const lin = (raw - NOISE_FLOOR) / (1 - NOISE_FLOOR)
  const alpha = lin > ema.value ? EMA_ATTACK : EMA_RELEASE
  ema.value = alpha * lin + (1 - alpha) * ema.value
  return ema.value
}

// ─── Web Audio volume tap ──────────────────────────────────────────────────────
// Bland doesn't expose volume natively. We attach an AnalyserNode to any
// <audio> element the SDK adds to the DOM and poll RMS amplitude.

function attachAnalyser(
  audioEl: HTMLAudioElement,
  onVolume: (v: number) => void,
): () => void {
  let rafId: number
  let stopped = false

  try {
    const ctx = new AudioContext()
    const src = ctx.createMediaElementSource(audioEl)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    src.connect(analyser)
    analyser.connect(ctx.destination)
    const buf = new Uint8Array(analyser.frequencyBinCount)
    const ema = { value: 0 }
    const interval = 1000 / POLL_HZ

    let lastPoll = 0
    const poll = (now: number) => {
      if (stopped) return
      rafId = requestAnimationFrame(poll)
      if (now - lastPoll < interval) return
      lastPoll = now
      analyser.getByteTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / buf.length)
      onVolume(normalizeLevel(rms, ema))
    }
    rafId = requestAnimationFrame(poll)

    return () => {
      stopped = true
      cancelAnimationFrame(rafId)
      src.disconnect()
      analyser.disconnect()
      void ctx.close()
    }
  } catch {
    // Web Audio not available — emit 0
    return () => {}
  }
}

// Watch for <audio> elements added to the DOM by the Bland SDK
function watchForAudio(
  onAudio: (el: HTMLAudioElement) => void,
): () => void {
  // Check for existing audio elements first
  const existing = document.querySelector('audio') as HTMLAudioElement | null
  if (existing) {
    onAudio(existing)
    return () => {}
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of Array.from(m.addedNodes)) {
        if (node instanceof HTMLAudioElement) {
          onAudio(node)
          observer.disconnect()
          return
        }
        if (node instanceof Element) {
          const audio = node.querySelector('audio') as HTMLAudioElement | null
          if (audio) {
            onAudio(audio)
            observer.disconnect()
            return
          }
        }
      }
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}

/**
 * Creates an OrbAdapter for Bland AI voice agents.
 *
 * Accepts the `webchat` emitter returned by Bland's `useWebchat` hook.
 * Volume is derived from a Web Audio AnalyserNode attached to the bot's
 * <audio> element (Bland doesn't expose volume natively).
 *
 * State mapping:
 *   open                              → 'connecting'
 *   message (streamSid received)      → 'listening' (connected, waiting)
 *   update (payload.type=assistant)   → 'speaking'
 *   update (payload.type=human)       → 'listening'
 *   closed                            → 'disconnected'
 *   error                             → 'error'
 */
export function createBlandAdapter(webchat: BlandWebchatEmitter): OrbAdapter {
  return {
    subscribe({ onStateChange, onVolumeChange }: AdapterCallbacks) {
      let stopAnalyser: (() => void) | null = null
      let stopWatcher: (() => void) | null = null
      let isSpeaking = false

      // Start watching for Bland's audio element
      stopWatcher = watchForAudio((audioEl) => {
        stopAnalyser = attachAnalyser(audioEl, (v) => {
          if (isSpeaking) onVolumeChange(v)
        })
      })

      // ─── State event handlers ──────────────────────────────────────────────
      const offOpen = webchat.on('open', () => {
        onStateChange('connecting')
        onVolumeChange(0)
      })

      const offMessage = webchat.on('message', (raw: unknown) => {
        const m = raw as { streamSid?: string } | null
        // First message with streamSid = call is live
        if (m?.streamSid) {
          onStateChange('listening')
        }
      })

      const offUpdate = webchat.on('update', (raw: unknown) => {
        const m = raw as { payload?: { type?: string; text?: string } } | null
        const type = m?.payload?.type
        if (type === 'assistant') {
          isSpeaking = true
          onStateChange('speaking')
        } else if (type === 'human') {
          isSpeaking = false
          onVolumeChange(0)
          onStateChange('listening')
        }
      })

      const offClosed = webchat.on('closed', () => {
        isSpeaking = false
        onStateChange('disconnected')
        onVolumeChange(0)
        stopAnalyser?.()
        stopAnalyser = null
      })

      const offError = webchat.on('error', () => {
        isSpeaking = false
        onStateChange('error')
        onVolumeChange(0)
      })

      return () => {
        offOpen?.()
        offMessage?.()
        offUpdate?.()
        offClosed?.()
        offError?.()
        stopAnalyser?.()
        stopWatcher?.()
        onVolumeChange(0)
      }
    },
  }
}
