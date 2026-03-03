import type { OrbState } from '../../components/VoiceOrb/VoiceOrb.types'
import {
  PARTICLE_COUNT,
  PARTICLE_DOT_RADIUS,
  PARTICLE_INNER_RADIUS,
  PARTICLE_OUTER_RADIUS,
} from './constants'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Particle {
  angle:      number   // current orbital angle (radians)
  radius:     number   // current distance from center (base 240px units)
  baseRadius: number   // resting orbital radius
  speed:      number   // orbital drift speed (rad/frame)
  opacity:    number   // 0–1
  size:       number   // dot radius (base units)
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createParticles(): Particle[] {
  const particles: Particle[] = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const baseRadius = PARTICLE_INNER_RADIUS + Math.random() * (PARTICLE_OUTER_RADIUS - PARTICLE_INNER_RADIUS)
    particles.push({
      angle:      Math.random() * Math.PI * 2,
      radius:     baseRadius,
      baseRadius,
      speed:      0.001 + Math.random() * 0.003,   // [0.001, 0.004] rad/frame
      opacity:    0.4 + Math.random() * 0.6,
      size:       PARTICLE_DOT_RADIUS,
    })
  }
  return particles
}

// ─── Update ───────────────────────────────────────────────────────────────────

export function updateParticles(
  particles: Particle[],
  state: OrbState,
  volume: number,
): void {
  const isSpeaking  = state === 'speaking'
  const isListening = state === 'listening'

  for (const p of particles) {
    // Orbital drift
    p.angle += p.speed

    if (isSpeaking) {
      // Push outward — velocity proportional to volume
      const pushSpeed = 0.3 + volume * 1.2
      p.radius += pushSpeed
      // Wrap back inward when they get too far out
      if (p.radius > PARTICLE_OUTER_RADIUS + 25) {
        p.radius = PARTICLE_INNER_RADIUS - 5 + Math.random() * 10
      }
    } else if (isListening) {
      // Pull inward — velocity proportional to volume
      const pullSpeed = 0.1 + volume * 0.6
      p.radius -= pullSpeed
      // Bounce back at inner boundary
      if (p.radius < PARTICLE_INNER_RADIUS - 20) {
        p.radius = PARTICLE_INNER_RADIUS - 20
      }
      // Drift back to base when quiet
      if (volume < 0.05) {
        p.radius += (p.baseRadius - p.radius) * 0.02
      }
    } else {
      // Drift back to base radius
      p.radius += (p.baseRadius - p.radius) * 0.015
    }
  }
}

// ─── Draw ─────────────────────────────────────────────────────────────────────

export function drawParticles(
  ctx:        CanvasRenderingContext2D,
  particles:  Particle[],
  cx:         number,
  cy:         number,
  scale:      number,    // size / BASE_SIZE
  color:      string,
  brightness: number,    // 0–1
): void {
  ctx.save()
  ctx.globalCompositeOperation = 'screen'

  for (const p of particles) {
    const x = cx + Math.cos(p.angle) * p.radius * scale
    const y = cy + Math.sin(p.angle) * p.radius * scale
    const r = p.size * scale

    const alpha = p.opacity * brightness

    // Glow layer
    ctx.shadowColor = color
    ctx.shadowBlur  = 6 * scale

    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = color.replace(')', `, ${alpha})`)
      .replace('rgb(', 'rgba(')
      .replace('#00d4ff', `rgba(0,212,255,${alpha})`)
      .replace('#ff4444', `rgba(255,68,68,${alpha})`)

    // Use a simpler approach for fill color
    ctx.globalAlpha = alpha
    ctx.fillStyle   = color
    ctx.fill()
  }

  ctx.globalAlpha = 1
  ctx.shadowBlur  = 0
  ctx.restore()
}
