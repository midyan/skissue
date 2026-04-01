import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { projectService: true },
    },
  },
  {
    ignores: [
      "coverage/**",
      "dist/**",
      "node_modules/**",
      "eslint.config.js",
      "esbuild.config.js",
      "scripts/**/*.mjs",
      // Mirrored agent skills under .agents/skills — not in tsconfig
      ".agents/skills/**",
    ],
  },
);
