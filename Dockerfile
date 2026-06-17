FROM node:24-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY scripts ./scripts
COPY web ./web
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV GUARDIAN_BASE_DIR=/data
ENV GUARDIAN_CONFIG_PATH=/data/config.yaml

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/web ./web
COPY --from=build /app/policies ./policies
COPY --from=build /app/skills ./skills
COPY --from=build /app/SOUL.md ./SOUL.md
COPY deploy/fly ./deploy/fly

RUN chmod +x /app/deploy/fly/start.sh && mkdir -p /data

EXPOSE 3000
CMD ["/app/deploy/fly/start.sh"]
