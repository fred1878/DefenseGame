/** Minimal Capacitor global injected into the native WebView. */
export type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
};

export function readGlobalCapacitor(
  globalObject: object = globalThis,
): CapacitorGlobal | undefined {
  return (globalObject as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True when running inside the Capacitor Android (or iOS) shell. */
export function isNativeApp(
  cap: CapacitorGlobal | undefined = readGlobalCapacitor(),
): boolean {
  return cap?.isNativePlatform?.() === true;
}
