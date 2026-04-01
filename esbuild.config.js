import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";

const banner = `#!/usr/bin/env node\n`;

await esbuild.build({
  entryPoints: ["src/entry.ts"],
  bundle: true,
  platform: "node",
  target: "node24",
  outfile: "dist/entry.js",
  format: "esm",
  banner: { js: banner },
  /** Commander uses dynamic require; keep runtime deps external so Node resolves them. */
  packages: "external",
});

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const version = pkg.version;
console.log(`Built dist/entry.js (skissue v${version})`);
