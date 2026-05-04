<?php
declare(strict_types=1);

// One-shot seed script: creates the initial admin user.
//
// Usage (CLI):
//   php server/seed.php <username> <password>
//   php server/seed.php                              (interactive)
//   php server/seed.php --create-test-workspace <name>
//
// Manual SQL alternative for creating a workspace during development:
//   INSERT INTO workspaces (token, name)
//     VALUES ('<43-char-base64url>', 'Dev');
//   You can generate a token in PHP with:
//     php -r "require 'server/shared/ids.php'; echo generate_workspace_token(), PHP_EOL;"
//
// IMPORTANT: delete this file after the initial deploy is set up.

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    header('Content-Type: text/plain');
    echo "seed.php may only be run from the command line.\n";
    exit(1);
}

require_once __DIR__ . '/shared/db.php';
require_once __DIR__ . '/shared/ids.php';

$argv = $_SERVER['argv'] ?? [];
array_shift($argv); // drop script name

// Optional: --create-test-workspace <name> creates a workspace and prints
// its token. Useful before the admin UI exists (Phase 1.5).
if (($argv[0] ?? null) === '--create-test-workspace') {
    $name = $argv[1] ?? 'Dev Workspace';
    $token = generate_workspace_token();
    $stmt = db()->prepare('INSERT INTO workspaces (token, name) VALUES (:t, :n)');
    $stmt->execute([':t' => $token, ':n' => $name]);
    fwrite(STDOUT, "Created workspace \"{$name}\".\n");
    fwrite(STDOUT, "Token: {$token}\n");
    fwrite(STDOUT, "Share URL example: https://your-domain/w/?w={$token}\n");
    exit(0);
}

[$username, $password] = collect_admin_credentials($argv);

if ($username === '' || strlen($username) > 60) {
    fwrite(STDERR, "Username must be 1-60 characters.\n");
    exit(1);
}
if (strlen($password) < 8) {
    fwrite(STDERR, "Password must be at least 8 characters.\n");
    exit(1);
}

$pdo = db();
$existing = $pdo->prepare('SELECT id FROM admins WHERE username = :u LIMIT 1');
$existing->execute([':u' => $username]);
if ($existing->fetch()) {
    fwrite(STDERR, "Admin \"{$username}\" already exists. Aborting.\n");
    exit(1);
}

$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = $pdo->prepare('INSERT INTO admins (username, password_hash) VALUES (:u, :h)');
$stmt->execute([':u' => $username, ':h' => $hash]);

fwrite(STDOUT, "Admin user \"{$username}\" created.\n");
fwrite(STDOUT, "Remember to delete server/seed.php after initial setup.\n");

function collect_admin_credentials(array $argv): array
{
    if (count($argv) >= 2) {
        return [(string)$argv[0], (string)$argv[1]];
    }

    fwrite(STDOUT, "Username: ");
    $username = trim((string)fgets(STDIN));

    $password = read_hidden_password('Password: ');
    $confirm  = read_hidden_password('Confirm:  ');
    if ($password !== $confirm) {
        fwrite(STDERR, "Passwords do not match.\n");
        exit(1);
    }
    return [$username, $password];
}

function read_hidden_password(string $prompt): string
{
    fwrite(STDOUT, $prompt);
    // Best-effort hide: works on POSIX with stty, falls back to plain read on Windows.
    if (DIRECTORY_SEPARATOR === '/' && function_exists('shell_exec')) {
        shell_exec('stty -echo');
        $pw = trim((string)fgets(STDIN));
        shell_exec('stty echo');
        fwrite(STDOUT, "\n");
        return $pw;
    }
    return trim((string)fgets(STDIN));
}
