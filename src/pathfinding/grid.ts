import {
  defenseHalfHeight,
  defenseHalfWidth,
  type DefenseObstacleRect,
} from "../config";

export type NavGrid = {
  cellSize: number;
  cols: number;
  rows: number;
  minX: number;
  minY: number;
  blocked: Uint8Array;
  /** Inflate static obstacles + peer-agent exclusion radius (world px). */
  clearancePx: number;
};

function cellIndex(grid: NavGrid, col: number, row: number): number {
  return row * grid.cols + col;
}

export function buildNavGrid(
  obstacles: DefenseObstacleRect[],
  cellSize = 40,
  clearancePx = 0,
): NavGrid {
  const halfW = defenseHalfWidth();
  const halfH = defenseHalfHeight();
  const minX = -halfW;
  const minY = -halfH;
  const cols = Math.ceil((halfW * 2) / cellSize);
  const rows = Math.ceil((halfH * 2) / cellSize);
  const blocked = new Uint8Array(cols * rows);

  for (const obs of obstacles) {
    const left = obs.x - obs.w / 2 - clearancePx;
    const right = obs.x + obs.w / 2 + clearancePx;
    const top = obs.y - obs.h / 2 - clearancePx;
    const bottom = obs.y + obs.h / 2 + clearancePx;
    const c0 = Math.max(0, Math.floor((left - minX) / cellSize));
    const c1 = Math.min(cols - 1, Math.floor((right - minX) / cellSize));
    const r0 = Math.max(0, Math.floor((top - minY) / cellSize));
    const r1 = Math.min(rows - 1, Math.floor((bottom - minY) / cellSize));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        blocked[cellIndex(
          { cellSize, cols, rows, minX, minY, blocked, clearancePx },
          c,
          r,
        )] = 1;
      }
    }
  }

  return { cellSize, cols, rows, minX, minY, blocked, clearancePx };
}

export function worldToCell(
  grid: NavGrid,
  x: number,
  y: number,
): { col: number; row: number } | null {
  const col = Math.floor((x - grid.minX) / grid.cellSize);
  const row = Math.floor((y - grid.minY) / grid.cellSize);
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return null;
  return { col, row };
}

export function cellToWorldCenter(grid: NavGrid, col: number, row: number): { x: number; y: number } {
  return {
    x: grid.minX + (col + 0.5) * grid.cellSize,
    y: grid.minY + (row + 0.5) * grid.cellSize,
  };
}

export function cellBlocked(
  grid: NavGrid,
  col: number,
  row: number,
  peerAgents?: readonly { x: number; y: number }[],
  agentClearancePx?: number,
): boolean {
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return true;
  if (grid.blocked[cellIndex(grid, col, row)] === 1) return true;
  const peerR = agentClearancePx ?? grid.clearancePx;
  if (peerAgents && peerAgents.length > 0 && peerR > 0) {
    const { x, y } = cellToWorldCenter(grid, col, row);
    for (const p of peerAgents) {
      if ((x - p.x) ** 2 + (y - p.y) ** 2 < peerR * peerR) return true;
    }
  }
  return false;
}

export function nearestWalkable(
  grid: NavGrid,
  col: number,
  row: number,
  peerAgents?: readonly { x: number; y: number }[],
  agentClearancePx?: number,
): { col: number; row: number } {
  if (!cellBlocked(grid, col, row, peerAgents, agentClearancePx)) {
    return { col, row };
  }
  const maxR = Math.max(grid.cols, grid.rows);
  for (let radius = 1; radius <= maxR; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.abs(dc) !== radius && Math.abs(dr) !== radius) continue;
        const c = col + dc;
        const r = row + dr;
        if (!cellBlocked(grid, c, r, peerAgents, agentClearancePx)) {
          return { col: c, row: r };
        }
      }
    }
  }
  return { col, row };
}