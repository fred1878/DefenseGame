import { isNativeApp } from "../appUpdate/isNativeApp";
import { isE2EEnabled } from "../e2e/e2eMode";

export function shouldRegisterServiceWorker(options: {
  prod: boolean;
  e2e: boolean;
  native?: boolean;
}): boolean {
  return options.prod && !options.e2e && options.native !== true;
}

/** Service worker URL under the Vite/Pages base path. */
export function serviceWorkerScriptUrl(baseUrl: string): string {
  const prefix = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${prefix}sw.js`;
}

export type ServiceWorkerRegistrationLike = {
  update?: () => Promise<unknown>;
};

export type ServiceWorkerContainerLike = {
  register: (scriptUrl: string) => Promise<ServiceWorkerRegistrationLike>;
};

export async function registerServiceWorkerWith(options: {
  enabled: boolean;
  scriptUrl: string;
  serviceWorker?: ServiceWorkerContainerLike | undefined;
}): Promise<"registered" | "skipped"> {
  if (!options.enabled || !options.serviceWorker) return "skipped";
  try {
    const registration = await options.serviceWorker.register(
      options.scriptUrl,
    );
    await registration.update?.();
    return "registered";
  } catch {
    // Offline first visit, unsupported context, or missing script — play anyway.
    return "skipped";
  }
}

/**
 * Register the production service worker, except in dev and e2e.
 * A waiting worker with skipWaiting activates on the next load; this
 * function does not claim open clients mid-session.
 */
export async function registerServiceWorker(): Promise<
  "registered" | "skipped"
> {
  const enabled = shouldRegisterServiceWorker({
    prod: import.meta.env.PROD,
    e2e: import.meta.env.VITE_E2E === "true" || isE2EEnabled(),
    native: isNativeApp(),
  });
  const serviceWorker =
    typeof navigator === "undefined" ? undefined : navigator.serviceWorker;
  return registerServiceWorkerWith({
    enabled,
    scriptUrl: serviceWorkerScriptUrl(import.meta.env.BASE_URL),
    serviceWorker,
  });
}
