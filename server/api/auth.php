<?php
declare(strict_types=1);

require_once __DIR__ . '/../shared/db.php';
require_once __DIR__ . '/http.php';

// Returns the workspace row {id, token, name, created_at} or sends 401.
// Token is read from header X-Workspace-Token first, then ?w= query param.
function require_workspace(): array
{
    $token = workspace_token_from_request();
    if ($token === null) {
        error_response(401, 'UNAUTHORIZED', 'Workspace token required.');
    }

    $stmt = db()->prepare(
        'SELECT id, token, name, created_at FROM workspaces WHERE token = :t LIMIT 1'
    );
    $stmt->execute([':t' => $token]);
    $row = $stmt->fetch();
    if (!$row) {
        error_response(401, 'UNAUTHORIZED', 'Invalid workspace token.');
    }
    return $row;
}

function workspace_token_from_request(): ?string
{
    // Prefer the header (works for any HTTP method, no URL leakage).
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    if (is_array($headers)) {
        foreach ($headers as $k => $v) {
            if (strcasecmp($k, 'X-Workspace-Token') === 0 && is_string($v) && $v !== '') {
                return $v;
            }
        }
    }
    if (isset($_SERVER['HTTP_X_WORKSPACE_TOKEN']) && $_SERVER['HTTP_X_WORKSPACE_TOKEN'] !== '') {
        return (string)$_SERVER['HTTP_X_WORKSPACE_TOKEN'];
    }
    if (isset($_GET['w']) && is_string($_GET['w']) && $_GET['w'] !== '') {
        return $_GET['w'];
    }
    return null;
}
