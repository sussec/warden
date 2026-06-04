# warden-web — Next.js standalone served by Bun
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS build
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js rewrites are resolved at build time — bake the in-cluster API URL.
ARG API_INTERNAL_URL=http://warden:8080
ENV API_INTERNAL_URL=$API_INTERNAL_URL
RUN bun run build

FROM oven/bun:1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["bun", "server.js"]
