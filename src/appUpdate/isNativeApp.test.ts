import { describe, expect, it } from "vitest";
import { isNativeApp, readGlobalCapacitor } from "./isNativeApp";

describe("isNativeApp", () => {
  it("is false when Capacitor is missing", () => {
    expect(isNativeApp(undefined)).toBe(false);
    expect(isNativeApp({})).toBe(false);
  });

  it("is true only when isNativePlatform returns true", () => {
    expect(isNativeApp({ isNativePlatform: () => false })).toBe(false);
    expect(isNativeApp({ isNativePlatform: () => true })).toBe(true);
  });

  it("reads the global Capacitor object when one is present", () => {
    const cap = { isNativePlatform: () => true };
    expect(readGlobalCapacitor({ Capacitor: cap })).toBe(cap);
    expect(readGlobalCapacitor({})).toBeUndefined();
  });
});
