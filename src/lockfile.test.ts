import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LockSchema,
  emptyLock,
  readLock,
  readLockOrEmpty,
  removeSkillLock,
  upsertSkillLock,
  writeLock,
} from "./lockfile.js";
import { lockPath, skillIssueDir } from "./paths.js";

describe("lockfile", () => {
  it("parses valid lock json", () => {
    const raw = {
      version: 1,
      skills: {
        a: {
          registryCommit: "abc",
          skillPath: "skills/a",
          ref: "refs/heads/main",
        },
      },
    };
    expect(LockSchema.parse(raw).skills.a.registryCommit).toBe("abc");
  });

  it("upserts and removes skills", () => {
    let lock = emptyLock();
    lock = upsertSkillLock(lock, "x", {
      registryCommit: "deadbeef",
      skillPath: "skills/x",
      ref: "refs/heads/main",
    });
    expect(lock.skills.x.skillPath).toBe("skills/x");
    lock = removeSkillLock(lock, "x");
    expect(lock.skills.x).toBeUndefined();
  });
});

describe("readLock / writeLock / readLockOrEmpty", () => {
  it("writes and reads lock.json under .skill-issue", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skissue-lock-"));
    try {
      const lock = upsertSkillLock(emptyLock(), "a", {
        registryCommit: "abc",
        skillPath: "registry/a",
        ref: "refs/heads/main",
      });
      await writeLock(dir, lock);
      expect(lockPath(dir)).toBe(join(skillIssueDir(dir), "lock.json"));
      const round = await readLock(dir);
      expect(round.skills.a.registryCommit).toBe("abc");
      const raw = await readFile(lockPath(dir), "utf8");
      expect(raw.trimEnd().endsWith("}")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("readLockOrEmpty returns empty when file missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skissue-lock-"));
    try {
      await mkdir(skillIssueDir(dir), { recursive: true });
      const lock = await readLockOrEmpty(dir);
      expect(lock.skills).toEqual({});
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("readLockOrEmpty reads existing lock", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skissue-lock-"));
    try {
      await writeLock(
        dir,
        upsertSkillLock(emptyLock(), "z", {
          registryCommit: "z",
          skillPath: "registry/z",
          ref: "refs/heads/main",
        }),
      );
      const lock = await readLockOrEmpty(dir);
      expect(lock.skills.z.skillPath).toBe("registry/z");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
