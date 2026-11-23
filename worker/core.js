/* Shared helpers for the Creatagious Worker: responses, settings, D1 storage, limits and Premium tokens. */
export class Fail extends Error { constructor(code, msg, reason = '') { super(msg); this.code = code; this.reason = reason; } }
export const fail = (code, msg, reason = '') => { throw new Fail(code, msg, reason); };
export const json = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
export const bytes = (b, type, extra = {}) => new Response(b, { headers: { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const enc = new TextEncoder();
export const clip = (v, n) => (typeof v === 'string' ? v : '').trim().slice(0, n).trim();
export const clips = (v, count, n) => (Array.isArray(v) ? v : []).slice(0, count).map((t) => clip(t, n)).filter(Boolean);

/* Settings: secrets and variables set in Cloudflare. */
export const str = (env, k, def = '') => { const v = env[k]; return typeof v === 'string' && v.trim() ? v.trim() : def; };
export const num = (env, k, def) => { const v = Number(env[k]); return Number.isFinite(v) && env[k] !== '' && env[k] != null ? Math.max(0, Math.floor(v)) : def; };
export const key = (env, k) => { const v = str(env, k); return v === 'PUT_YOUR_KEY_HERE' ? '' : v; };
export const localTest = (env) => env.ALLOW_LOCAL === '1';

/* Hex and base64url helpers */
export const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export const b64u = (buf) => { const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
export const unb64u = (s) => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const t = atob(s), o = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) o[i] = t.charCodeAt(i); return o; };
export const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
export const hmac = async (secret, msg) => { const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return hex(await crypto.subtle.sign('HMAC', k, enc.encode(msg))); };
export const same = (a, b) => { a = String(a); b = String(b); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

/* D1 storage. Tables are created on first use. */
let ready = null;
export function db(env) { if (!env.DB) fail(503, 'Storage is not connected yet. Add the D1 database binding named DB.', 'no_storage'); return env.DB; }
export async function init(env) {
  if (!env.DB) return false; if (ready) return ready;
  ready = env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS counters (k TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0, exp INTEGER NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL, exp INTEGER)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS devices (device TEXT PRIMARY KEY, sub TEXT NOT NULL, updated INTEGER NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS reminders (device TEXT NOT NULL, id TEXT NOT NULL, at INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, sent INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (device, id))'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS reminders_due ON reminders (sent, at)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS reports (at TEXT, reason TEXT, details TEXT, headline TEXT, sub TEXT, source TEXT)')
  ]).then(() => true).catch((e) => { ready = null; throw e; });
  return ready;
}
export const metaGet = async (env, k) => { await init(env); const r = await db(env).prepare('SELECT v, exp FROM meta WHERE k = ?').bind(k).first(); return r && (!r.exp || r.exp > Date.now()) ? r.v : null; };
export const metaSet = async (env, k, v, ttlMs = 0) => { await init(env); await db(env).prepare('INSERT INTO meta (k, v, exp) VALUES (?1, ?2, ?3) ON CONFLICT(k) DO UPDATE SET v = ?2, exp = ?3').bind(k, v, ttlMs ? Date.now() + ttlMs : null).run(); };
/* A value created once and kept, like the signing secret. */
export async function lasting(env, k, make) { const v = await metaGet(env, k); if (v) return v; const n = await make(); await init(env); await db(env).prepare('INSERT OR IGNORE INTO meta (k, v, exp) VALUES (?, ?, NULL)').bind(k, n).run(); return (await metaGet(env, k)) || n; }

export const ipOf = (req) => req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || 'local';
export const clientId = async (req) => (await sha256('ip|' + ipOf(req))).slice(0, 32);

/* Requests per hour from one address. Skipped when storage is not connected. */
export async function limit(env, req, bucket, max) {
  if (!env.DB) return; await init(env); const hour = Math.floor(Date.now() / 36e5), k = `rl:${bucket}:${(await sha256(ipOf(req) + bucket)).slice(0, 24)}:${hour}`;
  const r = await env.DB.prepare('INSERT INTO counters (k, n, exp) VALUES (?1, 1, ?2) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n').bind(k, (hour + 2) * 36e5).first();
  if (r && r.n > max) fail(429, 'Too many requests. Please try again later.', 'rate_limit');
}
/* Daily allowances. Returned with a negative amount if the provider call fails. */
export async function quota(env, bucket, who, by, cap) {
  const d = db(env); await init(env); const day = new Date().toISOString().slice(0, 10), k = `q:${day}:${bucket}:${who}`, exp = Date.now() + 2 * 864e5;
  if (by <= 0) { await d.prepare('UPDATE counters SET n = MAX(0, n + ?1) WHERE k = ?2').bind(by, k).run(); return true; }
  await d.prepare('INSERT OR IGNORE INTO counters (k, n, exp) VALUES (?, 0, ?)').bind(k, exp).run();
  const r = await d.prepare('UPDATE counters SET n = n + ?1 WHERE k = ?2 AND n + ?1 <= ?3').bind(by, k, cap).run();
  return (r.meta && r.meta.changes) > 0;
}

/* Premium tokens: signed here, so paid AI cannot be unlocked from the browser. */
const planSecret = (env) => str(env, 'PLAN_SECRET') || lasting(env, 'plan_secret', () => hex(crypto.getRandomValues(new Uint8Array(32))));
export async function licenseHashes(env) {
  const h = str(env, 'LICENSE_CODE_HASHES').split(/[\s,]+/).filter((x) => /^[0-9a-f]{64}$/i.test(x)).map((x) => x.toLowerCase());
  for (const c of str(env, 'PREMIUM_CODES').split(',').map((x) => x.trim()).filter(Boolean)) h.push(await sha256(c.toUpperCase()));
  return h;
}
export const licenseSub = async (h) => (await sha256('sub|' + h)).slice(0, 24);
export async function planMake(env, sub, days = 30) { const exp = Math.floor(Date.now() / 1000) + days * 86400, p = b64u(enc.encode(JSON.stringify({ s: sub, e: exp }))); return [p + '.' + await hmac(await planSecret(env), p), exp]; }
export async function planRead(env, token) {
  const x = String(token || '').split('.'); if (x.length !== 2 || !env.DB && !str(env, 'PLAN_SECRET')) return null;
  if (!same(await hmac(await planSecret(env), x[0]), x[1])) return null; let d; try { d = JSON.parse(new TextDecoder().decode(unb64u(x[0]))); } catch (e) { return null; }
  if (!d || +d.e < Date.now() / 1000) return null; for (const h of await licenseHashes(env)) if (same(await licenseSub(h), d.s || '')) return d; return null;
}
export const requestToken = (req, input = {}) => String(input.token || req.headers.get('X-Plan-Token') || '');
export async function requirePremium(env, req, input) { const p = await planRead(env, requestToken(req, input)); if (!p) fail(402, 'Enter your Premium code to use this feature.', 'premium'); return p; }
export async function body(req, max = 60000) {
  if (req.method !== 'POST') fail(405, 'POST only'); const t = await req.text(); if (t.length > max) fail(413, 'That request is too large.'); let d; try { d = JSON.parse(t); } catch (e) { fail(400, 'Bad request'); }
  if (!d || typeof d !== 'object' || Array.isArray(d)) fail(400, 'Bad request'); return d;
}
