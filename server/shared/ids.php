<?php
declare(strict_types=1);

// 16-character lowercase base32-ish ID derived from 10 random bytes.
// Used for sessions, items, restaurants, dishes, option groups, options.
function generate_id(): string
{
    $bytes = random_bytes(10);
    $alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    $out = '';
    for ($i = 0; $i < 16; $i++) {
        $out .= $alphabet[ord($bytes[$i % 10]) % 36];
    }
    return $out;
}

// 43-character base64url token from 32 random bytes (workspace tokens).
function generate_workspace_token(): string
{
    $bytes = random_bytes(32);
    $b64 = rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    return $b64;
}

function is_valid_id(?string $id): bool
{
    return is_string($id) && preg_match('/^[a-z0-9]{16}$/', $id) === 1;
}
