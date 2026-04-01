import chalk from "chalk";
import { type Config, isLocalRegistry, loadConfig } from "../config.js";
import { ensureRegistryCheckout, resolveRegistryTransport } from "../git/registry-repo.js";

function nodeOk(): { ok: boolean; detail: string } {
  const major = Number(process.versions.node.split(".")[0]);
  if (Number.isFinite(major) && major >= 24) {
    return { ok: true, detail: `Node ${process.version}` };
  }
  return { ok: false, detail: `Node ${process.version} (need >=24)` };
}

function authHint(config: Config): string {
  if (isLocalRegistry(config)) {
    return "";
  }
  const t = resolveRegistryTransport(config);
  if (t === "ssh") {
    return "Registry uses SSH (or auto: no token in env); ensure `ssh -T git@github.com` succeeds.";
  }
  if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) {
    return "Registry uses HTTPS with GITHUB_TOKEN or GH_TOKEN.";
  }
  return "HTTPS without a token (registry.useSsh: false). Public repos only, or set a token / omit registry.useSsh for auto SSH when no token.";
}

export async function runDoctor(cwd: string): Promise<void> {
  const n = nodeOk();
  console.log(n.ok ? chalk.green(`✓ ${n.detail}`) : chalk.red(`✗ ${n.detail}`));

  let config;
  try {
    config = await loadConfig(cwd);
    console.log(chalk.green("✓ .skill-issue/config.yaml valid"));
  } catch (e) {
    console.log(chalk.red(`✗ config: ${e instanceof Error ? e.message : String(e)}`));
    process.exitCode = 1;
    return;
  }

  const hint = authHint(config);
  if (hint) {
    console.log(chalk.dim(`• ${hint}`));
  }

  try {
    const { path: repoPath, head } = await ensureRegistryCheckout(cwd, config);
    const label = isLocalRegistry(config) ? "Local registry" : "Registry cache";
    console.log(chalk.green(`✓ ${label} synced (${repoPath}) @ ${head.slice(0, 7)}`));
  } catch (e) {
    console.log(chalk.red(`✗ Registry: ${e instanceof Error ? e.message : String(e)}`));
    process.exitCode = 1;
  }
}
