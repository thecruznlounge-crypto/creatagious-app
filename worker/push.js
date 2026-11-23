/* Web Push: VAPID signing (RFC 8292) and payload encryption (RFC 8291, aes128gcm), with Web Crypto only. */
import { b64u, unb64u, enc, lasting, str } from './core.js';
const concat = (...a) => { const n = a.reduce((s, x) => s + x.length, 0), o = new Uint8Array(n); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
/* VAPID keys are created once and stored, so there is nothing to set up. */
export async function vapid(env) {
  const v = await lasting(env, 'vapid', async () => { const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']); return JSON.stringify({ jwk: await crypto.subtle.exportKey('jwk', k.privateKey), pub: b64u(await crypto.subtle.exportKey('raw', k.publicKey)) }); });
  return JSON.parse(v);
}
async function jwt(env, aud) {
  const { jwk } = await vapid(env), k = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const h = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))), p = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: str(env, 'VAPID_SUBJECT', 'mailto:support@creatagious.com') })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, enc.encode(h + '.' + p)); return h + '.' + p + '.' + b64u(sig);
}
const hkdf = async (salt, ikm, info, len) => new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), len * 8));
export async function encrypt(sub, payload) {
  const ua = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth), local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey)), uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), ua, asPub), 32), salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16), nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']), ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(enc.encode(payload), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); return concat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}
/* Sends one notification. Returns the HTTP status; 404 and 410 mean the subscription is gone. */
export async function send(env, sub, data, ttl = 86400) {
  const u = new URL(sub.endpoint), body = await encrypt(sub, JSON.stringify(data)), { pub } = await vapid(env);
  const r = await fetch(sub.endpoint, { method: 'POST', headers: { Authorization: `vapid t=${await jwt(env, u.origin)}, k=${pub}`, TTL: String(ttl), Urgency: 'high', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream' }, body, signal: AbortSignal.timeout(15000) });
  return r.status;
}
