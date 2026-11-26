import {
  DAMAGE_NUMBERS,
  type DamageNumberKind,
  type DamageNumberMotion,
  type DamageNumbersConfig,
} from "../config/damageNumbers";

/** Spell ids that should present as lightning even if data flavor lags. */
export const LIGHTNING_SPELL_IDS = new Set([
  "lightning_bolt",
  "chain_lightning",
]);

export type DamageNumberSource = {
  flavor?: string;
  spellId?: string;
  heal?: boolean;
};

/** Map a combat event onto a presentation kind. */
export function damageNumberKindFromSource(
  source: DamageNumberSource,
): DamageNumberKind {
  if (source.heal) return "heal";
  if (source.spellId && LIGHTNING_SPELL_IDS.has(source.spellId)) {
    return "lightning";
  }
  switch (source.flavor) {
    case "fire":
      return "fire";
    case "frost":
      return "frost";
    case "lightning":
      return "lightning";
    case "water":
      return "water";
    case "poison":
    case "plague":
      return "poison";
    default:
      return "physical";
  }
}

/** Round for display; never show a 0 for a positive hit. */
export function displayDamageAmount(amount: number): number {
  const rounded = Math.round(amount);
  if (rounded !== 0) return rounded;
  if (amount > 0) return 1;
  if (amount < 0) return -1;
  return 0;
}

export function formatDamageNumberText(
  amount: number,
  kind: DamageNumberKind,
  cfg: DamageNumbersConfig = DAMAGE_NUMBERS,
): string {
  const prefix = cfg.styles[kind].prefix ?? "";
  return `${prefix}${displayDamageAmount(amount)}`;
}

export type DamageNumberQuery = {
  /** Raw `dmgNum` search param, if present. */
  dmgNum?: string | null;
  e2e?: boolean;
};

/**
 * Feature gate. No in-game settings menu exists, so this honors the config
 * flag, an optional `?dmgNum=0|1` override, and defaults off under e2e so
 * visual screenshot baselines stay stable.
 */
export function areDamageNumbersEnabled(
  query: DamageNumberQuery = {},
  cfg: DamageNumbersConfig = DAMAGE_NUMBERS,
): boolean {
  const raw = query.dmgNum;
  if (raw === "0" || raw === "false") return false;
  if (raw === "1" || raw === "true") return true;
  if (!cfg.enabled) return false;
  if (query.e2e) return false;
  return true;
}

export function damageNumberQueryFromLocation(
  href: string | undefined,
): DamageNumberQuery {
  if (!href) return {};
  try {
    const url = new URL(href);
    const dmgNum = url.searchParams.get("dmgNum");
    const e2e = url.searchParams.get("e2e") === "1";
    return dmgNum === null ? { e2e } : { dmgNum, e2e };
  } catch {
    return {};
  }
}

export type ActiveDamageNumber = {
  id: number;
  targetId: string;
  kind: DamageNumberKind;
  isCrit: boolean;
  amount: number;
  startX: number;
  startY: number;
  spawnedAtMs: number;
  lastHitAtMs: number;
  seed: number;
};

export type DamageNumberState = {
  nextId: number;
  active: ActiveDamageNumber[];
};

export function createDamageNumberState(): DamageNumberState {
  return { nextId: 1, active: [] };
}

export type DamageNumberSpawnRequest = {
  targetId: string;
  x: number;
  y: number;
  amount: number;
  kind: DamageNumberKind;
  isCrit?: boolean;
};

export type DamageNumberSpawnResult = {
  state: DamageNumberState;
  action: "spawn" | "aggregate" | "ignored";
  id: number;
  evictedIds: number[];
};

function copyState(state: DamageNumberState): DamageNumberState {
  return {
    nextId: state.nextId,
    active: state.active.map((entry) => ({ ...entry })),
  };
}

/** Merge key: same target and kind, crits stay separate so they stay bigger. */
export function aggregationKey(
  targetId: string,
  kind: DamageNumberKind,
  isCrit: boolean,
): string {
  return `${targetId}|${kind}|${isCrit ? "c" : "n"}`;
}

function findAggregate(
  state: DamageNumberState,
  req: DamageNumberSpawnRequest,
  nowMs: number,
  windowMs: number,
): ActiveDamageNumber | undefined {
  const isCrit = req.isCrit === true;
  const key = aggregationKey(req.targetId, req.kind, isCrit);
  let latest: ActiveDamageNumber | undefined;
  for (const entry of state.active) {
    if (aggregationKey(entry.targetId, entry.kind, entry.isCrit) !== key) {
      continue;
    }
    if (nowMs - entry.lastHitAtMs > windowMs) continue;
    if (!latest || entry.lastHitAtMs > latest.lastHitAtMs) latest = entry;
  }
  return latest;
}

function evictForCap(
  active: ActiveDamageNumber[],
  maxActive: number,
): { kept: ActiveDamageNumber[]; evictedIds: number[] } {
  if (active.length <= maxActive) return { kept: active, evictedIds: [] };
  const ranked = active.slice().sort((a, b) => a.spawnedAtMs - b.spawnedAtMs);
  const overflow = active.length - maxActive;
  const evictedIds = ranked.slice(0, overflow).map((e) => e.id);
  const evictSet = new Set(evictedIds);
  return {
    kept: active.filter((e) => !evictSet.has(e.id)),
    evictedIds,
  };
}

/**
 * Spawn a new floater or fold the hit into a recent one on the same target.
 * When the cap is exceeded, the oldest (earliest spawn) entries are evicted.
 */
export function spawnOrAggregateDamageNumber(
  state: DamageNumberState,
  req: DamageNumberSpawnRequest,
  nowMs: number,
  cfg: DamageNumbersConfig = DAMAGE_NUMBERS,
): DamageNumberSpawnResult {
  if (req.amount <= 0) {
    return { state, action: "ignored", id: 0, evictedIds: [] };
  }
  const next = copyState(state);
  const isCrit = req.isCrit === true;
  const existing = findAggregate(next, req, nowMs, cfg.aggregateWindowMs);
  if (existing) {
    existing.amount += req.amount;
    existing.lastHitAtMs = nowMs;
    existing.spawnedAtMs = nowMs;
    existing.startX = req.x;
    existing.startY = req.y;
    if (isCrit) existing.isCrit = true;
    return {
      state: next,
      action: "aggregate",
      id: existing.id,
      evictedIds: [],
    };
  }
  const id = next.nextId;
  next.nextId += 1;
  next.active.push({
    id,
    targetId: req.targetId,
    kind: req.kind,
    isCrit,
    amount: req.amount,
    startX: req.x,
    startY: req.y,
    spawnedAtMs: nowMs,
    lastHitAtMs: nowMs,
    seed: id * 17 + Math.floor(nowMs) * 13,
  });
  const capped = evictForCap(next.active, cfg.maxActive);
  next.active = capped.kept;
  return {
    state: next,
    action: "spawn",
    id,
    evictedIds: capped.evictedIds,
  };
}

export function expireDamageNumbers(
  state: DamageNumberState,
  nowMs: number,
  cfg: DamageNumbersConfig = DAMAGE_NUMBERS,
): { state: DamageNumberState; expiredIds: number[] } {
  const expiredIds: number[] = [];
  const active: ActiveDamageNumber[] = [];
  for (const entry of state.active) {
    const duration = cfg.styles[entry.kind].motion.durationMs;
    if (nowMs - entry.spawnedAtMs >= duration) expiredIds.push(entry.id);
    else active.push(entry);
  }
  return { state: { nextId: state.nextId, active }, expiredIds };
}

export type DamageNumberPose = {
  x: number;
  y: number;
  alpha: number;
  scale: number;
};

function hashedUnit(seed: number, bucket: number): number {
  const x = Math.sin(seed * 12.9898 + bucket * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function popScaleAt(
  elapsed: number,
  motion: DamageNumberMotion,
  isCrit: boolean,
): number {
  const peak = isCrit ? motion.critPopScale : motion.popScale;
  if (motion.popMs <= 0) return 1;
  const t = Math.min(1, Math.max(0, elapsed / motion.popMs));
  // Ease out: start at `peak`, settle to 1.
  const eased = 1 - (1 - t) * (1 - t);
  return peak + (1 - peak) * eased;
}

function alphaAt(t: number, motion: DamageNumberMotion): number {
  if (t <= motion.fadeStartT) return 1;
  if (motion.fadeStartT >= 1) return 1;
  const fadeT = (t - motion.fadeStartT) / (1 - motion.fadeStartT);
  return Math.max(0, 1 - fadeT);
}

/** World-space pose for one live floater at `nowMs`. */
export function damageNumberPose(
  entry: ActiveDamageNumber,
  nowMs: number,
  cfg: DamageNumbersConfig = DAMAGE_NUMBERS,
): DamageNumberPose {
  const motion = cfg.styles[entry.kind].motion;
  const elapsed = Math.max(0, nowMs - entry.spawnedAtMs);
  const t =
    motion.durationMs <= 0 ? 1 : Math.min(1, elapsed / motion.durationMs);
  const rise = t * (2 - t); // ease-out quad
  let x = entry.startX + motion.driftX * rise;
  let y = entry.startY + motion.driftY * rise;
  if (motion.waveAmp && motion.waveHz) {
    x +=
      motion.waveAmp * Math.sin((elapsed / 1000) * motion.waveHz * Math.PI * 2);
  }
  if (motion.jitterPx) {
    const bucket = Math.floor(elapsed / 16);
    x += (hashedUnit(entry.seed, bucket) * 2 - 1) * motion.jitterPx;
    y += (hashedUnit(entry.seed, bucket + 51) * 2 - 1) * motion.jitterPx * 0.6;
  }
  let alpha = alphaAt(t, motion);
  if (motion.flickerHz) {
    const flicker =
      0.82 + 0.18 * Math.sin((elapsed / 1000) * motion.flickerHz * Math.PI * 2);
    alpha *= flicker;
  }
  return {
    x,
    y,
    alpha,
    scale: popScaleAt(elapsed, motion, entry.isCrit),
  };
}

export function styleForKind(
  kind: DamageNumberKind,
  cfg: DamageNumbersConfig = DAMAGE_NUMBERS,
): DamageNumbersConfig["styles"][DamageNumberKind] {
  return cfg.styles[kind];
}
