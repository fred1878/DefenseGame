/** Deterministic hash for sparse ground decor placement. */
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

export function groundDecorShouldPlace(
  tx: number,
  ty: number,
  seed: number,
): boolean {
  let h = seed ^ Math.imul(tx, 2246822519) ^ Math.imul(ty, 3266489917);
  h = Math.imul(h ^ (h >>> 16), 668265263);
  return (h >>> 0) % 100 < 9;
}

export function groundDecorJitter(
  tx: number,
  ty: number,
  seed: number,
  span: number,
): number {
  const v = groundTileVariantIndex(tx, ty, seed ^ 0x9e3779b9, 997);
  return ((v % span) - span / 2) | 0;
}
