#!/usr/bin/env bash
#
# Resets the application database to a clean production state.
#
#   - Backs up first, always.
#   - Shows exactly what will be destroyed and waits for typed confirmation.
#   - Empties business data; keeps schema, indexes and app_settings.
#   - Creates one MASTER_ADMIN through the application's own BCrypt encoder,
#     so no password hash is ever written by hand or stored in a file.
#
# Run from the project root (the directory holding docker-compose.yml):
#   bash scripts/reset-production-data.sh
#
# Git does not carry database rows. This script is how a server gets the same
# clean state a developer produced locally.
#
set -euo pipefail

MASTER_EMAIL="${MASTER_EMAIL:-masteradmin@sensovibe.in}"

die() { echo "ERROR: $*" >&2; exit 1; }

[ -f docker-compose.yml ] || die "run this from the project root (no docker-compose.yml here)"
[ -f .env ] || die ".env not found — it holds the database name and credentials"

# Read DB settings from .env without exporting the whole file.
env_get() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- ; }
DB_NAME="$(env_get MYSQL_DATABASE)"; DB_NAME="${DB_NAME:-inventory}"
DB_PASS="$(env_get MYSQL_ROOT_PASSWORD)"
DB_USER="$(env_get DB_USERNAME)"; DB_USER="${DB_USER:-root}"
[ -n "$DB_PASS" ] || die "MYSQL_ROOT_PASSWORD is empty in .env"

PROJECT="$(docker compose config --format json 2>/dev/null | sed -n 's/.*"name":"\([^"]*\)".*/\1/p' | head -1)"
PROJECT="${PROJECT:-$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9')}"

mysql_do() { docker compose exec -T mysql mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" "$@" 2>/dev/null; }

echo "============================================================"
echo " TARGET"
echo "============================================================"
echo "  host              : $(hostname)"
echo "  compose project   : $PROJECT"
echo "  database          : $DB_NAME"
echo "  mysql container   : $(docker compose ps -q mysql | cut -c1-12)"
echo "  data volume       : ${PROJECT}_mysql_data   (survives 'down', destroyed by 'down -v')"
echo "  uploads volume    : ${PROJECT}_backend_uploads"
echo
echo "  Current contents:"
mysql_do -e "
SELECT 'users' AS table_name, COUNT(*) AS rows_ FROM users
UNION ALL SELECT 'components', COUNT(*) FROM components
UNION ALL SELECT 'equipment', COUNT(*) FROM equipment
UNION ALL SELECT 'projects', COUNT(*) FROM projects
UNION ALL SELECT 'suppliers', COUNT(*) FROM suppliers
UNION ALL SELECT 'purchases', COUNT(*) FROM purchases
UNION ALL SELECT 'purchase_items', COUNT(*) FROM purchase_items
UNION ALL SELECT 'inventory_transactions', COUNT(*) FROM inventory_transactions
UNION ALL SELECT 'project_component_usage', COUNT(*) FROM project_component_usage
UNION ALL SELECT 'invoice_extractions', COUNT(*) FROM invoice_extractions
UNION ALL SELECT 'books', COUNT(*) FROM books
UNION ALL SELECT 'members', COUNT(*) FROM members
UNION ALL SELECT 'book_issues', COUNT(*) FROM book_issues
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL SELECT 'app_settings (KEPT)', COUNT(*) FROM app_settings;" \
  || die "cannot reach MySQL — is the stack running? (docker compose ps)"

echo
echo "  Accounts that will be removed:"
mysql_do -e "SELECT id, email, role FROM users ORDER BY id;"
echo
echo "============================================================"
echo " Everything above except app_settings will be DELETED."
echo " Inspect the list. Continue only if it is all test data."
echo "============================================================"
read -r -p 'Type exactly  DELETE ALL DATA  to proceed: ' CONFIRM
[ "$CONFIRM" = "DELETE ALL DATA" ] || die "aborted — nothing was changed"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$HOME/inventory-backup-${STAMP}.sql"
echo
echo "[1/6] Backing up to $BACKUP"
docker compose exec -T mysql mysqldump -u "$DB_USER" -p"$DB_PASS" \
  --single-transaction --routines --triggers "$DB_NAME" > "$BACKUP" 2>/dev/null
[ -s "$BACKUP" ] || die "backup is empty — refusing to delete anything"
echo "      $(du -h "$BACKUP" | cut -f1) written"

echo "[2/6] Emptying business tables (schema untouched)"
# FK checks off so ordering cannot matter; TRUNCATE also resets AUTO_INCREMENT,
# so the first real component becomes C0001.
mysql_do -e "
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE inventory_transactions;
TRUNCATE TABLE purchase_items;
TRUNCATE TABLE purchases;
TRUNCATE TABLE invoice_extractions;
TRUNCATE TABLE project_component_usage;
TRUNCATE TABLE component_usage;
TRUNCATE TABLE book_issues;
TRUNCATE TABLE books;
TRUNCATE TABLE members;
TRUNCATE TABLE notifications;
TRUNCATE TABLE audit_logs;
TRUNCATE TABLE components;
TRUNCATE TABLE equipment;
TRUNCATE TABLE projects;
TRUNCATE TABLE suppliers;
TRUNCATE TABLE users;
DELETE FROM app_settings WHERE setting_key LIKE 'appearance.%';
SET FOREIGN_KEY_CHECKS = 1;"

echo "[3/6] Clearing orphaned invoice files"
docker compose exec -T backend sh -c 'rm -f /app/uploads/invoices/* 2>/dev/null || true' || true

echo "[4/6] Creating the master admin via the application's own encoder"
# The password is supplied for a single boot as a shell variable. Shell values
# take precedence over .env in compose substitution, so nothing is written to
# disk and the hash is produced by BCryptPasswordEncoder inside the app.
# users is empty, so DataInitializer seeds this account as MASTER_ADMIN.
read -r -s -p "      Password for ${MASTER_EMAIL}: " MASTER_PASSWORD; echo
[ -n "$MASTER_PASSWORD" ] || die "password cannot be empty"

SEED_DEFAULT_USERS=true \
SEED_ADMIN_EMAIL="$MASTER_EMAIL" \
SEED_ADMIN_PASSWORD="$MASTER_PASSWORD" \
SEED_USER_EMAIL= \
SEED_USER_PASSWORD= \
  docker compose up -d --force-recreate backend >/dev/null
unset MASTER_PASSWORD

echo "      waiting for the backend..."
for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -m 5 -w '%{http_code}' -X POST \
    http://127.0.0.1:8091/api/v1/auth/login -H 'Content-Type: application/json' -d '{}' || true)
  [ "$code" = "400" ] || [ "$code" = "401" ] && break
  sleep 3
done
docker compose logs backend --tail 100 2>/dev/null | grep -iE "Seeded (MASTER_ADMIN|ADMIN)" | tail -2 || true

echo "[5/6] Turning seeding back off"
# Without this, the credentials would be re-applied on every restart.
docker compose up -d --force-recreate backend >/dev/null
for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -m 5 -w '%{http_code}' -X POST \
    http://127.0.0.1:8091/api/v1/auth/login -H 'Content-Type: application/json' -d '{}' || true)
  [ "$code" = "400" ] || [ "$code" = "401" ] && break
  sleep 3
done
docker compose logs backend --tail 50 2>/dev/null | grep -i "seeding is disabled" | tail -1 || true

echo "[6/6] Final state"
mysql_do -e "SELECT id, email, role, active+0 AS active FROM users;"
mysql_do -e "
SELECT 'components' AS t, COUNT(*) n FROM components
UNION ALL SELECT 'equipment', COUNT(*) FROM equipment
UNION ALL SELECT 'projects', COUNT(*) FROM projects
UNION ALL SELECT 'purchases', COUNT(*) FROM purchases
UNION ALL SELECT 'inventory_transactions', COUNT(*) FROM inventory_transactions
UNION ALL SELECT 'app_settings', COUNT(*) FROM app_settings;"

echo
echo "Done. Backup: $BACKUP"
echo "Sign in at your server URL as ${MASTER_EMAIL} and change the password."
