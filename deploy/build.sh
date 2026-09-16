#!/usr/bin/env bash
# Build both frontends and assemble the deploy/output/ directory that
# mirrors the production public_html/ layout. Run this from any directory.
#
#   deploy/build.sh
#
# Output: deploy/output/  — upload its contents to public_html/ on the
# server. See deploy/README.md for the full deploy procedure.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUTPUT="${SCRIPT_DIR}/output"

CLIENT_DIST="${ROOT}/client/dist"
ADMIN_DIST="${ROOT}/admin/dist"

step() { printf '\n==> %s\n' "$*"; }

step "Cleaning previous output (${OUTPUT})"
rm -rf "${OUTPUT}"
mkdir -p "${OUTPUT}"

step "Building workspace app (client/)"
( cd "${ROOT}/client" && npm run build )

step "Building admin app (admin/)"
( cd "${ROOT}/admin" && npm run build )

if [ ! -d "${CLIENT_DIST}" ]; then
  echo "client build output not found at ${CLIENT_DIST}" >&2
  exit 1
fi
if [ ! -d "${ADMIN_DIST}" ]; then
  echo "admin build output not found at ${ADMIN_DIST}" >&2
  exit 1
fi

step "Assembling deploy/output/"

# Admin app at the domain root.
cp -R "${ADMIN_DIST}/." "${OUTPUT}/"

# Workspace app under /w/.
mkdir -p "${OUTPUT}/w"
cp -R "${CLIENT_DIST}/." "${OUTPUT}/w/"

# PHP backends. server/admin/ becomes admin-api/ on the server so that the
# /admin/api/* URL space and the on-disk path don't share a name.
cp -R "${ROOT}/server/api"    "${OUTPUT}/api"
cp -R "${ROOT}/server/admin"  "${OUTPUT}/admin-api"
cp -R "${ROOT}/server/shared" "${OUTPUT}/shared"

# Schema + seed sit at the root for the one-shot setup. The README tells
# the operator to delete seed.php after the initial admin user is created.
cp "${ROOT}/server/schema.sql" "${OUTPUT}/schema.sql"
cp "${ROOT}/server/seed.php"   "${OUTPUT}/seed.php"

# Incremental migration scripts for existing deployments. Only the .sql
# files are shipped — the local _run.php / _verify.php helpers stay out
# of the deploy bundle (they're CLI-only dev tools, no business on a
# production server). The operator imports each .sql via phpMyAdmin in
# order. Idempotent.
if [ -d "${ROOT}/server/migrations" ]; then
  mkdir -p "${OUTPUT}/migrations"
  for f in "${ROOT}/server/migrations"/*.sql; do
    [ -e "$f" ] || continue
    cp "$f" "${OUTPUT}/migrations/"
  done
fi

# Push: cron scripts + composer deps. server/vendor/ is gitignored and only
# (re)installed when missing or older than composer.lock — via a local
# composer if present, otherwise through the composer Docker image. Without
# vendor/ every push delivery fails with "vendor/autoload.php missing".
ensure_vendor() {
  local server="${ROOT}/server"
  local autoload="${server}/vendor/autoload.php"
  if [ -f "${autoload}" ] && [ ! "${server}/composer.lock" -nt "${autoload}" ]; then
    return 0
  fi
  step "Installing PHP dependencies (server/vendor/)"
  if command -v composer >/dev/null 2>&1; then
    ( cd "${server}" && composer install --no-dev --optimize-autoloader --no-interaction )
  elif command -v docker >/dev/null 2>&1; then
    # Git Bash: hand Docker a Windows path (C:/...) and stop MSYS from
    # rewriting the /app side of the mount.
    local mount="${server}"
    if command -v cygpath >/dev/null 2>&1; then mount="$(cygpath -m "${server}")"; fi
    MSYS_NO_PATHCONV=1 docker run --rm -v "${mount}:/app" composer:2 \
      install --no-dev --optimize-autoloader --ignore-platform-reqs --no-interaction
  else
    echo "Neither composer nor docker found - cannot install server/vendor/." >&2
    echo "See docs/PUSH_SETUP.md, section 1." >&2
    exit 1
  fi
  [ -f "${autoload}" ] || { echo "composer install did not produce ${autoload}" >&2; exit 1; }
}
ensure_vendor

cp -R "${ROOT}/server/cron" "${OUTPUT}/cron"
cp "${ROOT}/server/composer.json" "${OUTPUT}/composer.json"
cp "${ROOT}/server/composer.lock" "${OUTPUT}/composer.lock"
cp -R "${ROOT}/server/vendor" "${OUTPUT}/vendor"

step "Writing combined .htaccess"
cat > "${OUTPUT}/.htaccess" <<'HTACCESS'
RewriteEngine On

# Never serve cron scripts, composer files or vendor code over HTTP.
RewriteRule ^(cron|vendor)/ - [F,L]
RewriteRule ^composer.(json|lock)$ - [F,L]

# Admin-API to admin PHP front controller.
RewriteRule ^admin/api/(.*)$ admin-api/index.php [QSA,L]

# Workspace-API to workspace PHP front controller.
RewriteRule ^api/(.*)$ api/index.php [QSA,L]

# Workspace SPA fallback (everything under /w/).
RewriteCond %{REQUEST_URI} ^/w/
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^w/.*$ w/index.html [L]

# Existing files / directories pass through.
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

# Admin SPA fallback (default for the domain root).
RewriteRule ^ index.html [L]
HTACCESS

step "Done"
echo "Output:  ${OUTPUT}"
echo "Next:    see deploy/README.md for the manual deploy steps."
