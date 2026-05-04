<?php
declare(strict_types=1);

// Front controller for /admin/api/* routes. Apache rewrites everything under
// /admin/api/ to this file with the original URI preserved in REQUEST_URI.

require_once __DIR__ . '/../api/http.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/workspaces.php';

set_error_handler(function (int $errno, string $msg, string $file, int $line): bool {
    if (!(error_reporting() & $errno)) {
        return false;
    }
    error_log("PHP error {$errno}: {$msg} at {$file}:{$line}");
    error_response(500, 'INTERNAL', 'Internal server error.');
    return true;
});

set_exception_handler(function (Throwable $e): void {
    error_log('Uncaught exception: ' . $e->getMessage() . "\n" . $e->getTraceAsString());
    error_response(500, 'INTERNAL', 'Internal server error.');
});

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri    = $_SERVER['REQUEST_URI'] ?? '/';

$qpos = strpos($uri, '?');
if ($qpos !== false) {
    $uri = substr($uri, 0, $qpos);
}

$prefix = '/admin/api/';
$pos = strpos($uri, $prefix);
if ($pos === false) {
    if (rtrim($uri, '/') === '/admin/api') {
        error_response(404, 'NOT_FOUND', 'Route not found.');
    }
    error_response(404, 'NOT_FOUND', 'Route not found.');
}
$path = substr($uri, $pos + strlen($prefix));
$path = trim($path, '/');
$segments = $path === '' ? [] : explode('/', $path);

if (count($segments) === 0) {
    error_response(404, 'NOT_FOUND', 'Route not found.');
}

$resource = array_shift($segments);

switch ($resource) {
    case 'login':
        if (count($segments) !== 0) {
            error_response(404, 'NOT_FOUND', 'Unknown login path.');
        }
        if ($method !== 'POST') {
            error_response(405, 'METHOD_NOT_ALLOWED', 'Use POST on /login.');
        }
        admin_login();
        break;

    case 'logout':
        if (count($segments) !== 0) {
            error_response(404, 'NOT_FOUND', 'Unknown logout path.');
        }
        if ($method !== 'POST') {
            error_response(405, 'METHOD_NOT_ALLOWED', 'Use POST on /logout.');
        }
        admin_logout();
        break;

    case 'me':
        if (count($segments) !== 0) {
            error_response(404, 'NOT_FOUND', 'Unknown me path.');
        }
        if ($method !== 'GET') {
            error_response(405, 'METHOD_NOT_ALLOWED', 'Use GET on /me.');
        }
        admin_me();
        break;

    case 'workspaces':
        handle_admin_workspaces_route($method, $segments);
        break;

    default:
        error_response(404, 'NOT_FOUND', 'Unknown resource.');
}
