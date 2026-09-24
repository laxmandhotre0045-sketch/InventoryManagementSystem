# Deployment Guide — Inventory Management System

**Audience:** an engineer or an AI coding agent (e.g. Claude Code) setting this project
up on a fresh machine or server. Follow the steps top to bottom; each has a copy‑paste
command and a checkpoint to verify before moving on. Where a value must be chosen, it is
called out explicitly.

The stack is three Docker containers — **MySQL 8**, a **Spring Boot** backend, and a
**React + Nginx** frontend — orchestrated by `docker-compose.yml`. You do **not** install
Java or MySQL on the host; Docker builds those.

**Node.js 20+ IS required on the host.** The frontend image serves a bundle you build
natively (`npm run build` → `dist/`) rather than building it inside Docker, because the
in-Docker Vite build exhausts memory on a low-RAM host and kills the Docker engine. See
step 3 — skipping that build makes `docker compose up --build` fail with
`"/dist": not found`.

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
| `OPENAI_MODEL` | `gpt-5.4` | **decides extraction accuracy** — see the note below the table |
| `OPENAI_TRANSCRIBE_MODEL` | `gpt-4o-mini-transcribe` | voice speech‑to‑text (default is fine) |
| `FRONTEND_PORT` | `8090` | host port for the web app |
| `BACKEND_PORT` | `8091` | bound to `127.0.0.1` only (reached via the frontend's nginx) |
| `MYSQL_PORT` | `3310` | bound to `127.0.0.1` only |
| `CORS_ALLOWED_ORIGINS` | every address the app is reached on | see the CORS note below — getting this wrong breaks **login**, not just cross-origin calls |

**About `OPENAI_MODEL`.** This is not a cosmetic default. `gpt-4o` and `gpt-4.1` misplace
decimal points when reading narrow invoice columns — a rate printed `30.51` comes back as
`305.1`, or `1.50` as `1.30` — which silently multiplies stock value. `gpt-5.4` reads them
correctly and is what this deployment is tested on. The backend cross-checks the arithmetic
either way (see §6) and flags what it can't prove, but the model is the first line of defence.

**About `CORS_ALLOWED_ORIGINS`.** Browsers attach an `Origin` header to POST requests *even
when they are same-origin*, so this list is checked on every sign-in. If the address people
actually use isn't listed, login fails with `403 Invalid CORS request` — which looks like a
rejected password but never reaches authentication at all. List every address the app is
opened on, comma-separated, including the LAN address the phone-QR feature uses:

```dotenv
CORS_ALLOWED_ORIGINS=https://inventory.example.com,http://192.168.1.44:8090
```

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

## 3. Build the frontend bundle on the host, then start

The frontend image copies a pre-built `dist/`, so build it **before** Compose (repeat this
whenever you change frontend source — `dist/` is git-ignored and never auto-rebuilds):

```bash
cd inventory-management-system-frontend
npm ci            # first time, or after package.json changes
npm run build     # produces ./dist
cd ..
```

Checkpoint: `inventory-management-system-frontend/dist/index.html` exists. If it does not,
the next command fails with
`failed to compute cache key: "/dist": not found`.

Then build and start the stack:

```bash
docker compose up -d --build
```

First build takes a few minutes (it compiles the backend with Maven). The DB
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

If you reach the app through a domain or reverse proxy, verify login through *that* address
too — it is the one `CORS_ALLOWED_ORIGINS` has to list:

```bash
curl -s -o /dev/null -w "%{http_code}
" -X POST https://your-domain/api/v1/auth/login   -H "Content-Type: application/json" -H "Origin: https://your-domain"   -d '{"email":"x@x.x","password":"x"}'
# 401 = CORS accepted, credentials rejected (correct).  403 = the origin isn't allowed.
```

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

  Every extraction is arithmetic-checked before you see it. An invoice states quantity, rate
  *and* amount, so any two verify the third: a rate whose decimal point was misread breaks
  `qty x rate = amount` by an exact power of ten and is corrected automatically. Anything that
  cannot be proved wrong is never silently "fixed" — it is listed above the line items, and the
  totals panel shows what the lines add up to against the invoice's printed grand total, with a
  green tick only when they agree. **Treat an amber total as a real discrepancy to check.**

- **Uploading something that isn't an invoice** (a photo of the wrong thing, notes, a
  screenshot) is refused with `422` and a message naming what the file looks like. No line
  items are suggested, so there is nothing to confirm into stock by accident.
- **Voice:** the 🎤 mic in the top bar (Chrome/Edge). Speak "add 50 ESP32", review, confirm.
- **Phone‑QR capture networking:** the QR encodes the address the phone should open, shown
  under the code so you can check it before scanning.

  - **Deployed behind a domain** (the easy case): the dialog offers that domain by default and
    the phone can scan from any network, including mobile data. Nothing else to configure.
  - **Reached only over the LAN:** enter the host's Wi-Fi IP **with the port**, e.g.
    `192.168.1.44:8090`. The phone must be on the same Wi-Fi, the firewall must allow inbound
    TCP on `FRONTEND_PORT`, and guest/client-isolating routers will block it regardless.

  A LAN address is always opened over plain `http://` — the LAN server has no TLS — so a bare
  IP never inherits the `https` of a proxied page. `localhost` is rejected outright: it means
  "this computer" and can never be reached from a phone.

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
| Phone "site can't be reached" when scanning QR | Check the URL printed under the QR. For a LAN address it must include the port (`192.168.1.44:8090`) and use `http://`. Otherwise: phone on another network, a VPN/localhost address, or the firewall blocking `FRONTEND_PORT`. See §6. |
| Login fails with **403** (not 401) | The address you're using isn't in `CORS_ALLOWED_ORIGINS`. Add it, then `docker compose up -d backend`. The backend logs the active list at startup: `CorsConfig : CORS allowed origins: [...]`. |
| Extracted prices are off by a factor of 10 | `OPENAI_MODEL` is a GPT-4-era model. Set `OPENAI_MODEL=gpt-5.4` and `docker compose up -d backend`. See §2. |
| Invoice upload returns 422 | The file wasn't recognised as an invoice, or couldn't be read. The message says which. This is the intended refusal, not a fault. |
| Totals panel shows "Off by ..." | The lines genuinely don't reconcile with the invoice's printed total. Check the flagged lines against the document before confirming — do not confirm a mismatch. |
| AI extraction is slow or times out | Large photos — the app already downscales; ensure a stable connection. `OPENAI_TIMEOUT_MS` can be raised in `.env`. |

---

## 9. Security checklist (do before going live)

- [ ] `JWT_SECRET` is a fresh random value (not the placeholder, not shared).
- [ ] `MYSQL_ROOT_PASSWORD` is strong and unique.
- [ ] `SEED_DEFAULT_USERS=false` after the first admin is created.
- [ ] `OPENAI_API_KEY` is set only in `.env` on the host — **never committed**.
- [ ] `CORS_ALLOWED_ORIGINS` lists your real addresses and not `*` — and you have signed in
      through each one to confirm (a missing origin gives 403, not 401).
- [ ] Backend (`8091`) and MySQL (`3310`) stay bound to `127.0.0.1` (already the default).
- [ ] **Rotate secrets:** earlier git history contains a previous `.env`. Rotate the DB
      password and `JWT_SECRET` on the server so any leaked historical values are useless.
- [ ] Put the frontend behind HTTPS (reverse proxy / domain) for internet exposure.
- [ ] A database dump has been taken **and restored into a throwaway container to prove it
      works** (§10). An unverified backup is not a backup.
- [ ] The historical dump committed at `backups/inventory-backup-20260817-134342.sql`
      contains a real account and its password hash. It is public in git history, so that
      account's password must be changed in the app — deleting the file does not undo it.

---

## 10. Backing up the database

Take a dump before any upgrade, and on a schedule once there is real data in it. The
volume survives `docker compose down`, but not `down -v`, and not a lost disk.

```bash
# reads MYSQL_ROOT_PASSWORD from .env
set -a && . ./.env && set +a
docker exec inventory-mysql mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD"   --single-transaction --routines --triggers --databases inventory   > "backups/inventory-backup-$(date +%Y%m%d-%H%M%S).sql"
```

`--single-transaction` takes a consistent snapshot without locking the app out.

**Verify the dump rather than trusting it** — restore it into a throwaway container, which
never touches the live database:

```bash
docker run -d --name restore-test -e MYSQL_ROOT_PASSWORD=verifyonly mysql:8.0
# wait for it to accept connections, then:
docker exec -i restore-test mysql -uroot -pverifyonly < backups/<your-dump>.sql
docker exec restore-test mysql -uroot -pverifyonly -e   "SELECT COUNT(*) FROM inventory.components; SELECT COUNT(*) FROM inventory.users;"
docker rm -f restore-test
```

Dumps are git-ignored (`backups/*.sql`): they contain user rows and password hashes and
must never be committed.

To restore over the live database, stop the backend first so nothing writes mid-restore:

```bash
docker compose stop backend
set -a && . ./.env && set +a
docker exec -i inventory-mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" < backups/<your-dump>.sql
docker compose start backend
```

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
