import { join } from "node:path";

export function skillIssueDir(cwd: string): string {
  return join(cwd, ".skill-issue");
}

export function configPath(cwd: string): string {
  return join(skillIssueDir(cwd), "config.yaml");
}

export function lockPath(cwd: string): string {
  return join(skillIssueDir(cwd), "lock.json");
}

export function defaultSkillsRoot(cwd: string): string {
  return join(cwd, ".agents", "skills");
}

export function skillInstallPath(cwd: string, skillsRoot: string, skillId: string): string {
  const root = skillsRoot.startsWith("/") ? skillsRoot : join(cwd, skillsRoot);
  return join(root, skillId);
}
