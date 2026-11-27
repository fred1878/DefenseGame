#!/usr/bin/env node
/**
 * Architecture gate for `src/` (runtime imports only; `import type` is ignored):
 *
 * 1. Import cycles: strongly connected components of the runtime import graph.
 * 2. Layer rules: folders that must not import other folders (see LAYER_RULES).
 *
 * Known debt lives in `scripts/data/architecture-baseline.json`. The check fails
 * on anything new AND on baseline entries that no longer occur, so the baseline
 * can only shrink (it is empty since refactor phase P1; keep it that way).
 * Refresh it after fixing debt with:
 *
 *   node scripts/check-architecture.mjs --update-baseline
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(repoRoot, "src");
const baselinePath = path.join(
  repoRoot,
  "scripts/data/architecture-baseline.json",
);

/**
 * `from` folder (first path segment under src/, or a root file name without
 * `.ts`) → folders it must not import at runtime. `*` means every folder
 * (`except` exempts importers, `allow` exempts targets of a `*` forbid).
 */
const DOMAIN = [
  "ai",
  "combat",
  "config",
  "content",
  "core",
  "entities",
  "gear",
  "pathfinding",
  "systems",
  "talents",
];
const LAYER_RULES = [
  {
    name: "config-is-constants-only",
    from: ["config"],
    forbid: ["ai", "combat", "core", "entities", "gear", "systems", "talents"],
  },
  {
    name: "core-below-presentation",
    from: ["core"],
    forbid: ["ui", "world", "systems", "scenes", "input", "debug", "e2e"],
  },
  {
    name: "rules-not-ui",
    from: ["gear", "talents", "systems", "pathfinding", "ai"],
    forbid: ["ui", "scenes", "input"],
  },
  {
    name: "no-e2e-in-domain-or-ui",
    from: [...DOMAIN, "ui", "world", "input", "audio", "debug"],
    forbid: ["e2e"],
  },
  { name: "no-debug-in-domain", from: DOMAIN, forbid: ["debug"] },
  {
    // The tuning store sits just above config/: runtime imports of anything
    // else would make every tuning reader depend on it.
    name: "tuning-is-a-store",
    from: ["tuning"],
    forbid: ["*"],
    allow: ["config", "tuning"],
  },
  {
    name: "sim-is-a-leaf",
    from: ["*"],
    except: ["sim"],
    forbid: ["sim"],
  },
  {
    name: "no-test-helpers-in-production",
    from: ["*"],
    except: ["test"],
    forbid: ["test"],
  },
];

function listSourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSourceFiles(full));
    else if (
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".d.ts")
    ) {
      out.push(full);
    }
  }
  return out;
}

function resolveImport(fromFile, spec) {
  if (!spec.startsWith(".")) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const candidate of [base, `${base}.ts`, path.join(base, "index.ts")]) {
    if (
      candidate.startsWith(srcRoot) &&
      candidate.endsWith(".ts") &&
      fs.existsSync(candidate)
    ) {
      return candidate;
    }
  }
  return null;
}

function isTypeOnly(node) {
  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    if (!clause) return false; // side-effect import
    if (clause.isTypeOnly) return true;
    if (clause.name) return false;
    const bindings = clause.namedBindings;
    if (!bindings) return true;
    if (ts.isNamespaceImport(bindings)) return false;
    return (
      bindings.elements.length > 0 &&
      bindings.elements.every((el) => el.isTypeOnly)
    );
  }
  if (ts.isExportDeclaration(node)) {
    if (node.isTypeOnly) return true;
    const clause = node.exportClause;
    if (clause && ts.isNamedExports(clause)) {
      return (
        clause.elements.length > 0 &&
        clause.elements.every((el) => el.isTypeOnly)
      );
    }
  }
  return false;
}

function runtimeImports(file) {
  const text = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false);
  const deps = new Set();
  for (const stmt of sf.statements) {
    if (
      (ts.isImportDeclaration(stmt) || ts.isExportDeclaration(stmt)) &&
      stmt.moduleSpecifier &&
      ts.isStringLiteral(stmt.moduleSpecifier) &&
      !isTypeOnly(stmt)
    ) {
      const target = resolveImport(file, stmt.moduleSpecifier.text);
      if (target) deps.add(target);
    }
  }
  return [...deps];
}

const rel = (f) => path.relative(srcRoot, f).split(path.sep).join("/");
const folderOf = (f) => {
  const parts = rel(f).split("/");
  return parts.length > 1 ? parts[0] : parts[0].replace(/\.ts$/, "");
};

function buildGraph() {
  const graph = new Map();
  for (const file of listSourceFiles(srcRoot)) {
    graph.set(file, runtimeImports(file));
  }
  return graph;
}

/** Tarjan SCC; returns components with more than one file (or a self-import). */
function findCycles(graph) {
  let index = 0;
  const stack = [];
  const onStack = new Set();
  const idx = new Map();
  const low = new Map();
  const comps = [];
  const strong = (v) => {
    idx.set(v, index);
    low.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);
    for (const w of graph.get(v) ?? []) {
      if (!graph.has(w)) continue;
      if (!idx.has(w)) {
        strong(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v), idx.get(w)));
      }
    }
    if (low.get(v) === idx.get(v)) {
      const comp = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      if (comp.length > 1 || (graph.get(v) ?? []).includes(v)) {
        comps.push(comp.map(rel).sort());
      }
    }
  };
  for (const v of graph.keys()) if (!idx.has(v)) strong(v);
  return comps.map((c) => c.join(" <-> ")).sort();
}

function findLayerViolations(graph) {
  const out = new Set();
  for (const [file, deps] of graph) {
    const from = folderOf(file);
    for (const dep of deps) {
      const to = folderOf(dep);
      if (to === from) continue;
      for (const rule of LAYER_RULES) {
        const applies =
          (rule.from.includes("*") || rule.from.includes(from)) &&
          !(rule.except ?? []).includes(from);
        const forbidden =
          rule.forbid.includes(to) ||
          (rule.forbid.includes("*") && !(rule.allow ?? []).includes(to));
        if (applies && forbidden) {
          out.add(`${rule.name}: ${rel(file)} -> ${rel(dep)}`);
        }
      }
    }
  }
  return [...out].sort();
}

function diff(current, baseline) {
  const cur = new Set(current);
  const base = new Set(baseline);
  return {
    added: current.filter((x) => !base.has(x)),
    removed: baseline.filter((x) => !cur.has(x)),
  };
}

const graph = buildGraph();
const current = {
  cycles: findCycles(graph),
  layerViolations: findLayerViolations(graph),
};

const baseline = fs.existsSync(baselinePath)
  ? JSON.parse(fs.readFileSync(baselinePath, "utf8"))
  : { cycles: [], layerViolations: [] };

if (process.argv.includes("--update-baseline")) {
  // The baseline may only shrink: drop fixed entries, never add new ones.
  const added = [];
  const next = {};
  for (const key of ["cycles", "layerViolations"]) {
    const known = new Set(baseline[key] ?? []);
    for (const item of current[key]) if (!known.has(item)) added.push(item);
    next[key] = current[key].filter((item) => known.has(item));
  }
  fs.writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(
    `Wrote ${path.relative(repoRoot, baselinePath)}: ${next.cycles.length} cycles, ${next.layerViolations.length} layer violations.`,
  );
  for (const item of added) {
    console.error(`NEW (not added to the baseline, fix it): ${item}`);
  }
  process.exit(added.length > 0 ? 1 : 0);
}

let failed = false;
for (const key of ["cycles", "layerViolations"]) {
  const { added, removed } = diff(current[key], baseline[key] ?? []);
  for (const item of added) {
    failed = true;
    console.error(`NEW ${key}: ${item}`);
  }
  for (const item of removed) {
    failed = true;
    console.error(
      `FIXED ${key} (remove from baseline with --update-baseline): ${item}`,
    );
  }
}
console.log(
  `architecture: ${current.cycles.length} cycles, ${current.layerViolations.length} layer violations (baseline ${baseline.cycles?.length ?? 0} / ${baseline.layerViolations?.length ?? 0})`,
);
process.exit(failed ? 1 : 0);
