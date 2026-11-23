/* Reads a business website into headlines, offers, products, buttons, photos and colors. Port of the PHP site_parse. */
import { parseHTML, all, first, text, raw, attr, remove, elementKids, nextSibling } from './html.js';
import { absUrl, decodeEntities } from './net.js';
export const clean = (s, n) => decodeEntities(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, n).trim();
export function hexColor(c) {
  c = String(c || '').trim().toLowerCase(); let m;
  if ((m = /^#([0-9a-f]{3})$/.exec(c))) c = '#' + m[1].split('').map((x) => x + x).join('');
  else if ((m = /^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(c))) c = '#' + [m[1], m[2], m[3]].map((v) => Math.min(255, +v).toString(16).padStart(2, '0')).join('');
  if (!/^#[0-9a-f]{6}$/.test(c)) return null; const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)), mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx - mn < 38 || mx < 45 || mn > 225) return null; return c.toUpperCase();
}
export const junk = (t) => /cookie|privacy|terms (of|and)|all rights reserved|©|copyright|skip to|sign in|log ?in\b|enable javascript|javascript is|newsletter|your cart|shopping cart|powered by|loading\.\.\.|404|page not found|just a moment|verify you are human|accept all/iu.test(t);
export const words = (t) => String(t).trim().split(/\s+/u).filter(Boolean).length;
export function generic(t) {
  t = String(t).trim(); if (/^(about|contact|welcome to)\b/iu.test(t) && words(t) <= 5) return true;
  return /^(home|menu|main menu|navigation|search|contact|contact us|get in touch|about|about us|services|our services|products|our products|faq|faqs|blog|news|latest news|testimonials|reviews|gallery|follow us|quick links|links|hours|location|locations|welcome|share|related posts?|categories)[.!:]?$/iu.test(t);
}
export const addTo = (list, t, max) => { if (t && list.length < max && !list.some((x) => x.toLowerCase() === t.toLowerCase())) list.push(t); };
export const empty = () => ({ title: '', description: '', site: '', headings: [], paragraphs: [], items: [], cta: [], offers: [], phone: '', logo: '', colors: [], images: [], links: [], words: 0 });
const cls = (x) => (attr(x, 'class') + ' ' + attr(x, 'id')).toLowerCase();

export function parseSite(html, base, css = []) {
  const doc = parseHTML(html), out = empty(), host = (() => { try { return new URL(base).hostname.toLowerCase(); } catch (e) { return ''; } })();
  const meta = (test) => { const n = first(doc, (x) => x.tag === 'meta' && test(x)); return n ? attr(n, 'content').trim() : ''; };
  const prop = (p) => (x) => attr(x, 'property').toLowerCase() === p, name = (p) => (x) => attr(x, 'name').toLowerCase() === p;
  const tn = first(doc, (x) => x.tag === 'title');
  out.title = clean(meta(prop('og:title')) || (tn ? text(tn) : ''), 120); out.description = clean(meta(prop('og:description')) || meta(name('description')), 300); out.site = clean(meta(prop('og:site_name')) || meta(name('application-name')), 40);
  const images = []; const add = (u) => { const a = absUrl(u, base); if (a && /^https?:\/\//i.test(a) && !/\.svg(\?|$)|sprite|pixel|spacer|blank\.|favicon|icon[-_.]|avatar|gravatar|logo|placeholder|1x1/i.test(a) && !images.includes(a) && images.length < 14) images.push(a); };
  for (const t of [prop('og:image'), prop('og:image:secure_url'), name('twitter:image')]) for (const n of all(doc, (x) => x.tag === 'meta' && t(x))) add(attr(n, 'content'));

  /* Structured data */
  let bizName = '', webName = '';
  const walk = (j) => {
    if (!j || typeof j !== 'object') return; let ty = j['@type'] || ''; ty = Array.isArray(ty) ? ty.filter((x) => typeof x === 'string').join(' ') : String(ty);
    const nm = typeof j.name === 'string' ? clean(j.name, 70) : '', tx = typeof j.description === 'string' ? clean(j.description, 220) : '';
    if (/Organization|Business|Restaurant|Store|Corporation|Brand|Hotel|Salon|Agency|Attorney|Dentist|Gym|Service$/i.test(ty) && !/^(Product|Offer)/i.test(ty)) { if (nm && !bizName && !/^Service$/i.test(ty)) bizName = nm; if (tx && !/^Service$/i.test(ty)) addTo(out.paragraphs, tx, 8); if (typeof j.telephone === 'string' && !out.phone) out.phone = clean(j.telephone, 24); }
    if (/WebSite/i.test(ty) && nm && !webName) webName = nm;
    if (/\b(Product|Service|MenuItem|Course|Event)\b/i.test(ty) && nm) { let o = j.offers || {}; if (Array.isArray(o)) o = o[0] || {}; const price = o && o.price != null && typeof o.price !== 'object' ? ((o.priceCurrency === 'USD' ? '$' : '') + o.price).trim() : ''; if (out.items.length < 12) out.items.push({ name: nm, text: tx, price: clean(price, 16) }); }
    for (const k of ['logo', 'image']) { let v = j[k]; if (Array.isArray(v)) v = v[0]; if (v && typeof v === 'object') v = v.url; if (typeof v === 'string' && /^(https?:|\/)/.test(v)) { if (k === 'logo') { if (!out.logo) out.logo = absUrl(v, base); } else add(v); } }
    for (const v of Object.values(j)) if (v && typeof v === 'object') walk(v);
  };
  for (const n of all(doc, (x) => x.tag === 'script' && attr(x, 'type').toLowerCase() === 'application/ld+json')) { try { walk(JSON.parse(raw(n).trim())); } catch (e) {} }

  /* App data embedded in pages built with JavaScript */
  const embedded = new Set();
  for (const n of all(doc, (x) => x.tag === 'script' && (['__NEXT_DATA__', '__NUXT_DATA__'].includes(attr(x, 'id')) || attr(x, 'type').toLowerCase() === 'application/json'))) {
    const r = raw(n); if (r.length > 700000) continue; let seen = 0, j; try { j = JSON.parse(r); } catch (e) { continue; }
    const grab = (v, k = '') => { if (seen++ > 5000) return; if (v && typeof v === 'object') { for (const [kk, vv] of Object.entries(v)) grab(vv, Array.isArray(v) ? k : kk); return; } if (typeof v === 'string' && /^(title|heading|headline|subtitle|subheading|tagline|description|summary|body|text|content|name)$/i.test(k) && !/https?:|[{}<>_]|^\//.test(v)) { const t = clean(v, 220); if (words(t) >= 3 && !junk(t)) embedded.add(t); } };
    grab(j);
  }

  /* Logo, colors and page links, read before page furniture is removed */
  for (const n of all(doc, (x) => x.tag === 'img')) { const sig = (cls(n) + ' ' + attr(n, 'alt') + ' ' + attr(n, 'src')).toLowerCase(), src = attr(n, 'src') || attr(n, 'data-src'); if (!out.logo && sig.includes('logo') && src && !/\.svg(\?|$)/i.test(src)) out.logo = absUrl(src, base); }
  if (!out.logo) for (const t of [(x) => x.tag === 'link' && attr(x, 'rel').toLowerCase().includes('apple-touch-icon'), (x) => x.tag === 'link' && attr(x, 'rel').toLowerCase() === 'icon' && attr(x, 'href').includes('.png')]) { const n = first(doc, t); if (n) { out.logo = absUrl(attr(n, 'href'), base); break; } }
  const count = new Map(), bump = (c, by) => { if (c) count.set(c, (count.get(c) || 0) + by); };
  bump(hexColor(meta(name('theme-color'))), 40); bump(hexColor(meta(name('msapplication-tilecolor'))), 25);
  let style = css.join('\n'); for (const n of all(doc, (x) => x.tag === 'style')) style += '\n' + raw(n);
  for (const n of all(doc, (x) => 'style' in x.attrs)) { const st = attr(n, 'style'); style += ';' + st; const m = /background(?:-image)?\s*:[^;]*url\(["']?([^"')]+)/i.exec(st); if (m) add(m[1]); }
  for (const m of style.matchAll(/--[\w-]*(?:primary|brand|accent|main)[\w-]*\s*:\s*(#[0-9a-f]{3,6}|rgba?\([^)]+\))/gi)) bump(hexColor(m[1]), 20);
  for (const m of style.slice(0, 600000).matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\(\s*\d+[ ,]+\d+[ ,]+\d+/gi)) bump(hexColor(m[0].startsWith('rgb') ? m[0] + ')' : m[0]), 1);
  out.colors = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map((x) => x[0]);
  const ORDER = 'about service product menu pricing prices rates shop collection offer special fleet work solution', links = new Map(), bare = (h) => h.replace(/^www\./, '');
  for (const n of all(doc, (x) => x.tag === 'a' && 'href' in x.attrs)) { let u = absUrl(attr(n, 'href'), base); if (!u) continue; let pu; try { pu = new URL(u); } catch (e) { continue; } if (bare(pu.hostname.toLowerCase()) !== bare(host)) continue; pu.hash = ''; u = pu.href; const path = pu.pathname.toLowerCase(); if (/\.(pdf|jpe?g|png|webp|zip)$/.test(path) || path.replace(/\//g, '') === '') continue; const m = /about|service|product|menu|pricing|prices|rates|shop|collection|offer|special|fleet|work|solution/.exec(path + ' ' + text(n).toLowerCase()); if (m) links.set(u, Math.min(links.get(u) ?? 99, ORDER.indexOf(m[0]))); }
  out.links = [...links.entries()].sort((a, b) => a[1] - b[1]).slice(0, 3).map((x) => x[0]);
  for (const n of all(doc, (x) => x.tag === 'a' && attr(x, 'href').startsWith('tel:'))) if (!out.phone) out.phone = clean(attr(n, 'href').slice(4), 24);

  /* Remove page furniture */
  for (const n of all(doc, (x) => ['script', 'style', 'template', 'svg', 'nav', 'footer', 'aside', 'noscript', 'iframe'].includes(x.tag) || (x.tag === 'form' && attr(x, 'role').includes('search')) || ['navigation', 'dialog'].includes(attr(x, 'role')) || attr(x, 'aria-hidden') === 'true' || /cookie/.test(cls(x)) || /consent|popup|modal/.test(attr(x, 'class')))) remove(n);
  for (const n of all(doc, (x) => x.tag === 'h1' || x.tag === 'h2')) { const t = clean(text(n), 90); if (t.length > 3 && !junk(t) && !generic(t)) addTo(out.headings, t, 10); }
  for (const n of all(doc, (x) => x.tag === 'h3' || x.tag === 'h4')) { const t = clean(text(n), 70); if (t.length < 3 || junk(t) || generic(t) || out.items.length >= 12 || out.items.some((i) => i.name.toLowerCase() === t.toLowerCase())) continue; const p = nextSibling(n, 'p'), sub = p ? clean(text(p), 200) : ''; out.items.push({ name: t, text: junk(sub) ? '' : sub, price: '' }); }
  const bodyEl = first(doc, (x) => x.tag === 'body') || doc, seenText = new Set();
  for (const n of all(bodyEl, (x) => ['p', 'li', 'h1', 'h2', 'h3', 'strong', 'b', 'span', 'a', 'button'].includes(x.tag) || (x.tag === 'div' && !elementKids(x).length))) { const t = clean(text(n), 240); if (t && !junk(t)) seenText.add(t); if (seenText.size > 600) break; }
  for (const n of all(doc, (x) => x.tag === 'p' || (x.tag === 'li' && text(x).replace(/\s+/g, ' ').trim().length > 60))) { const t = clean(text(n), 240); if (t.length >= 45 && words(t) >= 8 && !junk(t)) addTo(out.paragraphs, t, 10); }
  out.words = words([...seenText].join(' '));
  if (out.words < 60) for (const t of embedded) { if (words(t) >= 9) addTo(out.paragraphs, t, 10); else if (!generic(t)) addTo(out.headings, t, 10); out.words += words(t); }
  const OFFER = String.raw`\d{1,3}\s?% off|save \$?\d[\d,.]*|free shipping|free delivery|free trial|free consultation|free estimate|free quote|buy one get one|from \$\d[\d,.]*|\$\d[\d,.]*\s*(?:off|per|\/)`;
  for (const t of seenText) for (const line of t.split(/(?<=[.!?])\s+/u)) { if (!new RegExp(OFFER, 'iu').test(line)) continue; if (line.length <= 100) addTo(out.offers, clean(line.replace(/[.!]+$/, ''), 100), 5); else { const m = new RegExp(`[^,;:]{0,36}(?:${OFFER})[^,;:]{0,30}`, 'iu').exec(line); if (m) addTo(out.offers, clean(m[0].replace(/\s+\S*$/u, ''), 80), 5); } }
  const cta = new Map();
  for (const n of all(doc, (x) => x.tag === 'a' || x.tag === 'button' || (x.tag === 'input' && attr(x, 'type') === 'submit'))) { const t = clean(n.tag === 'input' ? attr(n, 'value') : text(n), 30); if (t.length < 3 || t.length > 24 || junk(t) || !/^(book|get|order|buy|shop|start|try|reserve|call|schedule|request|join|sign up|contact us|learn more|see|view|claim|download|subscribe|apply|rent|hire|visit|explore|discover|donate|find)\b/iu.test(t)) continue; const btn = /btn|button|cta/i.test(attr(n, 'class')) || n.tag !== 'a'; cta.set(t, Math.max(cta.get(t) || 0, btn ? 2 : 1)); }
  out.cta = [...cta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map((x) => x[0]);
  for (const n of all(doc, (x) => x.tag === 'img' || x.tag === 'source')) { const w = parseInt(attr(n, 'width')) || 0, h = parseInt(attr(n, 'height')) || 0; let src = attr(n, 'src') || attr(n, 'data-src') || attr(n, 'data-lazy-src') || attr(n, 'data-original'); const set = attr(n, 'srcset') || attr(n, 'data-srcset'); if (set) { let best = -1; for (const part of set.split(',')) { const bits = part.trim().split(/\s+/), bw = parseInt(bits[1]) || 0; if (bw >= best && bits[0]) { best = bw; src = bits[0]; } } } if ((w && w < 220) || (h && h < 160)) continue; if (src) add(src); }
  out.images = images;
  if (!out.site) out.site = bizName || webName;
  if (!out.site && out.title) { const bits = out.title.split(/\s[|–—:·-]\s/u).map((b) => b.trim()).filter((b) => b && !generic(b)), hostKey = bare(host).split('.')[0].replace(/[^a-z0-9]/g, ''); let pick = ''; for (const b of bits) { const k = b.toLowerCase().replace(/[^a-z0-9]/g, ''); if (k && (hostKey.includes(k) || k.includes(hostKey))) { pick = b; break; } } if (!pick && bits.length > 1) pick = bits[0]; out.site = clean(pick, 40); }
  return out;
}
export function mergeSite(a, b) {
  for (const [k, n] of [['headings', 12], ['paragraphs', 12], ['offers', 6], ['cta', 5]]) for (const t of b[k]) addTo(a[k], t, n);
  for (const i of b.items) { if (a.items.length >= 14) break; if (!a.items.some((e) => e.name.toLowerCase() === i.name.toLowerCase())) a.items.push(i); }
  for (const u of b.images) if (a.images.length < 18 && !a.images.includes(u)) a.images.push(u);
  for (const k of ['logo', 'phone', 'description', 'site']) if (!a[k]) a[k] = b[k]; if (!a.colors.length) a.colors = b.colors; a.words += b.words; return a;
}
