/* Fetches public http(s) pages and files only, re-checking every redirect. */
import { fail, localTest } from './core.js';
const PRIVATE4 = /^(0|10|127|169\.254|172\.(1[6-9]|2\d|3[01])|192\.168|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7]))\./;
export function safeTarget(env, url) {
  let u; try { u = new URL(url); } catch (e) { fail(400, 'Enter a full website address.', 'bad_url'); }
  const test = localTest(env), host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!/^https?:$/.test(u.protocol) || !host || u.username || u.password || (!test && u.port && !['80', '443'].includes(u.port))) fail(400, 'Enter a full website address.', 'bad_url');
  if (!test && (host === 'localhost' || /\.(local|internal|localhost)$/.test(host) || PRIVATE4.test(host + '.') || host.includes(':') || /^\d+$/.test(host))) fail(400, 'That address cannot be read.', 'bad_url');
  return u;
}
export function absUrl(u, base) {
  u = decodeEntities(String(u || '').trim()); if (!u || /^(data|javascript|mailto|tel):|^#/i.test(u)) return '';
  try { const r = new URL(u, base); return /^https?:$/.test(r.protocol) ? r.href : ''; } catch (e) { return ''; }
}
export function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => { if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(n); } catch (x) { return m; } } return ENT[e.toLowerCase()] ?? m; });
}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', copy: '©', reg: '®', trade: '™', middot: '·', bull: '•', eacute: 'é', egrave: 'è', aacute: 'á', ntilde: 'ñ', oacute: 'ó', iacute: 'í', uacute: 'ú', euro: '€', pound: '£', times: '×' };
/* Returns { code, body (Uint8Array), text(), type, url, error } and never throws for network problems. */
export async function tryFetch(env, url, max, timeoutMs) {
  for (let hop = 0; hop < 5; hop++) {
    let u; try { u = safeTarget(env, url); } catch (e) { return { code: 0, body: new Uint8Array(), type: '', url, error: 'bad', message: e.message }; }
    let r; try { r = await fetch(u.href, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CreatagiousBot/2.8; +https://creatagious.com)', Accept: 'text/html,application/xhtml+xml,image/*,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9' } }); }
    catch (e) { const t = e && (e.name === 'TimeoutError' || e.name === 'AbortError'); return { code: 0, body: new Uint8Array(), type: '', url: u.href, error: t ? 'timeout' : /certificate|ssl|tls/i.test(String(e && e.message)) ? 'security' : 'connect' }; }
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { const next = absUrl(r.headers.get('location'), u.href); if (!next) break; url = next; continue; }
    const chunks = []; let size = 0, cut = false;
    if (r.body) { const rd = r.body.getReader(); try { for (;;) { const { done, value } = await rd.read(); if (done) break; size += value.length; if (size > max) { cut = true; chunks.push(value.slice(0, value.length - (size - max))); rd.cancel().catch(() => {}); break; } chunks.push(value); } } catch (e) { if (!chunks.length) return { code: 0, body: new Uint8Array(), type: '', url: u.href, error: 'timeout' }; } }
    const body = new Uint8Array(Math.min(size, max)); let o = 0; for (const c of chunks) { body.set(c, o); o += c.length; }
    return { code: r.status, body, type: r.headers.get('content-type') || '', url: u.href, cut, text: () => new TextDecoder().decode(body) };
  }
  return { code: 0, body: new Uint8Array(), type: '', url, error: 'redirects', message: 'That website redirects too many times.' };
}
/* Image type from its first bytes. */
export function imageType(b) {
  if (b.length < 12) return ''; if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg'; if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif'; if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'; return '';
}
