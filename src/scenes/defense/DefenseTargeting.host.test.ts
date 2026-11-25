import { describe, expect, it } from "vitest";

/**
 * DefenseScene reassigns `enemies` after deaths; targeting must read via getter, not a stale array ref.
 */
describe("DefenseTargeting enemy list", () => {
  it("sees respawns only when using a live getter", () => {
    type Stub = { id: string; alive: boolean };
    let enemies: Stub[] = [{ id: "a", alive: true }];
    const getEnemies = () => enemies;

    expect(getEnemies().map((e) => e.id)).toEqual(["a"]);

    enemies = enemies.filter((e) => e.alive);
    enemies.push({ id: "b", alive: true });

    const staleRef = [{ id: "a", alive: true }];
    expect(staleRef.map((e) => e.id)).toEqual(["a"]);
    expect(getEnemies().map((e) => e.id)).toEqual(["a", "b"]);
  });
});
