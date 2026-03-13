import type { OrbState, OrbAdapter } from '../components/Orb/Orb.types'

export type { OrbState, OrbAdapter }

export interface AdapterCallbacks {
  onStateChange: (state: OrbState) => void
  onVolumeChange: (volume: number) => void
}

/**
 * Shared mic volume curve — rescale real-world mic range to 0–1 with pow shaping.
 * Used by both Vapi and ElevenLabs adapters for consistent listening visuals.
 */
export function normalizeMicVolume(v: number): number {
  let vol = Math.min(v / 0.5, 1.0)
  vol = Math.pow(vol, 1.3)
  return vol
}
