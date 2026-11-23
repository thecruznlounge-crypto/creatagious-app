/* Ad and video frame rendering on canvas. */
(function () {
  A.FORMATS = [
    { id: 'square', name: 'Square', ratio: '1:1', w: 1080, h: 1080, v: [720, 720], use: 'Feed posts' },
    { id: 'feed', name: 'Portrait', ratio: '4:5', w: 1080, h: 1350, v: [720, 900], use: 'Instagram, Facebook' },
    { id: 'story', name: 'Story', ratio: '9:16', w: 1080, h: 1920, v: [720, 1280], use: 'Reels, TikTok, Shorts' },
    { id: 'pin', name: 'Pin', ratio: '2:3', w: 1000, h: 1500, v: [720, 1080], use: 'Pinterest' },
    { id: 'wide', name: 'Link', ratio: '1.91:1', w: 1200, h: 628, v: [1280, 670], use: 'Facebook, LinkedIn, X' },
    { id: 'hd', name: 'Landscape', ratio: '16:9', w: 1920, h: 1080, v: [1280, 720], use: 'YouTube' }
  ];
  A.fmt = (id) => A.FORMATS.find((f) => f.id === id) || A.FORMATS[0];
  const images = new Map();
  A.loadImage = (src) => {
    if (!src) return Promise.resolve(null);
    if (images.has(src)) return images.get(src);
    const p = new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    images.set(src, p); return p;
  };
  A.fontsReady = () => Promise.all(['400 40px Anton', '400 40px "Archivo Black"', '400 40px "Montserrat Black"', '400 40px "Poppins Bold"', '400 40px "Lora Bold"', '400 40px "Comic Relief Bold"', '700 40px Inter', '600 40px Inter', '800 40px Inter'].map((f) => document.fonts.load(f, 'AB'))).catch(() => {});

  function lines(c, text, maxW) {
    const out = []; let cur = '';
    String(text).split(/\s+/).filter(Boolean).forEach((w) => { const n = cur ? cur + ' ' + w : w; if (c.measureText(n).width <= maxW || !cur) cur = n; else { out.push(cur); cur = w; } });
    if (cur) out.push(cur); return out;
  }
  function fit(c, text, font, maxW, maxH, start, min, lh) {
    let s = start, L;
    for (; s >= min; s *= 0.94) { c.font = font(s); L = lines(c, text, maxW); if (L.length * s * lh <= maxH && L.every((l) => c.measureText(l).width <= maxW)) break; }
    s = Math.max(s, min); c.font = font(s); L = lines(c, text, maxW);
    return { size: s, lines: L, h: L.length * s * lh, lh: s * lh };
  }
  A.FONTS = [['anton', 'Impact', 'Anton'], ['archivo', 'Heavy', '"Archivo Black"'], ['mont', 'Modern', '"Montserrat Black"'], ['poppins', 'Clean', '"Poppins Bold"'], ['lora', 'Editorial', '"Lora Bold"'], ['comic', 'Casual', '"Comic Relief Bold"']];
  A.fontFam = (id) => ((A.FONTS.find((f) => f[0] === id) || A.FONTS[0])[2]) + ', Impact, "Arial Narrow", sans-serif';
  A.LOOKS = [['natural', 'Natural', 'none'], ['cinema', 'Cinematic', 'contrast(1.13) saturate(.88) sepia(.12)'], ['film', 'Warm film', 'sepia(.24) contrast(1.05) saturate(1.12) brightness(1.02)'], ['vivid', 'Vivid', 'saturate(1.36) contrast(1.08)'], ['soft', 'Soft glow', 'brightness(1.08) saturate(1.1) contrast(.93)'], ['mono', 'Mono', 'grayscale(1) contrast(1.16)']];
  A.lookFilter = (id) => (A.LOOKS.find((l) => l[0] === id) || A.LOOKS[0])[2];
  let headFam = A.fontFam('anton');
  const HEAD = (s) => `400 ${s}px ${headFam}`;
  const BODY = (w) => (s) => `${w} ${s}px Inter, Arial, sans-serif`;
  function cover(c, im, W, H, zoom = 1, panX = 0) { const iw = im.videoWidth || im.width, ih = im.videoHeight || im.height, k = Math.max(W / iw, H / ih) * zoom, w = iw * k, h = ih * k; c.drawImage(im, (W - w) / 2 + panX * W, (H - h) / 2, w, h); }
  function drawText(c, F, x, y, align) { c.textAlign = align; c.textBaseline = 'top'; F.lines.forEach((l, i) => c.fillText(l, x, y + i * F.lh)); }
  const luma = (h) => { const n = parseInt(h.slice(1), 16); return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; };
  const onColor = (h) => luma(h) > 0.55 ? '#101114' : '#FFFFFF';
  function button(c, text, x, y, u, align, accent) {
    c.font = BODY(700)(u * 3.4); const tw = c.measureText(text).width, w = tw + u * 6, h = u * 7.4, left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    c.fillStyle = accent; c.beginPath(); c.roundRect(left, y, w, h, h / 2); c.fill(); c.fillStyle = onColor(accent); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, left + w / 2, y + h * 0.53); return h;
  }
  function bg(c, W, H, p, t, im, scene) {
    c.save(); try { c.filter = A.lookFilter(p.look); } catch (e) {}
    if (im) cover(c, im, W, H, 1.02 + t * 0.09, (scene % 2 ? 1 : -1) * (t - .5) * .025); else A.art(p.template, c, W, H, t);
    c.restore();
  }
  function brandMark(c, p, x, y, u, color, align) {
    if (!p.brand) return; c.font = BODY(700)(u * 3); c.fillStyle = color; c.textAlign = align; c.textBaseline = 'top'; c.fillText(p.brand.toUpperCase(), x, y);
  }

  A.drawAd = function (c, W, H, p, im, opt = {}) {
    headFam = A.fontFam(p.font); const T = A.tpl(p.template), accent = p.accent || T.accent, t = opt.t || 0, u = Math.min(W, H) / 100, m = u * 7, land = W / H > 1.25, layout = T.layout;
    c.save(); c.clearRect(0, 0, W, H); bg(c, W, H, p, t, im, 0);
    const head = String(p.headline || '').toUpperCase(), sub = p.sub || '', cta = p.cta || '';
    const block = (x, top, w, avail, align, fg) => {
      const subH = sub ? u * 11 : 0, ctaH = cta ? u * 11 : 0, H1 = fit(c, head, HEAD, w, Math.max(u * 12, avail - subH - ctaH), land ? u * 19 : u * 16.5, u * 6, 1.08);
      c.font = BODY(500)(u * 3.7); const SL = sub ? fit(c, sub, BODY(500), w, u * 10, u * 3.8, u * 2.7, 1.28) : { h: 0 };
      const tot = H1.h + (sub ? SL.h + u * 2 : 0) + (cta ? u * 10 : 0); let y = top + Math.max(0, avail - tot);
      c.fillStyle = fg; c.font = HEAD(H1.size); drawText(c, H1, x, y, align); y += H1.h + u * 2;
      if (sub) { c.font = BODY(500)(SL.size); c.fillStyle = fg; drawText(c, SL, x, y, align); y += SL.h + u * 2.6; }
      if (cta) button(c, cta, x, y, u, align, accent);
    };
    if (layout === 'split') {
      const pw = land ? W * .46 : W, ph = land ? H : H * .44, x = land ? 0 : 0, y = land ? 0 : H - ph, dark = T.dark;
      c.fillStyle = dark ? '#14161B' : '#FFF8F4'; c.fillRect(x, y, pw, ph); c.fillStyle = accent; if (land) c.fillRect(pw, 0, u * 1.2, H); else c.fillRect(0, y - u * 1.2, W, u * 1.2);
      brandMark(c, p, m, y + u * 5, u, dark ? accent : '#14161B', 'left');
      block(m, y + u * 10, pw - m * 2, ph - u * 15, 'left', dark ? '#fff' : '#14161B');
    } else if (layout === 'center') {
      c.fillStyle = 'rgba(5,3,14,.34)'; c.fillRect(0, 0, W, H); const v = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) * .55); v.addColorStop(0, 'rgba(0,0,0,.34)'); v.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
      brandMark(c, p, W / 2, m, u, '#fff', 'center');
      const av = land ? H - m * 3 : Math.min(H * .62, W * 1.05); block(W / 2, (H - av) / 2 + u * 2, W - m * 2, av, 'center', '#fff');
    } else if (layout === 'badge') {
      const bw = land ? W * .46 : W * .84, bh = land ? H * .68 : Math.min(W * .58, H * .4), cx = land ? W * .3 : W / 2, cy = land ? H * .42 : H * .36;
      c.save(); c.translate(cx, cy); c.rotate(-.075); c.shadowColor = 'rgba(0,0,0,.32)'; c.shadowBlur = u * 3; c.shadowOffsetY = u; c.fillStyle = '#FFF'; c.beginPath(); c.moveTo(-bw / 2 + bh * .24, -bh / 2); c.lineTo(bw / 2, -bh / 2); c.lineTo(bw / 2, bh / 2); c.lineTo(-bw / 2 + bh * .24, bh / 2); c.lineTo(-bw / 2, 0); c.closePath(); c.fill(); c.shadowColor = 'transparent';
      c.fillStyle = '#C8141F'; c.beginPath(); c.arc(-bw / 2 + bh * .2, 0, u * 2, 0, 6.3); c.fill();
      const F = fit(c, head, HEAD, bw - bh * .42 - u * 5, bh - u * 7, u * 18, u * 6, 1.08); c.fillStyle = '#C8141F'; c.font = HEAD(F.size); drawText(c, F, bh * .13, -F.h / 2, 'center'); c.restore();
      const x = land ? W * .62 : W / 2, align = land ? 'left' : 'center', y = land ? H * .3 : cy + bh * .66, w = land ? W * .32 : W - m * 2;
      brandMark(c, p, x, land ? m : m, u, '#fff', land ? 'left' : 'center');
      const S = fit(c, sub, BODY(600), w, u * 16, u * 4.3, u * 2.8, 1.28); const pw = w + u * 5, px = align === 'center' ? x - pw / 2 : x - u * 2.5; c.fillStyle = 'rgba(92,6,18,.82)'; c.beginPath(); c.roundRect(px, y - u * 2, pw, S.h + u * 4 + (cta ? u * 10 : 0), u * 2); c.fill(); c.fillStyle = '#fff'; c.font = BODY(600)(S.size); drawText(c, S, x, y, align); if (cta) button(c, cta, x, y + S.h + u * 3, u, align, accent);
    } else {
      if (land) { const g = c.createLinearGradient(0, 0, W * .72, 0); g.addColorStop(0, 'rgba(0,0,0,.84)'); g.addColorStop(.62, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
      else { const g = c.createLinearGradient(0, H * .36, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.42, 'rgba(0,0,0,.72)'); g.addColorStop(1, 'rgba(0,0,0,.92)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
      if (p.brand) { c.font = BODY(700)(u * 3); const tw = c.measureText(p.brand.toUpperCase()).width; c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.roundRect(m - u * 2, m - u * 1.4, tw + u * 4, u * 6, u * 3); c.fill(); brandMark(c, p, m, m, u, '#fff', 'left'); }
      if (land) block(m, m * 1.8, W * .5, H - m * 2.8, 'left', '#fff');
      else { const top = H * (W / H > .9 ? .47 : .52); block(m, top, W - m * 2, H - top - m, 'left', '#fff'); }
    }
    A.drawLogo(c, W, H, p, u); A.drawMark(c, W, H, u);
    c.restore();
  };

  A.drawLogo = (c, W, H, p, u) => { const l = p.logo && A.media.els.get(p.logo); if (!l) return; const h = u * 10, w = Math.min(u * 30, h * (l.width / l.height)), hh = w * (l.height / l.width), x = W - w - u * 5, y = u * 5; c.fillStyle = 'rgba(255,255,255,.92)'; c.beginPath(); c.roundRect(x - u, y - u, w + u * 2, hh + u * 2, u * 1.4); c.fill(); c.drawImage(l, x, y, w, hh); };
  A.drawMark = (c, W, H, u) => { if (A.plan.premium()) return; c.save(); c.font = BODY(600)(u * 2.5); c.textAlign = 'right'; c.textBaseline = 'bottom'; const t = 'Made with Creatagious', w = c.measureText(t).width; c.fillStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.roundRect(W - w - u * 3.5, H - u * 5.2, w + u * 2.6, u * 4, u); c.fill(); c.fillStyle = '#fff'; c.fillText(t, W - u * 2.2, H - u * 1.8); c.restore(); };
  Object.assign(A, { lines, fit, cover, onColor, drawButton: button, setHead: (id) => { headFam = A.fontFam(id); }, HEAD_FONT: HEAD });
  const ease = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
  A.drawFrame = function (c, W, H, p, im, sec) {
    if (p.style && p.style !== 'classic') return A.content.draw(c, W, H, p, im, sec);
    headFam = A.fontFam(p.font);
    const list = p.scenes.length ? p.scenes : [{ text: p.headline }], D = p.duration, each = D / list.length, i = Math.min(list.length - 1, Math.floor(sec / each)), lt = (sec - i * each) / each, T = A.tpl(p.template), accent = p.accent || T.accent, u = Math.min(W, H) / 100, m = u * 7, last = i === list.length - 1;
    const me = list[i].media && A.media.els.get(list[i].media); c.save(); bg(c, W, H, p, (i * .27 + lt * .25) % 1, me || im, i);
    const g = c.createLinearGradient(0, H * .28, 0, H); g.addColorStop(0, 'rgba(0,0,0,.08)'); g.addColorStop(.55, 'rgba(0,0,0,.66)'); g.addColorStop(1, 'rgba(0,0,0,.9)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    const inn = ease(lt * each / .45), out = i < list.length - 1 ? 1 - ease((lt * each - each + .22) / .22) : 1, a = inn * out; c.globalAlpha = a;
    const avail = H * (W > H ? .52 : .3), base = H - m * 1.3 - (last ? u * 12 : 0), F = fit(c, String(list[i].text || '').toUpperCase(), HEAD, W - m * 2, avail, W > H ? u * 15 : u * 15.5, u * 6, 1.08), y = base - F.h + (1 - inn) * u * 8;
    c.fillStyle = '#fff'; c.font = HEAD(F.size); drawText(c, F, W / 2, y, 'center');
    if (last && p.cta && p.cta !== list[i].text) button(c, p.cta, W / 2, base + u * 3, u, 'center', accent);
    else if (last && (p.brand || p.detail)) { c.font = BODY(600)(u * 3.9); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText(p.detail || p.brand, W / 2, base + u * 3); }
    if (p.detail && !last) { c.font = BODY(600)(u * 3.9); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText(p.detail, W / 2, y - u * 2); }
    c.globalAlpha = 1; if (p.brand) brandMark(c, p, W / 2, m * .9, u, '#fff', 'center'); A.drawLogo(c, W, H, p, u); A.drawMark(c, W, H, u);
    c.restore();
  };
  A.isVideo = (p) => p.type === 'video' || p.type === 'promo';
  A.typeLabel = { image: 'Image Ad', video: 'Video Clip', campaign: 'Ad Campaign', promo: 'Promo Clip' };
  A.metaLine = (p) => { if (p.type === 'pack') return `Pack • ${p.items.length} posts`; if (p.type === 'carousel') return `Carousel • ${p.slides.length} slides`; if (A.isVideo(p)) return `Video • 00:${String(p.duration).padStart(2, '0')}`; if (p.type === 'campaign') return `Ads • ${A.FORMATS.length} sizes`; return `Ad • ${A.fmt(p.format).ratio}`; };
  A.renderThumb = async (p) => {
    const f = A.fmt(p.format), k = 480 / Math.max(f.w, f.h), c = document.createElement('canvas'); c.width = Math.round(f.w * k); c.height = Math.round(f.h * k);
    const x = c.getContext('2d'), im = await A.loadImage(p.photo); await A.fontsReady(); await A.content.prepare(p);
    if (p.type === 'carousel') A.drawSlide(x, c.width, c.height, p, im, 0); else if (A.isVideo(p)) A.drawFrame(x, c.width, c.height, p, im, Math.min(.8, p.duration / p.scenes.length * .4)); else A.drawAd(x, c.width, c.height, p, im);
    return c.toDataURL('image/jpeg', .78);
  };
})();
