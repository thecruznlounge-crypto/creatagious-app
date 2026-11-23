/* Theme, plan, ads and the local media library. */
(function () {
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const dark = matchMedia('(prefers-color-scheme: dark)');
  A.theme = {
    get: () => ls.get('theme') || 'system',
    apply() { const t = A.theme.get(), on = t === 'dark' || (t === 'system' && dark.matches); if (on) document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme; const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = on ? '#0B1015' : '#ffffff'; return on; },
    set(t) { ls.set('theme', t); A.theme.apply(); }, isDark: () => document.documentElement.dataset.theme === 'dark'
  };
  dark.addEventListener('change', () => A.theme.apply());

  const twa = () => document.referrer.startsWith('android-app://') || ls.get('twa') === '1';
  if (document.referrer.startsWith('android-app://')) ls.set('twa', '1');
  A.plan = {
    premium: () => ls.get('plan') === 'premium', source: () => ls.get('plan-source') || '',
    set(on, src) { ls.set('plan', on ? 'premium' : 'free'); ls.set('plan-source', src || ''); A.plan.mark(); },
    isTWA: twa,
    /* The signed token is what unlocks paid AI on the server. */
    savedToken() { const e = +ls.get('plan-exp') || 0; return e * 1000 > Date.now() ? ls.get('plan-token') || '' : ''; },
    token: () => A.plan.premium() ? A.plan.savedToken() : '',
    keep(t, e) { ls.set('plan-token', t || ''); ls.set('plan-exp', String(e || 0)); },
    test(on) { A.plan.set(on, on ? (A.plan.savedToken() ? 'license' : 'preview') : ''); },
    async refresh() {
      const t = A.plan.savedToken(), e = +ls.get('plan-exp') || 0; if (!t || !navigator.onLine || e * 1000 - Date.now() > 7 * 864e5) return;
      try { const r = await fetch(A.CONFIG.LICENSE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }) }), d = await r.json(); if (r.ok && d.token) A.plan.keep(d.token, d.exp); else if (r.status === 403) { A.plan.keep('', 0); if (A.plan.source() === 'license') A.plan.set(false); } } catch (x) {}
    },
    mark() {
      const on = A.plan.premium(), tag = document.querySelector('.top .brand-tag'), av = document.getElementById('plan-av'); document.documentElement.dataset.plan = on ? 'premium' : 'free';
      if (tag) { tag.className = 'brand-tag ' + (on ? 'prem' : 'free'); tag.innerHTML = on ? '<svg aria-hidden="true"><use href="#i-crown"/></svg>Premium' : 'Free plan'; } if (av) av.hidden = !on;
    },
    async play() { if (!('getDigitalGoodsService' in window) || !A.CONFIG.PLAY_SKU) return null; try { return await getDigitalGoodsService('https://play.google.com/billing'); } catch (e) { return null; } },
    async restorePlay() { const s = await A.plan.play(); if (!s) return false; try { const p = await s.listPurchases(); const has = p.some((x) => x.itemId === A.CONFIG.PLAY_SKU); if (has) A.plan.set(true, 'play'); else if (A.plan.source() === 'play') A.plan.set(false); return has; } catch (e) { return false; } },
    async buyPlay() { const sku = A.CONFIG.PLAY_SKU, r = new PaymentRequest([{ supportedMethods: 'https://play.google.com/billing', data: { sku } }], { total: { label: 'Creatagious Premium', amount: { currency: 'USD', value: '0' } } }), res = await r.show(); await res.complete('success'); return A.plan.restorePlay(); },
    async redeem(code) { const r = await fetch(A.CONFIG.LICENSE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) }); const d = await r.json().catch(() => ({})); if (!r.ok || !d.ok) throw new Error(d.error || 'That code was not accepted.'); A.plan.keep(d.token, d.exp); A.plan.set(true, 'license'); }
  };

  if (A.plan.source() === 'preview' && !A.CONFIG.PREMIUM_PREVIEW) A.plan.set(false);
  A.plan.mark();

  let adLoaded = false;
  A.adSlot = (place) => {
    if (A.plan.premium()) return '';
    const C = A.CONFIG;
    if (C.ADSENSE_CLIENT && C.ADSENSE_SLOT && navigator.onLine && !twa()) return `<aside class="adslot real" aria-label="Advertisement"><i>Ad</i><ins class="adsbygoogle" style="display:block" data-ad-client="${A.esc(C.ADSENSE_CLIENT)}" data-ad-slot="${A.esc(C.ADSENSE_SLOT)}" data-ad-format="auto" data-full-width-responsive="true"></ins></aside>`;
    return `<button class="adslot" data-act="paywall" data-place="${place}">${A.ic('crown')}<span><b>Go Premium</b>Content-style videos, no ads, no watermark</span></button>`;
  };
  A.fillAds = () => {
    const slots = [...document.querySelectorAll('ins.adsbygoogle:not([data-adsbygoogle-status])')]; if (!slots.length) return;
    if (!adLoaded) { adLoaded = true; const s = document.createElement('script'); s.async = true; s.crossOrigin = 'anonymous'; s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(A.CONFIG.ADSENSE_CLIENT); document.head.append(s); }
    slots.forEach(() => { try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {} });
  };

  /* Photos, clips, logos and voiceovers stored as blobs. */
  const els = new Map(), urls = new Map();
  A.media = {
    els,
    async put(blob) { const id = 'm' + A.store.uid(); await A.store.put('m:' + id, { blob, type: blob.type }); return id; },
    async url(id) { if (urls.has(id)) return urls.get(id); const r = await A.store.read('m:' + id); if (!r) return null; const u = URL.createObjectURL(r.blob); urls.set(id, u); return u; },
    async blob(id) { const r = await A.store.read('m:' + id); return r && r.blob; },
    async load(id) {
      if (!id) return null; if (els.has(id)) return els.get(id);
      const r = await A.store.read('m:' + id); if (!r) return null; const u = await A.media.url(id), video = r.type.startsWith('video/');
      const el = await new Promise((res) => {
        if (video) { const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.onloadeddata = () => res(v); v.onerror = () => res(null); v.src = u; v.load(); }
        else { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = u; }
      });
      if (el) els.set(id, el); return el;
    },
    async drop(id) { await A.store.del('m:' + id); els.delete(id); if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); } }
  };
})();
