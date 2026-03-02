import type { OrbAdapter, AdapterCallbacks } from '../types'

// Peer dep: @pipecat-ai/client-js (or pipecat-client-web)
// npm install @pipecat-ai/client-js
//
// Usage:
//   import { PipecatClient } from '@pipecat-ai/client-js'
//   const pc = new PipecatClient({ transport, params: { baseUrl: '...' } })
//   const adapter = createPipecatAdapter(pc)
//   <VoiceOrb adapter={adapter} onStart={() => pc.connect()} onStop={() => pc.disconnect()} />

interface PipecatClientLike {
  on(event: string, handler: (...args: unknown[]) => void): void
  off(event: string, handler: (...args: unknown[]) => void): void
}

// ─── Signal processing constants ──────────────────────────────────────────────
// Pipecat fires onLocalAudioLevel / onRemoteAudioLevel at ~10Hz, values 0–1
const NOISE_FLOOR = 0.08           // gate below this
const EMA_ATTACK  = 0.65           // fast rise
const EMA_RELEASE = 0.12           // slow decay

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

/**
 * Creates an OrbAdapter for Pipecat voice pipelines (RTVI protocol).
 *
 * Accepts any PipecatClient-compatible object that exposes `.on()` / `.off()`.
 * Works with @pipecat-ai/client-js PipecatClient and RTVIClient.
 *
 * State mapping:
 *   onConnected              → 'connecting'
 *   onBotReady               → 'listening'
 *   onBotLlmStarted          → 'thinking'
 *   onBotStartedSpeaking     → 'speaking'
 *   onBotStoppedSpeaking     → 'listening'
 *   onUserStartedSpeaking    → 'listening'
 *   onDisconnected           → 'disconnected'
 *   onError                  → 'error'
 *
 * Volume mapping:
 *   onRemoteAudioLevel       → bot voice volume (during speaking)
 *   onLocalAudioLevel        → user mic volume (during listening)
 */
export function createPipecatAdapter(client: PipecatClientLike): OrbAdapter {
  return {
    subscribe({ onStateChange, onVolumeChange }: AdapterCallbacks) {
      const remoteEma = { value: 0 }
      const localEma  = { value: 0 }
      let isSpeaking = false

      // ─── State handlers ────────────────────────────────────────────────────
      const onConnected = () => {
        onStateChange('connecting')
      }
      const onBotReady = () => {
        onStateChange('listening')
        onVolumeChange(0)
      }
      const onBotLlmStarted = () => {
        if (!isSpeaking) onStateChange('thinking')
      }
      const onBotStartedSpeaking = () => {
        isSpeaking = true
        onStateChange('speaking')
      }
      const onBotStoppedSpeaking = () => {
        isSpeaking = false
        onVolumeChange(0)
        onStateChange('listening')
      }
      const onUserStartedSpeaking = () => {
        if (!isSpeaking) onStateChange('listening')
      }
      const onDisconnected = () => {
        onStateChange('disconnected')
        onVolumeChange(0)
      }
      const onError = () => {
        onStateChange('error')
        onVolumeChange(0)
      }

      // ─── Volume handlers ───────────────────────────────────────────────────
      // remoteAudioLevel fires when the bot is speaking
      const onRemoteAudioLevel = (level: unknown) => {
        if (typeof level !== 'number') return
        onVolumeChange(normalizeLevel(level, remoteEma))
      }
      // localAudioLevel fires from the user's mic
      const onLocalAudioLevel = (level: unknown) => {
        if (typeof level !== 'number') return
        if (!isSpeaking) onVolumeChange(normalizeLevel(level, localEma))
      }

      // ─── Register ──────────────────────────────────────────────────────────
      client.on('onConnected',          onConnected)
      client.on('onBotReady',           onBotReady)
      client.on('onBotLlmStarted',      onBotLlmStarted)
      client.on('onBotStartedSpeaking', onBotStartedSpeaking)
      client.on('onBotStoppedSpeaking', onBotStoppedSpeaking)
      client.on('onUserStartedSpeaking',onUserStartedSpeaking)
      client.on('onDisconnected',       onDisconnected)
      client.on('onError',              onError)
      client.on('onRemoteAudioLevel',   onRemoteAudioLevel)
      client.on('onLocalAudioLevel',    onLocalAudioLevel)

      return () => {
        client.off('onConnected',          onConnected)
        client.off('onBotReady',           onBotReady)
        client.off('onBotLlmStarted',      onBotLlmStarted)
        client.off('onBotStartedSpeaking', onBotStartedSpeaking)
        client.off('onBotStoppedSpeaking', onBotStoppedSpeaking)
        client.off('onUserStartedSpeaking',onUserStartedSpeaking)
        client.off('onDisconnected',       onDisconnected)
        client.off('onError',              onError)
        client.off('onRemoteAudioLevel',   onRemoteAudioLevel)
        client.off('onLocalAudioLevel',    onLocalAudioLevel)
        onVolumeChange(0)
      }
    },
  }
}
