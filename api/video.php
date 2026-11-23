<?php
/* Premium video clips: start with POST, check with GET, download with GET and file=1. */
require __DIR__ . '/common.php'; require __DIR__ . '/net.php'; require __DIR__ . '/ai.php'; @set_time_limit(90);
if (runway_key() === '') fail(503, 'AI clips are not connected yet.', 'not_configured');
function job_file(string $id): string { return data_dir() . '/vt_' . hash('sha256', $id) . '.json'; }
function job_give_back(string $id, array $job) { if (!empty($job['back'])) return; $job['back'] = 1; @file_put_contents(job_file($id), json_encode($job), LOCK_EX); quota_adjust('vid', (string)$job['s'], -1, cfg_int('PREMIUM_AI_VIDEOS_PER_DAY', 5)); quota_adjust('vid_all', 'all', -1, cfg_int('AI_VIDEOS_DAILY_LIMIT', 30)); }
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  $in = json_decode(file_get_contents('php://input', false, null, 0, 4000000) ?: '', true); if (!is_array($in)) fail(400, 'Bad request'); limit('aivid', 20); $plan = require_premium($in);
  $prompt = trim(mb_substr((string)($in['prompt'] ?? ''), 0, 1200)); if (mb_strlen($prompt) < 3) fail(400, 'Describe the clip first.');
  $image = (string)($in['image'] ?? ''); if ($image !== '' && !preg_match('#^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$#', $image)) fail(400, 'That image cannot be animated.');
  $hd = cfg_int('RUNWAY_VIDEO_HEIGHT', 720) >= 1080; $wide = in_array((string)($in['format'] ?? ''), ['wide', 'hd'], true); $ratio = $wide ? ($hd ? '1920:1080' : '1280:720') : ($hd ? '1080:1920' : '720:1280'); $secs = min(15, max(3, cfg_int('RUNWAY_VIDEO_SECONDS', 5)));
  $cap = cfg_int('PREMIUM_AI_VIDEOS_PER_DAY', 5); $all = cfg_int('AI_VIDEOS_DAILY_LIMIT', 30);
  if (!quota_adjust('vid', $plan['s'], 1, $cap)) fail(429, "You have used today's $cap AI clips.", 'daily_limit');
  if (!quota_adjust('vid_all', 'all', 1, $all)) { quota_adjust('vid', $plan['s'], -1, $cap); fail(429, 'AI clips have reached today\'s limit.', 'site_limit'); }
  $full = "Short social media ad shot. $prompt. Smooth, purposeful motion. No on-screen text, logos, watermarks, spoken words or recognizable real people.";
  $body = ['model' => cfg_str('RUNWAY_VIDEO_MODEL', 'gemini_omni_flash_1.2'), 'promptText' => $full, 'ratio' => $ratio, 'duration' => $secs]; if ($image !== '') $body['promptImage'] = [['uri' => $image, 'position' => 'first']];
  [$code, $res, $errno] = runway_request('POST', $image !== '' ? '/v1/image_to_video' : '/v1/text_to_video', $body, 60); $id = $code === 200 ? (string)(json_decode($res, true)['id'] ?? '') : '';
  if ($id === '') { quota_adjust('vid', $plan['s'], -1, $cap); quota_adjust('vid_all', 'all', -1, $all); [$c, $m, $r] = runway_problem($code, $res, $errno); fail($c, $m, $r); }
  file_put_contents(job_file($id), json_encode(['s' => $plan['s']]), LOCK_EX); echo json_encode(['id' => $id, 'seconds' => $secs]); exit;
}
limit('aividpoll', 600); $id = (string)($_GET['id'] ?? ''); if (!preg_match('/^[A-Za-z0-9-]{8,64}$/', $id)) fail(400, 'Bad request'); $plan = require_premium([]);
$job = is_file(job_file($id)) ? (array)json_decode((string)file_get_contents(job_file($id)), true) : []; if (($job['s'] ?? '') !== $plan['s']) fail(404, 'That clip was not found.');
$t = runway_task($id); $st = (string)($t['status'] ?? '');
if (!empty($_GET['file'])) {
  if ($st !== 'SUCCEEDED') fail(409, 'The clip is not ready.'); $x = try_fetch((string)($t['output'][0] ?? ''), 45000000, 60); if ($x['code'] !== 200 || $x['body'] === '') fail(502, 'The finished clip could not be downloaded.', 'provider');
  header('Content-Type: video/mp4'); header('Cache-Control: no-store'); echo $x['body']; exit;
}
if ($st === 'SUCCEEDED') { echo '{"status":"done"}'; exit; }
if ($st === 'FAILED' || $st === 'CANCELLED') { job_give_back($id, $job); [, $m, $r] = runway_task_error($t); echo json_encode(['status' => 'failed', 'error' => $m, 'reason' => $r]); exit; }
echo json_encode(['status' => 'working', 'progress' => (float)($t['progress'] ?? 0)]);
