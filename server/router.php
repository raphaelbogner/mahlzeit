<?php
declare(strict_types=1);

// Router for the PHP built-in server (does not read .htaccess).
// Usage:
//   php -S 127.0.0.1:8000 -t server/ server/router.php
//
// Routes /admin/api/* to admin/index.php and /api/* to api/index.php.
// Static files are served as-is. Any other request returns 404.

$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH) ?: '/';

if (strpos($path, '/admin/api/') === 0 || $path === '/admin/api') {
    require __DIR__ . '/admin/index.php';
    return true;
}
if (strpos($path, '/api/') === 0 || $path === '/api') {
    require __DIR__ . '/api/index.php';
    return true;
}

// Let the built-in server handle static files inside server/.
$file = __DIR__ . $path;
if ($path !== '/' && is_file($file)) {
    return false;
}

http_response_code(404);
header('Content-Type: application/json; charset=utf-8');
echo '{"error":{"code":"NOT_FOUND","message":"No route here. Try /api/* or /admin/api/*."}}';
return true;
