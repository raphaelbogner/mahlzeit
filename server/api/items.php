<?php
declare(strict_types=1);

require_once __DIR__ . '/../shared/db.php';
require_once __DIR__ . '/../shared/ids.php';
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/sessions.php'; // for load_session_or_404, format_item_row

// Dispatcher for /api/sessions/{sid}/items[/{itemId}]
// Phase 1: Freitext variant only (dish, note, price). The structured
// (dish_id + option_ids) variant is deferred to Phase 3.5.
function handle_items_route(string $method, array $segments, array $workspace, string $sessionId): void
{
    $session = load_session_or_404($workspace, $sessionId);

    if (count($segments) === 0) {
        if ($method === 'POST') {
            items_create($session);
        } else {
            error_response(405, 'METHOD_NOT_ALLOWED', 'Use POST on /sessions/{id}/items.');
        }
        return;
    }

    if (count($segments) === 1) {
        $itemId = $segments[0];
        if (!is_valid_id($itemId)) {
            error_response(404, 'NOT_FOUND', 'Item not found.');
        }
        if ($method === 'PATCH') {
            items_patch($session, $itemId);
        } elseif ($method === 'DELETE') {
            items_delete($session, $itemId);
        } else {
            error_response(405, 'METHOD_NOT_ALLOWED', 'Use PATCH or DELETE on /sessions/{id}/items/{itemId}.');
        }
        return;
    }

    error_response(404, 'NOT_FOUND', 'Unknown items path.');
}

function items_create(array $session): void
{
    if ($session['status'] !== 'open') {
        error_response(409, 'SESSION_CLOSED', 'Session is closed.');
    }

    $body = read_json_body();
    // Phase 1: only freitext fields are accepted. dish_id / option_ids
    // arrive in Phase 3.5 — for now they're rejected as unknown.
    reject_unknown_fields($body, [
        'user_id', 'user_name', 'dish', 'note', 'price_cents',
    ]);

    $userId = require_string($body, 'user_id', 16, 16);
    if (!is_valid_id($userId)) {
        error_response(400, 'INVALID_FIELD', 'Field user_id must be a 16-char id.');
    }
    $userName = require_string($body, 'user_name', 120);
    $dish     = require_string($body, 'dish', 200);
    $note     = optional_string($body, 'note', 300);
    $priceCents = parse_optional_price_cents($body, 'price_cents');

    $id = generate_id();
    $stmt = db()->prepare(
        'INSERT INTO items
            (id, session_id, user_id, user_name, dish_id, dish, note, price_cents, options_json)
         VALUES
            (:id, :sid, :uid, :uname, NULL, :dish, :note, :price, NULL)'
    );
    $stmt->execute([
        ':id'    => $id,
        ':sid'   => $session['id'],
        ':uid'   => $userId,
        ':uname' => $userName,
        ':dish'  => $dish,
        ':note'  => $note,
        ':price' => $priceCents,
    ]);

    $item = load_item_or_404($session['id'], $id);
    json_response(201, $item);
}

function items_patch(array $session, string $itemId): void
{
    if ($session['status'] !== 'open') {
        error_response(409, 'SESSION_CLOSED', 'Session is closed.');
    }

    $body = read_json_body();
    reject_unknown_fields($body, ['user_id', 'dish', 'note', 'price_cents']);

    $existing = load_item_or_404($session['id'], $itemId);

    $userId = require_string($body, 'user_id', 16, 16);
    if ($userId !== $existing['user_id']) {
        error_response(403, 'FORBIDDEN', 'Only the item author can modify it.');
    }
    if ($existing['dish_id'] !== null) {
        // Structured items (Phase 3.5) cannot be patched via the freitext path.
        error_response(409, 'STRUCTURED_ITEM', 'This item was created with a dish; freitext patch not allowed.');
    }

    $updates = [];
    $params  = [':id' => $itemId, ':sid' => $session['id']];

    if (array_key_exists('dish', $body)) {
        $updates['dish'] = require_string($body, 'dish', 200);
    }
    if (array_key_exists('note', $body)) {
        $updates['note'] = optional_string($body, 'note', 300);
    }
    if (array_key_exists('price_cents', $body)) {
        $updates['price_cents'] = parse_optional_price_cents($body, 'price_cents');
    }

    if (count($updates) > 0) {
        $setParts = [];
        foreach ($updates as $col => $val) {
            $setParts[]      = "{$col} = :{$col}";
            $params[":{$col}"] = $val;
        }
        $sql = 'UPDATE items SET ' . implode(', ', $setParts)
             . ' WHERE id = :id AND session_id = :sid';
        $stmt = db()->prepare($sql);
        $stmt->execute($params);
    }

    $item = load_item_or_404($session['id'], $itemId);
    json_response(200, $item);
}

function items_delete(array $session, string $itemId): void
{
    if ($session['status'] !== 'open') {
        error_response(409, 'SESSION_CLOSED', 'Session is closed.');
    }

    $body = read_json_body();
    reject_unknown_fields($body, ['user_id']);

    $existing = load_item_or_404($session['id'], $itemId);

    $userId = require_string($body, 'user_id', 16, 16);
    if ($userId !== $existing['user_id']) {
        error_response(403, 'FORBIDDEN', 'Only the item author can delete it.');
    }

    $stmt = db()->prepare('DELETE FROM items WHERE id = :id AND session_id = :sid');
    $stmt->execute([':id' => $itemId, ':sid' => $session['id']]);

    http_response_code(204);
    exit;
}

function load_item_or_404(string $sessionId, string $itemId): array
{
    $stmt = db()->prepare(
        'SELECT id, session_id, user_id, user_name, dish_id, dish, note,
                price_cents, options_json, added_at
         FROM items
         WHERE id = :id AND session_id = :sid
         LIMIT 1'
    );
    $stmt->execute([':id' => $itemId, ':sid' => $sessionId]);
    $row = $stmt->fetch();
    if (!$row) {
        error_response(404, 'NOT_FOUND', 'Item not found.');
    }
    return format_item_row($row);
}

// Accepts null, missing, or a non-negative integer. Rejects floats / strings.
function parse_optional_price_cents(array $body, string $field): ?int
{
    if (!array_key_exists($field, $body) || $body[$field] === null) {
        return null;
    }
    $v = $body[$field];
    if (!is_int($v) || $v < 0 || $v > 10_000_000) {
        error_response(400, 'INVALID_FIELD', "Field {$field} must be a non-negative integer (cents).");
    }
    return $v;
}
