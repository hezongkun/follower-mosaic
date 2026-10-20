// Shared helpers for popup + in-page overlay.
self.XAMX = self.XAMX || {
  isXUrl: (u) => /^https:\/\/(www\.|mobile\.)?(x|twitter)\.com\//.test(u || ''),
  async inject(tabId) {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['lib/x-config.js', 'content.js'] });
  },
  // Everything runs inside the user's own x.com tab: a MAIN-world watcher for X's own requests,
  // then the overlay UI (isolated world). Only after the user clicked "Generate".
  async startOverlay(tabId, opts) {
    await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['lib/capture-main.js'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['lib/x-config.js', 'content.js', 'lib/i18n.js', 'lib/fonts-data.js', 'lib/mosaic.js', 'lib/common.js', 'lib/overlay.js'] });
    await chrome.scripting.executeScript({ target: { tabId }, func: (o) => { window.__XAM_OVERLAY__.start(o); }, args: [opts] });
  },
  send(tabId, msg) {
    return new Promise((resolve) => {
      try {
        chrome.tabs.sendMessage(tabId, msg, (r) => resolve(chrome.runtime.lastError ? { ok: false, error: 'tab-gone' } : r));
      } catch (_) { resolve({ ok: false, error: 'tab-gone' }); }
    });
  },
  parseUser(r) {
    if (!r || r.__typename === 'UserUnavailable') return null;
    const L = r.legacy || {};
    const screen_name = r.core?.screen_name || L.screen_name;
    if (!screen_name) return null;
    return {
      id: r.rest_id, screen_name, name: r.core?.name || L.name || screen_name,
      avatar: (r.avatar?.image_url || L.profile_image_url_https || '').replace(/_normal(\.\w+)$/, '_400x400$1'),
      followers_count: L.followers_count ?? r.relationship_counts?.followers ?? null,
      protected: !!(r.privacy?.protected ?? L.protected),
    };
  },
  async lookup(tabId, screen_name) {
    const r = await XAMX.send(tabId, { type: 'xam:gql', op: 'UserByScreenName', variables: { screen_name, withSafetyModeUserFields: true }, extra: { fieldToggles: { withAuxiliaryUserLabels: false } } });
    if (!r || !r.ok) return { error: r };
    const u = XAMX.parseUser(r.json?.data?.user?.result);
    return u ? { user: u } : { notFound: true };
  },
  STYLES: [
    { id: 'text', img: 'img/style-text.jpg' },
    { id: 'xlogo', img: 'img/style-xlogo.jpg' },
    { id: 'heart', img: 'img/style-heart.jpg' },
    { id: 'grid', img: 'img/style-grid.jpg' },
  ],
  // language: auto-detect, remembered in chrome.storage.local, 中/EN toggle
  async initLang(toggleBtn) {
    await XAM_I18N.init({
      get: async () => (await chrome.storage.local.get('lang')).lang,
      set: async (l) => chrome.storage.local.set({ lang: l }),
    });
    if (toggleBtn) XAM_I18N.bindToggle(toggleBtn);
  },
  // Live thumbnails for the style cards: the account's own name + avatar, follower slots drawn as
  // placeholder dots (no follower fetch needed). Only one image (the owner avatar) is loaded.
  async thumbs(owner, text, font, styles, S = 240) {
    const out = {};
    if (!self.XAM) return out;
    const dots = Array.from({ length: 90 }, (_, i) => ({ screen_name: 'p' + ((i * 7919) % 997), name: '', avatar: '' }));
    XAM.load({ owner: { screen_name: owner.screen_name || '', name: owner.name || '', avatar: owner.avatar || '' }, followers: dots });
    const work = document.createElement('canvas');
    for (const style of styles) {
      await XAM.render({ canvas: work, style, W: 480, text, font, caption: style !== 'text', stars: true, seed: 3,
        sub: '@' + (owner.screen_name || '') });
      const sq = document.createElement('canvas'); sq.width = sq.height = S;
      const c = sq.getContext('2d'), w = work.width, h = work.height;
      if (style === 'text') {               // whole word visible: fit width, centered on the theme background
        c.drawImage(work, 0, 0, w, h * 0.12, 0, 0, S, S);
        const k = S / w; c.drawImage(work, 0, (S - h * k) / 2, S, h * k);
      } else { const m = Math.min(w, h); c.drawImage(work, (w - m) / 2, (h - m) / 2, m, m, 0, 0, S, S); }
      out[style] = sq;
    }
    return out;
  },
  async liveThumbs(el, owner, text, font) {
    const t0 = performance.now();
    const imgs = [...el.querySelectorAll('img[data-style]')];
    const sq = await XAMX.thumbs(owner, text, font, imgs.map((i) => i.dataset.style));
    for (const img of imgs) if (sq[img.dataset.style]) img.src = sq[img.dataset.style].toDataURL('image/jpeg', 0.85);
    return Math.round(performance.now() - t0);
  },
  // same default text logic everywhere: saved text for this account, else display name (emoji stripped), else @handle
  async defaultTextFor(owner) {
    const prefs = await XAMX.getPrefs();
    const text = (prefs.texts && prefs.texts[owner.screen_name || 'me']) || XAM.defaultText({ name: owner.name, screen_name: owner.screen_name });
    const font = prefs.font && XAM.fonts[prefs.font] ? prefs.font : (/[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/.test(text) ? 'cjk' : 'sans');
    return { text, font, prefs };
  },
  // ---- user settings: pause per page + max followers (persisted in chrome.storage.local "prefs") ----
  SPEEDS: [1, 2, 3, 5, 10],
  CAPS: [100, 200, 500, 1000, 2000, 5000],
  DEFAULTS: { delay: 5, cap: 500 },
  async getPrefs() { return (await chrome.storage.local.get('prefs')).prefs || {}; },
  async savePrefs(patch) { const p = await XAMX.getPrefs(); Object.assign(p, patch); await chrome.storage.local.set({ prefs: p }); return p; },
  settingsOf(p) {
    const d = XAMX.SPEEDS.includes(+p.delay) ? +p.delay : XAMX.DEFAULTS.delay;
    const c = XAMX.CAPS.includes(+p.cap) ? +p.cap : XAMX.DEFAULTS.cap;
    return { delay: d, cap: c };
  },
  // Renders the two chip rows into `el`; calls onChange({delay, cap}) and saves. Call again to re-label.
  settingsUI(el, cur, onChange) {
    const t = (k, v) => XAM_I18N.t(k, v);
    el.textContent = '';
    const row = (labelKey, values, key, fmt) => {
      const r = document.createElement('div'); r.className = 'setrow';
      const l = document.createElement('span'); l.className = 'setlbl'; l.textContent = t(labelKey); r.append(l);
      const g = document.createElement('div'); g.className = 'chips';
      for (const v of values) {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = fmt(v);
        b.className = 'chipx' + (cur[key] === v ? ' on' : '');
        b.onclick = () => { cur[key] = v; XAMX.savePrefs({ [key]: v }); XAMX.settingsUI(el, cur, onChange); onChange && onChange({ ...cur }); };
        g.append(b);
      }
      r.append(g); el.append(r);
    };
    row('delay.label', XAMX.SPEEDS, 'delay', (v) => t('time.sec', { n: v }));
    row('cap.label', XAMX.CAPS, 'cap', (v) => t('cap.opt', { n: XAM_I18N.num(v) }));
    if (cur.delay <= 2) { const w = document.createElement('div'); w.className = 'setwarn'; w.textContent = t('delay.warn'); el.append(w); }
  },
  SETTINGS_CSS: `.setrow{display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap}.setlbl{font-size:12px;color:#8e9ab4;min-width:96px}
.chips{display:flex;gap:4px;flex-wrap:wrap}.chipx{padding:3px 8px;border-radius:999px;border:1px solid #26314b;background:#0e1424;color:#eef2fa;font:12px/1.4 system-ui,"PingFang SC","Microsoft YaHei",sans-serif;cursor:pointer}
.chipx.on{border-color:#1d9bf0;background:#1d9bf022}.setwarn{margin-top:6px;font-size:12px;color:#fcd34d}
.author{color:#8e9ab4;text-decoration:none}.author:hover{color:#1d9bf0;text-decoration:underline}`,
  AUTHOR_URL: 'https://x.com/Kuno_he',
  authorLink() { const a = document.createElement('a'); a.className = 'author'; a.href = XAMX.AUTHOR_URL; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.dataset.i18n = 'author'; a.textContent = XAM_I18N.t('author'); return a; },
  styleCards(el, current, onPick) {
    el.innerHTML = '';
    for (const s of XAMX.STYLES) {
      const b = document.createElement('button');
      b.className = 'card' + (s.id === current ? ' on' : '');
      b.type = 'button';
      const img = document.createElement('img'); img.src = s.img; img.alt = ''; img.dataset.style = s.id;
      const span = document.createElement('span'); span.dataset.i18n = 'style.' + s.id; span.textContent = XAM_I18N.t('style.' + s.id);
      b.append(img, span);
      b.onclick = () => { el.querySelectorAll('.card').forEach((c) => c.classList.remove('on')); b.classList.add('on'); onPick(s.id); };
      el.appendChild(b);
    }
  },
};
