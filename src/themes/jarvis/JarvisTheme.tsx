import { useRef, useEffect, useLayoutEffect } from 'react'
import type { OrbState } from '../../components/VoiceOrb/VoiceOrb.types'
import {
  BASE_SIZE,
  CORE_BASE_RADIUS,
  CORE_MAX_RADIUS,
  RING3_RADIUS,
  RING_DEFS,
  STATE_CONFIG,
  BRIGHTNESS_LERP_RATE,
  RING_SPEED_LERP_RATE,
  SCAN_LINE_BASE_SPEED,
  BACKGROUND_GRID_ALPHA,
  BACKGROUND_GRID_RINGS,
} from './constants'
import { createParticles, updateParticles, drawParticles } from './particles'
import { drawRing, drawScanLine, drawBackgroundGrid } from './rings'

// ─── Props ────────────────────────────────────────────────────────────────────

interface JarvisThemeProps {
  state:     OrbState
  volume:    number
  size:      number
  className?: string
  style?:    React.CSSProperties
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function parseHexColor(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function JarvisTheme({ state, volume, size, className, style }: JarvisThemeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Volume ref — read inside rAF loop without triggering effect restarts
  const volumeRef = useRef(volume)
  useLayoutEffect(() => { volumeRef.current = volume }, [volume])

  // State ref — needed inside animation loop for particle updates, but
  // we also keep state in the useEffect dep array so major state transitions
  // restart the loop cleanly.
  const stateRef = useRef(state)
  useLayoutEffect(() => { stateRef.current = state }, [state])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // ── HiDPI setup ────────────────────────────────────────────────────────
    const dpr = window.devicePixelRatio || 1
    canvas.width  = size * dpr
    canvas.height = size * dpr

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)

    const cx    = size / 2
    const cy    = size / 2
    const scale = size / BASE_SIZE   // scale factor from 240px base

    // ── Mutable animation state ────────────────────────────────────────────
    let currentBrightness = STATE_CONFIG[state].targetBrightness
    let currentRingSpeedMult = STATE_CONFIG[state].ringSpeedMult
    let scanAngle = 0

    // Ring rotation angles — one per ring
    const ringAngles = RING_DEFS.map(() => Math.random() * Math.PI * 2)

    // Current ring speed multipliers (lerped individually)
    const ringSpeedMults = RING_DEFS.map(() => STATE_CONFIG[state].ringSpeedMult)

    // Color lerp state
    let [cr, cg, cb] = parseHexColor(STATE_CONFIG[state].color)

    // Particle system
    const particles = createParticles()

    // Flicker state
    let flickerOffset = 0

    let rafId = 0

    // ── Animation loop ─────────────────────────────────────────────────────
    const animate = () => {
      const vol      = volumeRef.current
      const st       = stateRef.current
      const cfg      = STATE_CONFIG[st]

      // Lerp brightness
      currentBrightness = lerp(currentBrightness, cfg.targetBrightness, BRIGHTNESS_LERP_RATE)

      // Lerp ring speed multiplier
      const targetSpeedMult = cfg.ringSpeedMult + vol * 1.5
      currentRingSpeedMult  = lerp(currentRingSpeedMult, targetSpeedMult, RING_SPEED_LERP_RATE)

      // Lerp color
      const [tr, tg, tb] = parseHexColor(cfg.color)
      cr = lerp(cr, tr, 0.04)
      cg = lerp(cg, tg, 0.04)
      cb = lerp(cb, tb, 0.04)
      const color = rgbToHex(cr, cg, cb)

      // Flicker
      if (cfg.flicker) {
        flickerOffset = (Math.random() - 0.5) * 0.15
      } else {
        flickerOffset = lerp(flickerOffset, 0, 0.1)
      }
      const flickeredBrightness = Math.max(0, Math.min(1, currentBrightness + flickerOffset))

      // ── Clear ─────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, size, size)

      // ── 1. Background grid ─────────────────────────────────────────────────
      drawBackgroundGrid(
        ctx, cx, cy,
        RING3_RADIUS * scale * 1.15,
        BACKGROUND_GRID_RINGS,
        color,
        BACKGROUND_GRID_ALPHA * flickeredBrightness,
      )

      // ── 2. Particles ───────────────────────────────────────────────────────
      updateParticles(particles, st, vol)
      drawParticles(ctx, particles, cx, cy, scale, color, flickeredBrightness * 0.85)

      // ── 3. Rotating rings ──────────────────────────────────────────────────
      ctx.save()
      ctx.globalCompositeOperation = 'screen'

      RING_DEFS.forEach((ring, i) => {
        // Individual ring speed lerp
        ringSpeedMults[i] = lerp(ringSpeedMults[i], currentRingSpeedMult, RING_SPEED_LERP_RATE)

        // Error state: add slight jitter
        const jitter = st === 'error' ? (Math.random() - 0.5) * 0.04 : 0

        ringAngles[i] += ring.direction * ring.baseSpeed * ringSpeedMults[i] + jitter

        const ringAlpha = (0.5 + vol * 0.5) * flickeredBrightness

        drawRing(
          ctx,
          cx, cy,
          ring.radius * scale,
          ring.segments,
          ring.gapFraction,
          ringAngles[i],
          color,
          ringAlpha,
          ring.lineWidth * scale,
          ring.glowSize * scale,
        )
      })

      ctx.restore()

      // ── 4. Scan line ────────────────────────────────────────────────────────
      const scanSpeed = SCAN_LINE_BASE_SPEED * cfg.scanLineMult
      scanAngle += scanSpeed

      const scanAlpha = flickeredBrightness * 0.9
      drawScanLine(
        ctx,
        cx, cy,
        RING3_RADIUS * scale,
        scanAngle,
        color,
        scanAlpha,
        scale,
      )

      // ── 5. Central core ────────────────────────────────────────────────────
      drawCore(ctx, cx, cy, scale, color, vol, flickeredBrightness)

      rafId = requestAnimationFrame(animate)
    }

    rafId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [state, size]) // state in deps → restart on state change; size for canvas resize

  return (
    <div
      className={className}
      style={{
        width:    size,
        height:   size,
        position: 'relative',
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width:  size,
          height: size,
          display: 'block',
        }}
      />
    </div>
  )
}

// ─── Core rendering ───────────────────────────────────────────────────────────

function drawCore(
  ctx:        CanvasRenderingContext2D,
  cx:         number,
  cy:         number,
  scale:      number,
  color:      string,
  volume:     number,
  brightness: number,
): void {
  const baseR  = CORE_BASE_RADIUS * scale
  const maxR   = CORE_MAX_RADIUS  * scale
  const coreR  = baseR + volume * (maxR - baseR)

  ctx.save()
  ctx.globalCompositeOperation = 'screen'

  // Layer 1 — wide diffuse glow
  ctx.globalAlpha = brightness * 0.3
  ctx.shadowColor = color
  ctx.shadowBlur  = (30 + volume * 40) * scale
  ctx.fillStyle   = color
  ctx.beginPath()
  ctx.arc(cx, cy, coreR * 1.5, 0, Math.PI * 2)
  ctx.fill()

  // Layer 2 — medium glow
  ctx.globalAlpha = brightness * 0.6
  ctx.shadowBlur  = (15 + volume * 25) * scale
  ctx.beginPath()
  ctx.arc(cx, cy, coreR * 1.1, 0, Math.PI * 2)
  ctx.fill()

  // Layer 3 — bright solid core
  ctx.globalAlpha = brightness
  ctx.shadowBlur  = (10 + volume * 20) * scale
  ctx.fillStyle   = color
  ctx.beginPath()
  ctx.arc(cx, cy, coreR, 0, Math.PI * 2)
  ctx.fill()

  // Inner highlight — tiny bright center spot
  ctx.globalAlpha = brightness * 0.9
  ctx.shadowBlur  = 4 * scale
  ctx.fillStyle   = '#ffffff'
  ctx.beginPath()
  ctx.arc(cx, cy, coreR * 0.35, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}
