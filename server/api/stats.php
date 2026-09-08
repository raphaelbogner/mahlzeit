<?php
declare(strict_types=1);

require_once __DIR__ . '/../shared/db.php';
require_once __DIR__ . '/../shared/ids.php';
require_once __DIR__ . '/http.php';

// GET /api/stats?range=30d|year|all&user_id=…
// Workspace statistics over *closed* sessions (archived included). Amounts
// are quantity-weighted; session-level discounts are subtracted per session
// ("net"). Names are snapshots, so deleted dishes/restaurants still count.
function handle_stats_route(string $method, array $segments, array $workspace): void
{
    if (count($segments) !== 0 || $method !== 'GET') {
        error_response(405, 'METHOD_NOT_ALLOWED', 'Use GET on /stats.');
    }

    $range = $_GET['range'] ?? '30d';
    if (!in_array($range, ['30d', 'year', 'all'], true)) {
        error_response(400, 'INVALID_FIELD', 'Query parameter range must be 30d, year or all.');
    }
    $userId = $_GET['user_id'] ?? null;
    if ($userId !== null && (!is_string($userId) || !is_valid_id($userId))) {
        error_response(400, 'INVALID_FIELD', 'Query parameter user_id must be a 16-char id.');
    }

    $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $since = null;
    if ($range === '30d') {
        $since = $now->sub(new DateInterval('P30D'))->format('Y-m-d H:i:s');
    } elseif ($range === 'year') {
        $since = $now->format('Y') . '-01-01 00:00:00';
    }

    $pdo = db();
    $sinceSql = $since !== null ? ' AND s.closed_at >= :since' : '';
    $base = [':wid' => $workspace['id']];
    if ($since !== null) {
        $base[':since'] = $since;
    }

    // One row per closed session with its gross total.
    $sessStmt = $pdo->prepare(
        'SELECT s.id, s.restaurant_name, s.discount_cents,
                s.creator_id, s.creator_name, s.paid_by_user_id, s.paid_by_user_name,
                COALESCE(SUM(i.price_cents * i.quantity), 0) AS total_cents,
                COALESCE(SUM(i.quantity), 0) AS items
         FROM sessions s
         LEFT JOIN items i ON i.session_id = s.id
         WHERE s.workspace_id = :wid AND s.status = "closed"' . $sinceSql . '
         GROUP BY s.id'
    );
    $sessStmt->execute($base);
    $sessions = $sessStmt->fetchAll();

    $totals = ['sessions' => 0, 'items' => 0, 'spend_cents' => 0, 'discount_cents' => 0];
    $restaurants = [];
    $payers = [];
    foreach ($sessions as $s) {
        $gross = (int)$s['total_cents'];
        $discount = min(max(0, (int)$s['discount_cents']), $gross);
        $net = $gross - $discount;
        $totals['sessions']++;
        $totals['items'] += (int)$s['items'];
        $totals['spend_cents'] += $net;
        $totals['discount_cents'] += $discount;

        $rName = trim((string)$s['restaurant_name']) !== '' ? $s['restaurant_name'] : 'Ohne Restaurant';
        $restaurants[$rName] ??= ['restaurant_name' => $rName, 'sessions' => 0, 'spend_cents' => 0];
        $restaurants[$rName]['sessions']++;
        $restaurants[$rName]['spend_cents'] += $net;

        $payerKey  = $s['paid_by_user_id'] ?? $s['creator_id'];
        $payerName = $s['paid_by_user_id'] !== null ? $s['paid_by_user_name'] : $s['creator_name'];
        $payers[$payerKey] ??= ['user_name' => $payerName, 'sessions_paid' => 0, 'received_cents' => 0];
        $payers[$payerKey]['sessions_paid']++;
        $payers[$payerKey]['received_cents'] += $net;
    }
    usort($restaurants, static fn(array $a, array $b): int => [$b['spend_cents'], $b['sessions']] <=> [$a['spend_cents'], $a['sessions']]);
    usort($payers, static fn(array $a, array $b): int => [$b['sessions_paid'], $b['received_cents']] <=> [$a['sessions_paid'], $a['received_cents']]);

    // Top dishes across the workspace.
    $dishStmt = $pdo->prepare(
        'SELECT i.dish, SUM(i.quantity) AS count, COALESCE(SUM(i.price_cents * i.quantity), 0) AS spend_cents
         FROM items i JOIN sessions s ON s.id = i.session_id
         WHERE s.workspace_id = :wid AND s.status = "closed"' . $sinceSql . '
         GROUP BY i.dish
         ORDER BY count DESC, spend_cents DESC
         LIMIT 10'
    );
    $dishStmt->execute($base);
    $topDishes = array_map(static fn(array $r): array => [
        'dish'        => $r['dish'],
        'count'       => (int)$r['count'],
        'spend_cents' => (int)$r['spend_cents'],
    ], $dishStmt->fetchAll());

    $myTop = [];
    if ($userId !== null) {
        $myStmt = $pdo->prepare(
            'SELECT i.dish, SUM(i.quantity) AS count
             FROM items i JOIN sessions s ON s.id = i.session_id
             WHERE s.workspace_id = :wid AND s.status = "closed" AND i.user_id = :uid' . $sinceSql . '
             GROUP BY i.dish
             ORDER BY count DESC
             LIMIT 5'
        );
        $myStmt->execute($base + [':uid' => $userId]);
        $myTop = array_map(static fn(array $r): array => [
            'dish'  => $r['dish'],
            'count' => (int)$r['count'],
        ], $myStmt->fetchAll());
    }

    // Spend per person (gross, before discounts — the discount is a
    // session-level gift and not attributed per person here).
    $personStmt = $pdo->prepare(
        'SELECT i.user_id, MAX(i.user_name) AS user_name,
                COALESCE(SUM(i.price_cents * i.quantity), 0) AS spend_cents,
                SUM(i.quantity) AS items
         FROM items i JOIN sessions s ON s.id = i.session_id
         WHERE s.workspace_id = :wid AND s.status = "closed"' . $sinceSql . '
         GROUP BY i.user_id
         ORDER BY spend_cents DESC'
    );
    $personStmt->execute($base);
    $persons = array_map(static fn(array $r): array => [
        'user_name'   => (string)$r['user_name'],
        'spend_cents' => (int)$r['spend_cents'],
        'items'       => (int)$r['items'],
    ], $personStmt->fetchAll());

    json_response(200, [
        'range'         => $range,
        'from'          => $since !== null ? str_replace(' ', 'T', $since) . 'Z' : null,
        'to'            => $now->format('Y-m-d\TH:i:s\Z'),
        'totals'        => $totals,
        'top_dishes'    => $topDishes,
        'my_top_dishes' => $myTop,
        'restaurants'   => array_values($restaurants),
        'payers'        => array_values($payers),
        'persons'       => $persons,
    ]);
}
