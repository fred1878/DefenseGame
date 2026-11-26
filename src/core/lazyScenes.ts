import type Phaser from "phaser";

let defenseScenePromise: Promise<void> | null = null;
let debugMenuScenePromise: Promise<void> | null = null;
let endlessSetupScenePromise: Promise<void> | null = null;
let wavePlannerSetupScenePromise: Promise<void> | null = null;

export async function ensureDefenseScene(game: Phaser.Game): Promise<void> {
  if (game.scene.getScene("Defense")) return;
  if (!defenseScenePromise) {
    defenseScenePromise = import("../scenes/DefenseScene").then(
      ({ DefenseScene }) => {
        game.scene.add("Defense", DefenseScene, false);
      },
    );
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

export async function ensureEndlessModeSetupScene(
  game: Phaser.Game,
): Promise<void> {
  const key = "TownEndlessSetup";
  if (game.scene.getScene(key)) return;
  if (!endlessSetupScenePromise) {
    endlessSetupScenePromise = import("../scenes/EndlessModeSetupScene").then(
      ({ EndlessModeSetupScene }) => {
        game.scene.add(key, EndlessModeSetupScene, false);
      },
    );
  }
  await endlessSetupScenePromise;
}

export async function ensureWavePlannerSetupScene(
  game: Phaser.Game,
): Promise<void> {
  const key = "TownWavePlannerSetup";
  if (game.scene.getScene(key)) return;
  if (!wavePlannerSetupScenePromise) {
    wavePlannerSetupScenePromise = import(
      "../scenes/WavePlannerSetupScene"
    ).then(({ WavePlannerSetupScene }) => {
      game.scene.add(key, WavePlannerSetupScene, false);
    });
  }
  await wavePlannerSetupScenePromise;
}

export function resetLazyScenesForTests(): void {
  defenseScenePromise = null;
  debugMenuScenePromise = null;
  endlessSetupScenePromise = null;
  wavePlannerSetupScenePromise = null;
}
