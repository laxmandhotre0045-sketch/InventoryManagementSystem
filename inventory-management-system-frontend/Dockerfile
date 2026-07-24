# syntax=docker/dockerfile:1
#
# This host has limited RAM, so building the app (npm ci + vite build) INSIDE
# the Docker/WSL2 VM runs it out of memory and kills the engine. Instead we
# build the static bundle natively on the host and this image only serves it.
#
#   Build step (run on the host before `docker compose build frontend`):
#     cd inventory-management-system-frontend
#     npm ci        # first time only
#     npm run build # produces ./dist
#
# On a machine with more memory, you can switch back to the self-contained
# multi-stage build (node build stage -> nginx). See Dockerfile.multistage.
###############################################################################

FROM nginx:1.27-alpine AS runtime

# SPA-aware config (client-side routing fallback + gzip + asset caching).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Pre-built static assets produced by `npm run build` on the host.
COPY dist /usr/share/nginx/html

EXPOSE 80

# Use 127.0.0.1 explicitly: nginx listens on IPv4 only, while "localhost"
# also resolves to ::1 in the container and busybox wget tries IPv6 first,
# which made this healthcheck fail permanently despite nginx serving fine.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:80/ || exit 1

# nginx:alpine's default CMD starts the server.
