<?php
declare(strict_types=1);

require_once __DIR__ . '/../shared/db.php';
require_once __DIR__ . '/../api/http.php';

// Inactivity timeout for admin sessions (4 hours, per PLAN.md §12).
const ADMIN_SESSION_IDLE_TIMEOUT = 4 * 60 * 60;

// Login rate-limit window (per IP).
const ADMIN_LOGIN_MAX_ATTEMPTS = 5;
const ADMIN_LOGIN_WINDOW_SECONDS = 15 * 60;

function admin_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $config = load_config();
    $name = isset($config['admin_session_name']) && is_string($config['admin_session_name'])
        ? $config['admin_session_name']
        : 'mahlzeit_admin';
    session_name($name);

    // HTTPS detection: respect proxy header if present (Hostinger terminates TLS upstream).
    $secure = false;
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        $secure = true;
    } elseif (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') {
        $secure = true;
    }

    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => $secure,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_start();

    // Idle timeout: drop the session if there has been no activity for long enough.
    $now = time();
    if (isset($_SESSION['admin_id'], $_SESSION['last_seen'])) {
        $last = (int)$_SESSION['last_seen'];
        if ($now - $last > ADMIN_SESSION_IDLE_TIMEOUT) {
            $_SESSION = [];
            session_regenerate_id(true);
        }
    }
    if (isset($_SESSION['admin_id'])) {
        $_SESSION['last_seen'] = $now;
    }
}

function admin_is_logged_in(): bool
{
    return isset($_SESSION['admin_id']);
}

// Aborts with 401 if not authenticated. Call at the top of every protected endpoint.
function require_admin(): array
{
    admin_session_start();
    if (!admin_is_logged_in()) {
        error_response(401, 'UNAUTHORIZED', 'Admin login required.');
    }
    return [
        'id'       => (int)$_SESSION['admin_id'],
        'username' => (string)($_SESSION['admin_username'] ?? ''),
    ];
}

// Double-submit CSRF: token lives in the session and is sent back to the client
// on login (and via GET /admin/api/me). State-changing requests must echo it
// in the X-CSRF-Token header.
function admin_csrf_token(): string
{
    admin_session_start();
    if (empty($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function admin_csrf_rotate(): string
{
    admin_session_start();
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf_token'];
}

function require_csrf(): void
{
    admin_session_start();
    $expected = $_SESSION['csrf_token'] ?? null;
    if (!is_string($expected) || $expected === '') {
        error_log(sprintf(
            '[admin csrf] missing in session. session_id=%s sent_len=%d',
            session_id() ?: 'none',
            strlen((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))
        ));
        error_response(403, 'CSRF', 'Missing CSRF token in session.');
    }
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($sent) || $sent === '' || !hash_equals($expected, $sent)) {
        error_log(sprintf(
            '[admin csrf] mismatch. session_id=%s expected_len=%d sent_len=%d sent_prefix=%s expected_prefix=%s',
            session_id() ?: 'none',
            strlen($expected),
            strlen((string)$sent),
            substr((string)$sent, 0, 6),
            substr($expected, 0, 6)
        ));
        error_response(403, 'CSRF', 'Invalid CSRF token.');
    }
}

// Login attempt bookkeeping.
function admin_login_remote_ip(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if (!is_string($ip)) {
        return '';
    }
    return substr($ip, 0, 45);
}

function admin_login_check_rate_limit(string $ip): void
{
    $pdo = db();
    // Opportunistically prune old rows so the table stays small.
    $pdo->prepare(
        'DELETE FROM admin_login_attempts WHERE attempted_at < (NOW() - INTERVAL :sec SECOND)'
    )->execute([':sec' => ADMIN_LOGIN_WINDOW_SECONDS * 4]);

    if ($ip === '') {
        return;
    }
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) AS c FROM admin_login_attempts
         WHERE ip = :ip AND attempted_at > (NOW() - INTERVAL :sec SECOND)'
    );
    $stmt->execute([':ip' => $ip, ':sec' => ADMIN_LOGIN_WINDOW_SECONDS]);
    $row = $stmt->fetch();
    $count = $row ? (int)$row['c'] : 0;
    if ($count >= ADMIN_LOGIN_MAX_ATTEMPTS) {
        error_response(429, 'RATE_LIMITED', 'Too many login attempts. Try again later.');
    }
}

function admin_login_record_attempt(string $ip): void
{
    if ($ip === '') {
        return;
    }
    $stmt = db()->prepare('INSERT INTO admin_login_attempts (ip) VALUES (:ip)');
    $stmt->execute([':ip' => $ip]);
}

function admin_login_clear_attempts(string $ip): void
{
    if ($ip === '') {
        return;
    }
    $stmt = db()->prepare('DELETE FROM admin_login_attempts WHERE ip = :ip');
    $stmt->execute([':ip' => $ip]);
}

// POST /admin/api/login  body {username, password}
function admin_login(): void
{
    admin_session_start();

    $ip = admin_login_remote_ip();
    admin_login_check_rate_limit($ip);

    $body = read_json_body();
    reject_unknown_fields($body, ['username', 'password']);
    $username = require_string($body, 'username', 60);
    $password = require_string($body, 'password', 200);

    $stmt = db()->prepare('SELECT id, username, password_hash FROM admins WHERE username = :u LIMIT 1');
    $stmt->execute([':u' => $username]);
    $row = $stmt->fetch();

    if (!$row || !password_verify($password, (string)$row['password_hash'])) {
        admin_login_record_attempt($ip);
        // Constant-ish response: we already validated input, so timing is roughly stable.
        error_response(401, 'INVALID_CREDENTIALS', 'Username or password incorrect.');
    }

    // Login success: rotate session ID, clear attempts, issue fresh CSRF token.
    session_regenerate_id(true);
    $_SESSION['admin_id']       = (int)$row['id'];
    $_SESSION['admin_username'] = (string)$row['username'];
    $_SESSION['last_seen']      = time();
    $csrf = admin_csrf_rotate();
    admin_login_clear_attempts($ip);

    json_response(200, [
        'admin'      => ['id' => (int)$row['id'], 'username' => (string)$row['username']],
        'csrf_token' => $csrf,
    ]);
}

// POST /admin/api/logout
function admin_logout(): void
{
    admin_session_start();
    require_csrf();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires'  => time() - 42000,
            'path'     => $params['path'],
            'domain'   => $params['domain'] ?? '',
            'secure'   => $params['secure'],
            'httponly' => $params['httponly'],
            'samesite' => $params['samesite'] ?? 'Strict',
        ]);
    }
    session_destroy();
    http_response_code(204);
    exit;
}

// GET /admin/api/me — used by the frontend to bootstrap state and pick up CSRF.
function admin_me(): void
{
    admin_session_start();
    if (!admin_is_logged_in()) {
        json_response(200, ['authenticated' => false]);
    }
    json_response(200, [
        'authenticated' => true,
        'admin' => [
            'id'       => (int)$_SESSION['admin_id'],
            'username' => (string)($_SESSION['admin_username'] ?? ''),
        ],
        'csrf_token' => admin_csrf_token(),
    ]);
}
