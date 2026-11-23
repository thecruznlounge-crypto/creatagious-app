/* Router, actions, install flow and service worker registration. */
(function () {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const view = $('#view'), layer = $('#layer'), S = A.store, { esc, ic } = A;
  A.draft = { type: 'image', brief: '', format: 'square', template: 'auto', photo: null, promoKind: 'offer', detail: '', duration: 15, style: 'classic', site: null, goal: 'sales', slides: 5, carFormat: 'feed', platforms: ['short', 'carousel', 'story', 'facebook', 'linkedin', 'pinterest'] };
  A.proxyUrl = (u) => A.CONFIG.IMAGE_PROXY + '?url=' + encodeURIComponent(u);
  let previewVoice = null, fileRaw = false, voiceRec = null, route = 'home', E = null, fileCb = null, installEvt = window.__bip || null, installed = false, installWait = null, toastT;

  A.toast = (msg, action, fn) => { const t = $('#toast'); t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action)}</button>` : ''}`; t.hidden = false; if (action) t.lastChild.onclick = () => { t.hidden = true; fn(); }; clearTimeout(toastT); if (!action) toastT = setTimeout(() => (t.hidden = true), 3200); };
  A.refreshDot = () => { $('#dot').hidden = !S.notes.some((n) => !n.read); };
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true || document.referrer.startsWith('android-app://');
  A.canInstall = () => !standalone() && !installed;
  const refreshInstall = () => { $('#inst').hidden = !A.canInstall(); };

  /* Sheets */
  const closeSheet = () => { layer.innerHTML = ''; };
  const sheet = (title, body) => { layer.innerHTML = `<div class="scrim" data-act="scrim"><section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="row sb"><h2>${esc(title)}</h2><button class="ib" data-act="close" aria-label="Close">${ic('x', 'ic20')}</button></div>${body}</section></div>`; const f = $('input,textarea', layer); f ? f.focus() : $('[data-act=close]', layer).focus(); };

  /* Painting */
  async function hydrate() {
    await A.fontsReady();
    for (const im of $$('img[data-m]', view)) { const u = await A.media.url(im.dataset.m), b = await A.media.blob(im.dataset.m); if (u && b && b.type.startsWith('image/')) im.src = u; else if (u && b && b.type.startsWith('video/')) { const v = document.createElement('video'); v.className = im.className; v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.src = u + '#t=0.1'; v.setAttribute('aria-hidden', 'true'); im.replaceWith(v); } }
    $$('canvas[data-tpl]', view).forEach((c) => { const t = A.tpl(c.dataset.tpl), x = c.getContext('2d'), W = c.width, H = c.height; A.art(t.id, x, W, H, .1); const g = x.createLinearGradient(0, H * .45, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.82)'); x.fillStyle = g; x.fillRect(0, 0, W, H); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; let s = 38; do { x.font = `400 ${s}px Anton, Impact`; s -= 2; } while (x.measureText(t.name.toUpperCase()).width > W - 22); x.fillText(t.name.toUpperCase(), W / 2, H - 18); });
    for (const im of $$('img[data-thumb]', view)) { const p = S.get(im.dataset.thumb); if (p) { p.thumb = await A.renderThumb(p); im.src = p.thumb; S.saveProjects(); } }
  }
  async function paint() {
    if (!E) return; const c = $('#cv'); if (!c) return; const p = E.p, f = A.fmt(p.format), video = A.isVideo(p), k = 900 / Math.max(f.w, f.h);
    const W = Math.round(f.w * k), H = Math.round(f.h * k); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const im = await A.loadImage(p.photo); await A.fontsReady(); await A.content.prepare(p); if (!E || E.p !== p) return; const x = c.getContext('2d');
    if (p.type === 'carousel') { E.slide = Math.min(E.slide || 0, p.slides.length - 1); A.drawSlide(x, W, H, p, im, E.slide); }
    else if (video) { const at = E.sec || Math.min(1.2, p.duration / p.scenes.length * .55); A.content.sync(p, at, false); await new Promise((r) => setTimeout(r, p.scenes.some((s) => s.media) ? 140 : 10)); if (!E || E.p !== p) return; A.drawFrame(x, W, H, p, im, at); } else A.drawAd(x, W, H, p, im);
    $$('canvas[data-mini]', view).forEach((m) => { const g = A.fmt(m.dataset.mini), q = 300 / Math.max(g.w, g.h); m.width = Math.round(g.w * q); m.height = Math.round(g.h * q); A.drawAd(m.getContext('2d'), m.width, m.height, p, im); });
  }
  let pt; const later = () => { clearTimeout(pt); pt = setTimeout(paint, 60); };
  const touch = () => { if (!E) return; E.p.dirty = true; S.upsert(E.p); later(); };
  function stopPlay() { if (!E || !E.playing) return; E.playing = false; cancelAnimationFrame(E.raf); A.content.stop(E.p); if (previewVoice) { previewVoice.pause(); previewVoice = null; } const b = $('[data-act=play]'); if (b) { b.innerHTML = ic('play'); b.setAttribute('aria-label', 'Play preview'); } }
  async function togglePlay(b) {
    if (E.playing) return stopPlay(); E.playing = true; b.innerHTML = ic('pause'); b.setAttribute('aria-label', 'Pause preview');
    const p = E.p, c = $('#cv'), x = c.getContext('2d'), im = await A.loadImage(p.photo); await A.content.prepare(p); A.content._s = -1; if (p.voice) { const u = await A.media.url(p.voice); if (u) { previewVoice = new Audio(u); previewVoice.play().catch(() => {}); } } const t0 = performance.now();
    const step = (now) => { if (!E || !E.playing) return; const s = (now - t0) / 1000; if (s >= p.duration) { E.sec = 0; stopPlay(); return paint(); } E.sec = s; A.content.sync(p, s, true); A.drawFrame(x, c.width, c.height, p, im, s); E.raf = requestAnimationFrame(step); }; E.raf = requestAnimationFrame(step);
  }
  async function leaveEditor() { if (!E) return; stopPlay(); const p = E.p; E = null; if (p.dirty) { p.dirty = false; p.thumbBaked = false; p.thumb = await A.renderThumb(p); S.upsert(p); if (route === 'home' || route === 'projects') render(); } }

  /* Router */
  async function render() {
    A.plan.mark(); const [r, id] = (location.hash.slice(1) || 'home').split('/');
    if (E && !(r === 'edit' && id === E.p.id)) await leaveEditor();
    route = r; let html;
    if (r === 'edit') { const p = S.get(id); if (!p) { location.hash = '#projects'; return; } if (p.type === 'pack') html = A.views.pack(p); else { E = E && E.p.id === id ? E : { p, tab: p.type === 'carousel' ? 'slides' : 'copy', sec: 0, slide: 0 }; html = A.views.edit(p, E.tab, E.slide); } }
    else html = (A.views[r] || A.views.home)();
    view.innerHTML = html;
    const nav = r === 'edit' && S.get(id) && S.get(id).type === 'pack' ? 'projects' : r === 'edit' || r === 'site' ? 'create' : A.views[r] ? r : 'home'; $$('[data-nav]').forEach((a) => { const on = a.dataset.nav === nav; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
    if (r === 'notifications') { let c = false; S.notes.forEach((n) => { if (!n.read) { n.read = true; c = true; } }); if (c) { S.put('notes', S.notes); A.refreshDot(); } }
    hydrate(); if (r === 'edit' && E) paint(); A.fillAds();
  }
  const go = (h) => { if (location.hash === h) render(); else location.hash = h; scrollTo(0, 0); };
  addEventListener('hashchange', () => { closeSheet(); render(); scrollTo(0, 0); view.focus({ preventScroll: true }); });

  function pickImage(cb) { fileCb = cb; fileRaw = false; const f = $('#file'); f.accept = 'image/*'; f.value = ''; f.click(); }
  function pickMedia(cb) { fileCb = cb; fileRaw = true; const f = $('#file'); f.accept = 'image/*,video/mp4,video/webm,video/quicktime'; f.value = ''; f.click(); }
  $('#file').addEventListener('change', async (e) => { const file = e.target.files[0]; if (!file || !fileCb) return; try { if (fileRaw) { if (file.size > 250e6) throw new Error('Choose a file under 250 MB.'); await fileCb(file); } else fileCb(await A.imageToData(file)); } catch (x) { A.toast(x.message || 'That file could not be added.'); } });

  async function loadKit(k) {
    if (!k) return null; const P = A.plan.premium(), get = async (u) => { try { const r = await fetch(A.proxyUrl(u)); if (!r.ok) return null; const b = await r.blob(); return b.type.startsWith('image/') ? b : null; } catch (e) { return null; } };
    const out = { logo: null, ids: [] }, max = P ? 8 : 1; for (const id of k.own || []) { if (out.ids.length >= max) break; const b = await A.media.blob(id); if (b) out.ids.push({ id, b }); }
    if (!k.rights) return out; if (P && k.logo) { const b = await get(k.logo); if (b) out.logo = await A.media.put(b); } for (const i of k.sel) { if (out.ids.length >= max) break; const b = await get(k.images[i]); if (b) out.ids.push({ id: await A.media.put(b), b }); } return out;
  }
  async function applyKit(p, kit, res) {
    p.accent = kit.color || ''; p.kitColors = kit.colors; if (!res) return; if (res.logo) p.logo = res.logo; p.kitMedia = [...res.ids.map((x) => x.id), ...(res.logo ? [res.logo] : [])]; if (!res.ids.length) return;
    if (!A.plan.premium()) { p.photo = await A.imageToData(res.ids[0].b); return; }
    if (A.isVideo(p)) p.scenes.forEach((s, i) => { s.media = res.ids[i % res.ids.length].id; }); else if (p.type === 'carousel') p.slides.forEach((s, i) => { s.media = res.ids[i % res.ids.length].id; }); else p.photo = await A.imageToData(res.ids[0].b);
  }
  async function generate(kit) {
    const d = A.draft, siteData = kit ? A.siteData(kit) : null, hasSite = A.siteHasFacts(siteData), typed = (kit ? kit.brief : d.brief).trim(), brief = typed || (hasSite ? [siteData.description, ...siteData.headings.slice(0, 2), ...siteData.offers.slice(0, 1)].filter(Boolean).map((t) => t.replace(/[.\s]+$/, '')).join('. ').slice(0, 900) || siteData.name : ''); if (brief.length < 3) { A.toast(kit ? 'Select something from the website or describe the business.' : 'Describe your ad first.'); const f = $('#brief') || $('#quick') || $('#kh'); f && f.focus(); return; }
    if (d.type === 'pack' && !A.plan.premium()) return paywall(); if (d.type === 'pack' && !d.platforms.length) return A.toast('Choose at least one platform.');
    view.innerHTML = `<div class="busy" role="status"><span class="spin"></span>${d.type === 'pack' ? 'Building your pack' : kit ? 'Building from the website' : 'Creating your ad'}</div>`; scrollTo(0, 0);
    const P = A.plan.premium(), goal = d.goal, type = d.type, brand = kit ? kit.name : S.profile.brand, secs = P ? d.duration : Math.min(d.duration, 15), slideCount = P ? d.slides : Math.min(d.slides, 5), vidType = type === 'video' || type === 'promo', style = vidType && P ? d.style : type === 'pack' ? A.goalStyle(goal) : 'classic';
    const g = await A.copy.generate(kit && hasSite ? typed : brief, type, { site: hasSite ? siteData : null, style, brand, goal, slides: type === 'carousel' || type === 'pack' ? slideCount : 0, platforms: type === 'pack' ? d.platforms : [] }); A.planner.applyGoal(g, goal, brand, brief); const res = kit ? await loadKit(kit) : null, tmpl = d.template === 'auto' ? g.template : d.template;
    const make = async (t, format, extra = {}) => {
      const st = t === 'video' || t === 'promo' ? (extra.style || style) : 'classic', p = A.newProject(t, g, { brief, goal, photo: d.photo, template: tmpl, promoKind: d.promoKind, detail: t === 'promo' ? d.detail : '', brand: brand || '', style: st, format, ...extra });
      if (A.isVideo(p)) { p.duration = secs; p.scenes = A.content.script(st, g, secs, brand, g.script); if (P) { p.res = '1080'; if (st !== 'classic') { p.trans = 'whip'; p.look = 'cinema'; } } } if (t === 'carousel') p.slides = A.planner.slides(goal, g, slideCount, brand, brief);
      if (kit) await applyKit(p, kit, res); p.thumb = await A.renderThumb(p); return p;
    };
    let p;
    if (type === 'pack') {
      const items = [], packId = S.uid();
      for (const pl of A.PLATFORMS.filter((x) => d.platforms.includes(x.id))) { const i = items.length % g.variants.length, v = g.variants[i], c = await make(pl.type, pl.format, { name: `${g.name} ${pl.name}`, packId, headline: v.headline, sub: v.sub, cta: v.cta, variant: i, caption: A.planner.caption(pl.cap, g, brand, brief, goal) }); S.upsert(c); items.push({ platform: pl.id, name: pl.name, project: c.id }); }
      p = A.newProject('pack', g, { id: packId, name: kit ? kit.name : g.name, brief, goal, items, thumb: S.get(items[0].project).thumb, thumbBaked: true });
    } else { const f = type === 'carousel' ? d.carFormat : type === 'campaign' ? 'square' : vidType && ['pin', 'square'].includes(d.format) && route !== 'create' ? 'story' : vidType && d.format === 'pin' ? 'story' : d.format; p = await make(type, f, kit ? { name: kit.name || g.name } : {}); }
    S.upsert(p); S.log('create', { type: p.type, style, goal }); S.notify('Your ad is ready', `${p.name} is saved in Projects.`, '#edit/' + p.id); Object.assign(A.draft, { brief: '', photo: null, detail: '', template: 'auto', site: null }); go('#edit/' + p.id); if (A.copy.notice) A.toast(A.copy.notice);
  }
  function paywall() {
    const C = A.CONFIG, P = A.plan.premium(), no = `<span class="no" aria-label="Not included">–</span>`, yes = `<span class="yes" aria-label="Included">${ic('check')}</span>`;
    const rows = [['Image ads and basic videos', yes, yes], ['Video length', '15 sec', '60 sec'], ['Video quality', '720p', '1080p'], ['Content video styles', '1', '9'], ['Captions, fonts, looks, transitions', 'Basic', 'All'], ['Carousel slides', '5', '20'], ['Platform Pack', no, yes], ['From a website', 'Text, colors, 1 photo', 'Logo and all photos'], ['Your photos and clips in scenes', no, yes], ['Scheduling and post reminders', no, yes], ['Button styles and whole-video button', 'Basic', 'All'], ['AI-written copy', C.FREE_AI_COPY_LABEL, C.PREMIUM_AI_COPY_LABEL], ['AI images', no, C.PREMIUM_AI_IMAGE_LABEL], ['AI video clips', no, C.PREMIUM_AI_VIDEO_LABEL], ['Voiceover and AI voices', no, yes], ['Ads and watermark', 'Yes', 'None']];
    const web = !P && C.CHECKOUT_URL && !A.plan.isTWA() ? `<a class="btn full" href="${esc(C.CHECKOUT_URL)}" rel="noopener">Get Premium</a>` : '', play = !P && C.PLAY_SKU && 'getDigitalGoodsService' in window ? `<button class="btn full" data-act="buyplay">Subscribe</button>` : '', test = !C.PREMIUM_PREVIEW ? '' : P ? `<button class="btn ghost full" data-act="endpreview">Switch to Free</button>` : `<button class="btn full" data-act="preview">Preview Premium</button>`;
    sheet('Free and Premium', `${C.PREMIUM_PRICE_LABEL ? `<p><strong>${esc(C.PREMIUM_PRICE_LABEL)}</strong></p>` : ''}<p class="note" style="margin:0 0 8px">You are on <strong>${P ? 'Premium' : 'Free'}</strong>.</p><table class="cmp"><thead><tr><th scope="col">Feature</th><th scope="col" class="${P ? '' : 'cur'}">Free</th><th scope="col" class="${P ? 'cur' : ''}">${ic('crown')}Premium</th></tr></thead><tbody>${rows.map(([f, a, b]) => `<tr><th scope="row">${f}</th><td class="${P ? '' : 'cur'}">${a}</td><td class="${P ? 'cur' : ''}">${b}</td></tr>`).join('')}</tbody></table><div class="stack">${play}${web}${test}${A.plan.isTWA() || A.plan.savedToken() ? '' : `<form data-form="license" class="row"><label class="lbl" for="lc" style="position:absolute;left:-999px">Premium code</label><input class="field grow" id="lc" placeholder="Premium code" autocomplete="off"><button class="btn ghost">Redeem</button></form>`}</div>`);
    const f = $('input', layer); if (f) f.blur(); const h = $('.sheet', layer); if (h) h.scrollTop = 0;
  }
  /* Website reading */
  function factsOf(d) {
    const F = [], add = (kind, text, sub, extra) => { if (text) F.push({ id: F.length, kind, text, sub: sub || '', on: true, ...extra }); };
    (d.headings || []).slice(0, 5).forEach((t) => add('head', t)); (d.offers || []).slice(0, 3).forEach((t) => add('offer', t)); (d.items || []).slice(0, 6).forEach((i) => add('item', i.name, i.text, { price: i.price || '' })); (d.paragraphs || []).slice(0, 3).forEach((t) => add('para', t)); (d.cta || []).slice(0, 3).forEach((t) => add('cta', t)); return F;
  }
  async function readSite(url) {
    let u; try { u = new URL(/^https?:/i.test(url.trim()) ? url.trim() : 'https://' + url.trim()); if (!u.hostname.includes('.') && u.hostname !== 'localhost') throw 0; } catch (x) { A.toast('Enter a website address, like yourbusiness.com.'); return; }
    const host = u.hostname.replace(/^www\./, ''); let d = null, why = '';
    if (!navigator.onLine) why = 'You are offline. Connect to the internet to read a website.'; else {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), A.CONFIG.SCRAPE_TIMEOUT_MS);
      try { const r = await fetch(A.CONFIG.SCRAPE_ENDPOINT + '?url=' + encodeURIComponent(u.href), { signal: ctl.signal, headers: { 'X-Plan-Token': A.plan.token() } }), json = (r.headers.get('content-type') || '').includes('json'), b = json ? await r.json() : null; if (b && r.ok) d = b; else why = (b && b.error) || 'The website reader is not running on your server yet. Open Profile, then Check setup.'; } catch (x) { why = x.name === 'AbortError' ? 'Reading the website took too long.' : 'The website reader could not be reached.'; } finally { clearTimeout(t); }
    }
    const imgs = (d && d.images) || [], status = d ? d.status || 'ok' : 'failed', P = A.plan.premium(), name = (d && d.site) || host.split('.')[0].replace(/^./, (c) => c.toUpperCase());
    A.draft.site = { url: u.href, host, name: name.slice(0, 32), brief: '', description: (d && d.description) || '', logo: (d && d.logo) || '', colors: (d && d.colors) || [], color: ((d && d.colors) || [])[0] || '', images: imgs, sel: imgs.slice(0, P ? 5 : 1).map((_, i) => i), rights: false, facts: d ? factsOf(d) : [], own: [], status, message: (d && d.message) || why, pages: (d && d.pages) || 0, via: (d && d.via) || '', sources: (d && d.sources) || [] };
    S.profile.website = u.href; S.put('profile', S.profile); closeSheet(); go('#site');
  }
  /* Paid AI: the server checks the Premium code before anything is spent. */
  function aiReady(what) {
    if (!A.plan.premium()) { paywall(); return false; } if (!navigator.onLine) { A.toast('Connect to the internet to use AI.'); return false; }
    if (!A.plan.token()) { sheet('Premium code needed', `<p>${what} run on your server&#39;s AI account, so they need a Premium code. Preview mode alone can&#39;t spend your credit.</p><form data-form="license" class="row"><label class="lbl" for="lc" style="position:absolute;left:-999px">Premium code</label><input class="field grow" id="lc" placeholder="Premium code" autocomplete="off"><button class="btn ghost">Redeem</button></form>`); return false; } return true;
  }
  const aiPrompt = (p, text) => [p.brand || p.name, String(p.brief || '').slice(0, 220), text].map((t) => String(t || '').replace(/[.\s]+$/, '')).filter(Boolean).join('. ').slice(0, 900);
  async function aiFetch(prompt, format) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), A.CONFIG.IMAGE_TIMEOUT_MS);
    try { const r = await fetch(A.CONFIG.IMAGE_ENDPOINT, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: A.plan.token(), prompt, format }) }); if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'The image could not be created.'); } const b = await r.blob(); if (!b.type.startsWith('image/')) throw new Error('The image service is not running on your server yet.'); return b; }
    catch (x) { throw x.name === 'AbortError' ? new Error('The image took too long. Please try again.') : x; } finally { clearTimeout(t); }
  }
  async function aiPlace(p, target, blob) {
    if (target === 'ad') { p.photo = await A.imageToData(blob); return; } const [k, n] = target.split(':'), i = +n, id = await A.media.put(blob); await A.media.load(id);
    if (k === 's') { p.scenes[i].media = id; E.sec = A.content.timeline(p)[i].start + .4; } else { p.slides[i].media = id; E.slide = i; }
  }
  async function clipImage(id) {
    const b = id && await A.media.blob(id); if (!b || !b.type.startsWith('image/')) return ''; const im = await A.media.load(id), k = Math.min(1, 1024 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .85);
  }
  async function aiClip(p, i, prompt) {
    const C = A.CONFIG, pause = (ms) => new Promise((r) => setTimeout(r, ms)), bad = async (r) => { const d = await r.json().catch(() => ({})); return new Error(d.error || 'The clip could not be created.'); }, hdr = { 'X-Plan-Token': A.plan.token() };
    const r = await fetch(C.VIDEO_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: A.plan.token(), prompt, format: p.format, image: await clipImage(p.scenes[i].media) }) }); if (!r.ok) throw await bad(r); const { id } = await r.json(), q = `${C.VIDEO_ENDPOINT}?id=${encodeURIComponent(id)}`;
    for (let n = 0, miss = 0; n < 72; n++) { await pause(C.VIDEO_POLL_MS || 5000); let d; try { const x = await fetch(q, { headers: hdr }); if (!x.ok) throw await bad(x); d = await x.json(); miss = 0; } catch (e) { if (++miss > 4) throw e; continue; } if (d.status === 'failed') throw new Error(d.error); const b = $('#vp'); if (b && d.progress) b.style.width = Math.max(8, d.progress * 100) + '%'; if (d.status === 'done') { const f = await fetch(q + '&file=1', { headers: hdr }); if (!f.ok) throw await bad(f); const blob = new Blob([await f.arrayBuffer()], { type: 'video/mp4' }), m = await A.media.put(blob); await A.media.load(m); p.scenes[i].media = m; E.sec = A.content.timeline(p)[i].start + .4; return; } }
    throw new Error('The clip took too long. Your allowance was used, so please check again later.');
  }
  const aiText = (p, t) => { if (t === 'ad') return p.headline; const [k, n] = t.split(':'), s = (k === 's' ? p.scenes : p.slides)[+n]; return `${s.title}: ${s.text || ''}`; };
  const audioSecs = async (blob) => { const C = window.AudioContext || window.webkitAudioContext, ac = new C(); try { return (await ac.decodeAudioData(await blob.arrayBuffer())).duration; } catch (e) { throw new Error('That audio file could not be read. Try MP3, M4A or WAV.'); } finally { ac.close(); } };
  async function setVoice(p, blob, ai) {
    const secs = await audioSecs(blob), old = p.voice; p.voice = await A.media.put(blob); p.voiceAI = !!ai; if (old) A.media.drop(old); p.music = p.music !== false; closeSheet(); if (E && E.p === p) { touch(); render(); }
    A.toast(secs > p.duration + .25 ? `Voiceover added. It runs ${Math.ceil(secs)} sec, so the ${p.duration}-sec video will cut it off.` : 'Voiceover added.');
  }
  async function voicePanel() {
    const p = E.p, text = p.scenes.map((s) => s.text).join('. ').replace(/\.\.+/g, '.');
    sheet('Voiceover', `${p.voice ? `<audio id="va" controls style="width:100%;margin-bottom:10px"></audio><button class="linkbtn" data-act="novoice">Remove voiceover</button>` : `<p>Add a voice to this ${p.duration}-second video. It plays over the music, and the music lowers automatically.</p>`}<div class="stack"><button class="btn full" data-act="voice">${ic('mic')}Record your voice</button><button class="btn ghost full" data-act="uploadvoice">${ic('upload')}Upload audio file</button><div><span class="lbl">AI voice</span><div id="aiv" class="note">Loading voices</div></div></div>`);
    if (p.voice) { const u = await A.media.url(p.voice), au = $('#va'); if (au && u) au.src = u; }
    const box = $('#aiv'), off = (t) => { if (box && box.isConnected) box.textContent = t; }; if (!navigator.onLine) return off('Connect to the internet to use AI voices.');
    try { const r = await fetch(A.CONFIG.VOICE_ENDPOINT), d = r.ok ? await r.json() : null; if (!d || !d.voices || !d.voices.length) return off('AI voices will appear here once the voice service is connected.'); if (box && box.isConnected) { box.className = ''; box.innerHTML = A.chips('aivoice', d.voices.map((v) => [v.id, esc(v.name)]), '') + `<p class="note" style="margin:6px 0 0">Reads your ${text.length}-character script. This is an AI-generated voice, not a real person, and the video will show an &quot;AI-generated voice&quot; label.</p>`; } } catch (e) { off('AI voices are unavailable right now.'); }
  }
  async function aiVoice(el) {
    const p = E.p; if (A.content.needsQuote(p)) { closeSheet(); E.tab = 'scenes'; render(); return A.toast('Paste a real customer quote first.'); } if (!aiReady('AI voices')) return; const text = p.scenes.map((s) => s.text).join('. ').replace(/\.\.+/g, '.').slice(0, 900); el.disabled = true; el.textContent = 'Creating voice';
    try { const r = await fetch(A.CONFIG.VOICE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: A.plan.token(), text, voice: el.dataset.v }) }); if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'The AI voice could not be created.'); } await setVoice(p, await r.blob(), true); S.log('voice', { source: 'ai' }); } catch (e) { el.disabled = false; A.toast(e.message || 'The AI voice could not be created.'); }
  }
  async function recordVoice() {
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (x) { return A.toast('Allow microphone access to record.'); }
    const chunks = [], r = new MediaRecorder(stream), t0 = Date.now(), p = E.p; voiceRec = r; r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = async () => { stream.getTracks().forEach((t) => t.stop()); clearInterval(iv); voiceRec = null; if (r.cancelled) return closeSheet(); try { await setVoice(p, new Blob(chunks, { type: r.mimeType })); } catch (e) { closeSheet(); A.toast(e.message); } };
    r.start(); sheet('Recording voiceover', `<div class="row" style="margin-bottom:10px"><span class="rec"></span><strong id="vt">0:00</strong><span class="note">of 0:${String(p.duration).padStart(2, '0')}</span></div><p>${esc(p.scenes.map((s) => s.text).join(' '))}</p><button class="btn full" data-act="stopvoice">Stop and save</button>`); $('[data-act=close]', layer).onclick = () => { r.cancelled = true; if (r.state === 'recording') r.stop(); };
    const iv = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000), v = $('#vt'); if (v) v.textContent = '0:' + String(s).padStart(2, '0'); if (s >= p.duration && r.state === 'recording') r.stop(); }, 250);
  }

  /* Schedule form */
  let SD = null;
  function schedSheet(d) {
    SD = d; const P = S.projects.filter((p) => p.type !== 'pack'), src = d.pid ? S.get(d.pid) : null, at = d.at || (() => { const t = new Date(Date.now() + 36e5); t.setMinutes(0, 0, 0); return t.getTime(); })(), on = new Set(d.platforms || (src && A.isVideo(src) ? ['tiktok', 'instagram', 'youtube'] : ['instagram', 'facebook']));
    const what = d.media ? `<label class="lbl" for="sn">Name</label><input class="field" id="sn" maxlength="40" value="${esc(d.name || '')}">` : `<label class="lbl" for="sp">What to post</label><select class="field" id="sp"><option value="">Choose an ad</option>${P.map((p) => `<option value="${p.id}" ${p.id === d.pid ? 'selected' : ''}>${esc(p.name)} · ${esc(A.typeLabel[p.type] || (p.type === 'carousel' ? 'Carousel' : 'Ad'))}</option>`).join('')}</select>`;
    sheet(d.id ? 'Edit scheduled post' : 'Schedule a post', `<div class="stack">${P.length || d.media ? what : `<p>Make an ad first, or upload a video.</p>`}<div><span class="lbl">Where</span><div class="chips" role="group">${A.SCHED_PLATFORMS.map((x) => `<button class="chip ${on.has(x.id) ? 'on' : ''}" data-act="schedplat" data-v="${x.id}" aria-pressed="${on.has(x.id)}">${esc(x.name)}</button>`).join('')}</div></div><div><label class="lbl" for="st">When</label><input class="field" id="st" type="datetime-local" value="${A.sched.localInput(at)}"></div><div><label class="lbl" for="sc">Caption</label><textarea class="field" id="sc" rows="4" maxlength="2200">${esc(d.caption != null ? d.caption : src ? src.caption || '' : '')}</textarea></div><button class="btn full" data-act="schedsave">${ic('check', 'ic20')}${d.id ? 'Save changes' : 'Schedule'}</button></div>`);
    const sel = $('#sp'); if (sel) sel.onchange = () => { const s = S.get(sel.value), c = $('#sc'); if (s && c && !c.value.trim()) c.value = s.caption || ''; };
  }
  async function runExport(mode) {
    const p = E.p;
    if (A.content.needsQuote(p)) { E.tab = 'scenes'; render(); return A.toast('Paste a real customer quote before exporting.'); }
    try {
      if (p.type === 'carousel') { A.toast('Preparing your slides'); if (mode === 'share') { const ok = await A.exporter.shareFiles(await A.exporter.slidePngs(p), p); if (ok !== null) return; } if (await A.exporter.deliver(await A.exporter.slidesZip(p), 'save', p)) A.toast('Slides downloaded.'); return; }
      if (A.isVideo(p)) {
        if (!A.exporter.canVideo()) return A.toast('This browser cannot record video. Try Chrome.');
        stopPlay(); sheet('Exporting video', `<p>Keep this screen open. It takes about ${p.duration} seconds.</p><div class="prog"><i id="vp"></i></div>`); $('[data-act=close]', layer).hidden = true;
        const r = await A.exporter.video(p, (x) => { const b = $('#vp'); if (b) b.style.width = x * 100 + '%'; }); S.notify('Video exported', `${p.name} is ready.`, '#edit/' + p.id);
        sheet('Your video is ready', `<p>${esc(r.name)}</p><div class="actions"><button class="btn" id="vd">${ic('down')}Download</button><button class="btn ghost" id="vs">${ic('share')}Share</button></div>`);
        $('#vd').onclick = async () => { await A.exporter.deliver(r, 'save', p); closeSheet(); A.toast('Video downloaded.'); }; $('#vs').onclick = async () => { if (await A.exporter.deliver(r, 'share', p)) closeSheet(); }; return;
      }
      A.toast('Preparing your file');
      const r = mode === 'zip' ? await A.exporter.zipAll(p) : await A.exporter.png(p); if (await A.exporter.deliver(r, mode === 'share' ? 'share' : 'save', p) && mode !== 'share') A.toast('Downloaded.');
    } catch (x) { closeSheet(); A.toast(x.message || 'Export failed. Please try again.'); }
  }
  async function promptInstall() { const e = installEvt; installEvt = window.__bip = null; closeSheet(); e.prompt(); const c = await e.userChoice; if (c.outcome === 'accepted') { installed = true; refreshInstall(); A.toast('Creatagious is installing.'); if (route === 'profile') render(); } }
  async function installNow() {
    if (installEvt) return promptInstall();
    if (isIOS()) return sheet('Add to Home Screen', `<p>In Safari, tap the Share button, then choose Add to Home Screen.</p><button class="btn full" data-act="close">Got it</button>`);
    sheet('Getting Creatagious ready', '<div class="busy" style="min-height:90px" role="status"><span class="spin"></span>Preparing install</div>');
    const got = await new Promise((res) => { installWait = res; setTimeout(() => res(false), 4500); }); installWait = null;
    if (got && installEvt) { if (navigator.userActivation && navigator.userActivation.isActive) return promptInstall(); return installSheet(); }
    const live = isSecureContext && 'serviceWorker' in navigator;
    sheet('Install from your browser', live ? `<p>Your browser hasn't offered the one-tap install yet. Open its menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. If neither appears, Creatagious may already be installed.</p><button class="btn full" data-act="close">Got it</button>` : `<p>Install works once Creatagious is opened from its live HTTPS website.</p><button class="btn full" data-act="close">Got it</button>`);
  }
  function installSheet() { if (!installEvt || !A.canInstall()) return; sheet('Install Creatagious', `<div class="row" style="margin-bottom:14px"><span class="install-ic">${ic('logo')}</span><p style="margin:0">Open it from your home screen and keep creating offline.</p></div><div class="actions"><button class="btn ghost" data-act="later">Not now</button><button class="btn" data-act="install">Install</button></div>`); }
  const pill = (v, p) => { p[v[0]] = v[1]; };

  const act = {
    close: closeSheet, scrim(el, e) { if (e.target === el && !voiceRec && !$('#vp')) closeSheet(); }, later() { try { localStorage.setItem('install-later', '1'); } catch (e) {} closeSheet(); }, install: installNow,
    menu() { layer.innerHTML = `<div class="scrim left" data-act="scrim"><nav class="drawer" aria-label="Menu"><a class="brand" href="#home">${`<svg class="brand-mark" aria-hidden="true"><use href="#i-logo"/></svg>`}<span class="brand-text"><span class="brand-name">Creatagious</span></span></a><div class="list">${[['#create', 'plus', 'Create'], ['#templates', 'layers', 'Templates'], ['#projects', 'folder', 'Projects'], ['#analytics', 'chart', 'Analytics'], ['#schedule', 'cal', 'Schedule'], ['#profile', 'user', 'Profile and theme'], ['privacy.html', 'flag', 'Privacy Policy'], ['terms.html', 'pen', 'Terms of Use']].map(([h, i, t]) => `<a class="li" href="${h}">${ic(i)}${t}</a>`).join('')}<button class="li" data-act="darktoggle">${ic('moon')}${A.theme.isDark() ? 'Light theme' : 'Dark theme'}</button>${A.plan.premium() ? '' : `<button class="li" data-act="paywall">${ic('crown')}Go Premium</button>`}${A.canInstall() ? `<button class="li" data-act="install">${ic('down')}Install app</button>` : ''}</div></nav></div>`; },
    type(el) { A.draft.type = el.dataset.v; if (['video', 'promo'].includes(A.draft.type)) { if (A.draft.format === 'square') A.draft.format = 'story'; if (A.plan.premium() && A.draft.style === 'classic') A.draft.style = A.goalStyle(A.draft.goal); } if (['image', 'campaign'].includes(A.draft.type) && A.draft.format === 'story') A.draft.format = 'square'; render(); },
    idea() { $('#quick').focus(); }, upload() { pickImage((d) => { A.draft.photo = d; go('#create'); A.toast('Photo added. Now describe your ad.'); }); },
    website() { sheet('Generate from a website', `<form data-form="site"><label class="lbl" for="url">Website address</label><input class="field" id="url" inputmode="url" autocapitalize="none" required placeholder="yourbusiness.com" value="${esc(S.profile.website)}"><p class="note" style="margin:8px 0 12px">We&#39;ll read its pages and show you the headlines, offers, services, photos and colors we find before anything is made.</p><button class="btn full">Read website</button></form>`); },
    scroll(el) { const t = $('#track'); t.scrollBy({ left: Number(el.dataset.v) * t.clientWidth * .8, behavior: 'smooth' }); },
    tpl(el) { A.draft.template = el.dataset.v; go('#create'); },
    /* Scheduling (Premium) */
    schedadd(el) { if (!A.plan.premium()) return paywall(); schedSheet({ pid: el.dataset.v || '' }); },
    schedup() { if (!A.plan.premium()) return paywall(); fileCb = async (f) => { if (!/^(video|image)\//.test(f.type)) throw new Error('Choose a video or image.'); const id = await A.media.put(f); schedSheet({ media: id, fileName: f.name, name: f.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'My video' }); }; fileRaw = true; const i = $('#file'); i.accept = 'video/mp4,video/webm,video/quicktime,image/*'; i.value = ''; i.click(); },
    schedplat(el) { const on = el.getAttribute('aria-pressed') !== 'true'; el.setAttribute('aria-pressed', on); el.classList.toggle('on', on); },
    async schedsave(el) {
      const d = SD, picked = $$('.sheet [data-act=schedplat][aria-pressed=true]').map((b) => b.dataset.v), at = new Date($('#st').value).getTime(), sel = $('#sp');
      if (sel) { d.pid = sel.value; if (!d.pid) return A.toast('Choose what to post.'); } if (!picked.length) return A.toast('Choose at least one platform.'); if (!at) return A.toast('Choose a date and time.');
      const src = d.pid ? S.get(d.pid) : null, old = d.id ? S.posts.find((x) => x.id === d.id) : null, p = old || { id: S.uid(), done: {} };
      Object.assign(p, { pid: d.pid || null, media: d.media || null, fileName: d.fileName || '', name: ($('#sn') && $('#sn').value.trim()) || (src ? src.name : d.name) || 'Post', platforms: picked, at, caption: $('#sc').value.trim(), notified: false });
      Object.keys(p.done || {}).forEach((k) => { if (!picked.includes(k)) delete p.done[k]; }); if (!old) S.posts.push(p); await S.put('posts', S.posts); S.log('schedule', { platforms: picked.length, own: !!p.media }); SD = null; closeSheet();
      if (route !== 'schedule') go('#schedule'); else render(); A.toast(at <= Date.now() ? 'Saved. It is ready to post now.' : `Scheduled for ${A.sched.when(at)}.`); A.sched.check();
    },
    schedmenu(el) { const p = S.posts.find((x) => x.id === el.dataset.v); if (!p) return; sheet(p.name, `<div class="list"><button class="li" data-act="schededit" data-v="${p.id}">${ic('pen')}Edit</button>${p.pid ? `<a class="li" href="#edit/${p.pid}">${ic('image')}Open the ad</a>` : ''}<button class="li" data-act="scheddone" data-v="${p.id}">${ic('check')}Mark all as posted</button><button class="li" data-act="scheddel" data-v="${p.id}">${ic('x')}Delete</button></div>`); },
    schededit(el) { const p = S.posts.find((x) => x.id === el.dataset.v); if (p) schedSheet(Object.assign({}, p)); },
    async scheddone(el) { const p = S.posts.find((x) => x.id === el.dataset.v); p.platforms.forEach((k) => { p.done[k] = true; }); await S.put('posts', S.posts); closeSheet(); render(); },
    async scheddel(el) { const p = S.posts.find((x) => x.id === el.dataset.v); S.posts = S.posts.filter((x) => x !== p); await S.put('posts', S.posts); if (p.media && !S.posts.some((x) => x.media === p.media) && !S.projects.some((q) => JSON.stringify(q).includes(p.media))) A.media.drop(p.media); closeSheet(); render(); A.toast('Removed from your schedule.'); },
    schedics(el) { const p = S.posts.find((x) => x.id === el.dataset.v); A.saveBlob(A.sched.ics([p]), A.exporter.slug(p.name) + '-reminder.ics'); A.toast('Open the file to add the reminder to your calendar.'); },
    schedicsall() { const list = S.posts.filter((p) => p.at > Date.now() && p.platforms.some((k) => !(p.done || {})[k])); A.saveBlob(A.sched.ics(list), 'creatagious-schedule.ics'); A.toast('Open the file to add the reminders to your calendar.'); },
    async schednotif() { try { const r = await Notification.requestPermission(); A.toast(r === 'granted' ? 'Reminders are on while Creatagious is open. Add them to your calendar too.' : 'Notifications are off. Calendar reminders still work.'); } catch (e) {} render(); },
    async schedgo(el) {
      const p = S.posts.find((x) => x.id === el.dataset.v); if (!p) return; const video = p.media ? (await A.media.blob(p.media) || {}).type?.startsWith('video/') : A.isVideo(A.sched.source(p) || {});
      sheet('Post now', `<p class="note" style="margin:0 0 10px">${video && !p.media ? 'Your video is recorded first, which takes as long as the video. ' : ''}Share sends the file and copies the caption, so you can paste it in the app.</p><div class="list">${p.platforms.map((k) => { const d = (p.done || {})[k], x = A.sched.plat(k); return `<div class="li prow"><span class="grow"><b>${esc(x.name)}</b>${d ? '<small>Posted</small>' : ''}</span><button class="btn ${d ? 'ghost' : ''}" data-act="schedshare" data-v="${p.id}|${k}">${ic('share', 'ic18')}Share</button><button class="ck ${d ? 'on' : ''}" data-act="schedmark" data-v="${p.id}|${k}" aria-pressed="${!!d}" aria-label="Mark ${esc(x.name)} as posted">${ic('check')}</button></div>`; }).join('')}</div><div class="prog" id="spg" hidden><i id="vp"></i></div>`);
    },
    async schedshare(el) {
      const [id, k] = el.dataset.v.split('|'), p = S.posts.find((x) => x.id === id), x = A.sched.plat(k); try { await navigator.clipboard.writeText(p.caption || ''); } catch (e) {}
      el.disabled = true; const label = el.innerHTML; el.textContent = 'Preparing'; const bar = $('#spg'); if (bar) bar.hidden = false;
      try {
        const list = await A.sched.files(p, (v) => { const b = $('#vp'); if (b) b.style.width = v * 100 + '%'; }), files = list.map((r) => new File([r.blob], r.name, { type: r.blob.type }));
        if (navigator.canShare && navigator.canShare({ files })) { try { await navigator.share({ files, text: p.caption || '' }); } catch (e) { if (e.name !== 'AbortError') throw e; return; } }
        else { list.forEach((r) => A.saveBlob(r.blob, r.name)); if (x.url) window.open(x.url, '_blank', 'noopener'); A.toast(`Downloaded. Upload it on ${x.name}. The caption is copied.`); }
        p.done = p.done || {}; p.done[k] = true; await S.put('posts', S.posts); S.log('posted', { platform: k }); const m = $(`.sheet [data-act=schedmark][data-v="${id}|${k}"]`); if (m) { m.classList.add('on'); m.setAttribute('aria-pressed', 'true'); }
      } catch (e) { A.toast(e.message || 'Could not prepare the file.'); } finally { el.disabled = false; el.innerHTML = label; if (bar) bar.hidden = true; }
    },
    async schedmark(el) { const [id, k] = el.dataset.v.split('|'), p = S.posts.find((x) => x.id === id), on = !(p.done || {})[k]; p.done = p.done || {}; if (on) p.done[k] = true; else delete p.done[k]; el.classList.toggle('on', on); el.setAttribute('aria-pressed', on); await S.put('posts', S.posts); },
    pmenu(el) { const p = S.get(el.dataset.v); sheet(p.name, `<div class="list"><a class="li" href="#edit/${p.id}">${ic('pen')}Open</a>${p.type === 'pack' ? '' : `<button class="li" data-act="dup" data-v="${p.id}">${ic('layers')}Duplicate</button>`}<button class="li" data-act="del" data-v="${p.id}">${ic('x')}Delete</button></div>`); },
    dup(el) { if (S.get(el.dataset.v).type === 'pack') return; const c = JSON.parse(JSON.stringify(S.get(el.dataset.v))); Object.assign(c, { id: S.uid(), name: c.name + ' copy', created: Date.now(), exports: 0, seed: false }); S.upsert(c); closeSheet(); render(); },
    del(el) { const id = el.dataset.v; sheet('Delete project?', `<p>This removes it from this device.</p><div class="actions"><button class="btn ghost" data-act="close">Cancel</button><button class="btn danger" data-act="del2" data-v="${id}">Delete</button></div>`); },
    del2(el) { S.remove(el.dataset.v); closeSheet(); render(); },
    paywall, async preview() { A.plan.test(true); closeSheet(); await render(); A.toast('You are now testing Premium.'); }, async endpreview() { A.plan.test(false); closeSheet(); await render(); A.toast('You are now testing Free.'); },
    async plantest(el) { A.plan.test(el.dataset.v === 'premium'); await render(); A.toast(el.dataset.v === 'premium' ? 'You are now testing Premium.' : 'You are now testing Free.'); },
    async setup() {
      sheet('Setup check', '<div class="busy" style="min-height:90px" role="status"><span class="spin"></span>Checking your server</div>'); let d = null; try { const r = await fetch(A.CONFIG.HEALTH_ENDPOINT); if ((r.headers.get('content-type') || '').includes('json')) d = await r.json(); } catch (x) {}
      if (!$('.sheet', layer)) return; if (!d) return sheet('Setup check', '<p>The server part of the app is not responding. Upload the api folder and use PHP 7.4 or newer with cURL.</p>'); 
      const rows = [['PHP version', d.php], ['cURL', d.curl], ['DOM (website reading)', d.dom], ['mbstring', d.mbstring], ['api/data folder is writable', d.data_folder], ['secret.php uploaded', d.secret_file], ['Claude key added', d.claude_key], ['Claude accepts the key', d.claude_works], ['Runway key added', d.runway_key], ['Runway accepts the key', d.runway_works], ['Runway has credits', d.runway_credits], ['ElevenLabs key added', d.eleven_key], ['ElevenLabs accepts the key', d.eleven_works], ['Premium code added', d.premium_codes]];
      sheet('Setup check', `<div class="setup">${rows.map(([t, ok]) => `<div class="${ok ? 'ok' : 'bad'}">${ic(ok ? 'check' : 'x')}<span>${t}</span></div>`).join('')}</div>${(d.problems || []).map((t) => `<p class="note">${esc(t)}</p>`).join('')}`);
    },
    aiimg(el) { if (!aiReady('AI images')) return; const p = E.p, t = el.dataset.v; sheet('Create AI image', `<label class="lbl" for="aip">Describe the image</label><textarea class="field" id="aip" rows="4" maxlength="900">${esc(aiPrompt(p, aiText(p, t)))}</textarea><p class="note">Ad text is added on top by Creatagious. Avoid real people and other brands.</p><button class="btn full" data-act="aiimggo" data-v="${esc(t)}">${ic('spark', 'ic20')}Create image</button>`); },
    async aiimggo(el) { const p = E.p, prompt = $('#aip').value.trim(); if (prompt.length < 3) return A.toast('Describe the image first.'); el.disabled = true; el.textContent = 'Creating image'; try { await aiPlace(p, el.dataset.v, await aiFetch(prompt, p.format)); closeSheet(); touch(); render(); A.toast('AI image added.'); } catch (x) { el.disabled = false; el.textContent = 'Create image'; A.toast(x.message); } },
    aiall(el) { if (!aiReady('AI images')) return; const k = el.dataset.v, n = E.p[k].filter((s) => !s.media).length; if (!n) return A.toast('Every one already has an image.'); sheet('Create AI images', `<p>This creates ${n} ${n === 1 ? 'image' : 'images'} and counts toward your daily allowance. It can take a few minutes.</p><div class="actions"><button class="btn ghost" data-act="close">Cancel</button><button class="btn" data-act="aiallgo" data-v="${k}">Create ${n}</button></div>`); },
    async aiallgo(el) {
      const p = E.p, k = el.dataset.v, pre = k === 'scenes' ? 's:' : 'sl:', todo = p[k].map((s, i) => [s, i]).filter(([s]) => !s.media); let done = 0, next = 0, err = ''; sheet('Creating AI images', `<p id="aic">0 of ${todo.length} done. Keep this screen open.</p><div class="prog"><i id="vp"></i></div>`); $('[data-act=close]', layer).hidden = true;
      const work = async () => { while (next < todo.length && !err) { const [s, i] = todo[next++]; try { await aiPlace(p, pre + i, await aiFetch(aiPrompt(p, `${s.title}: ${s.text || ''}`), p.format)); done++; S.upsert(p); const c = $('#aic'), b = $('#vp'); if (c) c.textContent = `${done} of ${todo.length} done. Keep this screen open.`; if (b) b.style.width = done / todo.length * 100 + '%'; } catch (x) { err = x.message; } } };
      await Promise.all([work(), work()]); closeSheet(); touch(); render(); A.toast(err ? `${done} created. ${err}` : 'AI images added.');
    },
    async aivid(el) { if (!aiReady('AI clips')) return; const p = E.p, i = +el.dataset.v, s = p.scenes[i], b = s.media && await A.media.blob(s.media), still = b && b.type.startsWith('image/'); sheet('Create AI clip', `<label class="lbl" for="aip">Describe the motion</label><textarea class="field" id="aip" rows="4" maxlength="900">${esc(aiPrompt(p, aiText(p, 's:' + i)))}</textarea><p class="note">${still ? 'This scene&#39;s image becomes the first frame. ' : ''}Creates one ${A.CONFIG.AI_CLIP_SECONDS}-second clip from your daily allowance. It usually takes a few minutes.</p><button class="btn full" data-act="aividgo" data-v="${i}">${ic('video', 'ic20')}Create clip</button>`); },
    async aividgo(el) { const p = E.p, i = +el.dataset.v, prompt = $('#aip').value.trim(); if (prompt.length < 3) return A.toast('Describe the clip first.'); sheet('Creating AI clip', '<p>Keep this screen open. Your clip will be added to the scene.</p><div class="prog"><i id="vp" style="width:8%"></i></div>'); $('[data-act=close]', layer).hidden = true; try { await aiClip(p, i, prompt); closeSheet(); touch(); render(); A.toast('AI clip added.'); } catch (x) { closeSheet(); A.toast(x.message); } },
    kfact(el) { const f = A.draft.site.facts.find((x) => x.id === +el.dataset.v); f.on = !f.on; render(); }, async kretry(el) { el.disabled = true; el.textContent = 'Reading the website'; await readSite(A.draft.site.url); },
    kphoto() { pickMedia(async (f) => { if (!f.type.startsWith('image/')) throw new Error('Choose a photo.'); const k = A.draft.site, id = await A.media.put(f); if (A.plan.premium()) k.own.push(id); else { k.own = [id]; k.sel = []; } render(); }); }, knophoto(el) { A.draft.site.own.splice(+el.dataset.v, 1); render(); },
    async buyplay() { try { if (await A.plan.buyPlay()) { closeSheet(); render(); A.toast('Premium is active.'); } } catch (x) { if (x.name !== 'AbortError') A.toast('The purchase did not finish.'); } },
    theme(el) { A.theme.set(el.dataset.v); render(); }, darktoggle() { A.theme.set(A.theme.isDark() ? 'light' : 'dark'); closeSheet(); },
    dstyle(el) { A.draft.style = el.dataset.v; render(); }, ktype(el) { A.draft.type = el.dataset.v; if (el.dataset.v === 'carousel' || el.dataset.v === 'pack') A.draft.format = 'square'; if (['video', 'promo'].includes(el.dataset.v)) { A.draft.format = 'story'; if (A.plan.premium() && A.draft.style === 'classic') A.draft.style = 'hook'; } else if (A.draft.format === 'story') A.draft.format = 'square'; render(); },
    kcolor(el) { A.draft.site.color = el.dataset.v; render(); }, kpick(el) { const k = A.draft.site, i = +el.dataset.v; if (!A.plan.premium()) { k.sel = k.sel.includes(i) ? [] : [i]; k.own = []; } else k.sel = k.sel.includes(i) ? k.sel.filter((x) => x !== i) : [...k.sel, i]; render(); },
    kgen() { const k = A.draft.site, r = $('#krights'); k.rights = !!(r && r.checked); if (r && !r.checked && (k.sel.length || (A.plan.premium() && k.logo))) { r.focus(); return A.toast('Confirm you can use this website\u2019s logo and photos.'); } generate(k); },
    ctapick(el) { const v = el.dataset.v; if (v) E.p.cta = v; else if (A.CTAS.includes(E.p.cta)) E.p.cta = ''; touch(); render().then(() => { if (!v) { const f = $('#f3'); if (f) f.focus(); } }); },
    eset(el) { const [k, v] = el.dataset.v.split(':'); E.p[k] = v; touch(); render(); },
    estyle(el) { const p = E.p, v = el.dataset.v, old = p.scenes; p.style = v; const g = A.copy.local(p.brief || p.headline, p.type); g.scenes = p.allScenes || g.scenes; g.variants[0] = { headline: p.headline, sub: p.sub, cta: p.cta }; p.scenes = A.content.script(v, g, p.duration, p.brand); p.scenes.forEach((s, i) => { if (old[i] && old[i].media) s.media = old[i].media; }); E.sec = 0; touch(); render(); },
    logo() { pickMedia(async (f) => { if (!f.type.startsWith('image/')) throw new Error('Choose an image.'); E.p.logo = await A.media.put(f); await A.media.load(E.p.logo); touch(); render(); }); }, nologo() { E.p.logo = null; touch(); render(); },
    smedia(el) { const i = +el.dataset.v; pickMedia(async (f) => { const id = await A.media.put(f); E.p.scenes[i].media = id; await A.media.load(id); E.sec = A.content.timeline(E.p)[i].start + .4; touch(); render(); }); }, snomedia(el) { delete E.p.scenes[+el.dataset.v].media; touch(); render(); },
    voice: recordVoice, voicepanel: voicePanel, aivoice: aiVoice, stopvoice() { voiceRec && voiceRec.stop(); }, novoice() { const v = E.p.voice; E.p.voice = null; E.p.voiceAI = false; if (v) A.media.drop(v); closeSheet(); touch(); render(); A.toast('Voiceover removed.'); },
    uploadvoice() { const p = E.p; fileCb = async (f) => { if (f.size > 50e6) throw new Error('Choose an audio file under 50 MB.'); await setVoice(p, f); }; fileRaw = true; const i = $('#file'); i.accept = 'audio/*,.mp3,.m4a,.wav,.aac,.ogg'; i.value = ''; i.click(); }, progress() { E.p.progress = E.p.progress === false; touch(); render(); },
    dgoal(el) { A.draft.goal = el.dataset.v; if (A.plan.premium()) A.draft.style = A.goalStyle(el.dataset.v); render(); }, dslides(el) { A.draft.slides = +el.dataset.v; render(); }, dcarfmt(el) { A.draft.carFormat = el.dataset.v; render(); },
    dplat(el) { const d = A.draft, v = el.dataset.v; d.platforms = d.platforms.includes(v) ? d.platforms.filter((x) => x !== v) : [...d.platforms, v]; render(); },
    slprev() { E.slide = Math.max(0, E.slide - 1); render(); }, slnext() { E.slide = Math.min(E.p.slides.length - 1, E.slide + 1); render(); },
    sladd() { const p = E.p, max = A.plan.premium() ? 20 : 5; if (p.slides.length >= max) return A.plan.premium() ? A.toast('Carousels can have up to 20 slides.') : paywall(); p.slides.splice(p.slides.length - 1, 0, { kind: 'body', title: 'New slide', text: 'Add your point here.' }); E.slide = p.slides.length - 2; touch(); render(); },
    sldel(el) { const p = E.p; if (p.slides.length <= 3) return A.toast('Keep at least 3 slides.'); p.slides.splice(+el.dataset.v, 1); E.slide = Math.min(E.slide, p.slides.length - 1); touch(); render(); }, slup(el) { const i = +el.dataset.v, S2 = E.p.slides; [S2[i - 1], S2[i]] = [S2[i], S2[i - 1]]; E.slide = i - 1; touch(); render(); },
    slmedia(el) { const i = +el.dataset.v; pickMedia(async (f) => { if (!f.type.startsWith('image/')) throw new Error('Choose a photo.'); const id = await A.media.put(f); E.p.slides[i].media = id; await A.media.load(id); E.slide = i; touch(); render(); }); }, slnomedia(el) { delete E.p.slides[+el.dataset.v].media; touch(); render(); },
    async packzip(el) { el.disabled = true; A.toast('Preparing your pack'); try { const p = S.get(el.dataset.v); await A.exporter.deliver(await A.exporter.packZip(p), 'save', p); A.toast('Pack downloaded.'); } catch (x) { A.toast('The pack could not be prepared.'); } el.disabled = false; },
    async packcap(el) { const p = S.get(el.dataset.v); try { await navigator.clipboard.writeText(p.caption || ''); A.toast('Caption copied.'); } catch (x) { A.toast('Open the post to copy its caption.'); } },
    pkind(el) { A.draft.promoKind = el.dataset.v; render(); }, dfmt(el) { A.draft.format = el.dataset.v; render(); }, dlen(el) { A.draft.duration = +el.dataset.v; render(); }, dtpl(el) { A.draft.template = el.dataset.v; render(); },
    generate: () => generate(), dphoto() { pickImage((d) => { A.draft.photo = d; render(); }); }, dnophoto() { A.draft.photo = null; render(); },
    tab(el) { E.tab = el.dataset.v; render(); }, efmt(el) { E.p.format = el.dataset.v; touch(); render(); }, etpl(el) { E.p.template = el.dataset.v; touch(); render(); }, accent(el) { E.p.accent = el.dataset.v; touch(); render(); },
    variant(el) { const p = E.p, i = +el.dataset.v, v = p.variants[i]; Object.assign(p, { variant: i, headline: v.headline, sub: v.sub, cta: v.cta }); touch(); render(); },
    photo() { pickImage((d) => { E.p.photo = d; touch(); render(); }); }, nophoto() { E.p.photo = null; touch(); render(); },
    elen(el) { const p = E.p; p.duration = +el.dataset.v; if (p.style && p.style !== 'classic') { const old = p.scenes, g = A.copy.local(p.brief || p.headline, p.type); g.scenes = p.allScenes || g.scenes; g.variants[0] = { headline: p.headline, sub: p.sub, cta: p.cta }; p.scenes = A.content.script(p.style, g, p.duration, p.brand); p.scenes.forEach((s) => { const m = old.find((o) => o.title === s.title); if (m) { s.text = m.text; if (m.media) s.media = m.media; } }); } else p.scenes = A.scenesFor(p.allScenes, p.duration); E.sec = 0; touch(); render(); },
    music() { E.p.music = E.p.music === false; touch(); render(); }, play(el) { togglePlay(el); }, export(el) { runExport(el.dataset.v); },
    async copycap() { try { await navigator.clipboard.writeText(E.p.caption); A.toast('Caption copied.'); } catch (e) { $('#cap').select(); A.toast('Select and copy the caption.'); } },
    report() { sheet('Report this result', `<form data-form="report"><label class="lbl" for="why">What&#39;s wrong with it?</label><select class="field" id="why"><option>Offensive or harmful</option><option>False or misleading</option><option>Copies someone else&#39;s work</option><option>Something else</option></select><label class="lbl" for="more" style="margin-top:10px">Details (optional)</label><textarea class="field" id="more" rows="3" maxlength="500"></textarea><button class="btn full" style="margin-top:12px">Send report</button></form>`); },
    exportdata() { A.saveBlob(new Blob([JSON.stringify(S.dump(), null, 2)], { type: 'application/json' }), 'creatagious-data.json'); },
    wipe() { sheet('Delete all your data?', `<p>Projects, brand details and activity will be removed from this device. This can&#39;t be undone.</p><div class="actions"><button class="btn ghost" data-act="close">Cancel</button><button class="btn danger" data-act="wipe2">Delete</button></div>`); },
    async wipe2() { await S.wipe(); location.hash = ''; location.reload(); }
  };
  document.addEventListener('click', (e) => { const el = e.target.closest('[data-act]'); if (el && act[el.dataset.act]) { if (el.dataset.act !== 'scrim') e.preventDefault(); act[el.dataset.act](el, e); } else if (e.target.closest('.drawer a')) closeSheet(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  document.addEventListener('input', (e) => {
    const t = e.target, D = t.dataset;
    if (t.id === 'krights' && A.draft.site) A.draft.site.rights = t.checked; else if (t.id === 'quick') A.draft.brief = t.value; else if (D.sl && E) { E.p.slides[+D.sl][D.slk] = t.value; if (E.slide !== +D.sl) { E.slide = +D.sl; const n = $('.slcount'); if (n) n.textContent = `${E.slide + 1} / ${E.p.slides.length}`; } touch(); } else if (D.d) A.draft[D.d] = t.value; else if (D.k && A.draft.site) A.draft.site[D.k] = t.value; else if (D.p) { S.profile[D.p] = t.value; S.put('profile', S.profile); }
    else if (D.f && E) { E.p[D.f] = t.value; touch(); }
    else if (D.scene && E) { const s = E.p.scenes[+D.scene]; s.text = t.value; const o = E.p.allScenes.find((x) => x.title === s.title); if (o) o.text = t.value; E.sec = (+D.scene + .5) * E.p.duration / E.p.scenes.length; touch(); }
  });
  document.addEventListener('submit', async (e) => {
    e.preventDefault(); const k = e.target.dataset.form;
    if (k === 'quick') generate();
    if (k === 'license') { try { await A.plan.redeem($('#lc').value.trim()); closeSheet(); render(); A.toast('Premium is active.'); } catch (x) { A.toast(navigator.onLine ? x.message : 'Connect to the internet to redeem a code.'); } }
    if (k === 'report') { const body = { reason: $('#why').value, details: $('#more').value, headline: E.p.headline, sub: E.p.sub, source: E.p.source }; S.log('report', { reason: body.reason }); closeSheet(); A.toast('Thanks. Your report was recorded.'); if (A.CONFIG.REPORT_ENDPOINT && navigator.onLine) fetch(A.CONFIG.REPORT_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {}); }
    if (k === 'site') { const b = $('button', e.target); b.disabled = true; b.textContent = 'Reading the website'; await readSite($('#url').value); if (b.isConnected) { b.disabled = false; b.textContent = 'Read website'; } }
  });

  /* Connection and install */
  const net = () => { $('#net').hidden = navigator.onLine; }; addEventListener('online', net); addEventListener('offline', net);
  const onPrompt = (e) => { e.preventDefault(); installEvt = e; if (installWait) return installWait(true); let later = false; try { later = localStorage.getItem('install-later'); } catch (x) {} if (!later && !layer.innerHTML) setTimeout(() => { if (!layer.innerHTML && installEvt) installSheet(); }, 1800); };
  addEventListener('beforeinstallprompt', onPrompt); if (installEvt) onPrompt(installEvt);
  addEventListener('appinstalled', () => { installEvt = null; installed = true; refreshInstall(); if (route === 'profile') render(); });
  refreshInstall(); matchMedia('(display-mode: standalone)').addEventListener('change', refreshInstall);
  if ('serviceWorker' in navigator && location.protocol === 'https:' || location.hostname === 'localhost') {
    navigator.serviceWorker && navigator.serviceWorker.register('service-worker.js').then((reg) => {
      const ask = (w) => A.toast('A new version is ready.', 'Update', () => w.postMessage('skip'));
      if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
      reg.addEventListener('updatefound', () => { const w = reg.installing; w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ask(w); }); });
    }).catch(() => {});
    let done; navigator.serviceWorker && navigator.serviceWorker.addEventListener('controllerchange', () => { if (done || !window.__hadSW) { window.__hadSW = true; return; } done = true; location.reload(); });
    window.__hadSW = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  }

  A.plan.restorePlay(); A.plan.refresh(); S.load().then(() => { A.refreshDot(); net(); render(); A.sched.check(); setInterval(() => A.sched.check(), 6e4); document.addEventListener('visibilitychange', () => { if (!document.hidden) A.sched.check(); }); }).catch(() => { view.innerHTML = '<div class="empty"><strong>Storage is unavailable</strong>Private browsing can block saving. Open Creatagious in a normal window.</div>'; });
})();
