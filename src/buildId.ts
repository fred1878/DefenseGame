export function getEmbeddedBuildId(): string {
  return import.meta.env.VITE_BUILD_ID ?? "local";
}

/** HUD one-liner: first 8 chars of the embedded build id. */
export function shortBuildIdLabel(id: string): string {
  return id.length <= 8 ? id : id.slice(0, 8);
}

/** Town HUD line: short build id, with match/mismatch when `?b=` is set. */
export function townBuildIdLine(embedded: string, urlB: string | null): string {
  const base = `Build ${shortBuildIdLabel(embedded)}`;
  if (!urlB) return base;
  const ok = urlB === embedded;
  return `${base} · ${ok ? "match" : "mismatch"}`;
}
