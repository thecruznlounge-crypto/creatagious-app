<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
/* Keeps the API working on PHP 7.4 hosts as well as PHP 8. */
if (!function_exists('str_contains')) { function str_contains(string $h, string $n): bool { return $n === '' || strpos($h, $n) !== false; } }
if (!function_exists('str_starts_with')) { function str_starts_with(string $h, string $n): bool { return strncmp($h, $n, strlen($n)) === 0; } }
if (!function_exists('str_ends_with')) { function str_ends_with(string $h, string $n): bool { return $n === '' || substr($h, -strlen($n)) === $n; } }
function fail(int $code, string $msg, string $reason = '') {
  if (!empty($GLOBALS['SOFT_FAIL'])) throw new RuntimeException($msg);
  http_response_code($code); echo json_encode(['error' => $msg, 'reason' => $reason], JSON_UNESCAPED_UNICODE); exit;
}
function data_dir(): string { $d = __DIR__ . '/data'; if (!is_dir($d)) { @mkdir($d, 0750, true); @file_put_contents("$d/.htaccess", "Require all denied\n"); } return $d; }
function client_id(): string { return hash('sha256', 'ip|' . ($_SERVER['REMOTE_ADDR'] ?? '')); }
function limit(string $bucket, int $max, int $window = 3600): void {
  $ip = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . $bucket); $f = data_dir() . "/rl_$ip.json"; $now = time();
  $h = @fopen($f, 'c+'); if (!$h) return; flock($h, LOCK_EX); $d = json_decode(stream_get_contents($h) ?: '[]', true) ?: [];
  $d = array_values(array_filter($d, function ($t) use ($now, $window) { return $t > $now - $window; }));
  if (count($d) >= $max) { flock($h, LOCK_UN); fclose($h); fail(429, 'Too many requests. Please try again later.', 'rate_limit'); }
  $d[] = $now; ftruncate($h, 0); rewind($h); fwrite($h, json_encode($d)); flock($h, LOCK_UN); fclose($h);
}
function body(): array {
  if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail(405, 'POST only');
  $d = json_decode(file_get_contents('php://input', false, null, 0, 60000) ?: '', true); if (!is_array($d)) fail(400, 'Bad request'); return $d;
}
