<?php
require __DIR__ . '/common.php'; require __DIR__ . '/ai.php';
$in = body(); limit('license', 20);
if (!empty($in['token'])) { $p = plan_read((string)$in['token']); if (!$p) fail(403, 'This Premium code is no longer active.', 'expired'); [$t, $e] = plan_make((string)$p['s']); echo json_encode(['ok' => true, 'token' => $t, 'exp' => $e]); exit; }
$code = strtoupper(trim((string)($in['code'] ?? '')));
foreach (license_hashes() as $h) if ($code !== '' && hash_equals($h, hash('sha256', $code))) { [$t, $e] = plan_make(license_sub($h)); echo json_encode(['ok' => true, 'token' => $t, 'exp' => $e]); exit; }
fail(403, 'That code was not accepted.', 'bad_code');
