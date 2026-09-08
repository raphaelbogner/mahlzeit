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

- **Logo/Icon-Auswahl** (Phase 3): Entwürfe liegen unter
  `client/public/icons/drafts/`, provisorisch wird Entwurf A verwendet.

## Phase 1b (Desktop)

- **Breakpoint-Logik per `matchMedia`** (`useMediaQuery`) statt reinem CSS, damit
  das Anlege-Formular und der Gericht-Editor nur einmal gerendert werden. Bei
  Fensterwechsel über 1024 px springt das Layout live um.
- **Gericht-Editor Desktop:** Der Einklapp-Knopf (▾) im geöffneten Editor ist
  auf Desktop wirkungslos, weil dort immer genau ein Gericht offen ist. Kann
  man später ausblenden (`DishEditor.tsx`, Prop `collapsed`).
- **Header-Höhe** als CSS-Variable `--header-h: 3.5rem` für die Sticky-Spalte.
  Wird der Header höher (z. B. Logo in Phase 3), Variable anpassen.
- **Startseite Desktop:** Formular „Neue Sammelbestellung" ist rechts immer
  offen, es gibt keinen Abbrechen-Knopf mehr dort.
