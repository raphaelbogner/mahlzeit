# Mahlzeit — Claude Code Sessions

Diese Datei enthält die Prompts für jede Phase. Pro Session **einen** Prompt kopieren, einfügen, laufen lassen, danach selbst testen, dann erst zur nächsten gehen.

**Vor jeder Session:**
- Stelle sicher, dass du im Repo-Root bist (`cd mahlzeit`)
- Erstelle einen neuen Branch: `git checkout -b phase-X-name`
- Starte Claude Code

**Nach jeder Session:**
- Selbst testen (siehe „Was du danach prüfst" pro Phase)
- `git add . && git commit -m "Phase X: <kurze Beschreibung>"`
- Zurück zu main mergen oder Branch behalten — wie du magst

---

## Phase 0 — Setup

```
Read PLAN.md and CLAUDE.md before doing anything.

Then execute Phase 0 — Setup from PLAN.md section 7. Specifically:

1. Create .gitignore with: node_modules, dist, dist-admin, config.php, .env
2. Create the client/ subdirectory using Vite's React-TS template. Configure
   vite.config.ts with base: '/w/'.
3. Create the admin/ subdirectory using Vite's React-TS template. Keep the
   default base: '/'.
4. Install and configure Tailwind CSS in both projects. Use the standard
   Tailwind setup (tailwind.config.js, postcss, content globs pointing to
   src/**/*.{ts,tsx}).
5. Install and configure ESLint and Prettier in both projects with the
   conventions from CLAUDE.md.

Stop after Phase 0 is complete. Do NOT start Phase 1.

Confirm at the end that:
- `cd client && npm run dev` works
- `cd admin && npm run dev` works
- Both apps render the default Vite welcome page
```

**Was du danach prüfst:**
- `cd client && npm run dev` startet ohne Fehler, du siehst die Vite-Welcome-Page
- `cd admin && npm run dev` startet ohne Fehler
- ESLint läuft: `npm run lint` (oder das Äquivalent) gibt keinen Fehler
- `.gitignore` ist da und enthält die genannten Einträge

---

## Phase 1 — Backend Workspace-API

```
Read PLAN.md and CLAUDE.md before doing anything. Also look at the current
state of the repo to understand what's there.

Then execute Phase 1 — Backend Workspace-API from PLAN.md section 7.
Specifically:

1. Create server/schema.sql with all 7 tables from section 3.
2. Create server/shared/db.php as a PDO singleton that reads config from
   config.php (which lives outside the repo).
3. Create server/api/auth.php with require_workspace() that validates the
   token from header X-Workspace-Token or query param ?w=.
4. Create server/api/http.php with json_response(), error_response(),
   read_json_body() helpers.
5. Create server/api/index.php as the front controller for /api/* routes.
6. Implement server/api/sessions.php with all 5 session endpoints from
   section 4.
7. Implement server/api/items.php with the 3 item endpoints — FREITEXT
   variant only. The structured (dish_id) variant comes in Phase 3.5.
8. Create server/seed.php that creates an initial admin user (read username
   and password from CLI args or interactively).
9. Create docs/api.http with example requests for every workspace endpoint
   I just built. Use the REST Client format that VS Code understands.
10. Create a config.php.example in the repo root showing the expected
    structure (DB credentials, no real values).

For testing during development, since there's no admin UI yet to create
workspaces: include a comment in seed.php showing how to manually INSERT
a test workspace via SQL, or add a temporary --create-test-workspace
flag.

Stop after Phase 1 is complete. Do NOT start Phase 1.5.
```

**Was du danach prüfst:**
- `schema.sql` läuft auf einer lokalen MySQL ohne Fehler durch
- Du legst manuell eine Test-Workspace per SQL an (siehe Hinweis im Prompt)
- Mit `curl` oder dem VS-Code REST-Client gehst du `docs/api.http` durch:
  - Session anlegen, abrufen, ändern, löschen
  - Item hinzufügen (Freitext mit Preis), ändern, löschen
- Alle prepared statements verwendet (keine SQL-Injection-Möglichkeit)
- Bei ungültigem Token kommt 401 zurück

---

## Phase 1.5 — Admin-Bereich

```
Read PLAN.md and CLAUDE.md before doing anything. Look at the current state
of the repo.

Then execute Phase 1.5 — Admin-Bereich from PLAN.md section 7. This phase
has both backend and frontend parts.

BACKEND first:

1. server/admin/auth.php: require_admin() with PHP sessions. Use HttpOnly,
   Secure, SameSite=Strict cookie flags. Custom session name.
2. server/admin/workspaces.php: implement all admin endpoints from section 4
   (GET list with stats, POST, GET detail with active_users, PATCH, rotate,
   DELETE).
3. server/admin/index.php as front controller for /admin/api/*.
4. CSRF protection: token issued at login, required as X-CSRF-Token header
   on all state-changing requests. Standard double-submit pattern.
5. Rate limiting on /admin/api/login (5 attempts per 15 minutes per IP).
   Simple table or session-based, your choice.
6. Add admin examples to docs/api.http.

FRONTEND (admin/ project):

7. admin/src/api/client.ts: fetch wrapper with credentials: 'include',
   automatic CSRF header injection.
8. admin/src/api/auth.ts and admin/src/api/workspaces.ts.
9. admin/src/hooks/useAuth.ts: tracks login state, calls GET /admin/api/me
   on mount.
10. admin/src/components/LoginForm.tsx
11. admin/src/components/WorkspaceList.tsx (table with name, session count,
    last activity, actions).
12. admin/src/components/CreateWorkspaceForm.tsx — after creation, prominently
    display the share URL (https://domain/w/?w=<token>) with a copy button.
13. admin/src/components/WorkspaceDetail.tsx — stats + activity list with
    explanatory hint text from PLAN.md section 10.
14. admin/src/components/ConfirmDialog.tsx for destructive actions.
15. admin/src/App.tsx: routes /login, /, /workspaces/:id. Redirect to login
    if not authenticated. Default route is login.

Important UX:
- Token rotation: warn that the old link will stop working
- Workspace deletion: require typing the workspace name to confirm
- The activity list MUST be labeled "Aktive Nutzer" with the explanation
  that it's based on activity, not membership

Stop after Phase 1.5 is complete.

Confirm at the end:
- I can run `cd admin && npm run dev` and see the login page
- After running seed.php to create an admin user, I can log in
- I can create a workspace, see the share URL, copy it
- I can see the workspace detail with stats and activity list
- I can rotate the token and delete the workspace
```

**Was du danach prüfst:**
- `seed.php` ausführen, Admin-User anlegen
- Im Admin-Frontend einloggen
- Workspace anlegen, Share-URL sehen
- Login-Versuche mit falschem Passwort werden nach 5× rate-limited
- CSRF: ohne Token schlägt POST/PATCH/DELETE mit 403 fehl
- Token-Rotation: alter Token gibt 401 zurück bei Workspace-API
- Workspace-Löschen mit Namens-Bestätigung funktioniert

---

## Phase 2 — Frontend Workspace: Grundgerüst

```
Read PLAN.md and CLAUDE.md before doing anything. Look at the current repo.

Then execute Phase 2 — Frontend Workspace: Grundgerüst und Profil from
PLAN.md section 7. Specifically:

1. client/src/lib/ids.ts (generateId) with tests
2. client/src/lib/iban.ts (mod-97 validation, formatting) with tests covering
   real and invalid IBANs from AT and DE
3. client/src/lib/price.ts (parsePrice "9,50" / "9.50" / "9,50 €", fmtPrice
   with de-AT locale) with tests
4. client/src/lib/aggregate.ts (group by case-insensitive dish name) with tests
5. client/src/types/api.ts: TypeScript interfaces mirroring the FULL backend
   JSON shape from section 4 — including types for restaurants, dishes, option
   groups, options, and items with options. We won't use them all yet but
   define them now to avoid churn later.
6. client/src/api/client.ts: fetch wrapper that reads the token from the
   URL (?w=) and attaches X-Workspace-Token header. Throws typed
   ApiError on failure.
7. client/src/hooks/useProfile.ts: localStorage-backed user_id, user_name,
   iban
8. client/src/components/NameSetup.tsx: name + optional IBAN with validation
9. client/src/App.tsx: token check, routing skeleton with React Router for
   /, /s/:id, /restaurants, /restaurants/:id. If no profile yet, show
   NameSetup; otherwise show the matching route.

All exported functions and component props get explicit types per CLAUDE.md.
Run vitest at the end to confirm all helper tests pass.

Stop after Phase 2.
```

**Was du danach prüfst:**
- `npm run test` (Vitest) → alle Tests grün
- `cd client && npm run dev`, App lädt unter `http://localhost:5173/w/?w=<token>` (du musst lokal noch einen Token haben — entweder aus Phase 1.5 oder per SQL)
- Ohne Token: ordentliche Fehlermeldung
- Mit Token, kein Profil: NameSetup zeigt sich
- Nach Profil-Save: localStorage hat user_id, user_name, ggf. iban
- IBAN-Validierung: gültige akzeptiert, ungültige abgelehnt

---

## Phase 3 — Workspace: Sessions (Freitext)

```
Read PLAN.md and CLAUDE.md before doing anything. Look at the current repo.

Then execute Phase 3 — Frontend Workspace: Session-Liste und Detail
(Freitext) from PLAN.md section 7. Specifically:

1. client/src/api/sessions.ts and items.ts (full API client functions)
2. client/src/hooks/useSessions.ts: loads list, polls every 5 seconds
3. client/src/components/SessionList.tsx
4. client/src/components/CreateForm.tsx — restaurant field is a plain text
   input for now (combobox comes in Phase 3.5). Includes IBAN field
   pre-filled from profile.
5. client/src/hooks/useSession.ts: single session with polling
6. client/src/components/SessionDetail.tsx
7. client/src/components/AddItemForm.tsx — Freitext only: dish, note, price.
8. client/src/components/ItemRow.tsx — display + inline edit for own items.
9. Loading states and error toasts.
10. Mobile-friendly layout (test at 375px width).

Stop after Phase 3.
```

**Was du danach prüfst:**
- Session anlegen funktioniert
- Eintrag hinzufügen (mit und ohne Preis)
- Eigenen Eintrag bearbeiten/löschen
- Fremde Einträge sind nicht editierbar
- Refresh per Knopf und automatisch alle 5 Sekunden
- Auf 375px Breite (Mobile-Devtools) bedienbar

---

## Phase 3.5 — Restaurants und Speisekarten

Diese Phase ist die größte. Wenn dir während der Session was unklar wird, brich ab und mach es in zwei Sub-Sessions: erst Backend, dann Frontend.

```
Read PLAN.md and CLAUDE.md before doing anything. Look at the current repo.

Then execute Phase 3.5 — Restaurant- und Menüverwaltung from PLAN.md
section 7. This is a large phase — work through it carefully.

BACKEND:

1. server/api/restaurants.php with all 5 endpoints from section 4
   (GET list, POST, GET detail with full menu, PATCH name, DELETE).
2. server/api/menu.php: PUT /api/restaurants/{id}/menu as bulk replace.
   Use a transaction. Validate: every group belongs to its dish, every
   option belongs to its group, IDs consistent. Reject if dishes count
   > 200 or options count > 2000.
3. Extend server/api/items.php with the structured variant. When dish_id
   is in the request body:
   - Load the dish, verify it belongs to this workspace via
     restaurant.workspace_id (cross-workspace protection!)
   - All option_ids must belong to this dish's groups
   - For 'single' groups: exactly one option must be selected
   - For 'multi' groups: zero or more
   - Compute price_cents = base_price_cents + sum of selected deltas
   - Build options_json snapshot: [{group, name, delta_cents}, ...]
   - Snapshot the dish name into items.dish
4. Add restaurant and menu examples to docs/api.http.

FRONTEND:

5. client/src/lib/menuPricing.ts: pure computePrice(dish, selectedOptionIds)
   returning cents. Comprehensive unit tests.
6. client/src/api/restaurants.ts
7. client/src/hooks/useRestaurants.ts and useRestaurant.ts
8. client/src/components/RestaurantList.tsx — list + "+ Neu" button.
   Reachable from session list header via "Restaurants verwalten" link.
9. client/src/components/RestaurantEditor.tsx with sub-components:
   - DishEditor.tsx (one dish: name, base price, list of groups)
   - OptionGroupEditor.tsx (name, single/multi toggle, list of options)
   See PLAN.md section 8 for the exact UI layout.
   Local state, single Save button → bulk PUT.
   Validation before save, error banner on failure.
10. client/src/components/RestaurantCombobox.tsx: text input with filter
    against existing restaurants. If exact case-insensitive match → linked.
    Otherwise → freitext (restaurant_id null, restaurant_name set).
11. Refactor CreateForm.tsx: restaurant field becomes the Combobox.
12. client/src/components/DishPicker.tsx: dropdown of dishes, on select
    renders option groups, computes live price, sends structured item.
13. Refactor AddItemForm.tsx: two modes.
    - If session.restaurant_id set: load menu, show DishPicker
    - Else: keep Freitext form
    - Toggle "Freitext eingeben" available always for special wishes.
    See PLAN.md section 9 for layout.
14. Update ItemRow.tsx to display options grouped by group name, format
    "Größe: Mittel · Toppings: extra Käse, Salami" with deltas if non-zero.

Stop after Phase 3.5 is complete.
```

**Was du danach prüfst:**
- Restaurant anlegen, Menü pflegen mit Gerichten + Optionsgruppen
- Single-Group: Radios, einer initial gewählt
- Multi-Group: Checkboxes
- Live-Preis-Anzeige beim Auswählen
- Item mit Optionen wird gespeichert, in `options_json` als Snapshot
- Optionen werden in der ItemRow gruppiert angezeigt
- Cross-Workspace-Schutz: Manueller Test mit zwei Tokens, Items anderer Workspaces sind nicht erreichbar
- Menü löschen → alte Items bleiben anzeigbar (Snapshot funktioniert)
- Bulk-Limit: PUT mit > 200 Gerichten wird abgelehnt

---

## Phase 4 — Abschluss & Zusammenfassung

```
Read PLAN.md and CLAUDE.md before doing anything. Look at the current repo.

Then execute Phase 4 — Abschluss & Zusammenfassung from PLAN.md section 7.

1. Close/Reopen buttons in SessionDetail (creator only)
2. Inline-confirm pattern for destructive actions (no window.confirm — it's
   intercepted in some browser contexts)
3. client/src/components/Summary.tsx with:
   - Aggregation key = dish name + sorted option ids (so "Pizza Klein" and
     "Pizza Groß" don't merge)
   - Per-person totals (sorted alphabetically with de locale)
   - Grand total
   - IBAN block visible only when at least one item has a price AND creator
     has an IBAN on the session
4. Copy-to-clipboard with plain-text version of the summary

Stop after Phase 4.
```

**Was du danach prüfst:**
- Session schließen → Zusammenfassung erscheint
- Aggregation: gleiche Bestellung mit gleichen Optionen wird zusammengefasst, mit unterschiedlichen Optionen NICHT
- Pro-Person-Totals stimmen
- IBAN wird angezeigt
- „Kopieren" funktioniert, Plain-Text ist sauber

---

## Phase 5 — Polish

```
Read PLAN.md and CLAUDE.md. Look at the current repo.

Execute Phase 5 — Polish from PLAN.md section 7. Apply across BOTH apps
(workspace and admin):

1. Loading skeletons instead of plain spinners
2. Empty states with friendly German copy
3. Error toasts (replace any remaining alert/banner patterns)
4. Mobile layout review at 375px width:
   - RestaurantEditor especially (deeply nested inputs)
   - Admin tables (might need horizontal scroll or stacked layout on mobile)
5. Accessibility pass: semantic HTML, labels for all inputs, aria-attributes
   where needed, keyboard navigation works
6. Run Lighthouse on both apps in production build mode. Aim for "good"
   in Accessibility (>90).

Stop after Phase 5.
```

**Was du danach prüfst:**
- Loading-Zustände sehen ordentlich aus
- Empty-States sind freundlich formuliert
- Mobile-Layout funktioniert in beiden Apps
- Tab-Navigation kommt durch alle Formulare
- Lighthouse-Werte sind ok

---

## Phase 6 — Deployment

```
Read PLAN.md and CLAUDE.md. Look at the current repo.

Execute Phase 6 — Deployment from PLAN.md section 7.

1. Create deploy/build.sh that:
   - Runs `npm run build` in client/ → dist/
   - Runs `npm run build` in admin/ → dist-admin/
   - Assembles a deploy/ output directory matching the public_html/
     structure from section 5:
       deploy/output/
       ├── index.html               (from admin/dist/)
       ├── assets/                  (from admin/dist/)
       ├── w/                       (from client/dist/)
       ├── api/                     (from server/api/)
       ├── admin-api/               (from server/admin/, renamed)
       ├── shared/                  (from server/shared/)
       └── .htaccess
2. Generate the combined .htaccess from PLAN.md section 11 into the
   deploy output.
3. Create deploy/README.md with manual steps:
   - Importing schema.sql via phpMyAdmin
   - Creating config.php on the server (template included)
   - Uploading deploy/output/ contents to public_html/
   - Running seed.php once
   - Deleting seed.php
   - Testing the URLs

Don't actually deploy — that's a manual step on my side.

Stop after Phase 6.
```

**Was du danach manuell machst:**
1. SQL-Schema in Hostinger phpMyAdmin importieren
2. `config.php` direkt auf dem Server anlegen (DB-Credentials)
3. `deploy/output/`-Inhalt per FTP nach `public_html/`
4. `seed.php` einmal aufrufen, Admin-Login speichern
5. **`seed.php` löschen**
6. `https://deinedomain` → Admin-Login testen
7. Workspace anlegen, Share-URL kopieren
8. `https://deinedomain/w/?w=<token>` → Workspace-App testen

---

## Allgemeine Hinweise

- **Wenn Claude Code von der Spec abweicht:** sag's direkt, mit Verweis auf PLAN.md-Sektion. Beispiel: „PLAN.md section 4 says PUT /menu is bulk replace, but you split it into 3 endpoints. Please go back to the spec."

- **Wenn was kaputt ist nach einer Phase:** kleine Fix-Session, nicht in der nächsten Phase weiterarbeiten. Halbfertiges nicht stapeln.

- **Wenn dir während einer Phase auffällt, dass was im Plan fehlt oder unklar ist:** TODO ans Ende von PLAN.md schreiben, weitermachen mit dem was da ist. Plan-Updates am Ende der Phase, nicht währenddessen.

- **Git-Diszplin:** ein Commit pro Phase. Falls du in einer Phase mehrere Anläufe brauchst, am Ende `git rebase -i` für einen sauberen Verlauf.

- **Wenn der Kontext-Speicher von Claude Code voll wird** (lange Sessions): am besten neue Session starten und mit „Read PLAN.md, CLAUDE.md, and the current state of the repo" anfangen. Es liest die geänderten Dateien dann selbst.

Viel Erfolg!
