/* Edit this file for your deployment. Bump VERSION together with service-worker.js. */
window.A = window.A || {};
A.CONFIG = {
  VERSION: '2.8.0',
  SUPPORT_EMAIL: 'support@creatagious.com',
  // Optional server features. The app works without them, on-device and offline.
  AI_ENDPOINT: 'api/generate.php',
  SCRAPE_ENDPOINT: 'api/scrape.php',
  REPORT_ENDPOINT: 'api/report.php',
  LICENSE_ENDPOINT: 'api/license.php',
  IMAGE_PROXY: 'api/img.php',
  VOICE_ENDPOINT: 'api/voice.php',
  IMAGE_ENDPOINT: 'api/image.php',
  VIDEO_ENDPOINT: 'api/video.php',
  HEALTH_ENDPOINT: 'api/health.php',
  AI_TIMEOUT_MS: 55000,
  SCRAPE_TIMEOUT_MS: 75000,
  IMAGE_TIMEOUT_MS: 180000,
  PUSH_ENDPOINT: 'api/push.php',
  // Shown in the plan comparison. Keep these in step with the Worker settings in wrangler.jsonc.
  FREE_AI_COPY_LABEL: '3 a day',
  PREMIUM_AI_COPY_LABEL: '100 a day',
  PREMIUM_AI_IMAGE_LABEL: '30 a day',
  PREMIUM_AI_VIDEO_LABEL: '5 clips a day',
  AI_CLIP_SECONDS: 5,
  // TESTING ONLY: shows the Free and Premium test switch. Set to false before launch.
  PREMIUM_PREVIEW: true,
  PREMIUM_PRICE_LABEL: '',           // Example: '$00.00 per month'
  CHECKOUT_URL: '',                  // Web checkout link. Never shown inside the Play app.
  PLAY_SKU: '',                      // Google Play subscription product ID
  ADSENSE_CLIENT: '',                // Example: 'ca-pub-0000000000000000'. Web only.
  ADSENSE_SLOT: ''
};
