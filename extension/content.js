// Runs inside the user's own x.com tab (isolated world), injected on demand by the popup.
// Secondary path only: the overlay first reuses X's own captured requests (lib/capture-main.js);
// this bundle-scanning proxy is used if X never issued a follower request we could see.
// It is a tiny READ-ONLY proxy: it only performs whitelisted GraphQL GET requests that the
// extension's overlay panel asks for, using the user's existing x.com session. It never writes.
(() => {
  if (window.__XAM_CONTENT__) return;
  window.__XAM_CONTENT__ = true;
  const CONFIG = self.XAM_CONFIG;
  const ALLOWED = new Set(['Followers', 'BlueVerifiedFollowers', 'UserByScreenName']);
  const opFeatures = {};   // feature switches listed for each operation in X's bundle
  const features = { ...CONFIG.FEATURES };
  let discovered = null;

  const log = (m, d) => window.__XAM_LOG__ && window.__XAM_LOG__(m, d);
  const cookie = (n) => (document.cookie.match(new RegExp('(?:^|;\\s*)' + n + '=([^;]+)')) || [])[1];

  async function discoverQueryIds() {
    if (discovered) return discovered;
    discovered = { ...CONFIG.QUERY_IDS };
    const t0 = Date.now(), found = [];
    try {
      const urls = new Set();
      document.querySelectorAll('script[src]').forEach((s) => urls.add(s.src));
      performance.getEntriesByType('resource').forEach((e) => /\.js(\?|$)/.test(e.name) && urls.add(e.name));
      const list = [...urls].filter((u) => /abs\.twimg\.com\/responsive-web\/client-web/.test(u)).sort((a, b) => /\/main\./.test(b) - /\/main\./.test(a));
      const need = new Set(ALLOWED);
      for (const u of list.slice(0, 40)) {
        if (!need.size || Date.now() - t0 > 10000) break;     // never let the scan hang the panel
        let txt = '';
        try { txt = await (await fetch(u, { signal: AbortSignal.timeout(5000) })).text(); } catch (_) { continue; }
        for (const op of [...need]) {
          const m = txt.match(new RegExp('queryId:"([\\w-]+)",operationName:"' + op + '"'));
          if (m) {
            discovered[op] = m[1]; need.delete(op); found.push(op);
            const rest = txt.slice(m.index, m.index + 4000);
            const fs = rest.match(/featureSwitches:\[([^\]]*)\]/);
            if (fs) opFeatures[op] = fs[1].match(/"[\w]+"/g)?.map((x) => x.slice(1, -1)) || [];
          }
        }
      }
    } catch (_) {}
    log('bundle-scan', { found, fromConfig: [...ALLOWED].filter((o) => !found.includes(o)), ms: Date.now() - t0 });
    return discovered;
  }

  // `pageHeaders`: authorization / x-twitter-* / x-client-language copied from the page's own GraphQL calls
  async function gql(op, variables, extra, pageHeaders) {
    if (!ALLOWED.has(op)) return { ok: false, status: 0, error: 'op-not-allowed' };
    const ct0 = cookie('ct0');
    if (!ct0) return { ok: false, status: 401, error: 'not-logged-in' };
    const ids = await discoverQueryIds();
    for (let tries = 0; tries < 4; tries++) {
      const feat = { ...features };
      for (const f of opFeatures[op] || []) if (!(f in feat)) feat[f] = true;
      const qs = new URLSearchParams({ variables: JSON.stringify(variables), features: JSON.stringify(feat) });
      for (const [k, v] of Object.entries(extra || {})) qs.set(k, JSON.stringify(v));
      let res;
      try {
        res = await fetch(`${location.origin}/i/api/graphql/${ids[op]}/${op}?${qs}`, {
          method: 'GET', credentials: 'include',
          headers: {
            authorization: 'Bearer ' + CONFIG.BEARER,
            'x-twitter-auth-type': 'OAuth2Session', 'x-twitter-active-user': 'yes', 'content-type': 'application/json',
            ...(pageHeaders || {}), 'x-csrf-token': ct0,
          },
          signal: AbortSignal.timeout(20000),
        });
      } catch (e) { log('direct', { op, status: 0, error: e && e.name === 'TimeoutError' ? 'timeout' : 'network' }); return { ok: false, status: 0, error: 'network', op, queryId: ids[op], mode: 'bundle' }; }
      log('direct', { op, status: res.status, queryId: ids[op], pageHeaders: !!(pageHeaders && pageHeaders.authorization) });
      const reset = Number(res.headers.get('x-rate-limit-reset')) || 0;
      if (res.status === 400) {
        const txt = await res.text();
        const m = txt.match(/features cannot be null:\s*([\w,\s]+)/);
        if (m) { m[1].split(',').map((s) => s.trim()).filter(Boolean).forEach((f) => (features[f] = true)); continue; }
        return { ok: false, status: 400, error: txt.slice(0, 200) };
      }
      if (!res.ok) return { ok: false, status: res.status, reset, op, queryId: ids[op], mode: 'bundle' };
      let json; try { json = await res.json(); } catch (_) { return { ok: false, status: res.status, error: 'bad-json', op, queryId: ids[op], mode: 'bundle' }; }
      return { ok: true, status: 200, json, reset, remaining: res.headers.get('x-rate-limit-remaining'), op, queryId: ids[op], mode: 'bundle' };
    }
    return { ok: false, status: 400, error: 'features' };
  }

  function whoami() {
    const loggedIn = !!cookie('ct0') && !!cookie('twid');
    const twid = decodeURIComponent(cookie('twid') || '');
    const id = (twid.match(/u=(\d+)/) || [])[1] || null;
    const link = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
    const screen_name = link ? link.getAttribute('href').replace(/^\//, '') : null;
    const img = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"] img');
    return { loggedIn, id, screen_name, avatar: img ? img.src.replace(/_(normal|x96|bigger)(\.\w+)$/, '_400x400$2') : '' };
  }

  // for the overlay (same isolated world)
  window.__XAM_GQL__ = gql;
  window.__XAM_HEADERS__ = () => ({ authorization: 'Bearer ' + CONFIG.BEARER, 'x-csrf-token': cookie('ct0') || '',
    'x-twitter-auth-type': 'OAuth2Session', 'x-twitter-active-user': 'yes', 'content-type': 'application/json' });
  window.__XAM_WHOAMI__ = whoami;

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || !msg || typeof msg.type !== 'string') return;
    if (msg.type === 'xam:ping') { sendResponse({ ok: true }); return; }
    if (msg.type === 'xam:whoami') { sendResponse(whoami()); return; }
    if (msg.type === 'xam:gql') { gql(msg.op, msg.variables, msg.extra).then(sendResponse); return true; }
  });
})();
