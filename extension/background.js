// Service worker: its only job is to re-open the panel after the panel's own one-time reload
// fallback (message from lib/resume.js in the same x.com tab). Options are re-validated here.
importScripts('lib/common.js');
const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !msg || msg.type !== 'xam:resume' || !sender.tab || !XAMX.isXUrl(sender.tab.url)) return;
  const o = msg.opts || {}, s = XAMX.settingsOf(o), me = o.me && typeof o.me === 'object' ? o.me : null;
  const carry = o.carry && typeof o.carry === 'object' ? { t0: Number(o.carry.t0) || 0, log: Array.isArray(o.carry.log) ? o.carry.log.slice(-200) : [], steps: Array.isArray(o.carry.steps) ? o.carry.steps.slice(0, 30) : [] } : null;
  const opts = {
    style: XAMX.STYLES.some((x) => x.id === o.style) ? o.style : 'text',
    target: /^\w{1,15}$/.test(o.target || '') ? o.target : '',
    delay: s.delay, cap: s.cap, resume: 1,
    origPath: str(o.origPath, 300).startsWith('/') ? str(o.origPath, 300) : null,
    me: me && { id: /^\d+$/.test(me.id || '') ? me.id : null, screen_name: str(me.screen_name, 15), name: str(me.name, 100), avatar: /^https:\/\//.test(me.avatar || '') ? str(me.avatar, 500) : '', followers_count: Number.isFinite(me.followers_count) ? me.followers_count : null },
    carry,
  };
  XAMX.startOverlay(sender.tab.id, opts).then(() => sendResponse({ ok: true }), (e) => sendResponse({ ok: false, error: String(e) }));
  return true;
});
