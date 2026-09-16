# Push-Benachrichtigungen einrichten (Hostinger Shared Hosting)

Push ist im Code komplett vorhanden, aber **standardmäßig aus**: Solange
`config.php` keinen `push`-Abschnitt hat, liefert `GET /api/push/config`
`enabled: false`, der Schalter im Profilmenü bleibt unsichtbar und alle
`notify_*`-Aufrufe sind No-ops.

## 0. Vorabprüfung (einmal per SSH im hPanel)

```bash
php -v                                   # >= 8.1
php -m | grep -Ei 'openssl|curl|mbstring|gmp|bcmath'
composer --version                       # falls fehlt: siehe unten
crontab -l                               # Cron im hPanel verfügbar?
curl -sI https://fcm.googleapis.com | head -1   # ausgehendes HTTPS erlaubt?
```

Erwartung: `openssl`, `curl`, `mbstring` vorhanden; **`gmp` oder `bcmath`**
vorhanden (VAPID-Signatur). Fehlt Composer auf dem Server: lokal ausführen
(`composer install` in `server/`), `server/vendor/` wird dann von
`deploy/build.sh` mit hochgeladen.

## 1. Abhängigkeiten

`deploy/build.sh` installiert `server/vendor/` automatisch, wenn es fehlt
oder älter als `composer.lock` ist — mit lokalem Composer, sonst über das
Docker-Image `composer:2`. Es ist also nichts von Hand zu tun; ohne Composer
und ohne Docker bricht der Build mit einer klaren Meldung ab.

Manuell (z. B. nach einem Update der Abhängigkeiten in `composer.json`):

```bash
cd server
composer install --no-dev --optimize-autoloader
# oder ohne lokales PHP, aus dem Repo-Root in Git Bash:
MSYS_NO_PATHCONV=1 docker run --rm -v "$(cygpath -m "$PWD")/server:/app" composer:2 \
  install --no-dev --optimize-autoloader --ignore-platform-reqs --no-interaction
```

`server/vendor/` ist gitignored, `composer.lock` ist eingecheckt. Der Server
braucht PHP >= 8.2 (hPanel → PHP-Konfiguration).

## 2. VAPID-Schlüssel erzeugen

```bash
php server/cron/generate_vapid.php
```

Ausgabe in `config.php` (neben `db`) einfügen und `subject` auf eine echte
`mailto:`-Adresse setzen:

```php
'push' => [
    'subject'       => 'mailto:you@example.com',
    'vapid_public'  => '…',
    'vapid_private' => '…',
    'timezone'      => 'Europe/Vienna',
],
```

## 3. Migration

`server/migrations/011_push.sql` über phpMyAdmin importieren (idempotent).

## 4. Deploy

`deploy/build.sh` kopiert jetzt zusätzlich `cron/`, `composer.json` und (falls
vorhanden) `vendor/` nach `deploy/output/`. Das `.htaccess` verweigert
HTTP-Zugriff auf `cron/`, `vendor/` und `composer.*`.

## 5. Cron-Job (hPanel → Erweitert → Cron-Jobs)

```
* * * * * /usr/bin/php /home/<user>/domains/<domain>/public_html/cron/push_tick.php >> /home/<user>/push_tick.log 2>&1
```

Minutentakt ist ideal (Bestellschluss-Warnung genau bei 15 min). Erlaubt der
Plan nur alle 5 Minuten, kommt die Warnung bis zu 5 Minuten früher.

**Pfad:** Cron-Jobs gelten bei Hostinger für den ganzen Account, nicht pro
Website. `/home/<user>/public_html/` ist nur das Root der *Hauptdomain*; jede
weitere Domain liegt unter `/home/<user>/domains/<domain>/public_html/`. Den
exakten Pfad zeigt der Dateimanager im hPanel (Pfad oben in der Leiste) oder
per SSH `pwd` im Ordner mit `config.php`. Stimmt der Pfad nicht, läuft der
Cron still ins Leere — deshalb die Ausgabe zunächst in eine Log-Datei
schreiben und nach ein, zwei Minuten prüfen (`tail push_tick.log`):
Erwartet ist pro Lauf eine Zeile wie
`deadline-warnings=0 reminders=0 sent=0 failed=0 removed=0`.
Sobald es läuft, kann das Log wieder auf `>/dev/null` gestellt werden.

Ohne funktionierenden Cron kommen die ereignisbasierten Pushes (neue Session,
geschlossen, Zahlung bestätigt) trotzdem an — sie werden seit dem Fix direkt
in der Anfrage zugestellt. Der Cron ist nur für „Bestellschluss in 15 min“,
„Noch offen“ und für Wiederholversuche nötig.

## 6. Test

1. In der App: Profil → **Benachrichtigungen** einschalten (Browser fragt
   nach Erlaubnis). iOS: nur in der installierten App (Home-Bildschirm).
2. **Testnachricht senden** im selben Dialog → erscheint sofort (wird direkt
   zugestellt, nicht erst per Cron).
3. Danach eine Session anlegen: alle anderen Abonnenten des Workspaces
   bekommen „Neue Sammelbestellung“.

## Ereignisse

| Ereignis | Empfänger | Auslöser |
|---|---|---|
| Neue Session | alle Abos im Workspace außer Ersteller:in | `POST /sessions` |
| Bestellschluss in 15 min | Bekannte (60 Tage) ohne Eintrag, nicht abgesagt | Cron |
| Session geschlossen | alle mit offenem Betrag | `PATCH status=closed`, Auto-Close |
| Zahlung bestätigt | die bestätigte Person | `paid=true`, `mark-paid` |
| Noch offen (nach 3 Tagen) | unbezahlt & nicht gemeldet | Cron, einmal pro Eintrag |

## Aufräumen

Abos, deren Endpunkt `404/410` liefert, werden beim Versand gelöscht; nach 5
Fehlversuchen ebenfalls. Outbox-Zeilen hängen per `ON DELETE CASCADE` daran.
