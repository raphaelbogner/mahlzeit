---
name: php2shell-rueckbau
description: PHP2Shell-Notschutz (21.10.2026) auf dem ganzen Hostinger-Konto — Multipart-Sperren vor PHP; Liste, was nach dem Hostinger-PHP-Update zurückgebaut wird
metadata:
  type: project
---

Am 2026-10-21 wurde PHP2Shell bekannt (CVE-2026-109618/-109619, RCE ohne Login über `multipart/form-data`, PHP parst vor dem App-Code). Hostinger (Konto u868921633, alt-php83 8.3.35 / alt-php84 8.4.26 / alt-php85 8.5.11, Build 30.09.) hatte keinen Patch und **keine ETA**. Deshalb überall eine Multipart-Sperre vor PHP (Status 503). Gleicher Text liegt in familyhub, mayemedia_invoicehub und mahlzeit.

**Rückbau-Bedingung:** Per SSH `for v in /opt/alt/php8*/usr/bin/php; do $v -v | head -1; done` zeigt mindestens 8.3.36 / 8.4.27 / 8.5.12, oder `rpm -q --changelog alt-php83 alt-php84 | grep 109618` findet den Fix.

**Was zurück muss (Suche nach `PHP2Shell-Notschutz`):**
- **FamilyHub** (Repo): Block in `public/.htaccess` (ErrorDocument 503 + RewriteCond multipart) und `public/notschutz.html` löschen, pushen.
- **BusinessHub** (Repo mayemedia_invoicehub): dasselbe in `public/.htaccess` und `public/notschutz.html`.
- **mahlzeit** (Repo): Block in `deploy/build.sh` entfernen; auf dem Server den Block oben in `~/domains/mahlzeit.mayemedia.at/public_html/.htaccess`.
- **ask-salzburg.at** (WordPress, nicht im Repo): Block oben in `public_html/.htaccess` (Sicherung `.htaccess.bak-php2shell`). Danach Gernot und Reinhard Bescheid geben (Medien-Upload geht wieder).
- **vanessabogner.at** (nicht im Repo): Block oben in `public_html/.htaccess` (Sicherung daneben). Die Änderung in `app.js` (`body: new URLSearchParams(data)` statt FormData) darf bleiben.

**Bleibt so (kein Rückbau):** gelöschte Hostinger-Platzhalter `default.php` (christina, delfin-massage, steffi, mayemedia.at/invoicehub, 5× *.hostingersite.com).

**Wissenswert:**
- LiteSpeed ignoriert `ErrorDocument 503`; es erscheint die Standard-503-Seite. Der Schutz wirkt trotzdem.
- `RewriteCond %{ENV:REDIRECT_STATUS} !=503` statt „leer“, weil die Root-.htaccess intern nach `public/` umleitet (REDIRECT_STATUS ist dann 200).
- Spurensuche am 21.10. sauber (keine fremden PHP-Dateien; FamilyHub-Booking-Dateien hatten nur wegen Git-Neuschreiben beim Deploy ein frisches mtime).
- Nebenbefund: Node-Apps auf demselben Konto liefen mit 11 Threads/Prozess am Prozesslimit (120). Fix im hPanel je App: `UV_THREADPOOL_SIZE=1`, `NODE_OPTIONS=--v8-pool-size=1` → 5 Threads. Geplant: mayemedia.at + speis-schalchen.at statisch exportieren, privaten Kram (FamilyHub) auf eigenen Hostinger-Plan trennen.
