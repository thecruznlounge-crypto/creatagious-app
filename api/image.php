<?php
require __DIR__ . '/common.php'; require __DIR__ . '/net.php'; require __DIR__ . '/ai.php';
$in = body(); limit('aiimg', 60); @set_time_limit(190); $plan = require_premium($in);
$prompt = trim(mb_substr((string)($in['prompt'] ?? ''), 0, 1200)); if (mb_strlen($prompt) < 3) fail(400, 'Describe the image first.');
$ratios = ['square' => '1024:1024', 'feed' => '896:1184', 'story' => '768:1376', 'pin' => '768:1376', 'wide' => '1376:768', 'hd' => '1376:768']; $ratio = $ratios[(string)($in['format'] ?? '')] ?? '1024:1024';
if (runway_key() === '') fail(503, 'AI images are not connected yet.', 'not_configured');
$cap = cfg_int('PREMIUM_AI_IMAGES_PER_DAY', 30); $all = cfg_int('AI_IMAGES_DAILY_LIMIT', 200);
if (!quota_adjust('img', $plan['s'], 1, $cap)) fail(429, "You have used today's $cap AI images.", 'daily_limit');
if (!quota_adjust('img_all', 'all', 1, $all)) { quota_adjust('img', $plan['s'], -1, $cap); fail(429, 'AI images have reached today\'s limit.', 'site_limit'); }
function give_back(array $plan, int $cap, int $all) { quota_adjust('img', $plan['s'], -1, $cap); quota_adjust('img_all', 'all', -1, $all); }
$full = "Polished background image for a social media advertisement. Subject: $prompt. Keep the main subject clear, with calm areas where ad text can be placed later. No words, letters, numbers, logos, watermarks, brand marks or recognizable real people.";
[$code, $res, $errno] = runway_request('POST', '/v1/text_to_image', ['model' => cfg_str('RUNWAY_IMAGE_MODEL', 'seedream5_flash'), 'promptText' => $full, 'ratio' => $ratio, 'outputFormat' => 'jpeg']);
$id = $code === 200 ? (string)(json_decode($res, true)['id'] ?? '') : ''; if ($id === '') { give_back($plan, $cap, $all); [$c, $m, $r] = runway_problem($code, $res, $errno); fail($c, $m, $r); }
$wait = max(0, cfg_int('RUNWAY_POLL_SECONDS', 5)); $end = time() + 160; $task = [];
do { if ($wait) sleep($wait); $GLOBALS['SOFT_FAIL'] = true; try { $task = runway_task($id); } catch (Throwable $e) { $task = ['status' => 'RUNNING']; } $GLOBALS['SOFT_FAIL'] = false; $st = (string)($task['status'] ?? ''); if (!$wait) usleep(50000); } while (!in_array($st, ['SUCCEEDED', 'FAILED', 'CANCELLED'], true) && time() < $end);
if ($st !== 'SUCCEEDED') { give_back($plan, $cap, $all); if ($st === 'FAILED') { [$c, $m, $r] = runway_task_error($task); fail($c, $m, $r); } fail(504, 'The image took too long. Please try again.', 'timeout'); }
$x = try_fetch((string)($task['output'][0] ?? ''), 25000000, 30); $i = $x['code'] === 200 ? @getimagesizefromstring($x['body']) : false;
if (!$i || !in_array($i['mime'], ['image/jpeg', 'image/png', 'image/webp'], true)) fail(502, 'The finished image could not be downloaded.', 'provider');
header('Content-Type: ' . $i['mime']); header('Cache-Control: no-store'); echo $x['body'];
