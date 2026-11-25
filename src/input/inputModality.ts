import Phaser from "phaser";

/** Emitted on a scene when the modality stack changes (push/pop). */
export const INPUT_MODALITY_CHANGED = "input-modality-changed";

export type InputModalityLayer = "modal" | "transient";

export type InputModalityToken = {
  readonly id: string;
  readonly layer: InputModalityLayer;
};

const STACK_KEY_PREFIX = "inputModalityStack:";

function stackKey(scene: Phaser.Scene): string {
  return `${STACK_KEY_PREFIX}${scene.scene.key}`;
}

function modalityStack(scene: Phaser.Scene): InputModalityToken[] {
  const key = stackKey(scene);
  let stack = scene.registry.get(key) as InputModalityToken[] | undefined;
  if (!stack) {
    stack = [];
    scene.registry.set(key, stack);
  }
  return stack;
}

function emitChanged(scene: Phaser.Scene): void {
  scene.events.emit(INPUT_MODALITY_CHANGED);
}

/** Register a new input owner (top of stack). Duplicate ids are ignored. */
export function pushInputModality(
  scene: Phaser.Scene,
  token: InputModalityToken,
): void {
  const stack = modalityStack(scene);
  if (stack.some((t) => t.id === token.id)) return;
  stack.push(token);
  emitChanged(scene);
}

/** Remove an input owner by id (anywhere in the stack). */
export function popInputModality(scene: Phaser.Scene, id: string): void {
  const stack = modalityStack(scene);
  const idx = stack.findIndex((t) => t.id === id);
  if (idx < 0) return;
  stack.splice(idx, 1);
  emitChanged(scene);
}

/** Clear every modality for this scene (e.g. on shutdown). */
export function clearInputModalities(scene: Phaser.Scene): void {
  const key = stackKey(scene);
  const stack = scene.registry.get(key) as InputModalityToken[] | undefined;
  if (!stack?.length) return;
  stack.length = 0;
  emitChanged(scene);
}

export function peekInputModality(scene: Phaser.Scene): InputModalityToken | null {
  const stack = modalityStack(scene);
  return stack.length > 0 ? stack[stack.length - 1]! : null;
}

export function isInputModalityActive(scene: Phaser.Scene, id: string): boolean {
  return modalityStack(scene).some((t) => t.id === id);
}

/** True when a modal layer owns input (blocks town layout / defense HUD base). */
export function blocksBaseLayerInput(scene: Phaser.Scene): boolean {
  const top = peekInputModality(scene);
  return top !== null && top.layer === "modal";
}

export const INPUT_MODALITY = {
  townSpellSort: { id: "town:spell-sort", layer: "modal" as const },
  townEndless: { id: "town:endless", layer: "modal" as const },
  townWavePlanner: { id: "town:wave-planner", layer: "modal" as const },
  townDefenseLoading: { id: "town:defense-loading", layer: "modal" as const },
  debugMenu: { id: "debug-menu", layer: "modal" as const },
  defenseGroundAim: { id: "defense:ground-aim", layer: "transient" as const },
} satisfies Record<string, InputModalityToken>;