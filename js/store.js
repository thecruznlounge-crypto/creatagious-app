/* On-device storage: IndexedDB, with an in-memory cache the UI reads from. */
(function () {
  const DB = 'adifying', STORE = 'kv';
  let dbp;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(STORE, mode), out = fn(t.objectStore(STORE));
      t.oncomplete = () => res(out && out.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const dayKey = (d) => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };

  const S = A.store = {
    projects: [], notes: [], events: [], posts: [],
    profile: { name: '', brand: '', accent: '#F9CC0B', logo: null, website: '' },
    uid, dayKey,
    async load() {
      const [p, n, e, pr, seeded, po] = await Promise.all(['projects', 'notes', 'events', 'profile', 'seeded', 'posts'].map((k) => tx('readonly', (s) => s.get(k))));
      S.projects = p || []; S.notes = n || []; S.events = e || []; S.posts = po || [];
      if (pr) S.profile = Object.assign(S.profile, pr);
      if (!seeded) { A.seed(); await tx('readwrite', (s) => s.put(true, 'seeded')); await S.saveAll(); }
    },
    async put(k, v) { try { await tx('readwrite', (s) => s.put(v, k)); } catch (e) { A.toast && A.toast('Storage is full. Delete a project to free space.'); } },
    async read(k) { return tx('readonly', (s) => s.get(k)); },
    del(k) { return tx('readwrite', (s) => s.delete(k)); },
    saveAll() { return Promise.all([S.put('projects', S.projects), S.put('notes', S.notes), S.put('events', S.events), S.put('profile', S.profile), S.put('posts', S.posts)]); },
    saveProjects() { return S.put('projects', S.projects); },
    get: (id) => S.projects.find((p) => p.id === id),
    upsert(p) {
      p.updated = Date.now();
      const i = S.projects.findIndex((x) => x.id === p.id);
      if (i < 0) S.projects.unshift(p); else S.projects[i] = p;
      S.saveProjects();
      return p;
    },
    remove(id) {
      const refs = (p) => [p.logo, p.voice, ...(p.scenes || []).map((s) => s.media), ...(p.slides || []).map((s) => s.media), ...(p.kitMedia || [])].filter(Boolean), gone = S.get(id); if (gone && gone.type === 'pack') gone.items.forEach((x) => S.remove(x.project)); S.projects = S.projects.filter((p) => p.id !== id); S.saveProjects(); if (S.posts.some((x) => x.pid === id)) { S.posts = S.posts.filter((x) => x.pid !== id); S.put('posts', S.posts); }
      if (gone) { const keep = new Set([...S.projects.flatMap(refs), ...S.posts.map((x) => x.media).filter(Boolean)]); refs(gone).forEach((m) => { if (!keep.has(m)) A.media.drop(m); }); }
    },
    log(kind, data) {
      S.events.push(Object.assign({ kind, at: Date.now() }, data));
      if (S.events.length > 2000) S.events = S.events.slice(-2000);
      S.put('events', S.events);
    },
    notify(title, body, href) {
      S.notes.unshift({ id: uid(), title, body, href: href || '', at: Date.now(), read: false });
      S.notes = S.notes.slice(0, 50);
      S.put('notes', S.notes);
      A.refreshDot && A.refreshDot();
    },
    async wipe() {
      await tx('readwrite', (s) => s.clear());
      try { localStorage.clear(); } catch (e) {}
      if (window.caches) { /* keep the app shell so the app still opens offline */ }
    },
    dump() { return { exported: new Date().toISOString(), app: 'Creatagious', version: A.CONFIG.VERSION, profile: S.profile, projects: S.projects, scheduled: S.posts, notifications: S.notes, activity: S.events }; }
  };

  A.imageToData = (file, max = 1600) => new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.86));
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That image could not be opened.')); };
    im.src = url;
  });
})();
