import type { OrbState } from '../../components/VoiceOrb/VoiceOrb.types'

export const COLOR_CYAN = { r: 0, g: 0.831, b: 1.0 } // #00d4ff
export const COLOR_RED = { r: 1.0, g: 0.2, b: 0.2 } // #ff3333

export interface StateConfig {
  bloomStrength: number
  brightness: number
  sphereSpeed: number
  ringOpacity: number
  volMult: number
  color: { r: number; g: number; b: number }
}

export const STATE_CONFIG: Record<OrbState, StateConfig> = {
  idle:         { bloomStrength: 0.6,  brightness: 0.6,  sphereSpeed: 0.15, ringOpacity: 0.4, volMult: 0.3,  color: COLOR_CYAN },
  connecting:   { bloomStrength: 0.9,  brightness: 0.8,  sphereSpeed: 0.4,  ringOpacity: 0.6, volMult: 0.4,  color: COLOR_CYAN },
  listening:    { bloomStrength: 1.1,  brightness: 0.9,  sphereSpeed: 0.5,  ringOpacity: 0.7, volMult: 0.5,  color: COLOR_CYAN },
  thinking:     { bloomStrength: 1.3,  brightness: 1.0,  sphereSpeed: 0.8,  ringOpacity: 0.8, volMult: 0.6,  color: COLOR_CYAN },
  speaking:     { bloomStrength: 1.8,  brightness: 1.2,  sphereSpeed: 1.0,  ringOpacity: 1.0, volMult: 1.0,  color: COLOR_CYAN },
  error:        { bloomStrength: 1.5,  brightness: 1.1,  sphereSpeed: 0.3,  ringOpacity: 0.8, volMult: 0.2,  color: COLOR_RED },
  disconnected: { bloomStrength: 0.3,  brightness: 0.3,  sphereSpeed: 0.05, ringOpacity: 0.2, volMult: 0.1,  color: COLOR_CYAN },
}

export const RING_DEFS = [
  { radius: 1.35, tube: 0.008, tiltX: 0.2,  tiltZ: 0.1,  speed: 0.4 },
  { radius: 1.6,  tube: 0.006, tiltX: -0.3, tiltZ: 0.5,  speed: -0.25 },
  { radius: 1.85, tube: 0.005, tiltX: 0.1,  tiltZ: -0.2, speed: 0.15 },
]

export const PARTICLE_COUNT = 800
export const PARTICLE_RADIUS_MIN = 1.9
export const PARTICLE_RADIUS_MAX = 2.4
export const PARTICLE_SIZE = 0.015
export const PARTICLE_BASE_OPACITY = 0.6

export const LERP_RATE = 0.04
