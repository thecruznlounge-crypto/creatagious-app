<?php
require __DIR__ . '/common.php'; require __DIR__ . '/ai.php';
$key = eleven_key(); if ($key === '') fail(503, 'AI voices are not set up.', 'not_configured');
function eleven(string $method, string $path, string $key, ?array $body = null, int $timeout = 45): array { return http_call($method, rtrim(cfg_str('ELEVENLABS_BASE_URL', 'https://api.elevenlabs.io'), '/') . $path, ['xi-api-key: ' . $key, 'Accept: */*'], $body, $timeout); }
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
  limit('voicelist', 60); $cache = data_dir() . '/voices.json'; if (is_file($cache) && filemtime($cache) > time() - 3600) { readfile($cache); exit; }
  [$code, $res] = eleven('GET', '/v2/voices?page_size=12', $key); if ($code !== 200) fail(502, 'AI voices are unavailable.', 'provider');
  $v = []; foreach ((json_decode($res, true)['voices'] ?? []) as $x) if (!empty($x['voice_id']) && !empty($x['name'])) $v[] = ['id' => (string)$x['voice_id'], 'name' => mb_substr(trim(explode(' - ', (string)$x['name'])[0]), 0, 24)];
  $out = json_encode(['voices' => $v], JSON_UNESCAPED_UNICODE); @file_put_contents($cache, $out, LOCK_EX); echo $out; exit;
}
$in = body(); limit('voice', 20); @set_time_limit(70); require_premium($in); $text = trim(mb_substr((string)($in['text'] ?? ''), 0, 900)); $voice = (string)($in['voice'] ?? '');
if (mb_strlen($text) < 2 || !preg_match('/^[A-Za-z0-9_-]{6,64}$/', $voice)) fail(400, 'Bad request');
$cap = cfg_int('VOICE_DAILY_CHARACTERS', 20000); $n = mb_strlen($text); if (!quota_adjust('voice', 'all', $n, $cap)) fail(429, 'AI voices have reached today\'s limit. Try again tomorrow.', 'site_limit');
[$code, $audio] = eleven('POST', '/v1/text-to-speech/' . rawurlencode($voice) . '?output_format=mp3_44100_128', $key, ['text' => $text, 'model_id' => cfg_str('ELEVENLABS_MODEL', 'eleven_v4')], 55);
if ($code !== 200 || $audio === '') { quota_adjust('voice', 'all', -$n, $cap); fail(502, $code === 401 ? 'ElevenLabs rejected the API key on the server.' : 'The AI voice could not be created.', 'provider'); }
header('Content-Type: audio/mpeg'); header('Cache-Control: no-store'); echo $audio;
