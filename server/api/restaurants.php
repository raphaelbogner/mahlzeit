<?php
declare(strict_types=1);

require_once __DIR__ . '/../shared/db.php';
require_once __DIR__ . '/../shared/ids.php';
require_once __DIR__ . '/http.php';

// Dispatcher for /api/restaurants[/{id}[/menu]]. /menu is dispatched here
// but handled in menu.php.
function handle_restaurants_route(string $method, array $segments, array $workspace): void
{
    if (count($segments) === 0) {
        if ($method === 'GET') {
            restaurants_list($workspace);
        } elseif ($method === 'POST') {
            restaurants_create($workspace);
        } else {
            error_response(405, 'METHOD_NOT_ALLOWED', 'Use GET or POST on /restaurants.');
        }
        return;
    }

    $id = $segments[0];
    if (!is_valid_id($id)) {
        error_response(404, 'NOT_FOUND', 'Restaurant not found.');
    }

    if (count($segments) === 1) {
        if ($method === 'GET') {
            restaurants_get($workspace, $id);
        } elseif ($method === 'PATCH') {
            restaurants_patch($workspace, $id);
        } elseif ($method === 'DELETE') {
            restaurants_delete($workspace, $id);
        } else {
            error_response(405, 'METHOD_NOT_ALLOWED', 'Use GET, PATCH or DELETE on /restaurants/{id}.');
        }
        return;
    }

    if (count($segments) === 2 && $segments[1] === 'menu') {
        require_once __DIR__ . '/menu.php';
        if ($method === 'PUT') {
            menu_replace($workspace, $id);
        } else {
            error_response(405, 'METHOD_NOT_ALLOWED', 'Use PUT on /restaurants/{id}/menu.');
        }
        return;
    }

    error_response(404, 'NOT_FOUND', 'Unknown restaurants path.');
}

function restaurants_list(array $workspace): void
{
    $stmt = db()->prepare(
        'SELECT r.id, r.name, r.created_at,
                (SELECT COUNT(*) FROM dishes d WHERE d.restaurant_id = r.id) AS dish_count
         FROM restaurants r
         WHERE r.workspace_id = :wid
         ORDER BY r.name ASC'
    );
    $stmt->execute([':wid' => $workspace['id']]);
    $rows = array_map(static function (array $r): array {
        return [
            'id'         => $r['id'],
            'name'       => $r['name'],
            'created_at' => $r['created_at'],
            'dish_count' => (int)$r['dish_count'],
        ];
    }, $stmt->fetchAll());
    json_response(200, ['restaurants' => $rows]);
}

function restaurants_create(array $workspace): void
{
    $body = read_json_body();
    reject_unknown_fields($body, ['name']);
    $name = require_string($body, 'name', 200);

    $id = generate_id();
    $stmt = db()->prepare(
        'INSERT INTO restaurants (id, workspace_id, name) VALUES (:id, :wid, :name)'
    );
    $stmt->execute([
        ':id'   => $id,
        ':wid'  => $workspace['id'],
        ':name' => $name,
    ]);

    restaurants_get($workspace, $id, 201);
}

function restaurants_get(array $workspace, string $id, int $status = 200): void
{
    $restaurant = load_restaurant_or_404($workspace, $id);
    $restaurant['dishes'] = load_full_menu($id);
    json_response($status, $restaurant);
}

function restaurants_patch(array $workspace, string $id): void
{
    $body = read_json_body();
    reject_unknown_fields($body, ['name']);
    load_restaurant_or_404($workspace, $id);

    if (!array_key_exists('name', $body)) {
        error_response(400, 'MISSING_FIELD', 'Missing field: name');
    }
    $name = require_string($body, 'name', 200);

    $stmt = db()->prepare(
        'UPDATE restaurants SET name = :name WHERE id = :id AND workspace_id = :wid'
    );
    $stmt->execute([':name' => $name, ':id' => $id, ':wid' => $workspace['id']]);

    restaurants_get($workspace, $id);
}

function restaurants_delete(array $workspace, string $id): void
{
    load_restaurant_or_404($workspace, $id);
    $stmt = db()->prepare(
        'DELETE FROM restaurants WHERE id = :id AND workspace_id = :wid'
    );
    $stmt->execute([':id' => $id, ':wid' => $workspace['id']]);

    http_response_code(204);
    exit;
}

function load_restaurant_or_404(array $workspace, string $id): array
{
    $stmt = db()->prepare(
        'SELECT id, workspace_id, name, created_at
         FROM restaurants
         WHERE id = :id AND workspace_id = :wid
         LIMIT 1'
    );
    $stmt->execute([':id' => $id, ':wid' => $workspace['id']]);
    $row = $stmt->fetch();
    if (!$row) {
        error_response(404, 'NOT_FOUND', 'Restaurant not found.');
    }
    return [
        'id'           => $row['id'],
        'workspace_id' => (int)$row['workspace_id'],
        'name'         => $row['name'],
        'created_at'   => $row['created_at'],
    ];
}

// Loads dishes + option groups + options for a restaurant in three queries
// and stitches them together in PHP. Returns dishes ordered by sort_order.
function load_full_menu(string $restaurantId): array
{
    $pdo = db();

    $dishesStmt = $pdo->prepare(
        'SELECT id, restaurant_id, name, category, description, base_price_cents, is_vegetarian, sort_order
         FROM dishes
         WHERE restaurant_id = :rid
         ORDER BY sort_order ASC, id ASC'
    );
    $dishesStmt->execute([':rid' => $restaurantId]);
    $dishes = $dishesStmt->fetchAll();
    if (count($dishes) === 0) {
        return [];
    }

    $dishIds = array_map(static fn(array $d) => $d['id'], $dishes);
    $placeholders = implode(',', array_fill(0, count($dishIds), '?'));

    $groupsStmt = $pdo->prepare(
        "SELECT id, dish_id, name, selection_type, max_select, sort_order
         FROM dish_option_groups
         WHERE dish_id IN ({$placeholders})
         ORDER BY sort_order ASC, id ASC"
    );
    $groupsStmt->execute($dishIds);
    $groups = $groupsStmt->fetchAll();

    $groupsByDish = [];
    $groupIds = [];
    foreach ($groups as $g) {
        $groupsByDish[$g['dish_id']][] = $g;
        $groupIds[] = $g['id'];
    }

    $optionsByGroup = [];
    if (count($groupIds) > 0) {
        $optPlaceholders = implode(',', array_fill(0, count($groupIds), '?'));
        $optsStmt = $pdo->prepare(
            "SELECT id, group_id, name, price_delta_cents, sort_order
             FROM dish_options
             WHERE group_id IN ({$optPlaceholders})
             ORDER BY sort_order ASC, id ASC"
        );
        $optsStmt->execute($groupIds);
        foreach ($optsStmt->fetchAll() as $o) {
            $optionsByGroup[$o['group_id']][] = [
                'id'                => $o['id'],
                'group_id'          => $o['group_id'],
                'name'              => $o['name'],
                'price_delta_cents' => (int)$o['price_delta_cents'],
                'sort_order'        => (int)$o['sort_order'],
            ];
        }
    }

    $out = [];
    foreach ($dishes as $d) {
        $dishGroups = $groupsByDish[$d['id']] ?? [];
        $dishGroupsOut = [];
        foreach ($dishGroups as $g) {
            $dishGroupsOut[] = [
                'id'             => $g['id'],
                'dish_id'        => $g['dish_id'],
                'name'           => $g['name'],
                'selection_type' => $g['selection_type'],
                'max_select'     => $g['max_select'] === null ? null : (int)$g['max_select'],
                'sort_order'     => (int)$g['sort_order'],
                'options'        => $optionsByGroup[$g['id']] ?? [],
            ];
        }
        $out[] = [
            'id'               => $d['id'],
            'restaurant_id'    => $d['restaurant_id'],
            'name'             => $d['name'],
            'category'         => $d['category'],
            'description'      => $d['description'],
            'base_price_cents' => (int)$d['base_price_cents'],
            'is_vegetarian'    => (bool)(int)$d['is_vegetarian'],
            'sort_order'       => (int)$d['sort_order'],
            'option_groups'    => $dishGroupsOut,
        ];
    }
    return $out;
}
