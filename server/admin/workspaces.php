<?php
declare(strict_types=1);

require_once __DIR__ . '/../shared/db.php';
require_once __DIR__ . '/../shared/ids.php';
require_once __DIR__ . '/../api/http.php';
require_once __DIR__ . '/auth.php';

// Dispatcher for /admin/api/workspaces[/{id}[/rotate]]
function handle_admin_workspaces_route(string $method, array $segments): void
{
    require_admin();

    if (count($segments) === 0) {
        if ($method === 'GET') {
            admin_workspaces_list();
        } elseif ($method === 'POST') {
            require_csrf();
            admin_workspaces_create();
        } else {
            error_response(405, 'METHOD_NOT_ALLOWED', 'Use GET or POST on /workspaces.');
        }
        return;
    }

    $idRaw = $segments[0];
    $workspaceId = filter_var($idRaw, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($workspaceId === false) {
        error_response(404, 'NOT_FOUND', 'Workspace not found.');
    }

    if (count($segments) === 1) {
        if ($method === 'GET') {
            admin_workspaces_get($workspaceId);
        } elseif ($method === 'PATCH') {
            require_csrf();
            admin_workspaces_patch($workspaceId);
        } elseif ($method === 'DELETE') {
            require_csrf();
            admin_workspaces_delete($workspaceId);
        } else {
            error_response(405, 'METHOD_NOT_ALLOWED', 'Use GET, PATCH or DELETE on /workspaces/{id}.');
        }
        return;
    }

    if (count($segments) === 2 && $segments[1] === 'rotate') {
        if ($method !== 'POST') {
            error_response(405, 'METHOD_NOT_ALLOWED', 'Use POST on /workspaces/{id}/rotate.');
        }
        require_csrf();
        admin_workspaces_rotate($workspaceId);
        return;
    }

    error_response(404, 'NOT_FOUND', 'Unknown workspaces path.');
}

function admin_workspaces_list(): void
{
    // Single query with subselects — N is small (one row per workspace).
    $sql = 'SELECT
              w.id, w.token, w.name, w.created_at,
              (SELECT COUNT(*) FROM sessions s WHERE s.workspace_id = w.id) AS sessions_total,
              (SELECT COUNT(*) FROM sessions s WHERE s.workspace_id = w.id AND s.status = "open") AS sessions_open,
              (SELECT COUNT(*) FROM items i JOIN sessions s ON s.id = i.session_id WHERE s.workspace_id = w.id) AS items_total,
              (SELECT COUNT(*) FROM restaurants r WHERE r.workspace_id = w.id) AS restaurants_total,
              (SELECT MAX(latest) FROM (
                  SELECT MAX(s.created_at) AS latest FROM sessions s WHERE s.workspace_id = w.id
                  UNION ALL
                  SELECT MAX(i.added_at) FROM items i JOIN sessions s ON s.id = i.session_id WHERE s.workspace_id = w.id
              ) t) AS last_activity
            FROM workspaces w
            ORDER BY w.created_at DESC';
    $rows = db()->query($sql)->fetchAll();

    $workspaces = array_map(static function (array $row): array {
        return [
            'id'         => (int)$row['id'],
            'name'       => (string)$row['name'],
            'token'      => (string)$row['token'],
            'url'        => workspace_share_url((string)$row['token']),
            'created_at' => $row['created_at'],
            'stats'      => [
                'sessions_total'    => (int)$row['sessions_total'],
                'sessions_open'     => (int)$row['sessions_open'],
                'items_total'       => (int)$row['items_total'],
                'restaurants_total' => (int)$row['restaurants_total'],
                'last_activity'     => $row['last_activity'],
            ],
        ];
    }, $rows);

    json_response(200, ['workspaces' => $workspaces]);
}

function admin_workspaces_create(): void
{
    $body = read_json_body();
    reject_unknown_fields($body, ['name']);
    $name = require_string($body, 'name', 120);

    $token = generate_workspace_token();
    $stmt = db()->prepare('INSERT INTO workspaces (token, name) VALUES (:t, :n)');
    $stmt->execute([':t' => $token, ':n' => $name]);
    $id = (int)db()->lastInsertId();

    admin_workspaces_get($id, 201);
}

function admin_workspaces_get(int $id, int $status = 200): void
{
    $row = load_workspace_or_404($id);

    // Note: PDO with EMULATE_PREPARES=false forbids reusing the same named
    // placeholder more than once, so each workspace_id reference gets its own.
    $statsStmt = db()->prepare(
        'SELECT
            (SELECT COUNT(*) FROM sessions s WHERE s.workspace_id = :wid1) AS sessions_total,
            (SELECT COUNT(*) FROM sessions s WHERE s.workspace_id = :wid2 AND s.status = "open") AS sessions_open,
            (SELECT COUNT(*) FROM items i JOIN sessions s ON s.id = i.session_id WHERE s.workspace_id = :wid3) AS items_total,
            (SELECT COUNT(*) FROM restaurants r WHERE r.workspace_id = :wid4) AS restaurants_total,
            (SELECT MAX(latest) FROM (
                SELECT MAX(s.created_at) AS latest FROM sessions s WHERE s.workspace_id = :wid5
                UNION ALL
                SELECT MAX(i.added_at) FROM items i JOIN sessions s ON s.id = i.session_id WHERE s.workspace_id = :wid6
            ) t) AS last_activity'
    );
    $statsStmt->execute([
        ':wid1' => $id, ':wid2' => $id, ':wid3' => $id,
        ':wid4' => $id, ':wid5' => $id, ':wid6' => $id,
    ]);
    $stats = $statsStmt->fetch() ?: [];

    $activeUsers = load_active_users($id);

    json_response($status, [
        'id'           => (int)$row['id'],
        'name'         => (string)$row['name'],
        'token'        => (string)$row['token'],
        'url'          => workspace_share_url((string)$row['token']),
        'created_at'   => $row['created_at'],
        'stats'        => [
            'sessions_total'    => (int)($stats['sessions_total'] ?? 0),
            'sessions_open'     => (int)($stats['sessions_open'] ?? 0),
            'items_total'       => (int)($stats['items_total'] ?? 0),
            'restaurants_total' => (int)($stats['restaurants_total'] ?? 0),
            'last_activity'     => $stats['last_activity'] ?? null,
        ],
        'active_users' => $activeUsers,
    ]);
}

function admin_workspaces_patch(int $id): void
{
    load_workspace_or_404($id);

    $body = read_json_body();
    reject_unknown_fields($body, ['name']);
    $name = require_string($body, 'name', 120);

    $stmt = db()->prepare('UPDATE workspaces SET name = :n WHERE id = :id');
    $stmt->execute([':n' => $name, ':id' => $id]);

    admin_workspaces_get($id);
}

function admin_workspaces_rotate(int $id): void
{
    load_workspace_or_404($id);

    $newToken = generate_workspace_token();
    $stmt = db()->prepare('UPDATE workspaces SET token = :t WHERE id = :id');
    $stmt->execute([':t' => $newToken, ':id' => $id]);

    admin_workspaces_get($id);
}

function admin_workspaces_delete(int $id): void
{
    load_workspace_or_404($id);

    $stmt = db()->prepare('DELETE FROM workspaces WHERE id = :id');
    $stmt->execute([':id' => $id]);

    http_response_code(204);
    exit;
}

function load_workspace_or_404(int $id): array
{
    $stmt = db()->prepare('SELECT id, token, name, created_at FROM workspaces WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();
    if (!$row) {
        error_response(404, 'NOT_FOUND', 'Workspace not found.');
    }
    return $row;
}

// "Active users": union of distinct names from items.user_name and sessions.creator_name,
// aggregated with first/last activity and per-name item counts. Names with the same string
// collapse into a single row — documented limitation of the no-login model (PLAN.md §4).
function load_active_users(int $workspaceId): array
{
    $sql = 'SELECT name,
                   MIN(first_seen) AS first_seen,
                   MAX(last_seen)  AS last_seen,
                   SUM(items_count) AS items_count
            FROM (
                SELECT i.user_name AS name,
                       MIN(i.added_at) AS first_seen,
                       MAX(i.added_at) AS last_seen,
                       COUNT(*) AS items_count
                FROM items i
                JOIN sessions s ON s.id = i.session_id
                WHERE s.workspace_id = :wid1
                GROUP BY i.user_name
                UNION ALL
                SELECT s.creator_name AS name,
                       MIN(s.created_at) AS first_seen,
                       MAX(s.created_at) AS last_seen,
                       0 AS items_count
                FROM sessions s
                WHERE s.workspace_id = :wid2
                GROUP BY s.creator_name
            ) u
            GROUP BY name
            ORDER BY last_seen DESC, name ASC';
    $stmt = db()->prepare($sql);
    $stmt->execute([':wid1' => $workspaceId, ':wid2' => $workspaceId]);
    $rows = $stmt->fetchAll();

    return array_map(static function (array $row): array {
        return [
            'name'        => (string)$row['name'],
            'first_seen'  => $row['first_seen'],
            'last_seen'   => $row['last_seen'],
            'items_count' => (int)$row['items_count'],
        ];
    }, $rows);
}

// Build the share URL based on the current host. Falls back to a placeholder
// if the host header is unavailable; the frontend can also build URLs itself.
function workspace_share_url(string $token): string
{
    $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
          || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
        ? 'https' : 'http';
    $host = (string)($_SERVER['HTTP_HOST'] ?? '');
    if ($host === '') {
        return '/w/?w=' . $token;
    }
    return $proto . '://' . $host . '/w/?w=' . $token;
}
