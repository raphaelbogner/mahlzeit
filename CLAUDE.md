# Mahlzeit — Project Conventions

## General
- Comments in English only, and only for non-obvious intent or edge cases.
- Prefer minimal diffs. Don't refactor unrelated code.
- Never log or include IBAN, names, or any personal data in error messages
  exposed to users or in server logs.

## TypeScript / React
- TypeScript strict mode. No `any`. Use `unknown` and narrow.
- Prefer explicit types on exported functions, top-level constants, and
  component props. Local inference is fine.
- Function components + hooks. No class components.
- No global state library. Use Context only when prop drilling exceeds 3 levels.
- API errors are handled explicitly. No swallowed catches.
- File naming: PascalCase for components, camelCase for everything else.

## PHP
- PDO with prepared statements always. Never string-concat SQL.
- One file per resource (sessions.php, items.php, restaurants.php, menu.php,
  workspaces.php).
- Validate every input. Reject unknown fields rather than ignoring.
- All responses are JSON. Set Content-Type explicitly.
- IBAN: store as the cleaned uppercase form. Validate mod-97 server-side too.
- For PUT /menu: do the entire replace in a single transaction.

## Domain rules
- Restaurants and dishes belong to a workspace. Every read and write filters
  by workspace_id. No cross-workspace leakage.
- Items always store dish name, price, and options as a snapshot. The dish_id
  FK is optional. Deleting a dish must NOT break old items.
- For dish option groups with selection_type='single', exactly one option
  must be chosen on the client side. Server validates this on item insert.
- For 'multi', zero or more options may be chosen.

## Admin area
- The admin API NEVER reads order content (dishes, items, prices). Only
  aggregated counts and distinct user_name lists.
- Admin auth uses PHP sessions with HttpOnly, Secure, SameSite=Strict cookies.
- Always check is_admin_logged_in() at the start of every admin endpoint.
- Admin frontend is the default app at the domain root and talks only to
  /admin/api/*.
- Workspace frontend lives at /w/ and is reached via shared token URLs.

## Auth model (workspace)
- The workspace token IS the auth. There is no per-user authentication.
- user_id from the client is trusted within a valid workspace.
- This is a deliberate trade-off for an internal tool. Don't add fake
  user-auth that pretends to be more secure than it is.

## Tests
- Unit-test every helper in lib/ (iban, price, aggregate, menuPricing).
- Widget tests for forms (input validation, error display).
- No backend test framework yet — exercise endpoints via docs/api.http.