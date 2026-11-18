# CI and releases

## Play the game (URL)

This is a **web game** — players open a link in the browser (phone or desktop). There is no install step for web play.

| What | URL |
|------|-----|
| **Latest on `main`** (after merge + Pages deploy) | https://fred1878.github.io/DefenseGame/ |
| **Local dev** | `npm run dev` → http://127.0.0.1:5173 |

**One-time repo setup:** **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Every merge to `main` runs **`pages.yml`**, which builds and publishes `dist/` to GitHub Pages. Share that single link; it always reflects the latest `main` build.

### Browser cache on each deploy

- JS/CSS files use **content hashes** in filenames (Vite default).
- Each CI/Pages build sets **`VITE_BUILD_ID`** to the git commit SHA and writes **`version.json`**.
- On load, the game fetches `version.json` with `cache: 'no-store'`; if it differs from the embedded id, it **reloads once** with `?b=<sha>` so players pick up the new bundle without a manual hard refresh.
- `index.html` includes **no-cache** meta tags to reduce stale HTML shell caching (GitHub Pages does not allow custom `Cache-Control` headers).

Tagged releases (`v*.*.*`) also deploy the same way and add an optional zip on the GitHub Release page for archival only — normal play is still the Pages URL.

---

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push/PR to `main` | Parallel `verify` (always) + conditional `e2e` (path filter on PR; on `main` only after conflict-resolution merge) |

**CI dependency caching:** `setup-node` caches **npm** (`~/.npm`) in both jobs. The **e2e** job also caches Playwright **browser binaries** under `~/.cache/ms-playwright`, keyed by runner OS plus `package-lock.json` (so the resolved `@playwright/test` version). `npx playwright install --with-deps chromium` still runs each time; on a cache hit it skips re-downloading browsers.
| `pages.yml` | Push to `main` | Publish playable site |
| `release.yml` | Push tag `v*.*.*` | Pages deploy + GitHub Release notes + optional zip |

CI does **not** upload Actions artifacts (large Phaser bundles were hitting account storage limits). Verification is build success only; hosting is **Pages**.

---

## Day-to-day development

1. Branch from `main` (cloud agents: `cursor/<name>-ee24`).
2. Open PR → **CI** runs **verify** always; **e2e** when gameplay paths change (see `docs/TESTING.md`).
3. Merge to `main` → **Pages** updates the public link within a few minutes.

---

## Version tags (optional milestones)

```bash
git tag v0.1.0
git push origin v0.1.0
```

Creates a GitHub Release with auto-generated notes and an optional zip. The playable URL is the same Pages site (updated by that workflow).

Update `package.json` `version` to match the tag when you cut releases.

---

## Vite base path

Production builds use base `/DefenseGame/` for GitHub Pages project sites. Dev uses `/`. Override with `VITE_BASE` if you change hosting.

---

## Future: mobile store builds

Capacitor wraps the same web `dist/`. Store builds (signed APK/IPA) are a later workflow when signing secrets exist.

---

## Required checks for agents

```bash
npm run typecheck && npm run test && npm run build
```

CI uses Node **24** (`.nvmrc`) on **`ubuntu-24.04`** runners (`ci.yml` jobs).
