<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/ids.php';

// Web push plumbing. Requests only *enqueue* (cheap INSERTs); the actual
// delivery happens in cron/push_tick.php via minishlink/web-push so no user
// request ever waits on Google/Apple/Mozilla push services.
//
// Everything here is a no-op when config.php has no 'push' section, and
// every notify_* helper swallows exceptions: a missing table or a push
// hiccup must never break ordering or paying.

function push_config(): ?array
{
    $config = load_config();
    $push = $config['push'] ?? null;
    if (!is_array($push)) {
        return null;
    }
    $public  = (string)($push['vapid_public'] ?? '');
    $private = (string)($push['vapid_private'] ?? '');
    $subject = (string)($push['subject'] ?? '');
    if ($public === '' || $private === '' || $subject === '') {
        return null;
    }
    return ['public' => $public, 'private' => $private, 'subject' => $subject];
}

function push_enabled(): bool
{
    return push_config() !== null;
}

// https://host/w/s/{id}?w={token} — the same link the client shares.
function push_session_url(array $workspace, string $sessionId): string
{
    $host = $_SERVER['HTTP_HOST'] ?? (load_config()['push']['host'] ?? 'localhost');
    return 'https://' . $host . '/w/s/' . rawurlencode($sessionId) . '?w=' . rawurlencode($workspace['token']);
}

function push_workspace_by_id(int $workspaceId): ?array
{
    $stmt = db()->prepare('SELECT id, token, name FROM workspaces WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $workspaceId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

// Queue one payload for every subscription of the given users (or of the
// whole workspace when $userIds is null), optionally excluding one user.
function enqueue_push(int $workspaceId, ?array $userIds, array $payload, ?string $excludeUserId = null): int
{
    if (!push_enabled()) {
        return 0;
    }
    if ($userIds !== null) {
        $userIds = array_values(array_unique(array_filter($userIds, static fn($u) => is_string($u) && $u !== $excludeUserId)));
        if ($userIds === []) {
            return 0;
        }
    }

    $pdo = db();
    $sql = 'SELECT id FROM push_subscriptions WHERE workspace_id = :wid';
    $params = [':wid' => $workspaceId];
    if ($userIds !== null) {
        $marks = [];
        foreach ($userIds as $i => $uid) {
            $marks[] = ":u{$i}";
            $params[":u{$i}"] = $uid;
        }
        $sql .= ' AND user_id IN (' . implode(',', $marks) . ')';
    } elseif ($excludeUserId !== null) {
        $sql .= ' AND user_id <> :ex';
        $params[':ex'] = $excludeUserId;
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $subIds = array_map(static fn(array $r): string => $r['id'], $stmt->fetchAll());
    if ($subIds === []) {
        return 0;
    }

    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $ins = $pdo->prepare('INSERT INTO push_outbox (subscription_id, payload_json) VALUES (:sid, :payload)');
    foreach ($subIds as $sid) {
        $ins->execute([':sid' => $sid, ':payload' => $json]);
    }
    return count($subIds);
}

function push_fmt_eur(int $cents): string
{
    return number_format($cents / 100, 2, ',', '.') . ' €';
}

// ----- Event helpers (called from the API; never throw) -----

function notify_session_created(array $workspace, array $session): void
{
    try {
        if (!push_enabled()) {
            return;
        }
        $where = $session['restaurant_name'] !== '' ? ' bei ' . $session['restaurant_name'] : '';
        $when = '';
        if (!empty($session['deadline_at'])) {
            $dt = new DateTimeImmutable($session['deadline_at'], new DateTimeZone('UTC'));
            $local = $dt->setTimezone(new DateTimeZone(load_config()['push']['timezone'] ?? 'Europe/Vienna'));
            $when = ' – bestellen bis ' . $local->format('H:i');
        }
        enqueue_push((int)$workspace['id'], null, [
            'title' => 'Neue Sammelbestellung',
            'body'  => '„' . $session['title'] . '“' . $where . $when,
            'url'   => push_session_url($workspace, $session['id']),
            'tag'   => 'session-open-' . $session['id'],
        ], $session['creator_id']);
    } catch (Throwable $e) {
        error_log('push notify_session_created failed: ' . $e->getMessage());
    }
}

// Everyone with an unpaid amount gets "please transfer X to Y".
function notify_session_closed(int $workspaceId, string $sessionId): void
{
    try {
        if (!push_enabled()) {
            return;
        }
        $workspace = push_workspace_by_id($workspaceId);
        if ($workspace === null) {
            return;
        }
        $pdo = db();
        $s = $pdo->prepare(
            'SELECT id, title, creator_id, creator_name, paid_by_user_id, paid_by_user_name, discount_cents
             FROM sessions WHERE id = :id AND workspace_id = :wid LIMIT 1'
        );
        $s->execute([':id' => $sessionId, ':wid' => $workspaceId]);
        $session = $s->fetch();
        if (!$session) {
            return;
        }
        $payerId   = $session['paid_by_user_id'] ?? $session['creator_id'];
        $payerName = $session['paid_by_user_id'] !== null ? $session['paid_by_user_name'] : $session['creator_name'];

        $t = $pdo->prepare(
            'SELECT user_id, SUM(price_cents * quantity) AS unpaid
             FROM items WHERE session_id = :sid AND price_cents IS NOT NULL AND paid_at IS NULL
             GROUP BY user_id'
        );
        $t->execute([':sid' => $sessionId]);
        $approx = (int)$session['discount_cents'] > 0 ? 'ca. ' : '';
        foreach ($t->fetchAll() as $row) {
            if ($row['user_id'] === $payerId || (int)$row['unpaid'] <= 0) {
                continue;
            }
            enqueue_push($workspaceId, [$row['user_id']], [
                'title' => 'Bestellung geschlossen',
                'body'  => 'Bitte ' . $approx . push_fmt_eur((int)$row['unpaid']) . ' an ' . $payerName . ' überweisen („' . $session['title'] . '“).',
                'url'   => push_session_url($workspace, $sessionId),
                'tag'   => 'session-closed-' . $sessionId,
            ]);
        }
    } catch (Throwable $e) {
        error_log('push notify_session_closed failed: ' . $e->getMessage());
    }
}

function notify_payment_confirmed(array $session, string $userId): void
{
    try {
        if (!push_enabled()) {
            return;
        }
        $workspace = push_workspace_by_id((int)$session['workspace_id']);
        if ($workspace === null) {
            return;
        }
        $payerName = $session['paid_by_user_id'] !== null ? $session['paid_by_user_name'] : $session['creator_name'];
        enqueue_push((int)$session['workspace_id'], [$userId], [
            'title' => 'Zahlung bestätigt',
            'body'  => $payerName . ' hat deine Zahlung für „' . $session['title'] . '“ bestätigt.',
            'url'   => push_session_url($workspace, $session['id']),
            'tag'   => 'paid-' . $session['id'],
        ]);
    } catch (Throwable $e) {
        error_log('push notify_payment_confirmed failed: ' . $e->getMessage());
    }
}

// ----- Delivery (cron) -----

// Sends up to $limit queued notifications. Requires vendor/autoload.php
// (composer install in server/). Returns counters for logging.
function push_send_outbox(int $limit = 100): array
{
    $stats = ['sent' => 0, 'failed' => 0, 'removed' => 0, 'skipped' => 0];
    $cfg = push_config();
    if ($cfg === null) {
        $stats['skipped'] = -1;
        return $stats;
    }
    $autoload = __DIR__ . '/../vendor/autoload.php';
    if (!is_file($autoload)) {
        throw new RuntimeException('vendor/autoload.php missing – run composer install in server/.');
    }
    require_once $autoload;

    $pdo = db();
    $q = $pdo->prepare(
        'SELECT o.id AS outbox_id, o.payload_json, o.attempts,
                s.id AS sub_id, s.endpoint, s.p256dh, s.auth
         FROM push_outbox o
         JOIN push_subscriptions s ON s.id = o.subscription_id
         WHERE o.sent_at IS NULL AND o.attempts < 5
         ORDER BY o.created_at ASC
         LIMIT ' . (int)$limit
    );
    $q->execute();
    $rows = $q->fetchAll();
    if ($rows === []) {
        return $stats;
    }

    $webPush = new \Minishlink\WebPush\WebPush([
        'VAPID' => [
            'subject'    => $cfg['subject'],
            'publicKey'  => $cfg['public'],
            'privateKey' => $cfg['private'],
        ],
    ]);
    $webPush->setReuseVAPIDHeaders(true);

    $byEndpoint = [];
    foreach ($rows as $r) {
        $byEndpoint[$r['endpoint']][] = $r;
        $webPush->queueNotification(
            \Minishlink\WebPush\Subscription::create([
                'endpoint'        => $r['endpoint'],
                'publicKey'       => $r['p256dh'],
                'authToken'       => $r['auth'],
                'contentEncoding' => 'aes128gcm',
            ]),
            $r['payload_json'],
            ['TTL' => 3600]
        );
    }

    $markSent   = $pdo->prepare('UPDATE push_outbox SET sent_at = UTC_TIMESTAMP(), attempts = attempts + 1 WHERE id = :id');
    $markFailed = $pdo->prepare('UPDATE push_outbox SET attempts = attempts + 1, last_error = :err WHERE id = :id');
    $subOk      = $pdo->prepare('UPDATE push_subscriptions SET last_success_at = UTC_TIMESTAMP(), fail_count = 0 WHERE id = :id');
    $subFail    = $pdo->prepare('UPDATE push_subscriptions SET fail_count = fail_count + 1 WHERE id = :id');
    $subDelete  = $pdo->prepare('DELETE FROM push_subscriptions WHERE id = :id');

    foreach ($webPush->flush() as $report) {
        $endpoint = $report->getEndpoint();
        $queued = array_shift($byEndpoint[$endpoint]) ?? null;
        if ($queued === null) {
            continue;
        }
        if ($report->isSuccess()) {
            $markSent->execute([':id' => $queued['outbox_id']]);
            $subOk->execute([':id' => $queued['sub_id']]);
            $stats['sent']++;
        } elseif ($report->isSubscriptionExpired()) {
            // 404/410: the browser dropped the subscription. Outbox rows go
            // with it via ON DELETE CASCADE.
            $subDelete->execute([':id' => $queued['sub_id']]);
            $stats['removed']++;
        } else {
            $markFailed->execute([':id' => $queued['outbox_id'], ':err' => mb_substr($report->getReason(), 0, 200)]);
            $subFail->execute([':id' => $queued['sub_id']]);
            $stats['failed']++;
        }
    }

    // Subscriptions failing persistently are dead weight.
    $pdo->exec('DELETE FROM push_subscriptions WHERE fail_count >= 5');
    return $stats;
}
