<?php
declare(strict_types=1);

require_once __DIR__ . '/../shared/db.php';
require_once __DIR__ . '/../shared/ids.php';
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/sessions.php'; // load_session_or_404

const KNOWN_USER_WINDOW_DAYS = 60;

// GET /api/sessions/{id}/participation?user_id=…
// Who is known in this workspace (ordered anything in the last 60 days), who
// already ordered in this session, who declined. Creator and effective payer
// only — it exposes who has *not* ordered, which is nobody else's business.
function handle_participation_route(string $method, array $workspace, string $sessionId): void
{
    if ($method !== 'GET') {
        error_response(405, 'METHOD_NOT_ALLOWED', 'Use GET on /sessions/{id}/participation.');
    }
    $session = load_session_or_404($workspace, $sessionId);

    $userId = $_GET['user_id'] ?? '';
    if (!is_string($userId) || !is_valid_id($userId)) {
        error_response(400, 'INVALID_FIELD', 'Query parameter user_id must be a 16-char id.');
    }
    $effectivePayer = $session['paid_by_user_id'] ?? $session['creator_id'];
    if ($userId !== $session['creator_id'] && $userId !== $effectivePayer) {
        error_response(403, 'FORBIDDEN', 'Only the creator or the payer can see participation.');
    }

    $pdo = db();

    // Known people: latest name per user_id across recent workspace sessions.
    $known = $pdo->prepare(
        'SELECT i.user_id, i.user_name
         FROM items i
         JOIN sessions s ON s.id = i.session_id
         WHERE s.workspace_id = :wid
           AND i.added_at >= CURRENT_TIMESTAMP - INTERVAL ' . KNOWN_USER_WINDOW_DAYS . ' DAY
         ORDER BY i.added_at DESC'
    );
    $known->execute([':wid' => $workspace['id']]);
    $people = [];
    foreach ($known->fetchAll() as $r) {
        if (!isset($people[$r['user_id']])) {
            $people[$r['user_id']] = ['user_id' => $r['user_id'], 'user_name' => $r['user_name']];
        }
    }
    // The creator counts as known even before their first order.
    if (!isset($people[$session['creator_id']])) {
        $people[$session['creator_id']] = [
            'user_id'   => $session['creator_id'],
            'user_name' => $session['creator_name'],
        ];
    }

    $ordered = $pdo->prepare('SELECT DISTINCT user_id FROM items WHERE session_id = :sid');
    $ordered->execute([':sid' => $session['id']]);
    $orderedIds = array_map(static fn(array $r): string => $r['user_id'], $ordered->fetchAll());

    $declined = $pdo->prepare(
        'SELECT user_id, user_name FROM session_declines WHERE session_id = :sid ORDER BY declined_at ASC'
    );
    $declined->execute([':sid' => $session['id']]);

    json_response(200, [
        'known'    => array_values($people),
        'ordered'  => $orderedIds,
        'declined' => $declined->fetchAll(),
    ]);
}

// PUT    /api/sessions/{id}/decline { user_id, user_name }  → "Heute nicht dabei"
// DELETE /api/sessions/{id}/decline { user_id }             → take it back
function handle_decline_route(string $method, array $workspace, string $sessionId): void
{
    $session = load_session_or_404($workspace, $sessionId);
    if ($session['status'] !== 'open') {
        error_response(409, 'SESSION_CLOSED', 'Session is closed.');
    }

    $body = read_json_body();
    if ($method === 'PUT') {
        reject_unknown_fields($body, ['user_id', 'user_name']);
        $userId = require_string($body, 'user_id', 16, 16);
        if (!is_valid_id($userId)) {
            error_response(400, 'INVALID_FIELD', 'Field user_id must be a 16-char id.');
        }
        $userName = require_string($body, 'user_name', 120);
        $stmt = db()->prepare(
            'INSERT INTO session_declines (session_id, user_id, user_name)
             VALUES (:sid, :uid, :uname)
             ON DUPLICATE KEY UPDATE user_name = VALUES(user_name), declined_at = CURRENT_TIMESTAMP'
        );
        $stmt->execute([':sid' => $session['id'], ':uid' => $userId, ':uname' => $userName]);
        json_response(200, ['declined' => true]);
    }

    if ($method === 'DELETE') {
        reject_unknown_fields($body, ['user_id']);
        $userId = require_string($body, 'user_id', 16, 16);
        if (!is_valid_id($userId)) {
            error_response(400, 'INVALID_FIELD', 'Field user_id must be a 16-char id.');
        }
        clear_decline($session['id'], $userId);
        json_response(200, ['declined' => false]);
    }

    error_response(405, 'METHOD_NOT_ALLOWED', 'Use PUT or DELETE on /sessions/{id}/decline.');
}

function clear_decline(string $sessionId, string $userId): void
{
    $stmt = db()->prepare('DELETE FROM session_declines WHERE session_id = :sid AND user_id = :uid');
    $stmt->execute([':sid' => $sessionId, ':uid' => $userId]);
}

function session_has_decline(string $sessionId, string $userId): bool
{
    $stmt = db()->prepare(
        'SELECT 1 FROM session_declines WHERE session_id = :sid AND user_id = :uid LIMIT 1'
    );
    $stmt->execute([':sid' => $sessionId, ':uid' => $userId]);
    return (bool)$stmt->fetchColumn();
}
