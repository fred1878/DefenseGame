import { isE2EEnabled } from "./e2e/e2eMode";

/**
 * On GitHub Pages, `index.html` can stick in browser cache while hashed JS changes.
 * Compare embedded build id with live version.json and reload once if stale.
 */
export async function ensureFreshBuild(): Promise<void> {
  if (!import.meta.env.PROD) return;
  if (isE2EEnabled()) return;

  const embedded = import.meta.env.VITE_BUILD_ID ?? "unknown";
  const base = import.meta.env.BASE_URL;

  try {
    const res = await fetch(`${base}version.json?cb=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return;

    const data = (await res.json()) as { buildId?: string };
    if (!data.buildId || data.buildId === embedded) return;

    const url = new URL(window.location.href);
    if (url.searchParams.get("b") === data.buildId) return;

    url.searchParams.set("b", data.buildId);
    if (import.meta.env.VITE_E2E === "true") {
      url.searchParams.set("e2e", "1");
    }
    window.location.replace(url.toString());
  } catch {
    // Offline or first visit — play with the loaded bundle.
  }
}