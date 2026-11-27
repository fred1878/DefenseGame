import { afterEach, describe, expect, it, vi } from "vitest";
import { rerenderTextsWhenFontReady } from "./uiTextStyle";

type FakeText = {
  active: boolean;
  scene: object | null;
  style: { update: ReturnType<typeof vi.fn> };
};

function fakeText(alive = true): FakeText {
  return {
    active: alive,
    scene: alive ? {} : null,
    style: { update: vi.fn() },
  };
}

function stubFonts(fonts: unknown): void {
  vi.stubGlobal("document", { fonts });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("rerenderTextsWhenFontReady", () => {
  it("re-renders live texts and calls onReady once the font loads", async () => {
    const load = vi.fn(() => Promise.resolve([]));
    stubFonts({ load, check: () => false });
    const live = fakeText();
    const dead = fakeText(false);
    const onReady = vi.fn();
    rerenderTextsWhenFontReady(
      '700 16px "Pixelify Sans"',
      () => [live, dead] as never,
      onReady,
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(load).toHaveBeenCalledWith('700 16px "Pixelify Sans"');
    expect(live.style.update).toHaveBeenCalledWith(true);
    expect(dead.style.update).not.toHaveBeenCalled();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("skips onReady when every text is gone", async () => {
    stubFonts({ load: () => Promise.resolve([]), check: () => false });
    const onReady = vi.fn();
    rerenderTextsWhenFontReady(
      "16px X",
      () => [fakeText(false)] as never,
      onReady,
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(onReady).not.toHaveBeenCalled();
  });

  it("does nothing when the font is already available", () => {
    const load = vi.fn();
    stubFonts({ load, check: () => true });
    rerenderTextsWhenFontReady("16px X", () => []);
    expect(load).not.toHaveBeenCalled();
  });

  it("swallows font load failures", async () => {
    stubFonts({
      load: () => Promise.reject(new Error("nope")),
      check: () => false,
    });
    const t = fakeText();
    rerenderTextsWhenFontReady("16px X", () => [t] as never);
    await new Promise((r) => setTimeout(r, 0));
    expect(t.style.update).not.toHaveBeenCalled();
  });

  it("is a no-op without document.fonts", () => {
    stubFonts(undefined);
    expect(() => rerenderTextsWhenFontReady("16px X", () => [])).not.toThrow();
  });
});

describe("installDefaultUiFont", () => {
  it("defaults add.text to the pixel UI stack, keeping explicit families", async () => {
    const { installDefaultUiFont, UI_FONT_FAMILY } = await import(
      "./uiTextStyle"
    );
    const seen: unknown[] = [];
    const proto = {
      text(_x: number, _y: number, _t: string, style?: unknown) {
        seen.push(style);
        return null as never;
      },
    };
    installDefaultUiFont(proto);
    installDefaultUiFont(proto);
    installDefaultUiFont(undefined);
    proto.text(0, 0, "a");
    proto.text(0, 0, "b", { fontFamily: "serif" } as never);
    expect(seen[0]).toEqual({ fontFamily: UI_FONT_FAMILY });
    expect(seen[1]).toEqual({ fontFamily: "serif" });
  });
});
