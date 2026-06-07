import { defineConfig } from "@hey-api/openapi-ts";

// Regenerate the typed client + TanStack Query hooks from the live API spec:
//   bun run gen-api
// Defaults to the API's dev port (compose publishes warden at host :5272 for
// exactly this — :8080 is the web app, not the API). Override with OPENAPI_URL.
export default defineConfig({
  input: process.env.OPENAPI_URL ?? "http://localhost:5272/openapi/v1.json",
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
