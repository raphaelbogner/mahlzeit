# Phase 4 – Fun

Stand: 2026-09-08. Reihenfolge: **Favoriten → Statistik**, je ein Commit.

---

## 10. Favoriten

### Entscheidungen
- Gespeichert **am Server, pro `user_id` und Gericht**, gelten auf allen
  Geräten mit demselben Profil.
- Im DishPicker **eine Reihe „Deine Schnellauswahl"**: Favoriten (mit Herz)
  zuerst, danach die Wiederbestell-Vorschläge aus Phase 1, ohne Dubletten
  (gleiche `dish_id` erscheint nur einmal, Favorit gewinnt).
- Klick auf Favorit: Gericht ohne Optionsgruppen → direkt hinzufügen; mit
  Optionsgruppen → Picker vorbefüllt (Standardauswahl), Menge 1.

### Migration `012_dish_favorites.sql`
- `dish_favorites (workspace_id BIGINT UNSIGNED, user_id CHAR(16),
  dish_id CHAR(16), created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, dish_id), FK dish ON DELETE CASCADE,
  FK workspace ON DELETE CASCADE, INDEX (workspace_id, user_id))`

### Server (`server/api/favorites.php`, neu)
- `GET /favorites?user_id=<16>&restaurant_id=<16>` → `{ dish_ids: [...] }`
  (Workspace-Filter über `dishes JOIN restaurants`).
- `PUT /favorites/{dish_id}` `{ user_id }`, `DELETE /favorites/{dish_id}`
  `{ user_id }`. Gericht muss zum Workspace gehören (404 sonst).

### Client
- `api/favorites.ts`, `hooks/useFavorites.ts` (pro Restaurant, optimistisches
  Umschalten mit Rollback bei Fehler).
- `DishPicker.tsx`: Herz-Knopf auf jeder Gerichtkarte (`aria-pressed`),
  Filter-Chip „♥ Favoriten" in der Kategorieleiste, wenn mindestens einer
  existiert.
- `ReorderSuggestions.tsx` wird zu `QuickPicks.tsx`: nimmt Favoriten +
  Vorschläge, dedupliziert, rendert eine Reihe. Herz-Karten zeigen aktuellen
  Basispreis („ab 9,00 €" bei Optionsgruppen).
- `lib/quickPicks.ts`: `mergeQuickPicks(favorites, suggestions)` mit Tests.

---

## 11. Statistik

### Entscheidungen
- **Eigene Route `/statistik`**, Link im Header neben „Restaurants", für alle
  im Workspace sichtbar. Archivierte Sessions zählen mit.
- Zeitraum umschaltbar: **30 Tage / laufendes Jahr / gesamt**.
- Inhalte: **Top-Gerichte** (Workspace und pro Person), **Restaurant-Ranking**
  (Anzahl Sessions **und Gesamtausgaben je Restaurant**),
  **Bezahler:innen-Ranking**, **Gesamtausgaben pro Person und Workspace**.
- Der Admin-Bereich bleibt unberührt (liest weiterhin keine Bestellinhalte);
  die Statistik ist ein Workspace-Endpunkt.

### Server (`server/api/stats.php`, neu)
- `GET /stats?range=30d|year|all&user_id=<16>` (user_id nur für „deine
  Top-Gerichte"). Alle Summen `price_cents × quantity`, Rabatte werden auf
  Session-Ebene abgezogen (`total − discount`).
  ```
  {
    range, from, to,
    totals: { sessions, items, spend_cents, discount_cents },
    top_dishes: [{ dish, count, spend_cents }],          // Top 10, nach Name
    my_top_dishes: [{ dish, count }],                    // Top 5
    restaurants: [{ restaurant_name, sessions, spend_cents }],
    payers: [{ user_name, sessions_paid, received_cents }],
    persons: [{ user_name, spend_cents, items }]
  }
  ```
- Gruppierung nach Namen (Snapshots), damit gelöschte Gerichte/Restaurants
  weiter zählen. Bezahler:in = `paid_by_user_name` bzw. `creator_name`.
- Nur geschlossene Sessions zählen für Ausgaben; offene fließen in „sessions"
  nicht ein.

### Client
- `api/stats.ts`, Typen, `hooks/useStats(range)`.
- Route `/statistik` in `App.tsx`, Link im Header (`SessionsPage`, `SessionDetail`).
- Neue Komponente `components/StatsPage.tsx` mit Umschalter (Segmented Control)
  und Karten:
  - Kennzahlen-Kacheln (Sessions, Ausgaben, Rabatte gespart).
  - Balkenlisten (CSS, keine Chart-Bibliothek): Top-Gerichte, Restaurants mit
    zwei Werten (Sessions, Ausgaben), Bezahler:innen, Personen.
  - „Deine Top 5" hervorgehoben.
- `lib/stats.ts`: `formatRange`, `barWidth(value, max)`; Tests.

### Randfälle
- Leerer Zeitraum → freundlicher Leerzustand.
- Namen doppelt (zwei Personen gleicher Name) werden zusammengeführt; Hinweis
  im Plan, bewusst akzeptiert (wie in der Zusammenfassung).

---

## Desktop & Mobile (siehe PLAN_PHASE1B_DESKTOP.md)
- Statistik: Kennzahlen in einer Reihe (`lg:grid-cols-4`), Balkenlisten in zwei
  Spalten (Top-Gerichte | Restaurants, Bezahler:innen | Personen); Mobile
  untereinander. Umschalter 30 Tage / Jahr / gesamt oben rechts bzw. oben.
- Schnellauswahl (Favoriten + Vorschläge) auf Desktop als Kartenreihe mit bis
  zu 4 sichtbaren Karten, auf Mobile horizontal scrollbar.

## Abnahme Phase 4
- Migration `012`; `docs/api.http` mit `favorites` und `stats`.
- Favorit auf Gerät A gesetzt, auf Gerät B (Sync) sichtbar.
- Statistik-Werte stichprobenartig gegen Zusammenfassungen einzelner Sessions
  geprüft (Summe der Session-Netto-Beträge = Ausgaben im Zeitraum).
