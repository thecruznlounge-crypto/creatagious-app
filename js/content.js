/* Premium content-style video: creator formats, animated captions, looks and transitions. */
(function () {
  A.STYLES = [
    ['classic', 'Classic promo', 'Simple animated promo'],
    ['hook', 'Creator hook', 'Fast talking-to-camera style'],
    ['pov', 'POV', 'Relatable first-person setup'],
    ['problem', 'Problem to fix', 'Pain point, then your answer'],
    ['top3', 'Top 3 list', 'Three quick reasons'],
    ['beforeafter', 'Before and after', 'Wipe between two shots'],
    ['reveal', 'Product reveal', 'Tease, then show it'],
    ['review', 'Customer review', 'Uses a real quote you paste'],
    ['founder', 'Founder story', 'Why you started']
  ];
  A.CAPTIONS = [['pop', 'Pop box'], ['karaoke', 'Karaoke'], ['stack', 'Big words'], ['neon', 'Neon'], ['clean', 'Clean bar'], ['type', 'Typewriter']];
  A.TRANSITIONS = [['cut', 'Quick cut'], ['whip', 'Whip pan'], ['zoom', 'Punch zoom'], ['fade', 'Fade'], ['glitch', 'Glitch']];
  A.MOODS = [['upbeat', 'Upbeat'], ['lofi', 'Lo-fi'], ['cinema', 'Cinematic'], ['hype', 'Hype'], ['none', 'No music']];
  A.QUOTE_HOLDER = '[Paste a real customer quote]';

  const clean = (s) => String(s || '').replace(/\.$/, '');
  const beats = {
    hook: (x) => [['Hook', x.hook], ['Setup', `Here’s why people love ${x.short}`], ['Show it', x.topic], ['Payoff', x.line], ['Offer', x.offer], ['Call to action', x.short]],
    pov: (x) => [['POV', `POV: you just found ${x.short}`], ['Moment', x.line], ['Show it', x.topic], ['Reaction', 'Why did nobody tell me sooner?'], ['Offer', x.offer], ['Call to action', x.short]],
    problem: (x) => [['Problem', `Tired of settling for less?`], ['Agitate', 'You shouldn’t have to work this hard for it'], ['Fix', `Meet ${x.short}`], ['How', x.line], ['Offer', x.offer], ['Call to action', x.short]],
    top3: (x) => [['Hook', `3 reasons to try ${x.short}`], ['Reason 1', x.r1], ['Reason 2', x.r2], ['Reason 3', x.r3], ['Offer', x.offer], ['Call to action', x.short]],
    beforeafter: (x) => [['Hook', 'Watch the difference'], ['Before', 'Before'], ['After', `After ${x.short}`], ['Why', x.line], ['Offer', x.offer], ['Call to action', x.short]],
    reveal: (x) => [['Tease', 'Wait for it'], ['Build', x.hook], ['Reveal', x.topic], ['Detail', x.line], ['Offer', x.offer], ['Call to action', x.short]],
    review: (x) => [['Hook', `What customers say about ${x.short}`], ['Quote', A.QUOTE_HOLDER], ['Show it', x.topic], ['Why', x.line], ['Offer', x.offer], ['Call to action', x.short]],
    founder: (x) => [['Hook', `Why we started ${x.short}`], ['Story', 'We wanted something better'], ['Show it', x.topic], ['Promise', x.line], ['Offer', x.offer], ['Call to action', x.short]]
  };
  const PICKS = { beforeafter: [[1, 2], [0, 1, 2, 5]], top3: [[0, 5], [0, 1, 2, 3, 5]], review: [[1, 5], [0, 1, 4, 5]] };
  const pickFor = (secs, n, style) => { const P = PICKS[style] || [[0, n - 1], [0, 2, n - 2, n - 1]]; return secs <= 6 ? P[0] : secs <= 15 ? P[1] : [...Array(n).keys()]; };

  A.content = {
    context(gen, brand) {
      const v = gen.variants[0], s = gen.scenes || [], topic = clean((s[1] && s[1].text) || gen.name), short = brand || gen.name || 'this';
      return { hook: clean(s[0] && s[0].text) || v.headline, topic, short, line: clean((s[2] && s[2].text) || v.sub), r1: clean((s[1] && s[1].text) || v.headline), r2: clean((s[2] && s[2].text) || v.sub), r3: clean((s[3] && s[3].text) || v.sub), offer: clean((s[4] && s[4].text) || v.headline), cta: v.cta };
    },
    script(style, gen, secs, brand, ai) {
      if (style === 'classic' || !beats[style]) return A.scenesFor(gen.scenes, secs);
      const all = beats[style](A.content.context(gen, brand)).map(([title, text], i) => ({ title, text: title !== 'Quote' && ai && ai[i] ? ai[i] : text }));
      return pickFor(secs, all.length, style).map((i) => all[i]);
    },
    beats: (style) => beats[style] ? beats[style](new Proxy({}, { get: () => '' })).map((b) => b[0]) : [],
    timeline(p) {
      const L = p.scenes, w = L.map((s) => Math.max(1.5, String(s.text || '').split(/\s+/).length * .42 + .5)), sum = w.reduce((a, b) => a + b, 0) || 1; let t = 0;
      return L.map((s, i) => { const len = w[i] / sum * p.duration, o = { i, s, start: t, len }; t += len; return o; });
    },
    needsQuote: (p) => p.style === 'review' && p.scenes.some((s) => s.text === A.QUOTE_HOLDER),
    async prepare(p) {
      await Promise.all([p.logo, ...((p.scenes || []).map((s) => s.media)), ...((p.slides || []).map((s) => s.media))].filter(Boolean).map((id) => A.media.load(id)));
    },
    /* Keeps video elements in step with the scene being drawn. */
    sync(p, sec, playing) {
      if (!p.scenes || !p.scenes.length || !A.isVideo(p)) return; const tl = A.content.timeline(p), cur = tl.find((x) => sec < x.start + x.len) || tl[tl.length - 1], active = cur.s.media && A.media.els.get(cur.s.media);
      new Set(tl.map((x) => x.s.media && A.media.els.get(x.s.media))).forEach((e) => { if (e && e.tagName === 'VIDEO' && e !== active) e.pause(); });
      if (active && active.tagName === 'VIDEO') { const want = (sec - cur.start) % (active.duration || 1e9); if (!playing) { active.pause(); if (Math.abs(active.currentTime - want) > .05) active.currentTime = want; } else { if (A.content._s !== cur.i) { active.currentTime = want; A.content._s = cur.i; } if (active.paused) active.play().catch(() => {}); } }
    },
    stop(p) { (p.scenes || []).forEach((s) => { const e = s.media && A.media.els.get(s.media); if (e && e.pause) e.pause(); }); A.content._s = -1; },
    draw
  };

  let grain;
  const noise = (c) => { if (!grain) { const g = document.createElement('canvas'); g.width = g.height = 128; const x = g.getContext('2d'), d = x.createImageData(128, 128); for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 26; } x.putImageData(d, 0, 0); grain = g; } return c.createPattern(grain, 'repeat'); };
  const clamp = (x) => Math.max(0, Math.min(1, x)), ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
  const elSize = (e) => [e.videoWidth || e.naturalWidth || e.width, e.videoHeight || e.naturalHeight || e.height];
  function coverEl(c, e, W, H, z, px) { const [w, h] = elSize(e); if (!w || !h) return; const k = Math.max(W / w, H / h) * z; c.drawImage(e, (W - w * k) / 2 + px, (H - h * k) / 2, w * k, h * k); }
  function sceneBg(c, W, H, p, x, lt, poster, gray) {
    const e = x.s.media && A.media.els.get(x.s.media), t = clamp(lt / x.len); c.save();
    try { c.filter = gray ? 'grayscale(1) brightness(.72)' : A.lookFilter(p.look); } catch (err) {}
    if (e) coverEl(c, e, W, H, 1.03 + t * .08, (x.i % 2 ? 1 : -1) * (t - .5) * W * .02);
    else if (poster) coverEl(c, poster, W, H, 1.03 + t * .08, 0);
    else A.art(p.template, c, W, H, (x.i * .27 + t * .25) % 1);
    c.restore();
  }
  function wrapWords(c, words, maxW) { const L = []; let cur = [], w = 0; const sp = c.measureText(' ').width; words.forEach((t, i) => { const m = c.measureText(t).width; if (cur.length && w + sp + m > maxW) { L.push({ items: cur, w }); cur = []; w = 0; } cur.push({ t, i, m }); w += (cur.length > 1 ? sp : 0) + m; }); if (cur.length) L.push({ items: cur, w }); return { L, sp }; }

  function caption(c, W, H, p, text, lt, len, hi) {
    const preset = p.cap || 'pop', u = Math.min(W, H) / 100, fg = p.textColor || '#FFFFFF', raw = String(text || '').trim().split(/\s+/).filter(Boolean); if (!raw.length) return;
    const span = len * .86, per = span / raw.length, at = Math.min(raw.length - 1, Math.floor(clamp((lt - .06) / span) * raw.length)), wordT = clamp((lt - .06 - at * per) / per), upper = !['clean', 'type'].includes(preset);
    let words = raw.map((w) => upper ? w.toUpperCase() : w), active = at, shown = raw.length;
    if (preset === 'stack') { const size = 2, start = Math.floor(at / size) * size; words = words.slice(start, start + size); active = at - start; shown = words.length; }
    const fam = preset === 'clean' || preset === 'type' ? 'Inter, Arial, sans-serif' : A.fontFam(p.font), weight = preset === 'clean' || preset === 'type' ? 800 : 400, maxW = W - u * 14, maxLines = preset === 'stack' ? 2 : 4; let s = preset === 'stack' ? u * 21 : preset === 'clean' ? u * 6.2 : preset === 'type' ? u * 6.8 : u * 11.5, lay;
    const min = u * 4.8; for (; s >= min; s *= .94) { c.font = `${weight} ${s}px ${fam}`; lay = wrapWords(c, words, maxW); if (lay.L.length <= maxLines && lay.L.every((l) => l.w <= maxW)) break; }
    c.font = `${weight} ${Math.max(s, min)}px ${fam}`; s = Math.max(s, min); lay = wrapWords(c, words, maxW); const lh = s * (preset === 'clean' ? 1.3 : 1.2), h = lay.L.length * lh, pos = p.capPos || 'lower', y0 = pos === 'top' ? H * .15 : pos === 'middle' ? (H - h) / 2 : Math.min(H * .72, H - h - u * 15);
    c.save(); c.textBaseline = 'middle'; c.textAlign = 'left'; c.lineJoin = 'round';
    if (preset === 'clean') { const mw = Math.max(...lay.L.map((l) => l.w)); c.globalAlpha = ease(lt / .22); c.fillStyle = 'rgba(0,0,0,.66)'; c.beginPath(); c.roundRect((W - mw) / 2 - u * 3, y0 - u * 1.6, mw + u * 6, h + u * 3.2, u * 1.8); c.fill(); }
    let count = 0, chars = preset === 'type' ? Math.floor(raw.join(' ').length * clamp((lt - .05) / (len * .72))) : 1e9, typed = 0;
    lay.L.forEach((line, li) => {
      let x = (W - line.w) / 2; const y = y0 + li * lh + lh / 2;
      line.items.forEach((it) => {
        const isA = it.i === active, past = it.i <= active, m = it.m; count++;
        if (preset === 'type') { const avail = chars - typed; typed += it.t.length + 1; if (avail > 0) { const vis = it.t.slice(0, avail); c.lineWidth = u * .9; c.strokeStyle = 'rgba(0,0,0,.85)'; c.strokeText(vis, x, y); c.fillStyle = fg; c.fillText(vis, x, y); if (avail <= it.t.length) { c.fillStyle = hi; c.fillRect(x + c.measureText(vis).width + u * .4, y - s * .45, u * .7, s * .9); } } }
        else if (preset === 'pop' || preset === 'stack') {
          if (past) { const k = isA ? 1 + (1 - ease(wordT * 2.4)) * .14 : 1; c.save(); c.translate(x + m / 2, y); c.scale(k, k); if (isA) { c.fillStyle = hi; c.beginPath(); c.roundRect(-m / 2 - u * 1.2, -s * .58, m + u * 2.4, s * 1.16, u * 1.2); c.fill(); c.fillStyle = A.onColor(hi); c.fillText(it.t, -m / 2, s * .02); } else { c.lineWidth = u * 1.25; c.strokeStyle = 'rgba(0,0,0,.92)'; c.strokeText(it.t, -m / 2, s * .02); c.fillStyle = fg; c.fillText(it.t, -m / 2, s * .02); } c.restore(); }
        } else if (preset === 'karaoke') { c.lineWidth = u * 1.25; c.strokeStyle = 'rgba(0,0,0,.92)'; c.strokeText(it.t, x, y); c.fillStyle = past ? hi : fg; c.fillText(it.t, x, y); }
        else if (preset === 'neon') { if (past) { c.save(); c.shadowColor = hi; c.shadowBlur = u * 3.5; c.fillStyle = isA ? '#FFFFFF' : fg; c.fillText(it.t, x, y); c.fillText(it.t, x, y); c.restore(); } }
        else { c.fillStyle = fg; c.globalAlpha = ease(lt / .22); c.fillText(it.t, x, y); }
        x += m + lay.sp;
      });
    });
    c.restore();
  }

  function endCard(c, W, H, p, u, hi, a) {
    c.save(); c.globalAlpha = a; const g = c.createLinearGradient(0, H * .5, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.72)'); c.fillStyle = g; c.fillRect(0, 0, W, H); A.setHead(p.font);
    const y = H * .82; if (p.detail) { c.font = `700 ${u * 3.8}px Inter, Arial`; c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText(p.detail, W / 2, y - u * 2); }
    if (p.cta) A.drawButton(c, p.cta, W / 2, y, u * 1.15, 'center', hi); c.restore();
  }
  function draw(c, W, H, p, poster, sec) {
    A.setHead(p.font); const tl = A.content.timeline(p), s = Math.min(p.duration - .001, Math.max(0, sec)), cur = tl.find((x) => s < x.start + x.len) || tl[tl.length - 1], lt = s - cur.start, u = Math.min(W, H) / 100, T = A.tpl(p.template), hi = p.accent || T.accent, prev = tl[cur.i - 1], tr = p.trans || 'cut', TD = .3, q = clamp(lt / TD), inTr = prev && lt < TD && tr !== 'cut', title = cur.s.title;
    c.save(); c.clearRect(0, 0, W, H); const shake = ['hook', 'pov'].includes(p.style) ? [Math.sin(s * 3.1) * u * .28, Math.cos(s * 2.3) * u * .22] : [0, 0]; c.translate(shake[0], shake[1]);
    const ba = p.style === 'beforeafter' && title === 'After', bb = p.style === 'beforeafter' && title === 'Before';
    if (ba && prev) { sceneBg(c, W, H, p, prev, lt + prev.len, poster, !(prev.s.media)); const wipe = W * ease(lt / (cur.len * .55)); c.save(); c.beginPath(); c.rect(0, 0, wipe, H); c.clip(); sceneBg(c, W, H, p, cur, lt, poster); c.restore(); c.fillStyle = '#fff'; c.fillRect(wipe - u * .35, 0, u * .7, H); }
    else if (inTr && tr === 'whip') { const e = ease(q); c.save(); try { c.filter = `blur(${(1 - q) * u * 1.6}px)`; } catch (x) {} c.translate(-e * W, 0); sceneBg(c, W, H, p, prev, prev.len, poster); c.translate(W, 0); sceneBg(c, W, H, p, cur, lt, poster); c.restore(); }
    else if (inTr && tr === 'zoom') { const k = 1 + (1 - ease(q)) * .35; c.save(); c.translate(W / 2, H / 2); c.scale(k, k); c.translate(-W / 2, -H / 2); sceneBg(c, W, H, p, cur, lt, poster); c.restore(); }
    else if (inTr && tr === 'fade') { sceneBg(c, W, H, p, prev, prev.len, poster); c.save(); c.globalAlpha = q; sceneBg(c, W, H, p, cur, lt, poster); c.restore(); }
    else { sceneBg(c, W, H, p, cur, lt, poster, bb && !cur.s.media); if (inTr && tr === 'glitch') { const n = 7; for (let i = 0; i < n; i++) { const y = H * i / n, off = Math.sin(i * 91 + s * 40) * W * .07 * (1 - q); c.drawImage(c.canvas, 0, y * c.canvas.height / H, c.canvas.width, c.canvas.height / n, off, y, W, H / n); } c.fillStyle = `rgba(0,240,255,${.16 * (1 - q)})`; c.fillRect(0, 0, W, H); } }
    c.restore(); c.save();
    if (p.look === 'cinema') { c.fillStyle = 'rgba(0,70,90,.12)'; c.fillRect(0, 0, W, H); }
    if (p.look === 'film' || p.look === 'cinema') { c.save(); c.translate(Math.floor(s * 24) * 17 % 128, Math.floor(s * 24) * 29 % 128); c.fillStyle = noise(c); c.fillRect(-128, -128, W + 256, H + 256); c.restore(); }
    const g = c.createLinearGradient(0, H * .4, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.58)'); c.fillStyle = g; c.fillRect(0, 0, W, H); const gt = c.createLinearGradient(0, 0, 0, H * .2); gt.addColorStop(0, 'rgba(0,0,0,.42)'); gt.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gt; c.fillRect(0, 0, W, H * .2);
    const label = (t, x, y, color) => { c.font = `800 ${u * 5.4}px Inter, Arial`; const w = c.measureText(t).width; c.fillStyle = color; c.beginPath(); c.roundRect(x, y, w + u * 5, u * 9, u * 1.6); c.fill(); c.fillStyle = A.onColor(color); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(t, x + u * 2.5, y + u * 4.7); };
    const top = u * 12;
    if (p.style === 'top3' && /^Reason/.test(title)) { const n = title.slice(-1); c.font = `400 ${u * 34}px ${A.fontFam(p.font)}`; c.textAlign = 'left'; c.textBaseline = 'top'; c.lineWidth = u * 1.2; c.strokeStyle = 'rgba(0,0,0,.7)'; c.strokeText(n, u * 7, top); c.fillStyle = hi; c.fillText(n, u * 7, top); }
    if (bb) label('BEFORE', u * 6, top, '#FFFFFF'); if (ba) label('AFTER', u * 6, top, hi);
    if (p.style === 'review' && title === 'Quote') { c.font = `400 ${u * 30}px "Lora Bold", Georgia, serif`; c.fillStyle = hi; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText('“', u * 6, H * .48); }
    if (!bb) { const isEnd = cur.i === tl.length - 1; if (isEnd) endCard(c, W, H, p, u, hi, ease(lt / .35)); caption(c, W, H, isEnd ? { ...p, capPos: 'middle' } : p, cur.s.text, lt, cur.len, hi); }
    if (p.brand && !p.logo) { c.font = `800 ${u * 3}px Inter, Arial`; c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText(p.brand.toUpperCase(), W / 2, u * 5.5); }
    if (p.progress !== false) { c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(0, 0, W, u * .8); c.fillStyle = hi; c.fillRect(0, 0, W * (s / p.duration), u * .8); }
    if (p.voice && p.voiceAI) { c.font = `600 ${u * 2.3}px Inter, Arial`; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillStyle = 'rgba(0,0,0,.5)'; const t = 'AI-generated voice', w = c.measureText(t).width; c.beginPath(); c.roundRect(u * 3, u * 3, w + u * 3, u * 4.2, u); c.fill(); c.fillStyle = '#fff'; c.fillText(t, u * 4.5, u * 3.9); }
    A.drawLogo(c, W, H, p, u); A.drawMark(c, W, H, u); c.restore();
  }
})();
