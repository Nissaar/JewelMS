# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Generates the frontend in dist/ and the backend bundle in dist/server.cjs
RUN npm run build

# Stage 2: Production
FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production
# Shared location so the non-root user can use the browser installed as root.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package.json package-lock.json ./
# The Playwright CLI is called by path: with --omit=dev npm links no `playwright`
# command, because that name is also claimed by the dev-only @playwright/test.
# npm is removed afterwards: the app runs with plain node, and the npm bundled
# in the base image ships its own outdated dependencies (tar, glob, ...).
RUN apt-get update && apt-get upgrade -y \
  && npm ci --omit=dev \
  && node node_modules/playwright/cli.js install chromium --with-deps \
  && rm -rf /var/lib/apt/lists/* /root/.npm \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
     /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

# The backend bundle uses --packages=external, so it relies on the production
# node_modules installed above.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

RUN mkdir -p uploads/receipts uploads/odf uploads/images && chown -R node:node uploads

USER node

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
