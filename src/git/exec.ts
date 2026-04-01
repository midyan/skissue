import { spawn } from "node:child_process";

export type ExecResult = { code: number; stdout: string; stderr: string };

export type ExecGitOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** Kill the process after this many ms (SIGTERM). Omit for no limit. */
  timeoutMs?: number;
};

/**
 * Run `git` with stdin closed. Without `GIT_TERMINAL_PROMPT=0`, HTTPS operations
 * can hang forever waiting for credentials that never arrive (skissue does not
 * attach a TTY). Callers may override via `options.env`.
 */
export function execGit(args: string[], options: ExecGitOptions = {}): Promise<ExecResult> {
  return new Promise((resolve) => {
    const env = { ...process.env, ...options.env } as NodeJS.ProcessEnv;
    if (env.GIT_TERMINAL_PROMPT === undefined) {
      env.GIT_TERMINAL_PROMPT = "0";
    }

    const child = spawn("git", args, {
      cwd: options.cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    const { timeoutMs } = options;
    const timeout =
      timeoutMs != null && timeoutMs > 0
        ? setTimeout(() => {
            child.kill("SIGTERM");
          }, timeoutMs)
        : undefined;

    child.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("close", (code, signal) => {
      if (timeout !== undefined) clearTimeout(timeout);
      if (signal === "SIGTERM") {
        resolve({
          code: 124,
          stdout,
          stderr: `${stderr}\nskissue: git timed out after ${timeoutMs}ms`.trim(),
        });
        return;
      }
      resolve({ code: code ?? 1, stdout, stderr });
    });
    child.on("error", (err) => {
      if (timeout !== undefined) clearTimeout(timeout);
      resolve({ code: 1, stdout, stderr: String(err) });
    });
  });
}
