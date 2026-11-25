/** Minimal Phaser stand-in for Vitest (no WebGL / window). */

export class Vector2 {
  x = 0;
  y = 0;
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }
}

const MathNS = {
  Vector2,
  Distance: {
    Between: (x1: number, y1: number, x2: number, y2: number) =>
      Math.hypot(x2 - x1, y2 - y1),
  },
  DegToRad: (deg: number) => (deg * Math.PI) / 180,
  Clamp: (v: number, min: number, max: number) => Math.max(min, Math.min(max, v)),
};

const Phaser = {
  AUTO: 0,
  Math: MathNS,
  Scale: { FIT: 0, CENTER_BOTH: 0 },
  Input: { Events: { POINTER_DOWN: "pointerdown", POINTER_UP: "pointerup" } },
  Loader: { Events: { COMPLETE: "complete", FILE_LOAD_ERROR: "loaderror" } },
  Scenes: { Events: { CREATE: "create", SHUTDOWN: "shutdown", DESTROY: "destroy", TRANSITION_START: "transitionstart", TRANSITION_COMPLETE: "transitioncomplete" } },
  GameObjects: {
    Components: {
      TransformMatrix: class {
        tx = 0;
        ty = 0;
        scaleX = 1;
        scaleY = 1;
      },
    },
    Container: class {},
    Rectangle: class {},
    Arc: class {},
    Ellipse: class {},
    Image: class {},
    Graphics: class {},
    Text: class {},
    GameObject: class {},
  },
  Geom: {
    Rectangle: class {
      constructor(
        public x: number,
        public y: number,
        public width: number,
        public height: number,
      ) {}
      static Contains = (): boolean => true;
    },
    Circle: class {
      constructor(
        public x: number,
        public y: number,
        public radius: number,
      ) {}
      static Contains = (): boolean => true;
    },
  },
  Types: { Input: { EventData: class {} } },
  Textures: { FilterMode: { LINEAR: 0, NEAREST: 1 } },
  Physics: { Arcade: { Sprite: class {}, Body: class {} } },
  Cameras: { Scene2D: { Camera: class {} } },
};

export default Phaser;
export { MathNS as Math };