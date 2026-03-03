import type { OrbState } from '../../components/VoiceOrb/VoiceOrb.types'

// ─── Base scale reference ─────────────────────────────────────────────────────
// All radii are expressed as fractions of a 240px canvas, then scaled by size/240.

export const BASE_SIZE = 240
export const HALF = BASE_SIZE / 2

// ─── Radii (in base 240px units) ─────────────────────────────────────────────
export const CORE_BASE_RADIUS = 16
export const CORE_MAX_RADIUS  = 26

export const RING1_RADIUS = 55
export const RING2_RADIUS = 78
export const RING3_RADIUS = 100

export const PARTICLE_INNER_RADIUS = 70
export const PARTICLE_OUTER_RADIUS = 110

// ─── Colors ───────────────────────────────────────────────────────────────────
export const COLOR_CYAN  = '#00d4ff'
export const COLOR_RED   = '#ff4444'

// ─── Per-state config ─────────────────────────────────────────────────────────
interface StateConfig {
  targetBrightness: number   // 0–1, overall opacity/glow multiplier
  ringSpeedMult: number      // base rotation speed multiplier for rings
  scanLineMult: number       // scan line speed multiplier
  flicker: boolean           // whether to apply a flicker effect
  color: string              // base color
}

export const STATE_CONFIG: Record<OrbState, StateConfig> = {
  idle: {
    targetBrightness: 0.4,
    ringSpeedMult:    0.3,
    scanLineMult:     1.0,
    flicker:          false,
    color:            COLOR_CYAN,
  },
  connecting: {
    targetBrightness: 0.6,
    ringSpeedMult:    1.0,
    scanLineMult:     1.5,
    flicker:          true,
    color:            COLOR_CYAN,
  },
  listening: {
    targetBrightness: 0.7,
    ringSpeedMult:    0.7,
    scanLineMult:     1.0,
    flicker:          false,
    color:            COLOR_CYAN,
  },
  thinking: {
    targetBrightness: 0.85,
    ringSpeedMult:    1.4,
    scanLineMult:     2.5,
    flicker:          true,
    color:            COLOR_CYAN,
  },
  speaking: {
    targetBrightness: 1.0,
    ringSpeedMult:    1.5,
    scanLineMult:     1.2,
    flicker:          false,
    color:            COLOR_CYAN,
  },
  error: {
    targetBrightness: 0.9,
    ringSpeedMult:    0.8,
    scanLineMult:     0.8,
    flicker:          true,
    color:            COLOR_RED,
  },
  disconnected: {
    targetBrightness: 0.15,
    ringSpeedMult:    0.05,
    scanLineMult:     0.1,
    flicker:          false,
    color:            COLOR_CYAN,
  },
}

// ─── Ring definitions ─────────────────────────────────────────────────────────
export interface RingDef {
  radius:      number   // base radius (240px units)
  segments:    number   // number of arc segments
  gapFraction: number   // fraction of circumference that are gaps
  direction:   1 | -1  // 1 = clockwise, -1 = counter-clockwise
  baseSpeed:   number   // radians per frame at 60fps baseline
  lineWidth:   number
  glowSize:    number
}

export const RING_DEFS: RingDef[] = [
  {
    radius:      RING1_RADIUS,
    segments:    4,
    gapFraction: 0.15,
    direction:   1,
    baseSpeed:   0.008,
    lineWidth:   1.5,
    glowSize:    10,
  },
  {
    radius:      RING2_RADIUS,
    segments:    6,
    gapFraction: 0.20,
    direction:   -1,
    baseSpeed:   0.006,
    lineWidth:   1.5,
    glowSize:    8,
  },
  {
    radius:      RING3_RADIUS,
    segments:    3,
    gapFraction: 0.08,
    direction:   1,
    baseSpeed:   0.003,
    lineWidth:   2,
    glowSize:    14,
  },
]

// ─── Animation constants ──────────────────────────────────────────────────────
export const BRIGHTNESS_LERP_RATE  = 0.04
export const RING_SPEED_LERP_RATE  = 0.03
export const SCAN_LINE_BASE_SPEED  = 0.8 / 60   // 0.8 rad/sec at 60fps
export const PARTICLE_COUNT        = 25
export const PARTICLE_DOT_RADIUS   = 1.5
export const BACKGROUND_GRID_ALPHA = 0.06
export const BACKGROUND_GRID_RINGS = 5
