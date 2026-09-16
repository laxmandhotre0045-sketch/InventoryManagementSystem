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
cp .env.example .env      # then EDIT .env — it is NOT committed (contains secrets)
docker compose up --build
```

`.env` is intentionally **not** in the repo (it holds secrets). After copying it from
`.env.example`, set at least these before starting:

| Variable | Why |
|----------|-----|
| `MYSQL_ROOT_PASSWORD` | database password (pick a strong one) |
| `JWT_SECRET` | **required** — the app refuses to boot under the `prod` profile with the placeholder value. Generate one with `openssl rand -base64 48` |
| `OPENAI_API_KEY` | enables AI invoice extraction + voice; leave blank to run without AI (invoice upload then returns sample/mock data) |
| `INVOICE_OCR_PROVIDER` | set to `openai` to use real AI extraction (needs `OPENAI_API_KEY`); `mock` otherwise |

Default host ports (overridable in `.env`):

- **Frontend:** http://localhost:8090  (`FRONTEND_PORT`)
- **Backend / Swagger UI:** http://localhost:8091/swagger-ui.html  (`BACKEND_PORT`)
- **MySQL:** localhost:3310  (`MYSQL_PORT`)

### AI features (OpenAI)

Invoice extraction (photo/PDF/CSV → line items), the voice mic (add/remove stock),
and phone-QR capture all call the OpenAI API. To enable them: set `OPENAI_API_KEY`
in `.env` and `INVOICE_OCR_PROVIDER=openai`, then `docker compose up -d --build`.
Without a key the app still runs — invoice upload shows sample data and voice replies
"not configured". The phone-QR capture requires the phone to reach the server, so the
device must be on the same LAN (or Tailscale) as the host; see the QR dialog's on-screen note.

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
