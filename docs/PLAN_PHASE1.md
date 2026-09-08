# Phase 1 – Alltag

Stand: 2026-09-08. Entscheidungen wurden gemeinsam getroffen, nichts ist angenommen.
Reihenfolge und Paketierung: **Menge → Bestellschluss → Wiederbestellung → Teilen**,
je Feature ein Commit mit grünen Tests.

Rahmenbedingungen für alle Phasen:

- Kein lokaler PHP/MySQL-Stack. Server-Code wird per Review geprüft, jeder neue
  Endpunkt bekommt Beispiel-Requests in `docs/api.http`. Client wird mit
  `tsc -b`, `eslint` und `vitest` verifiziert. Migrationen laufen erst beim
  Deploy (`php server/migrations/_run.php <nr>`).
- Migrationen sind idempotent nach dem Muster von `001`/`005`
  (INFORMATION_SCHEMA-Check + PREPARE/EXECUTE).
- Konventionen aus `CLAUDE.md` gelten (strict TS, PDO prepared, reject unknown
  fields, Snapshots in items, Workspace-Filter überall).

---

## 7. Menge pro Eintrag

### Entscheidungen
- `quantity` als eigene Spalte, **Stückpreis bleibt in `price_cents`**,
  Zeilensumme = `price_cents × quantity`.
- Einstellbar beim Hinzufügen (Picker und Freitext) **und** nachträglich in der
  Eintrag-Zeile (Besitzer:in, solange offen). Maximum **20**.
- Wiederbestell-Vorschläge übernehmen die damalige Menge.

### Migration `006_item_quantity.sql`
- `items.quantity INT NOT NULL DEFAULT 1 AFTER price_cents`

### Server (`server/api/items.php`, `server/api/sessions.php`)
- POST `/sessions/{id}/items`: neues optionales Feld `quantity` (int, 1–20,
  Standard 1) in beiden Varianten (Freitext + strukturiert). Allowlist erweitern.
- PATCH `/sessions/{id}/items/{itemId}`: `quantity` (1–20) durch Besitzer:in,
  nur solange die Session offen ist. Gilt auch für strukturierte Einträge
  (bisher dort nur `note`).
- `format_item_row`: `quantity` ausgeben (int, Fallback 1).
- `sessions_list`: `total_cents = SUM(price_cents * quantity)`.
- `parse_quantity(array $body): int` als Helfer neben `parse_optional_price_cents`.

### Client
- Typen: `Item.quantity: number`; `AddFreeTextItemInput`,
  `AddStructuredItemInput`, `UpdateItemInput` bekommen `quantity?: number`.
- Neue Komponente `components/QuantityStepper.tsx` (`[− 1 +]`, min 1, max 20,
  Tastatur-eingabe erlaubt, aria-Labels).
- `DishPicker.tsx` und `FreitextItemForm` (in `AddItemForm.tsx`): Stepper neben
  dem Hinzufügen-Knopf, Endpreis zeigt `Menge × Stückpreis = Summe`.
- `ItemRow.tsx`: Anzeige `2× Cola 2,50 € = 5,00 €` wenn `quantity > 1`; im
  Bearbeiten-Modus Stepper (für beide Eintragsarten).
- `lib/aggregate.ts`: `count` summiert Mengen; `total_cents` und Pro-Person-
  Summen rechnen `price × quantity`; `unit_price_cents` bleibt Stückpreis.
  Rabattverteilung unverändert (arbeitet auf Summen).
- `Summary.tsx`: `myAmountCents` rechnet `price × quantity`.
- `renderSummaryText`: `- 3× Cola — 2,50 €/Stk · 7,50 € (Anna, Ben)`.

### Tests
- `aggregate.test.ts`: Menge in Zeilen, Pro-Person, Rabatt mit Mengen.
- `QuantityStepper`: Grenzen 1/20, Eingabe von Unsinn wird auf gültigen Wert
  geklemmt.

### Randfälle
- Alte Einträge haben `quantity = 1` und verhalten sich wie bisher.
- Bezahlt-Haken gilt weiter für die ganze Zeile.

---

## 2. Bestellschluss als Zeitpunkt + Auto-Schließen

### Entscheidungen
- Neue Spalte `deadline_at` (Zeitpunkt, UTC). **Freitext `deadline` bleibt** und
  wird nur noch bei alten Sessions angezeigt (ohne Countdown/Auto-Schließen).
- Eingabe: **Schnellwahl-Chips** (`+30 min`, `+1 h`, `11:30`, `12:00`) plus
  Uhrzeit-Feld, Datum „Heute/Morgen" umschaltbar.
- Auto-Schließen **beim nächsten Zugriff** (kein Cron), markiert als
  `auto_closed`. Anzeige „automatisch geschlossen um 11:30".
- Wiederöffnen **löscht** den Bestellschluss (und das Auto-Flag).
- Countdown relativ: „Bestellschluss in 42 min" / „um 11:30"; **orange ab
  15 min, rot ab 5 min**.
- Nachträglich ist **nur der Bestellschluss** bearbeitbar (Ersteller:in, solange
  offen). Titel und Restaurant bleiben fix.

### Migration `007_session_deadline_at.sql`
- `sessions.deadline_at DATETIME NULL AFTER deadline`
- `sessions.auto_closed TINYINT(1) NOT NULL DEFAULT 0 AFTER closed_at`
- Index `(workspace_id, status, deadline_at)` für den Auto-Close-Update.

### Server (`server/api/sessions.php`)
- POST/PATCH: Feld `deadline_at` (ISO-8601 mit `Z` oder `null`). Validierung:
  parsebar, bei POST und beim Setzen per PATCH muss der Zeitpunkt in der Zukunft
  liegen (sonst 400 `INVALID_FIELD`). Gespeichert als UTC `DATETIME`.
- Neue Funktion `auto_close_due_sessions(int $workspaceId): void`:
  `UPDATE sessions SET status='closed', closed_at=deadline_at, auto_closed=1
  WHERE workspace_id=:wid AND status='open' AND deadline_at IS NOT NULL AND
  deadline_at <= UTC_TIMESTAMP()`. Aufruf am Anfang von `sessions_list` und
  `load_session_or_404`. Damit greift auch `items_create` (409 `SESSION_CLOSED`).
- PATCH `status: 'open'` setzt zusätzlich `deadline_at = NULL`,
  `auto_closed = 0`, `closed_at = NULL`.
- PATCH `status: 'closed'` manuell: `auto_closed = 0`.
- Ausgabe in `format_session_row`: `deadline_at` (ISO mit `Z` oder `null`),
  `auto_closed` (bool).

### Client
- Typen: `deadline_at: string | null`, `auto_closed: boolean`;
  `CreateSessionInput`/`UpdateSessionInput` bekommen `deadline_at?`.
- Neue Komponente `components/DeadlinePicker.tsx`: Chips, Datum-Toggle,
  `<input type="time">`; liefert `Date | null`. Chips relativ zu „jetzt",
  feste Uhrzeiten beziehen sich auf das gewählte Datum; liegt die Zeit heute
  schon in der Vergangenheit, springt das Datum auf morgen.
- `lib/deadline.ts`: `formatDeadline(deadlineAt, now)`, `deadlineUrgency()`
  (`'none' | 'soon' | 'critical' | 'passed'`), `isPast()`. Vollständig getestet.
- Neue Komponente `components/DeadlineBadge.tsx`: nutzt `lib/deadline`,
  aktualisiert sich alle 30 s, Farben nach Dringlichkeit. Bei
  `status === 'closed' && auto_closed`: „automatisch geschlossen um 11:30".
- `CreateForm.tsx`: Freitext-Feld durch `DeadlinePicker` ersetzt
  (`deadline` wird nicht mehr gesendet).
- `SessionDetail.tsx`: Badge im Kopf; für Ersteller:in „Ändern" öffnet den
  `DeadlinePicker` inline (PATCH `deadline_at`). Läuft der Countdown auf 0,
  wird sofort `refresh()` ausgelöst und das Formular deaktiviert, bis der
  Server den Status liefert.
- `SessionList.tsx`: kompakte Badge auf der Karte statt `· bis <text>`; alte
  Sessions mit nur Freitext zeigen weiterhin den Text.

### Tests
- `lib/deadline.test.ts`: Formatierung, Dringlichkeitsstufen, Grenzwerte
  (15:00 → soon, 5:00 → critical, 0 → passed), Zeitzonen-neutral (UTC-Eingabe).
- `DeadlinePicker`: Chip `+30 min` erzeugt korrekte Zeit, feste Uhrzeit in der
  Vergangenheit springt auf morgen.

### Randfälle
- Client-Uhr falsch: Server entscheidet; Client zeigt beim Poll den echten Status.
- Session mit `deadline_at` in der Vergangenheit beim Wiederöffnen: durch das
  Löschen der Deadline kein sofortiges Zuschnappen.
- `docs/api.http`: Beispiele für Anlegen mit `deadline_at`, PATCH, Wiederöffnen.

---

## 1. Wiederbestellung („Zuletzt hier bestellt")

### Entscheidungen
- Nur bei **verknüpftem Restaurant** (`restaurant_id` identisch). Freitext-
  Restaurants bekommen keine Vorschläge.
- Dedup nach **Gericht + Optionen, Notiz ignoriert**; die zuletzt verwendete
  Notiz wird mitgegeben. Maximal **3** Vorschläge, **neueste zuerst**,
  **kein Zeitlimit**.
- Auch **Freitext-Einträge** werden vorgeschlagen und 1:1 wieder angelegt.
- Klick: **direkt hinzufügen**; wenn Gericht/Option nicht mehr passt → Picker
  vorbefüllen mit Hinweis. Gericht gelöscht → Karte ausgegraut „nicht mehr im
  Menü".
- Anzeige **über dem Picker, solange offen**, auch nach eigener Bestellung.
- Karte zeigt Gericht, Optionen, Notiz, **aktuellen Preis** (live aus Menü),
  „zuletzt 03.09.", Menge falls > 1.
- Menge wird aus der letzten Bestellung übernommen.

### Server (`server/api/suggestions.php`, neu; Route in `server/api/index.php`)
- `GET /sessions/{id}/suggestions?user_id=<16>`
  - Lädt Session (Workspace-Filter). Ohne `restaurant_id` → `{ suggestions: [] }`.
  - Query: `items i JOIN sessions s ON s.id = i.session_id WHERE s.workspace_id
    = :wid AND s.restaurant_id = :rid AND s.id <> :sid AND i.user_id = :uid
    ORDER BY i.added_at DESC LIMIT 200`.
  - Dedup in PHP: Schlüssel = `dish_id ?? 'ft:' . dish` + sortierte Option-
    Tupel `(group,name)`. Erste Vorkommnisse (= neueste) gewinnen, Abbruch bei 3.
  - Antwort je Vorschlag: `{ kind: 'structured'|'freetext', dish_id, dish,
    options, note, quantity, price_cents (historisch), last_ordered_at,
    times_ordered }`.
- Kein Schreiben, keine Migration. `docs/api.http` ergänzen.

### Client
- `api/suggestions.ts`, Typ `ReorderSuggestion` in `types/api.ts`.
- `hooks/useSuggestions.ts`: lädt einmal pro Session/User, kein Polling.
- `lib/suggestions.ts`: `resolveSuggestion(dishes, suggestion)` →
  `{ status: 'exact' | 'partial' | 'missing', dishId, optionIds, currentPriceCents }`.
  Optionen werden über `group.name + option.name` im aktuellen Menü aufgelöst;
  `single`-Gruppen ohne Treffer nehmen `defaultSelection`, dann `partial`.
- Neue Komponente `components/ReorderSuggestions.tsx`: Kartenreihe
  „Zuletzt hier bestellt", nutzt `categoryEmoji` (aus `DishPicker` exportieren).
  - `exact` → `addStructuredItem` mit `quantity`, `note` → `onAdded`, Toast
    „Hinzugefügt".
  - `partial` → `onPrefill({ dishId, optionIds, note, quantity })`, Toast
    „Gericht hat sich geändert, bitte prüfen".
  - `missing` → Karte deaktiviert mit Hinweis.
  - `freetext` → `addFreeTextItem` mit `dish`, `note`, `price_cents`, `quantity`.
- `DishPicker.tsx`: neue optionale Prop `prefill` (mit `key`, damit
  gleicher Vorschlag zweimal greift); setzt Gericht, Auswahl, Notiz, Menge und
  scrollt zum Formular.
- `AddItemForm.tsx`: rendert `ReorderSuggestions` über dem Picker, wenn
  `restaurantId` gesetzt und Session offen; reicht `prefill` durch.

### Tests
- `lib/suggestions.test.ts`: exact/partial/missing, Optionsauflösung über
  Namen, Preisberechnung aus aktuellem Menü, Freitext-Durchreichung.

### Randfälle
- Gleicher Name, andere `user_id` (zweites Gerät ohne Sync): keine Vorschläge,
  bis Phase 3 (Geräte-Sync) da ist.
- Restaurant später umbenannt/gelöscht: `restaurant_id` bleibt, Vorschläge
  bleiben; bei gelöschtem Restaurant ist `restaurant_id` `NULL` → keine.

---

## 4. Teilen

### Entscheidungen
- Geteilt wird **Text + Session-Link** (Link enthält den Workspace-Token, das
  ist bewusst so, wie heute schon eingeladen wird).
- Drei Stellen: **offen** „Zum Mitbestellen einladen" (Detail-Kopf),
  **geschlossen** „Zahlungsübersicht teilen" (Zusammenfassung),
  **Liste** „Workspace-Link teilen".
- Kanäle: **System-Teilen** (`navigator.share`) mit **Kopieren** als Fallback.
  Keine WhatsApp/Teams/E-Mail-Spezialknöpfe.

### Client
- `lib/share.ts`:
  - `buildSessionUrl(sessionId, token)` → `${origin}/w/s/${id}?w=${token}`
    (Aufbau analog `WorkspaceLink`).
  - `buildInviteText({ title, restaurant_name, deadline_at, url })`:
    „🍽️ Sammelbestellung „Pizza Freitag" bei Roma – bestellen bis 11:30:
    <url>".
  - `buildPaymentText({ summaryText, url })`: bestehender
    `renderSummaryText` + Leerzeile + „Details & QR: <url>".
  - `buildWorkspaceInviteText({ url })`.
  - `shareOrCopy({ title, text }): Promise<'shared' | 'copied' | 'failed'>`:
    `navigator.share` wenn vorhanden und `canShare`, sonst Clipboard
    (bestehende Fallback-Logik aus `Summary.handleCopy` hierher verschieben).
- Neue Komponente `components/ShareButton.tsx` (Label, Text-Builder, Toast).
- `SessionDetail.tsx`: Knopf „Einladen" im Kopf, nur wenn offen.
- `Summary.tsx`: „Teilen" neben „Text kopieren", nur wenn geschlossen.
- `SessionsPage.tsx`: „Workspace-Link teilen" im Kopf.

### Tests
- `lib/share.test.ts`: URL-Aufbau, Texte mit/ohne Restaurant und Bestellschluss,
  Fallback-Logik (Share nicht verfügbar → copied).

---

## Abnahme Phase 1
- Alle vier Features mit `tsc -b`, `eslint`, `vitest` grün.
- `docs/api.http` enthält: Item mit `quantity`, PATCH `quantity`, Session mit
  `deadline_at`, PATCH `deadline_at`, Wiederöffnen, `GET …/suggestions`.
- Migrationen `006`, `007` liegen bereit; `_verify.php` zeigt die neuen Spalten.
- Nach Deploy manuell prüfen: Auto-Schließen beim ersten Aufruf nach Ablauf,
  Vorschläge nach zweiter Session beim gleichen Restaurant, Teilen am Handy.
