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
  {
    rules: {
      // The settings pages intentionally seed an editable form from fetched
      // server state (`useEffect(() => setForm(data), [data])`). That is the
      // pattern React's compiler rule flags, but here it is deliberate and
      // benign (one-shot config forms). Keep it visible as a warning while the
      // migration to a key-reset/derived-state pattern is tracked, rather than
      // failing lint on an intentional choice.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
