import type { OrbAdapter, OrbSignal, OrbSignalListener, OrbState } from '../types'

// Minimal LiveKit interfaces. orb-ui does not import livekit-client directly so
// the SDK remains an app-owned dependency.

interface LKAnalyserResult {
  calculateVolume: () => number
  cleanup: () => Promise<void>
}

interface LKRemoteAudioTrack {
  mediaStreamTrack: MediaStreamTrack
  attach(): HTMLMediaElement
  detach(): HTMLMediaElement[]
}

interface LKTrackPublication {
  track?: LKRemoteAudioTrack
  source: string
}

interface LKParticipant {
  isLocal: boolean
  attributes?: Record<string, string>
  getTrackPublication(source: string): LKTrackPublication | undefined
  kind?: number
}

interface LKLocalParticipant {
  setMicrophoneEnabled(enabled: boolean): Promise<unknown>
}

interface LKRoom {
  connect(serverUrl: string, token: string, options?: Record<string, unknown>): Promise<void>
  disconnect(): void
  on: unknown
  off?: unknown
  removeListener?: unknown
  remoteParticipants: Map<string, LKParticipant>
  localParticipant: LKLocalParticipant
  state: string
}

interface LKCreateAudioAnalyser<TTrack = unknown> {
  (track: TTrack, options?: Record<string, unknown>): LKAnalyserResult
}

/** Agent participant kind value from LiveKit protocol (ParticipantKind.AGENT). */
const LK_PARTICIPANT_KIND_AGENT = 4

const NOISE_FLOOR = 0.03
const OUTPUT_GAIN = 1.5
const EMA_ATTACK = 0.6
const EMA_RELEASE = 0.2
const SIGMOID_K = 0.35

function mapAgentState(lkState: string): OrbState {
  switch (lkState) {
    case 'speaking':
      return 'speaking'
    case 'thinking':
      return 'thinking'
    case 'listening':
    case 'idle':
      return 'listening'
    case 'connecting':
    case 'pre-connect-buffering':
    case 'initializing':
      return 'connecting'
    case 'disconnected':
      return 'idle'
    case 'failed':
      return 'error'
    default:
      return 'idle'
  }
}

/** External mode: subscribe to a pre-existing Room. */
interface LiveKitExternalConfig<TTrack = unknown> {
  /** A connected Room instance from livekit-client. */
  room: LKRoom
  /** The createAudioAnalyser function from livekit-client. */
  createAudioAnalyser: LKCreateAudioAnalyser<TTrack>
}

/** Managed mode: adapter owns the Room lifecycle. */
interface LiveKitManagedConfig<TTrack = unknown> {
  /** LiveKit server URL, e.g. "wss://your-project.livekit.cloud". */
  serverUrl: string
  /** Access token for the room. Generate this on your server. */
  token: string
  /** The createAudioAnalyser function from livekit-client. */
  createAudioAnalyser: LKCreateAudioAnalyser<TTrack>
  /** The Room constructor from livekit-client. */
  RoomClass: new (...args: never[]) => LKRoom
}

export type LiveKitAdapterConfig<TTrack = unknown> =
  | LiveKitExternalConfig<TTrack>
  | LiveKitManagedConfig<TTrack>

export interface LiveKitOrbAdapter extends OrbAdapter {
  /** Connect to the LiveKit room and start tracking agent state. */
  start(): Promise<void>
  /** Disconnect from the LiveKit room. */
  stop(): Promise<void>
}

function isManagedConfig<TTrack>(
  config: LiveKitAdapterConfig<TTrack>,
): config is LiveKitManagedConfig<TTrack> {
  return 'serverUrl' in config && 'token' in config
}

function findAgentParticipant(room: LKRoom): LKParticipant | null {
  for (const [, participant] of room.remoteParticipants) {
    if (
      !participant.isLocal &&
      (participant.kind === LK_PARTICIPANT_KIND_AGENT ||
        participant.attributes?.['lk.agent.state'] !== undefined)
    ) {
      return participant
    }
  }

  return null
}

function removeRoomListener(room: LKRoom, event: string, listener: (...args: unknown[]) => void) {
  const off = room.off as
    | ((event: string, listener: (...args: unknown[]) => void) => void)
    | undefined
  if (off) {
    off.call(room, event, listener)
    return
  }

  const removeListener = room.removeListener as
    | ((event: string, listener: (...args: unknown[]) => void) => void)
    | undefined
  removeListener?.call(room, event, listener)
}

function addRoomListener(room: LKRoom, event: string, listener: (...args: unknown[]) => void) {
  const on = room.on as (event: string, listener: (...args: unknown[]) => void) => void
  on.call(room, event, listener)
}

/**
 * Creates an OrbAdapter for LiveKit Agents.
 *
 * Managed mode creates and owns a Room. External mode listens to a Room that
 * your app already connected. The adapter emits signal-native orb-ui state,
 * including LiveKit `thinking` as `OrbState` `"thinking"` and agent audio as
 * `outputVolume`.
 */
export function createLiveKitAdapter<TTrack = unknown>(
  config: LiveKitAdapterConfig<TTrack>,
): LiveKitOrbAdapter | OrbAdapter {
  const managed = isManagedConfig(config)
  const createAudioAnalyser = config.createAudioAnalyser as unknown as (
    track: LKRemoteAudioTrack,
    options?: Record<string, unknown>,
  ) => LKAnalyserResult
  const roomRef: { current: LKRoom | null } = {
    current: managed ? null : (config as LiveKitExternalConfig).room,
  }
  const listeners = new Set<OrbSignalListener>()

  let signal: OrbSignal = { state: 'idle', volume: 0, outputVolume: 0 }
  let currentState: OrbState = 'idle'
  let agentTrack: LKRemoteAudioTrack | null = null
  let audioEl: HTMLMediaElement | null = null
  let analyserResult: LKAnalyserResult | null = null
  let volumeInterval: ReturnType<typeof setInterval> | null = null
  let emaVol = 0
  let unsubscribeRoom: (() => void) | null = null

  function emitSignal(nextSignal: OrbSignal) {
    signal = nextSignal
    listeners.forEach((listener) => listener(nextSignal))
  }

  function emitPatch(patch: Partial<OrbSignal> & { state?: OrbState }) {
    emitSignal({ ...signal, ...patch, state: patch.state ?? signal.state })
  }

  function normalizeVolume(raw: number): number {
    const gated = raw < NOISE_FLOOR ? 0 : raw
    const rate = gated > emaVol ? EMA_ATTACK : EMA_RELEASE
    emaVol = emaVol + (gated - emaVol) * rate
    const gained = Math.min(emaVol * OUTPUT_GAIN, 1.0)
    return gained / (gained + SIGMOID_K)
  }

  function resetOutputVolume() {
    emaVol = 0
    emitPatch({ volume: 0, outputVolume: 0 })
  }

  function stopVolumeTracking({ emitZero = true }: { emitZero?: boolean } = {}) {
    if (volumeInterval) {
      clearInterval(volumeInterval)
      volumeInterval = null
    }

    if (analyserResult) {
      analyserResult.cleanup().catch(() => {})
      analyserResult = null
    }

    emaVol = 0
    if (emitZero) emitPatch({ volume: 0, outputVolume: 0 })
  }

  function startVolumeTracking(track: LKRemoteAudioTrack) {
    stopVolumeTracking()

    try {
      analyserResult = createAudioAnalyser(track)
    } catch (err) {
      console.warn('[orb-ui/livekit] createAudioAnalyser failed:', err)
      return
    }

    volumeInterval = setInterval(() => {
      if (!analyserResult || currentState !== 'speaking') return
      const outputVolume = normalizeVolume(analyserResult.calculateVolume())
      emitPatch({ volume: outputVolume, outputVolume })
    }, 33)
  }

  function setState(state: OrbState) {
    currentState = state
    emitPatch({ state })

    if (state === 'speaking' && agentTrack) {
      startVolumeTracking(agentTrack)
    } else if (state !== 'speaking') {
      stopVolumeTracking()
    }
  }

  function attachAudio(track: LKRemoteAudioTrack) {
    if (audioEl || typeof document === 'undefined') return
    audioEl = track.attach()
    audioEl.id = 'orb-ui-livekit-agent-audio'
    document.body.appendChild(audioEl)
  }

  function detachAudio() {
    if (!audioEl) return
    audioEl.remove()
    audioEl = null
  }

  function useAgentTrack(track: LKRemoteAudioTrack) {
    agentTrack = track
    attachAudio(track)
    if (currentState === 'speaking') startVolumeTracking(track)
  }

  function handleAgentState(lkState: string) {
    const mapped = mapAgentState(lkState)
    if (mapped === currentState) return
    setState(mapped)
  }

  function setupAgent(participant: LKParticipant) {
    const lkState = participant.attributes?.['lk.agent.state']
    if (lkState) handleAgentState(lkState)

    const publication = participant.getTrackPublication('microphone')
    if (publication?.track) useAgentTrack(publication.track)
  }

  function bindRoom(room: LKRoom) {
    if (unsubscribeRoom) return

    const onParticipantAttributesChanged = (
      changedAttrs: Record<string, string>,
      participant: LKParticipant,
    ) => {
      if (participant.isLocal) return
      const lkState = changedAttrs['lk.agent.state']
      if (lkState) handleAgentState(lkState)
    }

    const onTrackSubscribed = (
      track: LKRemoteAudioTrack,
      _publication: LKTrackPublication,
      participant: LKParticipant,
    ) => {
      if (participant.isLocal) return
      const isAgent =
        participant.kind === LK_PARTICIPANT_KIND_AGENT ||
        participant.attributes?.['lk.agent.state'] !== undefined
      if (!isAgent || track.mediaStreamTrack.kind !== 'audio') return

      useAgentTrack(track)
    }

    const onTrackUnsubscribed = (track: LKRemoteAudioTrack) => {
      if (agentTrack !== track) return
      agentTrack = null
      detachAudio()
      stopVolumeTracking()
    }

    const onDisconnected = () => {
      agentTrack = null
      detachAudio()
      stopVolumeTracking()
      setState('idle')
    }

    addRoomListener(
      room,
      'participantAttributesChanged',
      onParticipantAttributesChanged as (...args: unknown[]) => void,
    )
    addRoomListener(room, 'trackSubscribed', onTrackSubscribed as (...args: unknown[]) => void)
    addRoomListener(room, 'trackUnsubscribed', onTrackUnsubscribed as (...args: unknown[]) => void)
    addRoomListener(room, 'disconnected', onDisconnected)

    unsubscribeRoom = () => {
      removeRoomListener(
        room,
        'participantAttributesChanged',
        onParticipantAttributesChanged as (...args: unknown[]) => void,
      )
      removeRoomListener(room, 'trackSubscribed', onTrackSubscribed as (...args: unknown[]) => void)
      removeRoomListener(
        room,
        'trackUnsubscribed',
        onTrackUnsubscribed as (...args: unknown[]) => void,
      )
      removeRoomListener(room, 'disconnected', onDisconnected)
    }

    if (room.state === 'connected') {
      const agent = findAgentParticipant(room)
      if (agent) {
        setupAgent(agent)
      } else {
        setState('connecting')
      }
    } else {
      setState('idle')
    }
  }

  function unbindRoom() {
    unsubscribeRoom?.()
    unsubscribeRoom = null
    agentTrack = null
    detachAudio()
    stopVolumeTracking()
  }

  const subscribe: OrbAdapter['subscribe'] = (listener) => {
    listeners.add(listener)
    listener(signal)

    const room = roomRef.current
    if (room) bindRoom(room)

    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) unbindRoom()
    }
  }

  if (!managed) return { subscribe }

  return {
    subscribe,

    async start() {
      if (roomRef.current) return

      const cfg = config as LiveKitManagedConfig
      const nextRoom = new cfg.RoomClass()
      setState('connecting')

      try {
        await nextRoom.connect(cfg.serverUrl, cfg.token)
        roomRef.current = nextRoom
        bindRoom(nextRoom)
        await nextRoom.localParticipant.setMicrophoneEnabled(true)
      } catch (err) {
        console.error('[orb-ui/livekit] connect failed:', err)
        nextRoom.disconnect()
        roomRef.current = null
        setState('error')
        resetOutputVolume()
        emitPatch({ error: err })
        throw err
      }
    },

    async stop() {
      const room = roomRef.current
      if (!room) {
        setState('idle')
        return
      }

      unbindRoom()
      room.disconnect()
      roomRef.current = null
      setState('idle')
    },
  }
}
