// Runs in the x.com page's own JavaScript world (MAIN). Registered as a content script at
// document_start (so it sees X's very first requests), and injected again on "Generate" for tabs
// opened before the extension was installed (guarded, runs once).
// It watches the page's OWN GraphQL requests for the follower list and profile
// (Followers / BlueVerifiedFollowers / UserByScreenName) and remembers how X called them:
// queryId, variables, features, fieldToggles and request headers, plus the response, in memory
// only. Nothing is sent anywhere and nothing is logged to the console until the user starts the
// extension ("arm"). Later pages are requested the same way with only the cursor changed.
// Read-only: GET requests to those three operations only. Talks to the overlay (isolated world)
// via window.postMessage. Logs never contain header values, cookies or tokens.
(() => {
  if (window.__XAM_CAP__) return;
  const OPS = /\/i\/api\/graphql\/([\w-]+)\/(Followers|BlueVerifiedFollowers|UserByScreenName)$/;
  const GQL = /\/i\/api\/graphql\/[\w-]+\/\w+/;
  const FOL = /^(Followers|BlueVerifiedFollowers)$/;
  const cap = { tpl: {}, any: null, seq: 0, armed: false, early: document.readyState === 'loading', at: Math.round(performance.now()), buf: [], first: {}, logs: [] };
  Object.defineProperty(window, '__XAM_CAP__', { value: { installed: true }, configurable: false });
  const ofetch = window.fetch;
  const pathOf = (url) => { try { return new URL(url, location.href).pathname; } catch (_) { return ''; } };
  const opOf = (p) => (p.match(/\/i\/api\/graphql\/[\w-]+\/(\w+)/) || [])[1] || '?';
  const short = (c) => (c ? '…' + String(c).slice(-6) : '-');
  const cookie = (n) => (document.cookie.match(new RegExp('(?:^|;\\s*)' + n + '=([^;]+)')) || [])[1];
  const post = (msg) => window.postMessage({ __xam: 'main', ...msg }, location.origin);
  function log(m, d) {
    const e = { t: Math.round(performance.now()), w: 'main', m, ...(d || {}) };
    cap.logs.push(e); if (cap.logs.length > 200) cap.logs.shift();
    if (cap.armed) { console.log('[FollowerMosaic]', m, d || ''); post({ type: 'log', entry: e }); }
  }
  const hdrs = (h) => {
    const o = {};
    try {
      if (!h) return o;
      if (typeof h.forEach === 'function' && !Array.isArray(h)) h.forEach((v, k) => (o[k.toLowerCase()] = v));
      else if (Array.isArray(h)) h.forEach(([k, v]) => (o[String(k).toLowerCase()] = String(v)));
      else for (const k of Object.keys(h)) o[k.toLowerCase()] = String(h[k]);
    } catch (_) {}
    return o;
  };
  const varsOf = (url) => { try { return JSON.parse(new URL(url, location.href).searchParams.get('variables') || '{}'); } catch (_) { return {}; } };
  // tell the overlay a follower request has started (so it waits for the response instead of assuming the end)
  function started(url, via) {
    const p = pathOf(url), m = p.match(OPS), v = m ? varsOf(url) : null;
    log('request', { op: opOf(p), via, cursor: v ? short(v.cursor) : undefined });
    if (m && cap.armed) post({ type: 'started', item: { op: m[2], variables: v } });
  }

  function record(url, method, headers, status, json, ms, via) {
    if (method !== 'GET') return;
    let u; try { u = new URL(url, location.href); } catch (_) { return; }
    if (!GQL.test(u.pathname)) return;
    if (headers.authorization) cap.any = { headers };       // generic template from any page GraphQL call
    const m = u.pathname.match(OPS);
    log('response', { op: opOf(u.pathname), status, ms, via, ...(m && FOL.test(m[2]) ? { users: countUsers(json) } : {}) });
    if (!m) return;
    const params = {};
    u.searchParams.forEach((v, k) => { try { params[k] = JSON.parse(v); } catch (_) { params[k] = v; } });
    const op = m[2];
    cap.tpl[op] = { queryId: m[1], path: u.pathname, params, headers };
    const item = { seq: ++cap.seq, op, queryId: m[1], status, json, variables: params.variables || {}, at: Math.round(performance.now()) };
    cap.buf.push(item); if (cap.buf.length > 12) cap.buf.shift();
    // first page of each list stays available even after the user scrolled further
    if (FOL.test(op) && !item.variables.cursor && status === 200) cap.first[op + ':' + item.variables.userId] = item;
    if (op === 'UserByScreenName' && status === 200) cap.first['U:' + String(item.variables.screen_name || '').toLowerCase()] = item;
    if (cap.armed) post({ type: 'captured', item });
  }
  function countUsers(j) {
    try {
      const tl = j.data.user.result.timeline.timeline || j.data.user.result.timeline; let n = 0;
      for (const ins of tl.instructions || []) for (const e of ins.entries || []) if (!/^cursor-/.test(e.entryId || '')) n++;
      return n;
    } catch (_) { return null; }
  }

  window.fetch = function (input, init) {
    const p = ofetch.apply(this, arguments);
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input && input.url;
      if (url && GQL.test(pathOf(url))) {
        const t0 = performance.now();
        started(url, 'fetch');
        const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        const headers = { ...hdrs(input && input.headers), ...hdrs(init && init.headers) };
        p.then((r) => {
          const ms = Math.round(performance.now() - t0);
          if (!OPS.test(pathOf(url))) return record(url, method, headers, r.status, null, ms, 'fetch');
          r.clone().json().then((j) => record(url, method, headers, r.status, j, ms, 'fetch'), () => record(url, method, headers, r.status, null, ms, 'fetch'));
        }, () => log('response', { op: opOf(pathOf(url)), status: 0, via: 'fetch', error: 'network' }));
      }
    } catch (_) {}
    return p;
  };

  const XP = XMLHttpRequest.prototype, xo = XP.open, xs = XP.send, xh = XP.setRequestHeader;
  XP.open = function (m, url) { this.__xam = { m: String(m).toUpperCase(), url: String(url), h: {} }; return xo.apply(this, arguments); };
  XP.setRequestHeader = function (k, v) { if (this.__xam) this.__xam.h[String(k).toLowerCase()] = String(v); return xh.apply(this, arguments); };
  XP.send = function () {
    const x = this.__xam;
    if (x && GQL.test(pathOf(x.url))) {
      const t0 = performance.now();
      started(x.url, 'xhr');
      this.addEventListener('loadend', () => {
        let j = null;
        if (OPS.test(pathOf(x.url))) {
          try { j = this.responseType === 'json' ? this.response : JSON.parse(this.responseText); } catch (_) {}
        }
        record(x.url, x.m, x.h, this.status, j, Math.round(performance.now() - t0), 'xhr');
      });
    }
    return xs.apply(this, arguments);
  };

  // Backup: even if X's network layer kept a private reference to fetch, the browser still lists
  // every request URL (queryId + variables + features + fieldToggles) as a resource timing entry.
  function fromEntry(name) {
    let u; try { u = new URL(name); } catch (_) { return; }
    const m = u.pathname.match(OPS);
    if (!m || (cap.tpl[m[2]] && cap.tpl[m[2]].headers)) return;
    const params = {};
    u.searchParams.forEach((v, k) => { try { params[k] = JSON.parse(v); } catch (_) { params[k] = v; } });
    if (!cap.tpl[m[2]]) log('perf-entry', { op: m[2], queryId: m[1] });
    cap.tpl[m[2]] = { queryId: m[1], path: u.pathname, params, headers: null };
    if (cap.armed) post({ type: 'seen', op: m[2], queryId: m[1], variables: params.variables || {} });
  }
  const scanPerf = () => { try { performance.getEntriesByType('resource').forEach((e) => fromEntry(e.name)); } catch (_) {} };
  scanPerf();
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => fromEntry(e.name))).observe({ type: 'resource', buffered: false }); } catch (_) {}

  // Request another page the same way X did, changing only `variables` (cursor/count).
  async function replay(op, variables, fallbackHeaders) {
    const t = cap.tpl[op];
    if (!t) return { ok: false, status: 0, error: 'no-template', op };
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(t.params)) qs.set(k, JSON.stringify(k === 'variables' ? variables : v));
    if (!('variables' in t.params)) qs.set('variables', JSON.stringify(variables));
    // headers X itself sent (incl. x-client-transaction-id); else those of any other page GraphQL call
    const headers = { ...(t.headers || (cap.any && cap.any.headers) || fallbackHeaders || {}) };
    delete headers['content-length'];
    const ct0 = cookie('ct0'); if (ct0) headers['x-csrf-token'] = ct0;
    const src = t.headers ? 'captured' : cap.any ? 'any' : 'fallback';
    let r; const t0 = performance.now();
    try { r = await ofetch(location.origin + t.path + '?' + qs, { method: 'GET', credentials: 'include', headers, signal: AbortSignal.timeout(20000) }); }
    catch (e) { log('replay', { op, status: 0, error: e && e.name === 'TimeoutError' ? 'timeout' : 'network', headers: src }); return { ok: false, status: 0, error: 'network', op, queryId: t.queryId }; }
    let json = null; try { json = await r.json(); } catch (_) {}
    log('replay', { op, status: r.status, ms: Math.round(performance.now() - t0), cursor: short(variables.cursor), users: countUsers(json), headers: src });
    return { ok: r.ok, status: r.status, json, op, queryId: t.queryId,
      reset: Number(r.headers.get('x-rate-limit-reset')) || 0, remaining: r.headers.get('x-rate-limit-remaining') };
  }
  // Page-equivalent headers taken from any GraphQL call the page made (for the bundle fallback).
  function auth() {
    const h = (cap.any && cap.any.headers) || {}, o = {};
    for (const k of ['authorization', 'x-twitter-auth-type', 'x-twitter-active-user', 'x-client-language']) if (h[k]) o[k] = h[k];
    if (!o['x-client-language']) o['x-client-language'] = (document.documentElement.lang || navigator.language || 'en').slice(0, 5);
    return o;
  }

  // In-app (SPA) navigation: X's router reacts to popstate, so no page reload is needed.
  function nav(path) {
    if (location.pathname + location.search === path) return false;
    history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    return true;
  }

  window.addEventListener('message', async (e) => {
    const d = e.data;
    if (e.source !== window || !d || d.__xam !== 'iso' || typeof d.type !== 'string') return;
    let result = null;
    if (d.type === 'replay' && /^(Followers|BlueVerifiedFollowers|UserByScreenName)$/.test(d.op)) result = await replay(d.op, d.variables || {}, d.fallbackHeaders);
    else if (d.type === 'nav' && typeof d.path === 'string' && d.path.startsWith('/')) { const moved = nav(d.path); log('nav', { to: d.path, moved }); result = { ok: true, moved }; }
    else if (d.type === 'scroll') {
      // second try: move up a little first so X's "load more" sentinel re-enters the viewport
      if (d.nudge) { window.scrollBy(0, -700); await new Promise((r) => setTimeout(r, 300)); }
      window.scrollTo(0, document.documentElement.scrollHeight); log('scroll', { nudge: !!d.nudge, h: document.documentElement.scrollHeight }); result = { ok: true };
    }
    else if (d.type === 'arm') {
      // the user started the extension: from now on report captures (and log to the console)
      cap.armed = true;
      log('armed', { early: cap.early, installedMs: cap.at, ops: Object.keys(cap.tpl), buffered: cap.buf.length, firstPages: Object.keys(cap.first).length, anyGql: !!cap.any });
      const seen = new Set(), items = [];
      for (const it of [...Object.values(cap.first), ...cap.buf]) if (!seen.has(it.seq)) { seen.add(it.seq); items.push(it); }
      result = { ok: true, path: location.pathname + location.search, early: cap.early, installedMs: cap.at, items: items.sort((a, b) => a.seq - b.seq), logs: cap.logs.slice(-200) };
    }
    else if (d.type === 'state') result = { ok: true, ops: Object.keys(cap.tpl), any: !!cap.any, path: location.pathname + location.search };
    else if (d.type === 'perf') { scanPerf(); result = { ok: true, ops: Object.keys(cap.tpl) }; }
    else if (d.type === 'auth') result = { ok: true, headers: auth(), captured: !!cap.any };
    else if (d.type === 'template') result = { ok: true, tpl: cap.tpl[d.op] ? { queryId: cap.tpl[d.op].queryId, variables: cap.tpl[d.op].params.variables || {}, captured: !!cap.tpl[d.op].headers } : null };
    else return;
    post({ type: 'reply', id: d.id, result });
  });
  log('hook installed', { early: cap.early, readyState: document.readyState, path: location.pathname });
  post({ type: 'ready' });
})();
