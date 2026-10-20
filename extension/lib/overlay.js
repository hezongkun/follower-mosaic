// In-page overlay, injected into the user's own x.com tab (isolated world) when they click
// "Generate". Everything happens here, inside x.com, with the page's own session: progress,
// preview, style/text/font/language controls and the download. Nothing is sent anywhere else.
// Follower pages come from X's OWN requests, captured by lib/capture-main.js (MAIN world,
// installed at document_start). Every step is logged ([FollowerMosaic] in the page console and
// an in-memory ring buffer) so "Copy diagnostics" can explain what happened. Logs never contain
// cookies, tokens or header values.
(() => {
if (window.__XAM_OVERLAY__) return;
const t = (k, v) => XAM_I18N.t(k, v);
const SETTINGS = { JITTER_MS: 1500, MAX_429: 3, STEP_MS: 6000, SCROLL_WAIT_MS: 4000, STUCK_MS: 45000, HARD_MAX: 5000, RESUME_KEY: 'xam:resume' };
// user settings (pause per page, max followers) live in job.set and can change while reading
const THEMES = ['midnight', 'aurora', 'sunset', 'mono', 'light'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtMin = (sec) => (sec < 60 ? t('time.sec', { n: Math.max(1, Math.round(sec)) }) : t('time.min', { n: Math.round(sec / 60) }));
const short = (c) => (c ? '…' + String(c).slice(-6) : '-');

// ---------- logging (ring buffer + page console) ----------
let LOG = [], T0 = Date.now();
function push(e) { LOG.push(e); if (LOG.length > 400) LOG.shift(); }
function log(m, d) { push({ t: Date.now() - T0, w: 'iso', m, ...(d || {}) }); try { console.log('[FollowerMosaic]', m, d || ''); } catch (_) {} }
window.__XAM_LOG__ = log;      // content.js (same isolated world) logs through this
const SECRET_KEYS = /^(authorization|cookie|ct0|auth_token|twid|x-csrf-token|x-client-transaction-id|x-guest-token|bearer|token)$/i;
function redact(v) {
  const s = JSON.stringify(v, (k, x) => (SECRET_KEYS.test(k) ? '[redacted]' : x));
  return s.replace(/Bearer\s+[\w%.\-]+/gi, 'Bearer [redacted]')
    .replace(/\b(ct0|auth_token|twid|kdt|att)=[^;"\s]+/gi, '$1=[redacted]')
    .replace(/\b[a-f0-9]{32,}\b/gi, '[redacted]');
}

// ---------- bridge to the MAIN-world capture script ----------
const captured = [], started = []; const pending = new Map(); let waiters = [];
window.addEventListener('message', (e) => {
  const d = e.data;
  if (e.source !== window || !d || d.__xam !== 'main') return;
  if (d.type === 'captured' && d.item) { addCaptured(d.item); job.alive = Date.now(); }
  if (d.type === 'started' && d.item) {
    started.push(d.item); if (started.length > 50) started.shift(); job.alive = Date.now();
    if (job.timing && job.timing.firstRequestMs == null && /Followers$/.test(d.item.op)) job.timing.firstRequestMs = Date.now() - job.t0;
  }
  if (d.type === 'log' && d.entry) push({ ...d.entry, t: Date.now() - T0 });
  if (d.type === 'reply' && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); }
  waiters.slice().forEach((f) => f());
});
function addCaptured(it) { if (captured.some((c) => c.seq === it.seq)) return; captured.push(it); if (captured.length > 60) captured.shift(); }
function main(type, data = {}, timeout = 25000) {
  return new Promise((resolve) => {
    const id = 'x' + Math.random().toString(36).slice(2);
    const tm = setTimeout(() => { pending.delete(id); log('bridge timeout', { type }); resolve({ ok: false, status: 0, error: 'timeout:' + type }); }, timeout);
    pending.set(id, (r) => { clearTimeout(tm); resolve(r || { ok: false, status: 0 }); });
    window.postMessage({ __xam: 'iso', type, id, ...data }, location.origin);
  });
}
const halted = () => job.stop || job.dead;
function waitFor(pred, ms) {
  return new Promise((resolve) => {
    let tm = null, iv = null;
    const done = (v) => { clearTimeout(tm); clearInterval(iv); waiters = waiters.filter((f) => f !== check); resolve(v); };
    const check = () => { if (halted()) return done(null); const v = pred(); if (v) done(v); };
    tm = setTimeout(() => done(null), ms);
    iv = setInterval(check, 500);          // also notices DOM / state changes, and a stop
    waiters.push(check); check();
  });
}
const withTimeout = (p, ms, what) => Promise.race([p, sleep(ms).then(() => ({ ok: false, status: 0, error: 'timeout:' + what }))]);

// ---------- errors ----------
class Friendly extends Error {
  constructor(emoji, key, action, vars, details) { super(key); Object.assign(this, { emoji, key, action, vars, details }); }
}
const LOGIN = { label: 'btn.login', run: () => location.assign('/login') };
const RELOAD = { label: 'btn.refresh', run: () => location.reload() };
const detailsOf = (r) => r ? [r.op && 'op=' + r.op, 'HTTP ' + (r.status ?? '?'), r.mode && 'mode=' + r.mode, r.queryId && 'queryId=' + r.queryId,
  r.error && 'error=' + String(r.error).slice(0, 120)].filter(Boolean).join(' · ') : '';
function failure(r) {
  const d = detailsOf(r);
  if (r.status === 401 || r.status === 403 || r.error === 'not-logged-in') return new Friendly('🔑', 'err.login', LOGIN, null, d);
  if (r.status === 404 || r.status === 400) return new Friendly('🛠️', 'err.updated', RELOAD, null, d);
  if (r.status === 429) return new Friendly('⏸️', 'err.rate', null, null, d);
  if (r.error === 'network' || r.status === 0) return new Friendly('📶', 'err.network', RELOAD, null, d);
  return new Friendly('😵', 'err.oops', RELOAD, null, d);
}
function extract(json) {
  const res = json?.data?.user?.result;
  const tl = res?.timeline?.timeline || res?.timeline;
  let cursor = null, terminate = false, items = 0; const users = [];
  for (const ins of tl?.instructions || []) {
    if (ins.type === 'TimelineTerminateTimeline' && (!ins.direction || /bottom/i.test(ins.direction))) terminate = true;
    for (const e of ins.entries || (ins.entry ? [ins.entry] : [])) {
      const c = e.content || {};
      if (c.cursorType === 'Bottom' || /^cursor-bottom/.test(e.entryId || '')) { cursor = c.value; continue; }
      if (c.cursorType || /^cursor-/.test(e.entryId || '')) continue;
      items++;
      const u = XAMX.parseUser(c.itemContent?.user_results?.result);
      if (u) users.push(u);
    }
  }
  return { users, cursor, terminate, items };
}
// ---------- UI ----------
const CSS = `
:host { all: initial }
.bk { position:fixed; inset:0; z-index:2147483647; background:rgba(5,8,16,.72); backdrop-filter:blur(3px); display:flex; align-items:flex-start; justify-content:center; overflow:auto; padding:24px 12px;
  font:15px/1.55 system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif; color:#eef2fa }
.pn { width:100%; max-width:940px; background:#0b0f1a; border:1px solid #26314b; border-radius:22px; padding:18px 22px 14px; box-shadow:0 30px 90px #000c }
header { display:flex; align-items:center; gap:10px; margin-bottom:14px } header b { font-size:20px; flex:1 }
.chip { padding:4px 12px; border-radius:999px; border:1px solid #26314b; background:transparent; color:#eef2fa; font:600 13px/1.4 system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif; cursor:pointer }
.chip:hover { border-color:#1d9bf0 }
.box { background:#141b2d; border:1px solid #26314b; border-radius:18px; padding:20px }
.hidden { display:none !important }
.who { display:flex; align-items:center; gap:12px; margin-bottom:14px } .who img { width:52px; height:52px; border-radius:50%; border:2px solid #1d9bf0; object-fit:cover }
.who small { display:block; color:#8e9ab4 }
#pct { font-size:40px; font-weight:900 } .bar { height:12px; border-radius:99px; background:#0e1424; border:1px solid #26314b; overflow:hidden }
.bar i { display:block; height:100%; width:0; background:linear-gradient(90deg,#1d9bf0,#7c5cff); transition:width .4s }
#ptext { font-size:16px; margin:10px 0 0 } #eta { color:#8e9ab4; margin-top:4px }
.tip { margin-top:14px; padding:12px 14px; border-radius:12px; background:#1b2338; color:#cdd6ea; font-size:14px }
canvas#out { display:block; max-width:100%; max-height:56vh; margin:0 auto; border-radius:14px; box-shadow:0 12px 40px #000a }
.lbl { color:#8e9ab4; font-size:13px; margin:14px 0 6px }
.opts { max-width:620px; margin:0 auto }
.opts label { display:block; font-size:17px; font-weight:800; margin:16px 0 6px }
textarea { width:100%; box-sizing:border-box; padding:10px 14px; border-radius:14px; border:2px solid #26314b; background:#0e1424; color:#eef2fa; font:700 20px/1.4 system-ui,"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif; resize:none }
textarea:focus { outline:none; border-color:#1d9bf0 }
.hint { color:#8e9ab4; font-size:12px; margin:5px 2px 8px }
.fonts { display:flex; flex-wrap:wrap; gap:8px }
.fonts button, .card { border:2px solid #26314b; background:#0e1424; color:#eef2fa; border-radius:12px; cursor:pointer; font:15px/1.4 system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif }
.fonts button { flex:1 1 0; min-width:86px; padding:8px 6px; font-size:15px; white-space:nowrap }
.on { border-color:#1d9bf0 !important; box-shadow:0 0 0 2px #1d9bf044 }
.cards { display:grid; grid-auto-flow:column; grid-auto-columns:1fr; gap:8px }
.card { padding:0; overflow:hidden; font-size:12px } .card canvas { display:block; width:100%; aspect-ratio:1 } .card span { display:block; padding:3px 0 4px }
.actions { display:flex; gap:12px; margin-top:16px }
.big { flex:2; padding:14px; border:0; border-radius:14px; background:linear-gradient(90deg,#1d9bf0,#7c5cff); color:#fff; font:800 17px/1.2 system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif; cursor:pointer }
.big.gray { flex:1; background:#26314b } .big:disabled { opacity:.5; cursor:default }
.notice { margin-bottom:12px; padding:10px 14px; border-radius:12px; background:#3a2a0b; color:#fcd34d; font-size:14px }
.mut { color:#8e9ab4 } .center { text-align:center }
.msg { text-align:center; padding:10px } .msg .emoji { font-size:46px } .msg .big { max-width:300px; margin:14px auto 0; display:block; width:100% }
details { margin:14px auto 0; max-width:560px; text-align:left; color:#8e9ab4; font-size:12px } details code { display:block; margin-top:6px; padding:8px 10px; border-radius:8px; background:#0e1424; color:#cdd6ea; word-break:break-all; user-select:all }
.foot { color:#8e9ab4; font-size:12px; text-align:center; margin-top:12px }
.settings { margin-top:12px } .notice.info { background:#10233a; color:#9ccaf5 }
#elapsed { color:#8e9ab4; font-size:12px; margin-top:2px } #firstnote { margin-top:8px; font-size:13px; color:#9ccaf5 }
#pct.busy { display:flex; align-items:center; gap:12px; font-size:20px; font-weight:800; height:60px }
#pct.busy::before { content:''; flex:none; width:30px; height:30px; border-radius:50%; border:4px solid #26314b; border-top-color:#1d9bf0; animation:xspin .8s linear infinite }
@keyframes xspin { to { transform:rotate(360deg) } }
.bar.indet i { width:35% !important; transition:none; animation:xslide 1.4s ease-in-out infinite }
@keyframes xslide { 0% { transform:translateX(-110%) } 100% { transform:translateX(300%) } }
.diagrow { margin-top:10px; text-align:right } .diagrow .chip, .msg .chip { font-size:12px; padding:3px 10px }
.diagok { color:#86efac; font-size:12px; margin-left:8px }
textarea.diag { display:block; width:100%; height:140px; margin-top:8px; font:11px/1.4 ui-monospace,Menlo,Consolas,monospace; color:#cdd6ea; background:#0e1424; border:1px solid #26314b; border-radius:8px }`;
const HTML = `<div class="bk"><div class="pn">
<header><b data-i18n="app.name"></b><button class="chip" id="lang"></button><button class="chip" id="close" data-i18n="btn.close"></button></header>
<section id="progress" class="box">
  <div class="who"><img id="av" alt=""><div><b id="nm" data-i18n="progress.preparing"></b><small id="hd"></small></div></div>
  <div id="pct">0%</div><div class="bar" id="bar"><i id="barfill"></i></div>
  <p id="ptext" data-i18n="progress.connecting"></p><div id="eta"></div><div id="elapsed"></div><div id="firstnote" class="hidden"></div>
  <div id="settings" class="settings"></div>
  <div class="tip" data-i18n-html="progress.tip"></div>
  <div class="diagrow" id="pdiag"></div>
</section>
<section id="result" class="box hidden">
  <div id="notice" class="notice hidden"></div>
  <canvas id="out" width="1200" height="675"></canvas>
  <div class="opts">
    <div id="textopts"><label for="txt" data-i18n="result.textLabel"></label>
      <textarea id="txt" rows="1" maxlength="40" spellcheck="false" data-i18n-ph="text.placeholder"></textarea>
      <div class="hint" data-i18n="result.textHint"></div><div class="fonts" id="fonts"></div></div>
    <div class="lbl center" data-i18n="result.styleLabel"></div><div class="cards" id="cards"></div>
  </div>
  <div class="actions"><button class="big" id="dl" data-i18n="btn.download"></button><button class="big gray" id="theme" data-i18n="btn.theme"></button></div>
  <p class="mut center" id="rinfo"></p>
</section>
<section id="error" class="box hidden"><div class="msg" id="errbox"></div></section>
<div class="foot"><span data-i18n="foot.result"></span> <span data-i18n="overlay.restore"></span><br><span id="author"></span></div>
</div></div>`;

let host = null, root = null, job = { stop: false };
const ui = { who: null, prog: null, err: null, info: null, origPath: null };
let state = null;
const $ = (id) => root.getElementById(id);
const show = (id) => ['progress', 'result', 'error'].forEach((s) => $(s).classList.toggle('hidden', s !== id));

function mount() {
  host = document.createElement('div');
  host.id = 'xam-overlay-host';
  root = host.attachShadow({ mode: 'closed' });
  const st = document.createElement('style'); st.textContent = CSS + XAMX.SETTINGS_CSS;
  const wrap = document.createElement('div'); wrap.innerHTML = HTML;   // static template, dictionary text is set via textContent
  root.append(st, wrap.firstElementChild);
  // keep X's keyboard shortcuts from firing while typing in the overlay
  for (const ev of ['keydown', 'keyup', 'keypress']) host.addEventListener(ev, (e) => e.stopPropagation());
  document.documentElement.appendChild(host);
  XAM_I18N.setRoot(root);
  $('close').onclick = close;
  $('author').append(XAMX.authorLink());
  $('pdiag').append(diagButton());
}
// "Copy diagnostics": JSON with version, browser, page path, steps and the last 200 log lines.
// Redacted: no cookies, tokens, authorization or transaction ids (they are never logged anyway).
function diag() {
  const err = ui.err && { key: ui.err.key, details: ui.err.details };
  let version = '?'; try { version = chrome.runtime.getManifest().version; } catch (_) {}
  return JSON.parse(redact({
    app: 'Follower Mosaic', version, ua: navigator.userAgent, lang: XAM_I18N.lang, url: location.origin + location.pathname,
    time: new Date().toISOString(), elapsedMs: Date.now() - (job.t0 || T0), view: root ? ['progress', 'result', 'error'].find((s) => !$(s).classList.contains('hidden')) : null,
    settings: job.set, resume: job.resume || 0, step: job.step || null, steps: job.steps || [], progress: ui.prog ? { got: ui.prog[0], expected: ui.prog[1] } : null,
    capture: job.capture || null, timing: job.timing || null, error: err, log: LOG.slice(-200),
  }));
}
function diagButton() {
  const wrap = document.createElement('div');
  const b = document.createElement('button'); b.className = 'chip'; b.type = 'button'; b.dataset.i18n = 'btn.diag'; b.textContent = t('btn.diag');
  const ok = document.createElement('span'); ok.className = 'diagok';
  b.onclick = async () => {
    const txt = JSON.stringify(diag(), null, 1);
    log('diagnostics copied', { bytes: txt.length });
    let done = false;
    try { await navigator.clipboard.writeText(txt); done = true; } catch (_) {}
    if (!done) {
      try { const ta = document.createElement('textarea'); ta.value = txt; root.append(ta); ta.select(); done = document.execCommand('copy'); ta.remove(); } catch (_) {}
    }
    if (done) { ok.textContent = t('diag.copied'); setTimeout(() => (ok.textContent = ''), 4000); return; }
    // clipboard blocked: show the text so it can be selected and copied by hand
    ok.textContent = t('diag.manual');
    let ta = wrap.querySelector('textarea'); if (!ta) { ta = document.createElement('textarea'); ta.className = 'diag'; ta.readOnly = true; wrap.append(ta); }
    ta.value = txt; ta.focus(); ta.select();
  };
  wrap.append(b, ok); return wrap;
}
function close() {
  job.stop = true;
  if (host) host.remove();
  host = root = null;
  XAM_I18N.setRoot(null);
  if (ui.origPath) main('nav', { path: ui.origPath }, 3000);   // back to where the user was
  ui.origPath = null;
}

function setWho(u) {
  ui.who = u;
  if (u.avatar) $('av').src = u.avatar; else $('av').style.visibility = 'hidden';
  $('nm').textContent = u.name || '@' + u.screen_name;
  $('hd').textContent = (u.screen_name ? '@' + u.screen_name : '') + (u.followers_count != null ? ' · ' + t('n.followers', { n: XAM_I18N.num(u.followers_count) }) : '');
}
function setProgress(got, expected, etaSec, textKey, vars) {
  ui.prog = [got, expected, etaSec, textKey, vars];
  const pct = Math.min(100, Math.round((got / Math.max(expected, 1)) * 100));
  // before the first page arrives: spinner + moving (indeterminate) bar instead of a frozen 0%
  const busy = job.phase === 'open';
  $('pct').classList.toggle('busy', busy); $('bar').classList.toggle('indet', busy);
  $('pct').textContent = busy ? t('progress.working') : pct + '%'; $('barfill').style.width = busy ? '' : pct + '%';
  $('firstnote').classList.toggle('hidden', !busy); $('firstnote').textContent = busy ? t('progress.firstNote') : '';
  $('ptext').textContent = textKey ? t(textKey, vars) : t('progress.found', { got: XAM_I18N.num(got), total: XAM_I18N.num(expected) });
  $('eta').textContent = etaSec != null ? t('progress.eta', { t: fmtMin(etaSec) }) : '';
}
function showError(e) {
  if (!(e instanceof Friendly)) e = new Friendly('😵', 'err.oops', RELOAD, null, String((e && e.message) || e || ''));
  ui.err = e; show('error');
  log('error shown', { key: e.key, details: e.details || '' });
  const box = $('errbox'); box.textContent = '';
  const em = document.createElement('div'); em.className = 'emoji'; em.textContent = e.emoji;
  const p1 = document.createElement('p'); const b = document.createElement('b'); b.textContent = t(e.key + '.title', e.vars); p1.append(b);
  const p2 = document.createElement('p'); p2.className = 'mut'; p2.textContent = t(e.key + '.text', e.vars);
  box.append(em, p1, p2);
  if (e.action) { const btn = document.createElement('button'); btn.className = 'big'; btn.textContent = t(e.action.label); btn.onclick = e.action.run; box.append(btn); }
  if (e.details) {
    const d = document.createElement('details'); const s = document.createElement('summary'); s.textContent = t('err.details');
    const c = document.createElement('code'); c.textContent = e.details; d.append(s, c); box.append(d);
  }
  const dr = document.createElement('div'); dr.className = 'diagrow'; dr.style.textAlign = 'center'; dr.append(diagButton()); box.append(dr);
}


// ---------- fetching (all inside this x.com tab) ----------
const STEP_N = 8;
function step(name, key, vars) {
  const now = Date.now(), prev = job.steps[job.steps.length - 1];
  if (prev && prev.ms == null) prev.ms = now - job.t0 - prev.at;
  job.step = name; job.steps.push({ name, at: now - job.t0 }); job.stepAt = now; job.stepKey = key || null; job.stepVars = vars || null;
  job.alive = now;                // a step advancing counts as progress (each step is time-bounded)
  log('step', { name, i: job.steps.length });
  if (key && root) setProgress(0, 1, null, key, vars);
  tick();
}
function stepResult(info) { const s = job.steps[job.steps.length - 1]; if (s) { Object.assign(s, info); s.ms = Date.now() - job.t0 - s.at; } }
function tick() {
  if (!root) return;
  // the first step's text moves on while X is slow to answer, so it never looks frozen
  if (job.phase === 'open' && job.step === 'nav' && job.stepKey) {
    const since = Date.now() - job.stepAt, key = since < 2500 ? job.stepKey : since < 10000 ? 'progress.waitFirst' : 'progress.slowFirst';
    if (!ui.prog || ui.prog[3] !== key) setProgress(0, 1, null, key, job.stepVars);
  }
  $('elapsed').textContent = job.phase === 'open' ? t('progress.elapsed', { t: fmtMin((Date.now() - job.t0) / 1000), i: Math.min(job.steps.length, STEP_N), n: STEP_N }) : '';
}
// links of X's own profile tabs ("Followers", "Verified Followers") in the page
const findLink = (h, tab) => [...document.querySelectorAll('a[href]')].find((a) => (a.getAttribute('href') || '').toLowerCase() === ('/' + h + '/' + tab).toLowerCase());

// Scroll mode: let X load the next page itself. If X issues no request after two scrolls to the
// bottom (~8 s), the list has ended (success). If a request started, wait for its response.
async function scrollPage(op, cursor) {
  const match = (x) => x.op === op && x.variables?.cursor === cursor;
  for (let i = 0; i < 2 && !halted(); i++) {
    main('scroll', { nudge: i > 0 });
    const c = await waitFor(() => captured.find(match) || (started.find(match) && 'started'), SETTINGS.SCROLL_WAIT_MS);
    const got = c === 'started' ? await waitFor(() => captured.find(match), 25000) : c;
    if (got) return { ok: got.status === 200, status: got.status, json: got.json, op, queryId: got.queryId, mode: 'scroll' };
    if (c === 'started') return { ok: false, status: 0, error: 'scroll: request started but no response', op, mode: 'scroll' };
  }
  return { ok: false, end: true, op, mode: 'scroll' };
}

async function fetchAll(o) {
  const handle = String(o.target || (o.me && o.me.screen_name) || '').replace(/^@/, '');
  if (!handle) throw new Friendly('🔑', 'err.noAccount', LOGIN, null, 'no screen_name');
  const lc = handle.toLowerCase(), fpath = '/' + handle + '/followers';
  setWho(o.target ? { screen_name: handle } : { ...o.me });
  job.phase = 'open';
  step(o.resume ? 'resume' : 'arm', o.resume ? 'step.resume' : 'progress.connecting');
  const st = await main('arm', {}, 5000);
  job.timing.armMs = Date.now() - job.t0;
  if (!st || !st.ok) { log('capture script not responding', { error: st && st.error }); throw new Friendly('🔄', 'popup.notReady', RELOAD, null, 'capture script not responding'); }
  for (const e of st.logs || []) push({ ...e, t: undefined, pre: true });
  for (const it of st.items || []) addCaptured({ ...it, pre: true });
  job.capture = { early: st.early, installedMs: st.installedMs, buffered: (st.items || []).map((i) => i.op + ':' + i.status + (i.variables?.cursor ? '+cursor' : '')) };
  log('capture', job.capture);
  ui.origPath = ui.origPath || (o.resume ? o.origPath : st.path) || st.path;
  const onF = () => location.pathname.toLowerCase() === fpath.toLowerCase();
  const isUser = (c) => String(c.variables?.screen_name || '').toLowerCase() === lc;
  const userOf = (c) => { const u = c && XAMX.parseUser(c.json?.data?.user?.result); return u && u.screen_name.toLowerCase() === lc ? u : null; };
  const ownerCap = () => { for (let i = captured.length - 1; i >= 0; i--) { const u = captured[i].op === 'UserByScreenName' && isUser(captured[i]) && userOf(captured[i]); if (u) return u; } return null; };
  let owner = ownerCap() || (!o.target && o.me && o.me.id ? { ...o.me } : null);
  // the newest first page of the follower list for this account (captured now, or before we started)
  const pick = (ops = ['Followers']) => {
    const id = (ownerCap() || owner || {}).id;
    for (let i = captured.length - 1; i >= 0; i--) {
      const c = captured[i];
      if (!ops.includes(c.op) || c.variables?.cursor) continue;
      if (id ? String(c.variables?.userId) !== String(id) : c.pre) continue;
      if (c.status === 200 && c.json) return { c };
      if (!c.pre) return { bad: c };
    }
    if (captured.some((c) => !c.pre && c.op === 'UserByScreenName' && isUser(c) && c.status === 200 && !userOf(c))) return { notfound: true };
    return null;
  };
  const until = (ms, ops) => waitFor(() => pick(ops), ms);
  const desc = (g) => (g ? (g.c ? 'page1 ' + g.c.op + (g.c.pre ? ' (already loaded)' : '') : g.bad ? 'HTTP ' + g.bad.status : 'not found') : 'nothing');
  let got = pick();
  if (got && got.c) { step('cached', 'step.cached'); stepResult({ ok: true, result: desc(got) }); }
  const attempt = async (name, key, vars, fn) => {
    if (got || halted()) return;
    step(name, key, vars);
    try { got = await fn(); } catch (e) { log('step error', { name, error: String((e && e.message) || e) }); }
    stepResult({ ok: !!(got && got.c), result: desc(got) });
    log('step result', { name, result: desc(got) });
  };
  // 1) let X itself open the follower list (in-app navigation, no reload) and capture its requests
  await attempt('nav', 'progress.opening', { u: handle }, async () => {
    if (onF()) {
      log('already on the followers page');
      const r = await until(o.resume ? SETTINGS.STEP_MS : 2500); if (r) return r;
      await main('nav', { path: '/' + handle }, 5000); await sleep(1200);
    }
    await main('nav', { path: fpath }, 5000);
    return until(SETTINGS.STEP_MS);
  });
  // 2) click X's own "Followers" tab (X's router may ignore pushState)
  await attempt('click', 'step.click', null, async () => {
    let a = findLink(handle, 'followers');
    if (onF() || !a) {
      const v = findLink(handle, 'verified_followers');
      if (v) { v.click(); log('clicked tab', { tab: 'verified_followers' }); await sleep(1500); }
      a = findLink(handle, 'followers');
    }
    if (!a) { log('no Followers tab link in the page'); return null; }
    a.click(); log('clicked tab', { tab: 'followers' });
    return until(SETTINGS.STEP_MS);
  });
  // 3) go to the profile and back to the list
  await attempt('navBack', 'step.navBack', null, async () => {
    await main('nav', { path: '/' + handle }, 5000); await sleep(1500);
    await main('nav', { path: fpath }, 5000);
    return until(SETTINGS.STEP_MS);
  });
  // 4) scroll: X loads the list lazily
  await attempt('scroll', 'step.scroll', null, async () => {
    main('scroll'); const r = await until(SETTINGS.SCROLL_WAIT_MS); if (r) return r;
    main('scroll', { nudge: true }); return until(SETTINGS.SCROLL_WAIT_MS);
  });
  if (halted()) return null;
  if (got && got.notfound) throw new Friendly('🔍', 'err.notFound', null, { u: handle }, 'op=UserByScreenName · HTTP 200 · empty user');

  const ensureOwner = async () => {
    owner = ownerCap() || owner;
    if (owner && owner.id) return owner;
    step('owner', 'step.owner', { u: handle });
    const ah = await main('auth', {}, 3000);
    const r = window.__XAM_GQL__ ? await withTimeout(window.__XAM_GQL__('UserByScreenName', { screen_name: handle, withSafetyModeUserFields: true }, { fieldToggles: { withAuxiliaryUserLabels: false } }, ah && ah.headers), 30000, 'owner') : null;
    owner = r && r.ok ? XAMX.parseUser(r.json?.data?.user?.result) : null;
    stepResult({ ok: !!owner, result: r ? 'HTTP ' + r.status : 'no proxy' });
    if (r && r.ok && !owner) throw new Friendly('🔍', 'err.notFound', null, { u: handle }, detailsOf(r));
    return owner;
  };

  let page1 = null, op = 'Followers', mode = 'replay', baseVars = null;
  const tries = [];
  const primary = got && got.bad ? { op: got.bad.op, status: got.bad.status, mode: 'captured', queryId: got.bad.queryId } : null;
  if (got && got.c) { page1 = got.c.json; op = got.c.op; baseVars = { ...got.c.variables }; delete baseVars.cursor; }
  if (primary) {
    tries.push(primary);
    // X's own request failed: try the verified-followers tab (BlueVerifiedFollowers)
    got = null;
    await attempt('verified', 'step.verified', null, async () => { await main('nav', { path: '/' + handle + '/verified_followers' }, 5000); return until(SETTINGS.STEP_MS, ['BlueVerifiedFollowers']); });
    if (got && got.c) { page1 = got.c.json; op = got.c.op; baseVars = { ...got.c.variables }; delete baseVars.cursor; }
  }
  if (!page1) {
    if (!(await ensureOwner()) || !owner.id) throw new Friendly('🔑', 'err.noAccount', LOGIN, null, 'UserByScreenName not captured');
    baseVars = { userId: owner.id, count: 20, includePromotedContent: false };
    // 5) X's request URL seen in resource timing (template without headers) → request it the same way
    step('perf', 'step.perf');
    await main('perf', {}, 3000);
    for (const cand of ['Followers', 'BlueVerifiedFollowers']) {
      const tp = await main('template', { op: cand }, 3000);
      if (!tp || !tp.tpl) continue;
      const vars = { ...tp.tpl.variables, userId: owner.id }; delete vars.cursor;
      const r = await main('replay', { op: cand, variables: vars, fallbackHeaders: window.__XAM_HEADERS__ && window.__XAM_HEADERS__() });
      r.mode = 'replay'; log('template replay', { op: cand, status: r.status, captured: tp.tpl.captured });
      if (r.ok && r.json) { page1 = r.json; op = cand; baseVars = vars; break; } tries.push(r);
    }
    stepResult({ ok: !!page1, result: page1 ? 'page1 ' + op : 'nothing' });
    // 6) queryId from X's JS bundle + page-equivalent headers (authorization from the page's own
    //    GraphQL calls, x-csrf-token from ct0, x-twitter-*, x-client-language)
    if (!page1 && window.__XAM_GQL__) {
      step('direct', 'step.direct');
      const ah = await main('auth', {}, 3000);
      for (const cand of ['Followers', 'BlueVerifiedFollowers']) {
        const r = await withTimeout(window.__XAM_GQL__(cand, baseVars, null, ah && ah.headers).catch((e) => ({ ok: false, status: 0, error: String(e) })), 35000, 'direct');
        if (r.ok && r.json) { page1 = r.json; op = cand; mode = 'bundle'; break; } tries.push({ ...r, op: r.op || cand, mode: 'bundle' });
      }
      stepResult({ ok: !!page1, result: page1 ? 'page1 ' + op : tries.map((x) => 'HTTP ' + x.status).join(',') });
    }
    // 7) once: full reload of the followers page (capture is installed at document_start), the
    //    panel re-opens by itself and continues (resume flag in sessionStorage)
    if (!page1 && !primary && !o.resume && !halted()) {
      step('reload', 'step.reload');
      job.reloading = true;
      try {
        sessionStorage.setItem(SETTINGS.RESUME_KEY, JSON.stringify({ ts: Date.now(), path: fpath,
          o: { style: o.style, target: o.target || '', delay: job.set.delay, cap: job.set.cap, me: o.me || null, resume: 1, origPath: ui.origPath },
          carry: { log: LOG.slice(-150), steps: job.steps, t0: job.t0 } }));
      } catch (e) { log('sessionStorage unavailable', { error: String(e) }); job.reloading = false; }
      if (job.reloading) { log('reloading', { to: fpath }); await sleep(200); location.assign(fpath); await sleep(20000); job.reloading = false; }
    }
    if (!page1) {
      if (!tries.length) throw new Friendly('🛠️', 'err.updated', RELOAD, null, 'no follower request captured (Followers / BlueVerifiedFollowers)');
      const e = failure(primary || tries[0]);
      e.details = tries.map(detailsOf).join('  ‖  ');
      throw e;
    }
  }
  if (!(await ensureOwner()) || !owner.id) throw new Friendly('🔑', 'err.noAccount', LOGIN, null, 'UserByScreenName not captured');
  setWho(owner);
  if (owner.followers_count === 0) throw new Friendly('🌱', 'err.noFollowers', null, { u: owner.screen_name });

  // 8) paginate exactly like X does, changing only the cursor; gentle pacing.
  // The list often ends before followers_count (X counts suspended / protected-hidden / deactivated
  // accounts too): any end-of-list signal finishes successfully.
  job.timing.firstPageMs = Date.now() - job.t0;
  log('first page', { ms: job.timing.firstPageMs, firstRequestMs: job.timing.firstRequestMs ?? null, armMs: job.timing.armMs ?? null, via: job.step, op, mode });
  job.phase = 'read'; job.alive = Date.now(); tick();
  log('reading', { op, mode, owner: owner.screen_name, followers_count: owner.followers_count, delay: job.set.delay, cap: job.set.cap });
  const set = job.set;
  const expectedNow = () => Math.min(set.cap, owner.followers_count ?? set.cap);
  const byId = new Map(); let json = page1, n429 = 0, partial = null, pages = 0, cursor = null, end = 'list', reqMs = 0;
  const eta = (got, perPage) => { const left = Math.max(0, Math.ceil((expectedNow() - got) / Math.max(perPage, 1))); return left * (set.delay + 0.75 + reqMs / 1000); };
  setProgress(0, expectedNow(), eta(0, 20), 'progress.reading');
  job.onSettings = () => { const g = Math.min(byId.size, set.cap); if (ui.prog && !ui.prog[3]) setProgress(g, expectedNow(), eta(g, 20)); };
  while (!halted()) {
    pages++;
    const { users, cursor: next, terminate, items } = extract(json);
    let added = 0;
    for (const u of users) if (!byId.has(u.id)) { byId.set(u.id, u); added++; }
    if (added) job.alive = Date.now();
    const got = Math.min(byId.size, set.cap);
    log('page', { n: pages, users: users.length, added, total: byId.size, cursor: short(next), terminate, mode });
    if (got >= set.cap) { end = 'cap'; break; }
    if (terminate || !next || next === cursor || !items || !added) { log('end of list', { reason: terminate ? 'terminate' : !next ? 'no cursor' : next === cursor ? 'same cursor' : !items ? 'no entries' : 'no new users' }); break; }
    setProgress(got, expectedNow(), eta(got, users.length || 20));
    cursor = next;
    await sleep(set.delay * 1000 + Math.random() * SETTINGS.JITTER_MS);
    if (halted()) break;
    let r; const t1 = Date.now();
    for (;;) {
      const vars = { ...baseVars, cursor };
      if (mode === 'scroll') r = await scrollPage(op, cursor);
      else if (mode === 'bundle') { const ah = await main('auth', {}, 3000); r = await withTimeout(window.__XAM_GQL__(op, vars, null, ah && ah.headers), 35000, 'direct'); }
      else { r = await main('replay', { op, variables: vars, fallbackHeaders: window.__XAM_HEADERS__ && window.__XAM_HEADERS__() }); r.mode = 'replay'; }
      if (r.ok || r.status !== 429 || n429 >= SETTINGS.MAX_429) break;
      n429++;
      const until = r.reset ? r.reset * 1000 + 5000 : Date.now() + 15 * 60 * 1000;
      log('rate limited (429)', { waitS: Math.round((until - Date.now()) / 1000), n: n429 });
      while (Date.now() < until && !halted()) { job.alive = Date.now(); setProgress(byId.size, expectedNow(), null, 'progress.paused', { t: fmtMin((until - Date.now()) / 1000) }); await sleep(1000); }
    }
    if (!r.ok && mode === 'replay' && pages === 1 && r.status !== 429) {
      // our own request was refused: let X load the next page itself (scrolling the list) and capture it
      log('replay refused → scroll mode', { status: r.status });
      mode = 'scroll';
      if (!onF()) { await main('nav', { path: fpath }, 5000); await sleep(1500); }
      r = await scrollPage(op, cursor);
    }
    reqMs = reqMs ? (reqMs * 0.7 + (Date.now() - t1) * 0.3) : Date.now() - t1;
    if (r.end) { log('end of list', { reason: 'scroll: no more requests' }); break; }   // scrolled to the bottom twice, X requested nothing more
    if (!r.ok) { log('page failed', { status: r.status, error: r.error, mode: r.mode }); partial = failure(r); break; }
    json = r.json;
  }
  job.onSettings = null;
  if (halted()) return null;
  if (!byId.size) {
    throw owner.protected ? new Friendly('🔒', 'err.protected', null, { u: owner.screen_name }) : new Friendly('🤔', 'err.empty', null, null, `op=${op} · mode=${mode} · 0 users`);
  }
  const n = Math.min(byId.size, set.cap);
  log('done', { n, end: partial ? 'error' : end, pages });
  setProgress(n, n, null, partial ? 'progress.done' : end === 'cap' ? 'done.cap' : 'done.visible', { n: XAM_I18N.num(n) });
  return { owner, end: partial ? 'error' : end, cap: set.cap, followers: [...byId.values()].slice(0, set.cap), partial: partial && { key: partial.key, vars: partial.vars, details: partial.details } };
}

// ---------- result ----------
let drawing = false, redraw = false;
async function draw() {
  if (drawing) { redraw = true; return; }
  drawing = true;
  try { do { redraw = false; await drawOnce(); } while (redraw && root); } finally { drawing = false; }
}
async function drawOnce() {
  if (!root) return;
  const d = state.data;
  $('textopts').classList.toggle('hidden', state.style !== 'text');
  $('dl').disabled = true; ui.info = null; $('rinfo').textContent = t('result.drawing');
  XAM.load({ owner: d.owner, followers: d.followers });
  const r = await XAM.render({ canvas: $('out'), style: state.style, theme: THEMES[state.theme], W: 2400, text: state.text, font: state.font,
    onProgress: (a, b) => root && ($('rinfo').textContent = t('result.loadingAvatars', { a, b })) });
  if (!root) return;
  ui.info = { n: d.followers.length, w: r.width, h: r.height, failed: r.failed };
  renderInfo(); $('dl').disabled = false;
}
function renderInfo() {
  const i = ui.info;
  if (i) $('rinfo').textContent = t('result.info', { n: XAM_I18N.num(i.n), w: i.w, h: i.h }) + (i.failed ? t('result.failed', { n: i.failed }) : '');
}
function renderNotice() {
  const d = state.data, n = $('notice');
  n.classList.toggle('info', !d.partial);
  if (d.partial) { n.classList.remove('hidden'); n.textContent = t('notice.partial', { title: t(d.partial.key + '.title', d.partial.vars), n: XAM_I18N.num(d.followers.length) }) + (d.partial.details ? '  (' + d.partial.details + ')' : ''); }
  else if (d.end === 'cap') { n.classList.remove('hidden'); n.textContent = t('notice.cap', { n: XAM_I18N.num(d.followers.length) }); }
  else if ((d.owner.followers_count || 0) > d.followers.length) { n.classList.remove('hidden'); n.textContent = t('notice.hidden', { n: XAM_I18N.num(d.followers.length), total: XAM_I18N.num(d.owner.followers_count) }); }
}
async function showResult() {
  show('result');
  const d = state.data;
  renderNotice();
  const { text, font, prefs } = await XAMX.defaultTextFor(d.owner);
  state.text = text; state.font = font;
  // style cards with live thumbnails (name + avatar), drawn before the main image
  const ids = XAMX.STYLES.map((s) => s.id);
  const sq = await XAMX.thumbs(d.owner, text, font, ids, 200);
  const cards = $('cards'); cards.textContent = '';
  for (const id of ids) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'card' + (id === state.style ? ' on' : '');
    const cv = sq[id] || document.createElement('canvas');
    const sp = document.createElement('span'); sp.dataset.i18n = 'style.' + id; sp.textContent = t('style.' + id);
    b.append(cv, sp);
    b.onclick = () => { cards.querySelectorAll('.card').forEach((c) => c.classList.remove('on')); b.classList.add('on'); state.style = id; draw(); };
    cards.append(b);
  }
  // text + fonts (remembered locally per account)
  const who = d.owner.screen_name || 'me', txt = $('txt');
  txt.value = state.text;
  const save = () => { prefs.texts = { ...(prefs.texts || {}), [who]: state.text }; prefs.font = state.font; chrome.storage.local.set({ prefs }); };
  let deb;
  txt.oninput = () => {
    const lines = txt.value.split('\n'); if (lines.length > 2) txt.value = lines.slice(0, 2).join('\n');
    txt.rows = Math.min(2, txt.value.split('\n').length);
    clearTimeout(deb); deb = setTimeout(() => { state.text = XAM.cleanText(txt.value) || XAM.defaultText(d.owner); save(); draw(); }, 450);
  };
  const box = $('fonts'); box.textContent = '';
  for (const [k, f] of Object.entries(XAM.fonts)) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.i18n = 'font.' + k; b.textContent = t('font.' + k);
    b.className = k === state.font ? 'on' : ''; b.style.fontFamily = f.family; b.style.fontWeight = f.weight;
    b.onclick = () => { box.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); state.font = k; save(); draw(); };
    box.append(b);
  }
  $('theme').onclick = () => { state.theme = (state.theme + 1) % THEMES.length; draw(); };
  $('dl').onclick = () => $('out').toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${t('file.prefix')}-${d.owner.screen_name || 'me'}-${state.style}.png`;
    root.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }, 'image/png');
  await draw();
}
function renderSettings() {
  if (!root || !job.set) return;
  XAMX.settingsUI($('settings'), job.set, (v) => { Object.assign(job.set, v); job.onSettings && job.onSettings(); });
}
function onLang() {
  if (!root) return;
  renderSettings();
  if (ui.who) setWho(ui.who);
  if (ui.prog) setProgress(...ui.prog);
  if (!$('error').classList.contains('hidden') && ui.err) showError(ui.err);
  if (state && state.data && !$('result').classList.contains('hidden')) { renderNotice(); renderInfo(); draw(); }
}

let langReady = false;
async function start(o) {
  if (host && !job.done && !job.stop) return;          // already running: keep going
  if (host) close();
  const carry = o.carry && typeof o.carry === 'object' ? o.carry : null;
  T0 = carry && carry.t0 ? carry.t0 : Date.now();
  LOG = carry && Array.isArray(carry.log) ? carry.log.slice(-200) : [];
  job = { stop: false, done: false, steps: carry && Array.isArray(carry.steps) ? carry.steps.slice(0, 30) : [], t0: T0, alive: Date.now(), resume: o.resume || 0, phase: 'open', timing: {} };
  log('start', { style: o.style, target: o.target ? 'other' : 'me', delay: o.delay, cap: o.cap, resume: o.resume || 0, path: location.pathname, ua: navigator.userAgent.replace(/^.*?(Chrome\/[\d.]+).*$/, '$1') });
  mount();
  await XAMX.initLang($('lang'));
  if (!langReady) { XAM_I18N.onChange(onLang); langReady = true; }
  state = { style: o.style || 'text', theme: 0, data: null, text: '', font: 'sans' };
  // pause per page + max followers: from the popup, else saved prefs; adjustable while reading
  const saved = XAMX.settingsOf(await XAMX.getPrefs());
  job.set = XAMX.settingsOf({ delay: o.delay ?? saved.delay, cap: o.cap ?? saved.cap });
  renderSettings();
  const my = job;
  // watchdog: never sit silently. Elapsed time + current step are shown every second; with no
  // progress for 45 s (no new followers, no step advancing) the panel shows an error with diagnostics.
  const stuck = new Promise((_, reject) => { my.stuckReject = reject; });
  stuck.catch(() => {});
  const dog = setInterval(() => {
    if (my !== job || my.done || my.stop) return clearInterval(dog);
    tick();
    if (!my.reloading && !my.dead && Date.now() - my.alive > SETTINGS.STUCK_MS) {
      my.dead = true;
      log('watchdog: no progress', { step: my.step, sinceMs: Date.now() - my.alive });
      my.stuckReject(new Friendly('⏳', 'err.stuck', RELOAD, null, 'no progress for 45 s · step=' + my.step + ' · ' + (my.steps || []).map((x) => x.name + ':' + (x.result || '…')).join(' → ')));
    }
  }, 1000);
  try {
    // @demo-start (stripped from the Chrome Web Store build)
    if (o.demoData) { state.data = o.demoData; my.done = true; return await showResult(); }
    // @demo-end
    const data = await Promise.race([fetchAll(o), stuck]);
    clearInterval(dog);
    if (!data || my.stop) return;
    state.data = data; my.done = true;
    await showResult();
  } catch (e) { clearInterval(dog); my.done = true; log('failed', { error: String((e && e.key) || (e && e.message) || e) }); if (!my.stop && root) { tick(); showError(e); } }
}
window.__XAM_OVERLAY__ = { start, close, get running() { return !!host && !job.done; },
  // for the automated tests (read-only status)
  get debug() { return root ? { view: ['progress', 'result', 'error'].find((s) => !$(s).classList.contains('hidden')), info: $('rinfo').textContent, notice: $('notice').classList.contains('hidden') ? '' : $('notice').textContent,
    ptext: $('ptext').textContent, elapsed: $('elapsed').textContent, steps: (job.steps || []).map((x) => x.name), err: ui.err && { key: ui.err.key, details: ui.err.details }, n: state && state.data ? state.data.followers.length : 0, drawing } : null; },
  diag: () => diag() };
})();
