<?php
declare(strict_types=1);

require_once __DIR__ . '/../shared/db.php';
require_once __DIR__ . '/../shared/ids.php';
require_once __DIR__ . '/http.php';

// Dispatcher for /api/option-templates[/{id}]. Workspace-scoped option
// group templates that can be saved from any dish and inserted into any
// other dish in the same workspace.
function handle_option_templates_route(string $method, array $segments, array $workspace): void
{
    if (count($segments) === 0) {
        if ($method === 'GET') {
            templates_list($workspace);
        } elseif ($method === 'POST') {
            templates_create($workspace);
        } else {
            error_response(405, 'METHOD_NOT_ALLOWED', 'Use GET or POST on /option-templates.');
        }
        return;
    }

    if (count($segments) === 1) {
        $id = $segments[0];
        if (!is_valid_id($id)) {
            error_response(404, 'NOT_FOUND', 'Template not found.');
        }
        if ($method === 'DELETE') {
            templates_delete($workspace, $id);
        } else {
            error_response(405, 'METHOD_NOT_ALLOWED', 'Use DELETE on /option-templates/{id}.');
        }
        return;
    }

    error_response(404, 'NOT_FOUND', 'Unknown option-templates path.');
}

function templates_list(array $workspace): void
{
    $pdo = db();

    $tplStmt = $pdo->prepare(
        'SELECT id, name, selection_type, created_at
         FROM option_group_templates
         WHERE workspace_id = :wid
         ORDER BY name ASC, created_at ASC'
    );
    $tplStmt->execute([':wid' => $workspace['id']]);
    $templates = $tplStmt->fetchAll();
    if (count($templates) === 0) {
        json_response(200, ['templates' => []]);
        return;
    }

    $tplIds = array_map(static fn(array $t) => $t['id'], $templates);
    $placeholders = implode(',', array_fill(0, count($tplIds), '?'));
    $optStmt = $pdo->prepare(
        "SELECT id, template_id, name, price_delta_cents, sort_order
         FROM option_group_template_options
         WHERE template_id IN ({$placeholders})
         ORDER BY sort_order ASC, id ASC"
    );
    $optStmt->execute($tplIds);

    $byTemplate = [];
    foreach ($optStmt->fetchAll() as $o) {
        $byTemplate[$o['template_id']][] = [
            'id'                => $o['id'],
            'name'              => $o['name'],
            'price_delta_cents' => (int)$o['price_delta_cents'],
            'sort_order'        => (int)$o['sort_order'],
        ];
    }

    $out = array_map(static function (array $t) use ($byTemplate): array {
        return [
            'id'             => $t['id'],
            'name'           => $t['name'],
            'selection_type' => $t['selection_type'],
            'created_at'     => $t['created_at'],
            'options'        => $byTemplate[$t['id']] ?? [],
        ];
    }, $templates);

    json_response(200, ['templates' => $out]);
}

function templates_create(array $workspace): void
{
    $body = read_json_body();
    reject_unknown_fields($body, ['name', 'selection_type', 'options']);

    $name          = require_string($body, 'name', 120);
    $selectionType = $body['selection_type'] ?? null;
    if ($selectionType !== 'single' && $selectionType !== 'multi') {
        error_response(400, 'INVALID_FIELD', 'Field selection_type must be "single" or "multi".');
    }

    $optionsRaw = $body['options'] ?? null;
    if (!is_array($optionsRaw) || count($optionsRaw) === 0) {
        error_response(400, 'INVALID_FIELD', 'Field options must be a non-empty array.');
    }
    if (count($optionsRaw) > 100) {
        error_response(400, 'INVALID_FIELD', 'Too many options in template (max 100).');
    }

    // Validate options up-front so we don't insert a partial template.
    $cleanOptions = [];
    foreach ($optionsRaw as $idx => $optRaw) {
        if (!is_array($optRaw)) {
            error_response(400, 'INVALID_FIELD', "options[{$idx}] must be an object.");
        }
        reject_unknown_fields($optRaw, ['name', 'price_delta_cents']);
        $optName = require_string($optRaw, 'name', 200);
        $delta   = $optRaw['price_delta_cents'] ?? 0;
        if (!is_int($delta) || $delta < -1_000_000 || $delta > 1_000_000) {
            error_response(400, 'INVALID_FIELD', "options[{$idx}].price_delta_cents must be an integer in cents.");
        }
        $cleanOptions[] = ['name' => $optName, 'price_delta_cents' => $delta];
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $tplId = generate_id();
        $insTpl = $pdo->prepare(
            'INSERT INTO option_group_templates (id, workspace_id, name, selection_type)
             VALUES (:id, :wid, :name, :stype)'
        );
        $insTpl->execute([
            ':id'    => $tplId,
            ':wid'   => $workspace['id'],
            ':name'  => $name,
            ':stype' => $selectionType,
        ]);

        $insOpt = $pdo->prepare(
            'INSERT INTO option_group_template_options
                (id, template_id, name, price_delta_cents, sort_order)
             VALUES (:id, :tid, :name, :delta, :sort)'
        );
        foreach ($cleanOptions as $sortOrder => $opt) {
            $insOpt->execute([
                ':id'    => generate_id(),
                ':tid'   => $tplId,
                ':name'  => $opt['name'],
                ':delta' => $opt['price_delta_cents'],
                ':sort'  => $sortOrder,
            ]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    templates_get_or_404($workspace, $tplId, 201);
}

function templates_delete(array $workspace, string $id): void
{
    $pdo = db();
    $stmt = $pdo->prepare(
        'DELETE FROM option_group_templates WHERE id = :id AND workspace_id = :wid'
    );
    $stmt->execute([':id' => $id, ':wid' => $workspace['id']]);
    if ($stmt->rowCount() === 0) {
        error_response(404, 'NOT_FOUND', 'Template not found.');
    }
    http_response_code(204);
    exit;
}

// Single-template fetch + JSON response, used after create.
function templates_get_or_404(array $workspace, string $id, int $status = 200): void
{
    $pdo = db();
    $tStmt = $pdo->prepare(
        'SELECT id, name, selection_type, created_at
         FROM option_group_templates
         WHERE id = :id AND workspace_id = :wid
         LIMIT 1'
    );
    $tStmt->execute([':id' => $id, ':wid' => $workspace['id']]);
    $row = $tStmt->fetch();
    if (!$row) {
        error_response(404, 'NOT_FOUND', 'Template not found.');
    }

    $oStmt = $pdo->prepare(
        'SELECT id, name, price_delta_cents, sort_order
         FROM option_group_template_options
         WHERE template_id = :tid
         ORDER BY sort_order ASC, id ASC'
    );
    $oStmt->execute([':tid' => $id]);
    $options = array_map(static function (array $o): array {
        return [
            'id'                => $o['id'],
            'name'              => $o['name'],
            'price_delta_cents' => (int)$o['price_delta_cents'],
            'sort_order'        => (int)$o['sort_order'],
        ];
    }, $oStmt->fetchAll());

    json_response($status, [
        'id'             => $row['id'],
        'name'           => $row['name'],
        'selection_type' => $row['selection_type'],
        'created_at'     => $row['created_at'],
        'options'        => $options,
    ]);
}
