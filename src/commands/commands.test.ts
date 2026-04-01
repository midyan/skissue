import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  runInitRegistry: vi.fn(),
  runInit: vi.fn(),
  runInstall: vi.fn(),
  runUninstall: vi.fn(),
  runList: vi.fn(),
  runOutdated: vi.fn(),
  runUpdate: vi.fn(),
  runDefault: vi.fn(),
  runDoctor: vi.fn(),
  runManage: vi.fn(),
}));

vi.mock("./init-registry.js", () => ({ runInitRegistry: hoisted.runInitRegistry }));
vi.mock("./init.js", () => ({ runInit: hoisted.runInit }));
vi.mock("./install.js", () => ({
  runInstall: hoisted.runInstall,
  runInstallMany: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./uninstall.js", () => ({ runUninstall: hoisted.runUninstall }));
vi.mock("./list.js", () => ({ runList: hoisted.runList }));
vi.mock("./outdated.js", () => ({ runOutdated: hoisted.runOutdated }));
vi.mock("./update.js", () => ({ runUpdate: hoisted.runUpdate }));
vi.mock("./default.js", () => ({ runDefault: hoisted.runDefault }));
vi.mock("./doctor.js", () => ({ runDoctor: hoisted.runDoctor }));
vi.mock("./manage.js", () => ({ runManage: hoisted.runManage }));

/** Poll until any of the given mocks has been called at least once. */
async function waitForAnyCall(mocks: Array<{ mock: { calls: unknown[] } }>): Promise<void> {
  await expect
    .poll(() => mocks.some((m) => m.mock.calls.length > 0), { timeout: 5000, interval: 10 })
    .toBe(true);
}

describe("entry.ts CLI", () => {
  const argv0 = process.argv[0];
  const origArgv = process.argv.slice();

  beforeEach(() => {
    process.exitCode = 0;
    vi.resetModules();
    Object.values(hoisted).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset?.());
    hoisted.runInitRegistry.mockResolvedValue(undefined);
    hoisted.runInit.mockResolvedValue(undefined);
    hoisted.runInstall.mockResolvedValue(undefined);
    hoisted.runUninstall.mockResolvedValue(undefined);
    hoisted.runList.mockResolvedValue(undefined);
    hoisted.runOutdated.mockResolvedValue(undefined);
    hoisted.runUpdate.mockResolvedValue(undefined);
    hoisted.runDefault.mockResolvedValue(undefined);
    hoisted.runDoctor.mockResolvedValue(undefined);
    hoisted.runManage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.argv = [argv0 ?? "node", ...origArgv.slice(1)];
    vi.restoreAllMocks();
  });

  it("dispatches install <id>", async () => {
    process.argv = ["node", "skissue", "install", "alpha"];
    await import("../entry.js");
    await waitForAnyCall([hoisted.runInstall]);
    expect(hoisted.runInstall).toHaveBeenCalledWith(process.cwd(), "alpha");
  });

  it("dispatches uninstall, list, outdated, update, manage, browse, doctor", async () => {
    for (const [args, mock] of [
      [["uninstall", "x"], hoisted.runUninstall],
      [["list"], hoisted.runList],
      [["outdated"], hoisted.runOutdated],
      [["update"], hoisted.runUpdate],
      [["update", "s"], hoisted.runUpdate],
      [["manage"], hoisted.runManage],
      [["browse"], hoisted.runManage],
      [["doctor"], hoisted.runDoctor],
    ] as const) {
      vi.resetModules();
      Object.values(hoisted).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockClear());
      hoisted.runInitRegistry.mockResolvedValue(undefined);
      hoisted.runInit.mockResolvedValue(undefined);
      hoisted.runInstall.mockResolvedValue(undefined);
      hoisted.runUninstall.mockResolvedValue(undefined);
      hoisted.runList.mockResolvedValue(undefined);
      hoisted.runOutdated.mockResolvedValue(undefined);
      hoisted.runUpdate.mockResolvedValue(undefined);
      hoisted.runDefault.mockResolvedValue(undefined);
      hoisted.runDoctor.mockResolvedValue(undefined);
      hoisted.runManage.mockResolvedValue(undefined);

      process.argv = ["node", "skissue", ...args];
      await import("../entry.js");
      await waitForAnyCall([mock]);
    }
  });

  it("doctor respects -C / --cwd", async () => {
    vi.resetModules();
    const dir = await mkdtemp(join(tmpdir(), "skissue-doc-"));
    process.argv = ["node", "skissue", "doctor", "-C", dir];
    await import("../entry.js");
    await waitForAnyCall([hoisted.runDoctor]);
    expect(hoisted.runDoctor).toHaveBeenCalledWith(dir);
    await rm(dir, { recursive: true, force: true });
  });

  it("doctor without -C uses process.cwd()", async () => {
    vi.resetModules();
    Object.values(hoisted).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockClear());
    hoisted.runDoctor.mockResolvedValue(undefined);
    const cwd = process.cwd();
    process.argv = ["node", "skissue", "doctor"];
    await import("../entry.js");
    await waitForAnyCall([hoisted.runDoctor]);
    expect(hoisted.runDoctor).toHaveBeenCalledWith(cwd);
  });

  it("dispatches init-registry and init", async () => {
    for (const [cmd, mock] of [
      ["init-registry", hoisted.runInitRegistry],
      ["init", hoisted.runInit],
    ] as const) {
      vi.resetModules();
      Object.values(hoisted).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockClear());
      hoisted.runInitRegistry.mockResolvedValue(undefined);
      hoisted.runInit.mockResolvedValue(undefined);
      process.argv = ["node", "skissue", cmd];
      await import("../entry.js");
      await waitForAnyCall([mock]);
    }
  });

  it("bare command runs runDefault", async () => {
    process.argv = ["node", "skissue"];
    await import("../entry.js");
    await waitForAnyCall([hoisted.runDefault]);
  });

  it("init-registry logs and sets exitCode on error", async () => {
    vi.resetModules();
    hoisted.runInitRegistry.mockRejectedValueOnce(new Error("bad"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    process.argv = ["node", "skissue", "init-registry"];
    await import("../entry.js");
    await waitForAnyCall([hoisted.runInitRegistry]);
    expect(err).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("install sets exitCode when runInstall throws", async () => {
    vi.resetModules();
    hoisted.runInstall.mockRejectedValueOnce(new Error("fail"));
    process.argv = ["node", "skissue", "install", "z"];
    await import("../entry.js");
    await waitForAnyCall([hoisted.runInstall]);
    expect(process.exitCode).toBe(1);
  });

  it("manage sets exitCode when runManage throws", async () => {
    vi.resetModules();
    hoisted.runManage.mockRejectedValueOnce(new Error("manage fail"));
    process.argv = ["node", "skissue", "manage"];
    await import("../entry.js");
    await waitForAnyCall([hoisted.runManage]);
    expect(process.exitCode).toBe(1);
  });

  it("bare command sets exitCode when runDefault throws", async () => {
    vi.resetModules();
    hoisted.runDefault.mockRejectedValueOnce(new Error("default fail"));
    process.argv = ["node", "skissue"];
    await import("../entry.js");
    await waitForAnyCall([hoisted.runDefault]);
    expect(process.exitCode).toBe(1);
  });

  it("other subcommands set exitCode when their runners throw", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const [args, mock] of [
      [["list"], hoisted.runList],
      [["uninstall", "x"], hoisted.runUninstall],
      [["outdated"], hoisted.runOutdated],
      [["update"], hoisted.runUpdate],
      [["init"], hoisted.runInit],
      [["doctor"], hoisted.runDoctor],
    ] as const) {
      vi.resetModules();
      process.exitCode = 0;
      Object.values(hoisted).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset?.());
      hoisted.runInitRegistry.mockResolvedValue(undefined);
      hoisted.runInit.mockResolvedValue(undefined);
      hoisted.runInstall.mockResolvedValue(undefined);
      hoisted.runUninstall.mockResolvedValue(undefined);
      hoisted.runList.mockResolvedValue(undefined);
      hoisted.runOutdated.mockResolvedValue(undefined);
      hoisted.runUpdate.mockResolvedValue(undefined);
      hoisted.runDefault.mockResolvedValue(undefined);
      hoisted.runDoctor.mockResolvedValue(undefined);
      hoisted.runManage.mockResolvedValue(undefined);
      mock.mockRejectedValueOnce(new Error("fail"));
      process.argv = ["node", "skissue", ...args];
      await import("../entry.js");
      await waitForAnyCall([mock]);
      expect(process.exitCode).toBe(1);
    }
    errSpy.mockRestore();
  });

  it("parseAsync rejection exits process", async () => {
    vi.resetModules();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const commander = await import("commander");
    vi.spyOn(commander.Command.prototype, "parseAsync").mockRejectedValueOnce(
      new Error("parse boom"),
    );
    process.argv = ["node", "skissue", "list"];
    await import("../entry.js");
    await expect.poll(() => exitSpy.mock.calls.length > 0).toBe(true);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errSpy).toHaveBeenCalled();
  });
});

describe("banner", () => {
  it("prints logo and optional version", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { printSkillIssueBanner } = await import("./banner.js");
    printSkillIssueBanner("1.2.3");
    expect(logSpy.mock.calls.length).toBeGreaterThan(3);
    printSkillIssueBanner();
    expect(logSpy.mock.calls.length).toBeGreaterThan(6);
    logSpy.mockRestore();
  });
});
