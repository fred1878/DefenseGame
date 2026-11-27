import type Phaser from "phaser";
import type { DefenseScene } from "../../scenes/DefenseScene";
import type { DefenseSceneE2eHost } from "../../scenes/defense/DefenseSceneE2EHost";
import type { TownScene } from "../../scenes/TownScene";
import type { HeadlessGame } from "./phaserHarness";

/** Wait until scene `key` is the active (running) scene. */
export async function waitForScene<T extends Phaser.Scene>(
  h: HeadlessGame,
  key: string,
  maxFrames = 3000,
): Promise<T> {
  await h.stepUntil(() => h.game.scene.isActive(key), { maxFrames });
  return h.game.scene.getScene(key) as T;
}

/** Wait for a live DefenseScene whose player exists (create() finished). */
export async function waitForDefense(h: HeadlessGame): Promise<DefenseScene> {
  await h.stepUntil(
    () => {
      if (!h.game.scene.isActive("Defense")) return false;
      const d = h.game.scene.getScene("Defense") as DefenseScene;
      return Boolean(d.e2e?.isReady());
    },
    { maxFrames: 3000 },
  );
  return h.game.scene.getScene("Defense") as DefenseScene;
}

/** Real tap on a Town UI target by its e2e id. */
export function tapTown(h: HeadlessGame, town: TownScene, id: string): void {
  const t = town.e2eGetUiTapTargets()[id];
  if (!t) {
    throw new Error(
      `no town target ${id}; have ${Object.keys(town.e2eGetUiTapTargets())}`,
    );
  }
  h.tap(t.x, t.y);
}

/** Real tap on a Defense HUD target by its e2e id. */
export function tapDefense(
  h: HeadlessGame,
  defense: DefenseScene,
  id: string,
): void {
  const e2e = defense.e2e as DefenseSceneE2eHost;
  const t = e2e.getUiTapTargets()[id];
  if (!t) {
    throw new Error(
      `no defense target ${id}; have ${Object.keys(e2e.getUiTapTargets())}`,
    );
  }
  h.tap(t.x, t.y);
}

/** Tap the start-night building and wait for the Defense scene. */
export async function startNightFromTown(
  h: HeadlessGame,
  town: TownScene,
): Promise<DefenseScene> {
  tapTown(h, town, "start-night");
  return waitForDefense(h);
}

/** Text labels inside a game object (recursing into containers). */
export function textsUnder(obj: Phaser.GameObjects.GameObject): string[] {
  const o = obj as unknown as {
    text?: string;
    list?: Phaser.GameObjects.GameObject[];
  };
  if (typeof o.text === "string") return [o.text];
  return o.list?.flatMap(textsUnder) ?? [];
}

/** First Text object (searching containers) whose text equals `label`. */
export function findText(
  scene: Phaser.Scene,
  label: string | RegExp,
): Phaser.GameObjects.Text | null {
  const walk = (
    list: Phaser.GameObjects.GameObject[],
  ): Phaser.GameObjects.Text | null => {
    for (const o of list) {
      const t = o as unknown as Phaser.GameObjects.Text & {
        list?: Phaser.GameObjects.GameObject[];
      };
      if (
        typeof t.text === "string" &&
        t.visible !== false &&
        (typeof label === "string" ? t.text === label : label.test(t.text))
      ) {
        return t;
      }
      if (t.list) {
        const hit = walk(t.list);
        if (hit) return hit;
      }
    }
    return null;
  };
  return walk(scene.children.list);
}

/** Real tap on the centre of the Text labelled `label` in `scene`. */
export function tapText(
  h: HeadlessGame,
  scene: Phaser.Scene,
  label: string | RegExp,
): void {
  const t = findText(scene, label);
  if (!t) throw new Error(`no text ${String(label)} in ${scene.scene.key}`);
  const b = t.getBounds();
  h.tap(b.centerX, b.centerY);
}

/** Interactive objects currently registered with `scene`'s input plugin. */
export function interactiveObjects(
  scene: Phaser.Scene,
): Phaser.GameObjects.GameObject[] {
  const input = scene.input as unknown as {
    _list: Phaser.GameObjects.GameObject[];
  };
  return [...input._list];
}
