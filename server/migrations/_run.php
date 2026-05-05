<?php
declare(strict_types=1);

// One-shot migration runner. Reads every .sql file in this directory
// (sorted by filename) and executes its statements via the existing
// shared/db.php PDO singleton.
//
// Usage:
//   php server/migrations/_run.php           # run all
//   php server/migrations/_run.php 001       # run only files matching "001"
//
// Migrations are idempotent (IF NOT EXISTS), so re-running is safe.
// Delete this file once you've ported these to a real migrations tool.

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    echo "CLI only.\n";
    exit(1);
}

require_once __DIR__ . '/../shared/db.php';

$filter = $argv[1] ?? null;

$files = glob(__DIR__ . '/*.sql') ?: [];
sort($files);

if ($filter !== null) {
    $files = array_values(array_filter(
        $files,
        static fn (string $f) => str_contains(basename($f), $filter)
    ));
}

if ($files === []) {
    fwrite(STDERR, "No migration files matched.\n");
    exit(1);
}

$pdo = db();

foreach ($files as $file) {
    $name = basename($file);
    fwrite(STDOUT, "==> {$name}\n");

    $sql = file_get_contents($file);
    if ($sql === false) {
        fwrite(STDERR, "  could not read {$file}\n");
        exit(1);
    }

    // Naive splitter: split on `;` at end-of-line. Good enough for our
    // straightforward DDL files — no procedures, no DELIMITER blocks.
    $statements = array_map('trim', preg_split('/;\s*\R/', $sql) ?: []);

    foreach ($statements as $stmt) {
        // Strip leading -- comment lines from each statement so that a
        // commented block followed by SQL still executes the SQL part.
        $clean = $stmt;
        while (preg_match('/^\s*--[^\n]*(\R|$)/', $clean)) {
            $clean = preg_replace('/^\s*--[^\n]*(\R|$)/', '', $clean, 1) ?? '';
        }
        $clean = trim($clean);
        if ($clean === '') continue;
        try {
            $pdo->exec($clean);
        } catch (PDOException $e) {
            fwrite(STDERR, "  ✗ failed:\n  {$clean}\n  → {$e->getMessage()}\n");
            exit(1);
        }
    }
    fwrite(STDOUT, "  ✓ ok\n");
}

fwrite(STDOUT, "Done.\n");
