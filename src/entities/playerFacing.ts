import type { PlayerCardinal } from "../config/assets";

export function cardinalFromDelta(dx: number, dy: number): PlayerCardinal | null {
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "e" : "w";
  }
  return dy >= 0 ? "s" : "n";
}

export function cardinalFromAngle(radians: number): PlayerCardinal {
  const deg = (radians * 180) / Math.PI;
  if (deg >= -45 && deg < 45) return "e";
  if (deg >= 45 && deg < 135) return "s";
  if (deg >= -135 && deg < -45) return "n";
  return "w";
}