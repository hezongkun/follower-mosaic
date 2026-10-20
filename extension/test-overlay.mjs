// Dev check for the in-page overlay against a MOCK x.com (local server, synthetic data):
// a tiny SPA that, like X, loads UserByScreenName (fetch) + Followers (XHR) with its own headers
// incl. x-client-transaction-id when navigated to /<name>/followers, and the next page on scroll.
// Cases: normal (replay of captured request) · strict (server refuses reused transaction ids →
// overlay lets the page load pages itself by scrolling) · broken (404 → error with details).
//   node extension/test-overlay.mjs [outDir]
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(process.argv[2] || path.join(here, '..', 'examples'));
const TOTAL = 130, seenTx = new Set(), log = [];
const user = (i) => ({ __typename: 'User', rest_id: String(1000 + i), core: { screen_name: 'fan' + i, name: 'Fan ' + i },
  avatar: { image_url: `/av/u${(i % 139) + 1}.png` }, legacy: { followers_count: i * 7 } });
const owner = { __typename: 'User', rest_id: '999', core: { screen_name: 'Kuno_he', name: '韭菜盒子🥟' }, avatar: { image_url: '/av/u0.png' }, legacy: { followers_count: TOTAL + 5 } };   // X's count > visible list (suspended/hidden accounts)
const APP = `<!doctype html><html><head><meta charset="utf-8"><title>mock x</title><style>body{background:#000;color:#fff;font:14px sans-serif;margin:0}.u{height:64px;border-bottom:1px solid #333;padding:8px}</style></head><body><div id="list"></div><script>
const MODE=(document.cookie.match(/mode=(\\w+)/)||[])[1]; const QID={UserByScreenName:'UBSNqid',Followers:'FOLqid'}; let tx=0, user=null, cursor=null, loading=false, done=false;
const H=()=>({authorization:'Bearer MOCK','x-csrf-token':'tok','x-client-transaction-id':'tx'+(++tx)+'-'+Math.random().toString(36).slice(2),'x-twitter-active-user':'yes'});
const api=(op,v)=>'/i/api/graphql/'+QID[op]+'/'+op+'?variables='+encodeURIComponent(JSON.stringify(v))+'&features='+encodeURIComponent(JSON.stringify({f1:true,f2:false}))+'&fieldToggles='+encodeURIComponent(JSON.stringify({withAuxiliaryUserLabels:false}));
async function route(){ const m=location.pathname.match(/^\\/(\\w+)\\/followers$/); if(!m) return;
  const r=await fetch(api('UserByScreenName',{screen_name:m[1],withSafetyModeUserFields:true}),{headers:H()}); const j=await r.json();
  user=j.data&&j.data.user&&j.data.user.result; if(!user) return; cursor=null; done=false; list.innerHTML=''; loadPage(); }
function loadPage(){ if(loading||done||!user) return; loading=true; const v={userId:user.rest_id,count:20,includePromotedContent:false}; if(cursor) v.cursor=cursor;
  const x=new XMLHttpRequest(); x.open('GET',api('Followers',v)); const h=H(); for(const k in h) x.setRequestHeader(k,h[k]);
  x.onload=()=>{ loading=false; if(x.status!==200) return; const j=JSON.parse(x.responseText); let next=null, n=0;
    for(const e of j.data.user.result.timeline.timeline.instructions[0].entries){ if(e.content.cursorType==='Bottom') next=e.content.value; else { n++; const d=document.createElement('div'); d.className='u'; d.textContent=e.content.itemContent.user_results.result.core.name; list.append(d);} }
    if(!n||!next||(MODE==='strict'&&n<20)) done=true; cursor=next; }; x.send(); }
addEventListener('popstate',route);
addEventListener('scroll',()=>{ if(innerHeight+scrollY>=document.documentElement.scrollHeight-80) loadPage(); });
</script></body></html>`;
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), mode = (req.headers.cookie || '').match(/mode=(\w+)/)?.[1] || 'normal';
  const json = (code, o) => { res.writeHead(code, { 'content-type': 'application/json', 'x-rate-limit-remaining': '49', 'x-rate-limit-reset': '0' }); res.end(JSON.stringify(o)); };
  if (u.pathname.startsWith('/av/')) { const f = path.join(here, 'demo/avatars', path.basename(u.pathname)); if (fs.existsSync(f)) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(fs.readFileSync(f)); } res.writeHead(404); return res.end(); }
  const m = u.pathname.match(/^\/i\/api\/graphql\/([\w-]+)\/(\w+)$/);
  if (m) {
    const tx = req.headers['x-client-transaction-id'], vars = JSON.parse(u.searchParams.get('variables') || '{}');
    log.push(`${m[2]} qid=${m[1]} tx=${tx ? (seenTx.has(tx) ? 'REUSED' : 'new') : 'none'} cursor=${vars.cursor || '-'}`);
    if (req.headers.authorization !== 'Bearer MOCK' && !String(req.headers.authorization).startsWith('Bearer ')) return json(401, {});
    if (!u.searchParams.get('features')) return json(400, { errors: [{ message: 'features cannot be null' }] });
    if (m[2] === 'UserByScreenName' && m[1] === 'UBSNqid') return json(200, vars.screen_name === 'Kuno_he' ? { data: { user: { result: owner } } } : { data: {} });
    if (m[2] !== 'Followers' || m[1] !== 'FOLqid' || mode === 'broken') return json(404, { errors: [{ message: 'not found' }] });
    if (mode === 'strict' && tx && seenTx.has(tx)) return json(404, { errors: [{ message: 'bad transaction id' }] });
    seenTx.add(tx);
    const start = vars.cursor ? +vars.cursor.slice(1) : 0, users = [];
    for (let i = start; i < Math.min(TOTAL, start + 20); i++) users.push({ entryId: 'user-' + i, content: { itemContent: { user_results: { result: user(i) } } } });
    const entries = [...users, { entryId: 'cursor-bottom-' + start, content: { cursorType: 'Bottom', value: 'c' + (start + 20) } }];
    return json(200, { data: { user: { result: { timeline: { timeline: { instructions: [{ type: 'TimelineAddEntries', entries }] } } } } } });
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(APP);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;

const userDir = fs.mkdtempSync('/tmp/xam-ov-');
const chrome = spawn(process.env.CHROME || '/usr/bin/google-chrome', ['--headless=new', '--remote-debugging-pipe', `--user-data-dir=${userDir}`,
  '--no-first-run', '--no-sandbox', '--hide-scrollbars', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
const [, , , wr, rd] = chrome.stdio;
let id = 0, buf = ''; const pending = new Map(), events = [];
rd.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\0')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else events.push(m); } });
const send = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; pending.set(i, r); wr.write(JSON.stringify({ id: i, method, params, sessionId }) + '\0'); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FILES = ['lib/x-config.js', 'content.js', 'lib/i18n.js', 'lib/fonts-data.js', 'lib/mosaic.js', 'lib/common.js', 'lib/overlay.js'].map((f) => fs.readFileSync(path.join(here, f), 'utf8'));
let failed = false;

async function run(name, { mode, lang, shot, expect, style = 'text', cap = 500, delay = 1, progShot = null, prefs = null, dsf = 1 }) {
  log.length = 0;
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId: s } } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Runtime.enable', {}, s); await send('Page.enable', {}, s);
  await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 1180, deviceScaleFactor: dsf, mobile: false }, s);
  const mark = events.length;
  await send('Network.enable', {}, s);
  await send('Network.setCookie', { name: 'mode', value: mode, url: ORIGIN }, s);
  await send('Network.setCookie', { name: 'ct0', value: 'tok', url: ORIGIN }, s);
  await send('Page.navigate', { url: ORIGIN + '/home' }, s); await sleep(800);
  const ev = async (expression, contextId) => (await send('Runtime.evaluate', { expression, contextId, awaitPromise: true, returnByValue: true }, s)).result;
  await ev(fs.readFileSync(path.join(here, 'lib/capture-main.js'), 'utf8'));          // MAIN world
  const { result: { frameTree } } = await send('Page.getFrameTree', {}, s);
  const { result: { executionContextId: ctx } } = await send('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName: 'xam' }, s);
  await ev(`window.chrome = { runtime: { id: 'test', onMessage: { addListener() {} } }, storage: { local: (() => { const d = { lang: ${JSON.stringify(lang)}, prefs: ${JSON.stringify(prefs || {})} }; return { get: async (k) => (k == null ? { ...d } : { [k]: d[k] }), set: async (o) => Object.assign(d, o), remove: async () => {} }; })() } };`, ctx);
  for (const src of FILES) { const r = await ev(src, ctx); if (r.exceptionDetails) console.log('   inject error', JSON.stringify(r.exceptionDetails).slice(0, 200)); }
  await ev(`window.__XAM_OVERLAY__.start({ style: ${JSON.stringify(style)}, target: '', delay: ${delay}, cap: ${cap}, me: { id: '999', screen_name: 'Kuno_he', name: '韭菜盒子🥟', avatar: '/av/u0.png', followers_count: 135 } }); 1`, ctx);
  let dbg = null;
  let took = false;
  for (let i = 0; i < 200; i++) { await sleep(500); dbg = (await ev('window.__XAM_OVERLAY__.debug', ctx)).result.value;
    if (progShot && !took && dbg && dbg.view === 'progress' && /\d+ \/ \d+/.test(dbg.ptext) && !/^0 /.test(dbg.ptext.replace(/\D*(\d)/, '$1'))) {
      const m = dbg.ptext.match(/(\d+) \/ /); if (m && +m[1] >= 40) { took = true; const im = await send('Page.captureScreenshot', { format: 'png' }, s); fs.writeFileSync(path.join(outDir, progShot), Buffer.from(im.result.data, 'base64')); } } if (dbg && (dbg.view === 'error' || (dbg.view === 'result' && !dbg.drawing && /\d/.test(dbg.info) && !/…/.test(dbg.info)))) break; }
  await sleep(500);
  const path0 = (await ev('location.pathname')).result.value;
  const errs = events.slice(mark).filter((e) => e.sessionId === s && e.method === 'Runtime.exceptionThrown');
  if (shot) { const im = await send('Page.captureScreenshot', { format: 'png' }, s); fs.writeFileSync(path.join(outDir, shot), Buffer.from(im.result.data, 'base64')); }
  // closing the overlay should navigate back to where the user was
  await ev('window.__XAM_OVERLAY__.close(); 1', ctx); await sleep(500);
  const back = (await ev('location.pathname')).result.value;
  const ok = expect(dbg) && !errs.length && back === '/home';
  console.log(`${ok ? '✔' : '✘'} ${name}: view=${dbg && dbg.view} n=${dbg && dbg.n} info="${dbg && dbg.info}" notice="${dbg && dbg.notice}" ptext="${dbg && dbg.ptext}" err=${JSON.stringify(dbg && dbg.err)} path=${path0}→${back} js-errors=${errs.length}${shot ? ' → ' + shot : ''}`);
  console.log('   requests:', log.join(' | '));
  errs.forEach((e) => console.log('   ', JSON.stringify(e.params).slice(0, 300)));
  if (!ok) failed = true;
  await send('Target.closeTarget', { targetId });
}
if (process.env.XAM_SHOTS) {
  // store screenshots: real UI on the mock page, 2x
  for (const lang of ['zh', 'en']) {
    const sfx = lang === 'zh' ? '' : '-en';
    await run('shots ' + lang, { mode: 'normal', lang, dsf: 2, delay: 5, progShot: `ov-progress${sfx}.png`, shot: `ov-result${sfx}.png`,
      prefs: lang === 'en' ? { texts: { Kuno_he: 'Thank you' }, font: 'rounded' } : { texts: { Kuno_he: '谢谢关注' }, font: 'cjk' },
      expect: (d) => d && d.view === 'result' });
  }
  chrome.kill(); server.close(); process.exit(failed ? 1 : 0);
}
try {
  await run('normal (replay captured request)', { mode: 'normal', lang: 'zh', shot: 'ext-overlay.png', expect: (d) => d && d.view === 'result' && d.n === TOTAL && d.notice.includes(String(TOTAL)) });
  await run('strict (reused tx id refused → page scroll)', { mode: 'strict', lang: 'en', shot: 'ext-overlay-en.png', expect: (d) => d && d.view === 'result' && d.n === TOTAL && /visible/.test(d.notice) });
  await run('cap 100 (stop at user limit)', { mode: 'normal', lang: 'zh', cap: 100, expect: (d) => d && d.view === 'result' && d.n === 100 && /100/.test(d.notice) });
  await run('broken (404 → error details)', { mode: 'broken', lang: 'en', shot: 'ext-overlay-error-en.png', expect: (d) => d && d.view === 'error' && /HTTP 404/.test(d.err.details || '') });
} catch (e) { console.error('✘', e); failed = true; }
finally { chrome.kill(); server.close(); await sleep(300); try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (_) {} }
process.exit(failed ? 1 : 0);
