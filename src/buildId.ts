export function getEmbeddedBuildId(): string {
  return import.meta.env.VITE_BUILD_ID ?? "local";
}

/** HUD one-liner: first 8 chars of the embedded build id. */
export function shortBuildIdLabel(id: string): string {
  return id.length <= 8 ? id : id.slice(0, 8);
}

/** One HUD line when `?b=` is set; `null` if absent. */
export function urlBuildParamLine(
  embedded: string,
  urlB: string | null,
): string | null {
  if (!urlB) return null;
  const ok = urlB === embedded;
  return `URL b=${urlB} · ${ok ? "match" : "mismatch"}`;
}