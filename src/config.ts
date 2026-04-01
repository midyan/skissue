import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { configPath } from "./paths.js";

/**
 * Remote: `owner` + `repo` (GitHub clone). Local monorepo: `path` to repo root that contains `registry.json` / `registry/`.
 * Do not set `path` together with `owner`/`repo`.
 */
export const RegistryConfigSchema = z
  .object({
    owner: z.string().optional(),
    repo: z.string().optional(),
    branch: z.string().min(1).default("main"),
    /**
     * When true: always use SSH. When false: always use HTTPS (with token if set).
     * When omitted: use HTTPS if GITHUB_TOKEN/GH_TOKEN is set, else SSH (typical local dev).
     */
    useSsh: z.boolean().optional(),
    path: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const local = data.path != null && data.path.trim().length > 0;
    const remote = Boolean(data.owner?.trim() && data.repo?.trim());
    if (local && remote) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Use either registry.path (local) or registry.owner + registry.repo (remote), not both.",
        path: ["path"],
      });
    }
    if (!local && !remote) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Set registry.path to a local directory, or registry.owner and registry.repo for a GitHub registry.",
      });
    }
  });

export const ConfigSchema = z.object({
  registry: RegistryConfigSchema,
  skillsRoot: z.string().min(1).default(".agents/skills"),
});

export type Config = z.infer<typeof ConfigSchema>;
export type RegistryConfig = z.infer<typeof RegistryConfigSchema>;

const DEFAULT_CONFIG_YAML = `# Remote (GitHub) — omit useSsh for auto (SSH if no token, else HTTPS+token):
# registry:
#   owner: your-org
#   repo: skill-registry
#   branch: main
#   useSsh: false  # optional: force HTTPS; true forces SSH
#
# Local (path is relative to the consumer project root):
# registry:
#   path: ../skill-registry
#   branch: main
#
skillsRoot: .agents/skills
`;

/** True when registry lives on disk (no GitHub clone). */
export function isLocalRegistry(config: Config): boolean {
  return Boolean(config.registry.path?.trim());
}

/** True when `.skill-issue/config.yaml` is missing or not valid for `loadConfig`. */
export async function needsSetup(cwd: string): Promise<boolean> {
  const path = configPath(cwd);
  if (!existsSync(path)) {
    return true;
  }
  try {
    const raw = await readFile(path, "utf8");
    parseConfigYaml(raw);
    return false;
  } catch {
    return true;
  }
}

export async function loadConfig(cwd: string): Promise<Config> {
  const path = configPath(cwd);
  const raw = await readFile(path, "utf8");
  const data = YAML.parse(raw);
  return ConfigSchema.parse(data);
}

export async function writeConfig(cwd: string, config: Config): Promise<void> {
  const path = configPath(cwd);
  await mkdir(dirname(path), { recursive: true });
  const obj = ConfigSchema.parse(config);
  await writeFile(path, YAML.stringify(obj, { lineWidth: 0 }), "utf8");
}

export function parseConfigYaml(raw: string): Config {
  return ConfigSchema.parse(YAML.parse(raw));
}

export function defaultConfigTemplate(): string {
  return DEFAULT_CONFIG_YAML;
}
