/* Ad copy: uses the optional server AI when reachable, otherwise writes on the device. */
(function () {
  const TEMPLATES = A.TEMPLATES = [
    { id: 'food', name: 'Food Promo', img: 'assets/img/tpl_food.webp', layout: 'poster', accent: '#FFC21A', dark: true },
    { id: 'event', name: 'Event', img: 'assets/img/tpl_event.webp', layout: 'center', accent: '#FF3FD1', dark: true },
    { id: 'transport', name: 'Transport', img: 'assets/img/tpl_transport.webp', layout: 'poster', accent: '#F9CC0B', dark: true },
    { id: 'sale', name: 'Sale', img: 'assets/img/tpl_sale.webp', layout: 'badge', accent: '#FFE100', dark: true },
    { id: 'beauty', name: 'Beauty', layout: 'split', accent: '#D8346F', dark: false },
    { id: 'fitness', name: 'Fitness', layout: 'poster', accent: '#C6F135', dark: true },
    { id: 'realestate', name: 'Real Estate', layout: 'split', accent: '#E9A23B', dark: true },
    { id: 'opening', name: 'Grand Opening', layout: 'center', accent: '#FFD23F', dark: true },
    { id: 'brand', name: 'Bold Brand', layout: 'poster', accent: '#18D4E8', dark: true }
  ];
  A.tpl = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[8];

  const KEY = {
    food: /burger|pizza|taco|restaurant|food|menu|lunch|dinner|brunch|cafe|coffee|bakery|bbq|sushi|wings|chef|meal/i,
    event: /event|party|concert|festival|club|dj|nightlife|show|tickets?|gala|live music|wedding/i,
    transport: /bus|shuttle|limo|charter|transport|ride|airport|travel|trip|tour|resort|getaway|vacation|hotel|cruise/i,
    sale: /sale|% ?off|discount|clearance|deal|black friday|save \$|bogo|coupon/i,
    beauty: /salon|beauty|hair|nails?|spa|lash|skin|makeup|barber/i,
    fitness: /gym|fitness|workout|yoga|trainer|crossfit|pilates|boxing/i,
    realestate: /real estate|realtor|home for sale|condo|apartment|open house|property|listing/i,
    opening: /grand opening|now open|new location|opening/i
  };
  const C = {
    food: { h: ['{Offer}', 'Taste the craving', 'Made to be devoured', 'Hungry yet?'], s: ['{Topic}, made fresh and ready when you are.', 'One bite and you will get it.', 'Come hungry. Leave happy.'], c: ['Order now', 'See the menu', 'Reserve a table'], hook: 'Hungry yet?' },
    event: { h: ['{Offer}', 'The night starts here', 'Be in the room', 'Don’t miss this one'], s: ['{Topic}. Limited spots, big energy.', 'Grab your crew and lock it in.', 'The kind of night people talk about.'], c: ['Get tickets', 'Save my spot', 'Book now'], hook: 'Your weekend just changed.' },
    transport: { h: ['{Offer}', 'Arrive in style', 'The ride is the party', 'Getting there just got better'], s: ['{Topic}. Sit back, we’ve got the road.', 'Bring everyone. We’ll handle the driving.', 'Comfort from the first mile.'], c: ['Book your ride', 'Get a quote', 'Reserve now'], hook: 'Stop stressing about the drive.' },
    sale: { h: ['{Offer}', 'The big sale is on', 'Prices just dropped', 'Last call for savings'], s: ['{Topic}. While supplies last.', 'Your favorites, for less.', 'When it’s gone, it’s gone.'], c: ['Shop the sale', 'Claim my deal', 'Shop now'], hook: 'You’ll want to see these prices.' },
    beauty: { h: ['{Offer}', 'Your glow-up awaits', 'Feel like you, only better', 'Book your reset'], s: ['{Topic}, tailored to you.', 'You deserve this appointment.', 'Walk out feeling brand new.'], c: ['Book now', 'See openings', 'Get the look'], hook: 'It’s time for you.' },
    fitness: { h: ['{Offer}', 'Start strong today', 'No more someday', 'Stronger starts here'], s: ['{Topic}. Show up and we’ll do the rest.', 'Real coaching. Real progress.', 'Your first step is the hardest. We’ve got you.'], c: ['Start today', 'Join now', 'Try a class'], hook: 'Someday starts now.' },
    realestate: { h: ['{Offer}', 'Come home to this', 'Your next address', 'Picture yourself here'], s: ['{Topic}. Schedule your private tour.', 'Spaces made for how you live.', 'The right home changes everything.'], c: ['Book a tour', 'View listing', 'Learn more'], hook: 'Imagine waking up here.' },
    opening: { h: ['{Offer}', 'We’re officially open', 'Doors are open', 'Come say hello'], s: ['{Topic}. Be one of the first through the door.', 'Your new favorite spot just arrived.', 'Stop by and see what’s new.'], c: ['Visit us', 'Get directions', 'Learn more'], hook: 'Something new just opened.' },
    brand: { h: ['{Offer}', 'Made for you', 'Your next favorite', 'See what’s new'], s: ['{Topic}, done right.', 'Quality you can see right away.', 'Find out why people keep coming back.'], c: ['Learn more', 'Shop now', 'Get started'], hook: 'Here’s what you’ve been missing.' }
  };
  const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
  const detect = (b) => { const o = ['opening', 'realestate', 'food', 'beauty', 'fitness', 'transport', 'event', 'sale']; return o.find((k) => KEY[k].test(b)) || 'brand'; };
  const offerOf = (b) => { const m = b.match(/(\d{1,3}\s?%\s?off|\$\s?\d[\d.,]*(?:\s?off)?|buy one get one(?: free)?|bogo|free\s+[a-z]+(?:\s+[a-z]+)?|grand opening|now open)/i); return m ? m[0].replace(/\s+/g, ' ').trim() : ''; };
  const topicOf = (b) => {
    let t = b.replace(/^\s*(please\s+)?(create|make|design|generate|write|build)?\s*(me\s+)?(an?|the)?\s*((image|video|promo|social( media)?|instagram|tiktok|facebook)\s+)*(ad|ads|advert|clip|video|campaign|post|promo)?\s*(for|about|promoting|of)?\s*/i, '').replace(/[.!]+$/, '').trim();
    t = t.split(/[.!?\n]/)[0].trim();
    if (t.length > 58) t = t.slice(0, 58).replace(/\s+\S*$/, '');
    return t || 'Our latest';
  };
  const titleOf = (t) => { const w = t.split(/\s+/).slice(0, 3).join(' ').replace(/[,;:]$/, '').replace(/\s+(of|for|the|and|with|a|an|in|at|to)$/i, ''); return w.split(' ').map(cap).join(' '); };
  const hashtags = (cat, brand) => { const b = (brand || '').replace(/[^a-z0-9]/gi, ''); return [b && '#' + b, '#' + ({ realestate: 'RealEstate', brand: 'NewDrop', opening: 'GrandOpening' }[cat] || cap(cat)), '#ShopLocal'].filter(Boolean).join(' '); };

  function local(brief, type) {
    const cat = detect(brief), t = C[cat], offer = offerOf(brief), topic = cap(topicOf(brief)), brand = A.store.profile.brand || '';
    const fill = (s) => s.replace('{Topic}', topic);
    let heads = t.h.slice(1);
    if (offer) heads = [cap(offer), ...heads.slice(0, 2)];
    const variants = heads.slice(0, 3).map((h, i) => ({ headline: h, sub: fill(t.s[i % t.s.length]), cta: t.c[i % t.c.length] }));
    const v = variants[0];
    return { source: 'device', template: cat, name: titleOf(topicOf(brief)), variants, caption: `${v.headline}. ${v.sub} ${hashtags(cat, brand)}`.replace(/\.\./g, '.'), scenes: scenes(t, v, topic, offer) };
  }
  /* Builds the ad from what was actually found on the website. */
  const words = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
  const tidy = (t) => String(t || '').replace(/\s+/g, ' ').replace(/[\s:;,.|–—-]+$/, '').trim();
  const clip = (t, n) => { t = tidy(t); if (t.length <= n) return t; return tidy(t.slice(0, n).replace(/\s+\S*$/, '')); };
  const sentence = (t, n = 112) => { const s = tidy(String(t || '').split(/(?<=[.!?])\s+/)[0]); return s.length <= n ? s : clip(s, n); };
  const uniq = (l) => { const seen = new Set(); return l.filter((t) => { const k = String(t).toLowerCase(); if (!t || seen.has(k)) return false; seen.add(k); return true; }); };
  A.siteData = (k) => { const on = (k.facts || []).filter((f) => f.on), of = (x) => on.filter((f) => f.kind === x); return { name: k.name, host: k.host, description: k.description || '', headings: of('head').map((f) => f.text), offers: of('offer').map((f) => f.text), items: of('item').map((f) => ({ name: f.text, text: f.sub, price: f.price || '' })), paragraphs: of('para').map((f) => f.text), cta: of('cta').map((f) => f.text) }; };
  A.siteHasFacts = (d) => !!(d && (d.headings.length || d.offers.length || d.items.length || d.paragraphs.length));
  const offerHead = (o) => { const t = tidy(o); return t.length <= 40 ? t : clip(t.split(/\s+(?:when|if|with|on|for|this|by|before|at)\s+/i)[0], 44); };
  function fromSite(d, message, type) {
    const all = [d.name, d.description, ...d.headings, ...d.offers, ...d.items.map((i) => `${i.name} ${i.text}`), ...d.paragraphs, message].filter(Boolean).join('. '), base = local(all, type), cat = base.template, T = C[cat], offerNote = offerOf(message || '');
    const heads = uniq([offerNote && cap(offerNote), ...d.offers.map(offerHead), ...d.headings.filter((h) => words(h) <= 8).map((h) => clip(h, 52)), ...d.items.map((i) => clip(i.name, 46)), ...d.headings.map((h) => clip(h, 46))]).filter((h) => words(h) >= 1);
    const subs = uniq([message && sentence(message), d.description && sentence(d.description), ...d.paragraphs.map((p) => sentence(p)), ...d.items.filter((i) => i.text).map((i) => sentence(i.text))]).filter((s) => words(s) >= 3 && !heads.slice(0, 1).includes(s));
    const ctas = uniq([...d.cta.map((c) => clip(c, 22)), ...T.c]), v = [0, 1, 2].map((i) => ({ headline: heads[i] || base.variants[i].headline, sub: subs[i] || base.variants[i].sub, cta: ctas[i] || T.c[i % T.c.length] })), first = v[0], names = d.items.map((i) => clip(i.price ? `${i.name} ${i.price}` : i.name, 56));
    const hook = clip(d.headings.find((h) => words(h) <= 9) || first.headline, 58), show = names[0] || clip(d.headings[1] || first.headline, 56), proof = names[1] || clip(d.headings[2] || subs[1] || first.sub, 58);
    const sc = [['Hook', hook], ['Show it', show], ['Why it matters', clip(subs[0] || first.sub, 62)], ['Proof point', proof], ['Offer', d.offers[0] ? offerHead(d.offers[0]) : clip(offerNote || v[1].headline, 54)], ['Call to action', first.cta]].map(([title, text]) => ({ title, text }));
    const slideSrc = d.items.length >= 2 ? d.items.map((i) => ({ title: clip(i.name, 44), text: clip(i.text || (i.price ? `From ${i.price}` : first.sub), 118) })) : [...d.headings.slice(1).map((h, i) => ({ title: clip(h, 44), text: clip(subs[i] || first.sub, 118) })), ...d.offers.map((o) => ({ title: 'The offer', text: clip(o, 118) }))];
    return { source: 'site', template: cat, name: clip(d.name || base.name, 30), variants: v, caption: tidy(`${first.headline}. ${first.sub}. ${first.cta}: ${d.host}`) + ' ' + hashtags(cat, d.name), scenes: sc, slides: slideSrc.length ? slideSrc : null };
  }
  function scenes(t, v, topic, offer) {
    return [
      { title: 'Hook', text: t.hook }, { title: 'Show it', text: topic }, { title: 'Why it matters', text: t.s[1] },
      { title: 'Proof point', text: t.s[2] }, { title: 'Offer', text: offer ? cap(offer) : v.headline }, { title: 'Call to action', text: v.cta }
    ];
  }
  A.scenesFor = (all, secs) => { const pick = secs <= 6 ? [0, 5] : secs <= 15 ? [0, 1, 4, 5] : [0, 1, 2, 3, 4, 5]; return pick.map((i) => Object.assign({}, all[i])); };

  async function remote(brief, type, opt = {}) {
    if (!A.CONFIG.AI_ENDPOINT || !navigator.onLine) return null;
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), A.CONFIG.AI_TIMEOUT_MS);
    try {
      const r = await fetch(A.CONFIG.AI_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal, body: JSON.stringify({ token: A.plan.token(), site: opt.site || null, brief: brief.slice(0, 1600), type, brand: opt.brand || A.store.profile.brand || '', beats: opt.style && opt.style !== 'classic' ? A.content.beats(opt.style) : [], goal: opt.goal || 'sales', slide_count: opt.slides || 0, platforms: opt.platforms || [] }) });
      if (!(r.headers.get('content-type') || '').includes('json')) return null;
      const d = await r.json(); if (!r.ok) { A.copy.notice = d.reason === 'not_configured' ? '' : d.reason === 'free_limit' ? (A.plan.premium() ? 'Today\u2019s AI copy is used, so this draft was written on your device.' : 'Today\u2019s free AI copy is used. Premium includes more.') : d.error || ''; return null; }
      if (!Array.isArray(d.variants) || !d.variants.length || !d.variants[0].headline) return null;
      return d;
    } catch (e) { return null; } finally { clearTimeout(timer); }
  }
  A.copy = {
    detect, local, fromSite, offerOf, topicOf, notice: '',
    async generate(brief, type, opt = {}) {
      A.copy.notice = ''; const useSite = A.siteHasFacts(opt.site), base = useSite ? fromSite(opt.site, brief, type) : local(brief, type), ai = await remote(brief, type, opt);
      if (!ai) return base;
      return Object.assign(base, { slides: Array.isArray(ai.slides) ? ai.slides : null, captions: ai.captions && typeof ai.captions === 'object' ? ai.captions : null, script: Array.isArray(ai.script) ? ai.script : null, source: 'ai', variants: ai.variants.slice(0, 3), caption: ai.caption || base.caption, scenes: Array.isArray(ai.scenes) && ai.scenes.length >= 6 ? ai.scenes : base.scenes, name: ai.name || base.name, template: TEMPLATES.some((x) => x.id === ai.template) ? ai.template : base.template });
    }
  };

  A.newProject = (type, gen, extra) => {
    const v = gen.variants[0], video = type === 'video' || type === 'promo', secs = video ? 15 : 0;
    return Object.assign({
      id: A.store.uid(), type, name: gen.name, brief: '', template: gen.template, format: video ? 'story' : 'square', variants: gen.variants, variant: 0,
      headline: v.headline, sub: v.sub, cta: v.cta, brand: A.store.profile.brand || '', accent: '', photo: null, caption: gen.caption, source: gen.source,
      allScenes: gen.scenes, scenes: video ? A.scenesFor(gen.scenes, secs) : [], duration: secs, music: true, style: 'classic', cap: 'pop', font: 'anton', look: 'natural', trans: 'cut', capPos: 'lower', mood: 'upbeat', progress: true, res: '720', logo: null, voice: null, promoKind: 'offer', detail: '', thumb: null, created: Date.now(), updated: Date.now(), exports: 0
    }, extra || {});
  };
  A.seed = () => {
    const mk = (type, brief, name, ex) => { const g = local(brief, type), p = A.newProject(type, g, Object.assign({ name, brief, seed: true }, ex)); if (p.scenes.length && ex.duration) p.scenes = A.scenesFor(g.scenes, ex.duration); return p; };
    A.store.projects = [
      mk('video', 'Party bus rentals for birthdays and nights out in South Florida', 'Party Bus Promo', { template: 'transport', duration: 30, thumb: 'assets/img/rec_bus.webp', thumbBaked: true, format: 'story' }),
      mk('image', 'Burger special, two smash burgers and fries', 'Burger Special', { template: 'food', format: 'square', thumb: 'assets/img/rec_burger.webp' }),
      mk('video', 'Beachfront resort getaway for the weekend', 'Resort Getaway', { template: 'transport', duration: 15, thumb: 'assets/img/rec_resort.webp', thumbBaked: true, format: 'story' })
    ];
    A.store.notes = [{ id: A.store.uid(), title: 'Welcome to Creatagious', body: 'Describe an ad on the home screen and press Generate.', href: '#home', at: Date.now(), read: false }];
  };
})();
