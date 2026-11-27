# CI and releases

## Play the game (URL)

This is a **web game** — players open a link in the browser (phone or desktop), or **install** it: in Chrome, Edge, or Safari choose **Add to Home Screen** / **Install app**. After the first load the service worker precaches the build, so it works offline. A new deploy activates the next time the game is opened.

| What | URL |
|------|-----|
| **Latest on `main`** (after merge + Pages deploy) | https://fred1878.github.io/DefenseGame/ |
| **Android APK** | [Latest GitHub Release](https://github.com/fred1878/DefenseGame/releases/latest) |
| **Local dev** | `npm run dev` → http://127.0.0.1:5173 |

**One-time repo setup:** **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Every merge to `main` runs **`pages.yml`**, which builds and publishes `dist/` to GitHub Pages. Share that single link; it always reflects the latest `main` build.

### Browser cache on each deploy

- JS/CSS files use **content hashes** in filenames (Vite default).
- Each CI/Pages build sets **`VITE_BUILD_ID`** to the git commit SHA and writes **`version.json`**.
- On load, the game fetches `version.json` with `cache: 'no-store'` (the service worker does not precache it); if it differs from the embedded id, it **reloads once** with `?b=<sha>` so players pick up the new bundle without a manual hard refresh.
- The production service worker precaches hashed JS (including the Phaser chunk and lazy-loaded scenes), CSS, HTML, JSON data, images and audio. A new worker `skipWaiting`s but does not claim open clients, so the new version **activates on the next load**. Outdated caches are cleaned up. The worker is **not registered** in dev or e2e builds.
- `index.html` includes **no-cache** meta tags to reduce stale HTML shell caching (GitHub Pages does not allow custom `Cache-Control` headers).

Tagged releases (`v*.*.*`) also deploy the same way and add an optional zip on the GitHub Release page for archival only — normal web play is still the Pages URL. The **Android release** workflow attaches a signed APK to the same GitHub Release.

---

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push/PR to `main` | `verify` always, plus an advisory `sim` job (fixed-seed economy-sim bands, `continue-on-error`), then conditional `e2e` (e2e needs verify; path filter on PR; on `main` only after conflict-resolution merge) |

**CI dependency caching:** `setup-node` caches **npm** (`~/.npm`) in both jobs. The **e2e** job also caches Playwright **browser binaries** under `~/.cache/ms-playwright`, keyed by runner OS plus `package-lock.json` (so the resolved `@playwright/test` version). `npx playwright install --with-deps chromium` still runs each time; on a cache hit it skips re-downloading browsers.
| `pages.yml` | Push to `main` | Publish playable site |
| `release.yml` | Push tag `v*.*.*` | Pages deploy + GitHub Release notes + optional zip |
| `android-release.yml` | Push tag `v*` or **workflow_dispatch** | Build, sign, and attach the Android APK to the GitHub Release |

CI uploads Actions artifacts: **`vitest-coverage`** (from `verify`), **`economy-sim`** (the advisory sim report, retained 14 days), **`dist-e2e`** (when e2e will run, retained 1 day), and **`playwright-report`** (on e2e failure, retained 7 days). Hosting is **Pages**.

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

Creates a GitHub Release with auto-generated notes, an optional web zip, and a signed Android APK (`defensegame-<version>.apk`). The playable web URL is the same Pages site (updated by that workflow).

Update `package.json` `version` to match the tag when you cut releases.

---

## Vite base path

Production (Pages) builds use base `/DefenseGame/` for GitHub Pages project sites. Dev uses `/`. The Capacitor Android build uses `vite build --mode android`, which sets a relative base `./` so the WebView can load bundled assets. That mode does not affect Pages. Override with `VITE_BASE` if you change hosting.

---

## Android app

The same Phaser game is wrapped with [Capacitor](https://capacitorjs.com/) as an Android app (`com.fred1878.defensegame`). It is portrait-locked and fullscreen. Icons and splash art come from the existing PWA icons (`public/icons/`).

This is a sideloaded APK, not a Play Store build. iOS is not included.

### Install the APK

1. Open the [latest GitHub Release](https://github.com/fred1878/DefenseGame/releases/latest) on the phone (or copy the APK to it).
2. Download `defensegame-<version>.apk`.
3. Open the file. Android will ask you to allow the browser or file manager to **install unknown apps** — allow it for that source, then install.
4. The first install uses that same permission. After that, updates can be installed from inside the game (see below), but you still need to allow **DefenseGame** to install unknown apps when prompted.

If Android blocks the install, check **Settings → Apps → Special app access → Install unknown apps** and enable it for the app you used to open the APK (Chrome, Files, or DefenseGame itself).

### Update from the app

In the native app only, town (day) shows a **Check for update** button under the fullscreen control (top-left). It is hidden in the browser and the PWA.

- The button asks the public GitHub Releases API for the latest `fred1878/DefenseGame` release and compares it to the version baked into the APK.
- If you are already on that version, it shows **Up to date**.
- If a newer release has an APK, the game downloads it and opens the Android installer. Progress and errors appear under the button.
- The first time (and whenever Android requires it), you must allow DefenseGame to install unknown apps; the game opens that settings screen and asks you to try again afterwards.

Web and PWA players keep using the Pages site / service worker for updates. This button does not appear there.

### Build and signing (maintainers)

`android-release.yml` runs on tag `v*` and on **workflow_dispatch**. It builds the web assets with `--mode android`, syncs the Capacitor Android project, and runs Gradle.

- `versionName` comes from the tag (or `package.json` / the dispatch input).
- `versionCode` comes from the GitHub Actions run number, so each build is a higher Android version code.
- If the signing secrets are set, the workflow produces a **signed release APK**. If they are missing, it falls back to a **debug APK** named `defensegame-<version>-debug.apk`.

Repo secrets (never commit the keystore or passwords):

| Secret | Purpose |
|--------|---------|
| `ANDROID_KEYSTORE_BASE64` | PKCS12 release keystore, base64-encoded |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias (`defensegame`) |
| `ANDROID_KEY_PASSWORD` | Key password |

Keep a private backup of the same keystore. Android will not replace an installed app with an APK signed by a different key.

Local commands: `npm run build:android` then `npm run cap:sync`. A full signed APK is normally produced in CI.

---

## Required checks for agents

```bash
npm run verify && npm run build
```

CI uses Node **24** (`.nvmrc`) on **`ubuntu-24.04`** runners (`ci.yml` jobs).
