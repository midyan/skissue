/** Shared Clack `text` validators so prompts stay testable and coverage-friendly. */
export function requiredTrimmed(v: unknown): string | undefined {
  return String(v ?? "").trim() ? undefined : "Required";
}
