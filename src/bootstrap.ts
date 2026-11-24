import { markBoot, measureBoot } from "./core/bootPerf";
import { ensureFreshBuild } from "./ensureFreshBuild";

/**
 * Thin entry: version check, then dynamically import the Phaser app chunk.
 * Keeps the initial module graph small until `gameMain` (and `phaser` vendor chunk) load.
 */
async function boot(): Promise<void> {
  markBoot("defensegame:bootstrap-start");
  void import("phaser");

  markBoot("defensegame:ensure-fresh-build-start");
  await ensureFreshBuild();
  markBoot("defensegame:ensure-fresh-build-end");
  measureBoot(
    "defensegame:ensure-fresh-build",
    "defensegame:ensure-fresh-build-start",
    "defensegame:ensure-fresh-build-end",
  );

  markBoot("defensegame:gamemain-import-start");
  await import("./gameMain");
  markBoot("defensegame:gamemain-import-end");
  measureBoot(
    "defensegame:gamemain-import",
    "defensegame:gamemain-import-start",
    "defensegame:gamemain-import-end",
  );
}

void boot();