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

step "Writing combined .htaccess"
cat > "${OUTPUT}/.htaccess" <<'HTACCESS'
RewriteEngine On

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
