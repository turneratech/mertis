# syntax=docker/dockerfile:1
#
# Mertis — self-hosted bug tracker. Two stages: build the React client, then
# ship the Express server that serves it under /mertis.

# ---------- build the client ----------
# Match the Node major used for development: npm 10 and npm 11 resolve some
# transitive versions differently, and `npm ci` refuses a lockfile it did not
# produce. Bumping this without regenerating the lockfiles will break the build.
FROM node:24-bookworm-slim AS client
WORKDIR /build

COPY client/package*.json ./client/
RUN cd client && npm ci

COPY client/ ./client/
# CRA reads homepage: "/mertis" from package.json; override PUBLIC_URL only if
# you serve Mertis at a domain root (see client/src/config/publicPath.js).
RUN cd client && npm run build

# ---------- runtime ----------
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Production deps only, for the server and the attachment providers.
COPY package*.json ./
RUN npm ci --omit=dev
COPY hybrid-storage/package*.json ./hybrid-storage/
RUN cd hybrid-storage && npm install --omit=dev

COPY server/ ./server/
COPY hybrid-storage/ ./hybrid-storage/
COPY imgs/ ./imgs/
COPY --from=client /build/client/build ./client/build

# server/data holds deployment.local.json, which carries instanceId -- the
# machine_id the licence server binds this install to. If it is not on a volume,
# every rebuild mints a new id and activation fails with "bound to another
# machine". uploads/ holds attachments in local-storage mode.
RUN mkdir -p server/data uploads \
 && chown -R node:node /app
VOLUME ["/app/server/data", "/app/uploads"]

USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
