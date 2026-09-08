<?php
declare(strict_types=1);

// Push cron. Run every minute (5 minutes also works, the deadline warning
// then lands a bit earlier/later):
//   * * * * * php /home/<user>/public_html/cron/push_tick.php >/dev/null 2>&1
//
//  1. "Bestellschluss in 15 min" → known people who have not ordered and
//     did not decline (once per session, flag deadline_notified_at)
//  2. "Noch offen" reminder 3 days after closing for unpaid, unreported
//     items (once per item, flag reminder_sent_at)
//  3. deliver the outbox
//
// CLI only, never reachable via HTTP (deploy .htaccess denies /cron/).

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    echo "CLI only.\n";
    exit(1);
}

require_once __DIR__ . '/../shared/db.php';
require_once __DIR__ . '/../shared/push.php';

if (!push_enabled()) {
    fwrite(STDOUT, "push not configured (config.php: push) – nothing to do\n");
    exit(0);
}

$pdo = db();
$tz  = new DateTimeZone(load_config()['push']['timezone'] ?? 'Europe/Vienna');

// ---- 1. deadline warnings -------------------------------------------------
$due = $pdo->query(
    'SELECT s.id, s.workspace_id, s.title, s.deadline_at, w.token
     FROM sessions s JOIN workspaces w ON w.id = s.workspace_id
     WHERE s.status = "open" AND s.deadline_at IS NOT NULL AND s.deadline_notified_at IS NULL
       AND s.deadline_at > CURRENT_TIMESTAMP
       AND s.deadline_at <= CURRENT_TIMESTAMP + INTERVAL 15 MINUTE'
)->fetchAll();

$known = $pdo->prepare(
    'SELECT DISTINCT i.user_id
     FROM items i JOIN sessions s ON s.id = i.session_id
     WHERE s.workspace_id = :wid AND i.added_at >= CURRENT_TIMESTAMP - INTERVAL 60 DAY'
);
$ordered  = $pdo->prepare('SELECT DISTINCT user_id FROM items WHERE session_id = :sid');
$declined = $pdo->prepare('SELECT user_id FROM session_declines WHERE session_id = :sid');
$flag     = $pdo->prepare('UPDATE sessions SET deadline_notified_at = CURRENT_TIMESTAMP WHERE id = :id');

$warned = 0;
foreach ($due as $s) {
    $known->execute([':wid' => $s['workspace_id']]);
    $knownIds = array_column($known->fetchAll(), 'user_id');
    $ordered->execute([':sid' => $s['id']]);
    $skip = array_column($ordered->fetchAll(), 'user_id');
    $declined->execute([':sid' => $s['id']]);
    $skip = array_merge($skip, array_column($declined->fetchAll(), 'user_id'));
    $targets = array_values(array_diff($knownIds, $skip));

    $local = (new DateTimeImmutable($s['deadline_at'], new DateTimeZone('UTC')))->setTimezone($tz);
    if ($targets !== []) {
        $warned += enqueue_push((int)$s['workspace_id'], $targets, [
            'title' => 'Bestellschluss um ' . $local->format('H:i'),
            'body'  => 'Noch nichts bestellt bei „' . $s['title'] . '“ – jetzt schnell!',
            'url'   => push_session_url(['token' => $s['token']], $s['id']),
            'tag'   => 'deadline-' . $s['id'],
        ]);
    }
    $flag->execute([':id' => $s['id']]);
}

// ---- 2. unpaid reminders ---------------------------------------------------
$open = $pdo->query(
    'SELECT s.id AS session_id, s.workspace_id, s.title, w.token,
            s.creator_id, s.creator_name, s.paid_by_user_id, s.paid_by_user_name,
            i.user_id, SUM(i.price_cents * i.quantity) AS unpaid
     FROM items i
     JOIN sessions s ON s.id = i.session_id
     JOIN workspaces w ON w.id = s.workspace_id
     WHERE s.status = "closed" AND s.archived_at IS NULL
       AND s.closed_at <= CURRENT_TIMESTAMP - INTERVAL 3 DAY
       AND i.price_cents IS NOT NULL AND i.paid_at IS NULL
       AND i.payment_reported_at IS NULL AND i.reminder_sent_at IS NULL
     GROUP BY s.id, i.user_id'
)->fetchAll();

$markReminded = $pdo->prepare(
    'UPDATE items SET reminder_sent_at = CURRENT_TIMESTAMP
     WHERE session_id = :sid AND user_id = :uid AND paid_at IS NULL AND reminder_sent_at IS NULL'
);
$reminded = 0;
foreach ($open as $r) {
    $payerId = $r['paid_by_user_id'] ?? $r['creator_id'];
    if ($r['user_id'] !== $payerId && (int)$r['unpaid'] > 0) {
        $payerName = $r['paid_by_user_id'] !== null ? $r['paid_by_user_name'] : $r['creator_name'];
        $reminded += enqueue_push((int)$r['workspace_id'], [$r['user_id']], [
            'title' => 'Noch offen: ' . push_fmt_eur((int)$r['unpaid']),
            'body'  => 'Für „' . $r['title'] . '“ an ' . $payerName . ' überweisen.',
            'url'   => push_session_url(['token' => $r['token']], $r['session_id']),
            'tag'   => 'reminder-' . $r['session_id'],
        ]);
    }
    $markReminded->execute([':sid' => $r['session_id'], ':uid' => $r['user_id']]);
}

// ---- 3. deliver ------------------------------------------------------------
$stats = push_send_outbox(100);

fwrite(STDOUT, sprintf(
    "deadline-warnings=%d reminders=%d sent=%d failed=%d removed=%d\n",
    $warned, $reminded, $stats['sent'], $stats['failed'], $stats['removed']
));
