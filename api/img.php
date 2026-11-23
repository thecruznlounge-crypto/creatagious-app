<?php
require __DIR__ . '/common.php'; require __DIR__ . '/net.php';
limit('img', 240);
$r = safe_fetch((string)($_GET['url'] ?? ''), 8000000, 9); if ($r['code'] >= 400 || $r['body'] === '') fail(502, 'Could not load image');
$i = @getimagesizefromstring($r['body']); if (!$i || !in_array($i['mime'], ['image/jpeg','image/png','image/webp','image/gif'], true) || $i[0] < 16 || $i[1] < 16) fail(415, 'Unsupported image');
header('Content-Type: ' . $i['mime']); header('Cache-Control: private, max-age=86400'); header('Content-Security-Policy: default-src \'none\''); echo $r['body'];
