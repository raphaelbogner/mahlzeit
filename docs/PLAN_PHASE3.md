# Phase 3 – Mobile

Stand: 2026-09-08. Reihenfolge: **PWA + Logo → Geräte-Sync/Backup → Push**.
Push hängt von einer Vorabprüfung des Hostings ab (siehe 9b) und wird als
eigener Block geliefert.

---

## 9a. PWA + Logo

### Entscheidungen
- **Installierbar, App-Shell gecacht, Daten immer live.** Ohne Netz startet die
  App und zeigt „Keine Verbindung"; `/api/*` wird nie gecacht.
- Icon: **mehrere grafische Entwürfe zur Auswahl**, kein reiner Buchstabe.
  Das gewählte Logo kommt auch in den Desktop-Header.

### Umsetzung
1. **Logo-Entwürfe** (Schritt mit Rückmeldung): 4 SVG-Varianten im
   bestehenden Stil (Orange `#f97316`, Stone-Grautöne), z.B. Teller mit Besteck,
   Lunchbox mit Deckel, Wrap/Dürüm-Silhouette, Sprechblase mit Gabel. Ablage in
   `client/public/icons/drafts/`, Vorschau als Artefakt. Nach Auswahl:
   `icon.svg`, PNG 192/512, `maskable-512.png` (Safe-Zone), `apple-touch-icon.png`
   (180), `favicon.ico`. Erzeugung per Node-Script mit `sharp`
   (devDependency) → `client/scripts/build-icons.mjs`.
2. `client/public/manifest.webmanifest`: `name` „Mahlzeit", `short_name`,
   `start_url: "/w/"`, `scope: "/w/"`, `display: standalone`,
   `theme_color`/`background_color`, Icons. **Achtung Token:** `start_url`
   kann den Workspace-Token nicht enthalten. Lösung: beim ersten Laden mit
   `?w=` den Token zusätzlich in `localStorage` (`mahlzeit.workspace.v1`)
   sichern; `client.ts:getWorkspaceToken()` fällt darauf zurück und die App
   ergänzt `?w=` in der URL. So funktioniert der Start vom Home-Bildschirm.
3. Service Worker `client/public/sw.js` (handgeschrieben, kein Plugin):
   Precache der Build-Assets (Liste wird beim Build per kleinem Vite-Plugin in
   `sw.js` injiziert), Strategie: Navigation → App-Shell aus Cache mit
   Netz-Update; `/api/` → nur Netz. Versionierter Cache-Name, alte Caches
   beim `activate` löschen. Registrierung in `main.tsx` nur in Production.
4. `index.html`: `<link rel="manifest">`, `apple-mobile-web-app-*`-Metas,
   `apple-touch-icon`.
5. Header: Logo-SVG links neben dem Wortmarken-Text in `.brand` (ersetzt den
   `brand-dot`), auch im Admin-Header.
6. Hinweis „Zum Home-Bildschirm hinzufügen" (einmalig, wegklickbar) nach der
   ersten Bestellung, mit iOS-Anleitung (Teilen → Zum Home-Bildschirm).

### Tests
- `lib/workspaceToken.test.ts`: Fallback-Reihenfolge URL → localStorage.
- Manuell: Lighthouse „Installable", Start ohne Netz zeigt Offline-Hinweis.

---

## 9a. Geräte-Sync und Backup

### Entscheidungen
- **QR-Code + Link** im Profilmenü unter „Gerät verbinden / Backup".
- Profil im **URL-Fragment** (`#`), landet nie in Server-Logs. Enthält
  `user_id`, `user_name`, `iban`, Version.
- Zielgerät mit vorhandenem Profil: **Rückfrage, dann ersetzen**.
- Der Link heißt ausdrücklich **Wiederherstellungs-Link**; **einmaliger
  Hinweis nach der ersten Bestellung** „Profil sichern?".

### Umsetzung
- `lib/profileTransfer.ts`: `encodeProfileLink(profile, token)` →
  `${origin}/w/?w=${token}#profile=${base64url(JSON)}`; `decodeProfileLink(hash)`
  mit strikter Validierung (`user_id` 16 Zeichen, Name ≤ 120, IBAN mod-97 oder
  leer). Tests.
- `ProfileMenu.tsx`: Abschnitt „Gerät verbinden / Backup" mit QR (bestehende
  `qrcode`-Lib), Kopier-Knopf, Hinweistext „Speichere diesen Link, damit du dein
  Profil auf einem anderen Gerät oder nach dem Löschen der Browserdaten
  wiederherstellen kannst."
- `App.tsx`/`useProfile.tsx`: beim Start `location.hash` prüfen. Kein Profil →
  direkt übernehmen. Profil vorhanden und abweichend → Dialog „Auf diesem Gerät
  bist du ‚X'. Durch ‚Y' ersetzen?" Danach Hash entfernen (`history.replaceState`).
- Neue Komponente `components/BackupHint.tsx`: erscheint einmal nach dem ersten
  eigenen Eintrag (Flag `mahlzeit.hints.backup.v1`), verlinkt ins Profilmenü.

### Randfälle
- Link enthält IBAN → Hinweis im UI: „Nur an dich selbst schicken."
- Alte `user_id` bleibt in der DB; Einträge des alten Profils werden nicht
  „umgehängt" (bewusst, kein Server-Eingriff).

---

## 9b. Push-Benachrichtigungen

### Entscheidungen
- Opt-in per **Schalter im Profilmenü**, gilt **pro Gerät und Workspace**.
  Kein Browser-Popup beim ersten Besuch; nach der ersten Bestellung einmaliger
  Hinweis.
- Ereignisse: **Neue Session**, **Bestellschluss in 15 min**, **Session
  geschlossen / Betrag fällig**, **Zahlung bestätigt** und **Erinnerung bei
  offenem Betrag**.
- Hosting: **Hostinger Shared**. Voraussetzungen werden vor der Umsetzung
  geprüft.

### Vorabprüfung (Schritt 0, per SSH/hPanel durch dich, ich liefere die Befehle)
- PHP ≥ 8.1 mit `openssl`, `curl`, `mbstring`; `gmp` oder `bcmath` für VAPID.
- Composer verfügbar (`composer --version`) oder Vendor-Ordner kann lokal
  gebaut und hochgeladen werden.
- Cron-Jobs im hPanel (Minutentakt erlaubt?).
- Ausgehende HTTPS-Verbindungen zu Push-Diensten (`fcm.googleapis.com`,
  `*.push.apple.com`, `*.notify.windows.com`, Mozilla) nicht geblockt.
- Ergebnis entscheidet: Minutentakt möglich → Bestellschluss-Warnung exakt;
  sonst 5-Minuten-Raster mit Fenster.

### Migration `011_push.sql`
- `push_subscriptions (id CHAR(16) PK, workspace_id, user_id CHAR(16),
  endpoint VARCHAR(500) UNIQUE, p256dh VARCHAR(200), auth VARCHAR(100),
  user_agent VARCHAR(200), created_at, last_success_at NULL,
  fail_count INT DEFAULT 0, FK workspace CASCADE, INDEX (workspace_id, user_id))`
- `push_outbox (id BIGINT AI PK, subscription_id CHAR(16), payload_json TEXT,
  created_at, sent_at NULL, attempts INT DEFAULT 0, last_error VARCHAR(200) NULL,
  INDEX (sent_at, created_at))`
- `sessions.deadline_notified_at DATETIME NULL`, `items.reminder_sent_at
  DATETIME NULL`

### Server
- Bibliothek `minishlink/web-push` via Composer (`server/composer.json`,
  `vendor/` im Deploy-Output). VAPID-Keys in `config.php` unter `push`.
- `server/api/push.php`: `PUT /push/subscription` `{ user_id, endpoint, keys }`
  (Upsert), `DELETE /push/subscription` `{ endpoint }`.
- `server/shared/push.php`: `enqueue_push(array $subscriptionIds, array
  $payload)` schreibt in `push_outbox`. Kein Versand im Request (Shared Hosting,
  Antwortzeit).
- Trigger:
  - `sessions_create` → alle Abos des Workspaces außer Ersteller:in:
    „Pizza Freitag bei Roma – bestellen bis 11:30".
  - Schließen (manuell oder `apply_housekeeping`) → Abos der Personen mit
    `due > 0`: „Bitte 6,50 € an Anna überweisen". Betrag serverseitig gerundet
    (Hinweis „ca." falls Rabatt), exakter Betrag in der App.
  - `paid: true` / `mark-paid` → Abos der betroffenen Person: „Anna hat deine
    Zahlung bestätigt".
- Cron `server/cron/push_tick.php` (jede Minute, CLI-only):
  1. Bestellschluss-Warnung: offene Sessions mit `deadline_at` in
     `[now+14m, now+16m]` und `deadline_notified_at IS NULL` → an bekannte
     Personen (60-Tage-Regel) ohne Eintrag und ohne Absage; Flag setzen.
  2. Erinnerung offene Beträge: geschlossene, nicht archivierte Sessions mit
     `closed_at <= now − 3 Tage`, Einträge `paid_at IS NULL AND
     payment_reported_at IS NULL AND reminder_sent_at IS NULL` → einmalig.
  3. Outbox versenden (max. 100 pro Lauf), `410/404` → Abo löschen,
     sonst `fail_count++`, ab 5 Fehlern löschen.
- Payload: `{ title, body, url, tag }`; `tag` verhindert Dubletten pro Session.

### Client
- `sw.js`: `push`-Handler (`showNotification`), `notificationclick` öffnet
  `url` (fokussiert vorhandenes Fenster).
- `lib/push.ts`: `subscribe(vapidPublicKey)`, `unsubscribe()`, Status.
- `ProfileMenu.tsx`: Schalter „Benachrichtigungen" mit Zuständen
  aus/an/vom Browser blockiert. Public Key kommt von `GET /push/config`.
- Hinweis nach der ersten Bestellung (gemeinsam mit Backup-Hinweis als kleine
  Checkliste: „Profil sichern", „Benachrichtigungen an", „App installieren").

### Randfälle
- iOS: Push nur in installierter PWA (iOS ≥ 16.4). Schalter zeigt den Hinweis.
- Ohne Cron-Minutentakt: Warnung „Bestellschluss in 15 min" kann bis zu 5 min
  früher/später kommen; Text dann „Bestellschluss um 11:30".

---

## Desktop & Mobile (siehe PLAN_PHASE1B_DESKTOP.md)
- Logo ersetzt den `brand-dot` im Header auf allen Breiten.
- Backup/Sync im Profilmenü: auf Desktop QR links, Erklärtext und Kopier-Knopf
  rechts; auf Mobile untereinander.
- Hinweis-Checkliste („Profil sichern", „Benachrichtigungen", „App
  installieren") als Karte in der Desktop-Seitenleiste, auf Mobile als Banner.

## Abnahme Phase 3
- PWA: installierbar auf Android/iOS/Desktop, Start vom Home-Bildschirm landet
  im richtigen Workspace, Offline-Hinweis.
- Sync: QR auf Gerät B scannen → gleiche `user_id`, „Dein Anteil" und Vorschläge
  stimmen; Rückfrage bei vorhandenem Profil.
- Push: Testnachricht aus Profilmenü, alle vier Ereignisse einmal ausgelöst,
  Outbox leer, ungültige Abos entfernt.
