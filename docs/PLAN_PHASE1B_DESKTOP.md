# Phase 1b – Desktop-Layout

Stand: 2026-09-08. Wird **direkt nach Phase 1** umgesetzt, als eigene Phase mit
eigenem Commit je Seite. Phasen 2–4 bauen auf diesem Raster auf und denken
neue Screens von Anfang an **Desktop und Mobile parallel**.

## Grundsätze
- Mobile-Layout bleibt **unverändert**. Alle Änderungen greifen ab dem
  Tailwind-Breakpoint `lg` (1024 px).
- Maximale Inhaltsbreite **`max-w-6xl` (1152 px)**, zentriert.
- Zwei Spalten: Hauptspalte flexibel, Seitenspalte fest **360 px**
  (`lg:grid-cols-[minmax(0,1fr)_360px]`, `gap-8`).
- Seitenspalten sind **sticky** (`lg:sticky lg:top-[header] lg:max-h-[calc(100vh-…)]
  lg:overflow-y-auto`), scrollen also intern, wenn sie höher als das Fenster sind.
- Header (`.app-header-inner`) wächst auf dieselbe Breite mit.
- Keine Duplizierung von Komponenten: dieselben Komponenten werden in einem
  Raster angeordnet; nur Reihenfolge/Position ändert sich per CSS-Grid.

## CSS (`client/src/index.css`)
- `.page-container` und `.page-container-wide`: `lg:max-w-6xl`.
- Neue Utilities: `.layout-2col` (Grid wie oben), `.layout-main`,
  `.layout-side` (sticky-Verhalten), `.layout-side-inner` (Abstand zwischen
  gestapelten Karten).
- Header-Höhe als CSS-Variable `--header-h` für `top`/`max-h` der Seitenspalte.

## Session-Detail (`SessionDetail.tsx`)
- **Links:** Kopf (Titel, Restaurant, Bestellschluss-Badge, Wer fehlt noch
  [Phase 2], Aktionen Schließen/Löschen/Einladen), Einträge, „Eintrag
  hinzufügen" inkl. Vorschläge.
- **Rechts (sticky):** `Summary` komplett (Bestellungen, Pro Person, Gesamt,
  Rabatt, Bezahler:in-Auswahl, IBAN, QR).
- Auf Mobile bleibt die heutige Reihenfolge (Summary unten).
- Sehr lange Eintragslisten: Hauptspalte scrollt mit der Seite, Summary bleibt
  stehen.

## Startseite (`SessionsPage.tsx`, `SessionList.tsx`)
- **Links:** Session-Karten im **zweispaltigen Raster** ab `lg`
  (`lg:grid-cols-2`), darunter Archiv [Phase 2].
- **Rechts (sticky):** `CreateForm` dauerhaft geöffnet (kein Umschalt-Knopf ab
  `lg`), darunter Schulden-Übersicht [Phase 2] und Schnellzugriff
  „Restaurants", „Statistik" [Phase 4].
- Karten im Raster: gleiche Höhe je Zeile (`h-full`), Titel mit `line-clamp-2`
  statt `truncate`, damit Rasterkarten nicht abschneiden.

## Restaurant-Editor (`RestaurantEditor.tsx`, `DishEditor.tsx`)
- **Links (sticky):** Restaurantname, sortierbare Gerichteliste (`Sortable`),
  „+ Gericht", Speichern-Leiste.
- **Rechts:** Editor des **ausgewählten** Gerichts (Name, Preis, Kategorie,
  Beschreibung, vegetarisch, Optionsgruppen, Vorlagen).
- Neuer Zustand `selectedDishId` im Editor; Mobile zeigt weiterhin alle
  Gerichte untereinander (ausgeklappt wie heute), Desktop zeigt nur das
  gewählte rechts. Ungespeicherte Änderungen bleiben in beiden Modi erhalten
  (gleicher State, nur andere Darstellung).

## Neue Screens aus späteren Phasen (Vorgabe)
- **Statistik** [Phase 4]: Kennzahlen-Kacheln in einer Reihe (`lg:grid-cols-4`),
  darunter Balkenlisten in **zwei Spalten** (Top-Gerichte | Restaurants,
  Bezahler:innen | Personen). Mobile: alles untereinander.
- **Archiv** [Phase 2]: nutzt dasselbe Kartenraster wie die Liste.
- **Wer fehlt noch / Erinnern** [Phase 2]: im linken Kopfbereich des Details.
- **Profilmenü / Backup / Push** [Phase 3]: Dropdown bleibt, Inhalte in
  Abschnitten; QR und Erklärtext auf Desktop nebeneinander.
- **Admin-App**: nicht Teil dieser Phase (eigene Tabellenansicht, bereits breit
  genug).

## Reihenfolge und Commits
1. CSS-Grundlagen + Header-Breite + Session-Detail zweispaltig.
2. Startseite mit Raster und Seitenleiste.
3. Restaurant-Editor zweispaltig.

## Tests / Abnahme
- Keine Logikänderungen; Typecheck/Lint/Tests bleiben grün.
- Manuelle Prüfung in drei Breiten: 390 px (Mobile, unverändert), 1024 px
  (Umschaltpunkt, keine Überlappung), 1440 px (zentriert, 1152 px breit).
- Tastaturfokus-Reihenfolge auf Desktop bleibt logisch (links vor rechts).
- Sticky-Spalte scrollt intern bei kleinem Fensterhöhe (z. B. 700 px).
