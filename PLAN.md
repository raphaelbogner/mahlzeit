# Mahlzeit — Implementierungsplan für Claude Code

Eine kleine Web-App für Sammelbestellungen im Büro. Geteilter Zugriff über Link-Token, keine User-Accounts, IBAN für Geld-Aufstellung am Ende, optionale Restaurant-Stammdaten mit Speisekarten und Optionsgruppen, plus ein Admin-Bereich für die Verwaltung mehrerer Workspaces. Dieses Dokument ist als Briefing für Claude Code gedacht: Architektur, Entscheidungen, Tasks. Kein fertiger Code.

**Versionshistorie**
- v3.1: Admin-Login ist Standard-Seite unter Domain-Wurzel, Workspace-App lebt unter `/w/`.
- v3: Admin-Bereich mit eigener Auth, Workspace-Verwaltung, Aktivitäts-Liste pro Workspace.
- v2: Restaurants, Speisekarten und Optionsgruppen ergänzt. Bestehender Freitext-Pfad bleibt als Fallback bestehen.
- v1: Sessions + Items mit Freitext, IBAN, Geld-Aufstellung.

---

## 1. Constraints und daraus folgende Architektur

**Hosting:** Hostinger Shared/Web Hosting Plan. Konkret heißt das:
- PHP 8.x ist verfügbar, MySQL ist die einzige unterstützte Datenbank
- Node.js gibt es erst ab dem Business-Plan; auf den günstigeren Web-Plänen nicht
- Kein SSH-Zugriff auf langlebige Prozesse, keine WebSockets
- Apache mit `.htaccess` für Rewrites
- Gratis-SSL über hPanel (Let's Encrypt)

**Konsequenz:** Backend in PHP, Frontend als statisches React-Bundle. Kein Realtime-Sync, sondern Polling. Falls du später auf den Business-Plan upgradest, kann das Backend auf Node.js portiert werden — die API-Form bleibt dann gleich.

**Auth-Modell zweistufig:**
- **Workspace-Auth:** Token in URL (`?w=<token>`). Wer den Link hat, hat Vollzugriff auf den Workspace.
- **Admin-Auth:** Separates Passwort, eigene Login-Page, PHP-Sessions. Admin sieht alle Workspaces und kann sie verwalten, aber keine Inhalte fremder Bestellungen lesen.

---

## 2. Tech Stack

**Frontend (Workspace-App)**
- React 18 + TypeScript (strict)
- Vite als Build-Tool
- Tailwind CSS (volle Tailwind-Build-Pipeline, nicht Compiled-CSS)
- `lucide-react` für Icons
- Lokaler State + React Context. Kein Redux/Zustand.
- React Router

**Frontend (Admin-App)**
- Gleicher Stack, eigener Vite-Build, eigener Output-Ordner
- Erreichbar unter `/admin` (Apache rewrites)

**Backend**
- PHP 8.1+, vanilla, kein Framework
- PDO mit prepared statements für alle DB-Zugriffe
- JSON-In, JSON-Out
- PHP-Sessions nur für den Admin-Login. Workspace-API bleibt komplett stateless.

**Datenbank**
- MySQL 8 mit `utf8mb4_unicode_ci`
- 6 Tabellen für die Workspace-Funktionalität, plus `admins` (siehe unten)

**Tooling**
- ESLint + Prettier auf dem Frontend
- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`
- Vitest für Unit-Tests der Helpers
- Kein PHP-Test-Framework; stattdessen ein `test.http`-File mit Beispiel-Requests

---

## 3. Datenmodell

### Workspace-Tabellen

```sql
CREATE TABLE workspaces (
  id            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  token         CHAR(43) NOT NULL UNIQUE,        -- 32 bytes base64url
  name          VARCHAR(120) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sessions (
  id              CHAR(16) PRIMARY KEY,
  workspace_id    BIGINT UNSIGNED NOT NULL,
  title           VARCHAR(200) NOT NULL,
  restaurant_id   CHAR(16) NULL,
  restaurant_name VARCHAR(200) NOT NULL DEFAULT '',
  deadline        VARCHAR(50)  NOT NULL DEFAULT '',
  creator_id      CHAR(16) NOT NULL,
  creator_name    VARCHAR(120) NOT NULL,
  creator_iban    VARCHAR(34)  NOT NULL DEFAULT '',
  status          ENUM('open','closed') NOT NULL DEFAULT 'open',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at       DATETIME NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE SET NULL,
  INDEX (workspace_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE items (
  id            CHAR(16) PRIMARY KEY,
  session_id    CHAR(16) NOT NULL,
  user_id       CHAR(16) NOT NULL,
  user_name     VARCHAR(120) NOT NULL,
  dish_id       CHAR(16) NULL,
  dish          VARCHAR(200) NOT NULL,
  note          VARCHAR(300) NOT NULL DEFAULT '',
  price_cents   INT NULL,
  options_json  TEXT NULL,
  added_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE SET NULL,
  INDEX (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE restaurants (
  id            CHAR(16) PRIMARY KEY,
  workspace_id  BIGINT UNSIGNED NOT NULL,
  name          VARCHAR(200) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  INDEX (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE dishes (
  id                CHAR(16) PRIMARY KEY,
  restaurant_id     CHAR(16) NOT NULL,
  name              VARCHAR(200) NOT NULL,
  base_price_cents  INT NOT NULL DEFAULT 0,
  sort_order        INT NOT NULL DEFAULT 0,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  INDEX (restaurant_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE dish_option_groups (
  id              CHAR(16) PRIMARY KEY,
  dish_id         CHAR(16) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  selection_type  ENUM('single','multi') NOT NULL,
  sort_order      INT NOT NULL DEFAULT 0,
  FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE,
  INDEX (dish_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE dish_options (
  id                CHAR(16) PRIMARY KEY,
  group_id          CHAR(16) NOT NULL,
  name              VARCHAR(200) NOT NULL,
  price_delta_cents INT NOT NULL DEFAULT 0,
  sort_order        INT NOT NULL DEFAULT 0,
  FOREIGN KEY (group_id) REFERENCES dish_option_groups(id) ON DELETE CASCADE,
  INDEX (group_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Snapshot-Prinzip:**
- `sessions.restaurant_name` und `items.dish` sind immer gefüllt — auch wenn FKs gesetzt sind. Alte Bestellungen bleiben anzeigbar, wenn das Menü später geändert oder gelöscht wird.
- `items.price_cents` enthält den finalen Preis (Basispreis + Summe aller Optionen-Deltas).
- `items.options_json` ist ein JSON-Array mit Snapshot der gewählten Optionen.

### Format `items.options_json`

```json
[
  {"group": "Größe", "name": "Mittel", "delta_cents": 150},
  {"group": "Toppings", "name": "extra Käse", "delta_cents": 100}
]
```

### Selektions-Semantik

- `selection_type='single'` → genau eine Option dieser Gruppe wird gewählt. Im Frontend Radio-Buttons. Erste Option ist Default.
- `selection_type='multi'` → null bis n Optionen wählbar. Im Frontend Checkboxes.

### Admin-Tabelle

```sql
CREATE TABLE admins (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  username        VARCHAR(60) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

`password_hash` ist das Ergebnis von `password_hash($pw, PASSWORD_DEFAULT)` (PHP). Ein einziger Admin reicht in v1; die Tabelle ist für später erweiterbar.

---

## 4. API

Format überall: JSON request / JSON response. Statuscodes 200/201/204/400/401/403/404/409/500.

### Workspace-API: Token via Query-Param `?w=...` oder Header `X-Workspace-Token`

```
GET    /api/sessions
POST   /api/sessions
GET    /api/sessions/{id}
PATCH  /api/sessions/{id}
DELETE /api/sessions/{id}

POST   /api/sessions/{id}/items              (Freitext oder strukturiert)
PATCH  /api/sessions/{id}/items/{itemId}
DELETE /api/sessions/{id}/items/{itemId}

GET    /api/restaurants
POST   /api/restaurants
GET    /api/restaurants/{id}
PATCH  /api/restaurants/{id}
DELETE /api/restaurants/{id}
PUT    /api/restaurants/{id}/menu            (Bulk-Replace)
```

### Admin-API: Cookie-Session, separater Login

```
POST   /admin/api/login                      → setzt Session-Cookie
POST   /admin/api/logout

GET    /admin/api/workspaces                 → Liste mit Statistiken
POST   /admin/api/workspaces                 → neuen Workspace anlegen
GET    /admin/api/workspaces/{id}            → Detail mit Aktivitäts-Liste
PATCH  /admin/api/workspaces/{id}            → Name ändern
POST   /admin/api/workspaces/{id}/rotate     → neues Token generieren
DELETE /admin/api/workspaces/{id}            → kompletter Workspace + alle Daten weg
```

**Wichtig:** Die Admin-API liest **niemals** Session-Inhalte oder Bestelldaten. Nur Metadaten:
- Anzahl Sessions, Items
- Wann zuletzt Aktivität
- Distinct Liste der `user_name`/`creator_name`-Strings (die „Aktivitäts-Liste")

Konkret heißt das, der `GET /admin/api/workspaces/{id}` liefert sowas:

```json
{
  "id": 42,
  "name": "Acme GmbH",
  "token": "abc...xyz",
  "url": "https://mahlzeit.example.com/w/?w=abc...xyz",
  "created_at": "2026-01-15T10:00:00Z",
  "stats": {
    "sessions_total": 47,
    "sessions_open": 2,
    "items_total": 312,
    "restaurants_total": 8,
    "last_activity": "2026-05-03T11:22:00Z"
  },
  "active_users": [
    {"name": "Anna Müller", "first_seen": "2026-01-15T10:30:00Z", "last_seen": "2026-05-03T11:22:00Z", "items_count": 28},
    {"name": "Ben Müller", "first_seen": "2026-02-01T09:00:00Z", "last_seen": "2026-04-29T12:00:00Z", "items_count": 14}
  ]
}
```

### Aktivitäts-Liste: was sie ist und was nicht

- Quelle: `SELECT DISTINCT user_name FROM items` plus `SELECT DISTINCT creator_name FROM sessions`, vereinigt.
- Zwei Personen mit gleichem Namen erscheinen als eine Zeile. Das ist eine echte Limitierung des Modells, nicht reparierbar ohne Login.
- Wer den Workspace öffnet aber nichts einträgt, taucht nicht auf.
- Diese Liste **nicht** als „Mitglieder" framen, sondern explizit als „Aktive Nutzer". Die Admin-UI sollte das auch so beschriften.

### Fehlerformat

```json
{ "error": { "code": "FORBIDDEN", "message": "..." } }
```

---

## 5. Projektstruktur

```
mahlzeit/
├── client/                          # Workspace-App (React + TS + Vite)
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── sessions.ts
│   │   │   ├── items.ts
│   │   │   └── restaurants.ts
│   │   ├── components/
│   │   │   ├── NameSetup.tsx
│   │   │   ├── SessionList.tsx
│   │   │   ├── SessionDetail.tsx
│   │   │   ├── CreateForm.tsx
│   │   │   ├── AddItemForm.tsx
│   │   │   ├── ItemRow.tsx
│   │   │   ├── Summary.tsx
│   │   │   ├── RestaurantList.tsx
│   │   │   ├── RestaurantEditor.tsx
│   │   │   ├── DishEditor.tsx
│   │   │   ├── OptionGroupEditor.tsx
│   │   │   ├── DishPicker.tsx
│   │   │   └── RestaurantCombobox.tsx
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── types/api.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts               # base: '/w/', baut nach dist/
│   └── ...
│
├── admin/                           # Admin-App (React + TS + Vite, separater Build)
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts            # mit credentials: 'include'
│   │   │   ├── auth.ts
│   │   │   └── workspaces.ts
│   │   ├── components/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── WorkspaceList.tsx
│   │   │   ├── WorkspaceDetail.tsx
│   │   │   ├── CreateWorkspaceForm.tsx
│   │   │   └── ConfirmDialog.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── useWorkspaces.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts               # base: '/', baut nach dist-admin/
│   └── ...
│
├── server/
│   ├── api/                         # Workspace-API
│   │   ├── index.php                # Front Controller für /api/*
│   │   ├── db.php
│   │   ├── auth.php                 # require_workspace()
│   │   ├── http.php
│   │   ├── sessions.php
│   │   ├── items.php
│   │   ├── restaurants.php
│   │   └── menu.php
│   ├── admin/                       # Admin-API
│   │   ├── index.php                # Front Controller für /admin/api/*
│   │   ├── auth.php                 # require_admin(), session_start()
│   │   └── workspaces.php
│   ├── shared/                      # gemeinsame Helpers für beide Stacks
│   │   ├── db.php                   # PDO-Singleton
│   │   └── ids.php                  # ID-Generator
│   ├── schema.sql
│   ├── seed.php                     # legt initialen Admin-User an, NICHT mehr Workspaces
│   └── .htaccess
│
├── deploy/
│   ├── build.sh                     # baut beide Frontends, assembliert Dist
│   └── README.md
│
├── docs/
│   └── api.http
│
├── PLAN.md
├── CLAUDE.md
├── README.md
└── .gitignore
```

**Auf Hostinger landet später:**

```
public_html/
├── index.html                      # Admin-App (Default: Login-Seite)
├── assets/                         # Admin-App-Bundle
├── w/
│   ├── index.html                  # Workspace-App (von client/dist/)
│   └── assets/
├── api/                            # Workspace-PHP
├── admin-api/                      # Admin-PHP
├── shared/
├── config.php                      # NICHT in Git
└── .htaccess
```

Das heißt: wer `https://deinedomain.com` aufruft, landet auf der Admin-Login-Seite. Workspace-Links haben die Form `https://deinedomain.com/w/?w=<token>`.

---

## 6. CLAUDE.md (Konventionen für Claude Code)

siehe CLAUDE.md File.

---

## 7. Tasks — geordnete Roadmap

Reihenfolge nicht überspringen.

### Phase 0 — Setup (von Hand)
1. Repo, `.gitignore` (`node_modules`, `dist`, `dist-admin`, `config.php`, `.env`)
2. `client/` mit Vite React-TS-Template, `vite.config.ts` mit `base: '/w/'`
3. `admin/` mit Vite React-TS-Template, `base: '/'` (Default — Admin ist die Haupt-App)
4. Tailwind, ESLint, Prettier in beiden
5. `CLAUDE.md` und `PLAN.md` ablegen

### Phase 1 — Backend Workspace-API: Schema und Sessions/Items
**Ziel:** Per `curl` lassen sich Sessions und Items (Freitext) anlegen, ändern, löschen.
1. `schema.sql` mit allen 7 Tabellen (auch `admins`)
2. `shared/db.php`, `api/auth.php`, `api/http.php`, `api/index.php`-Routing
3. `api/sessions.php`: alle 5 Session-Endpoints
4. `api/items.php`: 3 Item-Endpoints, vorerst nur Freitext
5. `seed.php`: legt einen initialen Admin-User an (Username + Passwort interaktiv abfragen oder als CLI-Args). **Workspaces werden in v3 NICHT mehr per seed angelegt.** Stattdessen muss der Admin nach Login einen anlegen.
6. `docs/api.http`: Beispiele
7. **Manuell testen mit dem ersten Admin-erstellten Workspace** — also Phase 1.5 erst durchziehen, bevor man hier wirklich testen kann. Alternativ: temporären Workspace direkt per SQL-INSERT anlegen.

### Phase 1.5 — Admin-Bereich (NEU)

**Ziel:** Admin kann sich einloggen, Workspaces sehen, anlegen, löschen, Token rotieren.

**Backend:**
1. `admin/auth.php`: `require_admin()` startet Session, prüft `$_SESSION['admin_id']`. Bei Login: `password_verify` gegen `admins.password_hash`. Bei Erfolg `$_SESSION['admin_id'] = $row['id']`.
2. `admin/workspaces.php`:
   - `GET /admin/api/workspaces`: Liste mit Stats (Sub-Queries oder JOINs auf sessions/items)
   - `POST /admin/api/workspaces`: Body `{name}` → neuer Workspace, Token wird generiert (32 random bytes, base64url), Response enthält Token und Share-URL
   - `GET /admin/api/workspaces/{id}`: Detail inkl. `active_users`-Aggregation
   - `PATCH /admin/api/workspaces/{id}`: Body `{name}`
   - `POST /admin/api/workspaces/{id}/rotate`: neuer Token, alter wird ungültig (UPDATE)
   - `DELETE /admin/api/workspaces/{id}`: cascade-delete via FK
3. `admin/index.php`: Front Controller für `/admin/api/*`
4. **CSRF-Schutz**: für state-ändernde Endpoints (POST/PATCH/DELETE) einen CSRF-Token in der Session speichern, vom Frontend bei Login abholen, in jedem schreibenden Request als Header `X-CSRF-Token` mitschicken, serverseitig vergleichen. Standardmuster.
5. `docs/api.http`: Admin-Beispiele

**Frontend (Admin-App):**
6. `admin/src/api/client.ts`: fetch-Wrapper mit `credentials: 'include'`, CSRF-Header automatisch dranhängen
7. `admin/src/api/auth.ts`, `admin/src/api/workspaces.ts`
8. `admin/src/hooks/useAuth.ts`: hält Login-Status, ruft beim Mount `GET /admin/api/me` auf
9. `admin/src/components/LoginForm.tsx`
10. `admin/src/components/WorkspaceList.tsx`: Tabelle mit Name, Anzahl Sessions, letzte Aktivität, Aktionen-Spalte
11. `admin/src/components/CreateWorkspaceForm.tsx`: nach Anlegen wird der Share-Link prominent angezeigt mit Copy-Button — der Admin braucht den genau einmal, um ihn weiterzugeben
12. `admin/src/components/WorkspaceDetail.tsx`: Stats, Aktivitäts-Liste mit Hinweistext „Diese Liste zeigt alle Personen, die mindestens eine Bestellung eingetragen oder eine Sammelbestellung gestartet haben. Personen mit gleichem Namen erscheinen als ein Eintrag."
13. `admin/src/components/ConfirmDialog.tsx`: für Löschen und Token-Rotieren (beides destruktiv)
14. `admin/src/App.tsx`: Routing `/login`, `/`, `/workspaces/:id`. Bei nicht eingeloggt → Redirect auf Login. Default-Route ist die Login-Seite, weil das die Standard-URL ist.
15. **Wichtige UX-Hinweise** im Admin-UI:
    - Token-Rotation: Warnung „Der bisherige Link funktioniert nach Bestätigung nicht mehr. Alle Nutzer brauchen den neuen Link."
    - Workspace-Löschung: Eingabe des Workspace-Namens als Bestätigung (typischer Pattern für irreversible Aktionen)

### Phase 2 — Frontend Workspace-App: Grundgerüst und Profil
1. `lib/ids.ts`, `lib/iban.ts`, `lib/price.ts`, `lib/aggregate.ts` mit Tests
2. `types/api.ts`: TS-Interfaces, die das volle Backend-JSON spiegeln
3. `api/client.ts`: fetch-Wrapper mit Token
4. `hooks/useProfile.ts`
5. `components/NameSetup.tsx` mit IBAN
6. `App.tsx` mit Token-Check und Routing-Skeleton (`/`, `/s/:id`, `/restaurants`, `/restaurants/:id`)

### Phase 3 — Frontend Workspace: Session-Liste und Detail (Freitext)
1. `hooks/useSessions.ts` mit Polling
2. `components/SessionList.tsx`
3. `components/CreateForm.tsx` (vorerst nur Restaurant-Freitext)
4. `hooks/useSession.ts` mit Polling
5. `components/SessionDetail.tsx`
6. `components/AddItemForm.tsx` (vorerst nur Freitext-Modus)
7. `components/ItemRow.tsx` mit Inline-Edit

### Phase 3.5 — Restaurant- und Menüverwaltung

**Backend:**
1. `api/restaurants.php`: GET-List, POST, GET-Detail, PATCH (nur Name), DELETE
2. `api/menu.php`: PUT-Endpoint, der das ganze Menü ersetzt (Transaktion, vollständige Validierung)
3. `api/items.php` erweitern: strukturierte Variante mit `dish_id` + `option_ids`
4. `docs/api.http`

**Frontend:**
5. `lib/menuPricing.ts`: pure `computePrice(dish, selectedOptionIds)` mit Tests
6. `api/restaurants.ts`
7. `hooks/useRestaurants.ts`, `hooks/useRestaurant.ts`
8. `components/RestaurantList.tsx`
9. `components/RestaurantEditor.tsx` mit `DishEditor`, `OptionGroupEditor`
10. `components/RestaurantCombobox.tsx`, `CreateForm.tsx` umbauen
11. `components/DishPicker.tsx`, `AddItemForm.tsx` umbauen für zwei Modi
12. `ItemRow.tsx`: Optionen anzeigen, gruppiert nach Group-Name

### Phase 4 — Abschluss & Zusammenfassung
1. Close/Reopen-Buttons (creator only)
2. Inline-Confirm beim Löschen
3. `Summary.tsx`: Aggregation mit Gerichtename + Optionswahl als Schlüssel
4. Pro-Person-Totals und Gesamtsumme
5. IBAN-Block
6. Kopier-Funktion mit Plain-Text-Version

### Phase 5 — Polish (beide Apps)
1. Loading-Skeletons
2. Empty-States
3. Error-Toasts
4. Mobile-Layout — vor allem `RestaurantEditor` und Admin-Tabellen
5. Lighthouse / A11y

### Phase 6 — Deployment
1. `deploy/build.sh`:
   - Workspace-App: `cd client && npm run build` → `dist/` (mit `base: '/w/'`)
   - Admin-App: `cd admin && npm run build` → `dist-admin/` (mit `base: '/'`)
   - Server: `server/api/`, `server/admin/` (umbenennen zu `admin-api/`), `server/shared/` zusammenkopieren
   - Workspace-App-Output landet auf dem Server unter `public_html/w/`, Admin-App-Output unter `public_html/`
   - Kombiniertes `.htaccess` schreiben
2. SQL-Schema auf Hostinger via phpMyAdmin
3. `config.php` mit DB-Credentials direkt am Server anlegen (nicht in Git):
   ```php
   <?php
   return [
     'db' => ['host' => '...', 'name' => '...', 'user' => '...', 'pass' => '...'],
     'admin_session_name' => 'mahlzeit_admin',
   ];
   ```
4. Per FTP/SFTP nach `public_html/`
5. `seed.php` einmal ausführen → initialer Admin-Account wird angelegt → Login-Daten merken
6. `https://deinedomain` aufrufen → Admin-Login. Einloggen, ersten Workspace anlegen, Share-URL kopieren
7. Workspace-URL `https://deinedomain/w/?w=<token>` testen
8. SSL aktivieren falls nötig
9. **Wichtig:** `seed.php` löschen oder umbenennen

---

## 8. UX-Spezifikation für RestaurantEditor

```
┌──────────────────────────────────────────────────────┐
│  ← Zurück    Pizzeria Roma                           │
│  Restaurant-Name: [_______________]                  │
│                                                      │
│  ┌─────────────────────────────────────┐             │
│  │ Margherita                  [✎][🗑] │             │
│  │ Basispreis: [9,50] €                │             │
│  │                                     │             │
│  │ Gruppe: Größe  (single ⏶)  [🗑]    │             │
│  │   ○ Klein            +0,00  [🗑]    │             │
│  │   ○ Mittel           +1,50  [🗑]    │             │
│  │   ○ Groß             +3,00  [🗑]    │             │
│  │   + Option hinzufügen               │             │
│  │                                     │             │
│  │ Gruppe: Toppings (multi ⏶)  [🗑]    │             │
│  │   ☐ extra Käse       +1,00  [🗑]    │             │
│  │   ☐ Salami           +1,50  [🗑]    │             │
│  │   + Option hinzufügen               │             │
│  │                                     │             │
│  │ + Optionsgruppe hinzufügen          │             │
│  └─────────────────────────────────────┘             │
│                                                      │
│  + Gericht hinzufügen                                │
│                                                      │
│            [Abbrechen]    [Speichern]                │
└──────────────────────────────────────────────────────┘
```

- Alles inline editierbar. Lokaler State, ein „Speichern"-Button → ein Bulk-PUT.
- Das (⏶)-Toggle wechselt zwischen single und multi.
- Validierung vor Speichern: Gericht braucht Name + nicht-negativen Basispreis. Gruppe braucht Name + mindestens 1 Option. Option braucht Name (delta darf 0 sein).
- Keine Drag-and-Drop in v1. `sort_order` nach Eingabereihenfolge.

---

## 9. UX-Spezifikation für AddItemForm im Restaurant-Modus

```
┌──────────────────────────────────────────────────────┐
│  Eintrag hinzufügen                                  │
│                                                      │
│  Gericht: [▼ Margherita                          ]   │
│                                                      │
│  Größe                                               │
│  ○ Klein                              €9,50          │
│  ● Mittel                            €11,00          │
│  ○ Groß                              €12,50          │
│                                                      │
│  Toppings                                            │
│  ☑ extra Käse                         +€1,00         │
│  ☐ Salami                             +€1,50         │
│                                                      │
│  Anmerkung: [bitte ohne Knoblauch_______________]    │
│                                                      │
│  Endpreis: €12,00                  [Hinzufügen]      │
│                                                      │
│  ─── oder ───                                        │
│  [Freitext eingeben]                                 │
└──────────────────────────────────────────────────────┘
```

- Bei Single-Group: erste Option initial gewählt.
- Bei jeder Auswahländerung Endpreis live aktualisieren.
- „Freitext eingeben"-Toggle für Sonderfälle.

---

## 10. UX-Spezifikation für Admin-Bereich

### Login

```
┌──────────────────────────────────────┐
│  Mahlzeit · Admin                    │
│                                      │
│  Username: [______________]          │
│  Passwort: [______________]          │
│                                      │
│             [Login]                  │
└──────────────────────────────────────┘
```

### Workspace-Liste

```
┌──────────────────────────────────────────────────────┐
│  Mahlzeit · Admin                          [Logout]  │
│                                                      │
│  Workspaces                  [+ Neuen anlegen]       │
│  ─────────────────────────────────────────────       │
│                                                      │
│  Acme GmbH                  47 Sessions              │
│    Letzte Aktivität: heute 11:22                     │
│    [Öffnen] [Link kopieren]              [...]       │
│                                                      │
│  Beispielfirma              3 Sessions               │
│    Letzte Aktivität: vor 2 Wochen                    │
│    [Öffnen] [Link kopieren]              [...]       │
└──────────────────────────────────────────────────────┘
```

### Workspace-Detail

```
┌──────────────────────────────────────────────────────┐
│  ← Zurück         Acme GmbH                          │
│                                                      │
│  Share-Link:                                         │
│  https://mahlzeit.acme.com/w/?w=abc...xyz [📋]       │
│                                                      │
│  ┌─────────────────────────────────────┐             │
│  │ Sessions gesamt:        47          │             │
│  │ Davon offen:            2           │             │
│  │ Items gesamt:           312         │             │
│  │ Restaurants:            8           │             │
│  │ Letzte Aktivität:       heute 11:22 │             │
│  └─────────────────────────────────────┘             │
│                                                      │
│  Aktive Nutzer (12)                                  │
│  ─────────────────────────────────────────           │
│  ⓘ Diese Liste zeigt alle Personen, die mindestens   │
│    eine Bestellung eingetragen haben. Personen       │
│    mit gleichem Namen erscheinen als ein Eintrag.    │
│                                                      │
│  Anna Müller        28 Items   zuletzt heute 11:22   │
│  Ben Müller         14 Items   zuletzt 29.04.        │
│  Clara Schmidt      45 Items   zuletzt heute 09:30   │
│  ...                                                 │
│                                                      │
│  ─────────────────────────────────────               │
│  Verwaltung                                          │
│  [Name ändern]  [Token rotieren]  [Workspace löschen]│
└──────────────────────────────────────────────────────┘
```

---

## 11. `.htaccess` (kombiniert für Hostinger)

```apache
RewriteEngine On

# Admin-API zu admin-PHP
RewriteRule ^admin/api/(.*)$ admin-api/index.php [QSA,L]

# Workspace-API zu Workspace-PHP
RewriteRule ^api/(.*)$ api/index.php [QSA,L]

# Workspace-Frontend SPA-Fallback (alles unter /w/)
RewriteCond %{REQUEST_URI} ^/w/
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^w/.*$ w/index.html [L]

# Existierende Dateien
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

# Admin-App SPA-Fallback (Default für die Domain-Wurzel)
RewriteRule ^ index.html [L]
```

Hinweise:
- Die Reihenfolge der Rules ist wichtig. Konkrete Pfade (`admin/api`, `api`, `w/`) müssen vor dem Default-Fallback kommen.
- `/admin/api/*` ist weiterhin der Admin-API-Pfad. Das Admin-Frontend selbst läuft unter `/`, ruft aber seine API unter `/admin/api/*` auf — das ist semantisch sauber und macht die Backend-Trennung klar.

---

## 12. Sicherheits-Checkliste

**Allgemein**
- [ ] HTTPS erzwungen
- [ ] Alle SQL-Statements mit prepared statements
- [ ] Längen-Limits auf allen Eingabefeldern
- [ ] `error_reporting` in Production aus, Errors in Datei loggen
- [ ] `seed.php` nach Initialisierung entfernen

**Workspace-API**
- [ ] Workspace-Token: 32 Bytes Crypto-Random, base64url. Niemals in Logs.
- [ ] Server-seitige IBAN-Validierung
- [ ] Cross-Workspace-Schutz: jeder DB-Read und Write filtert auf `workspace_id`
- [ ] Bulk-Menü-Limits beim PUT (z.B. > 200 Gerichte oder > 2000 Optionen ablehnen)

**Admin-Bereich**
- [ ] Admin-Passwort über `password_hash` gespeichert
- [ ] Admin-Session-Cookie: `HttpOnly`, `Secure`, `SameSite=Strict`
- [ ] Session-Cookie-Name nicht der PHP-Default
- [ ] Session-Timeout (z.B. 4 Stunden Inaktivität)
- [ ] CSRF-Token für state-ändernde Admin-Endpoints
- [ ] Rate-Limiting für `/admin/api/login` (z.B. 5 Versuche pro 15 Min pro IP). Sonst Brute-Force.
- [ ] Admin-API liefert nur Aggregate, NIE Bestellinhalte
- [ ] Token-Rotation invalidiert sofort den alten Token (UPDATE in einer Query)

**DSGVO**
- [ ] In Datenschutzerklärung erwähnen, dass Name, IBAN, Bestelldaten und Aktivitäts-Listen gespeichert werden
- [ ] Löschfristen definieren (z.B. „Bestellungen älter als 90 Tage werden automatisch entfernt") — falls gewünscht, als Cron oder manuelles Admin-Feature implementieren
- [ ] Workspace-Löschung im Admin entfernt alle Daten kaskadisch

---

## 13. Was bewusst nicht im Plan ist

- **Mehrere Admin-User mit Rollen.** Tabelle `admins` ist erweiterbar, aber v1 hat nur einen.
- **Audit-Log.** Wer hat wann was gelöscht/rotiert. Bei euch wahrscheinlich überdimensioniert.
- **Echte User-Accounts.** Workspace-User bleiben anonym mit Browser-IDs.
- **E-Mail-Versand** (Magic-Links, Reset, Notifications).
- **Cross-Workspace-Restaurant-Sharing.**
- **Bilder, Allergene, Mehrsprachigkeit, Drag-and-Drop, Versionierung der Speisekarte.**

---

## 14. Was du selbst entscheiden solltest

**1. Routing-Stil.** Path-Routing für Workspace-App. Empfehlung beibehalten.

**2. Admin als Default-Seite.** Entschieden: ja, Admin-Login ist die Standard-Seite unter der Domain. Workspaces leben unter `/w/`. Falls du zusätzlich noch eine `.htaccess`-Basic-Auth über die Wurzel legen willst (zweite Schicht vor dem Login-Form), ist das einfach nachzuschalten — bei einem internen Tool m.E. nicht nötig.

**3. Initialer Admin-User.** Wie willst du das Setup machen? Optionen:
   - `seed.php` interaktiv: nimmt Username/Passwort als POST-Eingabe entgegen, nur einmal aufrufbar
   - `seed.php` als CLI: `php seed.php admin <password>`
   - Initial-Admin direkt per phpMyAdmin-INSERT (ohne Skript)

**4. Backup.** MySQL-Backups sind über hPanel automatisch. Trotzdem solltest du das Recovery einmal testen.

---

## 15. Schätzung

- Phase 0: halber Abend
- Phase 1: ein Abend
- **Phase 1.5 (Admin): zwei Abende** (Auth + CSRF + zwei Frontend-Views)
- Phase 2–3: zwei Abende
- Phase 3.5: zwei bis drei Abende
- Phase 4–5: ein Abend
- Phase 6: ein Abend (Deployment-Überraschungen)

Realistisch zwei Wochen Hobby-Zeit für die volle Funktionalität. Wenn du nach Phase 3 schon online gehst, hast du eine funktionierende Freitext-App mit Admin-Bereich.

---

## 16. Wenn du später vom Shared- auf den Business-Plan upgradest

Backend kann gegen Node.js/TypeScript getauscht werden. API-Vertrag bleibt, Datenbank bleibt MySQL. Admin- und Workspace-Frontends unverändert.
