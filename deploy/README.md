# Deployment — Mahlzeit auf Hostinger Shared Hosting

Diese Anleitung beschreibt einen kompletten Deploy von einem sauberen Stand
in die Produktion. Quelle für alle Architekturentscheidungen ist `PLAN.md`,
insbesondere die Sektionen 5 (Struktur), 7 (Phase 6) und 11 (.htaccess).

---

## 1. Voraussetzungen

- Hostinger-Plan mit PHP 8.x und MySQL (Web-Plan reicht).
- FTP/SFTP-Zugang oder hPanel-Filemanager.
- phpMyAdmin-Zugang (in hPanel verlinkt).
- Lokal: `node` ≥ 20 und `bash` (Git Bash unter Windows).
- Eine Domain, die auf `public_html/` zeigt, und SSL aktiviert
  (hPanel → Free Lets Encrypt).

---

## 2. Build erzeugen

Aus dem Repo-Root:

```bash
deploy/build.sh
```

Das Skript:

1. baut `client/` (Workspace-App, `base: '/w/'`),
2. baut `admin/` (Admin-App, `base: '/'`),
3. legt `deploy/output/` an, kopiert beide Frontends, die drei PHP-Bäume
   (`server/api/`, `server/admin/` → `admin-api/`, `server/shared/`),
   `schema.sql`, `seed.php` und schreibt das kombinierte `.htaccess`.

Ergebnis:

```
deploy/output/
├── index.html         # Admin-App (Login-Seite an der Domain-Wurzel)
├── assets/            # Admin-App-Bundle
├── favicon.svg
├── icons.svg
├── w/
│   ├── index.html     # Workspace-App
│   └── assets/
├── api/               # Workspace-API (PHP)
├── admin-api/         # Admin-API (PHP, vom Repo-Pfad server/admin/ umbenannt)
├── shared/            # Gemeinsame PHP-Helpers (db.php, ids.php, iban.php)
├── schema.sql         # einmalig in phpMyAdmin importieren, danach löschen
├── seed.php           # einmalig per CLI ausführen, DANACH LÖSCHEN
└── .htaccess
```

---

## 3. Datenbank anlegen (phpMyAdmin)

1. hPanel → **Datenbanken → MySQL-Datenbanken**: neue DB anlegen
   (Name, Benutzer, Passwort notieren).
2. hPanel → **phpMyAdmin** öffnen, neue DB auswählen.
3. Tab **Importieren** → `deploy/output/schema.sql` hochladen → **OK**.
4. Schnellprüfung: in der Tabellenliste sollten u.a. `workspaces`,
   `sessions`, `items`, `restaurants`, `dishes`, `dish_option_groups`,
   `dish_options`, `admins` erscheinen.

---

## 4. `config.php` auf dem Server erstellen

`config.php` liegt **außerhalb** von `public_html/` (eine Ebene höher) und
ist niemals im Git. Im Filemanager bzw. per SFTP unter `/home/<user>/`
folgende Datei anlegen — direkt neben `public_html/`:

```php
<?php
return [
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => '<DB-Name aus Schritt 3>',
        'user' => '<DB-User aus Schritt 3>',
        'pass' => '<DB-Passwort aus Schritt 3>',
    ],
    'admin_session_name' => 'mahlzeit_admin',
];
```

Hinweis: `server/shared/db.php` sucht `config.php` u.a. unter
`dirname(DOCUMENT_ROOT) . '/config.php'`, also exakt diese Position.

---

## 5. Dateien hochladen

`deploy/output/` ist nicht der Server-Root — der **Inhalt** dieses
Verzeichnisses gehört nach `public_html/`. Per SFTP/Filemanager:

```
public_html/
├── index.html
├── assets/
├── favicon.svg
├── icons.svg
├── w/
├── api/
├── admin-api/
├── shared/
├── schema.sql
├── seed.php
└── .htaccess
```

`config.php` liegt **eine Ebene höher**, nicht in `public_html/`.

Tipp: vor dem ersten Upload `public_html/` leeren (außer einer evtl.
vom Hoster vorinstallierten `.well-known/`-Struktur).

---

## 6. Initialen Admin anlegen (`seed.php`)

`seed.php` läuft ausschließlich per CLI. Hostinger bietet je nach Plan
SSH-Zugang oder einen Browser-Terminal in hPanel. SSH-Beispiel:

```bash
ssh u<id>@<host> -p 65002
cd public_html
php seed.php <username> <passwort>
```

Erwartete Ausgabe: `Admin user "<username>" created.`

Alternative ohne CLI: in phpMyAdmin direkt einen Admin per SQL einfügen.
`password_hash` muss mit `password_hash($pw, PASSWORD_DEFAULT)` (PHP 8)
erzeugt sein.

---

## 7. `seed.php` und `schema.sql` löschen

Sobald der Admin existiert:

```bash
rm public_html/seed.php
rm public_html/schema.sql
```

Beide Dateien werden nach dem Erst-Setup nicht mehr gebraucht und gehören
nicht in eine Produktions-Webroot.

---

## 8. Smoke-Test

1. `https://<deinedomain>/` → Admin-Login-Seite muss laden (HTML kommt
   aus `index.html`, Bundle aus `/assets/`).
2. Mit den Credentials aus Schritt 6 einloggen.
3. Im Admin einen Workspace anlegen → Share-Link kopieren.
4. `https://<deinedomain>/w/?w=<token>` → Workspace-App muss laden.
5. Im Workspace einen Namen + IBAN setzen, eine Sammelbestellung anlegen,
   einen Eintrag hinzufügen.
6. Zurück im Admin: Workspace-Detail öffnen → Stats und Aktive-Nutzer-
   Liste sollten die gerade erzeugten Daten widerspiegeln.

Wenn etwas hängt, in dieser Reihenfolge prüfen:

- Browser-DevTools → Network: liefern `/admin/api/me` und `/api/sessions`
  JSON statt HTML? Falls HTML, greift `.htaccess` nicht.
- hPanel → Apache-Errorlog: typische Stolperer sind fehlende
  `mod_rewrite`-Aktivierung oder ein falscher `config.php`-Pfad
  (`config.php not found` aus `shared/db.php`).
- Admin-Cookie: muss `Secure` + `HttpOnly` haben — also nur über HTTPS
  testen, nicht über die rohe IP.

---

## 9. Re-Deploys

Bei späteren Updates:

1. Lokal `deploy/build.sh` neu laufen lassen.
2. `deploy/output/` hochladen — Inhalt von `public_html/` überschreiben,
   **aber** `config.php` (liegt eh außerhalb) und ggf. existierende
   Backups in Ruhe lassen.
3. Falls `schema.sql` Änderungen enthält: Migration manuell in
   phpMyAdmin nachziehen. `schema.sql` ist `CREATE TABLE` — nicht blind
   neu importieren, wenn Daten existieren.
4. `seed.php` nach dem Upload erneut löschen, falls das Skript es wieder
   mit kopiert hat.
