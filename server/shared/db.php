<?php
declare(strict_types=1);

// PDO singleton. Reads DB credentials from config.php which lives outside
// the repo (loaded by path next to public_html/). On Hostinger this file
// sits alongside index.php; locally it can sit in the project root.

function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $config = load_config();
    $db = $config['db'] ?? null;
    if (!is_array($db)) {
        throw new RuntimeException('config.php missing "db" section');
    }

    $host = $db['host'] ?? '127.0.0.1';
    $name = $db['name'] ?? '';
    $user = $db['user'] ?? '';
    $pass = $db['pass'] ?? '';
    $port = (int)($db['port'] ?? 3306);
    $charset = 'utf8mb4';

    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset={$charset}";
    $opts = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    $pdo = new PDO($dsn, $user, $pass, $opts);
    $pdo->exec("SET time_zone = '+00:00'");
    return $pdo;
}

function load_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    // Search upward from this file. config.php is expected outside the repo
    // in production (next to public_html/) and at the repo root locally.
    $candidates = [
        __DIR__ . '/../../config.php',           // repo root (local dev)
        __DIR__ . '/../../../config.php',        // one above repo root
        dirname($_SERVER['DOCUMENT_ROOT'] ?? '') . '/config.php',
        ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/../config.php',
    ];

    foreach ($candidates as $path) {
        if ($path && is_file($path)) {
            $loaded = require $path;
            if (is_array($loaded)) {
                $config = $loaded;
                return $config;
            }
        }
    }

    throw new RuntimeException('config.php not found');
}
