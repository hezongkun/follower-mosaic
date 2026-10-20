/*!
 * Follower Mosaic — follower fetcher (console script) · MIT License
 *
 * HOW TO USE / 使用方法
 *   1. Open https://x.com and make sure you are logged in.  打开 x.com 并保持登录。
 *   2. F12 → Console, paste this whole file, press Enter.  F12 控制台粘贴全部内容并回车。
 *   3. Wait; progress is printed; followers-<name>.json downloads at the end.
 *      等待进度结束，浏览器自动下载 followers-<用户名>.json。
 *   Stop any time: window.__XAM_STOP = true  （随时停止，已抓到的数据仍会保存）
 *
 * SAFETY / 安全说明
 *   - Runs only inside YOUR logged-in x.com tab, with the same requests the X web app
 *     itself makes. It never asks for a password, token or OAuth authorization.
 *   - READ-ONLY: HTTP GET only. Never follows, likes, posts, DMs or changes anything.
 *   - Gentle: one request at a time, DELAY_MS (+ random jitter) between pages, waits out
 *     HTTP 429 using x-rate-limit-reset, hard caps on pages and users.
 *   - Local only: the result is saved as a file on your computer; nothing is uploaded.
 */
(async () => {
  'use strict';

  // ======================= CONFIG — edit freely / 可修改 =======================
  // ==XAM-CONFIG-START==
  const CONFIG = {
    // Whose followers? '' = the logged-in account; or e.g. 'some_user' (no @).
    // 抓谁的粉丝？留空 = 当前登录账号；也可以填别人的用户名（不带 @）。
    TARGET_SCREEN_NAME: '',
    ASK_TARGET: false,             // true → prompt() for a screen name (the bookmarklet sets this)
    LANG: '',                      // log language: '' = auto (browser language), 'zh' or 'en'

    ENDPOINTS: ['Followers', 'BlueVerifiedFollowers'], // follower lists to read (deduped)
    COUNT_PER_PAGE: 20,            // users per page (X returns ~20)
    DELAY_MS: 5000,                // pause between page requests / 每页间隔（毫秒）
    JITTER_MS: 1500,               // + random 0..JITTER_MS
    MAX_PAGES_PER_ENDPOINT: 100,   // safety cap / 每个接口最多翻页数
    MAX_USERS: 500,                // stop after N unique users (max 5000) / 最多抓取人数（最多 5000）
    MAX_429_RETRIES: 3,            // times to wait out a rate limit before giving up
    AUTO_DISCOVER_QUERY_IDS: true, // read current queryIds from x.com's own JS bundle

    // Fallback GraphQL queryIds — X changes them occasionally. If you get a 404:
    // DevTools → Network → filter "graphql" on a followers page → copy <ID> from
    // /i/api/graphql/<ID>/Followers and paste it here.
    // queryId 会变：报 404 时在 Network 面板找到 /graphql/<ID>/Followers 替换即可。
    QUERY_IDS: {
      Followers: 'IOh4aS6UdGWGJUYTqliQ7Q',
      BlueVerifiedFollowers: '1fjk4lmK45a-giaZTubqbg',
      UserByScreenName: 'x3RLKWW1Tl7JgU7YtGxuzw',
    },

    // Public bearer token embedded in the x.com web client (identical for every visitor;
    // NOT your credential). Your session is identified by your own browser cookies.
    BEARER: 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',

    // Feature flags. If X starts requiring a new one, the script parses the 400 error
    // ("features cannot be null: ...") and adds it automatically.
    FEATURES: {
      rweb_video_screen_enabled: false,
      profile_label_improvements_pcf_label_in_post_enabled: true,
      rweb_tipjar_consumption_enabled: true,
      verified_phone_label_enabled: false,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      premium_content_api_read_enabled: false,
      communities_web_enable_tweet_community_results_fetch: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      responsive_web_grok_analyze_button_fetch_trends_enabled: false,
      responsive_web_grok_analyze_post_followups_enabled: true,
      responsive_web_jetfuel_frame: false,
      responsive_web_grok_share_attachment_enabled: true,
      articles_preview_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      responsive_web_grok_show_grok_translated_post: false,
      responsive_web_grok_analysis_button_from_backend: true,
      creator_subscriptions_quote_tweet_preview_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      responsive_web_grok_image_annotation_enabled: true,
      responsive_web_enhance_cards_enabled: false,
      hidden_profile_subscriptions_enabled: true,
      subscriptions_verification_info_is_identity_verified_enabled: true,
      subscriptions_verification_info_verified_since_enabled: true,
      highlights_tweets_tab_ui_enabled: true,
      responsive_web_twitter_article_notes_tab_enabled: true,
      subscriptions_feature_can_gift_premium: true,
    },
  };
  // ==XAM-CONFIG-END==
  // ============================================================================

  // ---------- messages (zh / en; auto-detected from the browser language) ----------
  const MSG = {
    en: {
      notX: 'Please run this on https://x.com while logged in.',
      noCt0: 'Not logged in (no ct0 cookie). Please log in to x.com first.',
      rate: 'Rate limited too many times — please try again later.',
      wait: '429 rate limited — waiting {s}s for the window to reset…',
      outdated: '{op} 404 — queryId "{id}" looks outdated; update CONFIG.QUERY_IDS.',
      ask: 'Whose followers? Leave empty for your own account (screen name, no @).',
      lookup: 'Looking up @{u} …', notFound: 'User @{u} not found.',
      noOwner: 'Could not detect your account; set CONFIG.TARGET_SCREEN_NAME.',
      target: 'Target: {name} (@{u}) id={id} followers={n}',
      est: 'Estimated time ≈ {m} min. Stop any time: window.__XAM_STOP = true',
      noQid: 'No queryId for {op}; skipped.', stopped: 'Stopped by user — saving what we have.',
      page: '{op} p{p}: {n} users, +{added} new · total {total}/{max}', left: ' · rate-limit left {n}',
      cap: 'Reached MAX_USERS.', done: 'Done ✔ {n} followers → {file} (saved locally, nothing uploaded).',
    },
    zh: {
      notX: '请在已登录的 https://x.com 页面运行。',
      noCt0: '未检测到登录状态（没有 ct0），请先登录 x.com。',
      rate: '限流次数过多，请稍后再试。',
      wait: '触发限流（429），等待 {s} 秒后自动继续…',
      outdated: '{op} 404 —— queryId "{id}" 可能已过期，请更新 CONFIG.QUERY_IDS。',
      ask: '抓谁的粉丝？留空 = 自己（填用户名，不带 @）',
      lookup: '正在查找 @{u} …', notFound: '找不到用户 @{u}',
      noOwner: '无法识别当前账号，请填写 CONFIG.TARGET_SCREEN_NAME。',
      target: '目标：{name}（@{u}）id={id} 粉丝数={n}',
      est: '预计约 {m} 分钟。随时停止：window.__XAM_STOP = true',
      noQid: '{op} 没有 queryId，已跳过。', stopped: '已手动停止，保存已抓到的数据。',
      page: '{op} 第 {p} 页：{n} 人，新增 {added} · 共 {total}/{max}', left: ' · 剩余额度 {n}',
      cap: '已达到 MAX_USERS 上限。', done: '完成 ✔ {n} 位粉丝 → {file}（已保存到本地，没有上传）',
    },
  };
  const LANG = MSG[CONFIG.LANG] ? CONFIG.LANG : (/^zh/i.test(navigator.language || '') ? 'zh' : 'en');
  const M = (k, v = {}) => MSG[LANG][k].replace(/\{(\w+)\}/g, (_, x) => (v[x] ?? ''));

  const TAG = '%c[XAM]', CSS = 'color:#1d9bf0;font-weight:bold';
  const log = (...a) => console.log(TAG, CSS, ...a);
  const warn = (...a) => console.warn(TAG, CSS, ...a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__XAM_STOP = false;

  if (!/(^|\.)(x|twitter)\.com$/.test(location.hostname)) {
    alert(M('notX'));
    return;
  }
  const ct0 = (document.cookie.match(/(?:^|;\s*)ct0=([^;]+)/) || [])[1];
  if (!ct0) { alert(M('noCt0')); return; }

  // ---------- optional: read current queryIds from x.com's own public JS bundles ----------
  async function discoverQueryIds() {
    const wanted = Object.keys(CONFIG.QUERY_IDS), found = {}, urls = new Set();
    document.querySelectorAll('script[src]').forEach((s) => urls.add(s.src));
    performance.getEntriesByType('resource').forEach((e) => { if (/\.js(\?|$)/.test(e.name)) urls.add(e.name); });
    const list = [...urls].filter((u) => /abs\.twimg\.com\/responsive-web\/client-web/.test(u))
      .sort((a, b) => /\/main\./.test(b) - /\/main\./.test(a));
    for (const u of list.slice(0, 40)) {
      if (wanted.every((w) => found[w])) break;
      try {
        const txt = await (await fetch(u)).text();
        for (const op of wanted) {
          const m = !found[op] && txt.match(new RegExp('queryId:"([\\w-]+)",operationName:"' + op + '"'));
          if (m) found[op] = m[1];
        }
      } catch (_) {}
    }
    return found;
  }
  if (CONFIG.AUTO_DISCOVER_QUERY_IDS) {
    try { Object.assign(CONFIG.QUERY_IDS, await discoverQueryIds()); } catch (e) { warn('queryId discovery failed', e); }
    log('queryIds:', { ...CONFIG.QUERY_IDS });
  }

  // ---------- read-only GraphQL GET with gentle retry ----------
  const features = { ...CONFIG.FEATURES };
  async function gql(op, variables, extra = {}) {
    let n429 = 0, nFeat = 0;
    for (;;) {
      const qs = new URLSearchParams({ variables: JSON.stringify(variables), features: JSON.stringify(features) });
      for (const [k, v] of Object.entries(extra)) qs.set(k, JSON.stringify(v));
      const res = await fetch(`${location.origin}/i/api/graphql/${CONFIG.QUERY_IDS[op]}/${op}?${qs}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          authorization: 'Bearer ' + CONFIG.BEARER,
          'x-csrf-token': ct0,
          'x-twitter-auth-type': 'OAuth2Session',
          'x-twitter-active-user': 'yes',
          'content-type': 'application/json',
        },
      });
      if (res.status === 429) {
        if (++n429 > CONFIG.MAX_429_RETRIES) throw new Error(M('rate'));
        const reset = Number(res.headers.get('x-rate-limit-reset')) * 1000;
        const wait = reset > 0 ? Math.max(reset - Date.now(), 0) + 5000 : 15 * 60 * 1000; // no header → 15 min
        warn(M('wait', { s: Math.ceil(wait / 1000) }));
        await sleep(wait);
        continue;
      }
      if (res.status === 400 && nFeat < 3) {
        const txt = await res.text();
        const m = txt.match(/features cannot be null:\s*([\w,\s]+)/);
        if (!m) throw new Error(`${op} HTTP 400: ${txt.slice(0, 300)}`);
        m[1].split(',').map((s) => s.trim()).filter(Boolean).forEach((f) => (features[f] = true));
        nFeat++; warn('Added required feature flags:', m[1]);
        continue;
      }
      if (res.status === 404) throw new Error(M('outdated', { op, id: CONFIG.QUERY_IDS[op] }));
      if (!res.ok) throw new Error(`${op} HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return { json: await res.json(), remaining: res.headers.get('x-rate-limit-remaining') };
    }
  }

  // ---------- parse a user (old "legacy" and newer "core/avatar" shapes) ----------
  function parseUser(r) {
    if (!r || r.__typename === 'UserUnavailable') return null;
    const L = r.legacy || {};
    const screen_name = r.core?.screen_name || L.screen_name;
    if (!screen_name) return null;
    const avatar = (r.avatar?.image_url || L.profile_image_url_https || '').replace(/_normal(\.\w+)$/, '_400x400$1');
    return {
      id: r.rest_id, screen_name, name: r.core?.name || L.name || screen_name, avatar,
      followers_count: L.followers_count ?? null, verified: !!(r.is_blue_verified || L.verified),
    };
  }

  // ---------- resolve target account ----------
  let target = CONFIG.TARGET_SCREEN_NAME.replace(/^@/, '').trim();
  if (CONFIG.ASK_TARGET) {
    const ans = prompt(M('ask'), target);
    if (ans === null) return;
    target = ans.replace(/^@/, '').trim();
  }
  if (!target) {
    const a = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
    target = a ? a.getAttribute('href').replace(/^\//, '') : '';
  }
  let owner = { id: null, screen_name: target, name: target, avatar: '', followers_count: null };
  if (target) {
    log(M('lookup', { u: target }));
    const { json } = await gql('UserByScreenName', { screen_name: target, withSafetyModeUserFields: true }, { fieldToggles: { withAuxiliaryUserLabels: false } });
    const u = parseUser(json?.data?.user?.result);
    if (!u) { alert(M('notFound', { u: target })); return; }
    owner = u;
  } else {
    const twid = decodeURIComponent((document.cookie.match(/(?:^|;\s*)twid=([^;]+)/) || [])[1] || '');
    owner.id = (twid.match(/u=(\d+)/) || [])[1];
    if (!owner.id) { alert(M('noOwner')); return; }
  }
  log(M('target', { name: owner.name, u: owner.screen_name, id: owner.id, n: owner.followers_count ?? '?' }));
  const est = Math.min(CONFIG.MAX_USERS, owner.followers_count || CONFIG.MAX_USERS);
  log(M('est', { m: Math.ceil(((est / CONFIG.COUNT_PER_PAGE) * (CONFIG.DELAY_MS + CONFIG.JITTER_MS / 2)) / 60000) }));

  // ---------- paginate ----------
  const byId = new Map();
  function extract(json) {
    const res = json?.data?.user?.result;
    const tl = res?.timeline?.timeline || res?.timeline;
    let cursor = null; const users = [];
    for (const ins of tl?.instructions || []) {
      for (const e of ins.entries || (ins.entry ? [ins.entry] : [])) {
        const c = e.content || {};
        if (c.cursorType === 'Bottom' || /^cursor-bottom/.test(e.entryId || '')) cursor = c.value;
        const ur = c.itemContent?.user_results?.result;
        const u = ur && parseUser(ur);
        if (u) users.push(u);
      }
    }
    return { users, cursor };
  }

  outer: for (const op of CONFIG.ENDPOINTS) {
    if (!CONFIG.QUERY_IDS[op]) { warn(M('noQid', { op })); continue; }
    let cursor = null;
    for (let page = 1; page <= CONFIG.MAX_PAGES_PER_ENDPOINT; page++) {
      if (window.__XAM_STOP) { warn(M('stopped')); break outer; }
      const vars = { userId: owner.id, count: CONFIG.COUNT_PER_PAGE, includePromotedContent: false };
      if (cursor) vars.cursor = cursor;
      let out;
      try { out = await gql(op, vars); } catch (e) { warn(String(e.message || e)); break; }
      const { users, cursor: next } = extract(out.json);
      let added = 0;
      for (const u of users) if (!byId.has(u.id)) { byId.set(u.id, u); added++; }
      log(M('page', { op, p: page, n: users.length, added, total: byId.size, max: CONFIG.MAX_USERS }) + (out.remaining ? M('left', { n: out.remaining }) : ''));
      if (byId.size >= CONFIG.MAX_USERS) { log(M('cap')); break outer; }
      if (!next || next === cursor || users.length === 0) break;
      cursor = next;
      await sleep(CONFIG.DELAY_MS + Math.random() * CONFIG.JITTER_MS);
    }
  }

  // ---------- save locally (nothing is uploaded) ----------
  const followers = [...byId.values()].slice(0, CONFIG.MAX_USERS);
  const data = { format: 'x-avatar-mosaic/1', fetched_at: new Date().toISOString(), owner, count: followers.length, followers };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  a.download = `followers-${owner.screen_name || owner.id}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  window.__XAM_LAST = data;
  log(M('done', { n: followers.length, file: a.download }));
})();
