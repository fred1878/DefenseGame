# Manual UI capture (human review)

Playwright **does not** compare committed PNGs in CI. Input- and layout-based specs under `e2e/` gate merges. When Peter needs **visual proof** of an intentional HUD or scene change, agents run the capture scripts locally and attach **fresh** files from `/opt/cursor/artifacts/review/`.

## Scripts

| Command | Scenes |
|---------|--------|
| `npm run build:e2e && node scripts/capture/capture-ui-visual.mjs` | Town + Defense full viewport |
| `npm run build:e2e && node scripts/capture/capture-gear-panels.mjs` | Blacksmith, Inventory, Talents panels |
| `npm run build:e2e && node scripts/capture/capture-defense-hud.mjs` | Defense only |

Implementation is shared in `scripts/capture/lib/capture-review.mjs` and `scripts/capture/lib/capture-preview.mjs`.

## Output contract

Each capture:

1. Writes **`/opt/cursor/artifacts/review/{scene}-{git-sha}-{iso-timestamp}.png`** (never overwrites an older review file).
2. Prints one JSON line to stdout: `{ "path", "md5", "md5ChangedFromLastRun" }`.
3. Exits **non-zero** when:
   - `md5` matches `DEFENSE_VIEWPORT_STALE_MD5`, or a built-in stale denylist, or
   - `md5` matches the **previous** capture for that scene in the review folder (`md5ChangedFromLastRun: false`).

Before sharing with Peter, the coordinator must confirm `md5ChangedFromLastRun: true` and that the md5 differs from the last hash sent in chat for that scene.

## Optional env

- `CAPTURE_PORT` — preview port (default `4199`).
- `SHORT_SHA` — override git short sha in filenames.
- `DEFENSE_VIEWPORT_STALE_MD5` — extra stale hash to reject.

## Related

- [TESTING.md](./TESTING.md) — e2e layers and layout specs.
- Layout probes: `e2e/defense-hud-layout.spec.ts`, `e2e/town-spell-panel-layout.spec.ts`, `e2e/spellbar-textures.spec.ts`.