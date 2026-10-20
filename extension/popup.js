const view = document.getElementById('view');
const t = (k, v) => XAM_I18N.t(k, v);
let rerender = () => {};

// Build a message screen from dictionary keys (text set via textContent; never raw HTML from data).
function message(emoji, titleKey, textKey, btnKey, onClick) {
  rerender = () => message(emoji, titleKey, textKey, btnKey, onClick);
  view.innerHTML = '<div class="msg"><div class="emoji"></div><p><b></b></p><p class="mut"></p></div>';
  view.querySelector('.emoji').textContent = emoji;
  view.querySelector('b').textContent = t(titleKey);
  view.querySelector('.mut').textContent = t(textKey);
  if (btnKey) {
    const b = document.createElement('button'); b.className = 'big'; b.textContent = t(btnKey); b.onclick = onClick; view.appendChild(b);
  }
}
const openX = (tabId, path = '') => () => {
  if (tabId) chrome.tabs.update(tabId, { url: 'https://x.com/' + path, active: true });
  else chrome.tabs.create({ url: 'https://x.com/' + path });
  window.close();
};

let style = 'text', typed = '', settings = { ...XAMX.DEFAULTS };
function ready(tabId, me) {
  rerender = () => ready(tabId, me);
  view.innerHTML = `
    <div class="who"><img id="av" alt=""><div><b id="nm"></b><small id="hd"></small></div></div>
    <div class="lbl" data-i18n="popup.pickStyle"></div>
    <div class="cards" id="cards"></div>
    <div class="hint" id="namehint" data-i18n="popup.nameHint"></div>
    <div class="lbl" data-i18n="popup.other"></div>
    <input class="field" id="target" data-i18n-ph="popup.placeholder" autocomplete="off" spellcheck="false">
    <div id="settings"></div>
    <button class="big" id="go"></button>`;
  XAM_I18N.apply(view);
  const av = document.getElementById('av');
  if (me.avatar) av.src = me.avatar; else av.style.visibility = 'hidden';
  document.getElementById('nm').textContent = me.name || (me.screen_name ? '@' + me.screen_name : t('popup.loggedIn'));
  document.getElementById('hd').textContent = (me.screen_name ? '@' + me.screen_name : '') +
    (me.followers_count != null ? ' · ' + t('n.followers', { n: XAM_I18N.num(me.followers_count) }) : '');
  const hint = document.getElementById('namehint');
  const cards = document.getElementById('cards');
  XAMX.styleCards(cards, style, (s) => { style = s; hint.classList.toggle('off', s !== 'text'); });
  hint.classList.toggle('off', style !== 'text');
  liveThumbs(cards, me);
  XAMX.settingsUI(document.getElementById('settings'), settings);
  const input = document.getElementById('target'), go = document.getElementById('go');
  const label = () => {
    const u = input.value.trim().replace(/^@/, '');
    go.textContent = u ? t('popup.go.other', { u }) : t('popup.go.me');
  };
  input.value = typed;
  label();
  input.oninput = () => { typed = input.value; input.style.borderColor = ''; label(); };
  go.onclick = () => {
    const target = input.value.trim().replace(/^@/, '').replace(/^https?:\/\/(x|twitter)\.com\//, '').split(/[/?#]/)[0];
    if (target && !/^\w{1,15}$/.test(target)) { input.focus(); input.style.borderColor = '#f87171'; go.textContent = t('popup.badUser'); return; }
    go.disabled = true;
    XAMX.startOverlay(tabId, { style, target, delay: settings.delay, cap: settings.cap, me: { id: me.id || null, screen_name: me.screen_name || '', name: me.name || '', avatar: me.avatar || '', followers_count: me.followers_count ?? null } })
      .then(() => window.close())
      .catch(() => message('🔄', 'popup.notReady.title', 'popup.notReady.text', 'btn.refresh', () => { chrome.tabs.reload(tabId); window.close(); }));
  };
}

// Style cards drawn live with the account's name (same default as the overlay panel: saved text,
// else display name without emoji, else @handle). Follower slots are placeholder dots; only the
// owner avatar is loaded, so this stays fast. Thumbnails keep the owner's name even when another
// username is typed (looking that account up would cost an extra request).
async function liveThumbs(cards, me) {
  try {
    const { text, font } = await XAMX.defaultTextFor(me);
    window.__thumbMs = await XAMX.liveThumbs(cards, me, text, font);
  } catch (e) { window.__thumbMs = -1; }   // keep the static images
}

async function main() {
  await XAMX.initLang(document.getElementById('lang'));
  const st = document.createElement('style'); st.textContent = XAMX.SETTINGS_CSS; document.head.append(st);
  document.getElementById('author').append(XAMX.authorLink());
  settings = XAMX.settingsOf(await XAMX.getPrefs());
  XAM_I18N.onChange(() => rerender());
  // @demo-start (stripped from the Chrome Web Store build)
  const DP = new URLSearchParams(location.search), demo = DP.get('demo');
  if (DP.get('lang')) await XAM_I18N.set(DP.get('lang'));
  if (demo === 'ready') return ready(0, { name: DP.get('name') || 'Catcher', screen_name: DP.get('handle') || 'Catcher', followers_count: +(DP.get('n') || 1234), avatar: 'demo/avatars/u0.png' });
  // @demo-end
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !XAMX.isXUrl(tab.url)) return message('🌐', 'popup.notX.title', 'popup.notX.text', 'btn.openX', openX(null));
  const notReady = () => message('🔄', 'popup.notReady.title', 'popup.notReady.text', 'btn.refresh', () => { chrome.tabs.reload(tab.id); window.close(); });
  try { await XAMX.inject(tab.id); } catch (_) { return notReady(); }
  const me = await XAMX.send(tab.id, { type: 'xam:whoami' });
  if (!me || me.error) return notReady();
  if (!me.loggedIn) return message('🔑', 'popup.login.title', 'popup.login.text', 'btn.login', openX(tab.id, 'login'));
  if (me.screen_name) {
    const r = await XAMX.lookup(tab.id, me.screen_name);
    if (r.user) Object.assign(me, { name: r.user.name, avatar: r.user.avatar || me.avatar, followers_count: r.user.followers_count, id: r.user.id });
  }
  ready(tab.id, me);
}
main().catch(() => message('😵', 'popup.oops.title', 'popup.oops.text'));
