import { describe, expect, it } from "vitest";
import {
  TOWN_ENDLESS_SETUP_SCENE_KEY,
  TOWN_WAVE_PLANNER_SETUP_SCENE_KEY,
} from "../scenes/town/townSetupSceneLifecycle";
import {
  activeEndlessSetupScene,
  activeTownUiHost,
  e2eReportsTownScene,
} from "./townUiHost";

function gameWith(
  scenes: Record<string, { isActive: boolean; isPaused?: boolean }>,
) {
  return {
    scene: {
      getScene: (key: string) => {
        const s = scenes[key];
        if (!s) return null;
        return {
          scene: {
            key,
            isActive: () => s.isActive,
            isPaused: () => !!s.isPaused,
          },
        };
      },
    },
  } as unknown as Phaser.Game;
}

describe("activeTownUiHost", () => {
  it("prefers an active endless setup, then the wave planner, then Town", () => {
    expect(
      activeTownUiHost(
        gameWith({ [TOWN_ENDLESS_SETUP_SCENE_KEY]: { isActive: true } }),
      )?.scene.key,
    ).toBe(TOWN_ENDLESS_SETUP_SCENE_KEY);
    expect(
      activeTownUiHost(
        gameWith({ [TOWN_WAVE_PLANNER_SETUP_SCENE_KEY]: { isActive: true } }),
      )?.scene.key,
    ).toBe(TOWN_WAVE_PLANNER_SETUP_SCENE_KEY);
    expect(
      activeTownUiHost(gameWith({ Town: { isActive: true } }))?.scene.key,
    ).toBe("Town");
    expect(
      activeTownUiHost(gameWith({ Town: { isActive: false, isPaused: true } }))
        ?.scene.key,
    ).toBe("Town");
    expect(activeTownUiHost(gameWith({}))).toBeNull();
  });

  it("reports the Town scene when a setup overlay or Town itself is up", () => {
    expect(
      e2eReportsTownScene(
        gameWith({ [TOWN_ENDLESS_SETUP_SCENE_KEY]: { isActive: true } }),
      ),
    ).toBe(true);
    expect(e2eReportsTownScene(gameWith({ Town: { isActive: true } }))).toBe(
      true,
    );
    expect(
      e2eReportsTownScene(
        gameWith({ Town: { isActive: false, isPaused: true } }),
      ),
    ).toBe(true);
    expect(e2eReportsTownScene(gameWith({}))).toBe(false);
  });
});

describe("activeEndlessSetupScene", () => {
  it("returns the endless setup only when it is the active host", () => {
    expect(
      activeEndlessSetupScene(
        gameWith({
          [TOWN_ENDLESS_SETUP_SCENE_KEY]: { isActive: true },
          Town: { isActive: true },
        }),
      )?.scene.key,
    ).toBe(TOWN_ENDLESS_SETUP_SCENE_KEY);
    expect(
      activeEndlessSetupScene(gameWith({ Town: { isActive: true } })),
    ).toBeNull();
    expect(
      activeEndlessSetupScene(
        gameWith({ [TOWN_WAVE_PLANNER_SETUP_SCENE_KEY]: { isActive: true } }),
      ),
    ).toBeNull();
  });
});
