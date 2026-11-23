import type Phaser from "phaser";

let defenseScenePromise: Promise<void> | null = null;
let debugMenuScenePromise: Promise<void> | null = null;

export async function ensureDefenseScene(game: Phaser.Game): Promise<void> {
  if (game.scene.getScene("Defense")) return;
  if (!defenseScenePromise) {
    defenseScenePromise = import("../scenes/DefenseScene").then(({ DefenseScene }) => {
      game.scene.add("Defense", DefenseScene, false);
    });
  }
  await defenseScenePromise;
}

export async function ensureDebugMenuScene(game: Phaser.Game): Promise<void> {
  if (game.scene.getScene("DebugMenu")) return;
  if (!debugMenuScenePromise) {
    debugMenuScenePromise = import("../scenes/DebugMenuScene").then(
      ({ DebugMenuScene }) => {
        game.scene.add("DebugMenu", DebugMenuScene, false);
      },
    );
  }
  await debugMenuScenePromise;
}

export function resetLazyScenesForTests(): void {
  defenseScenePromise = null;
  debugMenuScenePromise = null;
}
