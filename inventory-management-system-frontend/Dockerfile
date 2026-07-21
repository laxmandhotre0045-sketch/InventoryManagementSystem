# syntax=docker/dockerfile:1

###############################################################################
# Stage 1 — Build the React (Vite) app
###############################################################################
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies first (cached until package files change).
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source and produce the static production build.
COPY . .
RUN npm run build

###############################################################################
# Stage 2 — Serve the static build with Nginx
###############################################################################
FROM nginx:1.27-alpine AS runtime

# SPA-aware config (client-side routing fallback + gzip).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static assets produced by Vite (outputs to /app/dist).
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost:80/ || exit 1

# nginx:alpine already runs an unprivileged worker; the default CMD starts it.
