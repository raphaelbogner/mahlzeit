# Phase 2 – Geld

Stand: 2026-09-08. Baut auf Phase 1 (Menge, Bestellschluss, Teilen) und dem
Rabatt/Bezahlt-Badge aus Commit „add session discount…" auf.
Reihenfolge: **Archiv → Zahlungsstatus → Wer fehlt noch**, je ein Commit.
(Archiv zuerst, weil die Schulden-Anzeige archivierte Sessions ausschließen muss.)

---

## 6. Archiv

### Entscheidungen
- Automatisch archiviert wird **30 Tage nach `closed_at`**, wenn alle Einträge
  mit Preis bezahlt sind **oder** keine Einträge mit Preis existieren.
- Sessions, die **30 Tage nach `created_at` noch offen** sind, werden
  automatisch geschlossen (`auto_closed = 1`), danach gilt die normale Regel.
- **Manuell** archivieren dürfen **Ersteller:in und effektive Bezahler:in**,
  nur bei geschlossenen Sessions, mit Rückfrage wenn noch Beträge offen sind.
  Wiederherstellen ist möglich.
- UI: **eingeklappter Bereich unten** „Archiv (23) ▸" mit Suchfeld
  (Titel/Restaurant, diakritik-tolerant wie im DishPicker).
- **Keine Löschfrist** in dieser Phase.

### Migration `008_session_archive.sql`
- `sessions.archived_at DATETIME NULL AFTER auto_closed`
- `sessions.archived_by_user_id CHAR(16) NULL AFTER archived_at`
  (`NULL` bei automatischer Archivierung)
- Index `(workspace_id, archived_at)`

### Server (`server/api/sessions.php`)
- Neue Funktion `apply_housekeeping(int $workspaceId): void`, aufgerufen in
  `sessions_list` und `load_session_or_404` (ersetzt/erweitert
  `auto_close_due_sessions` aus Phase 1), drei Updates:
  1. Auto-Close bei abgelaufenem `deadline_at` (Phase 1).
  2. Auto-Close bei `status='open' AND created_at <= UTC_TIMESTAMP() - INTERVAL
     30 DAY` → `closed_at = UTC_TIMESTAMP()`, `auto_closed = 1`.
  3. Auto-Archiv: `status='closed' AND archived_at IS NULL AND closed_at <=
     UTC_TIMESTAMP() - INTERVAL 30 DAY AND NOT EXISTS (SELECT 1 FROM items i
     WHERE i.session_id = s.id AND i.price_cents IS NOT NULL AND i.paid_at IS
     NULL)` → `archived_at = UTC_TIMESTAMP()`, `archived_by_user_id = NULL`.
- PATCH: Feld `archived: true|false`. Erlaubt für Ersteller:in oder effektive
  Bezahler:in; `true` nur bei `status = 'closed'` (sonst 409 `SESSION_OPEN`).
  Setzt `archived_at`/`archived_by_user_id` bzw. beide auf `NULL`.
- Ausgabe: `archived_at`, `archived_by_user_id` in `format_session_row`.
- `sessions_list` liefert weiterhin alle Sessions; der Client teilt auf.

### Client
- Typen erweitern; `UpdateSessionInput.archived?: boolean`.
- `SessionList.tsx`: Aufteilung in aktiv/archiviert; neue Komponente
  `components/ArchiveSection.tsx` (Zustand „aufgeklappt" in localStorage,
  Suchfeld, gleiche Karten, Badge „Archiviert").
- `SessionDetail.tsx`: Knopf „Archivieren" (Ersteller:in/Bezahler:in, nur
  geschlossen). Wenn `offene Beträge > 0`: Inline-Rückfrage „Noch 4,20 € offen,
  trotzdem archivieren?". Bei archivierten Sessions Badge + „Wiederherstellen".
- `lib/archive.ts`: `isArchived(session)`, `filterArchive(sessions, query)`
  mit Tests.

---

## 5. Zahlungsstatus für alle

### Entscheidungen
- Schulden-Anzeige **im Header auf jeder Seite** (Pille neben dem Profil:
  „8,40 € offen", Klick öffnet Liste der betroffenen Sessions) **plus** Hinweis
  auf der Session-Karte („Dein Anteil: 4,20 € offen" / „gemeldet" /
  „✓ bezahlt"). Zählt nur **nicht archivierte** Sessions.
- **Zweistufig**: Mitbesteller meldet „Überwiesen" (gelb „gemeldet"),
  Bezahler:in bestätigt (grün „bezahlt").
- Bezahler:in kann **pro Person mit einem Klick** alle Einträge markieren;
  Einzel-Haken in den Zeilen bleiben.
- Rabatt bei Teilzahlung: **Dein Anteil = offene Einträge − voller
  Rabattanteil**, nie unter 0.

### Migration `009_item_payment_reported.sql`
- `items.payment_reported_at DATETIME NULL AFTER paid_at`

### Server
- `items.php` PATCH: neues Feld `reported: boolean`. Erlaubt für die
  Besitzer:in des Eintrags, nur wenn Session geschlossen und `paid_at IS NULL`.
  `true` → `payment_reported_at = UTC_TIMESTAMP()`, `false` → `NULL`.
  Bestehendes `paid: false` durch Bezahler:in setzt zusätzlich
  `payment_reported_at = NULL` (Zurücksetzen auf „offen").
- Neuer Endpunkt in `items.php`: `POST /sessions/{id}/items/mark-paid`
  `{ user_id, target_user_id, paid: boolean }` → Bezahler:in markiert alle
  Einträge einer Person (nur geschlossen). Antwort: aktualisierte Item-Liste.
- `sessions_list`: neuer optionaler Query-Parameter `?user_id=<16>`. Wenn
  gesetzt, enthält jede Session zusätzlich `person_totals:
  [{ user_id, user_name, total_cents, unpaid_cents, reported_cents }]`
  (Summen `price_cents × quantity`) für geschlossene Sessions mit Preisen.
  Damit rechnet der Client den Rabattanteil **exakt** mit derselben
  Largest-Remainder-Funktion wie in der Zusammenfassung (keine PHP-Kopie der
  Rundungslogik).
- `format_item_row`: `payment_reported_at`.

### Client
- `lib/aggregate.ts`: `distributeDiscount` so verallgemeinern, dass es auf
  `{ key, total_cents }[]` arbeitet (bleibt intern für `per_person` gleich).
- `lib/due.ts`: `computeMyDue(session, personTotals, myUserId)` →
  `{ gross, unpaid, discountShare, due, state: 'open'|'reported'|'paid'|'none' }`.
  Tests inkl. Teilzahlung, Rabatt, Zahler selbst (immer `none`).
- `hooks/useSessions.ts`: `user_id` mitschicken; `SessionSummary.person_totals?`.
- Neue Komponente `components/DuePill.tsx` im Header (`SessionsPage` und
  `SessionDetail` teilen sich den Header-Block; Pille rechts neben
  `ProfileMenu`). Dropdown listet Sessions mit Betrag und Link. Ausgeblendet,
  wenn `due = 0` überall.
- `SessionList.tsx`: Karten-Hinweis „Dein Anteil: … offen / gemeldet / ✓ bezahlt".
- `Summary.tsx`, Pro-Person-Liste:
  - Bezahler:in: Checkbox je Person (Sammel-Markierung via `mark-paid`),
    Status-Chip offen/gemeldet/bezahlt.
  - Mitbesteller: eigene Zeile mit Knopf „Ich habe überwiesen" (→ `reported`),
    danach „gemeldet – wartet auf Bestätigung", widerrufbar.
- `ItemRow.tsx`: Badge „gemeldet" (amber) neben „bezahlt".
- QR-Betrag (`myAmountCents`) nutzt `computeMyDue`.

### Randfälle
- Bezahler:in wechselt nach Meldungen: Meldungen bleiben, neue Bezahler:in sieht sie.
- Wiederöffnen einer Session setzt keine Zahlungsfelder zurück.

---

## 8. Wer fehlt noch

### Entscheidungen
- Bekannte Personen = alle `user_id`, die in den **letzten 60 Tagen** in
  irgendeiner Session des Workspaces einen Eintrag hatten (Name = jüngster).
- Anzeige im **Detail-Kopf, nur für Ersteller:in und Bezahler:in**:
  „Fehlt noch (3): Anna, Bob, Cem · Abgesagt (1): Dora".
- **„Erinnern"** teilt Text + Link (Phase-1-Teilen) an die Fehlenden.
- Mitbesteller können sich mit **„Heute nicht dabei"** austragen; Bestellen hebt
  die Absage automatisch auf.

### Migration `010_session_declines.sql`
- Tabelle `session_declines (session_id CHAR(16), user_id CHAR(16),
  user_name VARCHAR(120), declined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id, user_id), FK session ON DELETE CASCADE)`.

### Server (`server/api/participation.php`, neu)
- `GET /sessions/{id}/participation?user_id=<16>` (nur Ersteller:in oder
  effektive Bezahler:in, sonst 403):
  `{ known: [{ user_id, user_name }], ordered: [user_id], declined:
  [{ user_id, user_name }] }`. `known` aus `items JOIN sessions` der letzten
  60 Tage im Workspace, gruppiert nach `user_id`, Name aus dem jüngsten Eintrag.
- `PUT /sessions/{id}/decline` `{ user_id, user_name }` und
  `DELETE /sessions/{id}/decline` `{ user_id }`, nur solange offen.
- `items_create`: nach erfolgreichem Insert `DELETE FROM session_declines WHERE
  session_id = :sid AND user_id = :uid`.
- Session-GET liefert zusätzlich `my_declined: boolean`, wenn `?user_id=` gesetzt
  ist (für den Knopf-Zustand ohne Extra-Request).

### Client
- `api/participation.ts`, Typen.
- Neue Komponente `components/ParticipationPanel.tsx` (Detail-Kopf, nur
  berechtigte, nur offen): Listen + „Erinnern" (Text: „Hey Anna, Bob, Cem –
  Bestellschluss ist um 11:30, hier bestellen: <Link>", ohne Bestellschluss
  entsprechend gekürzt).
- `SessionDetail.tsx`: Knopf „Heute nicht dabei" für alle ohne eigene Einträge
  (Toggle), verschwindet sobald man bestellt.
- Polling (`useSession`, 5 s) aktualisiert `my_declined`; das Panel lädt
  `participation` bei jedem Poll mit (leichtgewichtig) oder alle 15 s.

---

## Desktop & Mobile (siehe PLAN_PHASE1B_DESKTOP.md)
- Archiv nutzt das Kartenraster der Startseite (`lg:grid-cols-2`).
- Schulden-Übersicht erscheint auf Desktop zusätzlich in der rechten
  Seitenleiste der Startseite; die Header-Pille bleibt auf allen Breiten.
- „Wer fehlt noch" und „Heute nicht dabei" sitzen im linken Kopfbereich des
  Details; die Pro-Person-Zahlungsaktionen in der sticky Zusammenfassung rechts.

## Abnahme Phase 2
- Migrationen `008`, `009`, `010`; `_verify.php` erweitert.
- `docs/api.http`: `archived`, `reported`, `mark-paid`, `?user_id=` an der
  Liste, `participation`, `decline`.
- Tests: `archive`, `due`, angepasste `aggregate`.
- Manuell nach Deploy: Auto-Archiv nach Datum (Testdaten mit altem `closed_at`),
  Zweistufen-Zahlung mit zwei Browsern, Header-Pille verschwindet bei 0.
