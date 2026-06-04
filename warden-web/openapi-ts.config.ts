import { defineConfig } from "@hey-api/openapi-ts";

// Regenerate the typed client + TanStack Query hooks from the live API spec:
//   bun run gen-api
// Override the spec source with OPENAPI_URL (e.g. a running compose stack).
export default defineConfig({
  input: process.env.OPENAPI_URL ?? "http://localhost:8080/openapi/v1.json",
  output: "src/client",
  plugins: [
    "@hey-api/typescript",
    "@hey-api/sdk",
    "@tanstack/react-query",
    {
      name: "@hey-api/client-fetch",
      runtimeConfigPath: "./src/lib/api-client",
    },
  ],
});
