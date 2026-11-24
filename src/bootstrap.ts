import { ensureFreshBuild } from "./ensureFreshBuild";

/**
 * Thin entry: version check, then dynamically import the Phaser app chunk.
 * Keeps the initial module graph small until `gameMain` (and `phaser` vendor chunk) load.
 */
async function boot(): Promise<void> {
  await ensureFreshBuild();
  await import("./gameMain");
}

void boot();