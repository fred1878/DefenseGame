# Custom Phaser build (DefenseGame)

Official `phaser-arcade-physics.js` already drops Matter; this build also trims **Tilemaps**, unused **loader file types**, and **game object** factories we do not call.

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
| `loader-filetypes-index.js` | Copied over `phaser/src/loader/filetypes/index.js` during `build:phaser` only |

Webpack config: `scripts/phaser-webpack.config.cjs`. Size guards: `scripts/assert-phaser-chunk-size.mjs` (post-`vite build`) and `src/build/phaserVendorSize.test.ts`.