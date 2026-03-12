# orb-ui v0.2.0 — Pre-Launch Checklist

## Code & Package

- [x] VoiceOrb → Orb rename (backwards compat alias kept)
- [x] CJS + ESM builds working
- [x] Types resolve in Next.js, CRA, Vite
- [x] `typesVersions` added for `moduleResolution: "node"` compat
- [x] Version bumped to 0.2.0
- [x] Pushed to GitHub main
- [ ] Run through TESTPLAN.md must-test scenarios
- [ ] `npm pack` — inspect tarball, verify no source files leaked
- [ ] Check package size (should be < 50KB)

## README & Docs

- [x] README uses `Orb` everywhere (not VoiceOrb)
- [x] Hero screenshot added (circle theme, speaking state)
- [ ] Proofread README one more time — fresh eyes
- [ ] Verify README screenshot renders on GitHub
- [ ] Verify README renders correctly on npmjs.com (publish first, then check)
- [ ] Quick Start examples are copy-pasteable and work as-is

## Demo Site (orb-ui-demo.vercel.app)

- [ ] Demo loads without errors
- [ ] All 3 themes work in sandbox playground
- [ ] Volume slider affects all themes visually
- [ ] All 7 state buttons work
- [ ] Code snippets in Quick Start section are accurate
- [ ] "Vapi" and "ElevenLabs" tabs in Quick Start show correct code
- [ ] Links in nav (GitHub, npm) go to correct URLs
- [ ] Mobile responsive — doesn't look broken on phone
- [ ] Footer links work

## Alex's Manual Test

- [ ] Install orb-ui in a fresh project on your machine
- [ ] Follow the README Quick Start — does it work first try?
- [ ] Try controlled mode (pass state + volume)
- [ ] Try each theme — do they look good?
- [ ] Try the demo site on your phone
- [ ] Anything feel off, confusing, or ugly?

## npm Publish

- [ ] `cd ~/Developer/orb-ui && npm publish`
- [ ] Verify on https://www.npmjs.com/package/orb-ui — version 0.2.0
- [ ] README + screenshot display correctly on npm page
- [ ] `npm install orb-ui@0.2.0` works from a fresh project

## Launch Posts

- [ ] Finalize HN post copy (draft in Obsidian `_ClawdBot/Launch Posts/`)
- [ ] Finalize Twitter thread copy
- [ ] Post HN: "Show HN: orb-ui – React components for voice AI agents"
- [ ] Post Twitter thread
- [ ] Update personal site status ("Just launched orb-ui" or similar)

## Post-Launch (same day)

- [ ] Monitor HN for comments — respond within 1-2 hours
- [ ] Monitor Twitter replies
- [ ] Check npm download count
- [ ] Check PostHog on demo site for traffic spike
- [ ] Fix any bugs reported immediately

## Later (not blocking launch)

- [ ] Record a GIF/video for README (animated > static screenshot)
- [ ] Add to alexanderqchen.com/projects page
- [ ] Set GitHub repo description + topics
- [ ] GitHub repo homepage URL → orb-ui-demo.vercel.app
