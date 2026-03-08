import type { OrbState, OrbAdapter } from '../components/Orb/Orb.types'

export type { OrbState, OrbAdapter }

export interface AdapterCallbacks {
  onStateChange: (state: OrbState) => void
  onVolumeChange: (volume: number) => void
}
