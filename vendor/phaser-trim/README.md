# Custom Phaser build (DefenseGame)

Official `phaser-arcade-physics.js` already drops Matter; this build also trims the **Tilemaps** namespace, the **Tilemap loader file types**, and **game object** factories we do not call.

| Build | Vendor UMD | Vite 8 `phaser-*.js` chunk |
|---|---|---|
| Phaser 3.90: Arcade + Tilemaps (before Nov 2026 trim) | 6,358,906 B (990,920 gzip) | 948,713 B (248,997 gzip) |
| Phaser 3.90: no Tilemaps, no Tilemap loaders | 5,845,393 B (915,464 gzip) | 878,116 B (230,349 gzip) |
| **Current: Phaser 4.2.1**, same trims, no Create/FX/Camera3D/FBInstant | 6,495,414 B (1,077,206 gzip) | 1,017,445 B (261,236 gzip) |

(Under Vite 5 the chunk was 1,204,700 B / 268,145 gzip before and 1,113,316 B / 248,233 gzip after.)

The game loads assets with `image`, `spritesheet` and `audio` only, and never touches `Phaser.Tilemaps`.
Arcade physics still pulls in a few small tile-collision helpers internally; that is expected.

## Rebuild

```bash
npm run build:phaser   # writes vendor/phaser-defense.js + manifest
npm run postinstall    # copies vendor → node_modules/phaser/dist/phaser-defensegame.js
npm run build          # Vite alias: node_modules/phaser/dist/phaser-defensegame.js
```

Bump `phaser` in `package.json` → run `build:phaser` → run tests (manifest version check) → commit `vendor/phaser-defense.js` and `vendor/phaser-defense.manifest.json`.

Trim manifests in this folder:

| File | Role |
|------|------|
| `phaser-defense-entry.js` | Webpack entry (arcade physics, no Tilemaps namespace) |
| `gameobjects-index.js` | Copied over `phaser/src/gameobjects/index.js` during `build:phaser` only |
| `loader-filetypes-index.js` | Copied over `phaser/src/loader/filetypes/index.js` during `build:phaser` only (drops Tilemap CSV/Impact/JSON loaders) |

Both overlays are listed in `PHASER_OVERLAYS` in `scripts/build/build-phaser-custom.mjs`; the originals are restored after the build.

Webpack config: `scripts/build/phaser-webpack.config.cjs`. Size guards: `scripts/build/assert-phaser-chunk-size.mjs` (post-`vite build`) and `src/build/phaserVendorSize.test.ts`. Lower both baselines when a trim shrinks the bundle.
