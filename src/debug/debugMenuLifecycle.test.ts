import { describe, expect, it, vi } from "vitest";
import {
  pauseForDebugMenu,
  resumeFromDebugMenu,
} from "./debugMenuLifecycle";

function mockScene(paused = false) {
  const isPaused = vi.fn(() => paused);
  const pause = vi.fn(() => {
    paused = true;
  });
  const resume = vi.fn(() => {
    paused = false;
  });
  const scene = {
    key: "Defense",
    scene: { key: "Defense", isPaused, pause, resume },
  } as unknown as Phaser.Scene;
  return { scene, isPaused, pause, resume, getPaused: () => paused };
}

describe("debugMenuLifecycle", () => {
  it("pauses the host scene once", () => {
    const { scene, pause, isPaused } = mockScene(false);
    pauseForDebugMenu(scene);
    expect(pause).toHaveBeenCalledWith("Defense");
    isPaused.mockReturnValue(true);
    pauseForDebugMenu(scene);
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("resumes when paused", () => {
    const { scene, resume, isPaused } = mockScene(true);
    isPaused.mockReturnValue(true);
    resumeFromDebugMenu(scene);
    expect(resume).toHaveBeenCalledWith("Defense");
  });
});