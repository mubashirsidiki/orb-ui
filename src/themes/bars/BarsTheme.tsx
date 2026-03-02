import { useRef, useEffect } from 'react'
import type { OrbState } from '../../components/VoiceOrb/VoiceOrb.types'

interface BarsThemeProps {
  state: OrbState
  volume: number
  size: number
  className?: string
  style?: React.CSSProperties
}

const BAR_COUNT = 5

// Each bar oscillates at its own frequency + phase — no fixed height ratio.
// This breaks the "diamond" shape: bars move independently, driven by volume.
// Frequencies are in Hz; phases spread bars so they never all peak together.
const BAR_FREQS  = [2.1, 1.6, 2.6, 1.9, 2.3]   // Hz
const BAR_PHASES = [0.0, 1.2, 2.5, 0.6, 3.4]    // rad — arbitrary offsets

const STATE_COLORS: Record<OrbState, string> = {
  idle: '#cccccc',
  connecting: '#cccccc',
  listening: '#60a5fa',
  speaking: '#a3e635',
  thinking: '#fbbf24',
  error: '#f87171',
  disconnected: '#444444',
}

function buildKeyframes(size: number) {
  const maxH = size * 0.55
  const minH = size * 0.06
  return `
@keyframes orb-bars-wave {
  0%, 100% { height: ${minH}px; }
  50% { height: ${maxH * 0.5}px; }
}
@keyframes orb-bars-wave-fast {
  0%, 100% { height: ${minH}px; }
  50% { height: ${maxH * 0.5}px; }
}
`
}

export function BarsTheme({ state, volume, size, className, style }: BarsThemeProps) {
  const barRefs = useRef<(HTMLDivElement | null)[]>([])
  const rafRef = useRef<number>(0)
  const smoothed = useRef<number[]>(new Array(BAR_COUNT).fill(0))
  const styleRef = useRef<HTMLStyleElement | null>(null)
  const volumeRef = useRef(volume)

  // Sync ref on every volume change — keeps the rAF loop from restarting
  useEffect(() => {
    volumeRef.current = volume
  }, [volume])

  // Inject/update keyframes when size changes
  useEffect(() => {
    const id = 'orb-bars-keyframes'
    let el = document.getElementById(id) as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = id
      document.head.appendChild(el)
    }
    el.textContent = buildKeyframes(size)
    styleRef.current = el
  }, [size])

  // Animation loop
  useEffect(() => {
    const maxH = size * 0.55
    const minH = size * 0.06
    const barW = size * 0.055
    const color = STATE_COLORS[state]

    const setBars = (heights: number[], col: string) => {
      for (let i = 0; i < BAR_COUNT; i++) {
        const el = barRefs.current[i]
        if (!el) continue
        el.style.height = `${heights[i]}px`
        el.style.background = col
        el.style.animation = 'none'
      }
    }

    if (state === 'listening' || state === 'speaking') {
      // Each bar runs its own sine oscillator (unique freq + phase).
      // Volume scales the amplitude — silence keeps bars low, speech drives them up.
      // Asymmetric lerp: snap up fast (0.35), decay slowly (0.08) — speech rhythm feels snappy.
      // Listening uses slower oscillators (÷1.6) for a gentler idle breathing feel.
      const freqScale = state === 'speaking' ? 1.0 : 0.4

      const animate = () => {
        const vol = volumeRef.current
        const t = Date.now() / 1000

        for (let i = 0; i < BAR_COUNT; i++) {
          // Oscillates in [0.25, 0.75] — bars have real range without hitting extremes
          const osc = 0.5 + 0.25 * Math.sin(t * BAR_FREQS[i] * freqScale * Math.PI * 2 + BAR_PHASES[i])
          const targetH = minH + (maxH - minH) * vol * osc
          const rate = targetH > smoothed.current[i] ? 0.3 : 0.2
          smoothed.current[i] += (targetH - smoothed.current[i]) * rate
        }

        setBars(smoothed.current, color)
        rafRef.current = requestAnimationFrame(animate)
      }
      rafRef.current = requestAnimationFrame(animate)

      return () => cancelAnimationFrame(rafRef.current)
    }

    if (state === 'thinking') {
      const animate = () => {
        const now = Date.now()
        const heights: number[] = []
        for (let i = 0; i < BAR_COUNT; i++) {
          heights.push(minH + (maxH - minH) * 0.5 * (1 + Math.sin(now / 500 + i * 0.8)))
        }
        setBars(heights, color)
        rafRef.current = requestAnimationFrame(animate)
      }
      rafRef.current = requestAnimationFrame(animate)

      return () => cancelAnimationFrame(rafRef.current)
    }

    // CSS-animated or static states
    cancelAnimationFrame(rafRef.current)

    if (state === 'idle' || state === 'connecting') {
      const duration = state === 'idle' ? '1.8s' : '1s'
      for (let i = 0; i < BAR_COUNT; i++) {
        const el = barRefs.current[i]
        if (!el) continue
        el.style.background = color
        el.style.height = ''
        const animName = state === 'idle' ? 'orb-bars-wave' : 'orb-bars-wave-fast'
        el.style.animation = `${animName} ${duration} ease-in-out ${i * 0.15}s infinite`
      }
      return
    }

    // error / disconnected — static at min height
    for (let i = 0; i < BAR_COUNT; i++) {
      const el = barRefs.current[i]
      if (!el) continue
      el.style.height = `${minH}px`
      el.style.background = color
      el.style.animation = 'none'
    }
  }, [state, size])  // volume intentionally excluded — read via volumeRef instead

  const barW = size * 0.055
  const gap = size * 0.035
  const radius = size * 0.03
  const maxH = size * 0.55
  const minH = size * 0.06

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap,
        ...style,
      }}
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div
          key={i}
          ref={(el) => { barRefs.current[i] = el }}
          style={{
            width: barW,
            minHeight: minH,
            maxHeight: maxH,
            height: minH,
            borderRadius: radius,
            background: STATE_COLORS[state],
            transition: 'background 0.3s ease',
          }}
        />
      ))}
    </div>
  )
}
