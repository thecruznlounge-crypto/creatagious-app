/* Creatagious on Cloudflare: serves the app and runs the API (worker/api.js).
   The scheduled handler runs every minute and sends due post reminders. */
import { handleApi, sendDue } from './worker/api.js';
const PRIVATE = /^\/(worker|api\/.*\.(php|md|json))(\/|$)|^\/(wrangler\.jsonc|_worker\.js|\.assetsignore|\.gitignore|README\.md|PLAY_STORE\.md)$|\/\.(?!well-known)/i;
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url), path = url.pathname;
    if (path.startsWith('/api/')) return handleApi(req, env, ctx, path);
    if (PRIVATE.test(path)) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(req);
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(sendDue(env)); }
};
