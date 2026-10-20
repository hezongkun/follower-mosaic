// Dev check: loads the unpacked extension in headless Chrome (CDP Extensions.loadUnpacked),
// opens the popup in demo modes (the in-page overlay is tested by test-overlay.mjs), reports JS errors, saves screenshots.
//   node extension/test-extension.mjs [outDir]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(process.argv[2] || path.join(here, '..', 'examples'));
const chromePath = process.env.CHROME || '/usr/bin/google-chrome';
const userDir = fs.mkdtempSync('/tmp/xam-ext-');
const chrome = spawn(chromePath, ['--headless=new', '--remote-debugging-pipe', '--enable-unsafe-extension-debugging',
  `--user-data-dir=${userDir}`, '--no-first-run', '--no-sandbox', '--hide-scrollbars', '--lang=zh-CN', 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
const [, , , wr, rd] = chrome.stdio;
let id = 0, buf = ''; const pending = new Map(), events = [];
rd.on('data', (d) => {
  buf += d; let i;
  while ((i = buf.indexOf('\0')) >= 0) {
    const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else events.push(m);
  }
});
const send = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; pending.set(i, r); wr.write(JSON.stringify({ id: i, method, params, sessionId }) + '\0'); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
try {
  const ld = await send('Extensions.loadUnpacked', { path: here });
  if (ld.error) throw new Error('loadUnpacked failed: ' + JSON.stringify(ld.error));
  const ext = ld.result.id; console.log('✔ extension loaded, id', ext);
  async function shot(page, w, h, file, waitExpr) {
    const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
    const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Runtime.enable', {}, sessionId); await send('Log.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: false }, sessionId);
    const mark = events.length;
    await send('Page.navigate', { url: `chrome-extension://${ext}/${page}` }, sessionId);
    let ok = false;
    for (let i = 0; i < 150 && !ok; i++) { await sleep(200); const r = await send('Runtime.evaluate', { expression: waitExpr, returnByValue: true }, sessionId); ok = !!r.result?.result?.value; }
    await sleep(400);
    const errs = events.slice(mark).filter((e) => e.sessionId === sessionId && (e.method === 'Runtime.exceptionThrown' || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')));
    const s = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    if (file) fs.writeFileSync(path.join(outDir, file), Buffer.from(s.result.data, 'base64'));
    console.log(`${ok && !errs.length ? '✔' : '✘'} ${page} ready=${ok} errors=${errs.length}${file ? ' → ' + file : ''}`);
    errs.forEach((e) => console.log('   ', JSON.stringify(e.params).slice(0, 300)));
    if (!ok || errs.length) failed = true;
    await send('Target.closeTarget', { targetId });
  }
  // language check: wait for `sel` text, click the 中/EN toggle, expect one zh + one en rendering
  const toggled = (sel) => `(()=>{const g=()=>document.querySelector(${JSON.stringify(sel)})?.textContent||'';
    if(!g().includes('x.com'))return false;
    if(!window.__a){window.__a=g();window.__l=document.documentElement.lang;document.getElementById('lang').click();return false;}
    const c=g(), cjk=/[\u4e00-\u9fff]/; return c!==window.__a && cjk.test(window.__a)!==cjk.test(c) && document.documentElement.lang!==window.__l;})()`;
  const done = (lang) => `document.getElementById('rinfo').textContent.${lang === 'zh' ? "startsWith('共')" : "includes('followers ·')"} && XAM.canvas.toDataURL().length > 10000`;
  const live = "window.__thumbMs > 0 && [...document.images].every(i=>i.complete)";
  if (process.env.XAM_TEST === 'store') {
    await shot('popup.html', 412, 560, null, toggled('.msg b'));
    await shot('popup.html?demo=ready', 412, 560, null, toggled('.msg b'));   // demo stripped → normal "open x.com" screen
    throw { done: true };
  }
  await shot('popup.html', 412, 560, null, toggled('.msg b'));
  for (const lang of ['zh', 'en']) {
    const sfx = lang === 'zh' ? '' : '-en', q = '&lang=' + lang;
    await shot('popup.html?demo=ready' + q, 412, 760, `ext-popup${sfx}.png`, live);
    await shot(`popup.html?demo=ready${q}&handle=Kuno_he&n=693&name=` + encodeURIComponent(lang === 'zh' ? '韭菜盒子🥟' : 'Kuno ✨ He'), 412, 760, `ext-popup-live${sfx}.png`, live);
  }
} catch (e) { if (!e.done) { console.error('✘', e.message); failed = true; } }
finally { chrome.kill(); await sleep(300); try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (_) {} }
process.exit(failed ? 1 : 0);
