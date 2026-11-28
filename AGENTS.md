# Agent entrypoint

Read **[docs/AGENTS.md](./docs/AGENTS.md)** for architecture, data formats, and implementation order.

Release and CI: **[docs/CI_RELEASES.md](./docs/CI_RELEASES.md)**.

**knip is CI-only.** Do not run `npm run knip` in agent sessions; the `verify` job in `.github/workflows/ci.yml` runs it. `npm run verify` does not include it.