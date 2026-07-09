import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "functions/lib/**",
    "next-env.d.ts",
    ".firebase/**",
    ".agents/**",
    ".claude/**",
    ".codex/**",
    ".cursor/**",
    ".gemini/**",
    ".gstack/**",
    ".scratch/**",
    ".worktrees/**",
    "coverage/**",
    "graphify-out/**",
  ]),
]);

export default eslintConfig;
