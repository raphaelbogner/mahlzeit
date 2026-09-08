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

```bash
cd server
composer install --no-dev --optimize-autoloader
```

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
* * * * * php /home/<user>/public_html/cron/push_tick.php >/dev/null 2>&1
```

Minutentakt ist ideal (Bestellschluss-Warnung genau bei 15 min). Erlaubt der
Plan nur alle 5 Minuten, kommt die Warnung bis zu 5 Minuten früher.

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
