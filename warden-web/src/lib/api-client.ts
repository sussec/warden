import type { CreateClientConfig } from "@/client/client.gen";

// Runtime config for the generated hey-api fetch client.
// baseUrl is same-origin — Next rewrites proxy /api/* to the Warden API.
// Auth interceptors are attached in lib/auth (Phase 2).
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: "/",
});
