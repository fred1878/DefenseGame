import {
  cellBlocked,
  cellToWorldCenter,
  type NavGrid,
  nearestWalkable,
  worldToCell,
} from "./grid";

export type PathPoint = { x: number; y: number };

const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

function heuristic(col: number, row: number, gc: number, gr: number): number {
  return Math.abs(col - gc) + Math.abs(row - gr);
}

export function findPath(
  grid: NavGrid,
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
  peerAgents?: readonly { x: number; y: number }[],
): PathPoint[] {
  const startCell = worldToCell(grid, startX, startY);
  const goalCell = worldToCell(grid, goalX, goalY);
  if (!startCell || !goalCell) return [];

  const start = nearestWalkable(grid, startCell.col, startCell.row, peerAgents);
  const goal = nearestWalkable(grid, goalCell.col, goalCell.row, peerAgents);

  const total = grid.cols * grid.rows;
  const gScore = new Float32Array(total);
  gScore.fill(Infinity);
  const fScore = new Float32Array(total);
  fScore.fill(Infinity);
  const cameFrom = new Int32Array(total);
  cameFrom.fill(-1);

  const startIdx = start.row * grid.cols + start.col;
  const goalIdx = goal.row * grid.cols + goal.col;
  gScore[startIdx] = 0;
  fScore[startIdx] = heuristic(start.col, start.row, goal.col, goal.row);

  const open: number[] = [startIdx];

  const idxToCR = (idx: number) => ({
    col: idx % grid.cols,
    row: Math.floor(idx / grid.cols),
  });

  while (open.length > 0) {
    open.sort((a, b) => (fScore[a] ?? Infinity) - (fScore[b] ?? Infinity));
    const current = open.shift();
    if (current === undefined) break;
    if (current === goalIdx) {
      const cells: { col: number; row: number }[] = [];
      let idx: number | -1 = current;
      while (idx !== -1) {
        const { col, row } = idxToCR(idx);
        cells.push({ col, row });
        idx = cameFrom[idx] as number | -1;
      }
      cells.reverse();
      return cells.map((c) => cellToWorldCenter(grid, c.col, c.row));
    }

    const { col, row } = idxToCR(current);
    for (const [dc, dr] of NEIGHBORS) {
      const nc = col + dc;
      const nr = row + dr;
      if (cellBlocked(grid, nc, nr, peerAgents)) continue;
      if (dc !== 0 && dr !== 0) {
        if (cellBlocked(grid, col + dc, row, peerAgents)) continue;
        if (cellBlocked(grid, col, row + dr, peerAgents)) continue;
      }
      const neighbor = nr * grid.cols + nc;
      const stepCost = dc !== 0 && dr !== 0 ? 1.414 : 1;
        const gCur = gScore[current] ?? Infinity;
        const tentative = gCur + stepCost;
        const gNei = gScore[neighbor] ?? Infinity;
        if (tentative < gNei) {
          cameFrom[neighbor] = current;
          gScore[neighbor] = tentative;
        fScore[neighbor] =
          tentative + heuristic(nc, nr, goal.col, goal.row);
        if (!open.includes(neighbor)) open.push(neighbor);
      }
    }
  }

  const goalWorld = cellToWorldCenter(grid, goal.col, goal.row);
  return [goalWorld];
}