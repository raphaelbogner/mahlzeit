<?php
declare(strict_types=1);
require_once __DIR__ . '/../shared/db.php';

$pdo = db();

echo "Database: " . $pdo->query('SELECT DATABASE()')->fetchColumn() . "\n\n";

echo "sessions.paid_by_*:\n";
foreach ($pdo->query("SHOW COLUMNS FROM sessions LIKE 'paid_by_%'") as $r) {
    echo "  - {$r['Field']}  {$r['Type']}  null={$r['Null']}  default=" . var_export($r['Default'], true) . "\n";
}
echo "\nsessions.deadline_at / auto_closed:\n";
foreach ($pdo->query("SHOW COLUMNS FROM sessions WHERE Field IN ('deadline_at','auto_closed')") as $r) {
    echo "  - {$r['Field']}  {$r['Type']}  null={$r['Null']}  default=" . var_export($r['Default'], true) . "\n";
}
echo "\nsessions.discount_*:\n";
foreach ($pdo->query("SHOW COLUMNS FROM sessions LIKE 'discount_%'") as $r) {
    echo "  - {$r['Field']}  {$r['Type']}  null={$r['Null']}  default=" . var_export($r['Default'], true) . "\n";
}
echo "\nitems.paid_at:\n";
foreach ($pdo->query("SHOW COLUMNS FROM items LIKE 'paid_at'") as $r) {
    echo "  - {$r['Field']}  {$r['Type']}  null={$r['Null']}\n";
}
echo "\nitems.quantity:\n";
foreach ($pdo->query("SHOW COLUMNS FROM items LIKE 'quantity'") as $r) {
    echo "  - {$r['Field']}  {$r['Type']}  null={$r['Null']}  default=" . var_export($r['Default'], true) . "\n";
}
echo "\noption_group_template* tables:\n";
foreach ($pdo->query("SHOW TABLES LIKE 'option_group_template%'") as $r) {
    $name = array_values($r)[0];
    $cnt = (int)$pdo->query("SELECT COUNT(*) FROM `{$name}`")->fetchColumn();
    echo "  - {$name}  rows={$cnt}\n";
}
