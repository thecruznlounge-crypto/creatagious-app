<?php
// Copy to secret.php on your server and add your keys. Never commit or share secret.php.
return [
  'ANTHROPIC_API_KEY' => 'PUT_YOUR_KEY_HERE',   // Ad copy and website search
  'RUNWAY_API_KEY' => 'PUT_YOUR_KEY_HERE',      // AI images and video clips
  'ELEVENLABS_API_KEY' => 'PUT_YOUR_KEY_HERE',  // AI voices. Use a paid plan for commercial rights.

  // Models can be changed here without touching the app.
  'CLAUDE_MODEL' => 'claude-haiku-5-5',
  'RUNWAY_IMAGE_MODEL' => 'seedream5_flash',
  'RUNWAY_VIDEO_MODEL' => 'gemini_omni_flash_1.2',
  'RUNWAY_VIDEO_HEIGHT' => 720,                 // 720 or 1080
  'RUNWAY_VIDEO_SECONDS' => 5,                  // 3 to 15
  'ELEVENLABS_MODEL' => 'eleven_v4',

  // Premium codes. Anyone with a code gets paid AI, so keep them private.
  'PREMIUM_CODES' => ['CHANGE-THIS-TEST-CODE'],
  // Or sha256 hashes of uppercase codes: php -r "echo hash('sha256','MYCODE');"
  'LICENSE_CODE_HASHES' => [],

  // Spending limits per day
  'FREE_AI_COPY_PER_DAY' => 3,
  'PREMIUM_AI_COPY_PER_DAY' => 100,
  'AI_COPY_DAILY_LIMIT' => 1000,
  'FREE_SITE_SEARCHES_PER_DAY' => 2,
  'PREMIUM_SITE_SEARCHES_PER_DAY' => 30,
  'PREMIUM_AI_IMAGES_PER_DAY' => 30,
  'AI_IMAGES_DAILY_LIMIT' => 200,
  'PREMIUM_AI_VIDEOS_PER_DAY' => 5,
  'AI_VIDEOS_DAILY_LIMIT' => 30,
  'VOICE_DAILY_CHARACTERS' => 20000,
];
