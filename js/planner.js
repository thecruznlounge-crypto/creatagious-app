/* Goals, carousels and multi-platform packs. */
(function () {
  A.GOALS = [['sales', 'Get sales', 'hook'], ['offer', 'Promote an offer', 'reveal'], ['trust', 'Build trust', 'founder'], ['teach', 'Teach', 'top3'], ['announce', 'Announce', 'reveal']];
  A.goalStyle = (g) => (A.GOALS.find((x) => x[0] === g) || A.GOALS[0])[2];
  A.PLATFORMS = [
    { id: 'short', name: 'TikTok, Reels and Shorts', type: 'video', format: 'story', cap: 'tiktok' },
    { id: 'carousel', name: 'Instagram carousel', type: 'carousel', format: 'feed', cap: 'instagram' },
    { id: 'story', name: 'Instagram Story', type: 'image', format: 'story', cap: 'instagram' },
    { id: 'facebook', name: 'Facebook feed', type: 'image', format: 'square', cap: 'facebook' },
    { id: 'linkedin', name: 'LinkedIn', type: 'image', format: 'wide', cap: 'linkedin' },
    { id: 'pinterest', name: 'Pinterest', type: 'image', format: 'pin', cap: 'pinterest' }
  ];
  const clean = (s) => String(s || '').replace(/[.\s]+$/, ''), cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
  const shortTopic = (t) => clean(t).split(/\s+/).slice(0, 5).join(' ');
  const facts = (g, brand, brief) => { const topic = clean(A.copy.topicOf(brief)), offer = clean(A.copy.offerOf(brief)); return { topic: cap(topic), low: shortTopic(topic).toLowerCase(), offer: offer ? cap(offer) : '', short: brand || g.name || 'us', v: g.variants[0] }; };

  const POOL = {
    sales: (x) => [['Why it stands out', x.v.sub], ['What you get', x.topic], ['Who it is for', 'Made for people who want it done right.'], ['How it works', 'Choose what you need and we take it from there.'], ['Why now', 'The sooner you start, the sooner you enjoy it.'], ['What to do next', 'Save this post so it is ready when you need it.'], ['Have questions?', 'Send us a message and we will help.'], ['Ready when you are', x.v.sub]],
    offer: (x) => [['The offer', x.offer || x.v.headline], ['What is included', x.topic], ['Who it is for', 'A good fit if you have been waiting to try it.'], ['How to claim it', 'Tap the link or send us a message.'], ['Before you go', 'Check the offer details before you book.'], ['Bring a friend', 'Share this with someone who would use it.'], ['Have questions?', 'Message us and we will help.'], ['Next step', x.v.cta]],
    trust: (x) => [['Who we are', `${x.short} is here for ${x.low}.`], ['What matters to us', 'Clear communication and doing the job right.'], ['How we work', 'We keep the process simple from start to finish.'], ['What to expect', 'You will know what happens next at every step.'], ['Why we do this', x.v.sub], ['Meet the people', 'Real people are behind every order.'], ['Have questions?', 'Ask us anything before you decide.'], ['Get to know us', 'Follow along to see how we work.']],
    teach: (x) => [['Start with your goal', 'Know what you want before you compare options.'], ['Check what is included', 'The details matter more than the headline price.'], ['Compare your options', 'Look at quality, timing and support side by side.'], ['Plan ahead', 'A little extra time gives you better choices.'], ['Ask questions early', 'Clear answers prevent problems later.'], ['Look at real examples', 'Past work shows what you can expect.'], ['Set your budget', 'Decide what matters most, then spend there.'], ['Take the next step', 'Save this checklist for when you are ready.']],
    announce: (x) => [['What is new', x.topic], ['Who it is for', 'Anyone looking for a better way to get this done.'], ['Why we made it', x.v.sub], ['How it works', 'It is simple to get started.'], ['What happens next', 'Follow us for the latest details.'], ['Spread the word', 'Share this with someone who should know.'], ['Have questions?', 'Send us a message.'], ['Be first', x.v.cta]]
  };
  A.planner = {
    applyGoal(g, goal, brand, brief) {
      if (g.source === 'ai' || g.source === 'site' || goal === 'sales') return g; const x = facts(g, brand, brief), H = { offer: [x.offer || 'A limited-time offer', 'Do not miss this offer', `An offer from ${x.short}`], trust: [`Why choose ${x.short}`, 'What we stand for', `Meet ${x.short}`], teach: [`What to know about ${x.low}`, `${x.topic}: a quick guide`, 'Read this before you choose'], announce: [`Introducing ${x.short}`, `Big news from ${x.short}`, 'Now available'] }[goal];
      const low = x.short.toLowerCase(), alt = g.variants.map((v) => v.sub).find((t) => !t.toLowerCase().startsWith(low)) || 'Here is what makes the difference.'; g.variants = g.variants.map((v, i) => ({ ...v, headline: H[i] || v.headline, sub: v.sub.toLowerCase().startsWith(low) ? alt : v.sub })); return g;
    },
    slides(goal, g, count, brand, brief) {
      const x = facts(g, brand, brief), n = Math.max(3, count), cover = { kind: 'cover', title: g.variants[0].headline, text: goal === 'teach' ? `${n - 2} things to check` : g.variants[0].sub }, end = { kind: 'cta', title: g.variants[0].cta, text: x.short };
      let mid = (Array.isArray(g.slides) && g.slides.length ? g.slides.map((s) => [s.title, s.text]) : POOL[goal in POOL ? goal : 'sales'](x)).slice(0, n - 2);
      return [cover, ...mid.map(([title, text]) => ({ kind: 'body', title: String(title).slice(0, 48), text: String(text).slice(0, 120) })), end];
    },
    caption(key, g, brand, brief, goal) {
      if (g.captions && g.captions[key]) return g.captions[key]; const x = facts(g, brand, brief), v = x.v, tag = (brand || g.name || '').replace(/[^a-z0-9]/gi, ''), h = tag ? `#${tag}` : '';
      return { tiktok: `${clean(g.scenes && g.scenes[0] && g.scenes[0].text) || clean(v.headline)}. ${v.cta}. ${h}`.trim(), instagram: `${clean(v.headline)}. ${v.sub}\n\nSave this for later. ${h}`.trim(), facebook: `${clean(v.headline)}. ${v.sub} ${v.cta}.`, linkedin: `${clean(v.headline)}.\n\n${v.sub}\n\n${goal === 'teach' ? 'What would you add?' : 'Message us to learn more.'}`, pinterest: `${x.topic}. ${v.sub} ${h}`.trim() }[key] || g.caption;
    }
  };

  function textBlock(c, F, x, y, align) { c.textAlign = align; c.textBaseline = 'top'; F.lines.forEach((l, i) => c.fillText(l, x, y + i * F.lh)); }
  function arrow(c, x, y, s, color) { c.strokeStyle = color; c.lineWidth = s * .16; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x - s, y); c.lineTo(x + s, y); c.moveTo(x + s * .35, y - s * .65); c.lineTo(x + s, y); c.lineTo(x + s * .35, y + s * .65); c.stroke(); }
  A.drawSlide = function (c, W, H, p, im, i) {
    const list = p.slides, s = list[i] || list[0], n = list.length, T = A.tpl(p.template), hi = p.accent || T.accent, u = Math.min(W, H) / 100, m = u * 8, media = s.media && A.media.els.get(s.media), hero = s.kind !== 'body', pic = media || (i === 0 ? im : null); A.setHead(p.font); c.save(); c.clearRect(0, 0, W, H);
    const light = !T.dark, bgc = light ? '#FFF8F4' : '#101318', fg = hero || !light ? '#FFFFFF' : '#14161B';
    if (hero || pic) { c.save(); try { c.filter = A.lookFilter(p.look); } catch (e) {} if (pic) A.cover(c, pic, W, H, 1.02, 0); else A.art(p.template, c, W, H, i * .13); c.restore(); const g = c.createLinearGradient(0, H * .2, 0, H); g.addColorStop(0, 'rgba(0,0,0,.08)'); g.addColorStop(.55, 'rgba(0,0,0,.72)'); g.addColorStop(1, 'rgba(0,0,0,.92)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    else { c.fillStyle = bgc; c.fillRect(0, 0, W, H); }
    c.fillStyle = hi; c.fillRect(0, H - u * 11, W, u * 1.1);
    const body = hero || pic ? '#FFFFFF' : fg, HF = A.HEAD_FONT, BF = (w) => (z) => `${w} ${z}px Inter, Arial, sans-serif`, avail = W - m * 2;
    if (p.brand) { c.font = BF(700)(u * 3.1); c.fillStyle = body; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(p.brand.toUpperCase(), m, m * .8); }
    if (s.kind === 'body') { const num = String(i).padStart(2, '0'); c.font = HF(u * 20); c.fillStyle = hi; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(num, m, H * .17); const t = A.fit(c, String(s.title || '').toUpperCase(), HF, avail, H * .3, u * 13, u * 6, 1.08); const y = H * .17 + u * 27; c.fillStyle = body; c.font = HF(t.size); textBlock(c, t, m, y, 'left'); const b = A.fit(c, s.text || '', BF(500), avail, H * .26, u * 5.2, u * 3.2, 1.34); c.font = BF(500)(b.size); textBlock(c, b, m, y + t.h + u * 4, 'left'); }
    else { const t = A.fit(c, String(s.title || '').toUpperCase(), HF, avail, H * .3, u * 16, u * 6, 1.06), b = A.fit(c, s.text || '', BF(500), avail, H * .12, u * 4.4, u * 3, 1.3), tot = t.h + b.h + u * 3 + (s.kind === 'cta' ? u * 12 : 0); let y = H - u * 19 - tot; c.fillStyle = '#fff'; c.font = HF(t.size); textBlock(c, t, m, y, 'left'); y += t.h + u * 3; c.font = BF(500)(b.size); textBlock(c, b, m, y, 'left'); if (s.kind === 'cta' && p.cta) A.drawButton(c, p.cta, m, y + b.h + u * 3, u, 'left', hi); }
    c.font = BF(700)(u * 3); c.fillStyle = hero || pic || !light ? '#FFFFFF' : '#14161B'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(`${i + 1}/${n}`, m, H - u * 5.2); if (i < n - 1) arrow(c, W - m - u * 2, H - u * 5.2, u * 2.2, c.fillStyle);
    A.drawLogo(c, W, H, p, u); if (!A.plan.premium()) { c.save(); c.translate(0, -u * 11.6); A.drawMark(c, W, H, u); c.restore(); } c.restore();
  };
})();
