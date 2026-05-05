<?php
declare(strict_types=1);

require_once __DIR__ . '/../shared/db.php';
require_once __DIR__ . '/../shared/ids.php';
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/sessions.php'; // for load_session_or_404, format_item_row

// Dispatcher for /api/sessions/{sid}/items[/{itemId}]. POST accepts both
// freitext (dish + optional price) and structured (dish_id + option_ids)
// payloads. PATCH only supports freitext items — structured items are
// immutable on the server and must be deleted + re-added to change.
function handle_items_route(string $method, array $segments, array $workspace, string $sessionId): void
{
    $session = load_session_or_404($workspace, $sessionId);

    if (count($segments) === 0) {
        if ($method === 'POST') {
            items_create($session, $workspace);
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

function items_create(array $session, array $workspace): void
{
    if ($session['status'] !== 'open') {
        error_response(409, 'SESSION_CLOSED', 'Session is closed.');
    }

    $body = read_json_body();
    // Two variants: freitext (dish, optional price) and structured
    // (dish_id + option_ids, server computes price/snapshot). The presence
    // of dish_id in the body switches modes.
    reject_unknown_fields($body, [
        'user_id', 'user_name', 'dish', 'note', 'price_cents',
        'dish_id', 'option_ids',
    ]);

    $userId = require_string($body, 'user_id', 16, 16);
    if (!is_valid_id($userId)) {
        error_response(400, 'INVALID_FIELD', 'Field user_id must be a 16-char id.');
    }
    $userName = require_string($body, 'user_name', 120);
    $note     = optional_string($body, 'note', 300);

    if (array_key_exists('dish_id', $body) && $body['dish_id'] !== null && $body['dish_id'] !== '') {
        items_create_structured($session, $workspace, $userId, $userName, $note, $body);
        return;
    }

    if (array_key_exists('option_ids', $body)) {
        error_response(400, 'INVALID_FIELD', 'Field option_ids requires dish_id.');
    }

    $dish       = require_string($body, 'dish', 200);
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

function items_create_structured(
    array $session,
    array $workspace,
    string $userId,
    string $userName,
    string $note,
    array $body
): void {
    if (array_key_exists('dish', $body)) {
        error_response(400, 'INVALID_FIELD', 'Field dish must be omitted when dish_id is set.');
    }
    if (array_key_exists('price_cents', $body)) {
        error_response(400, 'INVALID_FIELD', 'Field price_cents is computed; omit it when dish_id is set.');
    }

    $dishId = $body['dish_id'];
    if (!is_string($dishId) || !is_valid_id($dishId)) {
        error_response(400, 'INVALID_FIELD', 'Field dish_id must be a 16-char id.');
    }

    $optionIdsRaw = $body['option_ids'] ?? [];
    if (!is_array($optionIdsRaw)) {
        error_response(400, 'INVALID_FIELD', 'Field option_ids must be an array.');
    }
    $optionIds = [];
    foreach ($optionIdsRaw as $oid) {
        if (!is_string($oid) || !is_valid_id($oid)) {
            error_response(400, 'INVALID_FIELD', 'option_ids entries must be 16-char ids.');
        }
        $optionIds[] = $oid;
    }
    // De-duplicate while preserving order (same option id twice would be a UI bug).
    $optionIds = array_values(array_unique($optionIds));

    $pdo = db();

    // Cross-workspace protection: dish must belong to a restaurant in this workspace.
    $dishStmt = $pdo->prepare(
        'SELECT d.id, d.name, d.base_price_cents, d.restaurant_id
         FROM dishes d
         JOIN restaurants r ON r.id = d.restaurant_id
         WHERE d.id = :did AND r.workspace_id = :wid
         LIMIT 1'
    );
    $dishStmt->execute([':did' => $dishId, ':wid' => $workspace['id']]);
    $dish = $dishStmt->fetch();
    if (!$dish) {
        error_response(404, 'DISH_NOT_FOUND', 'Dish not found in this workspace.');
    }

    // Load all groups + options for this dish in one go.
    $groupsStmt = $pdo->prepare(
        'SELECT id, name, selection_type
         FROM dish_option_groups
         WHERE dish_id = :did
         ORDER BY sort_order ASC, id ASC'
    );
    $groupsStmt->execute([':did' => $dishId]);
    $groups = $groupsStmt->fetchAll();

    $optionsByGroup = [];
    $optionsById    = [];
    if (count($groups) > 0) {
        $groupIds = array_map(static fn(array $g) => $g['id'], $groups);
        $placeholders = implode(',', array_fill(0, count($groupIds), '?'));
        $optStmt = $pdo->prepare(
            "SELECT id, group_id, name, price_delta_cents
             FROM dish_options
             WHERE group_id IN ({$placeholders})"
        );
        $optStmt->execute($groupIds);
        foreach ($optStmt->fetchAll() as $o) {
            $optionsByGroup[$o['group_id']][$o['id']] = $o;
            $optionsById[$o['id']] = $o;
        }
    }

    // Verify every selected option_id belongs to one of this dish's groups.
    foreach ($optionIds as $oid) {
        if (!isset($optionsById[$oid])) {
            error_response(400, 'INVALID_OPTION', "Option {$oid} does not belong to dish.");
        }
    }

    // Per-group selection rules: single = exactly one, multi = zero or more.
    $selectedSet = array_flip($optionIds);
    $totalDelta = 0;
    $snapshot   = [];
    foreach ($groups as $g) {
        $groupOpts = $optionsByGroup[$g['id']] ?? [];
        $picked = [];
        foreach ($groupOpts as $oid => $_o) {
            if (isset($selectedSet[$oid])) {
                $picked[] = $groupOpts[$oid];
            }
        }
        if ($g['selection_type'] === 'single') {
            if (count($picked) !== 1) {
                error_response(
                    400,
                    'INVALID_SELECTION',
                    "Group '{$g['name']}' requires exactly one option."
                );
            }
        }
        // For both single and multi: append to snapshot in group order.
        foreach ($picked as $opt) {
            $delta = (int)$opt['price_delta_cents'];
            $totalDelta += $delta;
            $snapshot[] = [
                'group'       => $g['name'],
                'name'        => $opt['name'],
                'delta_cents' => $delta,
            ];
        }
    }

    $priceCents = (int)$dish['base_price_cents'] + $totalDelta;
    if ($priceCents < 0) {
        // Negative deltas could in theory underflow. Guard against it.
        error_response(400, 'INVALID_SELECTION', 'Computed price is negative.');
    }

    $id = generate_id();
    $stmt = $pdo->prepare(
        'INSERT INTO items
            (id, session_id, user_id, user_name, dish_id, dish, note, price_cents, options_json)
         VALUES
            (:id, :sid, :uid, :uname, :did, :dish, :note, :price, :opts)'
    );
    $stmt->execute([
        ':id'    => $id,
        ':sid'   => $session['id'],
        ':uid'   => $userId,
        ':uname' => $userName,
        ':did'   => $dishId,
        ':dish'  => $dish['name'],
        ':note'  => $note,
        ':price' => $priceCents,
        ':opts'  => json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    $item = load_item_or_404($session['id'], $id);
    json_response(201, $item);
}

function items_patch(array $session, string $itemId): void
{
    $body = read_json_body();
    reject_unknown_fields($body, ['user_id', 'dish', 'note', 'price_cents', 'paid']);

    $existing = load_item_or_404($session['id'], $itemId);

    $userId = require_string($body, 'user_id', 16, 16);

    // Two distinct edit modes share this endpoint:
    //   1) content edit (dish/note/price)  → item author, only when session open, freitext only
    //   2) paid toggle                      → effective payer (paid_by_user_id ?? creator_id)
    // Both can occur in one request; each is checked independently.
    $contentKeys = ['dish', 'note', 'price_cents'];
    $touchesContent = false;
    foreach ($contentKeys as $k) {
        if (array_key_exists($k, $body)) {
            $touchesContent = true;
            break;
        }
    }
    $touchesPaid = array_key_exists('paid', $body);

    if ($touchesContent) {
        if ($session['status'] !== 'open') {
            error_response(409, 'SESSION_CLOSED', 'Session is closed.');
        }
        if ($userId !== $existing['user_id']) {
            error_response(403, 'FORBIDDEN', 'Only the item author can modify it.');
        }
        if ($existing['dish_id'] !== null) {
            error_response(409, 'STRUCTURED_ITEM', 'This item was created with a dish; freitext patch not allowed.');
        }
    }
    if ($touchesPaid) {
        $effectivePayer = $session['paid_by_user_id'] ?? $session['creator_id'];
        if ($userId !== $effectivePayer) {
            error_response(403, 'FORBIDDEN', 'Only the effective payer can mark items as paid.');
        }
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

    $setParts = [];
    foreach ($updates as $col => $val) {
        $setParts[]      = "{$col} = :{$col}";
        $params[":{$col}"] = $val;
    }
    if ($touchesPaid) {
        $paid = $body['paid'];
        if (!is_bool($paid)) {
            error_response(400, 'INVALID_FIELD', 'Field paid must be a boolean.');
        }
        // Use SQL CURRENT_TIMESTAMP for set, or NULL for unset. Not a placeholder.
        $setParts[] = $paid ? 'paid_at = CURRENT_TIMESTAMP' : 'paid_at = NULL';
    }

    if (count($setParts) > 0) {
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
                price_cents, options_json, added_at, paid_at
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
