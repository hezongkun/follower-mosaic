// Tiny isolated-world content script on x.com. Only acts when the panel itself reloaded this tab
// once as a fallback (resume flag in sessionStorage, < 2 min old, same path): it asks the
// extension to re-open the panel so reading continues. Otherwise it does nothing.
(() => {
  let r = null;
  try { r = JSON.parse(sessionStorage.getItem('xam:resume') || 'null'); if (r) sessionStorage.removeItem('xam:resume'); } catch (_) { return; }
  if (!r || !r.o || !(Date.now() - r.ts < 120000) || location.pathname.toLowerCase() !== String(r.path || '').toLowerCase()) return;
  try { chrome.runtime.sendMessage({ type: 'xam:resume', opts: { ...r.o, carry: r.carry } }); } catch (_) {}
})();
