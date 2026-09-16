# Deployment Guide — Inventory Management System

**Audience:** an engineer or an AI coding agent (e.g. Claude Code) setting this project
up on a fresh machine or server. Follow the steps top to bottom; each has a copy‑paste
command and a checkpoint to verify before moving on. Where a value must be chosen, it is
called out explicitly.

The stack is three Docker containers — **MySQL 8**, a **Spring Boot** backend, and a
**React + Nginx** frontend — orchestrated by `docker-compose.yml`. You do **not** install
Java, Node, or MySQL on the host; Docker builds everything.

---

## 0. Prerequisites

Install/verify on the host:

- **Docker Engine + Docker Compose v2** (`docker compose version` must work). On a VPS,
  install Docker's official packages. On Windows/Mac, install **Docker Desktop** and make
  sure it is **running** before any `docker` command.
- **git**.
- **An OpenAI API key** (starts with `sk-...`) — required only for the AI features
  (invoice photo/PDF/CSV extraction, the voice mic, phone‑QR capture). The app runs
  without it, but those features return sample/"not configured" responses.

Checkpoint:

```bash
docker compose version   # shows v2.x
git --version
```

---

## 1. Get the code

```bash
git clone https://github.com/laxmandhotre0045-sketch/InventoryManagementSystem.git
cd InventoryManagementSystem
```

If the repo is private, authenticate first (`gh auth login`, or a git credential/PAT).

---

## 2. Create and fill in `.env` (this is the only file you edit)

`.env` is **not** committed (it holds secrets). Create it from the template:

```bash
cp .env.example .env
```

Now edit `.env` and set these values. **The three marked REQUIRED must be changed** or the
stack will not start or will be insecure.

| Variable | Set it to | Notes |
|----------|-----------|-------|
| `SPRING_PROFILES_ACTIVE` | `prod` | already the default |
| `MYSQL_ROOT_PASSWORD` | **REQUIRED** — a strong password | the DB is created with this |
| `JWT_SECRET` | **REQUIRED** — a long random string | the backend **refuses to boot** under `prod` with the placeholder value. Generate one: `openssl rand -base64 48` |
| `OPENAI_API_KEY` | your `sk-...` key | leave blank to deploy without AI |
| `INVOICE_OCR_PROVIDER` | `openai` (if key set) else `mock` | turns real AI extraction on/off |
| `OPENAI_MODEL` | `gpt-4o` | vision model for invoices/voice intent (default is fine) |
| `OPENAI_TRANSCRIBE_MODEL` | `gpt-4o-mini-transcribe` | voice speech‑to‑text (default is fine) |
| `FRONTEND_PORT` | `8090` | host port for the web app |
| `BACKEND_PORT` | `8091` | bound to `127.0.0.1` only (reached via the frontend's nginx) |
| `MYSQL_PORT` | `3310` | bound to `127.0.0.1` only |
| `CORS_ALLOWED_ORIGINS` | `*` locally, or your domain in prod | e.g. `https://inventory.example.com` |

**First‑boot admin account (do this on a brand‑new, empty database so you can log in).**
Set these three for the *first* start only, then turn seeding back off (step 5):

```dotenv
SEED_DEFAULT_USERS=true
SEED_ADMIN_EMAIL=you@yourcompany.com
SEED_ADMIN_PASSWORD=<a strong password you choose>
```

Generate a JWT secret quickly:

```bash
# writes a fresh JWT_SECRET line you can paste into .env
echo "JWT_SECRET=$(openssl rand -base64 48)"
```

Checkpoint: `.env` exists, `JWT_SECRET` is not the placeholder, `MYSQL_ROOT_PASSWORD` is
strong, and (for AI) `OPENAI_API_KEY` is set with `INVOICE_OCR_PROVIDER=openai`.

---

## 3. Build and start

```bash
docker compose up -d --build
```

First build takes a few minutes (it compiles the backend and builds the frontend). The DB
schema is created automatically by Hibernate on first boot — **no manual SQL is needed**.

Checkpoint — wait until all three are `healthy`:

```bash
docker compose ps
# inventory-mysql, inventory-backend, inventory-frontend should all show (healthy)
```

If the backend keeps restarting, see Troubleshooting (usually a placeholder `JWT_SECRET`).

---

## 4. Verify it works

```bash
# Frontend serves (expect HTTP 200)
curl -s -o /dev/null -w "frontend: %{http_code}\n" http://localhost:8090/

# API is up — a bad login returns a clean 401 JSON (not a 500)
curl -s -X POST http://localhost:8090/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"x@x.x","password":"x"}'
# expect: {"success":false,"message":"Invalid email or password"}  HTTP 401
```

Then open **http://localhost:8090** (or `http://<server-ip>:8090`) and log in with the
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` you set in step 2.

Swagger API docs: **http://localhost:8091/swagger-ui.html** (backend is localhost‑only).

---

## 5. Lock down seeding (after the first successful login)

Once you can log in, stop the app from re‑creating demo accounts:

```bash
# in .env
SEED_DEFAULT_USERS=false
```

```bash
docker compose up -d backend   # recreate the backend with the new value
```

---

## 6. Enabling / verifying the AI features

These need `OPENAI_API_KEY` set and `INVOICE_OCR_PROVIDER=openai` (step 2), then a restart:

```bash
docker compose up -d --build backend frontend
```

- **Invoice extraction:** in the app, **Purchases → Upload Invoice** → drop a PDF/JPG/PNG/CSV
  or use **Scan a QR to capture on your phone**. The AI fills editable line items; review and
  **Confirm Purchase** to add stock. If you see a "sample data" chip, the key is missing.
- **Voice:** the 🎤 mic in the top bar (Chrome/Edge). Speak "add 50 ESP32", review, confirm.
- **Phone‑QR capture networking:** the phone must be able to reach the server. It needs to be
  on the **same LAN** as the host and use the host's **LAN IP** (e.g. `192.168.x.x`) — the QR
  dialog lets you enter it. Public/guest/5G routers that isolate clients will block this; a
  VPN like Tailscale on both devices, or deploying behind a real domain with HTTPS, avoids it.
  Ensure the host firewall allows inbound TCP on `FRONTEND_PORT` (8090) from the LAN.

Cost note: each extraction/voice/transcription call bills the OpenAI account.

---

## 7. Common operations

```bash
docker compose logs -f backend      # tail backend logs
docker compose ps                   # health/status
docker compose up -d --build        # rebuild + restart after a git pull
docker compose down                 # stop (database data is kept)
docker compose down -v              # stop AND delete DB data (destructive)
```

Update to the latest code:

```bash
git pull && docker compose up -d --build
```

Persistent data lives in Docker volumes: `mysql_data` (database) and `backend_uploads`
(uploaded invoice files). They survive `docker compose down` (but not `down -v`).

---

## 8. Troubleshooting

| Symptom | Cause & fix |
|---------|-------------|
| Backend container restarts / unhealthy, logs mention the JWT secret | `JWT_SECRET` is still the placeholder. Set a real one (`openssl rand -base64 48`), then `docker compose up -d backend`. |
| `Cannot connect to the Docker daemon` | Docker isn't running. Start Docker Desktop (Win/Mac) or `sudo systemctl start docker` (Linux). |
| Port already in use (8090/8091/3310) | Another service holds the port. Change `FRONTEND_PORT`/`BACKEND_PORT`/`MYSQL_PORT` in `.env` and restart. |
| Can't log in on a fresh DB | No users were seeded. Set `SEED_DEFAULT_USERS=true` + `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`, `docker compose up -d backend`, log in, then set it back to `false`. |
| Invoice upload shows a "sample data" chip | `OPENAI_API_KEY` is blank or `INVOICE_OCR_PROVIDER` isn't `openai`. Fix `.env`, `docker compose up -d --build backend`. |
| Voice says "not configured" | Same as above — set the OpenAI key. |
| Voice mic does nothing | Use Chrome or Edge; allow microphone permission; the page must be `localhost` or HTTPS. |
| Phone "site can't be reached" when scanning QR | Phone not on the same network, wrong IP (used a VPN/localhost address), or host firewall blocking 8090. See §6. |
| AI extraction is slow or times out | Large photos — the app already downscales; ensure a stable connection. `OPENAI_TIMEOUT_MS` can be raised in `.env`. |

---

## 9. Security checklist (do before going live)

- [ ] `JWT_SECRET` is a fresh random value (not the placeholder, not shared).
- [ ] `MYSQL_ROOT_PASSWORD` is strong and unique.
- [ ] `SEED_DEFAULT_USERS=false` after the first admin is created.
- [ ] `OPENAI_API_KEY` is set only in `.env` on the host — **never committed**.
- [ ] `CORS_ALLOWED_ORIGINS` restricted to your real domain in production.
- [ ] Backend (`8091`) and MySQL (`3310`) stay bound to `127.0.0.1` (already the default).
- [ ] **Rotate secrets:** earlier git history contains a previous `.env`. Rotate the DB
      password and `JWT_SECRET` on the server so any leaked historical values are useless.
- [ ] Put the frontend behind HTTPS (reverse proxy / domain) for internet exposure.

---

## Optional: restore existing data instead of a fresh start

The repo includes a database backup at `backups/inventory-backup-20260817-134342.sql`
(schema + a master‑admin account + settings/categories). Only use this if you want that
existing data; otherwise the fresh‑seed path in steps 2–5 is preferred (no known credentials).

```bash
# with the stack running:
docker exec -i inventory-mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" inventory \
  < backups/inventory-backup-20260817-134342.sql
docker compose restart backend
```

After restoring, **change the admin password** from inside the app, since backups contain a
known credential.
