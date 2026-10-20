// Runs in the x.com page's own JavaScript world (MAIN), injected only after the user clicks
// "Generate". It watches the page's OWN GraphQL requests for the follower list and profile
// (Followers / BlueVerifiedFollowers / UserByScreenName) and remembers exactly how X called
// them: queryId, variables, features, fieldToggles and request headers (incl. any
// x-client-transaction-id), plus the response. Later pages are requested the same way with
// only the cursor changed. Read-only: GET requests to those three operations only.
// Talks to the extension's overlay (isolated world) via window.postMessage.
(() => {
  if (window.__XAM_CAP__) return;
  const OPS = /\/i\/api\/graphql\/([\w-]+)\/(Followers|BlueVerifiedFollowers|UserByScreenName)$/;
  const GQL = /\/i\/api\/graphql\/[\w-]+\/\w+/;
  const cap = { tpl: {}, any: null, seq: 0 };
  window.__XAM_CAP__ = cap;
  const ofetch = window.fetch;
  const pathOf = (url) => { try { return new URL(url, location.href).pathname; } catch (_) { return ''; } };
  const cookie = (n) => (document.cookie.match(new RegExp('(?:^|;\\s*)' + n + '=([^;]+)')) || [])[1];
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
  const post = (msg) => window.postMessage({ __xam: 'main', ...msg }, location.origin);
  // tell the overlay a follower request has started (so it waits for the response instead of assuming the end)
  function started(url) {
    try {
      const u = new URL(url, location.href), m = u.pathname.match(OPS);
      if (!m) return;
      let variables = {}; try { variables = JSON.parse(u.searchParams.get('variables') || '{}'); } catch (_) {}
      post({ type: 'started', item: { op: m[2], variables } });
    } catch (_) {}
  }

  function record(url, method, headers, status, json) {
    if (method !== 'GET') return;
    let u; try { u = new URL(url, location.href); } catch (_) { return; }
    if (!GQL.test(u.pathname)) return;
    if (headers.authorization) cap.any = { headers };       // generic template from any page GraphQL call
    const m = u.pathname.match(OPS);
    if (!m) return;
    const params = {};
    u.searchParams.forEach((v, k) => { try { params[k] = JSON.parse(v); } catch (_) { params[k] = v; } });
    const op = m[2];
    cap.tpl[op] = { queryId: m[1], path: u.pathname, params, headers };
    post({ type: 'captured', item: { seq: ++cap.seq, op, queryId: m[1], status, json, variables: params.variables || {} } });
  }

  window.fetch = function (input, init) {
    const p = ofetch.apply(this, arguments);
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input && input.url;
      if (url && GQL.test(pathOf(url))) {
        started(url);
        const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        const headers = { ...hdrs(input && input.headers), ...hdrs(init && init.headers) };
        p.then((r) => {
          if (!OPS.test(pathOf(url))) return record(url, method, headers, r.status, null);
          r.clone().json().then((j) => record(url, method, headers, r.status, j), () => record(url, method, headers, r.status, null));
        }, () => {});
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
      started(x.url);
      this.addEventListener('load', () => {
        let j = null;
        if (OPS.test(pathOf(x.url))) {
          try { j = this.responseType === 'json' ? this.response : JSON.parse(this.responseText); } catch (_) {}
        }
        record(x.url, x.m, x.h, this.status, j);
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
    cap.tpl[m[2]] = { queryId: m[1], path: u.pathname, params, headers: null };
    post({ type: 'seen', op: m[2], queryId: m[1], variables: params.variables || {} });
  }
  try {
    performance.getEntriesByType('resource').forEach((e) => fromEntry(e.name));
    new PerformanceObserver((l) => l.getEntries().forEach((e) => fromEntry(e.name))).observe({ type: 'resource', buffered: false });
  } catch (_) {}

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
    let r;
    try { r = await ofetch(location.origin + t.path + '?' + qs, { method: 'GET', credentials: 'include', headers }); }
    catch (_) { return { ok: false, status: 0, error: 'network', op, queryId: t.queryId }; }
    let json = null; try { json = await r.json(); } catch (_) {}
    return { ok: r.ok, status: r.status, json, op, queryId: t.queryId,
      reset: Number(r.headers.get('x-rate-limit-reset')) || 0, remaining: r.headers.get('x-rate-limit-remaining') };
  }

  // In-app (SPA) navigation: X's router reacts to popstate, so no page reload is needed.
  function nav(path) {
    if (location.pathname + location.search === path) return;
    history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }

  window.addEventListener('message', async (e) => {
    const d = e.data;
    if (e.source !== window || !d || d.__xam !== 'iso' || typeof d.type !== 'string') return;
    let result = null;
    if (d.type === 'replay' && /^(Followers|BlueVerifiedFollowers|UserByScreenName)$/.test(d.op)) result = await replay(d.op, d.variables || {}, d.fallbackHeaders);
    else if (d.type === 'nav' && typeof d.path === 'string' && d.path.startsWith('/')) { nav(d.path); result = { ok: true }; }
    else if (d.type === 'scroll') {
      // second try: move up a little first so X's "load more" sentinel re-enters the viewport
      if (d.nudge) { window.scrollBy(0, -700); await new Promise((r) => setTimeout(r, 300)); }
      window.scrollTo(0, document.documentElement.scrollHeight); result = { ok: true };
    }
    else if (d.type === 'state') result = { ok: true, ops: Object.keys(cap.tpl), any: !!cap.any, path: location.pathname + location.search };
    else if (d.type === 'template') result = { ok: true, tpl: cap.tpl[d.op] ? { queryId: cap.tpl[d.op].queryId, variables: cap.tpl[d.op].params.variables || {}, captured: !!cap.tpl[d.op].headers } : null };
    else return;
    post({ type: 'reply', id: d.id, result });
  });
  post({ type: 'ready' });
})();
