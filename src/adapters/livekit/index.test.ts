import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLiveKitAdapter } from './index'
import type { OrbSignal } from '../types'

type Listener = (...args: unknown[]) => void

class FakeTrack {
  mediaStreamTrack = { kind: 'audio' } as MediaStreamTrack
  audioElement = { id: '', remove: vi.fn() } as unknown as HTMLMediaElement
  attach = vi.fn(() => this.audioElement)
  detach = vi.fn(() => [this.audioElement])
}

class FakeParticipant {
  isLocal = false
  attributes: Record<string, string>
  kind?: number
  private track?: FakeTrack

  constructor(options: { attributes?: Record<string, string>; kind?: number; track?: FakeTrack }) {
    this.attributes = options.attributes ?? {}
    this.kind = options.kind
    this.track = options.track
  }

  getTrackPublication(source: string) {
    if (source !== 'microphone' || !this.track) return undefined
    return {
      source,
      track: this.track,
    }
  }
}

class FakeRoom {
  remoteParticipants = new Map<string, FakeParticipant>()
  localParticipant = {
    setMicrophoneEnabled: vi.fn(async () => undefined),
  }
  state = 'disconnected'
  connect = vi.fn(async () => {
    this.state = 'connected'
  })
  disconnect = vi.fn(() => {
    this.state = 'disconnected'
  })

  private listeners = new Map<string, Set<Listener>>()

  on(event: string, listener: Listener) {
    const listeners = this.listeners.get(event) ?? new Set<Listener>()
    listeners.add(listener)
    this.listeners.set(event, listeners)
  }

  off(event: string, listener: Listener) {
    this.listeners.get(event)?.delete(listener)
  }

  emit(event: string, ...args: unknown[]) {
    this.listeners.get(event)?.forEach((listener) => listener(...args))
  }

  listenerCount(event: string) {
    return this.listeners.get(event)?.size ?? 0
  }
}

function collectSignals(adapter: { subscribe(listener: (signal: OrbSignal) => void): () => void }) {
  const signals: OrbSignal[] = []
  const unsubscribe = adapter.subscribe((signal) => signals.push(signal))
  return { signals, unsubscribe }
}

function createDocumentStub() {
  const appendChild = vi.fn()
  vi.stubGlobal('document', {
    body: {
      appendChild,
    },
  })
  return { appendChild }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('createLiveKitAdapter', () => {
  it('subscribes to an existing room and emits agent signal and output volume', () => {
    vi.useFakeTimers()
    const { appendChild } = createDocumentStub()
    const track = new FakeTrack()
    const room = new FakeRoom()
    room.state = 'connected'
    room.remoteParticipants.set(
      'agent',
      new FakeParticipant({
        attributes: { 'lk.agent.state': 'speaking' },
        kind: 4,
        track,
      }),
    )
    const analyser = {
      calculateVolume: vi.fn(() => 0.5),
      cleanup: vi.fn(async () => undefined),
    }

    const adapter = createLiveKitAdapter({
      room,
      createAudioAnalyser: () => analyser,
    })
    const { signals, unsubscribe } = collectSignals(adapter)

    vi.advanceTimersByTime(33)

    expect(signals.some((signal) => signal.state === 'speaking')).toBe(true)
    expect(signals.at(-1)).toMatchObject({ state: 'speaking' })
    expect(signals.at(-1)?.outputVolume).toBeGreaterThan(0)
    expect(track.attach).toHaveBeenCalledOnce()
    expect(appendChild).toHaveBeenCalledWith(track.audioElement)

    room.emit(
      'participantAttributesChanged',
      { 'lk.agent.state': 'thinking' },
      new FakeParticipant({ attributes: { 'lk.agent.state': 'thinking' }, kind: 4 }),
    )

    expect(signals.at(-1)).toMatchObject({ state: 'thinking', volume: 0, outputVolume: 0 })
    expect(analyser.cleanup).toHaveBeenCalledOnce()

    unsubscribe()
  })

  it('keeps external rooms non-interactive and detaches agent audio on unsubscribe', () => {
    vi.useFakeTimers()
    createDocumentStub()
    const track = new FakeTrack()
    const room = new FakeRoom()
    room.state = 'connected'
    room.remoteParticipants.set(
      'agent',
      new FakeParticipant({
        attributes: { 'lk.agent.state': 'speaking' },
        kind: 4,
        track,
      }),
    )

    const adapter = createLiveKitAdapter({
      room,
      createAudioAnalyser: () => ({
        calculateVolume: () => 0.4,
        cleanup: async () => undefined,
      }),
    })

    expect(adapter.start).toBeUndefined()
    expect(adapter.stop).toBeUndefined()

    const { unsubscribe } = collectSignals(adapter)
    room.emit('trackUnsubscribed', track)

    expect(track.audioElement.remove).toHaveBeenCalledOnce()

    unsubscribe()
  })

  it('connects and disconnects a managed room without losing the subscriber', async () => {
    const signals: OrbSignal[] = []

    class RoomClass extends FakeRoom {
      static instance: FakeRoom | undefined

      constructor() {
        super()
        RoomClass.instance = this
      }
    }

    const adapter = createLiveKitAdapter({
      serverUrl: 'wss://example.livekit.cloud',
      token: 'token',
      createAudioAnalyser: () => ({
        calculateVolume: () => 0,
        cleanup: async () => undefined,
      }),
      RoomClass,
    })

    const unsubscribe = adapter.subscribe((signal) => signals.push(signal))
    await adapter.start?.()

    expect(RoomClass.instance?.connect).toHaveBeenCalledWith('wss://example.livekit.cloud', 'token')
    expect(RoomClass.instance?.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true)
    expect(signals.some((signal) => signal.state === 'connecting')).toBe(true)
    expect(RoomClass.instance?.listenerCount('participantAttributesChanged')).toBe(1)

    await adapter.stop?.()

    expect(RoomClass.instance?.disconnect).toHaveBeenCalledOnce()
    expect(signals.at(-1)).toMatchObject({ state: 'idle', volume: 0, outputVolume: 0 })

    unsubscribe()
  })
})
