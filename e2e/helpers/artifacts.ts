import fs from "node:fs";
import path from "node:path";

/** Where proof captures go: `E2E_ARTIFACT_DIR`, else the Cursor artifacts folder. */
export const PROOF_ARTIFACT_DIR =
  process.env.E2E_ARTIFACT_DIR ?? "/opt/cursor/artifacts";

/**
 * Best-effort copy of a proof capture next to the Playwright attachment. A
 * machine without a writable artifacts folder must not fail the assertions
 * that ran before the capture, so permission errors only skip the copy.
 */
export function writeProofArtifact(
  basename: string,
  body: string | Buffer,
): string | null {
  const out = path.join(PROOF_ARTIFACT_DIR, basename);
  try {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, body);
    return out;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EROFS" || code === "EPERM") return null;
    throw err;
  }
}
