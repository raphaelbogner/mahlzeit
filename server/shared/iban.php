<?php
declare(strict_types=1);

// IBAN cleaning and mod-97 validation (server side).
// Per CLAUDE.md: storage form is cleaned uppercase. Validate every input.

function clean_iban(string $raw): string
{
    return strtoupper(preg_replace('/\s+/', '', $raw) ?? '');
}

function is_valid_iban(string $raw): bool
{
    $iban = clean_iban($raw);
    if (!preg_match('/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/', $iban)) {
        return false;
    }
    if (strlen($iban) < 15 || strlen($iban) > 34) {
        return false;
    }

    // Move first 4 chars to the end, then convert letters to numbers
    // (A=10, B=11, ..., Z=35) and compute mod 97. Result must be 1.
    $rearranged = substr($iban, 4) . substr($iban, 0, 4);
    $numeric = '';
    for ($i = 0, $n = strlen($rearranged); $i < $n; $i++) {
        $c = $rearranged[$i];
        if (ctype_digit($c)) {
            $numeric .= $c;
        } else {
            $numeric .= (string)(ord($c) - 55);
        }
    }

    // Chunked mod-97 to avoid bigint dependencies.
    $remainder = 0;
    for ($i = 0, $n = strlen($numeric); $i < $n; $i += 7) {
        $chunk = $remainder . substr($numeric, $i, 7);
        $remainder = (int)$chunk % 97;
    }
    return $remainder === 1;
}
