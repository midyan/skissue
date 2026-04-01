import { needsSetup } from "../config.js";
import { runInit } from "./init.js";
import { runManage } from "./manage.js";

/** Bare `skissue`: run interactive init when unconfigured, then open manage. */
export async function runDefault(cwd: string): Promise<void> {
  if (await needsSetup(cwd)) {
    await runInit(cwd);
    await runManage(cwd);
  } else {
    await runManage(cwd);
  }
}
