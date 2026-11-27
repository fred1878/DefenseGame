import { GAME } from "../config";
import { isE2EEnabled } from "./e2eMode";
import type { DefenseGameE2EApi } from "./e2eGlobal";

/** DOM mirror buttons over canvas tap targets (Playwright `getByTestId` taps). */
const DOM_MIRROR_IDS = [
  "start-night",
  "combat-atk",
  "combat-mode",
  "combat-auto",
  "spell-slot-0",
  "spell-slot-1",
  "spell-slot-2",
  "spell-slot-3",
  "spell-slot-4",
  "spell-slot-5",
  "spell-slot-6",
  "spell-slot-7",
  "defense-return-to-town",
  "defense-leave-endless",
] as const;

function ensureDomMirrorButton(
  host: HTMLElement,
  testId: string,
  onClick: () => void,
): HTMLButtonElement {
  let btn = host.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-testid", testId);
    // No visible label: an aria-label keeps the button identifiable without text that
    // showed through when the unpositioned mirrors stacked at the page's top-left.
    btn.setAttribute("aria-label", testId);
    // Fully transparent (Playwright `force` clicks still work). At opacity 0.01 the
    // ~14 stacked default-styled buttons composited into a faint grey "spell-slot" ghost
    // in every ?e2e=1 capture and visual baseline. Unpositioned mirrors start hidden.
    btn.style.cssText = `position:fixed;left:0;top:0;width:44px;height:44px;opacity:0;background:transparent;border:0;padding:0;color:transparent;font-size:0;pointer-events:auto;z-index:99999;display:${testId === "start-night" ? "block" : "none"}`;
    host.appendChild(btn);
    btn.addEventListener("click", onClick);
  }
  return btn;
}

export function ensureDomTestActions(api: DefenseGameE2EApi): void {
  if (!isE2EEnabled() || typeof document === "undefined") return;
  let host = document.getElementById("defensegame-e2e-dom");
  if (!host) {
    host = document.createElement("div");
    host.id = "defensegame-e2e-dom";
    host.setAttribute("data-testid", "e2e-dom-root");
    host.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:99998";
    document.body.appendChild(host);
  }
  ensureDomMirrorButton(host, "start-night", () => api.startNight());
  for (const id of DOM_MIRROR_IDS) {
    if (id === "start-night") continue;
    ensureDomMirrorButton(host, id, () => api.tapDomMirror(id));
  }
}

function canvasGameToPage(
  gameX: number,
  gameY: number,
): { left: number; top: number } | null {
  const canvas = document.querySelector<HTMLCanvasElement>("#game canvas");
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const sx = rect.width / GAME.width;
  const sy = rect.height / GAME.height;
  return {
    left: rect.left + gameX * sx,
    top: rect.top + gameY * sy,
  };
}

export function positionDomMirrors(
  targets: Record<string, { x: number; y: number }>,
): void {
  if (!isE2EEnabled() || typeof document === "undefined") return;
  const host = document.getElementById("defensegame-e2e-dom");
  if (!host) return;
  for (const [testId, pt] of Object.entries(targets)) {
    const btn = host.querySelector<HTMLButtonElement>(
      `[data-testid="${testId}"]`,
    );
    if (!btn) continue;
    const pagePt = canvasGameToPage(pt.x, pt.y);
    if (!pagePt) continue;
    btn.style.left = `${pagePt.left - 22}px`;
    btn.style.top = `${pagePt.top - 22}px`;
    btn.style.display = "block";
  }
  for (const id of DOM_MIRROR_IDS) {
    if (targets[id]) continue;
    const btn = host.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);
    if (btn && id !== "start-night") btn.style.display = "none";
  }
}
