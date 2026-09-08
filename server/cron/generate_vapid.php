<?php
declare(strict_types=1);

// One-off: create a VAPID key pair and print the config.php snippet.
//   php server/cron/generate_vapid.php
// Needs composer dependencies (server/vendor).

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    echo "CLI only.\n";
    exit(1);
}

$autoload = __DIR__ . '/../vendor/autoload.php';
if (!is_file($autoload)) {
    fwrite(STDERR, "vendor/autoload.php missing – run `composer install` in server/ first.\n");
    exit(1);
}
require_once $autoload;

$keys = \Minishlink\WebPush\VAPID::createVapidKeys();

echo "Add this to config.php (next to 'db'):\n\n";
echo "    'push' => [\n";
echo "        'subject'       => 'mailto:you@example.com',\n";
echo "        'vapid_public'  => '" . $keys['publicKey'] . "',\n";
echo "        'vapid_private' => '" . $keys['privateKey'] . "',\n";
echo "        'timezone'      => 'Europe/Vienna',\n";
echo "    ],\n";
