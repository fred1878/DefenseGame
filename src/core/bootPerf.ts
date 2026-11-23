export function markBoot(name: string): void {
  if (typeof performance === "undefined" || typeof performance.mark !== "function") {
    return;
  }
  performance.mark(name);
}

export function measureBoot(name: string, start: string, end: string): void {
  if (typeof performance === "undefined" || typeof performance.measure !== "function") {
    return;
  }
  try {
    performance.measure(name, start, end);
  } catch {
    /* marks missing in tests */
  }
}