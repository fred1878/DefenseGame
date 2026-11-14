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

## CI

Every push/PR to `main` runs typecheck, tests, and build.

## Releases

```bash
git tag v0.1.0
git push origin v0.1.0
```

Creates a GitHub Release with a web zip and deploys to GitHub Pages (enable **Pages → GitHub Actions** once).

## Current milestone

- Boot → Town (stub upgrades) → Defense (stick, melee, wave 1)
- Save game in `localStorage`
- JSON-driven enemies, waves, buildings