/**
 * Setup for the `scenes` Vitest project (real Phaser, jsdom + node-canvas).
 * Each file runs isolated, so module state never leaks between scene tests.
 */
import { GlobalFonts } from "@napi-rs/canvas";
import { afterEach, vi } from "vitest";

afterEach(() => {
  localStorage.clear();
});

/**
 * jsdom has no FontFace. Phaser's FontFile loader (Pixelify Sans etc.) uses
 * it, so register the real font bytes with @napi-rs/canvas, which is what
 * jsdom's canvas draws text with.
 */
class NodeFontFace {
  status: "unloaded" | "loaded" | "error" = "unloaded";
  constructor(
    readonly family: string,
    private readonly source: string,
  ) {}
  async load(): Promise<this> {
    const url = /url\(["']?([^"')]+)["']?\)/.exec(this.source)?.[1];
    if (!url) throw new Error(`FontFace: no url in ${this.source}`);
    const res = await fetch(new URL(url, document.baseURI));
    if (!res.ok) {
      this.status = "error";
      throw new Error(`FontFace: ${res.status} for ${url}`);
    }
    GlobalFonts.register(Buffer.from(await res.arrayBuffer()), this.family);
    this.status = "loaded";
    return this;
  }
}
vi.stubGlobal("FontFace", NodeFontFace);
if (!("fonts" in document)) {
  const loaded = new Set<unknown>();
  Object.defineProperty(document, "fonts", {
    value: {
      add: (f: unknown) => loaded.add(f),
      check: () => true,
      ready: Promise.resolve(),
    },
  });
}
