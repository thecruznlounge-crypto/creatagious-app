/* Calls to Claude (copy and website search), Runway (images and clips) and ElevenLabs (voices). */
import { fail, Fail, str, key } from './core.js';
async function call(method, url, headers, payload, timeoutMs) {
  const h = { ...headers }; if (payload != null) h['Content-Type'] = 'application/json';
  try { const r = await fetch(url, { method, headers: h, body: payload != null ? JSON.stringify(payload) : undefined, signal: AbortSignal.timeout(timeoutMs) }); return { code: r.status, res: r, text: () => r.text() }; }
  catch (e) { return { code: 0, timeout: e && (e.name === 'TimeoutError' || e.name === 'AbortError'), text: async () => '' }; }
}
const parse = (t) => { try { return JSON.parse(t); } catch (e) { return {}; } };

/* Claude */
export const claudeKey = (env) => key(env, 'ANTHROPIC_API_KEY');
export const textModel = (env) => str(env, 'CLAUDE_MODEL', 'claude-haiku-5-5');
export function claudeRequest(env, method, path, payload, timeoutMs) { const k = claudeKey(env); if (!k) fail(503, 'Claude is not connected yet.', 'not_configured'); return call(method, str(env, 'ANTHROPIC_BASE_URL', 'https://api.anthropic.com/v1').replace(/\/$/, '') + path, { 'x-api-key': k, 'anthropic-version': '2023-06-01' }, payload, timeoutMs); }
export function claudeProblem(code, txt, timeout) {
  const e = parse(txt).error || {}, type = String(e.type || ''), msg = String(e.message || '').toLowerCase();
  if (timeout) return [504, 'Claude took too long. Please try again.', 'timeout'];
  if (code === 401 || type === 'authentication_error') return [502, 'Claude rejected the API key on the server.', 'bad_key'];
  if (msg.includes('credit balance') || msg.includes('billing')) return [502, 'The Claude account is out of credit.', 'no_credit'];
  if (code === 404 || code === 403 || msg.includes('model')) return [502, 'This Claude account cannot use the selected model. Check Setup in Profile.', 'model'];
  if (code === 429 || code === 529) return [429, 'Claude is busy. Please try again shortly.', 'busy'];
  return [502, 'Claude could not finish that request.', 'provider'];
}
const claudeFail = async (r) => { const [c, m, w] = claudeProblem(r.code, await r.text(), r.timeout); fail(c, m, w); };
const claudeText = (d) => (d.content || []).filter((b) => b.type === 'text').map((b) => b.text || '').join('');
export async function aiJson(env, system, user, schema, timeoutMs, maxTokens = 4000) {
  const r = await claudeRequest(env, 'POST', '/messages', { model: textModel(env), max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }], output_config: { format: { type: 'json_schema', schema } } }, timeoutMs);
  if (r.code !== 200) await claudeFail(r); const d = parse(await r.text());
  if (d.stop_reason === 'refusal') fail(422, 'That request was declined.', 'declined'); if (d.stop_reason === 'max_tokens') fail(502, 'The answer was too long. Please try again.', 'provider');
  const out = parse(claudeText(d)); if (!out || typeof out !== 'object' || Array.isArray(out) || !Object.keys(out).length) fail(502, 'Claude returned an unusable answer.', 'provider'); return out;
}
export async function claudeSearch(env, system, user, domain, timeoutMs) {
  const messages = [{ role: 'user', content: user }]; let text = ''; const sources = new Map();
  for (let i = 0; i < 3; i++) {
    const r = await claudeRequest(env, 'POST', '/messages', { model: textModel(env), max_tokens: 2500, system, messages, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3, allowed_domains: [domain] }] }, timeoutMs);
    if (r.code !== 200) await claudeFail(r); const d = parse(await r.text());
    for (const b of d.content || []) { if (b.type !== 'text') continue; text += b.text || ''; for (const c of b.citations || []) if (c.url && /^https?:\/\//i.test(c.url)) sources.set(c.url, c.title || ''); }
    if (d.stop_reason !== 'pause_turn') break; messages.push({ role: 'assistant', content: d.content }); text = '';
  }
  return [text, sources];
}

/* Runway */
export const runwayKey = (env) => key(env, 'RUNWAY_API_KEY');
export function runwayRequest(env, method, path, payload, timeoutMs = 30000) { const k = runwayKey(env); if (!k) fail(503, 'Runway is not connected yet.', 'not_configured'); return call(method, str(env, 'RUNWAY_BASE_URL', 'https://api.dev.runwayml.com').replace(/\/$/, '') + path, { Authorization: 'Bearer ' + k, 'X-Runway-Version': '2024-11-06' }, payload, timeoutMs); }
export function runwayProblem(code, txt, timeout) {
  const msg = String(txt).toLowerCase();
  if (timeout) return [504, 'Runway took too long. Please try again.', 'timeout'];
  if (code === 401 || code === 403) return [502, 'Runway rejected the API key on the server.', 'bad_key'];
  if (msg.includes('credit')) return [502, 'The Runway account is out of credits.', 'no_credit'];
  if (code === 429) return [429, 'Runway is busy. Please try again shortly.', 'busy'];
  if (msg.includes('moderation') || msg.includes('safety')) return [422, 'That request was declined. Try different wording.', 'declined'];
  return [502, 'Runway could not start that request.', 'provider'];
}
export function runwayTaskError(t) { const c = String(t.failureCode || '').toUpperCase(); if (c.startsWith('SAFETY') || c.includes('MODERATION')) return [422, 'That request was declined. Try different wording.', 'declined']; return [502, 'Runway could not finish that request. Please try again.', 'provider']; }
export async function runwayTask(env, id) { const r = await runwayRequest(env, 'GET', '/v1/tasks/' + encodeURIComponent(id), null, 20000); const t = await r.text(); if (r.code !== 200) { const [c, m, w] = runwayProblem(r.code, t, r.timeout); fail(c, m, w); } return parse(t); }

/* ElevenLabs */
export const elevenKey = (env) => key(env, 'ELEVENLABS_API_KEY');
export const eleven = (env, method, path, payload, timeoutMs = 45000) => call(method, str(env, 'ELEVENLABS_BASE_URL', 'https://api.elevenlabs.io').replace(/\/$/, '') + path, { 'xi-api-key': elevenKey(env), Accept: '*/*' }, payload, timeoutMs);
export { Fail };
