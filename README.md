# DefenseGame

Top-down real-time action RPG: upgrade town by day, defend it by night. Built in **Phaser 3 + Vite + TypeScript** (no game editor).

## Quick start

```bash
npm install
npm run dev
```

Open the URL from the dev server. Use the virtual stick (lower-left) and **ATK** (lower-right) in the defense scene.

## Docs for humans and agents

- [docs/AGENTS.md](./docs/AGENTS.md) — architecture, data formats, implementation order
- [docs/CI_RELEASES.md](./docs/CI_RELEASES.md) — CI, tagging, GitHub Pages, future mobile releases

## Play / share

**Live build (after merge to `main`):** https://fred1878.github.io/DefenseGame/

Enable **Settings → Pages → GitHub Actions** once so deploys work.

## CI & deploy

- **PRs:** typecheck, tests, build (`ci.yml`)
- **`main`:** same checks + publish to the Pages URL above (`pages.yml`)
- **Tags `v*.*.*`:** optional GitHub Release + same hosted game (`release.yml`)

## Current milestone

- Boot → Town (stub upgrades) → Defense (stick, melee, wave 1)
- Save game in `localStorage`
- JSON-driven enemies, waves, buildings