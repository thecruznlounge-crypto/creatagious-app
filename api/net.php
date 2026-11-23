<?php
/* Fetches public http(s) resources only: every hop is re-checked and pinned to a public IP. */
function local_test_mode(): bool { return PHP_SAPI === 'cli-server' && getenv('CREATAGIOUS_ALLOW_LOCAL') === '1'; }
function safe_target(string $url): array {
  $p = parse_url($url); $test = local_test_mode();
  if (!$p || !in_array(strtolower($p['scheme'] ?? ''), ['http','https'], true) || empty($p['host']) || isset($p['user']) || (!$test && !in_array($p['port'] ?? 0, [0,80,443], true))) fail(400, 'Enter a full website address.', 'bad_url');
  $host = strtolower(trim($p['host'], '[]')); if (!$test && ($host === 'localhost' || str_ends_with($host, '.local') || str_ends_with($host, '.internal'))) fail(400, 'That address cannot be read.', 'bad_url');
  $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []); if (!$ips) fail(400, 'That website address could not be found.', 'no_site');
  if (!$test) foreach ($ips as $ip) if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) fail(400, 'That address cannot be read.', 'bad_url');
  return [$p, $ips[0], $p['port'] ?? (strtolower($p['scheme']) === 'https' ? 443 : 80)];
}
function abs_url(string $u, string $base): string {
  $u = trim(html_entity_decode($u, ENT_QUOTES)); if ($u === '' || preg_match('/^(data|javascript|mailto|tel):|^#/i', $u)) return '';
  if (preg_match('#^https?://#i', $u)) return $u; $b = parse_url($base); if (!$b || empty($b['host'])) return ''; $o = $b['scheme'] . '://' . $b['host'] . (isset($b['port']) ? ':' . $b['port'] : '');
  if (str_starts_with($u, '//')) return $b['scheme'] . ':' . $u; if ($u[0] === '/') return $o . $u; $d = preg_replace('#/[^/]*$#', '/', $b['path'] ?? '/'); return $o . $d . $u;
}
function safe_fetch(string $url, int $max, int $timeout = 7): array {
  for ($hop = 0; $hop < 5; $hop++) {
    [$p, $ip, $port] = safe_target($url); $body = ''; $head = [];
    $c = curl_init($url);
    curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => false, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_ENCODING => '', CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; CreatagiousBot/2.4; +https://creatagious.com)', CURLOPT_HTTPHEADER => ['Accept: text/html,application/xhtml+xml,image/*,*/*;q=0.8', 'Accept-Language: en-US,en;q=0.9'], CURLOPT_RESOLVE => ["{$p['host']}:$port:$ip"], CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
      CURLOPT_HEADERFUNCTION => function ($h, $l) use (&$head) { $x = explode(':', $l, 2); if (count($x) === 2) $head[strtolower(trim($x[0]))] = trim($x[1]); return strlen($l); },
      CURLOPT_WRITEFUNCTION => function ($h, $d) use (&$body, $max) { $body .= $d; return strlen($body) > $max ? 0 : strlen($d); }]);
    curl_exec($c); $code = (int)curl_getinfo($c, CURLINFO_RESPONSE_CODE); $errno = curl_errno($c); curl_close($c);
    if ($code >= 300 && $code < 400 && !empty($head['location'])) { $url = abs_url($head['location'], $url); if ($url === '') break; continue; }
    return ['code' => $code, 'body' => $body, 'type' => $head['content-type'] ?? '', 'url' => $url, 'errno' => strlen($body) > $max ? 0 : $errno];
  }
  fail(502, 'That website redirects too many times.', 'redirects');
}
/* Same as safe_fetch, but reports problems instead of ending the request. */
function try_fetch(string $url, int $max, int $timeout): array {
  $GLOBALS['SOFT_FAIL'] = true;
  try { return safe_fetch($url, $max, $timeout); } catch (Throwable $e) { return ['code' => 0, 'body' => '', 'type' => '', 'url' => $url, 'errno' => -1, 'message' => $e->getMessage()]; } finally { $GLOBALS['SOFT_FAIL'] = false; }
}
