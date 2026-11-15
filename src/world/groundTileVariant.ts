/** Deterministic per-cell ground texture index (stable across reloads for a given seed). */
export function groundTileVariantIndex(
  tx: number,
  ty: number,
  seed: number,
  variantCount: number,
): number {
  if (variantCount <= 1) return 0;
  let h = seed ^ Math.imul(tx, 374761393) ^ Math.imul(ty, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h >>> 0) % variantCount;
}