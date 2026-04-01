import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { mkdir, access, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { Config } from "../config.js";
import { isLocalRegistry } from "../config.js";
import type { LockSkillEntry } from "../lockfile.js";
import { execGit } from "./exec.js";

function githubTokenFromEnv(): string | undefined {
  const raw = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const t = typeof raw === "string" ? raw.trim() : "";
  return t.length > 0 ? t : undefined;
}

/**
 * Remote GitHub registry transport: explicit `useSsh`, or auto (SSH when no token, HTTPS when token set).
 */
export function resolveRegistryTransport(config: Config): "ssh" | "https" {
  if (isLocalRegistry(config)) {
    return "https";
  }
  const { useSsh } = config.registry;
  if (useSsh === true) {
    return "ssh";
  }
  if (useSsh === false) {
    return "https";
  }
  return githubTokenFromEnv() ? "https" : "ssh";
}

export function registryCacheDir(config: Config): string {
  const owner = config.registry.owner ?? "";
  const repo = config.registry.repo ?? "";
  const transport = resolveRegistryTransport(config);
  const key = `${owner}/${repo}/${transport}`;
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 16);
  return join(homedir(), ".cache", "skissue", "registries", hash);
}

function remoteFailureHint(transport: "ssh" | "https", url: string, exitCode: number): string {
  if (exitCode === 124) {
    return "\n\nTimed out. Check the network or set registry.path to a local clone.";
  }
  if (transport === "ssh") {
    return [
      "",
      `\n\nUsed SSH: ${url}`,
      'GitHub often reports "Repository not found" when the repo is private and your SSH key has no access, or when owner/repo is wrong.',
      "Check registry.owner and registry.repo in .skill-issue/config.yaml, run `ssh -T git@github.com`, and confirm your GitHub user can access that repository.",
      "Alternatives: clone the registry repo locally and set registry.path, or set GITHUB_TOKEN and registry.useSsh: false to use HTTPS.",
    ].join("\n");
  }
  return [
    "",
    `\n\nUsed HTTPS: ${url}`,
    "Private repos need GITHUB_TOKEN or GH_TOKEN (or omit registry.useSsh with no token to use SSH).",
    "Or set registry.path to a local clone.",
  ].join("\n");
}

/** Resolved remote URL for owner/repo registry (SSH or HTTPS with optional token). */
export function registryGitUrl(config: Config): string {
  const owner = config.registry.owner!;
  const repo = config.registry.repo!;
  const transport = resolveRegistryTransport(config);
  if (transport === "ssh") {
    return `git@github.com:${owner}/${repo}.git`;
  }
  const token = githubTokenFromEnv();
  if (token) {
    return `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
  }
  return `https://github.com/${owner}/${repo}.git`;
}

/**
 * Ensure registry is available: local path on disk (with best-effort `git pull --ff-only`),
 * or clone/fetch remote cache under ~/.cache/skissue/registries/.
 * Returns absolute repo root and current HEAD for lockfile / outdated.
 */
export async function ensureRegistryCheckout(
  cwd: string,
  config: Config,
): Promise<{ path: string; head: string }> {
  if (isLocalRegistry(config)) {
    const root = resolve(cwd, config.registry.path!.trim());
    if (!existsSync(root) || !statSync(root).isDirectory()) {
      throw new Error(`Local registry path does not exist or is not a directory: ${root}`);
    }
    const hasRegistry =
      existsSync(join(root, "registry.json")) || existsSync(join(root, "registry"));
    if (!hasRegistry) {
      throw new Error(
        `Local registry must contain registry.json or a registry/ directory: ${root}`,
      );
    }
    const before = await execGit(["rev-parse", "HEAD"], { cwd: root });
    if (before.code !== 0) {
      throw new Error(
        `Local registry must be a git repository root (with commits) so installs can be locked: ${root}`,
      );
    }
    const pull = await execGit(["pull", "--ff-only"], { cwd: root, timeoutMs: 120_000 });
    if (pull.code !== 0) {
      process.stderr.write(
        `skissue: could not fast-forward local registry (using current checkout): ${(pull.stderr || pull.stdout || "unknown").trim()}\n`,
      );
    }
    const head = await execGit(["rev-parse", "HEAD"], { cwd: root });
    if (head.code !== 0) {
      throw new Error(`Local registry git rev-parse failed: ${root}`);
    }
    return { path: root, head: head.stdout.trim() };
  }

  const dir = registryCacheDir(config);
  const transport = resolveRegistryTransport(config);
  const url = registryGitUrl(config);
  const branch = config.registry.branch;

  const parent = join(homedir(), ".cache", "skissue", "registries");
  await mkdir(parent, { recursive: true });

  let hasGit = false;
  try {
    await access(join(dir, ".git"));
    hasGit = true;
  } catch {
    hasGit = false;
  }

  if (!hasGit) {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    const clone = await execGit(["clone", "--depth", "1", "--branch", branch, url, dir], {
      timeoutMs: 600_000,
    });
    if (clone.code !== 0) {
      const base = `git clone failed (${clone.code}): ${clone.stderr || clone.stdout}`.trim();
      throw new Error(base + remoteFailureHint(transport, url, clone.code));
    }
  } else {
    const fetch = await execGit(
      ["fetch", "origin", `+refs/heads/${branch}:refs/remotes/origin/${branch}`, "--depth", "1"],
      { cwd: dir, timeoutMs: 300_000 },
    );
    if (fetch.code !== 0) {
      const base = `git fetch failed (${fetch.code}): ${fetch.stderr || fetch.stdout}`.trim();
      throw new Error(base + remoteFailureHint(transport, url, fetch.code));
    }
    const reset = await execGit(["reset", "--hard", `origin/${branch}`], {
      cwd: dir,
      timeoutMs: 60_000,
    });
    if (reset.code !== 0) {
      throw new Error(`git reset failed (${reset.code}): ${reset.stderr || reset.stdout}`.trim());
    }
  }

  const head = await execGit(["rev-parse", "HEAD"], { cwd: dir });
  if (head.code !== 0) {
    throw new Error(`git rev-parse failed: ${head.stderr}`);
  }

  return { path: dir, head: head.stdout.trim() };
}

/**
 * Fetch a commit into the repo if missing (for diffs / outdated).
 */
export async function ensureCommit(repoPath: string, sha: string): Promise<void> {
  const have = await execGit(["cat-file", "-e", `${sha}^{commit}`], { cwd: repoPath });
  if (have.code === 0) return;

  const fetch = await execGit(["fetch", "origin", sha, "--depth", "1"], {
    cwd: repoPath,
    timeoutMs: 300_000,
  });
  if (fetch.code !== 0) {
    const fetch2 = await execGit(["fetch", "origin", `${sha}:${sha}`, "--depth", "1"], {
      cwd: repoPath,
      timeoutMs: 300_000,
    });
    if (fetch2.code !== 0) {
      throw new Error(
        `Could not fetch commit ${sha}: ${fetch.stderr || fetch2.stderr || fetch.stdout}`,
      );
    }
  }
}

/**
 * Path-scoped diff between two commits; empty string if no changes.
 */
export async function diffPath(
  repoPath: string,
  fromCommit: string,
  toCommit: string,
  pathInRepo: string,
): Promise<string> {
  await ensureCommit(repoPath, fromCommit);
  await ensureCommit(repoPath, toCommit);
  const p = pathInRepo.replace(/^\.\/+/, "").replace(/\/+$/, "");
  const diff = await execGit(["diff", fromCommit, toCommit, "--", p], { cwd: repoPath });
  if (diff.code !== 0) {
    throw new Error(`git diff failed: ${diff.stderr}`);
  }
  return diff.stdout;
}

/** True when git diff output for the path is non-empty (path changed between commits). */
export function isPathStale(diffStdout: string): boolean {
  return diffStdout.trim().length > 0;
}

/** True when the skill subtree changed between the locked commit and `head` (same rule as `outdated`). */
export async function isSkillPathStaleAtHead(
  repoPath: string,
  head: string,
  entry: LockSkillEntry,
): Promise<boolean> {
  const d = await diffPath(repoPath, entry.registryCommit, head, entry.skillPath);
  return isPathStale(d);
}
