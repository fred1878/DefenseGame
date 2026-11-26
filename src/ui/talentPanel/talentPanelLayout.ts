import type { TalentCatalog } from "../../talents/talentTypes";

/**
 * Talent screen geometry in game pixels (540×1200 portrait, the same frame as
 * the Figma mockup). Pure so it can be unit tested.
 */
export const TALENT_LAYOUT = {
  pad: 16,
  headerY: 20,
  headerH: 84,
  pointsY: 116,
  pointsH: 36,
  treeY: 164,
  treePad: 14,
  gutterW: 30,
  cellW: 146,
  cellGap: 4,
  branchHeadH: 52,
  rowsTop: 242,
  rowH: 112,
  linkH: 22,
  orbR: 28,
  /** Max centre-to-centre spacing for nodes sharing a tier cell (pick-one tiers). */
  pairSpacing: 76,
  detailGap: 12,
  detailH: 172,
  actionH: 56,
  bottomPad: 28,
} as const;

export type NodeSlot = {
  id: string;
  branchIndex: number;
  tierIndex: number;
  x: number;
  /** Orb centre. */
  y: number;
};

export type Connector = {
  parentId: string;
  childId: string;
  /** Elbow polyline: down from the parent, across, down into the child orb. */
  points: Array<{ x: number; y: number }>;
};

export type TalentTreeLayout = {
  width: number;
  height: number;
  treeBottom: number;
  detailY: number;
  actionY: number;
  branchCenters: number[];
  tierRowTops: number[];
  nodes: NodeSlot[];
  connectors: Connector[];
};

export function branchCenterX(index: number, width: number): number {
  const L = TALENT_LAYOUT;
  const left = L.pad + L.treePad + L.gutterW + L.cellGap;
  const inner = width - left - L.pad - L.treePad;
  const cellW = (inner - L.cellGap * 2) / 3;
  return left + index * (cellW + L.cellGap) + cellW / 2;
}

/** Offsets of `count` nodes inside one cell, centred, spaced so orbs never touch. */
export function nodeOffsets(count: number): number[] {
  const L = TALENT_LAYOUT;
  const room = (L.cellW - 2 * L.orbR) / Math.max(1, count - 1);
  const spacing = Math.min(L.pairSpacing, room);
  return Array.from(
    { length: count },
    (_, i) => (i - (count - 1) / 2) * spacing,
  );
}

export function layoutTalentTree(
  catalog: TalentCatalog,
  width: number,
  height: number,
): TalentTreeLayout {
  const L = TALENT_LAYOUT;
  const tiers = Math.max(0, ...catalog.branches.map((b) => b.tiers.length));
  const tierRowTops = Array.from(
    { length: tiers },
    (_, t) => L.rowsTop + t * (L.rowH + L.linkH),
  );
  const branchCenters = catalog.branches.map((_, i) => branchCenterX(i, width));
  const nodes: NodeSlot[] = [];
  catalog.branches.forEach((branch, bi) => {
    branch.tiers.forEach((tier, ti) => {
      const offsets = nodeOffsets(tier.nodes.length);
      tier.nodes.forEach((node, ni) => {
        nodes.push({
          id: node.id,
          branchIndex: bi,
          tierIndex: ti,
          x: branchCenters[bi]! + offsets[ni]!,
          y: tierRowTops[ti]! + 4 + L.orbR,
        });
      });
    });
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const connectors: Connector[] = [];
  for (const branch of catalog.branches) {
    branch.tiers.forEach((tier, ti) => {
      if (ti === 0) return;
      const prev = branch.tiers[ti - 1]!;
      for (const node of tier.nodes) {
        const parents = node.requires.length
          ? node.requires
          : prev.nodes.map((n) => n.id);
        for (const parentId of parents) {
          const p = byId.get(parentId);
          const c = byId.get(node.id)!;
          if (!p || p.tierIndex !== ti - 1) continue;
          const top = tierRowTops[ti]!;
          const from = tierRowTops[ti - 1]! + L.rowH;
          const mid = from + Math.round(L.linkH / 2);
          connectors.push({
            parentId,
            childId: node.id,
            points: [
              { x: p.x, y: from },
              { x: p.x, y: mid },
              { x: c.x, y: mid },
              { x: c.x, y: top + 4 },
            ],
          });
        }
      }
    });
  }
  const treeBottom = (tierRowTops.at(-1) ?? L.rowsTop) + L.rowH + L.treePad - 6;
  const actionY = height - L.bottomPad - L.actionH / 2;
  return {
    width,
    height,
    treeBottom,
    detailY: treeBottom + L.detailGap,
    actionY,
    branchCenters,
    tierRowTops,
    nodes,
    connectors,
  };
}
