# STATUS.md — orb-ui Project State

> **For agents:** Read this file before touching anything. It tells you what exists,
> what's implemented vs stubbed, what the decisions were, and what to build next.
> The canonical design spec is in `REQUIREMENTS.md`.

---

## What This Is

`orb-ui` is an open-source React component library that provides an animated visual
UI layer for voice AI agents. Single component (`<Orb>`), pluggable themes,
pluggable provider adapters. MIT license.

**Owner:** Alexander Chen ([@alexanderqchen](https://github.com/alexanderqchen))
**npm:** `orb-ui` (not yet published)
**Repo:** `github.com/alexanderqchen/orb-ui` ✅ pushed and public

---

## Current Build Status

| Item | Status | Notes |
|---|---|---|
| Repo scaffold | ✅ Done | `package.json`, `tsconfig.json`, `vite.config.ts`, `src/` structure |
| `Orb` component | ✅ Done | `src/components/Orb/Orb.tsx` — controlled + adapter modes |
| `debug` theme | ✅ Done | Fully implemented. State display, volume bar, state buttons, Start/Stop |
| Vapi adapter | ✅ Done | Full event mapping, thinking-state inference, connecting-state intercept, removeListener cleanup |
| `circle` theme | ✅ Done | Pulse on idle, scale+glow on listening/speaking (volume-driven rAF), spinning dashed ring on thinking |
| `bars` theme | ✅ Done | 5 bars, wave on idle/connecting, volume-driven rAF on listening/speaking, sine wave on thinking |
| `jarvis` theme | 🚧 Stub | Placeholder renders a static sci-fi placeholder |
| ElevenLabs adapter | 🚧 Stub | Shell with full TODO comments and event mapping notes |
| Pipecat adapter | 🚧 Stub | Shell with TODO |
| Bland adapter | 🚧 Stub | Shell with TODO |
| Demo app | 🚧 Deploying to Vercel | `demo/` wired up with Vapi, runs locally on port 5173. Live-tested and working. Vercel deploy in progress. |
| README | ✅ Done | Human-facing docs, API reference, theme/adapter tables |
| CONTRIBUTING.md | ✅ Done | AI-native contribution policy |
| npm publish | ❌ Not done | — |

---

## Git Log

```
01a9c0d  feat: implement circle and bars themes
0447336  feat(vapi): intercept vapi.start() to emit connecting state immediately
3eae9c3  fix: removeListener instead of off, add error display in demo UI, vite-env types
45d37d1  demo: wire up live Vapi adapter with live/sandbox mode toggle
ed08e00  demo: add .env.example, .gitignore, allowedHosts config, @vapi-ai/web dep
46645fd  docs: add CONTRIBUTING.md (AI-native contribution policy)
cd8cc93  docs: add STATUS.md, update README with contributing section
8c93595  Implement Vapi adapter with full event mapping and thinking state inference
61b8d8b  Initial scaffold: Orb component, debug theme, adapter stubs, demo app
```

---

## Build Order (what to do next, in order)

1. ~~**`circle` theme**~~ ✅ Done
2. ~~**`bars` theme**~~ ✅ Done
3. **Deploy demo to Vercel** — In progress.
4. **ElevenLabs adapter** — `onModeChange({ mode })` maps to speaking/listening; infer thinking from mode gap.
5. **Pipecat adapter** — WebRTC-based; map `botStartedSpeaking` / `botStoppedSpeaking` / `userStartedSpeaking`.
6. **Bland adapter** — Bland uses WebSocket events; map similarly.
7. **`jarvis` theme** — Sci-fi HUD. Canvas + WebGL. This is the launch demo — needs to be stunning.
8. **Demo site** — Interactive playground showing all themes + adapters. This is the marketing page.
9. **Push updates to GitHub, publish to npm** — Public launch.

---

## File Map

```
orb-ui/
├── src/
│   ├── components/
│   │   └── Orb/
│   │       ├── Orb.tsx          # Main component (controlled + adapter logic)
│   │       ├── Orb.types.ts     # OrbState, OrbTheme, OrbAdapter, OrbProps
│   │       └── index.ts
│   ├── themes/
│   │   ├── debug/DebugTheme.tsx      # ✅ Fully implemented
│   │   ├── circle/CircleTheme.tsx    # ✅ Fully implemented
│   │   ├── bars/BarsTheme.tsx        # ✅ Fully implemented
│   │   ├── jarvis/JarvisTheme.tsx    # 🚧 Stub (Canvas/WebGL target)
│   │   └── index.ts
│   ├── adapters/
│   │   ├── types.ts                  # OrbAdapter interface, AdapterCallbacks
│   │   ├── index.ts                  # Re-exports all createXxxAdapter functions
│   │   ├── vapi/index.ts             # ✅ Fully implemented
│   │   ├── elevenlabs/index.ts       # 🚧 Stub
│   │   ├── pipecat/index.ts          # 🚧 Stub
│   │   └── bland/index.ts            # 🚧 Stub
│   └── index.ts                      # Public API: exports Orb + types
├── demo/                             # Vite app — wired to Vapi, tested live
├── REQUIREMENTS.md                   # Full design spec and decisions
├── STATUS.md                         # ← you are here
├── README.md                         # Human-facing docs (npm / GitHub)
├── package.json                      # name: orb-ui, version: 0.1.0
├── tsconfig.json
└── vite.config.ts                    # Library mode build
```

---

## Core API (do not change without good reason)

```tsx
import { Orb } from 'orb-ui'
import { createVapiAdapter } from 'orb-ui/adapters'

// Adapter mode (recommended)
<Orb adapter={createVapiAdapter(vapiClient)} theme="jarvis" />

// Controlled mode (custom integrations)
<Orb state="listening" volume={0.7} theme="circle" />
```

### OrbState union
```ts
type OrbState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error' | 'disconnected'
```

### OrbAdapter interface
```ts
interface OrbAdapter {
  subscribe(callbacks: {
    onStateChange: (state: OrbState) => void
    onVolumeChange: (volume: number) => void  // normalized 0–1
  }): () => void  // returns unsubscribe fn
}
```

---

## Key Decisions (don't re-debate these)

- **Single package, no monorepo** — `orb-ui` ships everything. Adapters are at `orb-ui/adapters`. Can split later.
- **No Framer Motion** — CSS + SVG for simple themes; Canvas/WebGL for jarvis. Keep bundle small.
- **Peer deps only for React** — Adapters use structural typing, not imports, so `@vapi-ai/web` etc. are never installed by orb-ui.
- **debug theme first** — Ships as Tier 0 so developers can integrate and test before pretty themes exist.
- **jarvis is the launch hero** — It's the sci-fi theme that makes the demo page go viral. Do it last so it's polished.
- **Volume is normalized 0–1** — All adapters must normalize before calling `onVolumeChange`.
- **Controlled props override adapter** — If both `state` prop and `adapter` are provided, the prop wins.
- **`thinking` state inference** — Vapi doesn't emit a thinking event; infer it from final user transcript. Other adapters may need similar patterns.
- **`connecting` state** — Vapi doesn't emit a connecting event either. The Vapi adapter intercepts `vapi.start()` to emit `'connecting'` immediately, then restores the original on unsubscribe.

---

## Development Commands

```bash
npm run build       # Build the library (tsc + vite)
npm run typecheck   # Type-check only, no emit
npm run dev         # Watch mode build
npm run test        # Vitest
cd demo && npm run dev  # Run interactive demo (requires demo/.env.local with Vapi keys)
```

---

*Last updated: 2026-02-26*
