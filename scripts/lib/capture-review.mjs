/**
 * Shared helpers for manual UI review captures (not CI).
 * Writes versioned PNGs under /opt/cursor/artifacts/review/.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export const REVIEW_DIR = "/opt/cursor/artifacts/review";

/** Known-bad captures agents must never treat as fresh proof. */
export const STALE_MD5_DENYLIST = new Set([
  "28bd19dee61d3e989c5174667bb36951",
  "5946fdd5ea6b4b96841ad1df917e4e46",
]);

export function md5File(filePath) {
  return createHash("md5").update(readFileSync(filePath)).digest("hex");
}

export function reviewCapturePath(scene, sha) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  mkdirSync(REVIEW_DIR, { recursive: true });
  const safeScene = scene.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return path.join(REVIEW_DIR, `${safeScene}-${sha}-${ts}.png`);
}

function listSceneCaptures(scene) {
  mkdirSync(REVIEW_DIR, { recursive: true });
  const prefix = `${scene.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}-`;
  return readdirSync(REVIEW_DIR)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".png"))
    .map((name) => {
      const full = path.join(REVIEW_DIR, name);
      return { full, mtime: statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

/** Md5 of the most recent capture for `scene`, excluding `excludePath` if set. */
export function md5FromLastRun(scene, excludePath) {
  for (const { full } of listSceneCaptures(scene)) {
    if (excludePath && path.resolve(full) === path.resolve(excludePath))
      continue;
    try {
      return md5File(full);
    } catch {
      /* skip missing */
    }
  }
  return null;
}

export function isStaleMd5(md5) {
  const envStale = process.env.DEFENSE_VIEWPORT_STALE_MD5?.trim().toLowerCase();
  if (envStale && md5 === envStale) return true;
  return STALE_MD5_DENYLIST.has(md5);
}

/**
 * @returns {{ path: string, md5: string, md5ChangedFromLastRun: boolean }}
 */
export function reportCapture(scene, filePath) {
  const md5 = md5File(filePath);
  const previous = md5FromLastRun(scene, filePath);
  const md5ChangedFromLastRun = previous == null ? true : md5 !== previous;
  const result = { path: filePath, md5, md5ChangedFromLastRun };
  console.log(JSON.stringify(result));

  let fail = false;
  if (isStaleMd5(md5)) {
    console.error(
      `FAIL: capture md5 ${md5} matches DEFENSE_VIEWPORT_STALE_MD5 or stale denylist`,
    );
    fail = true;
  }
  if (!md5ChangedFromLastRun) {
    console.error(
      `FAIL: md5 unchanged from previous ${scene} capture in ${REVIEW_DIR}`,
    );
    fail = true;
  }
  if (fail) process.exitCode = 1;
  return result;
}
