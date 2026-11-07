---
name: mahlzeit-sicherheits-haertung-2026-11
description: Härtung von mahlzeit im November 2026 (Push-Endpoint-Allowlist, .htaccess-Sperren, Token nur im Header) und warum
metadata:
  type: project
---

Am 07.11.2026 gehärtet, weil mahlzeit auf demselben Hostinger-Account (gleicher Unix-Benutzer) wie BusinessHub und FamilyHub läuft. Jede Lücke hier würde die Daten dieser Apps gefährden.

- **Push-Endpoints:** `is_allowed_push_endpoint()` in `server/shared/push.php` lässt nur FCM, Mozilla, Windows (WNS) und Apple zu, ohne eigenen Port und ohne Zugangsdaten in der URL. Vorher reichte `https://`, das war eine SSRF bzw. ein Port-Scan über `/api/push/test`. Der Versand löscht Altbestand mit fremden Endpoints.
- **API-Token nur im Header:** `X-Workspace-Token`. `?w=` wird an der API nicht mehr angenommen (401). Die geteilten Links `/w/?w=` bleiben unverändert, weil der Client das Token daraus liest.
- **.htaccess** (aus `deploy/build.sh`): Gesperrt sind `shared/`, `migrations/`, `*.sql` und `seed.php`. Unter `api/` bzw. `admin-api/` ist nur `index.php` direkt erreichbar. Dazu kommt `Referrer-Policy: no-referrer`.

**Why:** Ergebnis des Sicherheits-Reviews aller Sites auf dem Hostinger-Plan.
**How to apply:** Neue PHP-Hilfsdateien gehören nach `shared/` und sind damit automatisch gesperrt. Ein neuer Push-Dienst muss in die Allowlist. Bewusst nicht umgesetzt: das Token ins `#`-Fragment verschieben. Die Entscheidung fiel am 07.11.2026, Links bleiben bei `?w=`.
