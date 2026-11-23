<?php
require __DIR__ . '/common.php';
$in = body(); limit('report', 20);
$row = ['at' => gmdate('c')]; foreach (['reason' => 60, 'details' => 500, 'headline' => 100, 'sub' => 160, 'source' => 12] as $k => $n) $row[$k] = mb_substr((string)($in[$k] ?? ''), 0, $n);
file_put_contents(data_dir() . '/reports.jsonl', json_encode($row, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
echo '{"ok":true}';
