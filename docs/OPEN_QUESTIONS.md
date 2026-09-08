# Offene Entscheidungen

Punkte, die während der autonomen Umsetzung (Phasen 1–4) entschieden werden
mussten und am Ende noch bestätigt oder geändert werden sollen. Jede Zeile:
was entschieden wurde, warum, und wo man es ändert.

## Phase 1

- **Menge im Eintrag anzeigen:** `2× Cola 5,00 € (2,50 €/Stk)`. Alternative
  wäre nur die Zeilensumme. Ändern in `ItemRow.tsx` (Preis-Span).
- **Stepper im Freitext-Formular** steht als eigener Block „Menge" unter dem
  Preis; im Picker links neben dem Endpreis. Ändern in `AddItemForm.tsx` /
  `DishPicker.tsx`.

## Später zu entscheiden (bewusst offen gelassen)

- **Logo/Icon-Auswahl** (Phase 3): **entschieden**, Entwurf A (Teller mit
  Besteck) ist final. Die übrigen Entwürfe bleiben als Referenz in
  `client/public/icons/drafts/`.

## Phase 1b (Desktop)

- **Breakpoint-Logik per `matchMedia`** (`useMediaQuery`) statt reinem CSS, damit
  das Anlege-Formular und der Gericht-Editor nur einmal gerendert werden. Bei
  Fensterwechsel über 1024 px springt das Layout live um.
- **Gericht-Editor Desktop:** Der Einklapp-Knopf (▾) im geöffneten Editor ist
  auf Desktop wirkungslos, weil dort immer genau ein Gericht offen ist. Kann
  man später ausblenden (`DishEditor.tsx`, Prop `collapsed`).
- **Breiten-Stufen:** lg 1152 px, xl 1280 px, 2xl 1440 px (Seitenspalte 360 → 440 px,
  Karten 2 → 3 Spalten). Mehr Breite bringt keinen Lesegewinn, daher Deckel bei 1440.
- **Header-Höhe** als CSS-Variable `--header-h: 3.5rem` für die Sticky-Spalte.
  Wird der Header höher (z. B. Logo in Phase 3), Variable anpassen.
- **Startseite Desktop:** Formular „Neue Sammelbestellung" ist rechts immer
  offen, es gibt keinen Abbrechen-Knopf mehr dort.

## Phase 3a (PWA, Sync)

- **Logo:** Fünf Entwürfe unter `client/public/icons/drafts/` (a-teller, b-lunchbox,
  c-wrap, d-bubble, e-teller-kreis). **A (Teller mit Besteck) ist final** (entschieden 2026-09-08). Umschalten:
  `cd client && node scripts/build-icons.mjs b` (dann Build). Das gewählte Logo
  ersetzt den orangen Punkt im Header der Startseite und auf der „Kein
  Workspace-Link“-Seite; `NameSetup` zeigt noch den Punkt.
- **`sharp`** ist als devDependency dazugekommen (nur für das Icon-Script).
- **Workspace-Token im localStorage** (`mahlzeit.workspace.v1`): nötig für den
  Start vom Home-Bildschirm. Konsequenz: Ein Gerät, das einmal einen Workspace
  geöffnet hat, landet ohne `?w=` automatisch wieder dort. Wechsel zu einem
  anderen Workspace funktioniert weiterhin über dessen Link.
- **Manifest ohne `start_url`:** Die installierte App startet mit der URL, auf der
  sie hinzugefügt wurde (inkl. `?w=`). Nötig für iOS, weil die Home-Bildschirm-App
  dort einen eigenen Speicher hat und den gemerkten Token nicht sieht. Android
  funktionierte auch vorher (gemeinsamer Speicher mit Chrome).
- **„Kein Workspace-Link“-Seite** hat ein Feld zum Einfügen eines Links als Notausgang.
- **Service Worker** cached nur App-Shell und Assets (kein API-Cache). Bei
  Deploys wird die Shell beim nächsten Online-Start aktualisiert.
- **Import-Link ohne vorhandenes Profil** wird ohne Rückfrage übernommen
  (Rückfrage nur, wenn schon ein anderes Profil da ist).
- **Hinweiskarte „Kurz einrichten“** erscheint im Detail, sobald man selbst
  einen Eintrag hat; einmal wegklickbar. Enthält Backup + Installieren (und ab
  3b Benachrichtigungen).

## Phase 3b (Push)

- **Push ist deployt, aber inaktiv**, bis `config.php` einen `push`-Abschnitt hat
  (VAPID-Schlüssel). Anleitung inkl. Hosting-Check: `docs/PUSH_SETUP.md`.
- **Nicht lokal verifizierbar** (kein PHP/Composer hier): `shared/push.php`,
  `api/push.php`, `cron/push_tick.php` sind gegen die dokumentierte API von
  `minishlink/web-push` ^9 geschrieben und per Review geprüft. Erster echter
  Test = Schritt 6 in `PUSH_SETUP.md`.
- **Versand nur per Cron** (Outbox). Ausnahme: die Testnachricht aus dem
  Profilmenü wird sofort zugestellt.
- **Bestellschluss-Warnung** trifft bei Minuten-Cron exakt 15 min vorher,
  bei 5-Minuten-Cron bis zu 5 min früher.
- **Zeitzone** für Uhrzeiten in Push-Texten: `push.timezone` in `config.php`
  (Standard `Europe/Vienna`).
- **Erinnerung „noch offen“** kommt einmalig 3 Tage nach dem Schließen, nur für
  Einträge, die weder bezahlt noch gemeldet sind.

## Phase 4 (Favoriten, Statistik)

- **Schnellauswahl** zeigt maximal 6 Karten (Favoriten zuerst, dann letzte
  Bestellungen). Konstante `MAX_QUICK_PICKS` in `lib/quickPicks.ts`.
- **Favorit mit Optionsgruppen** öffnet den Picker mit Standardauswahl statt
  direkt hinzuzufügen (Preis zeigt „ab …“).
- **Statistik „Ausgaben pro Person“** ist *netto*: der Rabatt jeder Session
  wird anteilig auf die Besteller umgelegt (gleiche Rundung wie in der
  Zusammenfassung, `stats_split_discount()` in `stats.php`).
- **Statistik zählt nur geschlossene Sessions**, offene fließen nirgends ein.
- **Link „Statistik“** nur im Header der Startseite (Restaurant-Seiten haben
  weiterhin nur den Zurück-Link).

## Deploy-Checkliste (alle Phasen)

1. Migrationen in Reihenfolge per phpMyAdmin: `005` … `012`
   (`server/migrations/*.sql`, alle idempotent).
2. `deploy/build.sh`, Inhalt von `deploy/output/` hochladen.
3. Push optional: `docs/PUSH_SETUP.md` (Composer, VAPID, Cron).
4. Nach dem ersten Aufruf prüfen: Auto-Close/Archiv greifen beim ersten
   Request, Header-Pille erscheint nur bei offenen Beträgen.

## Bekannte Altlasten (nicht angefasst)

- 5 bestehende ESLint-Fehler (`react-refresh/only-export-components` in
  `Toast.tsx`, `WorkspaceLink.tsx`, `useProfile.tsx`; `set-state-in-effect`
  in `useProfile.tsx`). Waren vor dieser Arbeit da, blockieren nichts.
