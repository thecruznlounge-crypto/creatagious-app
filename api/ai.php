<?php
/* Server-only settings and calls to Claude, Runway and ElevenLabs. API keys never reach the browser. */
function cfg(): array { static $c = null; if ($c === null) { $f = __DIR__ . '/secret.php'; $c = is_file($f) ? (array)(require $f) : []; } return $c; }
function cfg_str(string $k, string $def = ''): string { $v = cfg()[$k] ?? getenv($k); return is_string($v) && trim($v) !== '' ? trim($v) : $def; }
function cfg_int(string $k, int $def): int { $v = cfg()[$k] ?? getenv($k); return is_numeric($v) ? max(0, (int)$v) : $def; }
function real_key(string $k): string { $v = cfg_str($k); return $v === 'PUT_YOUR_KEY_HERE' ? '' : $v; }
function claude_key(): string { return real_key('ANTHROPIC_API_KEY'); }
function runway_key(): string { return real_key('RUNWAY_API_KEY'); }
function eleven_key(): string { return real_key('ELEVENLABS_API_KEY'); }
function text_model(): string { return cfg_str('CLAUDE_MODEL', 'claude-haiku-5-5'); }

function http_call(string $method, string $url, array $headers, ?array $payload, int $timeout): array {
  if (!function_exists('curl_init')) fail(503, 'PHP cURL is not enabled on this server.', 'server');
  $c = curl_init($url); if ($payload !== null) $headers[] = 'Content-Type: application/json';
  curl_setopt_array($c, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_HTTPHEADER => $headers]);
  if ($payload !== null) curl_setopt($c, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
  $res = curl_exec($c); $code = (int)curl_getinfo($c, CURLINFO_RESPONSE_CODE); $errno = curl_errno($c); curl_close($c); return [$code, is_string($res) ? $res : '', $errno];
}

/* Claude */
function claude_request(string $method, string $path, ?array $payload, int $timeout): array {
  $key = claude_key(); if ($key === '') fail(503, 'Claude is not connected yet.', 'not_configured');
  return http_call($method, rtrim(cfg_str('ANTHROPIC_BASE_URL', 'https://api.anthropic.com/v1'), '/') . $path, ['x-api-key: ' . $key, 'anthropic-version: 2023-06-01'], $payload, $timeout);
}
function claude_problem(int $code, string $res, int $errno = 0): array {
  $e = json_decode($res, true)['error'] ?? []; $type = (string)($e['type'] ?? ''); $msg = strtolower((string)($e['message'] ?? ''));
  if ($errno === 28) return [504, 'Claude took too long. Please try again.', 'timeout'];
  if ($code === 401 || $type === 'authentication_error') return [502, 'Claude rejected the API key on the server.', 'bad_key'];
  if (str_contains($msg, 'credit balance') || str_contains($msg, 'billing')) return [502, 'The Claude account is out of credit.', 'no_credit'];
  if ($code === 404 || $code === 403 || str_contains($msg, 'model')) return [502, 'This Claude account cannot use the selected model. Check Setup in Profile.', 'model'];
  if ($code === 429 || $code === 529) return [429, 'Claude is busy. Please try again shortly.', 'busy'];
  return [502, 'Claude could not finish that request.', 'provider'];
}
function claude_fail(int $code, string $res, int $errno = 0) { [$c, $m, $r] = claude_problem($code, $res, $errno); fail($c, $m, $r); }
function claude_text(array $d): string { $t = ''; foreach (($d['content'] ?? []) as $b) if (($b['type'] ?? '') === 'text') $t .= (string)($b['text'] ?? ''); return $t; }
/* Messages API with a JSON schema. */
function ai_json(string $system, string $user, array $schema, int $timeout, int $maxTokens = 4000): array {
  [$code, $res, $errno] = claude_request('POST', '/messages', ['model' => text_model(), 'max_tokens' => $maxTokens, 'system' => $system, 'messages' => [['role' => 'user', 'content' => $user]], 'output_config' => ['format' => ['type' => 'json_schema', 'schema' => $schema]]], $timeout);
  if ($code !== 200) claude_fail($code, $res, $errno); $d = json_decode($res, true); $stop = (string)($d['stop_reason'] ?? '');
  if ($stop === 'refusal') fail(422, 'That request was declined.', 'declined'); if ($stop === 'max_tokens') fail(502, 'The answer was too long. Please try again.', 'provider');
  $out = json_decode(claude_text((array)$d), true); if (!is_array($out)) fail(502, 'Claude returned an unusable answer.', 'provider'); return $out;
}
/* Searches one domain. Returns the findings and the pages they came from. */
function claude_search(string $system, string $user, string $domain, int $timeout): array {
  $messages = [['role' => 'user', 'content' => $user]]; $text = ''; $sources = [];
  for ($i = 0; $i < 3; $i++) {
    [$code, $res, $errno] = claude_request('POST', '/messages', ['model' => text_model(), 'max_tokens' => 2500, 'system' => $system, 'messages' => $messages, 'tools' => [['type' => 'web_search_20250305', 'name' => 'web_search', 'max_uses' => 3, 'allowed_domains' => [$domain]]]], $timeout);
    if ($code !== 200) claude_fail($code, $res, $errno); $d = json_decode($res, true);
    foreach (($d['content'] ?? []) as $b) { if (($b['type'] ?? '') !== 'text') continue; $text .= (string)($b['text'] ?? ''); foreach (($b['citations'] ?? []) as $c) if (!empty($c['url']) && preg_match('#^https?://#i', (string)$c['url'])) $sources[(string)$c['url']] = (string)($c['title'] ?? ''); }
    if (($d['stop_reason'] ?? '') !== 'pause_turn') break; $messages[] = ['role' => 'assistant', 'content' => $d['content']]; $text = '';
  }
  return [$text, $sources];
}

/* Runway: generation runs as tasks that are checked until finished. */
function runway_request(string $method, string $path, ?array $payload, int $timeout = 30): array {
  $key = runway_key(); if ($key === '') fail(503, 'Runway is not connected yet.', 'not_configured');
  return http_call($method, rtrim(cfg_str('RUNWAY_BASE_URL', 'https://api.dev.runwayml.com'), '/') . $path, ['Authorization: Bearer ' . $key, 'X-Runway-Version: 2024-11-06'], $payload, $timeout);
}
function runway_problem(int $code, string $res, int $errno = 0): array {
  $msg = strtolower($res);
  if ($errno === 28) return [504, 'Runway took too long. Please try again.', 'timeout'];
  if ($code === 401 || $code === 403) return [502, 'Runway rejected the API key on the server.', 'bad_key'];
  if (str_contains($msg, 'credit')) return [502, 'The Runway account is out of credits.', 'no_credit'];
  if ($code === 429) return [429, 'Runway is busy. Please try again shortly.', 'busy'];
  if (str_contains($msg, 'moderation') || str_contains($msg, 'safety')) return [422, 'That request was declined. Try different wording.', 'declined'];
  return [502, 'Runway could not start that request.', 'provider'];
}
function runway_task_error(array $t): array {
  $code = strtoupper((string)($t['failureCode'] ?? ''));
  if (str_starts_with($code, 'SAFETY') || str_contains($code, 'MODERATION')) return [422, 'That request was declined. Try different wording.', 'declined'];
  return [502, 'Runway could not finish that request. Please try again.', 'provider'];
}
function runway_task(string $id): array { [$c, $r, $e] = runway_request('GET', '/v1/tasks/' . rawurlencode($id), null, 20); if ($c !== 200) { [$s, $m, $w] = runway_problem($c, $r, $e); fail($s, $m, $w); } return (array)json_decode($r, true); }

/* Premium tokens: signed on this server, so paid AI cannot be unlocked from the browser. */
function plan_secret(): string {
  $f = data_dir() . '/plan.key'; $s = is_file($f) ? trim((string)file_get_contents($f)) : '';
  if (strlen($s) < 40) { $s = bin2hex(random_bytes(32)); if (@file_put_contents($f, $s, LOCK_EX) === false) fail(500, 'The api/data folder is not writable.', 'server'); @chmod($f, 0600); }
  return $s;
}
function license_hashes(): array {
  $h = array_values(array_filter((array)(cfg()['LICENSE_CODE_HASHES'] ?? []), 'is_string'));
  foreach ((array)(cfg()['PREMIUM_CODES'] ?? []) as $c) if (is_string($c) && trim($c) !== '') $h[] = hash('sha256', strtoupper(trim($c)));
  return $h;
}
function license_sub(string $hash): string { return substr(hash('sha256', 'sub|' . $hash), 0, 24); }
function b64u(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function plan_make(string $sub, int $days = 30): array { $exp = time() + $days * 86400; $p = b64u((string)json_encode(['s' => $sub, 'e' => $exp])); return [$p . '.' . hash_hmac('sha256', $p, plan_secret()), $exp]; }
function plan_read(string $token): ?array {
  $x = explode('.', $token); if (count($x) !== 2 || !hash_equals(hash_hmac('sha256', $x[0], plan_secret()), $x[1])) return null;
  $d = json_decode((string)base64_decode(strtr($x[0], '-_', '+/')), true); if (!is_array($d) || (int)($d['e'] ?? 0) < time()) return null;
  foreach (license_hashes() as $h) if (hash_equals(license_sub($h), (string)($d['s'] ?? ''))) return $d;
  return null;
}
function request_token(array $in = []): string { return (string)($in['token'] ?? ($_SERVER['HTTP_X_PLAN_TOKEN'] ?? '')); }
function require_premium(array $in): array { $p = plan_read(request_token($in)); if (!$p) fail(402, 'Enter your Premium code to use this feature.', 'premium'); return $p; }

/* Daily allowances, returned if the provider call fails. */
function quota_adjust(string $bucket, string $who, int $by, int $cap): bool {
  $dir = data_dir(); $day = gmdate('Ymd'); if (mt_rand(1, 40) === 1) foreach (glob("$dir/q_*") ?: [] as $old) if (!str_contains($old, "q_$day")) @unlink($old);
  $h = @fopen("$dir/q_{$day}_" . hash('sha256', "$bucket|$who") . '.txt', 'c+'); if (!$h) return $by <= 0; flock($h, LOCK_EX); $n = (int)stream_get_contents($h);
  if ($by > 0 && $n + $by > $cap) { flock($h, LOCK_UN); fclose($h); return false; }
  ftruncate($h, 0); rewind($h); fwrite($h, (string)max(0, $n + $by)); flock($h, LOCK_UN); fclose($h); return true;
}
