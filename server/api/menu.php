<?php
declare(strict_types=1);

require_once __DIR__ . '/../shared/db.php';
require_once __DIR__ . '/../shared/ids.php';
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/restaurants.php';

const MENU_MAX_DISHES  = 200;
const MENU_MAX_OPTIONS = 2000;
const MENU_MAX_GROUPS_PER_DISH = 20;
const MENU_MAX_OPTIONS_PER_GROUP = 50;

// Bulk replace of a restaurant's full menu. The whole tree (dishes →
// option_groups → options) is dropped and re-inserted in one transaction.
// Existing dish_id references in items are preserved through ON DELETE
// SET NULL on items.dish_id; old items keep their snapshotted name/price.
function menu_replace(array $workspace, string $restaurantId): void
{
    $restaurant = load_restaurant_or_404($workspace, $restaurantId);

    $body = read_json_body();
    reject_unknown_fields($body, ['dishes']);
    if (!array_key_exists('dishes', $body) || !is_array($body['dishes'])) {
        error_response(400, 'INVALID_FIELD', 'Field dishes must be an array.');
    }

    $dishes = $body['dishes'];
    if (count($dishes) > MENU_MAX_DISHES) {
        error_response(400, 'TOO_MANY_DISHES', 'Maximum is ' . MENU_MAX_DISHES . ' dishes.');
    }

    // First pass: validate the whole tree without touching the DB.
    $totalOptions = 0;
    $normalized = [];
    foreach ($dishes as $dishIdx => $dish) {
        if (!is_array($dish)) {
            error_response(400, 'INVALID_FIELD', "Dish #{$dishIdx} must be an object.");
        }
        $allowedDish = ['id', 'name', 'category', 'description', 'base_price_cents', 'is_vegetarian', 'option_groups'];
        foreach (array_keys($dish) as $k) {
            if (!in_array($k, $allowedDish, true)) {
                error_response(400, 'UNKNOWN_FIELD', "Unknown field on dish #{$dishIdx}: {$k}");
            }
        }
        if (!isset($dish['name']) || !is_string($dish['name'])) {
            error_response(400, 'INVALID_FIELD', "Dish #{$dishIdx} requires name.");
        }
        $name = trim($dish['name']);
        if ($name === '' || strlen($name) > 200) {
            error_response(400, 'INVALID_FIELD', "Dish #{$dishIdx} name length 1..200.");
        }

        // category / description are optional; default to empty string.
        $category = '';
        if (array_key_exists('category', $dish)) {
            if (!is_string($dish['category'])) {
                error_response(400, 'INVALID_FIELD', "Dish #{$dishIdx} category must be a string.");
            }
            $category = trim($dish['category']);
            if (strlen($category) > 80) {
                error_response(400, 'INVALID_FIELD', "Dish #{$dishIdx} category max length 80.");
            }
        }
        $description = '';
        if (array_key_exists('description', $dish)) {
            if (!is_string($dish['description'])) {
                error_response(400, 'INVALID_FIELD', "Dish #{$dishIdx} description must be a string.");
            }
            $description = trim($dish['description']);
            if (strlen($description) > 500) {
                error_response(400, 'INVALID_FIELD', "Dish #{$dishIdx} description max length 500.");
            }
        }
        $isVegetarian = false;
        if (array_key_exists('is_vegetarian', $dish)) {
            if (!is_bool($dish['is_vegetarian'])) {
                error_response(400, 'INVALID_FIELD', "Dish #{$dishIdx} is_vegetarian must be a boolean.");
            }
            $isVegetarian = $dish['is_vegetarian'];
        }

        if (!isset($dish['base_price_cents']) || !is_int($dish['base_price_cents'])) {
            error_response(400, 'INVALID_FIELD', "Dish #{$dishIdx} base_price_cents must be int.");
        }
        $basePrice = $dish['base_price_cents'];
        if ($basePrice < 0 || $basePrice > 10_000_000) {
            error_response(400, 'INVALID_FIELD', "Dish #{$dishIdx} base_price_cents out of range.");
        }

        $groupsIn = $dish['option_groups'] ?? [];
        if (!is_array($groupsIn)) {
            error_response(400, 'INVALID_FIELD', "Dish #{$dishIdx} option_groups must be an array.");
        }
        if (count($groupsIn) > MENU_MAX_GROUPS_PER_DISH) {
            error_response(400, 'INVALID_FIELD', "Dish #{$dishIdx} has too many option groups.");
        }

        $normGroups = [];
        foreach ($groupsIn as $gIdx => $group) {
            if (!is_array($group)) {
                error_response(400, 'INVALID_FIELD', "Group #{$gIdx} on dish #{$dishIdx} must be an object.");
            }
            $allowedGroup = ['id', 'name', 'selection_type', 'max_select', 'options'];
            foreach (array_keys($group) as $k) {
                if (!in_array($k, $allowedGroup, true)) {
                    error_response(400, 'UNKNOWN_FIELD', "Unknown field on group: {$k}");
                }
            }
            if (!isset($group['name']) || !is_string($group['name'])) {
                error_response(400, 'INVALID_FIELD', "Group on dish #{$dishIdx} requires name.");
            }
            $gName = trim($group['name']);
            if ($gName === '' || strlen($gName) > 120) {
                error_response(400, 'INVALID_FIELD', "Group name length 1..120.");
            }
            if (!isset($group['selection_type']) ||
                !in_array($group['selection_type'], ['single', 'multi'], true)) {
                error_response(400, 'INVALID_FIELD', "Group selection_type must be 'single' or 'multi'.");
            }
            $selType = $group['selection_type'];

            // max_select caps a 'multi' group's picks (NULL = unlimited).
            // Meaningless for 'single' (always exactly one) → stored as NULL.
            $maxSelect = null;
            if (array_key_exists('max_select', $group) && $group['max_select'] !== null) {
                if (!is_int($group['max_select']) || $group['max_select'] < 1
                    || $group['max_select'] > MENU_MAX_OPTIONS_PER_GROUP) {
                    error_response(400, 'INVALID_FIELD', "Group max_select must be an int 1.." . MENU_MAX_OPTIONS_PER_GROUP . ".");
                }
                if ($selType === 'multi') {
                    $maxSelect = $group['max_select'];
                }
            }
            $optionsIn = $group['options'] ?? [];
            if (!is_array($optionsIn) || count($optionsIn) === 0) {
                error_response(400, 'INVALID_FIELD', "Group on dish #{$dishIdx} needs at least one option.");
            }
            if (count($optionsIn) > MENU_MAX_OPTIONS_PER_GROUP) {
                error_response(400, 'INVALID_FIELD', "Group has too many options.");
            }

            $normOptions = [];
            foreach ($optionsIn as $oIdx => $opt) {
                if (!is_array($opt)) {
                    error_response(400, 'INVALID_FIELD', "Option #{$oIdx} must be an object.");
                }
                $allowedOpt = ['id', 'name', 'price_delta_cents'];
                foreach (array_keys($opt) as $k) {
                    if (!in_array($k, $allowedOpt, true)) {
                        error_response(400, 'UNKNOWN_FIELD', "Unknown field on option: {$k}");
                    }
                }
                if (!isset($opt['name']) || !is_string($opt['name'])) {
                    error_response(400, 'INVALID_FIELD', "Option requires name.");
                }
                $oName = trim($opt['name']);
                if ($oName === '' || strlen($oName) > 200) {
                    error_response(400, 'INVALID_FIELD', "Option name length 1..200.");
                }
                if (!isset($opt['price_delta_cents']) || !is_int($opt['price_delta_cents'])) {
                    error_response(400, 'INVALID_FIELD', "Option price_delta_cents must be int.");
                }
                $delta = $opt['price_delta_cents'];
                if ($delta < -10_000_000 || $delta > 10_000_000) {
                    error_response(400, 'INVALID_FIELD', "Option price_delta_cents out of range.");
                }
                $normOptions[] = [
                    'name'              => $oName,
                    'price_delta_cents' => $delta,
                    'sort_order'        => $oIdx,
                ];
                $totalOptions++;
            }

            $normGroups[] = [
                'name'           => $gName,
                'selection_type' => $selType,
                'max_select'     => $maxSelect,
                'sort_order'     => $gIdx,
                'options'        => $normOptions,
            ];
        }

        $normalized[] = [
            'name'             => $name,
            'category'         => $category,
            'description'      => $description,
            'base_price_cents' => $basePrice,
            'is_vegetarian'    => $isVegetarian,
            'sort_order'       => $dishIdx,
            'option_groups'    => $normGroups,
        ];
    }

    if ($totalOptions > MENU_MAX_OPTIONS) {
        error_response(400, 'TOO_MANY_OPTIONS', 'Maximum is ' . MENU_MAX_OPTIONS . ' options.');
    }

    // Transactional replace. Cascading FKs do most of the cleanup for us.
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $del = $pdo->prepare('DELETE FROM dishes WHERE restaurant_id = :rid');
        $del->execute([':rid' => $restaurant['id']]);

        $insertDish = $pdo->prepare(
            'INSERT INTO dishes (id, restaurant_id, name, category, description, base_price_cents, is_vegetarian, sort_order)
             VALUES (:id, :rid, :name, :category, :description, :price, :veg, :sort)'
        );
        $insertGroup = $pdo->prepare(
            'INSERT INTO dish_option_groups (id, dish_id, name, selection_type, max_select, sort_order)
             VALUES (:id, :did, :name, :stype, :max, :sort)'
        );
        $insertOption = $pdo->prepare(
            'INSERT INTO dish_options (id, group_id, name, price_delta_cents, sort_order)
             VALUES (:id, :gid, :name, :delta, :sort)'
        );

        foreach ($normalized as $d) {
            $dishId = generate_id();
            $insertDish->execute([
                ':id'          => $dishId,
                ':rid'         => $restaurant['id'],
                ':name'        => $d['name'],
                ':category'    => $d['category'],
                ':description' => $d['description'],
                ':price'       => $d['base_price_cents'],
                ':veg'         => $d['is_vegetarian'] ? 1 : 0,
                ':sort'        => $d['sort_order'],
            ]);
            foreach ($d['option_groups'] as $g) {
                $groupId = generate_id();
                $insertGroup->execute([
                    ':id'    => $groupId,
                    ':did'   => $dishId,
                    ':name'  => $g['name'],
                    ':stype' => $g['selection_type'],
                    ':max'   => $g['max_select'],
                    ':sort'  => $g['sort_order'],
                ]);
                foreach ($g['options'] as $o) {
                    $optId = generate_id();
                    $insertOption->execute([
                        ':id'    => $optId,
                        ':gid'   => $groupId,
                        ':name'  => $o['name'],
                        ':delta' => $o['price_delta_cents'],
                        ':sort'  => $o['sort_order'],
                    ]);
                }
            }
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    restaurants_get($workspace, $restaurant['id']);
}
