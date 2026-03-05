import { useCallback, useEffect, useState } from 'react'
import type { VoiceOrbProps, OrbState } from './VoiceOrb.types'
import { DebugTheme } from '../../themes/debug'
import { CircleTheme } from '../../themes/circle'
import { BarsTheme } from '../../themes/bars'

export function VoiceOrb({
  state: stateProp,
  volume: volumeProp,
  adapter,
  theme = 'debug',
  size = 200,
  className,
  style,
  onStart,
  onStop,
}: VoiceOrbProps) {
  const [adapterState, setAdapterState] = useState<OrbState>('idle')
  const [adapterVolume, setAdapterVolume] = useState(0)

  useEffect(() => {
    if (!adapter) return
    const unsubscribe = adapter.subscribe({
      onStateChange: setAdapterState,
      onVolumeChange: setAdapterVolume,
    })
    return unsubscribe
  }, [adapter])

  // Controlled props override adapter values
  const state: OrbState = stateProp ?? adapterState
  const volume: number = volumeProp ?? adapterVolume

  const isActive = state !== 'idle' && state !== 'disconnected' && state !== 'error'

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

  const themeElement = (() => {
    switch (theme) {
      case 'circle':
        return <CircleTheme {...themeProps} />
      case 'bars':
        return <BarsTheme {...themeProps} />
      case 'debug':
      default:
        return <DebugTheme {...themeProps} onStart={onStart} onStop={onStop} />
    }
  })()

  // Wrap non-debug themes in a clickable container when adapter or callbacks are present
  if (clickable && theme !== 'debug') {
    return (
      <div
        onClick={handleClick}
        style={{ cursor: 'pointer', display: 'inline-flex' }}
      >
        {themeElement}
      </div>
    )
  }

  return themeElement
}
