<?php
declare(strict_types=1);

require_once __DIR__ . '/../shared/db.php';
require_once __DIR__ . '/../shared/ids.php';
require_once __DIR__ . '/../shared/iban.php';
require_once __DIR__ . '/../shared/push.php';
require_once __DIR__ . '/http.php';

// Dispatcher for /api/sessions[/{id}]
function handle_sessions_route(string $method, array $segments, array $workspace): void
{
    // segments here is the part AFTER 'sessions' — so [] for collection,
    // [id] for a single resource. /items/... is dispatched separately.
    if (count($segments) === 0) {
        if ($method === 'GET') {
            sessions_list($workspace);
        } elseif ($method === 'POST') {
            sessions_create($workspace);
        } else {
            error_response(405, 'METHOD_NOT_ALLOWED', 'Use GET or POST on /sessions.');
        }
        return;
    }

    if (count($segments) === 1) {
        $id = $segments[0];
        if (!is_valid_id($id)) {
            error_response(404, 'NOT_FOUND', 'Session not found.');
        }
        if ($method === 'GET') {
            sessions_get($workspace, $id);
        } elseif ($method === 'PATCH') {
            sessions_patch($workspace, $id);
        } elseif ($method === 'DELETE') {
            sessions_delete($workspace, $id);
        } else {
            error_response(405, 'METHOD_NOT_ALLOWED', 'Use GET, PATCH or DELETE on /sessions/{id}.');
        }
        return;
    }

    error_response(404, 'NOT_FOUND', 'Unknown sessions path.');
}

function sessions_list(array $workspace): void
{
    apply_housekeeping((int)$workspace['id']);

    $stmt = db()->prepare(
        'SELECT s.id, s.title, s.restaurant_id, s.restaurant_name, s.deadline,
                s.deadline_at, s.auto_closed, s.archived_at, s.archived_by_user_id,
                s.creator_id, s.creator_name, s.creator_iban, s.status,
                s.created_at, s.closed_at,
                s.paid_by_user_id, s.paid_by_user_name, s.paid_by_iban,
                s.discount_cents, s.discount_label,
                (SELECT COUNT(*) FROM items i WHERE i.session_id = s.id) AS items_count,
                (SELECT COALESCE(SUM(i.price_cents * i.quantity), 0) FROM items i WHERE i.session_id = s.id) AS total_cents,
                (SELECT COUNT(*) FROM items i WHERE i.session_id = s.id AND i.price_cents IS NOT NULL) AS priced_count,
                (SELECT COUNT(*) FROM items i WHERE i.session_id = s.id AND i.price_cents IS NOT NULL AND i.paid_at IS NOT NULL) AS paid_count
         FROM sessions s
         WHERE s.workspace_id = :wid
         ORDER BY s.created_at DESC'
    );
    $stmt->execute([':wid' => $workspace['id']]);
    $rows = array_map('format_session_row', $stmt->fetchAll());

    // With ?user_id= the client also gets per-person totals for closed
    // sessions, so it can compute "what do I still owe" (including the exact
    // discount share) with the same logic as the summary view.
    $viewer = $_GET['user_id'] ?? null;
    if (is_string($viewer) && is_valid_id($viewer)) {
        $totals = load_person_totals((int)$workspace['id']);
        foreach ($rows as &$row) {
            $row['person_totals'] = $totals[$row['id']] ?? [];
        }
        unset($row);
    }

    json_response(200, ['sessions' => $rows]);
}

// session_id → [{ user_id, user_name, total_cents, unpaid_cents, reported_cents }]
// for closed sessions with priced items. Amounts are quantity-weighted.
function load_person_totals(int $workspaceId): array
{
    $stmt = db()->prepare(
        'SELECT i.session_id, i.user_id, MAX(i.user_name) AS user_name,
                SUM(i.price_cents * i.quantity) AS total_cents,
                SUM(CASE WHEN i.paid_at IS NULL THEN i.price_cents * i.quantity ELSE 0 END) AS unpaid_cents,
                SUM(CASE WHEN i.paid_at IS NULL AND i.payment_reported_at IS NOT NULL
                         THEN i.price_cents * i.quantity ELSE 0 END) AS reported_cents
         FROM items i
         JOIN sessions s ON s.id = i.session_id
         WHERE s.workspace_id = :wid AND s.status = "closed" AND i.price_cents IS NOT NULL
         GROUP BY i.session_id, i.user_id'
    );
    $stmt->execute([':wid' => $workspaceId]);
    $out = [];
    foreach ($stmt->fetchAll() as $r) {
        $out[$r['session_id']][] = [
            'user_id'        => $r['user_id'],
            'user_name'      => (string)$r['user_name'],
            'total_cents'    => (int)$r['total_cents'],
            'unpaid_cents'   => (int)$r['unpaid_cents'],
            'reported_cents' => (int)$r['reported_cents'],
        ];
    }
    return $out;
}

function sessions_create(array $workspace): void
{
    $body = read_json_body();
    reject_unknown_fields($body, [
        'user_id', 'user_name', 'title',
        'restaurant_id', 'restaurant_name',
        'deadline', 'deadline_at', 'creator_iban',
    ]);

    $userId = require_string($body, 'user_id', 16, 16);
    if (!is_valid_id($userId)) {
        error_response(400, 'INVALID_FIELD', 'Field user_id must be a 16-char id.');
    }
    $userName = require_string($body, 'user_name', 120);
    $title = require_string($body, 'title', 200);
    $restaurantName = optional_string($body, 'restaurant_name', 200);
    $deadline = optional_string($body, 'deadline', 50);
    $deadlineAt = parse_deadline_at($body);
    $ibanRaw = optional_string($body, 'creator_iban', 34);

    $restaurantId = null;
    if (array_key_exists('restaurant_id', $body) && $body['restaurant_id'] !== null && $body['restaurant_id'] !== '') {
        $restaurantId = resolve_restaurant_id_or_400($workspace, $body['restaurant_id']);
        if ($restaurantName === '') {
            // Linked sessions must keep a snapshot of the name in case the
            // restaurant is later renamed or deleted.
            $rstmt = db()->prepare('SELECT name FROM restaurants WHERE id = :id LIMIT 1');
            $rstmt->execute([':id' => $restaurantId]);
            $restaurantName = (string)($rstmt->fetchColumn() ?: '');
        }
    }

    $iban = '';
    if ($ibanRaw !== '') {
        if (!is_valid_iban($ibanRaw)) {
            error_response(400, 'INVALID_IBAN', 'IBAN failed mod-97 validation.');
        }
        $iban = clean_iban($ibanRaw);
    }

    $id = generate_id();
    $stmt = db()->prepare(
        'INSERT INTO sessions
            (id, workspace_id, title, restaurant_id, restaurant_name, deadline, deadline_at,
             creator_id, creator_name, creator_iban, status)
         VALUES
            (:id, :wid, :title, :rid, :rname, :deadline, :deadline_at,
             :cid, :cname, :iban, "open")'
    );
    $stmt->execute([
        ':id'       => $id,
        ':wid'      => $workspace['id'],
        ':title'    => $title,
        ':rid'      => $restaurantId,
        ':rname'    => $restaurantName,
        ':deadline' => $deadline,
        ':deadline_at' => $deadlineAt,
        ':cid'      => $userId,
        ':cname'    => $userName,
        ':iban'     => $iban,
    ]);

    notify_session_created($workspace, [
        'id'              => $id,
        'title'           => $title,
        'restaurant_name' => $restaurantName,
        'deadline_at'     => $deadlineAt,
        'creator_id'      => $userId,
    ]);

    sessions_get($workspace, $id, 201);
}

// Validates that a restaurant id belongs to the workspace. Returns the id.
function resolve_restaurant_id_or_400(array $workspace, mixed $value): string
{
    if (!is_string($value) || !is_valid_id($value)) {
        error_response(400, 'INVALID_FIELD', 'Field restaurant_id must be a 16-char id.');
    }
    $stmt = db()->prepare(
        'SELECT id FROM restaurants WHERE id = :id AND workspace_id = :wid LIMIT 1'
    );
    $stmt->execute([':id' => $value, ':wid' => $workspace['id']]);
    if (!$stmt->fetchColumn()) {
        error_response(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found in this workspace.');
    }
    return $value;
}

function sessions_get(array $workspace, string $id, int $status = 200): void
{
    $session = load_session_or_404($workspace, $id);
    $session['items'] = load_items($id);
    // With ?user_id= the client learns whether the viewer opted out
    // ("Heute nicht dabei") without an extra request.
    $viewer = $_GET['user_id'] ?? null;
    if (is_string($viewer) && is_valid_id($viewer) && function_exists('session_has_decline')) {
        $session['my_declined'] = session_has_decline($id, $viewer);
    }
    json_response($status, $session);
}

function sessions_patch(array $workspace, string $id): void
{
    $body = read_json_body();
    reject_unknown_fields($body, [
        'user_id', 'title',
        'restaurant_id', 'restaurant_name',
        'deadline', 'deadline_at', 'creator_iban', 'status',
        'paid_by_user_id', 'paid_by_user_name', 'paid_by_iban',
        'discount_cents', 'discount_label', 'archived',
    ]);

    $session = load_session_or_404($workspace, $id);

    $userId = require_string($body, 'user_id', 16, 16);
    $isCreator = $userId === $session['creator_id'];

    // Auth split: most fields are creator-only. paid_by_iban is also editable
    // by the user currently marked as the payer (so they can fill in their
    // IBAN themselves without bothering the creator). paid_by_user_id and
    // paid_by_user_name remain creator-only.
    $touchesCreatorOnlyFields = false;
    $creatorOnlyKeys = [
        'title', 'restaurant_id', 'restaurant_name', 'deadline', 'deadline_at',
        'creator_iban', 'status', 'paid_by_user_id', 'paid_by_user_name',
    ];
    foreach ($creatorOnlyKeys as $k) {
        if (array_key_exists($k, $body)) {
            $touchesCreatorOnlyFields = true;
            break;
        }
    }
    $touchesPaidByIban = array_key_exists('paid_by_iban', $body);

    if ($touchesCreatorOnlyFields && !$isCreator) {
        error_response(403, 'FORBIDDEN', 'Only the session creator can modify these fields.');
    }
    if ($touchesPaidByIban && !$isCreator) {
        // Payer can update their own IBAN. Allowed only if they are the
        // currently marked payer.
        if ($session['paid_by_user_id'] === null || $userId !== $session['paid_by_user_id']) {
            error_response(403, 'FORBIDDEN', 'Only the creator or the marked payer can change paid_by_iban.');
        }
    }

    // The discount is settable by the effective payer (the person who gets the
    // money: the marked payer, or the creator by default) and only once the
    // session is closed — it reduces the amount everyone still owes.
    $touchesDiscount = array_key_exists('discount_cents', $body)
        || array_key_exists('discount_label', $body);
    if ($touchesDiscount) {
        $effectivePayerId = $session['paid_by_user_id'] ?? $session['creator_id'];
        if ($userId !== $effectivePayerId) {
            error_response(403, 'FORBIDDEN', 'Only the payer can set a discount.');
        }
        if ($session['status'] !== 'closed') {
            error_response(409, 'SESSION_OPEN', 'A discount can only be set once the session is closed.');
        }
    }

    // Archiving: creator or effective payer, only for closed sessions. Un-
    // archiving is allowed for the same people at any time.
    $archiveChange = null;
    if (array_key_exists('archived', $body)) {
        $val = $body['archived'];
        if (!is_bool($val)) {
            error_response(400, 'INVALID_FIELD', 'Field archived must be a boolean.');
        }
        $effectivePayerId = $session['paid_by_user_id'] ?? $session['creator_id'];
        if (!$isCreator && $userId !== $effectivePayerId) {
            error_response(403, 'FORBIDDEN', 'Only the creator or the payer can archive a session.');
        }
        if ($val && $session['status'] !== 'closed') {
            error_response(409, 'SESSION_OPEN', 'Only closed sessions can be archived.');
        }
        $archiveChange = $val;
    }

    $updates = [];
    $params  = [':id' => $id, ':wid' => $workspace['id']];

    if (array_key_exists('title', $body)) {
        $updates['title'] = require_string($body, 'title', 200);
    }
    if (array_key_exists('restaurant_id', $body)) {
        if ($body['restaurant_id'] === null || $body['restaurant_id'] === '') {
            $updates['restaurant_id'] = null;
        } else {
            $updates['restaurant_id'] = resolve_restaurant_id_or_400($workspace, $body['restaurant_id']);
        }
    }
    if (array_key_exists('restaurant_name', $body)) {
        $updates['restaurant_name'] = optional_string($body, 'restaurant_name', 200);
    }
    if (array_key_exists('deadline', $body)) {
        $updates['deadline'] = optional_string($body, 'deadline', 50);
    }
    if (array_key_exists('deadline_at', $body)) {
        $updates['deadline_at'] = parse_deadline_at($body);
    }
    if (array_key_exists('creator_iban', $body)) {
        $ibanRaw = optional_string($body, 'creator_iban', 34);
        if ($ibanRaw === '') {
            $updates['creator_iban'] = '';
        } else {
            if (!is_valid_iban($ibanRaw)) {
                error_response(400, 'INVALID_IBAN', 'IBAN failed mod-97 validation.');
            }
            $updates['creator_iban'] = clean_iban($ibanRaw);
        }
    }
    if (array_key_exists('status', $body)) {
        $newStatus = $body['status'];
        if ($newStatus !== 'open' && $newStatus !== 'closed') {
            error_response(400, 'INVALID_FIELD', 'Field status must be "open" or "closed".');
        }
        $updates['status'] = $newStatus;
    }

    // Payment-marking. paid_by_user_id == null clears the override; the
    // implicit payer is the creator. paid_by_user_name is a snapshot — the
    // client must send it whenever it sends paid_by_user_id (non-null), so
    // the server doesn't need to look it up across sessions.
    if (array_key_exists('paid_by_user_id', $body)) {
        $val = $body['paid_by_user_id'];
        if ($val === null || $val === '') {
            $updates['paid_by_user_id']   = null;
            $updates['paid_by_user_name'] = '';
            $updates['paid_by_iban']      = '';
        } else {
            if (!is_string($val) || !is_valid_id($val)) {
                error_response(400, 'INVALID_FIELD', 'Field paid_by_user_id must be a 16-char id or null.');
            }
            $updates['paid_by_user_id'] = $val;
            // paid_by_user_name must accompany a non-null paid_by_user_id.
            if (!array_key_exists('paid_by_user_name', $body) || $body['paid_by_user_name'] === '') {
                error_response(400, 'MISSING_FIELD', 'paid_by_user_name is required when paid_by_user_id is set.');
            }
        }
    }
    if (array_key_exists('paid_by_user_name', $body) && !array_key_exists('paid_by_user_id', $updates)) {
        // Only allow updating the name when paid_by_user_id is also being set
        // (handled above). Otherwise it's nonsensical / could confuse.
        // Fall through silently — name will not be updated unless id is set.
    }
    if (array_key_exists('paid_by_user_name', $body) && array_key_exists('paid_by_user_id', $body)
        && $body['paid_by_user_id'] !== null && $body['paid_by_user_id'] !== '') {
        $updates['paid_by_user_name'] = require_string($body, 'paid_by_user_name', 120);
    }
    if (array_key_exists('paid_by_iban', $body)) {
        $ibanRaw = optional_string($body, 'paid_by_iban', 34);
        if ($ibanRaw === '') {
            $updates['paid_by_iban'] = '';
        } else {
            if (!is_valid_iban($ibanRaw)) {
                error_response(400, 'INVALID_IBAN', 'IBAN failed mod-97 validation.');
            }
            $updates['paid_by_iban'] = clean_iban($ibanRaw);
        }
    }

    if (array_key_exists('discount_cents', $body)) {
        $val = $body['discount_cents'];
        if (!is_int($val) || $val < 0 || $val > 10_000_000) {
            error_response(400, 'INVALID_FIELD', 'Field discount_cents must be a non-negative integer (cents).');
        }
        $updates['discount_cents'] = $val;
    }
    if (array_key_exists('discount_label', $body)) {
        $updates['discount_label'] = optional_string($body, 'discount_label', 120);
    }

    if (count($updates) === 0 && $archiveChange === null) {
        // Nothing to update — return current state.
        sessions_get($workspace, $id);
        return;
    }

    $setParts = [];
    foreach ($updates as $col => $val) {
        $setParts[]    = "{$col} = :{$col}";
        $params[":{$col}"] = $val;
    }
    if ($archiveChange === true) {
        $setParts[] = 'archived_at = CURRENT_TIMESTAMP';
        $setParts[] = 'archived_by_user_id = :archived_by';
        $params[':archived_by'] = $userId;
    } elseif ($archiveChange === false) {
        $setParts[] = 'archived_at = NULL';
        $setParts[] = 'archived_by_user_id = NULL';
    }
    if (array_key_exists('status', $updates)) {
        if ($updates['status'] === 'closed') {
            // Manual close: never flagged as automatic.
            $setParts[] = 'closed_at = CURRENT_TIMESTAMP';
            $setParts[] = 'auto_closed = 0';
        } else {
            // Reopening drops the deadline, otherwise the session would snap
            // shut again on the next request. A new deadline_at in the same
            // request wins over the reset.
            $setParts[] = 'closed_at = NULL';
            $setParts[] = 'auto_closed = 0';
            if (!array_key_exists('deadline_at', $updates)) {
                $setParts[] = 'deadline_at = NULL';
            }
        }
    }

    $sql = 'UPDATE sessions SET ' . implode(', ', $setParts)
         . ' WHERE id = :id AND workspace_id = :wid';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);

    if (($updates['status'] ?? null) === 'closed' && $session['status'] !== 'closed') {
        notify_session_closed((int)$workspace['id'], $id);
    }

    sessions_get($workspace, $id);
}

function sessions_delete(array $workspace, string $id): void
{
    $body = read_json_body();
    reject_unknown_fields($body, ['user_id']);

    $session = load_session_or_404($workspace, $id);

    $userId = require_string($body, 'user_id', 16, 16);
    if ($userId !== $session['creator_id']) {
        error_response(403, 'FORBIDDEN', 'Only the session creator can delete it.');
    }

    $stmt = db()->prepare('DELETE FROM sessions WHERE id = :id AND workspace_id = :wid');
    $stmt->execute([':id' => $id, ':wid' => $workspace['id']]);

    http_response_code(204);
    exit;
}

function load_session_or_404(array $workspace, string $id): array
{
    apply_housekeeping((int)$workspace['id']);

    $stmt = db()->prepare(
        'SELECT id, workspace_id, title, restaurant_id, restaurant_name, deadline,
                deadline_at, auto_closed, archived_at, archived_by_user_id,
                creator_id, creator_name, creator_iban, status, created_at, closed_at,
                paid_by_user_id, paid_by_user_name, paid_by_iban,
                discount_cents, discount_label
         FROM sessions
         WHERE id = :id AND workspace_id = :wid
         LIMIT 1'
    );
    $stmt->execute([':id' => $id, ':wid' => $workspace['id']]);
    $row = $stmt->fetch();
    if (!$row) {
        error_response(404, 'NOT_FOUND', 'Session not found.');
    }
    return $row;
}

function load_items(string $sessionId): array
{
    $stmt = db()->prepare(
        'SELECT id, session_id, user_id, user_name, dish_id, dish, note,
                price_cents, quantity, options_json, added_at, paid_at, payment_reported_at
         FROM items
         WHERE session_id = :sid
         ORDER BY added_at ASC, id ASC'
    );
    $stmt->execute([':sid' => $sessionId]);
    return array_map('format_item_row', $stmt->fetchAll());
}

function format_session_row(array $row): array
{
    return [
        'id'                => $row['id'],
        'title'             => $row['title'],
        'restaurant_id'     => $row['restaurant_id'],
        'restaurant_name'   => $row['restaurant_name'],
        'deadline'          => $row['deadline'],
        'deadline_at'       => format_utc_datetime($row['deadline_at'] ?? null),
        'auto_closed'       => (bool)($row['auto_closed'] ?? 0),
        'archived_at'       => format_utc_datetime($row['archived_at'] ?? null),
        'archived_by_user_id' => $row['archived_by_user_id'] ?? null,
        'creator_id'        => $row['creator_id'],
        'creator_name'      => $row['creator_name'],
        'creator_iban'      => $row['creator_iban'],
        'status'            => $row['status'],
        'created_at'        => $row['created_at'],
        'closed_at'         => $row['closed_at'],
        'paid_by_user_id'   => $row['paid_by_user_id'] ?? null,
        'paid_by_user_name' => $row['paid_by_user_name'] ?? '',
        'paid_by_iban'      => $row['paid_by_iban'] ?? '',
        'discount_cents'    => isset($row['discount_cents']) ? (int)$row['discount_cents'] : 0,
        'discount_label'    => $row['discount_label'] ?? '',
        'items_count'       => isset($row['items_count']) ? (int)$row['items_count'] : null,
        'total_cents'       => isset($row['total_cents']) ? (int)$row['total_cents'] : null,
        'priced_items_count' => isset($row['priced_count']) ? (int)$row['priced_count'] : null,
        'paid_items_count'   => isset($row['paid_count']) ? (int)$row['paid_count'] : null,
    ];
}

// Lazy housekeeping, run before every read/write in a workspace (no cron):
//   1. close sessions whose deadline passed (flagged auto_closed)
//   2. close sessions that have been open for 30 days (forgotten)
//   3. archive sessions closed 30+ days ago with nothing left to pay
// The DB session runs in UTC (see shared/db.php), so CURRENT_TIMESTAMP
// compares correctly with the stored UTC values.
function apply_housekeeping(int $workspaceId): void
{
    auto_close_due_sessions($workspaceId);

    $staleIds = select_ids(
        'SELECT id FROM sessions
         WHERE workspace_id = :wid AND status = "open"
           AND created_at <= CURRENT_TIMESTAMP - INTERVAL 30 DAY',
        [':wid' => $workspaceId]
    );
    if ($staleIds !== []) {
        $stale = db()->prepare(
            'UPDATE sessions
             SET status = "closed", closed_at = CURRENT_TIMESTAMP, auto_closed = 1
             WHERE workspace_id = :wid AND status = "open"
               AND created_at <= CURRENT_TIMESTAMP - INTERVAL 30 DAY'
        );
        $stale->execute([':wid' => $workspaceId]);
        foreach ($staleIds as $sid) {
            notify_session_closed($workspaceId, $sid);
        }
    }

    $archive = db()->prepare(
        'UPDATE sessions s
         SET s.archived_at = CURRENT_TIMESTAMP, s.archived_by_user_id = NULL
         WHERE s.workspace_id = :wid AND s.status = "closed" AND s.archived_at IS NULL
           AND s.closed_at IS NOT NULL
           AND s.closed_at <= CURRENT_TIMESTAMP - INTERVAL 30 DAY
           AND NOT EXISTS (
               SELECT 1 FROM items i
               WHERE i.session_id = s.id AND i.price_cents IS NOT NULL AND i.paid_at IS NULL
           )'
    );
    $archive->execute([':wid' => $workspaceId]);
}

function auto_close_due_sessions(int $workspaceId): void
{
    $dueIds = select_ids(
        'SELECT id FROM sessions
         WHERE workspace_id = :wid AND status = "open"
           AND deadline_at IS NOT NULL AND deadline_at <= CURRENT_TIMESTAMP',
        [':wid' => $workspaceId]
    );
    if ($dueIds === []) {
        return;
    }
    $stmt = db()->prepare(
        'UPDATE sessions
         SET status = "closed", closed_at = deadline_at, auto_closed = 1
         WHERE workspace_id = :wid AND status = "open"
           AND deadline_at IS NOT NULL AND deadline_at <= CURRENT_TIMESTAMP'
    );
    $stmt->execute([':wid' => $workspaceId]);
    foreach ($dueIds as $sid) {
        notify_session_closed($workspaceId, $sid);
    }
}

function select_ids(string $sql, array $params): array
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return array_map(static fn(array $r): string => (string)$r['id'], $stmt->fetchAll());
}

// deadline_at arrives as ISO-8601 (with offset or Z) or null. Returns a UTC
// "Y-m-d H:i:s" string for the DB, or null. The value must be in the future.
function parse_deadline_at(array $body): ?string
{
    if (!array_key_exists('deadline_at', $body) || $body['deadline_at'] === null || $body['deadline_at'] === '') {
        return null;
    }
    $raw = $body['deadline_at'];
    if (!is_string($raw) || strlen($raw) > 40) {
        error_response(400, 'INVALID_FIELD', 'Field deadline_at must be an ISO-8601 string or null.');
    }
    try {
        $dt = new DateTimeImmutable($raw);
    } catch (Exception) {
        error_response(400, 'INVALID_FIELD', 'Field deadline_at must be an ISO-8601 string or null.');
    }
    $utc = $dt->setTimezone(new DateTimeZone('UTC'));
    if ($utc <= new DateTimeImmutable('now', new DateTimeZone('UTC'))) {
        error_response(400, 'INVALID_FIELD', 'Field deadline_at must be in the future.');
    }
    return $utc->format('Y-m-d H:i:s');
}

// DB DATETIME (UTC) → "YYYY-MM-DDTHH:MM:SSZ" for the client.
function format_utc_datetime(?string $value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    return str_replace(' ', 'T', $value) . 'Z';
}

function format_item_row(array $row): array
{
    $options = null;
    if (is_string($row['options_json']) && $row['options_json'] !== '') {
        $decoded = json_decode($row['options_json'], true);
        if (is_array($decoded)) {
            $options = $decoded;
        }
    }
    return [
        'id'           => $row['id'],
        'session_id'   => $row['session_id'],
        'user_id'      => $row['user_id'],
        'user_name'    => $row['user_name'],
        'dish_id'      => $row['dish_id'],
        'dish'         => $row['dish'],
        'note'         => $row['note'],
        'price_cents'  => $row['price_cents'] === null ? null : (int)$row['price_cents'],
        'quantity'     => isset($row['quantity']) ? max(1, (int)$row['quantity']) : 1,
        'options'      => $options,
        'added_at'     => $row['added_at'],
        'paid_at'      => $row['paid_at'] ?? null,
        'payment_reported_at' => $row['payment_reported_at'] ?? null,
    ];
}
