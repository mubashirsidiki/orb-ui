# Contributing to orb-ui

Thanks for your interest in contributing! Here's how to get involved.

## Getting Started

1. Fork the repo and clone it
2. `yarn install` in the root and `demo/`
3. `yarn build` to build the library
4. `cd demo && yarn dev` to run the demo locally

## What to Contribute

- **New themes** → `src/themes/` — the easiest way to contribute
- **New adapters** → `src/adapters/` — add support for more voice AI providers
- **Bug fixes** — always welcome
- **Documentation** — improvements to README, examples, etc.

## Ground Rules

- Don't break the public API (`Orb` props, `OrbAdapter` interface, `OrbState` union)
- New themes go in `src/themes/`, new adapters in `src/adapters/`
- Run `npm run build` before opening a PR
- Keep bundle size in mind — no heavy dependencies without discussion

## Opening a PR

- Keep PRs focused on a single change
- Include a brief description of what changed and why
- If adding a theme or adapter, include a screenshot or demo

---

*orb-ui is maintained by [Alexander Chen](https://github.com/alexanderqchen).*
