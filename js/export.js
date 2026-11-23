/* PNG, ZIP and video export, plus sharing to installed social apps. */
(function () {
  const slug = (s) => (s || 'creatagious').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'creatagious';
  const blobOf = (c, type = 'image/png', q) => new Promise((res) => c.toBlob(res, type, q));
  const save = A.saveBlob = (blob, name) => { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 30000); };
  async function canvasFor(p, f) { const c = document.createElement('canvas'); c.width = f.w; c.height = f.h; const im = await A.loadImage(p.photo); await A.fontsReady(); await A.content.prepare(p); A.drawAd(c.getContext('2d'), f.w, f.h, p, im); return c; }

  async function slideCanvas(p, f, i) { const c = document.createElement('canvas'); c.width = f.w; c.height = f.h; const im = await A.loadImage(p.photo); await A.fontsReady(); await A.content.prepare(p); A.drawSlide(c.getContext('2d'), f.w, f.h, p, im, i); return c; }

  /* Minimal ZIP writer (stored entries: PNGs are already compressed). */
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (u) => { let c = -1; for (let i = 0; i < u.length; i++) c = crcT[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  function zip(files) {
    const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
    files.forEach((f) => {
      const n = enc.encode(f.name), C = crc(f.data), L = f.data.length, h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint32(14, C, true); h.setUint32(18, L, true); h.setUint32(22, L, true); h.setUint16(26, n.length, true);
      parts.push(new Uint8Array(h.buffer), n, f.data);
      const d = new DataView(new ArrayBuffer(46)); d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x800, true); d.setUint32(16, C, true); d.setUint32(20, L, true); d.setUint32(24, L, true); d.setUint16(28, n.length, true); d.setUint32(42, off, true);
      cen.push(new Uint8Array(d.buffer), n); off += 30 + n.length + L;
    });
    const size = cen.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...cen, new Uint8Array(e.buffer)], { type: 'application/zip' });
  }

  const MOOD = { upbeat: [112, [[220, 277.2, 329.6], [174.6, 220, 261.6], [130.8, 196, 261.6], [196, 246.9, 293.7]], 'triangle', 1], lofi: [78, [[146.8, 174.6, 220], [130.8, 164.8, 196], [116.5, 146.8, 174.6], [110, 130.8, 164.8]], 'sine', 2], cinema: [64, [[110, 164.8, 220], [87.3, 130.8, 174.6], [130.8, 196, 261.6], [98, 146.8, 196]], 'sawtooth', 4], hype: [140, [[110, 130.8, 164.8], [110, 130.8, 164.8], [87.3, 110, 130.8], [98, 123.5, 146.8]], 'square', 1] };
  function music(ac, dest, secs, mood, level) {
    const M = MOOD[mood] || MOOD.upbeat, t0 = ac.currentTime + .05, peak = level || .34, master = ac.createGain(); master.gain.setValueAtTime(.0001, t0); master.gain.exponentialRampToValueAtTime(peak, t0 + .4); master.gain.setValueAtTime(peak, t0 + Math.max(.5, secs - 1)); master.gain.exponentialRampToValueAtTime(.0001, t0 + secs); master.connect(dest);
    const beat = 60 / M[0];
    for (let b = 0, n = Math.ceil(secs / beat); b < n; b++) {
      const at = t0 + b * beat; if (b % M[3] === 0) { const k = ac.createOscillator(), g = ac.createGain(); k.frequency.setValueAtTime(130, at); k.frequency.exponentialRampToValueAtTime(42, at + .13); g.gain.setValueAtTime(.8, at); g.gain.exponentialRampToValueAtTime(.001, at + .2); k.connect(g).connect(master); k.start(at); k.stop(at + .22); }
      if (b % 4 === 0) M[1][(b / 4) % 4].forEach((fr) => { const o = ac.createOscillator(), v = ac.createGain(); o.type = M[2]; o.frequency.value = fr; v.gain.setValueAtTime(.0001, at); v.gain.exponentialRampToValueAtTime(M[2] === 'triangle' || M[2] === 'sine' ? .09 : .025, at + .08); v.gain.exponentialRampToValueAtTime(.0001, at + beat * 4); o.connect(v).connect(master); o.start(at); o.stop(at + beat * 4); });
    }
  }
  const bestType = () => ['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));

  A.exporter = {
    slug, save,
    async png(p, formatId) { const f = A.fmt(formatId || p.format), b = await blobOf(await canvasFor(p, f)); return { blob: b, name: `${slug(p.name)}-${f.ratio.replace(':', 'x')}.png` }; },
    async zipAll(p, onP) {
      const files = []; for (let i = 0; i < A.FORMATS.length; i++) { const f = A.FORMATS[i], r = await A.exporter.png(p, f.id); files.push({ name: r.name, data: new Uint8Array(await r.blob.arrayBuffer()) }); onP && onP((i + 1) / A.FORMATS.length); }
      return { blob: zip(files), name: slug(p.name) + '-campaign.zip' };
    },
    async slidePngs(p, onP) { const f = A.fmt(p.format), out = []; for (let i = 0; i < p.slides.length; i++) { out.push({ blob: await blobOf(await slideCanvas(p, f, i)), name: `${slug(p.name)}-${String(i + 1).padStart(2, '0')}.png` }); onP && onP((i + 1) / p.slides.length); } return out; },
    async slidesZip(p) { const files = []; for (const r of await A.exporter.slidePngs(p)) files.push({ name: r.name, data: new Uint8Array(await r.blob.arrayBuffer()) }); return { blob: zip(files), name: slug(p.name) + '-carousel.zip' }; },
    async packZip(pack) {
      const files = [], enc = new TextEncoder(); let notes = `${pack.name}\n`;
      for (const it of pack.items) { const p = A.store.get(it.project); if (!p) continue; notes += `\n${it.name}\n${A.capWithLink(p)}\n`; const dir = slug(it.name) + '/'; if (p.type === 'carousel') for (const r of await A.exporter.slidePngs(p)) files.push({ name: dir + r.name, data: new Uint8Array(await r.blob.arrayBuffer()) }); else if (!A.isVideo(p)) { const r = await A.exporter.png(p); files.push({ name: dir + r.name, data: new Uint8Array(await r.blob.arrayBuffer()) }); } else notes += '(Export this video from its editor.)\n'; }
      files.push({ name: 'captions.txt', data: enc.encode(notes) }); return { blob: zip(files), name: slug(pack.name) + '-pack.zip' };
    },
    async shareFiles(list, p) { const files = list.map((r) => new File([r.blob], r.name, { type: r.blob.type })); if (navigator.canShare && navigator.canShare({ files })) { try { await navigator.share({ files, text: A.capWithLink(p) }); } catch (e) { if (e.name === 'AbortError') return false; throw e; } p.exports = (p.exports || 0) + 1; A.store.upsert(p); A.store.log('export', { type: p.type, format: p.format, mode: 'share', project: p.id }); return true; } return null; },
    canVideo: () => !!(bestType() && HTMLCanvasElement.prototype.captureStream),
    video(p, onP) {
      return new Promise(async (res, rej) => {
        const type = bestType(); if (!type || !HTMLCanvasElement.prototype.captureStream) return rej(new Error('This browser cannot record video. Try Chrome.'));
        const f = A.fmt(p.format), hd = p.res === '1080' && A.plan.premium(), W = hd ? f.w : f.v[0], H = hd ? f.h : f.v[1], c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), im = await A.loadImage(p.photo); await A.fontsReady(); await A.content.prepare(p); A.content._s = -1; A.content.sync(p, 0, true); A.drawFrame(x, W, H, p, im, 0);
        const stream = c.captureStream(30); let ac = null;
        const voice = p.voice && await A.media.blob(p.voice), mood = p.mood || 'upbeat', wantMusic = p.music !== false && mood !== 'none';
        if (wantMusic || voice) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); await ac.resume(); const d = ac.createMediaStreamDestination(); if (wantMusic) music(ac, d, p.duration, mood, voice ? .1 : .34); if (voice) { try { const b = await ac.decodeAudioData(await voice.arrayBuffer()), n = ac.createBufferSource(); n.buffer = b; n.connect(d); n.start(ac.currentTime + .05); } catch (e) { A.toast('The voiceover could not be added to this export.'); } } d.stream.getAudioTracks().forEach((t) => stream.addTrack(t)); } catch (e) { ac = null; } }
        const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: hd ? 12e6 : 6e6, audioBitsPerSecond: 128e3 }), chunks = [];
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onerror = (e) => rej(e.error || new Error('Recording failed.'));
        rec.onstop = () => { A.content.stop(p); stream.getTracks().forEach((t) => t.stop()); ac && ac.close(); const base = type.split(';')[0]; res({ blob: new Blob(chunks, { type: base }), name: `${slug(p.name)}-${f.ratio.replace(':', 'x').replace('.', '_')}.${base.includes('mp4') ? 'mp4' : 'webm'}` }); };
        rec.start(250); const t0 = performance.now(); let last = 0;
        /* A timer keeps frames coming if the browser throttles animation frames. */
        const tick = () => { const s = (performance.now() - t0) / 1000; if (s >= p.duration) { clearInterval(iv); A.drawFrame(x, W, H, p, im, p.duration - .001); setTimeout(() => rec.stop(), 120); return; } A.content.sync(p, s, true); A.drawFrame(x, W, H, p, im, s); if (s - last > .2) { last = s; onP && onP(s / p.duration); } };
        const iv = setInterval(tick, 1000 / 30);
      });
    },
    async deliver(file, mode, p) {
      const f = new File([file.blob], file.name, { type: file.blob.type });
      if (mode === 'share' && navigator.canShare && navigator.canShare({ files: [f] })) {
        try { await navigator.share({ files: [f], text: A.capWithLink(p) }); } catch (e) { if (e.name === 'AbortError') return false; throw e; }
      } else { save(file.blob, file.name); if (mode === 'share') A.toast('Saved. Sharing files is not available in this browser.'); }
      p.exports = (p.exports || 0) + 1; A.store.upsert(p); A.store.log('export', { type: p.type, format: p.format, mode, project: p.id });
      return true;
    }
  };
})();
