/* Premium scheduling: plan when and where content goes out, with calendar reminders and one-tap sharing at post time.
   Automatic posting can be switched on per platform later, once each platform approves the app. */
(() => {
  const S = A.store, esc = A.esc, ic = A.ic, prem = () => A.plan.premium();
  A.SCHED_PLATFORMS = [
    { id: 'tiktok', name: 'TikTok', url: 'https://www.tiktok.com/upload' },
    { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/' },
    { id: 'facebook', name: 'Facebook', url: 'https://www.facebook.com/' },
    { id: 'youtube', name: 'YouTube Shorts', url: 'https://www.youtube.com/upload' },
    { id: 'linkedin', name: 'LinkedIn', url: 'https://www.linkedin.com/feed/' },
    { id: 'pinterest', name: 'Pinterest', url: 'https://www.pinterest.com/pin-creation-tool/' }
  ];
  const plat = (id) => A.SCHED_PLATFORMS.find((x) => x.id === id) || { id, name: id, url: '' };
  const when = (t) => new Date(t).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const dayName = (t) => { const d = new Date(t), n = new Date(), k = (x) => x.toDateString(); if (k(d) === k(n)) return 'Today'; n.setDate(n.getDate() + 1); if (k(d) === k(n)) return 'Tomorrow'; return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }); };
  const left = (p) => p.platforms.filter((x) => !(p.done || {})[x]);
  const isDue = (p) => p.at <= Date.now() && left(p).length > 0;

  A.sched = {
    plat, when,
    localInput(t) { const d = new Date(t); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); },
    source(p) { return p.pid ? S.get(p.pid) : null; },
    /* Calendar file. Phone calendars remind you even when Creatagious is closed. */
    ics(list) {
      const e = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/[;,]/g, (m) => '\\' + m).replace(/\r?\n/g, '\\n');
      const t = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''), now = t(Date.now()), base = location.href.split('#')[0];
      const fold = (l) => { const out = []; let s = l; while (s.length > 73) { out.push(s.slice(0, 73)); s = ' ' + s.slice(73); } out.push(s); return out.join('\r\n'); };
      const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Creatagious//Schedule//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
      list.forEach((p) => lines.push('BEGIN:VEVENT', `UID:${p.id}@creatagious`, `DTSTAMP:${now}`, `DTSTART:${t(p.at)}`, `DTEND:${t(p.at + 15 * 6e4)}`, `SUMMARY:${e('Post ' + p.name + ' to ' + p.platforms.map((x) => plat(x).name).join(', '))}`, `DESCRIPTION:${e((p.caption ? p.caption + '\n\n' : '') + 'Open Creatagious to post: ' + base + '#schedule')}`, `URL:${base}#schedule`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${e('Time to post ' + p.name)}`, 'TRIGGER:-PT0M', 'END:VALARM', 'END:VEVENT'));
      lines.push('END:VCALENDAR'); return new Blob([lines.map(fold).join('\r\n') + '\r\n'], { type: 'text/calendar' });
    },
    /* Reminders while the app is open, plus a system notification when allowed. */
    async check() {
      if (!prem()) return; let changed = false;
      for (const p of S.posts) { if (p.notified || !isDue(p)) continue; p.notified = true; changed = true;
        S.notify('Time to post', `${p.name}: ${left(p).map((x) => plat(x).name).join(', ')}`, '#schedule');
        try { if ('Notification' in window && Notification.permission === 'granted') { const r = await navigator.serviceWorker.getRegistration(); if (r) r.showNotification('Time to post', { body: p.name, tag: p.id, icon: 'assets/icons/icon-192.png', badge: 'assets/icons/icon-192.png', data: { url: '#schedule' } }); } } catch (e) {} }
      if (changed) S.put('posts', S.posts);
    },
    /* The files to share for one scheduled post. Results are kept for this session. */
    cache: new Map(),
    async files(p, onP) {
      if (p.media) { const b = await A.media.blob(p.media); if (!b) throw new Error('This file is no longer on this device.'); return [{ blob: b, name: p.fileName || ('post.' + (b.type.split('/')[1] || 'bin').replace('quicktime', 'mov')) }]; }
      const src = A.sched.source(p); if (!src) throw new Error('The project for this post was deleted.'); const key = src.id + ':' + (src.updated || 0);
      if (A.sched.cache.has(key)) return A.sched.cache.get(key); let out;
      if (A.content.needsQuote(src)) throw new Error('Open the project and paste a real customer quote first.');
      if (src.type === 'carousel') out = await A.exporter.slidePngs(src); else if (A.isVideo(src)) { if (!A.exporter.canVideo()) throw new Error('This browser cannot record video. Try Chrome.'); out = [await A.exporter.video(src, onP)]; } else out = [await A.exporter.png(src)];
      A.sched.cache.set(key, out); return out;
    },
    dueCount: () => prem() ? S.posts.filter(isDue).length : 0
  };

  const row = (p) => {
    const src = A.sched.source(p), due = isDue(p), done = !left(p).length, thumb = p.media ? `<img data-m="${p.media}" alt="">` : src && src.thumb ? `<img src="${esc(src.thumb)}" alt="">` : `<span class="sq">${ic('image')}</span>`;
    const tags = p.platforms.map((x) => `<span class="ptag ${(p.done || {})[x] ? 'ok' : ''}">${(p.done || {})[x] ? ic('check') : ''}${esc(plat(x).name)}</span>`).join('');
    return `<div class="sp ${due ? 'due' : ''} ${done ? 'done' : ''}"><span class="th">${thumb}</span><div class="grow"><strong>${esc(p.name)}</strong><em>${done ? 'Posted' : due ? 'Ready to post' : esc(when(p.at))}</em><div class="ptags">${tags}</div><div class="row sact">${done ? '' : `<button class="btn ${due ? '' : 'ghost'}" data-act="schedgo" data-v="${p.id}">${ic('share', 'ic18')}Post now</button>`}${done ? '' : `<button class="btn ghost" data-act="schedics" data-v="${p.id}" aria-label="Add ${esc(p.name)} to your calendar">${ic('bell', 'ic18')}Remind me</button>`}<button class="more" data-act="schedmenu" data-v="${p.id}" aria-label="Options for ${esc(p.name)}">${ic('dots')}</button></div></div></div>`;
  };
  A.views.schedule = () => {
    if (!prem()) return `<h1 class="ptitle">Schedule</h1><p class="psub">Plan when and where your content goes out.</p><div class="empty sched-up">${ic('crown')}<strong>Scheduling is a Premium feature</strong>Pick your platforms and times, upload your own videos, get reminders on your phone, and post in one tap when it&#39;s time.<button class="btn" data-act="paywall">See Premium</button></div>`;
    const all = [...S.posts].sort((a, b) => a.at - b.at), due = all.filter(isDue), up = all.filter((p) => p.at > Date.now() && left(p).length), past = all.filter((p) => !left(p).length).reverse().slice(0, 10), groups = {};
    up.forEach((p) => { (groups[dayName(p.at)] = groups[dayName(p.at)] || []).push(p); });
    const perm = 'Notification' in window && Notification.permission === 'default';
    return `<h1 class="ptitle">Schedule</h1><p class="psub">${up.length + due.length ? `${up.length + due.length} ${up.length + due.length === 1 ? 'post' : 'posts'} planned` : 'Plan when and where your content goes out.'}</p>${A.planBar ? A.planBar() : ''}
      <div class="row" style="gap:8px;margin-bottom:14px;flex-wrap:wrap"><button class="btn grow" data-act="schedadd">${ic('plus', 'ic20')}Schedule a post</button><button class="btn ghost grow" data-act="schedup">${ic('upload', 'ic20')}Upload a video</button></div>
      ${perm ? `<button class="btn ghost full" data-act="schednotif" style="margin-bottom:14px">${ic('bell', 'ic18')}Turn on reminders</button>` : ''}
      ${due.length ? `<h2 class="sh">Ready to post</h2><div class="stack">${due.map(row).join('')}</div>` : ''}
      ${Object.keys(groups).map((d) => `<h2 class="sh">${esc(d)}</h2><div class="stack">${groups[d].map(row).join('')}</div>`).join('')}
      ${!all.length ? `<div class="empty"><strong>Nothing scheduled yet</strong>Schedule an ad you made, or upload a finished video.</div>` : ''}
      ${up.length > 1 ? `<button class="btn ghost full" data-act="schedicsall" style="margin-top:12px">${ic('bell', 'ic18')}Add all to my calendar</button>` : ''}
      ${past.length ? `<h2 class="sh">Posted</h2><div class="stack">${past.map(row).join('')}</div>` : ''}
      <p class="note" style="margin-top:14px">Calendar reminders work even when Creatagious is closed. Automatic posting will be added for each platform as it becomes available.</p>`;
  };
})();
