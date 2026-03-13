import { useCallback, useEffect, useState } from 'react'
import type { OrbProps, OrbState } from './Orb.types'
import { DebugTheme } from '../../themes/debug'
import { CircleTheme } from '../../themes/circle'
import { BarsTheme } from '../../themes/bars'

export function Orb({
  state: stateProp,
  volume: volumeProp,
  adapter,
  theme = 'debug',
  size = 200,
  className,
  style,
  onStart,
  onStop,
}: OrbProps) {
  const [adapterState, setAdapterState] = useState<OrbState>('idle')
  const [adapterVolume, setAdapterVolume] = useState(0)

  useEffect(() => {
    if (!adapter) return
    const unsubscribe = adapter.subscribe({
      onStateChange: (s) => {
        console.log('[orb-ui] state →', s)
        setAdapterState(s)
      },
      onVolumeChange: (v) => {
        console.log('[orb-ui] volume →', v.toFixed(3))
        setAdapterVolume(v)
      },
    })
    return unsubscribe
  }, [adapter])

  // Controlled props override adapter values
  const state: OrbState = stateProp ?? adapterState
  const volume: number = volumeProp ?? adapterVolume

  const isActive = state !== 'idle' && state !== 'error'

  const handleClick = useCallback(() => {
    if (isActive) {
      if (onStop) onStop()
      else adapter?.stop?.()
    } else {
      if (onStart) onStart()
      else adapter?.start?.()
    }
  }, [adapter, isActive, onStart, onStop])

  // Only make it clickable if there's a way to handle clicks
  const clickable = !!(adapter?.start || onStart || onStop)

  const themeProps = { state, volume, size, className, style }
  const clickHandler = clickable ? handleClick : undefined

  switch (theme) {
    case 'circle':
      return <CircleTheme {...themeProps} onClick={clickHandler} />
    case 'bars':
      return clickable ? (
        <div onClick={handleClick} style={{ cursor: 'pointer', display: 'inline-flex' }}>
          <BarsTheme {...themeProps} />
        </div>
      ) : (
        <BarsTheme {...themeProps} />
      )
    case 'debug':
    default:
      return <DebugTheme {...themeProps} onStart={onStart} onStop={onStop} />
  }
}
