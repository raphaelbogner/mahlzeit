<?php
declare(strict_types=1);

require_once __DIR__ . '/../shared/db.php';
require_once __DIR__ . '/../shared/ids.php';
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/sessions.php'; // load_session_or_404

// GET /api/sessions/{id}/suggestions?user_id=…
// "Order this again": the user's most recent distinct orders in earlier
// sessions that are linked to the same restaurant. Distinct = dish + option
// set (notes are ignored; the latest note is carried along). Max 3, newest
// first. Read-only, no migration.
function handle_suggestions_route(string $method, array $workspace, string $sessionId): void
{
    if ($method !== 'GET') {
        error_response(405, 'METHOD_NOT_ALLOWED', 'Use GET on /sessions/{id}/suggestions.');
    }

    $session = load_session_or_404($workspace, $sessionId);

    $userId = $_GET['user_id'] ?? '';
    if (!is_string($userId) || !is_valid_id($userId)) {
        error_response(400, 'INVALID_FIELD', 'Query parameter user_id must be a 16-char id.');
    }

    if ($session['restaurant_id'] === null) {
        json_response(200, ['suggestions' => []]);
    }

    $stmt = db()->prepare(
        'SELECT i.dish_id, i.dish, i.note, i.price_cents, i.quantity, i.options_json, i.added_at
         FROM items i
         JOIN sessions s ON s.id = i.session_id
         WHERE s.workspace_id = :wid
           AND s.restaurant_id = :rid
           AND s.id <> :sid
           AND i.user_id = :uid
         ORDER BY i.added_at DESC, i.id DESC
         LIMIT 200'
    );
    $stmt->execute([
        ':wid' => $workspace['id'],
        ':rid' => $session['restaurant_id'],
        ':sid' => $session['id'],
        ':uid' => $userId,
    ]);

    $out  = [];
    $seen = [];
    foreach ($stmt->fetchAll() as $row) {
        $options = decode_option_snapshot($row['options_json']);
        usort($options, static function (array $a, array $b): int {
            return [$a['group'], $a['name']] <=> [$b['group'], $b['name']];
        });

        $dishKey = $row['dish_id'] !== null
            ? 'd:' . $row['dish_id']
            : 'ft:' . mb_strtolower(trim((string)$row['dish']));
        $optKey = implode(';', array_map(
            static fn(array $o): string => $o['group'] . '=' . $o['name'],
            $options
        ));
        $key = $dishKey . '|' . $optKey;

        if (isset($seen[$key])) {
            $out[$seen[$key]]['times_ordered']++;
            continue;
        }
        if (count($out) >= 3) {
            continue; // keep counting repeats of the top 3, ignore new combos
        }
        $seen[$key] = count($out);
        $out[] = [
            'kind'            => $row['dish_id'] !== null ? 'structured' : 'freetext',
            'dish_id'         => $row['dish_id'],
            'dish'            => $row['dish'],
            'options'         => $options,
            'note'            => (string)$row['note'],
            'quantity'        => max(1, (int)$row['quantity']),
            'price_cents'     => $row['price_cents'] === null ? null : (int)$row['price_cents'],
            'last_ordered_at' => format_utc_datetime((string)$row['added_at']),
            'times_ordered'   => 1,
        ];
    }

    json_response(200, ['suggestions' => $out]);
}

// options_json → list of {group, name, delta_cents}; anything malformed → [].
function decode_option_snapshot(?string $json): array
{
    if (!is_string($json) || $json === '') {
        return [];
    }
    $decoded = json_decode($json, true);
    if (!is_array($decoded)) {
        return [];
    }
    $out = [];
    foreach ($decoded as $o) {
        if (!is_array($o) || !isset($o['group'], $o['name'])) {
            continue;
        }
        $out[] = [
            'group'       => (string)$o['group'],
            'name'        => (string)$o['name'],
            'delta_cents' => (int)($o['delta_cents'] ?? 0),
        ];
    }
    return $out;
}
