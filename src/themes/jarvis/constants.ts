import type { OrbState } from '../../components/VoiceOrb/VoiceOrb.types'

export const COLOR_CYAN = { r: 0, g: 0.831, b: 1.0 } // #00d4ff
export const COLOR_RED = { r: 1.0, g: 0.2, b: 0.2 } // #ff3333

// ── Ring definitions ──────────────────────────────────────────────────────────

export const RING1_RADIUS = 1.45
export const RING1_PARTICLES = 300
export const RING1_WAVE_FREQ = 5
export const RING1_WAVE_SPEED = 1.2
export const RING1_TILT_X = 0.2618 // ~15°

export const RING2_RADIUS = 1.85
export const RING2_PARTICLES = 300
export const RING2_WAVE_FREQ = 4
export const RING2_WAVE_SPEED = -0.9
export const RING2_TILT_X = -0.1745 // ~-10°

export const RING_PARTICLE_SIZE = 0.025
export const RING_COLOR = 0x00d4ff
export const VOLUME_AMP = 0.18

// ── State config ──────────────────────────────────────────────────────────────

export interface StateConfig {
  bloomStrength: number
  amplitude: number
  sphereVol: number
  ringOpacity: number
  color: { r: number; g: number; b: number }
}

export const STATE_CONFIG: Record<OrbState, StateConfig> = {
  idle:         { bloomStrength: 0.7,  amplitude: 0.06, sphereVol: 0.1,  ringOpacity: 0.5,  color: COLOR_CYAN },
  connecting:   { bloomStrength: 0.9,  amplitude: 0.09, sphereVol: 0.15, ringOpacity: 0.6,  color: COLOR_CYAN },
  listening:    { bloomStrength: 1.1,  amplitude: 0.10, sphereVol: 0.2,  ringOpacity: 0.75, color: COLOR_CYAN },
  thinking:     { bloomStrength: 1.3,  amplitude: 0.12, sphereVol: 0.2,  ringOpacity: 0.8,  color: COLOR_CYAN },
  speaking:     { bloomStrength: 1.7,  amplitude: 0.06, sphereVol: 1.0,  ringOpacity: 1.0,  color: COLOR_CYAN },
  error:        { bloomStrength: 1.4,  amplitude: 0.15, sphereVol: 0.2,  ringOpacity: 0.7,  color: COLOR_RED },
  disconnected: { bloomStrength: 0.3,  amplitude: 0.03, sphereVol: 0.05, ringOpacity: 0.2,  color: COLOR_CYAN },
}

export const LERP_RATE = 0.04
