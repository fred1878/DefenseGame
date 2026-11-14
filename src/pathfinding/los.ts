import { cellBlocked, worldToCell, type NavGrid } from "./grid";

/** Grid ray — blocked if any crossed cell is an obstacle. */
export function hasLineOfSight(
  grid: NavGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  const steps = Math.ceil(dist / (grid.cellSize * 0.5));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    const cell = worldToCell(grid, x, y);
    if (!cell) return false;
    if (cellBlocked(grid, cell.col, cell.row)) return false;
  }
  return true;
}