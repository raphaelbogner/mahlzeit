<?php
declare(strict_types=1);

// Front controller for /api/* routes. Apache rewrites everything under /api/
// to this file with the original URI preserved in REQUEST_URI.

require_once __DIR__ . '/http.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/sessions.php';
require_once __DIR__ . '/items.php';
require_once __DIR__ . '/restaurants.php';

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

// Strip query string.
$qpos = strpos($uri, '?');
if ($qpos !== false) {
    $uri = substr($uri, 0, $qpos);
}

// Strip the /api prefix. Apache rewrites preserve the original URI here,
// so we look for /api/ explicitly rather than relying on PATH_INFO.
$apiPos = strpos($uri, '/api/');
if ($apiPos === false) {
    if (rtrim($uri, '/') === '/api') {
        error_response(404, 'NOT_FOUND', 'Route not found.');
    }
    error_response(404, 'NOT_FOUND', 'Route not found.');
}
$path = substr($uri, $apiPos + strlen('/api/'));
$path = trim($path, '/');
$segments = $path === '' ? [] : explode('/', $path);

if (count($segments) === 0) {
    error_response(404, 'NOT_FOUND', 'Route not found.');
}

// All workspace endpoints require a valid token.
$workspace = require_workspace();

$resource = array_shift($segments);

switch ($resource) {
    case 'sessions':
        // sessions[/{id}[/items[/{itemId}]]]
        if (count($segments) >= 2 && $segments[1] === 'items') {
            $sessionId = $segments[0];
            if (!is_valid_id($sessionId)) {
                error_response(404, 'NOT_FOUND', 'Session not found.');
            }
            $itemSegments = array_slice($segments, 2);
            handle_items_route($method, $itemSegments, $workspace, $sessionId);
        } else {
            handle_sessions_route($method, $segments, $workspace);
        }
        break;

    case 'restaurants':
        handle_restaurants_route($method, $segments, $workspace);
        break;

    default:
        error_response(404, 'NOT_FOUND', 'Unknown resource.');
}
