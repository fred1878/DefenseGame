# CI and releases

## Overview

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push/PR to `main` | Lint (typecheck), unit tests, production build |
| `release.yml` | Push tag `v*.*.*` | GitHub Release + web build artifacts + optional Pages deploy |

We ship **web builds first** (playable in browser and inside Capacitor later). Native store releases (signed APK/IPA) are a later phase with signing secrets.

---

## Day-to-day development

1. Branch from `main` (cloud agents: `cursor/<name>-ee24`).
2. Open PR → **CI** runs `npm ci`, `typecheck`, `test`, `build`.
3. Merge when green.

No release is created on merge; only tagged versions release.

---

## Cutting a release

Use [Semantic Versioning](https://semver.org/) tags on `main`:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The **Release** workflow will:

1. Build `dist/` with `npm run build`.
2. Create a GitHub Release for that tag.
3. Attach `defensegame-web-vX.Y.Z.zip` (contents of `dist/`).
4. Deploy the same build to **GitHub Pages** (project site) when Pages is enabled for the repo.

### Enable GitHub Pages (one-time)

Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.

After the first `v*` release, the playable URL is typically:

`https://fred1878.github.io/DefenseGame/`

(Vite `base` is set to `/DefenseGame/` in `vite.config.ts` for this path.)

---

## Version bumps before tag

Update `package.json` `version` to match the tag (manual or via `npm version patch`).

Suggested cadence:

- `v0.x.y` — active development, any main milestone (new night, town building, etc.).
- `v1.0.0` — first public “complete loop” (town → night → persist → repeat).

---

## Future: mobile store builds

Not automated yet. Planned steps:

1. Add `@capacitor/android` and `@capacitor/ios`, `npx cap sync`.
2. **Android:** store keystore + `KEYSTORE_*` secrets; GitHub Action builds AAB on tag (e.g. `v*` + `mobile` workflow).
3. **iOS:** Apple signing via Fastlane + App Store Connect API key secrets (manual or CI on macOS runner).

Keep web releases on every `v*` tag; add `release-mobile.yml` when signing credentials exist.

---

## Required checks for agents

Before pushing or opening a PR:

```bash
npm run typecheck && npm run test && npm run build
```

CI uses Node **22** (`.nvmrc`).