import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated API SDK (@hey-api/openapi-ts output via `bun run gen-api`).
    // It is regenerated, not hand-edited, so linting it is noise.
    "src/client/**",
  ]),
]);

export default eslintConfig;
