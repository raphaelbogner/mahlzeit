<?php
declare(strict_types=1);

require_once __DIR__ . '/../shared/db.php';
require_once __DIR__ . '/../shared/ids.php';
require_once __DIR__ . '/../shared/push.php';
require_once __DIR__ . '/http.php';

// /api/push/config        GET     → { enabled, public_key }
// /api/push/subscription  PUT     { user_id, endpoint, keys: { p256dh, auth }, user_agent? }
//                         DELETE  { endpoint }
// /api/push/test          POST    { user_id } → queues a test notification
function handle_push_route(string $method, array $segments, array $workspace): void
{
    $sub = $segments[0] ?? '';

    if ($sub === 'config' && $method === 'GET') {
        $cfg = push_config();
        json_response(200, [
            'enabled'    => $cfg !== null,
            'public_key' => $cfg !== null ? $cfg['public'] : null,
        ]);
    }

    if ($sub === 'subscription') {
        if (!push_enabled()) {
            error_response(409, 'PUSH_DISABLED', 'Push is not configured on this server.');
        }
        if ($method === 'PUT') {
            push_subscription_upsert($workspace);
        } elseif ($method === 'DELETE') {
            push_subscription_delete($workspace);
        }
        error_response(405, 'METHOD_NOT_ALLOWED', 'Use PUT or DELETE on /push/subscription.');
    }

    if ($sub === 'test' && $method === 'POST') {
        if (!push_enabled()) {
            error_response(409, 'PUSH_DISABLED', 'Push is not configured on this server.');
        }
        $body = read_json_body();
        reject_unknown_fields($body, ['user_id']);
        $userId = require_string($body, 'user_id', 16, 16);
        if (!is_valid_id($userId)) {
            error_response(400, 'INVALID_FIELD', 'Field user_id must be a 16-char id.');
        }
        $queued = enqueue_push((int)$workspace['id'], [$userId], [
            'title' => 'Mahlzeit',
            'body'  => 'Benachrichtigungen funktionieren. 🍽️',
            'url'   => 'https://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . '/w/?w=' . rawurlencode($workspace['token']),
            'tag'   => 'test',
        ]);
        // Deliver right away so the user sees it without waiting for cron.
        $stats = null;
        try {
            $stats = push_send_outbox(20);
        } catch (Throwable $e) {
            error_log('push test send failed: ' . $e->getMessage());
        }
        json_response(200, ['queued' => $queued, 'sent_now' => $stats]);
    }

    error_response(404, 'NOT_FOUND', 'Unknown push path.');
}

function push_subscription_upsert(array $workspace): void
{
    $body = read_json_body();
    reject_unknown_fields($body, ['user_id', 'endpoint', 'keys', 'user_agent']);

    $userId = require_string($body, 'user_id', 16, 16);
    if (!is_valid_id($userId)) {
        error_response(400, 'INVALID_FIELD', 'Field user_id must be a 16-char id.');
    }
    $endpoint = require_string($body, 'endpoint', 500);
    if (!str_starts_with($endpoint, 'https://')) {
        error_response(400, 'INVALID_FIELD', 'Field endpoint must be an https URL.');
    }
    $keys = $body['keys'] ?? null;
    if (!is_array($keys) || !is_string($keys['p256dh'] ?? null) || !is_string($keys['auth'] ?? null)) {
        error_response(400, 'INVALID_FIELD', 'Field keys must contain p256dh and auth.');
    }
    $p256dh = trim($keys['p256dh']);
    $auth   = trim($keys['auth']);
    if ($p256dh === '' || strlen($p256dh) > 200 || $auth === '' || strlen($auth) > 100) {
        error_response(400, 'INVALID_FIELD', 'Field keys has invalid lengths.');
    }
    $ua = mb_substr(optional_string($body, 'user_agent', 500), 0, 200);

    // Same endpoint re-registered (new user_id after a profile import, or a
    // key rotation) → update in place; endpoints are globally unique.
    $stmt = db()->prepare(
        'INSERT INTO push_subscriptions (id, workspace_id, user_id, endpoint, p256dh, auth, user_agent)
         VALUES (:id, :wid, :uid, :endpoint, :p256dh, :auth, :ua)
         ON DUPLICATE KEY UPDATE
            workspace_id = VALUES(workspace_id), user_id = VALUES(user_id),
            p256dh = VALUES(p256dh), auth = VALUES(auth), user_agent = VALUES(user_agent),
            fail_count = 0'
    );
    $stmt->execute([
        ':id'       => generate_id(),
        ':wid'      => $workspace['id'],
        ':uid'      => $userId,
        ':endpoint' => $endpoint,
        ':p256dh'   => $p256dh,
        ':auth'     => $auth,
        ':ua'       => $ua,
    ]);
    json_response(200, ['subscribed' => true]);
}

function push_subscription_delete(array $workspace): void
{
    $body = read_json_body();
    reject_unknown_fields($body, ['endpoint']);
    $endpoint = require_string($body, 'endpoint', 500);
    $stmt = db()->prepare(
        'DELETE FROM push_subscriptions WHERE endpoint = :endpoint AND workspace_id = :wid'
    );
    $stmt->execute([':endpoint' => $endpoint, ':wid' => $workspace['id']]);
    json_response(200, ['subscribed' => false]);
}
