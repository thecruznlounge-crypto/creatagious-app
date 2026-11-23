/* A small, forgiving HTML parser for reading business websites. Builds a simple tree; no scripts run. */
import { decodeEntities } from './net.js';
const VOID = new Set('area base br col embed hr img input keygen link meta param source track wbr'.split(' '));
const RAW = new Set(['script', 'style', 'textarea', 'title', 'noscript', 'xmp', 'iframe', 'noembed', 'noframes']);
const BLOCK = new Set('address article aside blockquote details dialog div dl fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr main menu nav ol p pre section table ul'.split(' '));
const AUTO = { li: new Set(['li']), dt: new Set(['dt', 'dd']), dd: new Set(['dt', 'dd']), option: new Set(['option']), tr: new Set(['tr', 'td', 'th']), td: new Set(['td', 'th']), th: new Set(['td', 'th']) };
const node = (tag, attrs, parent) => ({ tag, attrs, parent, kids: [] });

function parseAttrs(s) {
  const a = {}; const re = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g; let m;
  while ((m = re.exec(s))) { const k = m[1].toLowerCase(); if (!(k in a)) a[k] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? ''); } return a;
}
export function parseHTML(html) {
  const root = node('#root', {}, null); let cur = root, i = 0; const s = String(html), n = s.length;
  const open = (tag) => { for (let x = cur; x && x !== root; x = x.parent) if (x.tag === tag) return x; return null; };
  while (i < n) {
    const lt = s.indexOf('<', i); if (lt < 0) { cur.kids.push(s.slice(i)); break; } if (lt > i) cur.kids.push(s.slice(i, lt));
    if (s.startsWith('<!--', lt)) { const e = s.indexOf('-->', lt + 4); i = e < 0 ? n : e + 3; continue; }
    if (s[lt + 1] === '!' || s[lt + 1] === '?') { const e = s.indexOf('>', lt); i = e < 0 ? n : e + 1; continue; }
    const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/.exec(s.slice(lt, lt + 20000));
    if (!m) { cur.kids.push('<'); i = lt + 1; continue; }
    i = lt + m[0].length; const tag = m[2].toLowerCase();
    if (m[1]) { const o = open(tag); if (o) cur = o.parent || root; continue; }
    if (tag === 'p' || BLOCK.has(tag)) { const p = open('p'); if (p) { let x = cur; while (x !== p.parent) { if (['button', 'table', 'ul', 'ol', 'div', 'section'].includes(x.tag) && x !== p) break; x = x.parent; } if (x === p.parent) cur = p.parent; } }
    if (AUTO[tag] && AUTO[tag].has(cur.tag)) cur = cur.parent || root;
    const el = node(tag, parseAttrs(m[3]), cur); cur.kids.push(el);
    if (VOID.has(tag) || /\/\s*$/.test(m[3])) continue;
    if (RAW.has(tag)) { const re = new RegExp('</' + tag + '\\s*>', 'i'); re.lastIndex = 0; const rest = s.slice(i), e = rest.search(re); const raw = e < 0 ? rest : rest.slice(0, e); el.kids.push(tag === 'title' || tag === 'textarea' ? raw : { raw }); i = e < 0 ? n : i + e + (rest.slice(e).match(re)[0].length); continue; }
    cur = el;
  }
  return root;
}
/* Elements in document order that match a test. */
export function all(root, test) { const out = []; const walk = (x) => { for (const k of x.kids) if (typeof k === 'object' && k.tag) { if (test(k)) out.push(k); walk(k); } }; walk(root); return out; }
export const first = (root, test) => all(root, test)[0] || null;
/* Visible text of an element. */
export function text(x) { if (typeof x === 'string') return decodeEntities(x); if (!x || !x.kids) return ''; let t = ''; for (const k of x.kids) t += typeof k === 'string' ? decodeEntities(k) : k.raw != null ? '' : ' ' + text(k) + ' '; return t; }
/* Raw contents of script and style tags. */
export const raw = (x) => (x.kids.find((k) => k && k.raw != null) || { raw: x.kids.filter((k) => typeof k === 'string').join('') }).raw;
export const attr = (x, k) => (x.attrs[k] ?? '');
export const remove = (x) => { if (x.parent) x.parent.kids = x.parent.kids.filter((k) => k !== x); x.parent = null; };
export const elementKids = (x) => x.kids.filter((k) => typeof k === 'object' && k.tag);
export function nextSibling(x, tag) { if (!x.parent) return null; const k = elementKids(x.parent); const i = k.indexOf(x); return k.slice(i + 1).find((e) => e.tag === tag) || null; }
