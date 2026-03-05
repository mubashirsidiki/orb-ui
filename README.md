# orb-ui

Beautiful animated UI components for voice AI agents. Drop-in React components that respond to your agent's voice in real time.

```jsx
import { VoiceOrb } from 'orb-ui'
import { createVapiAdapter } from 'orb-ui/adapters'

<VoiceOrb adapter={createVapiAdapter(vapi)} theme="circle" />
```

## Install

```bash
npm install orb-ui
# or
yarn add orb-ui
```

## Quick Start

### With Vapi

```jsx
import Vapi from '@vapi-ai/web'
import { VoiceOrb } from 'orb-ui'
import { createVapiAdapter } from 'orb-ui/adapters'

const vapi = new Vapi('your-public-key')

function App() {
  const adapter = createVapiAdapter(vapi)

  return (
    <VoiceOrb
      adapter={adapter}
      theme="circle"
      onStart={() => vapi.start('your-assistant-id')}
      onStop={() => vapi.stop()}
    />
  )
}
```

### With ElevenLabs

```jsx
import { Conversation } from '@elevenlabs/client'
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
}
```

### Controlled mode (custom integration)

```jsx
import { VoiceOrb } from 'orb-ui'
import { useState } from 'react'

function App() {
  const [state, setState] = useState('idle')
  const [volume, setVolume] = useState(0)

  return <VoiceOrb state={state} volume={volume} theme="circle" />
}
```

## Themes

| Theme | Description |
|---|---|
| `debug` | State + volume display with start/stop. Use to verify your integration works. |
| `circle` | Pulsing circle that reacts to volume. |
| `bars` | Three bars that animate with voice. |

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `theme` | `'debug' \| 'circle' \| 'bars'` | `'debug'` | Visual theme |
| `state` | `OrbState` | `'idle'` | Conversation state (controlled mode) |
| `volume` | `number` | `0` | Audio volume, 0–1 (controlled mode) |
| `adapter` | `OrbAdapter` | — | Provider adapter (manages state + volume automatically) |
| `size` | `number` | `200` | Size in pixels |
| `onStart` | `() => void` | — | Called when Start is pressed (debug theme) |
| `onStop` | `() => void` | — | Called when Stop is pressed (debug theme) |

## States

`idle` · `connecting` · `listening` · `thinking` · `speaking` · `error` · `disconnected`

## Supported Providers

| Provider | Adapter |
|---|---|
| [Vapi](https://vapi.ai) | `createVapiAdapter` from `orb-ui/adapters` |
| [ElevenLabs](https://elevenlabs.io/conversational-ai) | `createElevenLabsAdapter` from `orb-ui/adapters` |
| Custom | Use controlled mode — pass `state` and `volume` directly |

## Development

```bash
git clone https://github.com/alexanderqchen/orb-ui.git
cd orb-ui
yarn install
cd demo && yarn install && cd ..

# Build the library
yarn build

# Run demo locally
cd demo && yarn dev
```

## License

MIT © [Alexander Chen](https://github.com/alexanderqchen)
