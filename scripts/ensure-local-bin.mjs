#!/usr/bin/env node
/**
 * npm does not link the root package's `bin` into ./node_modules/.bin. libnpmexec
 * then runs `npx skissue` by looking for `skissue` on PATH from that
 * directory — and fails with `sh: skissue: command not found`.
 *
 * When this package is installed as a dependency, npm already installs bins; skip.
 */
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @param {string} scriptPath Absolute path to this file (or a test fixture path with the same layout).
 */
export function runEnsureLocalBin(scriptPath) {
  if (scriptPath.split(sep).includes("node_modules")) {
    return;
  }

  const root = dirname(dirname(scriptPath));
  const dist = join(root, "dist", "entry.js");
  const binDir = join(root, "node_modules", ".bin");
  const out = join(binDir, "skissue");

  if (!existsSync(dist)) {
    return;
  }

  mkdirSync(binDir, { recursive: true });
  const content = `#!/usr/bin/env sh
exec node "${dist}" "$@"
`;
  writeFileSync(out, content, { mode: 0o755 });
  chmodSync(out, 0o755);
}

runEnsureLocalBin(fileURLToPath(import.meta.url));
