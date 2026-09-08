<?php
declare(strict_types=1);

require_once __DIR__ . '/../shared/db.php';
require_once __DIR__ . '/../shared/ids.php';
require_once __DIR__ . '/http.php';

// GET    /api/favorites?user_id=…&restaurant_id=…   → { dish_ids: [...] }
// PUT    /api/favorites/{dish_id}  { user_id }       → { favorite: true }
// DELETE /api/favorites/{dish_id}  { user_id }       → { favorite: false }
function handle_favorites_route(string $method, array $segments, array $workspace): void
{
    if (count($segments) === 0) {
        if ($method !== 'GET') {
            error_response(405, 'METHOD_NOT_ALLOWED', 'Use GET on /favorites.');
        }
        favorites_list($workspace);
    }

    if (count($segments) === 1) {
        $dishId = $segments[0];
        if (!is_valid_id($dishId)) {
            error_response(404, 'NOT_FOUND', 'Dish not found.');
        }
        if ($method === 'PUT') {
            favorites_set($workspace, $dishId, true);
        } elseif ($method === 'DELETE') {
            favorites_set($workspace, $dishId, false);
        }
        error_response(405, 'METHOD_NOT_ALLOWED', 'Use PUT or DELETE on /favorites/{dish_id}.');
    }

    error_response(404, 'NOT_FOUND', 'Unknown favorites path.');
}

function favorites_list(array $workspace): void
{
    $userId = $_GET['user_id'] ?? '';
    $restaurantId = $_GET['restaurant_id'] ?? '';
    if (!is_string($userId) || !is_valid_id($userId)) {
        error_response(400, 'INVALID_FIELD', 'Query parameter user_id must be a 16-char id.');
    }
    if (!is_string($restaurantId) || !is_valid_id($restaurantId)) {
        error_response(400, 'INVALID_FIELD', 'Query parameter restaurant_id must be a 16-char id.');
    }
    $stmt = db()->prepare(
        'SELECT f.dish_id
         FROM dish_favorites f
         JOIN dishes d ON d.id = f.dish_id
         JOIN restaurants r ON r.id = d.restaurant_id
         WHERE f.workspace_id = :wid AND f.user_id = :uid AND r.id = :rid AND r.workspace_id = :wid2
         ORDER BY d.sort_order ASC, d.name ASC'
    );
    $stmt->execute([
        ':wid'  => $workspace['id'],
        ':uid'  => $userId,
        ':rid'  => $restaurantId,
        ':wid2' => $workspace['id'],
    ]);
    json_response(200, ['dish_ids' => array_column($stmt->fetchAll(), 'dish_id')]);
}

function favorites_set(array $workspace, string $dishId, bool $favorite): void
{
    $body = read_json_body();
    reject_unknown_fields($body, ['user_id']);
    $userId = require_string($body, 'user_id', 16, 16);
    if (!is_valid_id($userId)) {
        error_response(400, 'INVALID_FIELD', 'Field user_id must be a 16-char id.');
    }

    // Cross-workspace protection: the dish must belong to this workspace.
    $check = db()->prepare(
        'SELECT 1 FROM dishes d JOIN restaurants r ON r.id = d.restaurant_id
         WHERE d.id = :did AND r.workspace_id = :wid LIMIT 1'
    );
    $check->execute([':did' => $dishId, ':wid' => $workspace['id']]);
    if (!$check->fetchColumn()) {
        error_response(404, 'DISH_NOT_FOUND', 'Dish not found in this workspace.');
    }

    if ($favorite) {
        $stmt = db()->prepare(
            'INSERT IGNORE INTO dish_favorites (workspace_id, user_id, dish_id) VALUES (:wid, :uid, :did)'
        );
    } else {
        $stmt = db()->prepare(
            'DELETE FROM dish_favorites WHERE workspace_id = :wid AND user_id = :uid AND dish_id = :did'
        );
    }
    $stmt->execute([':wid' => $workspace['id'], ':uid' => $userId, ':did' => $dishId]);
    json_response(200, ['favorite' => $favorite]);
}
