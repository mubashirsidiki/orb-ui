import { Orb } from 'orb-ui'
import { createElevenLabsAdapter, createLiveKitAdapter } from 'orb-ui/adapters'
import type {
  ElevenLabsConversationClass,
  LiveKitAdapterConfig,
  OrbAdapter,
  OrbSignal,
} from 'orb-ui/adapters'

const Conversation: ElevenLabsConversationClass = {
  startSession: async () => ({
    endSession: async () => undefined,
    getInputVolume: () => 0,
    getOutputVolume: () => 0,
    getInputByteFrequencyData: () => new Uint8Array(),
    getOutputByteFrequencyData: () => new Uint8Array(),
  }),
}

const elevenLabsAdapter = createElevenLabsAdapter(Conversation, {
  agentId: 'agent-id',
})

const customAdapter: OrbAdapter = {
  subscribe: (listener) => {
    listener({ state: 'thinking' })
    return () => undefined
  },
}

const signal: OrbSignal = {
  state: 'speaking',
  outputVolume: 0.7,
}

const liveKitConfig: LiveKitAdapterConfig = {
  serverUrl: 'wss://example.livekit.cloud',
  token: 'livekit-token',
  createAudioAnalyser: () => ({
    calculateVolume: () => 0,
    cleanup: async () => undefined,
  }),
  RoomClass: class {
    remoteParticipants = new Map()
    localParticipant = {
      setMicrophoneEnabled: async () => undefined,
    }
    state = 'disconnected'
    connect = async () => undefined
    disconnect = () => undefined
    on = () => undefined
    off = () => undefined
  },
}

const liveKitAdapter = createLiveKitAdapter(liveKitConfig)

export function PackageConsumerSmoke() {
  return (
    <>
      <Orb adapter={elevenLabsAdapter} theme="circle" aria-label="Start ElevenLabs assistant" />
      <Orb adapter={liveKitAdapter} theme="circle" aria-label="Start LiveKit assistant" />
      <Orb adapter={customAdapter} theme="debug" />
      <Orb signal={signal} theme="circle" />
    </>
  )
}
