# Docker Setup

Containerized stack for the Inventory Management System: **MySQL** + **Spring Boot** backend + **React/Nginx** frontend.

## Files

| File | Location | Purpose |
|------|----------|---------|
| `docker-compose.yml` | project root | Orchestrates all three services |
| `.env` / `.env.example` | project root | Configuration (ports, DB password, JWT secret) |
| `Dockerfile` | `Inventory-System-New/` | Multi-stage build for the Spring Boot backend |
| `.dockerignore` | `Inventory-System-New/` | Excludes build output, uploads, IDE files |
| `Dockerfile` | `inventory-management-system-frontend/` | Multi-stage build (Vite → Nginx) for the frontend |
| `nginx.conf` | `inventory-management-system-frontend/` | SPA routing + gzip + asset caching |
| `.dockerignore` | `inventory-management-system-frontend/` | Excludes node_modules, dist, env files |

## Quick start

```bash
# From the project root (this folder):
cp .env.example .env      # a ready-to-run .env is already provided
docker compose up --build
```

Then open:

- **Frontend:** http://localhost:5173
- **Backend / Swagger UI:** http://localhost:8081/swagger-ui.html
- **MySQL:** localhost:3306

## Common commands

```bash
docker compose up -d --build     # start in the background
docker compose logs -f backend   # tail backend logs
docker compose ps                # service status/health
docker compose down              # stop (database data is kept)
docker compose down -v           # stop and delete database data
```

## How it works

- **Networking:** all services share the `inventory-net` bridge network. The backend reaches the database at the hostname `mysql` (the service name).
- **Environment variables:** the backend's database URL, credentials, and JWT
  settings are injected via env vars in `docker-compose.yml`, which override
  `application.properties` through Spring Boot's relaxed binding — **no source
  code was changed**.
- **Persistent storage:**
  - `mysql_data` volume → database files survive restarts.
  - `backend_uploads` volume → uploaded invoice files (`/app/uploads`) survive restarts.
- **Startup order:** the backend waits for MySQL to pass its healthcheck
  (`service_healthy`) before starting; the frontend starts after the backend.
- **Image size:** multi-stage builds keep only the runtime artifacts. The
  backend uses Spring Boot layered jars on a JRE-Alpine base; the frontend ships
  only static assets on Nginx-Alpine. Both run as non-root.

## Important note about the frontend → backend URL

The frontend calls the backend at a **hardcoded absolute URL**
`http://localhost:8081/api/v1` (see `src/api/axiosClient.js`). Because this call
runs in the user's **browser**, it hits the backend port published on the host
(`8081`) — which is why the backend port is exposed and CORS is left open.
(Port 8081 is used instead of 8080 because Apache/httpd occupies 8080 on this machine.)

This works out of the box on your local machine. If you deploy the frontend and
backend to different hosts, you'll need to point that base URL at the real
backend address (that's an application code change, which was intentionally left
untouched here).
