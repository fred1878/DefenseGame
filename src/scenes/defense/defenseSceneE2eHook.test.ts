import { afterEach, describe, expect, it } from "vitest";
import type { DefenseSceneE2eHost } from "./DefenseSceneE2EHost";
import type { DefenseSceneE2eDelegate } from "./DefenseSceneE2ETypes";
import {
  createRegisteredDefenseSceneE2eHost,
  registerDefenseSceneE2eHostFactory,
} from "./defenseSceneE2eHook";

describe("defenseSceneE2eHook", () => {
  afterEach(() => registerDefenseSceneE2eHostFactory(null));

  it("returns null until the E2E chunk registers a factory", () => {
    expect(
      createRegisteredDefenseSceneE2eHost({} as DefenseSceneE2eDelegate),
    ).toBeNull();
  });

  it("binds the registered factory to the scene", () => {
    const scene = {} as DefenseSceneE2eDelegate;
    const host = {} as DefenseSceneE2eHost;
    registerDefenseSceneE2eHostFactory((s) => (s === scene ? host : host));
    expect(createRegisteredDefenseSceneE2eHost(scene)).toBe(host);
  });
});
