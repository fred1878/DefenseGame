import { describe, expect, it, vi } from "vitest";
import { GAME } from "../config";
import { DEFENSE_UI_CAMERA_NAME, defenseWorldToScreen } from "./defenseCamera";
import { defenseFieldPx } from "../config/defense";
import {
  defensePlayAreaLayout,
  readSafeInsets,
} from "../ui/layout/screenLayout";
import {
  configureDefenseFollowCamera,
  setupDefenseCameraRig,
} from "./defenseCamera";

type FakeCamera = {
  x: number;
  y: number;
  width: number;
  height: number;
  originX: number;
  originY: number;
  scrollX: number;
  scrollY: number;
  zoomX: number;
  zoomY: number;
  roundPixels: boolean;
  matrix: ReturnType<typeof fakeMatrix>;
  matrixExternal: ReturnType<typeof fakeMatrix>;
  matrixCombined: ReturnType<typeof fakeMatrix>;
  preRender: () => void;
  setName: ReturnType<typeof vi.fn>;
  setScroll: ReturnType<typeof vi.fn>;
  setZoom: ReturnType<typeof vi.fn>;
  setViewport: ReturnType<typeof vi.fn>;
  setBackgroundColor: ReturnType<typeof vi.fn>;
  startFollow: ReturnType<typeof vi.fn>;
  setDeadzone: ReturnType<typeof vi.fn>;
  ignore: ReturnType<typeof vi.fn>;
};

function fakeMatrix() {
  return {
    applyITRS: vi.fn(),
    translate: vi.fn(),
    multiply: vi.fn(),
  };
}

function fakeCamera(width = GAME.width, height = GAME.height): FakeCamera {
  return {
    x: 0,
    y: 0,
    width,
    height,
    originX: 0.5,
    originY: 0.5,
    scrollX: 0,
    scrollY: 0,
    zoomX: 1,
    zoomY: 1,
    roundPixels: true,
    matrix: fakeMatrix(),
    matrixExternal: fakeMatrix(),
    matrixCombined: fakeMatrix(),
    preRender: vi.fn(),
    setName: vi.fn(),
    setScroll: vi.fn(),
    setZoom: vi.fn(),
    setViewport: vi.fn(),
    setBackgroundColor: vi.fn(),
    startFollow: vi.fn(),
    setDeadzone: vi.fn(),
    ignore: vi.fn(),
  };
}

const asCamera = (camera: FakeCamera): Phaser.Cameras.Scene2D.Camera =>
  camera as unknown as Phaser.Cameras.Scene2D.Camera;

const follow = {} as Phaser.GameObjects.GameObject;

describe("defenseWorldToScreen", () => {
  it("maps world origin with viewport inset", () => {
    const scene = {
      scale: { width: GAME.width, height: GAME.height },
    } as Parameters<typeof defensePlayAreaLayout>[0];
    const safe = readSafeInsets();
    const play = defensePlayAreaLayout(scene, safe);
    const cam = {
      scrollX: 10,
      scrollY: 20,
      zoom: 1,
      x: play.x,
      y: play.y,
    } as Pick<
      Phaser.Cameras.Scene2D.Camera,
      "scrollX" | "scrollY" | "zoom" | "x" | "y"
    > as Phaser.Cameras.Scene2D.Camera;

    const pt = defenseWorldToScreen(cam, 0, 0);
    expect(pt.x).toBe(-10 + play.x);
    expect(pt.y).toBe(-20 + play.y);
  });
});

function testPlayArea(): ReturnType<typeof defensePlayAreaLayout> {
  const scene = {
    scale: { width: GAME.width, height: GAME.height },
  } as Parameters<typeof defensePlayAreaLayout>[0];
  return defensePlayAreaLayout(scene, readSafeInsets());
}

describe("configureDefenseFollowCamera", () => {
  it("follows on Y only and centers the field when it fits the play area", () => {
    const camera = fakeCamera();
    const play = { ...testPlayArea(), width: 1000 };
    const fieldW = defenseFieldPx().width;

    configureDefenseFollowCamera(asCamera(camera), follow, play);

    expect(camera.setZoom).toHaveBeenCalledWith(1);
    expect(camera.setBackgroundColor).toHaveBeenCalledWith(0x0c0c0e);
    expect(camera.startFollow).toHaveBeenCalledWith(follow, true, 0, 0.14);
    expect(camera.setDeadzone).toHaveBeenCalledWith(play.width + 1, 0);
    expect(camera.setScroll).toHaveBeenCalledWith(
      -fieldW / 2 - (play.width - fieldW) / 2,
      0,
    );
  });

  it("allows horizontal panning when the field is wider than the play area", () => {
    const camera = fakeCamera();
    const play = testPlayArea();
    expect(defenseFieldPx().width).toBeGreaterThan(play.width);

    configureDefenseFollowCamera(asCamera(camera), follow, play);

    expect(camera.startFollow).toHaveBeenCalledWith(follow, true, 0.14, 0.14);
    expect(camera.setDeadzone).toHaveBeenCalledWith(0, 0);
    expect(camera.setScroll).not.toHaveBeenCalled();
  });
});

describe("setupDefenseCameraRig", () => {
  function setup(): {
    worldCamera: FakeCamera;
    uiCamera: FakeCamera;
    worldLayer: {
      add: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
    };
    rig: ReturnType<typeof setupDefenseCameraRig>;
  } {
    const worldCamera = fakeCamera();
    const uiCamera = fakeCamera();
    const worldLayer = {
      add: vi.fn((child: { parentContainer?: unknown }) => {
        // Mirrors Phaser: a layer parents the objects it adopts.
        child.parentContainer = worldLayer;
      }),
      remove: vi.fn(),
    };
    const scene = {
      cameras: { main: worldCamera, add: vi.fn(() => uiCamera) },
      scale: { width: GAME.width, height: GAME.height },
      add: { layer: vi.fn(() => worldLayer) },
      registry: { get: () => undefined },
    } as unknown as Phaser.Scene;
    const rig = setupDefenseCameraRig(scene, follow, testPlayArea());
    return { worldCamera, uiCamera, worldLayer, rig };
  }

  it("mounts a full-canvas UI camera and viewports the world camera", () => {
    const { worldCamera, uiCamera, worldLayer } = setup();
    const play = testPlayArea();

    expect(uiCamera.setName).toHaveBeenCalledWith(DEFENSE_UI_CAMERA_NAME);
    expect(uiCamera.setScroll).toHaveBeenCalledWith(0, 0);
    expect(uiCamera.setZoom).toHaveBeenCalledWith(1);
    expect(uiCamera.ignore).toHaveBeenCalledWith(worldLayer);
    expect(worldCamera.setViewport).toHaveBeenCalledWith(
      play.x,
      play.y,
      play.width,
      play.height,
    );
    expect(worldCamera.setBackgroundColor).toHaveBeenCalledWith(0x0c0c0e);
  });

  it("keeps HUD objects off the world camera and reparents world objects", () => {
    const { worldCamera, worldLayer, rig } = setup();
    const hud = {
      parentContainer: null,
    } as unknown as Phaser.GameObjects.GameObject;

    rig.registerUi(hud);
    expect(worldCamera.ignore).toHaveBeenCalledWith(hud);
    expect(worldLayer.remove).not.toHaveBeenCalled();

    const worldChild = {
      parentContainer: worldLayer,
    } as unknown as Phaser.GameObjects.GameObject;
    rig.registerUi(worldChild);
    expect(worldLayer.remove).toHaveBeenCalledWith(worldChild);
    expect(worldCamera.ignore).toHaveBeenCalledWith(worldChild);
  });

  it("adopts legacy world objects once", () => {
    const { worldLayer, rig } = setup();
    const legacy = {
      parentContainer: null,
    } as unknown as Phaser.GameObjects.GameObject;

    rig.registerWorld(legacy);
    expect(worldLayer.add).toHaveBeenCalledWith(legacy);

    rig.registerWorld(legacy);
    expect(worldLayer.add).toHaveBeenCalledTimes(1);
  });
});
