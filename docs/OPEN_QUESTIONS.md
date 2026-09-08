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
