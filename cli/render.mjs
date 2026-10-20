#!/usr/bin/env node
// Headless renderer: drives web/index.html in a local Chrome via the DevTools protocol.
// Zero npm dependencies (Node >= 22 for the built-in WebSocket).
// Usage:
//   node cli/render.mjs --data followers.json --style text --out out.png [--text Catcher] [--theme midnight] [--width 2400]
// Styles: text | xlogo | galaxy | heart | grid   
// --lang en|zh (captions)  --font sans|rounded|serif|hand|cjk
// Themes: midnight | aurora | sunset | mono | light
// Set CHROME=/path/to/chrome if auto-detection fails.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).join(' ').split(/\s*--/).filter(Boolean).map((s) => { const i = s.indexOf(' '); return i < 0 ? [s, true] : [s.slice(0, i), s.slice(i + 1).trim()]; }));
if (!args.data) { console.error('Usage: node cli/render.mjs --data followers.json --style text --out out.png'); process.exit(1); }
const dataPath = path.resolve(args.data);
const out = path.resolve(args.out || `x-mosaic-${args.style || 'text'}.png`);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = p === '/__data.json' ? dataPath : path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!f.startsWith(ROOT) && f !== dataPath) { res.writeHead(403).end(); return; }
  fs.readFile(f, (err, buf) => { if (err) { res.writeHead(404).end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'access-control-allow-origin': '*' }).end(buf); });
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;

const chromePath = process.env.CHROME || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));
if (!chromePath) { console.error('Chrome not found; set CHROME=/path/to/chrome'); process.exit(1); }
const userDir = fs.mkdtempSync('/tmp/xam-chrome-');
const chrome = spawn(chromePath, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${userDir}`, '--no-first-run', '--no-sandbox', '--hide-scrollbars', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((resolve, reject) => {
  let buf = ''; const t = setTimeout(() => reject(new Error('Chrome did not start')), 30000);
  chrome.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); resolve(m[1]); } });
});
const port = new URL(wsUrl).port;
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr) => {
  const m = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description || 'eval error');
  return m.result?.result?.value;
};

try {
  await send('Page.enable');
  await send('Page.navigate', { url: `${base}/web/index.html` });
  for (let i = 0; i < 100 && !(await evaluate('!!window.XAM').catch(() => false)); i++) await new Promise((r) => setTimeout(r, 100));
  const opts = { style: args.style || 'text', theme: args.theme || 'midnight', W: +(args.width || 2400) };
  for (const k of ['text', 'title', 'seed', 'density', 'font']) if (args[k] !== undefined) opts[k] = isNaN(+args[k]) || ['text', 'title', 'font'].includes(k) ? args[k] : +args[k];
  if (args['no-caption']) opts.caption = false;
  if (args['no-repeat']) opts.repeat = false;
  await evaluate(`XAM_I18N.set(${JSON.stringify(args.lang === 'zh' ? 'zh' : 'en')})`);
  const info = await evaluate(`(async () => { XAM.load(await (await fetch('/__data.json')).json()); const r = await XAM.render(${JSON.stringify(opts)}); r.png = XAM.canvas.toDataURL('image/png'); return r; })()`);
  fs.writeFileSync(out, Buffer.from(info.png.split(',')[1], 'base64'));
  console.log(`✔ ${out}  ${info.width}x${info.height}  avatars=${info.avatars} failed=${info.failed}`);
} finally {
  ws.close(); chrome.kill(); server.close();
  await new Promise((r) => (chrome.exitCode !== null ? r() : chrome.once('exit', r)));
  try { fs.rmSync(userDir, { recursive: true, force: true, maxRetries: 3 }); } catch (_) {}
}
