/* Vector backgrounds drawn on the device, sharp at every ad size. t runs 0..1 for video motion. */
(function () {
  const TAU = Math.PI * 2;
  const lin = (c, x0, y0, x1, y1, st) => { const g = c.createLinearGradient(x0, y0, x1, y1); st.forEach((s, i) => g.addColorStop(s[1] ?? i / (st.length - 1), s[0])); return g; };
  const rad = (c, x, y, r, st) => { const g = c.createRadialGradient(x, y, 0, x, y, r); st.forEach((s, i) => g.addColorStop(i / (st.length - 1), s)); return g; };
  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
  const rnd = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const focus = (W, H) => ({ x: W / H > 1.25 ? W * 0.72 : W / 2, y: W / H > 1.25 ? H * 0.5 : H * (W / H > .9 ? 0.25 : 0.29), s: W / H > 1.25 ? H * 0.72 : Math.min(W * 0.66, H * (W / H > .9 ? 0.4 : 0.36)) });

  const art = {
    food(c, W, H, t) {
      const f = focus(W, H), bob = Math.sin(t * TAU) * f.s * 0.012, R = rnd(7);
      c.fillStyle = lin(c, 0, 0, W, H, [['#3A1205'], ['#7A2B08'], ['#1B0803']]); c.fillRect(0, 0, W, H);
      for (let i = 0; i < 26; i++) { const x = R() * W, y = R() * H * 0.7, r = (R() * 0.05 + 0.012) * Math.max(W, H); c.fillStyle = rad(c, x, y, r, ['rgba(255,176,70,.34)', 'rgba(255,150,40,0)']); c.fillRect(x - r, y - r, r * 2, r * 2); }
      c.save(); c.translate(f.x, f.y + bob); c.scale(f.s, f.s);
      c.fillStyle = 'rgba(0,0,0,.42)'; c.beginPath(); c.ellipse(0, .44, .62, .08, 0, 0, TAU); c.fill();
      c.fillStyle = lin(c, 0, .27, 0, .42, [['#E89A35'], ['#A95A15']]); rr(c, -.47, .27, .94, .15, [.03, .03, .13, .13]); c.fill();
      c.fillStyle = lin(c, 0, .1, 0, .26, [['#5A2A14'], ['#2E1208']]); rr(c, -.5, .1, 1, .17, .08); c.fill();
      c.fillStyle = '#FFC52D'; c.beginPath(); c.moveTo(-.51, .09); c.lineTo(.51, .09); c.lineTo(.4, .17); c.lineTo(.2, .13); c.lineTo(.03, .24); c.lineTo(-.15, .13); c.lineTo(-.36, .18); c.closePath(); c.fill();
      c.fillStyle = '#D9352B'; rr(c, -.46, .02, .92, .07, .035); c.fill();
      c.fillStyle = '#62B52F'; c.beginPath(); c.moveTo(-.54, .03); for (let i = 0; i <= 12; i++) c.quadraticCurveTo(-.54 + (i + .5) * .09, i % 2 ? -.05 : .07, -.54 + (i + 1) * .09, .01); c.lineTo(.54, -.05); c.lineTo(-.54, -.05); c.closePath(); c.fill();
      c.fillStyle = lin(c, 0, -.42, 0, -.03, [['#F6B24B'], ['#D97F21']]); c.beginPath(); c.moveTo(-.5, -.04); c.bezierCurveTo(-.52, -.32, -.26, -.44, 0, -.44); c.bezierCurveTo(.26, -.44, .52, -.32, .5, -.04); c.closePath(); c.fill();
      c.fillStyle = '#FFF0C9'; const r2 = rnd(31); for (let i = 0; i < 24; i++) { const a = r2() * .9 - .45, b = -.1 - r2() * (.29 - a * a * .55); c.save(); c.translate(a, b); c.rotate(r2() * 3); c.beginPath(); c.ellipse(0, 0, .02, .009, 0, 0, TAU); c.fill(); c.restore(); }
      c.restore();
    },
    event(c, W, H, t) {
      c.fillStyle = lin(c, 0, 0, 0, H, [['#1A0A52'], ['#5A109A', .45], ['#B5179E', .72], ['#12041F']]); c.fillRect(0, 0, W, H);
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) { const x = W * (i + .5) / 7, a = Math.sin(t * TAU + i * 1.3) * .42 + (i - 3) * .09, L = H * 1.15; c.save(); c.translate(x, -H * .03); c.rotate(a); const g = lin(c, 0, 0, 0, L, [[i % 2 ? 'rgba(90,190,255,.5)' : 'rgba(255,80,220,.5)'], ['rgba(255,255,255,0)']]); c.fillStyle = g; c.beginPath(); c.moveTo(-W * .008, 0); c.lineTo(W * .008, 0); c.lineTo(W * .11, L); c.lineTo(-W * .11, L); c.fill(); c.restore(); }
      c.restore();
      const R = rnd(99), y0 = H * .84; c.fillStyle = '#07030F';
      for (let i = 0; i < 24; i++) { const x = W * (i + R() * .6) / 23, s = Math.max(W, H) * (.022 + R() * .012), y = y0 + R() * H * .05; c.beginPath(); c.arc(x, y - s * 2, s, 0, TAU); c.fill(); rr(c, x - s * 1.4, y - s, s * 2.8, H, s * .7); c.fill(); if (i % 2) { const u = Math.sin(t * TAU * 2 + i) * s * .5; c.lineWidth = s * .5; c.strokeStyle = '#07030F'; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + s, y); c.lineTo(x + s * 1.5, y - s * 4.5 + u); c.stroke(); } }
    },
    transport(c, W, H, t) {
      const land = W / H > 1.25, hz = H * (land ? .68 : W / H > .9 ? .36 : .42), s = land ? H * .62 : Math.min(W * .74, H * .3), cx = (land ? W * .68 : W * .52) + Math.sin(t * TAU) * s * .03;
      c.fillStyle = lin(c, 0, 0, 0, hz, [['#1F7BC9'], ['#62BCE8', .6], ['#FFE3B0']]); c.fillRect(0, 0, W, hz);
      c.fillStyle = rad(c, W * .22, hz * .42, s * .6, ['rgba(255,250,215,.95)', 'rgba(255,240,190,0)']); c.fillRect(0, 0, W, hz);
      c.fillStyle = lin(c, 0, hz, 0, H, [['#383B42'], ['#16171B']]); c.fillRect(0, hz, W, H - hz);
      c.fillStyle = '#F9CC0B'; const off = -(t * 8 % 1) * s * .4; for (let x = off - s; x < W + s; x += s * .4) c.fillRect(x, hz + s * (land ? .3 : .16), s * .22, s * .025);
      const palm = (x, b, h, fl) => { c.strokeStyle = '#3A2A1D'; c.lineWidth = h * .035; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, b); c.quadraticCurveTo(x + fl * h * .1, b - h * .5, x + fl * h * .05, b - h); c.stroke(); c.save(); c.translate(x + fl * h * .05, b - h); c.rotate(Math.sin(t * TAU) * .03); c.fillStyle = '#0F6B3C'; for (let i = 0; i < 7; i++) { c.save(); c.rotate(i / 7 * TAU); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(h * .18, -h * .14, h * .36, h * .04); c.quadraticCurveTo(h * .18, -h * .03, 0, 0); c.fill(); c.restore(); } c.restore(); };
      palm(W * .1, hz + 3, s * .95, 1); palm(W * .93, hz + 3, s * 1.1, -1); palm(W * .25, hz + 3, s * .6, -1);
      c.save(); c.translate(cx, hz + s * (land ? .17 : .08)); c.scale(s, s);
      c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(0, .02, .56, .04, 0, 0, TAU); c.fill();
      c.fillStyle = lin(c, 0, -.42, 0, 0, [['#FAFBFC'], ['#C9CED6']]); rr(c, -.54, -.42, 1.08, .4, [.07, .11, .04, .04]); c.fill();
      c.fillStyle = '#20252C'; rr(c, -.5, -.36, .86, .15, .02); c.fill(); rr(c, .39, -.36, .12, .21, [.02, .05, .01, .01]); c.fill();
      c.fillStyle = 'rgba(255,255,255,.2)'; for (let i = 0; i < 6; i++) c.fillRect(-.49 + i * .143, -.36, .012, .15);
      c.fillStyle = '#F9CC0B'; c.fillRect(-.54, -.17, 1.08, .03); c.fillStyle = '#FFEFA1'; c.fillRect(.5, -.1, .04, .03);
      [-.32, .3].forEach((x) => { c.fillStyle = '#111'; c.beginPath(); c.arc(x, -.02, .075, 0, TAU); c.fill(); c.fillStyle = '#B9BEC6'; c.beginPath(); c.arc(x, -.02, .034, 0, TAU); c.fill(); });
      c.restore();
    },
    sale(c, W, H, t) {
      const x = W / 2, y = H * .4, L = Math.hypot(W, H); c.fillStyle = rad(c, x, y, L * .7, ['#F0322B', '#B90F1F', '#5C0612']); c.fillRect(0, 0, W, H);
      c.save(); c.translate(x, y); c.rotate(t * .5); c.fillStyle = 'rgba(255,255,255,.055)'; for (let i = 0; i < 14; i++) { c.rotate(TAU / 14); c.beginPath(); c.moveTo(0, 0); c.lineTo(L, -L * .11); c.lineTo(L, L * .11); c.fill(); } c.restore();
      const R = rnd(4242), col = ['#FFE100', '#fff', '#FF9F1C']; for (let i = 0; i < 46; i++) { const px = R() * W, py = (R() + t * (.3 + R() * .2)) % 1 * H, s = Math.max(W, H) * .009; c.save(); c.translate(px, py); c.rotate(R() * 6 + t * 6); c.fillStyle = col[i % 3]; c.fillRect(-s, -s * .45, s * 2, s * .9); c.restore(); }
    },
    beauty(c, W, H, t) {
      const f = focus(W, H); c.fillStyle = lin(c, 0, 0, W, H, [['#FFE3E8'], ['#F8BBCB', .55], ['#E78FAE']]); c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = f.s * .03; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(f.x, f.y, f.s * (.42 + i * .17 + Math.sin(t * TAU) * .01), 0, TAU); c.stroke(); }
      c.save(); c.translate(f.x, f.y); c.scale(f.s, f.s); c.rotate(.08);
      c.fillStyle = '#FFF7F2'; rr(c, -.18, -.2, .36, .58, .05); c.fill(); c.fillStyle = '#C42D66'; rr(c, -.11, -.4, .22, .21, .025); c.fill(); c.fillStyle = '#E7B24C'; c.fillRect(-.14, -.21, .28, .03); c.fillStyle = '#C42D66'; c.beginPath(); c.arc(0, .1, .085, 0, TAU); c.fill(); c.restore();
    },
    fitness(c, W, H, t) {
      const f = focus(W, H); c.fillStyle = '#101214'; c.fillRect(0, 0, W, H); c.save(); c.translate(W / 2, H / 2); c.rotate(-.5); const L = Math.hypot(W, H), o = (t * .2 % .2) * L; c.fillStyle = '#1E2226'; for (let i = -6; i < 7; i++) c.fillRect(i * L * .2 + o, -L, L * .1, L * 2); c.restore();
      c.save(); c.translate(f.x, f.y); c.rotate(-.24 + Math.sin(t * TAU) * .05); c.scale(f.s, f.s); c.fillStyle = '#C6F135'; c.fillRect(-.42, -.035, .84, .07); c.fillStyle = '#E9EBEE'; [-.5, .41].forEach((x) => { rr(c, x, -.25, .09, .5, .02); c.fill(); }); c.fillStyle = '#C6F135'; [-.61, .52].forEach((x) => { rr(c, x, -.18, .09, .36, .02); c.fill(); }); c.restore();
    },
    realestate(c, W, H, t) {
      const f = focus(W, H), g = f.y + f.s * .42; c.fillStyle = lin(c, 0, 0, 0, H, [['#14243F'], ['#35507A', .42], ['#F0A36B', .72], ['#30323A', .73], ['#17181D']]); c.fillRect(0, 0, W, H);
      c.save(); c.translate(f.x, g); c.scale(f.s, f.s); c.fillStyle = '#10151F'; c.beginPath(); c.moveTo(-.6, 0); c.lineTo(-.6, -.42); c.lineTo(-.28, -.72); c.lineTo(.08, -.42); c.lineTo(.08, -.3); c.lineTo(.6, -.3); c.lineTo(.6, 0); c.fill();
      const on = .72 + Math.sin(t * TAU) * .2; c.fillStyle = `rgba(255,205,110,${on})`; [[-.48, -.36], [-.32, -.36], [-.16, -.36], [.18, -.22], [.36, -.22]].forEach((p) => c.fillRect(p[0], p[1], .11, .13)); c.fillRect(-.33, -.17, .13, .17); c.restore();
    },
    opening(c, W, H, t) {
      c.fillStyle = lin(c, 0, 0, W, H, [['#04544F'], ['#087E73'], ['#032F33']]); c.fillRect(0, 0, W, H); const R = rnd(808), M = Math.max(W, H);
      ['#FFD23F', '#FF6B6B', '#fff', '#4ECDC4', '#FFD23F', '#FF6B6B'].forEach((col, i) => { const x = W * (.08 + i * .17), y = H * (.2 + (R() * .16)) + Math.sin(t * TAU + i) * M * .012, r = M * .05; c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y + r * 1.2); c.lineTo(x + r * .3, y + r * 3.2); c.stroke(); c.fillStyle = col; c.beginPath(); c.ellipse(x, y, r * .85, r * 1.15, 0, 0, TAU); c.fill(); });
      c.fillStyle = '#E2262C'; c.fillRect(0, H * .08, W, H * .028); c.fillRect(0, H * .9, W, H * .028);
    },
    brand(c, W, H, t) {
      c.fillStyle = '#111216'; c.fillRect(0, 0, W, H); const f = focus(W, H), r = f.s * (.76 + Math.sin(t * TAU) * .02);
      c.save(); c.translate(f.x, f.y); c.rotate(t * .25); c.fillStyle = '#18D4E8'; c.beginPath(); c.moveTo(-r * .46, -r * .6); c.lineTo(r * .66, 0); c.lineTo(-r * .46, r * .6); c.closePath(); c.fill(); c.restore();
      c.strokeStyle = 'rgba(24,212,232,.26)'; c.lineWidth = f.s * .012; for (let i = 1; i < 5; i++) { c.beginPath(); c.arc(f.x, f.y, r * (.62 + i * .24), 0, TAU); c.stroke(); }
    }
  };
  A.art = (id, c, W, H, t = 0) => (art[id] || art.brand)(c, W, H, t);
})();
