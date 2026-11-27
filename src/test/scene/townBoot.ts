import { vi } from "vitest";
import { BootScene } from "../../scenes/BootScene";
import { TownScene } from "../../scenes/TownScene";
import { createNewSave } from "../../core/save/GameState";
import { persistSave } from "../../core/save/saveRepository";
import type { SaveGame } from "../../core/save/saveTypes";
import { resetLazyScenesForTests } from "../../scenes/loading/lazyScenes";
import { bootHeadlessGame, type HeadlessGame } from "./phaserHarness";
import { startPublicServer, type StaticServer } from "./staticServer";

export interface TownBoot {
  h: HeadlessGame;
  server: StaticServer;
  town: TownScene;
  /** Wait for background loads, destroy the game and stop the server. */
  teardown(): Promise<void>;
}

/** Seeded Math.random (mulberry32) so spawns / procs replay identically. */
export function seedMathRandom(seed: number): void {
  let a = seed >>> 0;
  vi.spyOn(Math, "random").mockImplementation(() => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
}

/**
 * The real production path: BootScene loads shipped `public/` data and
 * textures over HTTP, then hands off to TownScene (same scene list as gameMain).
 */
export async function bootToTown(
  opts: {
    save?: (save: SaveGame) => SaveGame;
    /** Runs once the server is up, before the game boots (e.g. `hold`). */
    beforeBoot?: (server: StaticServer) => void;
  } = {},
): Promise<TownBoot> {
  if (opts.save) {
    // BootScene reads the save from localStorage, like a returning player.
    persistSave(opts.save(createNewSave()));
  }
  // Lazy scene imports are cached per module, not per game.
  resetLazyScenesForTests();
  const server = await startPublicServer();
  vi.stubEnv("BASE_URL", server.url);
  opts.beforeBoot?.(server);
  const h = await bootHeadlessGame({ scene: [BootScene, TownScene] });
  await h.stepUntil(() => h.game.scene.isActive("Town"), { maxFrames: 1200 });
  const town = h.game.scene.getScene("Town") as TownScene;
  return {
    h,
    server,
    town,
    async teardown() {
      const busy = () =>
        h.game.scene.getScenes(true).some((s) => s.load.isLoading());
      await h.stepUntil(() => !busy(), { maxFrames: 3000 });
      h.destroy();
      await server.close();
      vi.unstubAllEnvs();
    },
  };
}
