export function getEmbeddedBuildId(): string {
  return import.meta.env.VITE_BUILD_ID ?? "local";
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