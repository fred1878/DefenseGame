/**
 * Recording fakes for Phaser scenes and game objects in unit tests.
 *
 * Every game object is a Proxy: known fields (x, y, visible, alpha, …) are
 * plain values, `on`/`once`/`emit` work, `destroy()` flags it, and any other
 * method call is recorded and returns the object, so Phaser-style chains
 * (`add.image(…).setDepth(…).setAlpha(…)`) just work. Objects made by
 * `scene.add.<kind>` are instances of the matching stub class, so
 * `instanceof Phaser.GameObjects.Image` holds for `add.image`.
 */
import Phaser from "phaser";
import { vi } from "vitest";

type Fn = (...args: unknown[]) => unknown;

export type FakeGameObject = {
  kind: string;
  args: unknown[];
  calls: Array<[string, unknown[]]>;
  destroyed: boolean;
  x: number;
  y: number;
  visible: boolean;
  alpha: number;
  active: boolean;
  /** Fire listeners registered with `on`/`once`. */
  emit(event: string, ...args: unknown[]): void;
  /** Arguments of every call to `method`, oldest first. */
  callsTo(method: string): unknown[][];
  /** Arguments of the latest call to `method`, or undefined. */
  last(method: string): unknown[] | undefined;
  setPosition(x: number, y?: number): FakeGameObject;
  setVelocity(vx: number, vy?: number): FakeGameObject;
  setAlpha(alpha: number): FakeGameObject;
  setVisible(visible: boolean): FakeGameObject;
  destroy(): void;
  [key: string]: unknown;
};

const STUB_CLASS: Record<string, string> = {
  image: "Image",
  sprite: "Sprite",
  graphics: "Graphics",
  text: "Text",
  container: "Container",
  rectangle: "Rectangle",
  arc: "Arc",
  circle: "Arc",
  ellipse: "Ellipse",
};

export function fakeGameObject(
  kind = "object",
  args: unknown[] = [],
): FakeGameObject {
  const cls = (Phaser.GameObjects as unknown as Record<string, unknown>)[
    STUB_CLASS[kind] ?? "GameObject"
  ] as { prototype: object } | undefined;
  const target = Object.create(cls?.prototype ?? Object.prototype) as Record<
    string,
    unknown
  >;
  const listeners = new Map<string, Array<{ fn: Fn; once: boolean }>>();
  const calls: Array<[string, unknown[]]> = [];
  Object.assign(target, {
    kind,
    args,
    calls,
    destroyed: false,
    x: typeof args[0] === "number" ? args[0] : 0,
    y: typeof args[1] === "number" ? args[1] : 0,
    visible: true,
    alpha: 1,
    active: true,
    list: [] as unknown[],
    anims: { timeScale: 1 },
    texture: { key: typeof args[2] === "string" ? args[2] : "" },
    body: {
      velocity: { x: 0, y: 0 },
      enable: true,
      stop: () => undefined,
      reset: () => undefined,
      setVelocity(this: { velocity: { x: number; y: number } }, vx: number, vy: number) {
        this.velocity.x = vx;
        this.velocity.y = vy;
      },
    },
  });
  let proxy: FakeGameObject;
  const own: Record<string, Fn> = {
    on: (event, fn) => {
      const arr = listeners.get(event as string) ?? [];
      arr.push({ fn: fn as Fn, once: false });
      listeners.set(event as string, arr);
      return proxy;
    },
    once: (event, fn) => {
      const arr = listeners.get(event as string) ?? [];
      arr.push({ fn: fn as Fn, once: true });
      listeners.set(event as string, arr);
      return proxy;
    },
    off: (event) => {
      listeners.delete(event as string);
      return proxy;
    },
    emit: (event, ...rest) => {
      const arr = listeners.get(event as string) ?? [];
      listeners.set(
        event as string,
        arr.filter((l) => !l.once),
      );
      for (const l of arr) l.fn(...rest);
    },
    destroy: () => {
      calls.push(["destroy", []]);
      target.destroyed = true;
    },
    callsTo: (method) =>
      calls.filter(([m]) => m === method).map(([, a]) => a),
    last: (method) => {
      const all = calls.filter(([m]) => m === method);
      return all.at(-1)?.[1];
    },
    setVisible: (v) => {
      calls.push(["setVisible", [v]]);
      target.visible = Boolean(v);
      return proxy;
    },
    setAlpha: (a) => {
      calls.push(["setAlpha", [a]]);
      target.alpha = a as number;
      return proxy;
    },
    setPosition: (x, y) => {
      calls.push(["setPosition", [x, y]]);
      target.x = x as number;
      if (y !== undefined) target.y = y as number;
      return proxy;
    },
    setVelocity: (vx, vy) => {
      calls.push(["setVelocity", [vx, vy]]);
      const body = target.body as { velocity: { x: number; y: number } };
      body.velocity.x = vx as number;
      body.velocity.y = (vy ?? vx) as number;
      return proxy;
    },
    add: (child) => {
      calls.push(["add", [child]]);
      const list = target.list as unknown[];
      if (Array.isArray(child)) list.push(...child);
      else list.push(child);
      return proxy;
    },
  };
  proxy = new Proxy(target, {
    get(t, prop, recv) {
      if (typeof prop === "symbol") return Reflect.get(t, prop, recv);
      if (prop in own) return own[prop];
      if (prop in t) return t[prop];
      if (prop === "then") return undefined;
      return (...a: unknown[]) => {
        calls.push([prop, a]);
        return proxy;
      };
    },
    set(t, prop, value) {
      (t as Record<string | symbol, unknown>)[prop] = value;
      return true;
    },
  }) as FakeGameObject;
  return proxy;
}

export type TweenConfig = {
  targets: unknown;
  duration?: number;
  delay?: number;
  ease?: string;
  repeat?: number;
  yoyo?: boolean;
  onUpdate?: Fn;
  onComplete?: Fn;
  [key: string]: unknown;
};

export type FakeScene = ReturnType<typeof fakeScene>;

/** A scene with recording `add`, `tweens`, `time`, `textures` and `anims`. */
export function fakeScene(
  opts: { textures?: string[]; anims?: string[]; audio?: string[] } = {},
) {
  const created: FakeGameObject[] = [];
  const tweenConfigs: TweenConfig[] = [];
  const delayed: Array<{ delay: number; fn: Fn; args: unknown[] }> = [];
  const textures = new Set(opts.textures ?? []);
  const anims = new Set(opts.anims ?? []);
  const audio = new Set(opts.audio ?? []);
  const factory = (prefix: string) =>
    new Proxy(
      {},
      {
        get(_t, kind: string) {
          return (...args: unknown[]) => {
            const go = fakeGameObject(`${prefix}${kind}`, args);
            created.push(go);
            return go;
          };
        },
      },
    );
  const add = factory("");
  const registryData = new Map<string, unknown>();
  const scene = {
    add,
    /** `physics.add.sprite` creates kind `physics.sprite`. */
    physics: { add: factory("physics.") },
    registry: {
      get: (key: string) => registryData.get(key),
      set: (key: string, value: unknown) => {
        registryData.set(key, value);
      },
    },
    created,
    tweenConfigs,
    delayed,
    /** Created objects of one kind, oldest first. */
    made: (kind: string) => created.filter((g) => g.kind === kind),
    tweens: {
      add: vi.fn((cfg: TweenConfig) => {
        tweenConfigs.push(cfg);
        return fakeGameObject("tween");
      }),
      killTweensOf: vi.fn(),
    },
    time: {
      delayedCall: vi.fn((delay: number, fn: Fn, args: unknown[] = []) => {
        delayed.push({ delay, fn, args });
        return fakeGameObject("timer");
      }),
      now: 0,
    },
    textures: {
      exists: (key: string) => textures.has(key),
      get: (key: string) => fakeGameObject("texture", [key]),
    },
    anims: {
      exists: (key: string) => anims.has(key),
      get: (key: string) => (anims.has(key) ? { key, duration: 0 } : undefined),
      create: vi.fn((cfg: { key: string }) => {
        anims.add(cfg.key);
        return cfg;
      }),
      generateFrameNumbers: vi.fn(
        (key: string, range: { start: number; end: number }) => {
          const out: Array<{ key: string; frame: number }> = [];
          for (let f = range.start; f <= range.end; f++) out.push({ key, frame: f });
          return out;
        },
      ),
    },
    cache: { audio: { exists: (key: string) => audio.has(key) } },
    sound: { play: vi.fn() },
    sys: { isActive: () => true },
  };
  return scene;
}

/** Run a recorded tween to its end: set end values, then onUpdate + onComplete. */
export function finishTween(cfg: TweenConfig): void {
  const skip = new Set([
    "targets",
    "duration",
    "delay",
    "ease",
    "repeat",
    "yoyo",
    "onUpdate",
    "onComplete",
    "hold",
    "repeatDelay",
  ]);
  const targets = Array.isArray(cfg.targets) ? cfg.targets : [cfg.targets];
  for (const t of targets as Array<Record<string, unknown>>) {
    for (const [k, v] of Object.entries(cfg)) {
      if (!skip.has(k) && typeof v === "number") t[k] = v;
    }
  }
  cfg.onUpdate?.();
  cfg.onComplete?.();
}

/** Cast helper: the fake satisfies the parts of `Phaser.Scene` the code uses. */
export function asScene(scene: FakeScene): Phaser.Scene {
  return scene as unknown as Phaser.Scene;
}
