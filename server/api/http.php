<?php
declare(strict_types=1);

function json_response(int $status, $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function error_response(int $status, string $code, string $message): void
{
    json_response($status, ['error' => ['code' => $code, 'message' => $message]]);
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        error_response(400, 'BAD_JSON', 'Request body must be a JSON object.');
    }
    return $data;
}

// Returns the value if present and a string within length limits, otherwise
// triggers a 400 with a precise message. min defaults to 1 (non-empty).
function require_string(array $body, string $field, int $max, int $min = 1): string
{
    if (!array_key_exists($field, $body)) {
        error_response(400, 'MISSING_FIELD', "Missing field: {$field}");
    }
    $v = $body[$field];
    if (!is_string($v)) {
        error_response(400, 'INVALID_FIELD', "Field {$field} must be a string.");
    }
    $v = trim($v);
    if (strlen($v) < $min) {
        error_response(400, 'INVALID_FIELD', "Field {$field} must not be empty.");
    }
    if (strlen($v) > $max) {
        error_response(400, 'INVALID_FIELD', "Field {$field} exceeds max length of {$max}.");
    }
    return $v;
}

function optional_string(array $body, string $field, int $max): string
{
    if (!array_key_exists($field, $body) || $body[$field] === null) {
        return '';
    }
    $v = $body[$field];
    if (!is_string($v)) {
        error_response(400, 'INVALID_FIELD', "Field {$field} must be a string.");
    }
    $v = trim($v);
    if (strlen($v) > $max) {
        error_response(400, 'INVALID_FIELD', "Field {$field} exceeds max length of {$max}.");
    }
    return $v;
}

// Reject any field in the body that isn't whitelisted. Per CLAUDE.md:
// "Reject unknown fields rather than ignoring."
function reject_unknown_fields(array $body, array $allowed): void
{
    foreach (array_keys($body) as $key) {
        if (!in_array($key, $allowed, true)) {
            error_response(400, 'UNKNOWN_FIELD', "Unknown field: {$key}");
        }
    }
}
