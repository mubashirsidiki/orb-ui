import { useState, useCallback, useEffect, useRef } from 'react'
import Vapi from '@vapi-ai/web'
import { Conversation } from '@elevenlabs/client'
import { VoiceOrb } from 'orb-ui'
import { createVapiAdapter, createElevenLabsAdapter } from 'orb-ui/adapters'
import type { OrbState, OrbTheme } from 'orb-ui'

// ─── Env vars ─────────────────────────────────────────────────────────────────
const VAPI_PUBLIC_KEY   = import.meta.env.VITE_VAPI_PUBLIC_KEY   as string
const VAPI_ASSISTANT_ID = import.meta.env.VITE_VAPI_ASSISTANT_ID as string
const EL_AGENT_ID       = import.meta.env.VITE_EL_AGENT_ID       as string

// ─── Constants ────────────────────────────────────────────────────────────────
const STATES: OrbState[] = ['idle','connecting','listening','thinking','speaking','error','disconnected']
const THEMES: OrbTheme[] = ['debug','circle','bars','jarvis']
const SPARKLINE_LEN = 80   // ~8 s at 10 Hz

// ─── Singleton adapters ───────────────────────────────────────────────────────
const vapi        = VAPI_PUBLIC_KEY ? new Vapi(VAPI_PUBLIC_KEY) : null
const vapiAdapter = vapi ? createVapiAdapter(vapi) : undefined
const elAdapter   = EL_AGENT_ID
  ? createElevenLabsAdapter(Conversation, { agentId: EL_AGENT_ID })
  : undefined

// ─── Monitoring hook ──────────────────────────────────────────────────────────
function useMonitor(adapter: ReturnType<typeof createVapiAdapter> | typeof elAdapter | undefined) {
  const [monState,  setMonState]  = useState<OrbState>('idle')
  const [monVol,    setMonVol]    = useState(0)
  const [sparkline, setSparkline] = useState<number[]>([])
  const [stats, setStats]         = useState({ peak: 0, samples: 0, sum: 0 })
  const statsRef = useRef({ peak: 0, samples: 0, sum: 0 })

  // Reset on adapter change
  useEffect(() => {
    setMonState('idle'); setMonVol(0); setSparkline([])
    const s = { peak: 0, samples: 0, sum: 0 }
    statsRef.current = s; setStats(s)
    if (!adapter) return
    const unsub = adapter.subscribe({
      onStateChange: (s) => setMonState(s),
      onVolumeChange: (v) => {
        setMonVol(v)
        setSparkline(prev => [...prev.slice(-(SPARKLINE_LEN - 1)), v])
        statsRef.current.samples++
        statsRef.current.sum += v
        if (v > statsRef.current.peak) statsRef.current.peak = v
        setStats({ ...statsRef.current })
      },
    })
    return unsub
  }, [adapter])

  return { monState, monVol, sparkline, stats }
}

// ─── Sparkline renderer ───────────────────────────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const W = 320, H = 48
  if (values.length < 2) return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <rect width={W} height={H} fill="#111" rx={4} />
    </svg>
  )
  const pts = values.map((v, i) => {
    const x = (i / (SPARKLINE_LEN - 1)) * W
    const y = H - v * (H - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <rect width={W} height={H} fill="#111" rx={4} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  )
}

// ─── State badge ──────────────────────────────────────────────────────────────
const STATE_COLOR: Record<OrbState, string> = {
  idle:         '#333',
  connecting:   '#f59e0b',
  listening:    '#3b82f6',
  thinking:     '#8b5cf6',
  speaking:     '#22c55e',
  error:        '#ef4444',
  disconnected: '#555',
}
function StateBadge({ state }: { state: OrbState }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 99,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
      background: STATE_COLOR[state] + '33',
      color: STATE_COLOR[state],
      border: `1px solid ${STATE_COLOR[state]}55`,
    }}>{state}</span>
  )
}

// ─── Monitor panel ────────────────────────────────────────────────────────────
function MonitorPanel({
  label, color, monState, monVol, sparkline, stats, active,
}: {
  label: string; color: string;
  monState: OrbState; monVol: number; sparkline: number[]; stats: { peak: number; samples: number; sum: number };
  active: boolean;
}) {
  const avg = stats.samples > 0 ? stats.sum / stats.samples : 0
  return (
    <div style={{
      padding: '14px 16px', background: '#111', borderRadius: 8,
      border: `1px solid ${active ? color + '66' : '#222'}`,
      opacity: active ? 1 : 0.5, flex: 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: active ? color : '#555' }}>{label}</span>
        {active && <StateBadge state={monState} />}
      </div>

      {/* Volume bar */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555', marginBottom: 3 }}>
          <span>VOL</span>
          <span style={{ color: '#aaa', fontFamily: 'monospace' }}>{monVol.toFixed(3)}</span>
        </div>
        <div style={{ height: 6, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${monVol * 100}%`, background: color, borderRadius: 3, transition: 'width 80ms linear' }} />
        </div>
      </div>

      {/* Sparkline */}
      <Sparkline values={sparkline} color={color} />

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        {[
          { label: 'PEAK', val: stats.peak.toFixed(3) },
          { label: 'AVG',  val: avg.toFixed(3) },
          { label: 'TICKS', val: stats.samples.toString() },
        ].map(({ label: l, val }) => (
          <div key={l}>
            <div style={{ fontSize: 9, color: '#444', letterSpacing: '0.08em' }}>{l}</div>
            <div style={{ fontSize: 12, color: '#888', fontFamily: 'monospace' }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [theme,         setTheme]         = useState<OrbTheme>('circle')
  const [sandboxState,  setSandboxState]  = useState<OrbState>('idle')
  const [sandboxVolume, setSandboxVolume] = useState(0)
  const [provider,      setProvider]      = useState<'vapi' | 'elevenlabs' | 'sandbox'>('sandbox')
  const [connected,     setConnected]     = useState(false)
  const [lastError,     setLastError]     = useState<string | null>(null)
  const [showMonitor,   setShowMonitor]   = useState(true)

  const adapter = provider === 'vapi' ? vapiAdapter
                : provider === 'elevenlabs' ? elAdapter
                : undefined

  const orbProps = adapter
    ? { adapter }
    : { state: sandboxState, volume: sandboxVolume }

  // Always monitor both adapters simultaneously for comparison
  const vapiMon = useMonitor(vapiAdapter)
  const elMon   = useMonitor(elAdapter)

  // Vapi error listener
  useEffect(() => {
    if (!vapi) return
    const handler = (e: unknown) => {
      const msg = typeof e === 'object' && e !== null ? JSON.stringify(e, null, 2) : String(e)
      console.error('[orb-ui demo] Vapi error:', msg)
      setLastError(msg)
    }
    vapi.on('error', handler)
    return () => { vapi.removeListener('error', handler) }
  }, [])

  const handleStart = useCallback(async () => {
    setLastError(null)
    if (provider === 'vapi') {
      if (!vapi || !VAPI_ASSISTANT_ID) return
      setConnected(true)
      await vapi.start(VAPI_ASSISTANT_ID)
    } else if (provider === 'elevenlabs') {
      if (!elAdapter) return
      setConnected(true)
      await elAdapter.start()
    }
  }, [provider])

  const handleStop = useCallback(() => {
    if (provider === 'vapi')        vapi?.stop()
    else if (provider === 'elevenlabs') elAdapter?.stop()
    setConnected(false)
  }, [provider])

  const vapiMissing = !VAPI_PUBLIC_KEY || !VAPI_ASSISTANT_ID
  const elMissing   = !EL_AGENT_ID

  return (
    <div style={{ minHeight: '100vh', padding: 40, fontFamily: 'system-ui, sans-serif', background: '#0a0a0a', color: '#fff' }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 40 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: '#fff', margin: 0 }}>orb-ui</h1>
          <p style={{ color: '#555', fontSize: 13, margin: 0 }}>Beautiful animated UI for voice AI agents</p>
        </div>

        {/* Provider selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          {([
            { id: 'sandbox',     label: '🧪 Sandbox',     disabled: false },
            { id: 'vapi',        label: '🎙 Vapi',         disabled: vapiMissing },
            { id: 'elevenlabs',  label: '⚡ ElevenLabs',   disabled: elMissing },
          ] as const).map(({ id, label, disabled }) => (
            <button key={id}
              onClick={() => { if (!disabled) { setProvider(id); setConnected(false) } }}
              disabled={disabled}
              style={{
                padding: '6px 14px', fontSize: 11, fontWeight: 600,
                letterSpacing: '0.05em', textTransform: 'uppercase',
                background: provider === id ? '#fff' : '#1a1a1a',
                color: provider === id ? '#000' : disabled ? '#333' : '#555',
                border: `1px solid ${provider === id ? '#fff' : '#333'}`,
                borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.4 : 1,
              }}
            >{label}</button>
          ))}
        </div>

        {/* Orb */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 40, minHeight: 260 }}>
          <VoiceOrb
            theme={theme} size={240}
            onStart={adapter ? handleStart : undefined}
            onStop={adapter ? handleStop : undefined}
            {...orbProps}
          />
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Theme */}
          <div>
            <label style={{ fontSize: 11, color: '#555', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>THEME</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {THEMES.map((t) => (
                <button key={t} onClick={() => setTheme(t)} style={{
                  padding: '6px 14px', fontSize: 12,
                  background: theme === t ? '#fff' : '#1a1a1a',
                  color: theme === t ? '#000' : '#888',
                  border: `1px solid ${theme === t ? '#fff' : '#333'}`,
                  borderRadius: 4, cursor: 'pointer',
                }}>{t}</button>
              ))}
            </div>
          </div>

          {/* Sandbox controls */}
          {provider === 'sandbox' && (<>
            <div>
              <label style={{ fontSize: 11, color: '#555', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>STATE</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {STATES.map((s) => (
                  <button key={s} onClick={() => setSandboxState(s)} style={{
                    padding: '6px 14px', fontSize: 12,
                    background: sandboxState === s ? '#fff' : '#1a1a1a',
                    color: sandboxState === s ? '#000' : '#888',
                    border: `1px solid ${sandboxState === s ? '#fff' : '#333'}`,
                    borderRadius: 4, cursor: 'pointer',
                  }}>{s}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#555', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
                VOLUME — {sandboxVolume.toFixed(2)}
              </label>
              <input type="range" min={0} max={1} step={0.01} value={sandboxVolume}
                onChange={(e) => setSandboxVolume(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#00d4ff' }} />
            </div>
          </>)}

          {/* Live mode status */}
          {provider !== 'sandbox' && (
            <div style={{ fontSize: 12, color: '#555' }}>
              {connected
                ? `🟢 Connected to ${provider === 'vapi' ? 'Vapi (Riley)' : 'ElevenLabs (Alexis)'}. Click the orb to end the call.`
                : `⚪ Click the orb to start a live call with ${provider === 'vapi' ? 'Riley (Vapi)' : 'Alexis (ElevenLabs)'}.`}
            </div>
          )}

          {/* ── MONITOR ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: '#555', letterSpacing: '0.08em' }}>SIGNAL MONITOR</label>
              <button onClick={() => setShowMonitor(v => !v)} style={{
                fontSize: 10, padding: '2px 8px', background: 'none',
                border: '1px solid #333', borderRadius: 3, color: '#555', cursor: 'pointer',
              }}>{showMonitor ? 'hide' : 'show'}</button>
              <span style={{ fontSize: 10, color: '#333' }}>— tap a provider then start a call to see live signal</span>
            </div>

            {showMonitor && (
              <div style={{ display: 'flex', gap: 12 }}>
                <MonitorPanel
                  label="Vapi"    color="#3b82f6"
                  active={provider === 'vapi'}
                  {...vapiMon}
                />
                <MonitorPanel
                  label="ElevenLabs" color="#22c55e"
                  active={provider === 'elevenlabs'}
                  {...elMon}
                />
              </div>
            )}
          </div>

          {/* Error */}
          {lastError && (
            <div style={{
              background: '#1a0000', border: '1px solid #5a0000', borderRadius: 6,
              padding: '10px 14px', fontSize: 11, color: '#ff6b6b',
              fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              <strong>Error:</strong>{'\n'}{lastError}
            </div>
          )}

        </div>

        {/* Usage snippet */}
        <div style={{ marginTop: 48, padding: '20px 24px', background: '#111', borderRadius: 8, border: '1px solid #222' }}>
          <div style={{ fontSize: 11, color: '#555', marginBottom: 10, letterSpacing: '0.08em' }}>USAGE</div>
          <pre style={{ fontSize: 12, color: '#aaa', margin: 0, lineHeight: 1.6, overflow: 'auto' }}>{`import { Conversation } from '@elevenlabs/client'
import { VoiceOrb } from 'orb-ui'
import { createElevenLabsAdapter } from 'orb-ui/adapters'

const adapter = createElevenLabsAdapter(Conversation, { agentId: 'your-agent-id' })

function App() {
  return (
    <VoiceOrb
      adapter={adapter}
      theme="circle"
      onStart={() => adapter.start()}
      onStop={() => adapter.stop()}
    />
  )
}`}</pre>
        </div>

      </div>
    </div>
  )
}
