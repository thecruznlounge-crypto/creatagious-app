<?php
function site_clean(string $s, int $n): string { return trim(mb_substr(trim((string)preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($s), ENT_QUOTES, 'UTF-8'))), 0, $n)); }
function site_hex(string $c): ?string {
  $c = strtolower(trim($c)); if (preg_match('/^#([0-9a-f]{3})$/', $c, $m)) $c = '#' . $m[1][0].$m[1][0].$m[1][1].$m[1][1].$m[1][2].$m[1][2];
  elseif (preg_match('/^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/', $c, $m)) $c = sprintf('#%02x%02x%02x', min(255,(int)$m[1]), min(255,(int)$m[2]), min(255,(int)$m[3]));
  if (!preg_match('/^#[0-9a-f]{6}$/', $c)) return null; [$r,$g,$b] = sscanf($c, '#%02x%02x%02x'); $max = max($r,$g,$b); $min = min($r,$g,$b); if ($max - $min < 38 || $max < 45 || $min > 225) return null; return strtoupper($c);
}
function site_junk(string $t): bool {
  return (bool)preg_match('/cookie|privacy|terms (of|and)|all rights reserved|©|copyright|skip to|sign in|log ?in\b|enable javascript|javascript is|newsletter|your cart|shopping cart|powered by|loading\.\.\.|404|page not found|just a moment|verify you are human|accept all/iu', $t);
}
function site_generic(string $t): bool {
  if (preg_match('/^(about|contact|welcome to)\b/iu', trim($t)) && site_words($t) <= 5) return true;
  return (bool)preg_match('/^(home|menu|main menu|navigation|search|contact|contact us|get in touch|about|about us|services|our services|products|our products|faq|faqs|blog|news|latest news|testimonials|reviews|gallery|follow us|quick links|links|hours|location|locations|welcome|share|related posts?|categories)[.!:]?$/iu', trim($t));
}
function site_add(array &$list, string $t, int $max): void { if ($t !== '' && count($list) < $max && !in_array(mb_strtolower($t), array_map('mb_strtolower', $list), true)) $list[] = $t; }
function site_words(string $t): int { return count(preg_split('/\s+/u', trim($t)) ?: []); }

function parse_site(string $html, string $base, array $css = []): array {
  libxml_use_internal_errors(true); $dom = new DOMDocument(); $dom->loadHTML('<?xml encoding="utf-8"?>' . $html, LIBXML_NONET | LIBXML_NOWARNING | LIBXML_NOERROR); $x = new DOMXPath($dom); libxml_clear_errors();
  $meta = function (string $q) use ($x) { $n = $x->query($q); return $n && $n->length ? trim((string)$n->item(0)->getAttribute('content')) : ''; };
  $out = ['title' => '', 'description' => '', 'site' => '', 'headings' => [], 'paragraphs' => [], 'items' => [], 'cta' => [], 'offers' => [], 'phone' => '', 'logo' => '', 'colors' => [], 'images' => [], 'links' => [], 'words' => 0];
  $tn = $x->query('//title'); $title = $meta('//meta[@property="og:title"]') ?: ($tn && $tn->length ? $tn->item(0)->textContent : '');
  $out['title'] = site_clean($title, 120); $out['description'] = site_clean($meta('//meta[@property="og:description"]') ?: $meta('//meta[@name="description"]'), 300); $out['site'] = site_clean($meta('//meta[@property="og:site_name"]') ?: $meta('//meta[@name="application-name"]'), 40);
  $images = []; $add = function (string $u) use (&$images, $base) { $a = abs_url($u, $base); if ($a !== '' && preg_match('#^https?://#i', $a) && !preg_match('/\.svg(\?|$)|sprite|pixel|spacer|blank\.|favicon|icon[-_.]|avatar|gravatar|logo|placeholder|1x1/i', $a) && !in_array($a, $images, true) && count($images) < 14) $images[] = $a; };
  foreach (['//meta[@property="og:image"]', '//meta[@property="og:image:secure_url"]', '//meta[@name="twitter:image"]'] as $q) foreach ($x->query($q) ?: [] as $n) $add($n->getAttribute('content'));

  /* Structured data: the most reliable source on many sites. */
  $bizName = ''; $webName = '';
  $walk = function ($j) use (&$walk, &$out, &$bizName, &$webName, $add, $base) {
    if (!is_array($j)) return; $ty = $j['@type'] ?? ''; $ty = is_array($ty) ? implode(' ', array_filter($ty, 'is_string')) : (string)$ty; $name = is_string($j['name'] ?? null) ? site_clean($j['name'], 70) : ''; $text = is_string($j['description'] ?? null) ? site_clean($j['description'], 220) : '';
    if (preg_match('/Organization|Business|Restaurant|Store|Corporation|Brand|Hotel|Salon|Agency|Attorney|Dentist|Gym|Service$/i', $ty) && !preg_match('/^(Product|Offer)/i', $ty)) { if ($name && !$bizName && !preg_match('/^Service$/i', $ty)) $bizName = $name; if ($text && !preg_match('/^Service$/i', $ty)) site_add($out['paragraphs'], $text, 8); if (is_string($j['telephone'] ?? null) && !$out['phone']) $out['phone'] = site_clean($j['telephone'], 24); }
    if (preg_match('/WebSite/i', $ty) && $name && !$webName) $webName = $name;
    if (preg_match('/\b(Product|Service|MenuItem|Course|Event)\b/i', $ty) && $name) { $o = $j['offers'] ?? []; if (isset($o[0])) $o = $o[0]; $price = is_array($o) && isset($o['price']) && is_scalar($o['price']) ? trim((($o['priceCurrency'] ?? '') === 'USD' ? '$' : '') . $o['price']) : ''; if (count($out['items']) < 12) $out['items'][] = ['name' => $name, 'text' => $text, 'price' => site_clean($price, 16)]; }
    foreach (['logo', 'image'] as $k) { $v = $j[$k] ?? null; if (is_array($v)) $v = $v['url'] ?? ($v[0] ?? null); if (is_array($v)) $v = $v['url'] ?? null; if (is_string($v) && preg_match('#^(https?:|/)#', $v)) { if ($k === 'logo') { if (!$out['logo']) $out['logo'] = abs_url($v, $base); } else $add($v); } }
    foreach ($j as $v) if (is_array($v)) $walk($v);
  };
  foreach ($x->query('//script[@type="application/ld+json"]') ?: [] as $n) $walk(json_decode(trim($n->textContent), true));

  /* App data embedded in pages built with JavaScript. */
  $embedded = [];
  foreach ($x->query('//script[@id="__NEXT_DATA__" or @id="__NUXT_DATA__" or @type="application/json"]') ?: [] as $n) {
    if (strlen($n->textContent) > 700000) continue; $seen = 0;
    $grab = function ($j, $k = '') use (&$grab, &$embedded, &$seen) { if ($seen++ > 5000) return; if (is_array($j)) { foreach ($j as $kk => $v) $grab($v, is_string($kk) ? $kk : $k); return; } if (is_string($j) && preg_match('/^(title|heading|headline|subtitle|subheading|tagline|description|summary|body|text|content|name)$/i', $k) && !preg_match('#https?:|[{}<>_]|^/#', $j)) { $t = site_clean($j, 220); if (site_words($t) >= 3 && !site_junk($t)) $embedded[$t] = 1; } };
    $grab(json_decode($n->textContent, true));
  }

  /* Logo, colors and page links are read before page furniture is removed. */
  foreach ($x->query('//img') ?: [] as $n) { $sig = strtolower($n->getAttribute('class') . ' ' . $n->getAttribute('id') . ' ' . $n->getAttribute('alt') . ' ' . $n->getAttribute('src')); $src = $n->getAttribute('src') ?: $n->getAttribute('data-src'); if (!$out['logo'] && str_contains($sig, 'logo') && $src && !preg_match('/\.svg(\?|$)/i', $src)) $out['logo'] = abs_url($src, $base); }
  if (!$out['logo']) foreach (['//link[contains(@rel,"apple-touch-icon")]', '//link[@rel="icon" and contains(@href,".png")]'] as $q) { $n = $x->query($q); if ($n && $n->length) { $out['logo'] = abs_url($n->item(0)->getAttribute('href'), $base); break; } }
  $count = []; $bump = function (?string $c, int $by) use (&$count) { if ($c) $count[$c] = ($count[$c] ?? 0) + $by; }; $bump(site_hex($meta('//meta[@name="theme-color"]')), 40); $bump(site_hex($meta('//meta[@name="msapplication-TileColor"]')), 25);
  $style = implode("\n", $css); foreach ($x->query('//style') ?: [] as $n) $style .= "\n" . $n->textContent; foreach ($x->query('//*[@style]') ?: [] as $n) { $s = $n->getAttribute('style'); $style .= ';' . $s; if (preg_match('/background(?:-image)?\s*:[^;]*url\(["\']?([^"\')]+)/i', $s, $m)) $add($m[1]); }
  if (preg_match_all('/--[\w-]*(?:primary|brand|accent|main)[\w-]*\s*:\s*(#[0-9a-f]{3,6}|rgba?\([^)]+\))/i', $style, $m)) foreach ($m[1] as $c) $bump(site_hex($c), 20);
  if (preg_match_all('/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\(\s*\d+[ ,]+\d+[ ,]+\d+/i', substr($style, 0, 600000), $m)) foreach ($m[0] as $c) $bump(site_hex(str_starts_with($c, 'rgb') ? $c . ')' : $c), 1);
  arsort($count); $out['colors'] = array_slice(array_keys($count), 0, 6);
  $host = strtolower((string)parse_url($base, PHP_URL_HOST)); $links = [];
  foreach ($x->query('//a[@href]') ?: [] as $n) { $u = abs_url($n->getAttribute('href'), $base); $ph = strtolower((string)parse_url($u, PHP_URL_HOST)); if ($u === '' || preg_replace('/^www\./', '', $ph) !== preg_replace('/^www\./', '', $host)) continue; $u = (string)strtok($u, '#'); $path = strtolower((string)parse_url($u, PHP_URL_PATH)); if (preg_match('/\.(pdf|jpe?g|png|webp|zip)$/', $path) || trim($path, '/') === '') continue; if (preg_match('/about|service|product|menu|pricing|prices|rates|shop|collection|offer|special|fleet|work|solution/', $path . ' ' . strtolower($n->textContent), $m)) $links[$u] = min($links[$u] ?? 99, strpos('about service product menu pricing prices rates shop collection offer special fleet work solution', $m[0])); }
  asort($links); $out['links'] = array_slice(array_keys($links), 0, 3);
  foreach ($x->query('//a[starts-with(@href,"tel:")]') ?: [] as $n) { if (!$out['phone']) $out['phone'] = site_clean(substr($n->getAttribute('href'), 4), 24); }

  /* Remove page furniture so ads are built from real content. */
  foreach ($x->query('//script|//style|//template|//svg|//nav|//footer|//aside|//form[contains(@role,"search")]|//*[@role="navigation" or @role="dialog" or @aria-hidden="true"]|//*[contains(translate(@class,"COKIE","cokie"),"cookie") or contains(translate(@id,"COKIE","cokie"),"cookie") or contains(@class,"consent") or contains(@class,"popup") or contains(@class,"modal")]') ?: [] as $n) if ($n->parentNode) $n->parentNode->removeChild($n);
  foreach ($x->query('//h1|//h2') ?: [] as $n) { $t = site_clean($n->textContent, 90); if (mb_strlen($t) > 3 && !site_junk($t) && !site_generic($t)) site_add($out['headings'], $t, 10); }
  foreach ($x->query('//h3|//h4') ?: [] as $n) { $t = site_clean($n->textContent, 70); if (mb_strlen($t) < 3 || site_junk($t) || site_generic($t) || count($out['items']) >= 12) continue; foreach ($out['items'] as $i) if (mb_strtolower($i['name']) === mb_strtolower($t)) continue 2; $p = $x->query('following-sibling::p[1]', $n); $s = $p && $p->length ? site_clean($p->item(0)->textContent, 200) : ''; $out['items'][] = ['name' => $t, 'text' => site_junk($s) ? '' : $s, 'price' => '']; }
  $all = []; foreach ($x->query('//body//*[self::p or self::li or self::h1 or self::h2 or self::h3 or self::strong or self::b or self::span or self::a or self::button or self::div[not(*)]]') ?: [] as $n) { $t = site_clean($n->textContent, 240); if ($t !== '' && !site_junk($t)) $all[$t] = 1; if (count($all) > 600) break; }
  foreach ($x->query('//p|//li[string-length(normalize-space(.))>60]') ?: [] as $n) { $t = site_clean($n->textContent, 240); if (mb_strlen($t) >= 45 && site_words($t) >= 8 && !site_junk($t)) site_add($out['paragraphs'], $t, 10); }
  $out['words'] = site_words(implode(' ', array_keys($all)));
  if ($out['words'] < 60) foreach (array_keys($embedded) as $t) { if (site_words($t) >= 9) site_add($out['paragraphs'], $t, 10); elseif (!site_generic($t)) site_add($out['headings'], $t, 10); $out['words'] += site_words($t); }
  $body = implode(' | ', array_keys($all));
  $offerRe = '\d{1,3}\s?% off|save \$?\d[\d,.]*|free shipping|free delivery|free trial|free consultation|free estimate|free quote|buy one get one|from \$\d[\d,.]*|\$\d[\d,.]*\s*(?:off|per|\/)';
  foreach (array_keys($all) as $t) foreach (preg_split('/(?<=[.!?])\s+/u', $t) ?: [] as $line) { if (!preg_match("/$offerRe/iu", $line)) continue; if (mb_strlen($line) <= 100) site_add($out['offers'], site_clean(rtrim($line, '.!'), 100), 5); elseif (preg_match("/[^,;:]{0,36}(?:$offerRe)[^,;:]{0,30}/iu", $line, $m)) site_add($out['offers'], site_clean(preg_replace('/\s+\S*$/u', '', $m[0]), 80), 5); }
  $cta = []; foreach ($x->query('//a|//button|//input[@type="submit"]') ?: [] as $n) { $t = site_clean($n->nodeName === 'input' ? $n->getAttribute('value') : $n->textContent, 30); if (mb_strlen($t) < 3 || mb_strlen($t) > 24 || site_junk($t) || !preg_match('/^(book|get|order|buy|shop|start|try|reserve|call|schedule|request|join|sign up|contact us|learn more|see|view|claim|download|subscribe|apply|rent|hire|visit|explore|discover|donate|find)\b/iu', $t)) continue; $btn = preg_match('/btn|button|cta/i', $n->getAttribute('class')) || $n->nodeName !== 'a'; $cta[$t] = max($cta[$t] ?? 0, $btn ? 2 : 1); }
  arsort($cta); $out['cta'] = array_slice(array_keys($cta), 0, 4);
  foreach ($x->query('//img|//source') ?: [] as $n) { $w = (int)$n->getAttribute('width'); $h = (int)$n->getAttribute('height'); $src = $n->getAttribute('src') ?: $n->getAttribute('data-src') ?: $n->getAttribute('data-lazy-src') ?: $n->getAttribute('data-original'); $set = $n->getAttribute('srcset') ?: $n->getAttribute('data-srcset'); if ($set) { $bestW = -1; foreach (explode(',', $set) as $part) { $bits = preg_split('/\s+/', trim($part)); $bw = (int)($bits[1] ?? 0); if ($bw >= $bestW && !empty($bits[0])) { $bestW = $bw; $src = $bits[0]; } } } if (($w && $w < 220) || ($h && $h < 160)) continue; if ($src) $add($src); }
  $out['images'] = $images;
  if (!$out['site']) $out['site'] = $bizName ?: $webName;
  if (!$out['site'] && $out['title']) { $bits = array_values(array_filter(array_map('trim', preg_split('/\s[|–—:·-]\s/u', $out['title']) ?: []), function ($b) { return !site_generic($b); })); $hostKey = preg_replace('/[^a-z0-9]/', '', explode('.', preg_replace('/^www\./', '', $host))[0]); $pick = ''; foreach ($bits as $b) { $k = preg_replace('/[^a-z0-9]/', '', strtolower($b)); if ($k !== '' && (str_contains($hostKey, $k) || str_contains($k, $hostKey))) { $pick = $b; break; } } if (!$pick && count($bits) > 1) $pick = $bits[0]; $out['site'] = site_clean($pick, 40); }
  return $out;
}
function merge_site(array $a, array $b): array {
  foreach (['headings' => 12, 'paragraphs' => 12, 'offers' => 6, 'cta' => 5] as $k => $n) foreach ($b[$k] as $t) site_add($a[$k], $t, $n);
  foreach ($b['items'] as $i) { if (count($a['items']) >= 14) break; foreach ($a['items'] as $e) if (mb_strtolower($e['name']) === mb_strtolower($i['name'])) continue 2; $a['items'][] = $i; }
  foreach ($b['images'] as $u) if (count($a['images']) < 18 && !in_array($u, $a['images'], true)) $a['images'][] = $u;
  foreach (['logo', 'phone', 'description', 'site'] as $k) if (!$a[$k]) $a[$k] = $b[$k]; if (!$a['colors']) $a['colors'] = $b['colors']; $a['words'] += $b['words']; return $a;
}
