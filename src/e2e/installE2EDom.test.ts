import { afterEach, describe, expect, it, vi } from "vitest";
import { GAME } from "../config";
import { ensureDomTestActions, positionDomMirrors } from "./installE2EDom";
import type { DefenseGameE2EApi } from "./e2eGlobal";

type FakeEl = {
  id: string;
  type: string;
  textContent: string;
  style: { cssText: string; left: string; top: string; display: string };
  attrs: Record<string, string>;
  children: FakeEl[];
  clicks: Array<() => void>;
  setAttribute(name: string, value: string): void;
  appendChild(child: FakeEl): FakeEl;
  querySelector(sel: string): FakeEl | null;
  addEventListener(type: string, fn: () => void): void;
  getBoundingClientRect?: () => {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};

function createEl(tag: string): FakeEl {
  const el: FakeEl = {
    id: "",
    type: "",
    textContent: "",
    style: { cssText: "", left: "", top: "", display: "" },
    attrs: {},
    children: [],
    clicks: [],
    setAttribute(name, value) {
      this.attrs[name] = value;
      if (name === "id") this.id = value;
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    querySelector(sel) {
      const match = sel.match(/^\[data-testid="(.+)"\]$/);
      const testId = match?.[1];
      const walk = (node: FakeEl): FakeEl | null => {
        if (testId && node.attrs["data-testid"] === testId) return node;
        if (sel.startsWith("#") && node.id === sel.slice(1)) return node;
        for (const c of node.children) {
          const found = walk(c);
          if (found) return found;
        }
        return null;
      };
      return walk(this);
    },
    addEventListener(type, fn) {
      if (type === "click") this.clicks.push(fn);
    },
  };
  if (tag === "canvas") {
    el.getBoundingClientRect = () => ({
      left: 10,
      top: 20,
      width: GAME.width,
      height: GAME.height,
    });
  }
  return el;
}

function installDom(opts?: { canvas?: boolean }) {
  const body = createEl("body");
  const byId = new Map<string, FakeEl>();
  const document = {
    body,
    getElementById: (id: string) => byId.get(id) ?? null,
    createElement: (tag: string) => {
      const el = createEl(tag);
      const origSet = el.setAttribute.bind(el);
      el.setAttribute = (name: string, value: string) => {
        origSet(name, value);
        if (name === "id") byId.set(value, el);
      };
      const origAppend = el.appendChild.bind(el);
      el.appendChild = (child: FakeEl) => {
        origAppend(child);
        if (child.id) byId.set(child.id, child);
        return child;
      };
      return el;
    },
    querySelector: (sel: string) => {
      if (sel === "#game canvas") return canvas;
      return body.querySelector(sel);
    },
  };
  const origBodyAppend = body.appendChild.bind(body);
  body.appendChild = (child: FakeEl) => {
    origBodyAppend(child);
    if (child.id) byId.set(child.id, child);
    return child;
  };
  const gameRoot = createEl("div");
  gameRoot.id = "game";
  let canvas: FakeEl | null = null;
  if (opts?.canvas !== false) {
    canvas = createEl("canvas");
    gameRoot.appendChild(canvas);
  }
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", { location: { href: "http://localhost/?e2e=1" } });
  return { document, body, byId, canvas };
}

describe("installE2EDom", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("does nothing when e2e is disabled or document is missing", () => {
    vi.stubEnv("VITE_E2E", "false");
    vi.stubGlobal("document", undefined);
    ensureDomTestActions({} as DefenseGameE2EApi);
    positionDomMirrors({ "start-night": { x: 1, y: 2 } });
  });

  it("creates mirror buttons and routes clicks to the api", () => {
    vi.stubEnv("VITE_E2E", "true");
    const { document, byId } = installDom();
    const api = {
      startNight: vi.fn(),
      tapDomMirror: vi.fn(),
    } as unknown as DefenseGameE2EApi;
    ensureDomTestActions(api);
    const host = document.getElementById("defensegame-e2e-dom");
    expect(host).toBeTruthy();
    expect(host?.attrs["data-testid"]).toBe("e2e-dom-root");
    const start = host?.querySelector('[data-testid="start-night"]');
    const atk = host?.querySelector('[data-testid="combat-atk"]');
    expect(start?.textContent).toBe("start-night");
    expect(atk?.type).toBe("button");
    start?.clicks[0]?.();
    atk?.clicks[0]?.();
    expect(
      (api as unknown as { startNight: ReturnType<typeof vi.fn> }).startNight,
    ).toHaveBeenCalledOnce();
    expect(
      (api as unknown as { tapDomMirror: ReturnType<typeof vi.fn> })
        .tapDomMirror,
    ).toHaveBeenCalledWith("combat-atk");

    // Re-running reuses the existing host and buttons.
    ensureDomTestActions(api);
    expect(byId.size).toBe(1);
    expect(host?.children.length).toBeGreaterThan(8);
  });

  it("positions visible mirrors and hides unused combat buttons", () => {
    vi.stubEnv("VITE_E2E", "true");
    const { document, canvas } = installDom();
    const api = {
      startNight: vi.fn(),
      tapDomMirror: vi.fn(),
    } as unknown as DefenseGameE2EApi;
    ensureDomTestActions(api);
    positionDomMirrors({
      "start-night": { x: 100, y: 50 },
      "combat-atk": { x: 200, y: 300 },
    });
    const host = document.getElementById("defensegame-e2e-dom")!;
    const start = host.querySelector('[data-testid="start-night"]')!;
    const atk = host.querySelector('[data-testid="combat-atk"]')!;
    const mode = host.querySelector('[data-testid="combat-mode"]')!;
    expect(start.style.left).toBe("88px"); // 10 + 100 - 22
    expect(start.style.top).toBe("48px"); // 20 + 50 - 22
    expect(start.style.display).toBe("block");
    expect(atk.style.display).toBe("block");
    expect(mode.style.display).toBe("none");

    // No canvas: positioning is skipped.
    if (canvas) canvas.id = "not-canvas";
    vi.stubGlobal("document", {
      ...document,
      querySelector: () => null,
      getElementById: document.getElementById,
    });
    positionDomMirrors({ "combat-atk": { x: 1, y: 1 } });
  });

  it("returns early when the host node is missing", () => {
    vi.stubEnv("VITE_E2E", "true");
    vi.stubGlobal("document", {
      getElementById: () => null,
    });
    vi.stubGlobal("window", { location: { href: "http://localhost/?e2e=1" } });
    positionDomMirrors({ "start-night": { x: 1, y: 2 } });
  });

  it("skips target ids that have no mirrored button", () => {
    vi.stubEnv("VITE_E2E", "true");
    installDom();
    const api = {
      startNight: vi.fn(),
      tapDomMirror: vi.fn(),
    } as unknown as DefenseGameE2EApi;
    ensureDomTestActions(api);
    expect(() =>
      positionDomMirrors({ "not-a-mirror-id": { x: 1, y: 2 } }),
    ).not.toThrow();
  });
});
