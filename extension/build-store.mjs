// Builds the Chrome Web Store variant of the extension:
//  - removes the X-logo style (lines tagged "@store-remove") and its thumbnail
//  - strips the ?demo= screenshot mode (between "@demo-start" / "@demo-end") and demo/ assets
//  - writes the upload zip with manifest.json at the root
// Usage: node extension/build-store.mjs [--keep-demo] [--out dir] [--zip file.zip]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const src = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const keepDemo = argv.includes('--keep-demo');
const out = path.resolve(opt('--out', '/tmp/xam-store-build'));
const zip = opt('--zip', null);
execFileSync(process.execPath, [path.join(src, 'build.mjs')], { stdio: 'inherit' });
fs.rmSync(out, { recursive: true, force: true });
const SKIP = new Set(['build.mjs', 'build-store.mjs', 'test-extension.mjs', 'test-overlay.mjs', 'style-xlogo.jpg']);
function copy(dir) {
  for (const e of fs.readdirSync(path.join(src, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (SKIP.has(e.name) || (!keepDemo && rel === 'demo')) continue;
    if (e.isDirectory()) { copy(rel); continue; }
    fs.mkdirSync(path.join(out, dir), { recursive: true });
    let buf = fs.readFileSync(path.join(src, rel));
    if (/\.js$/.test(e.name)) {
      let lines = buf.toString('utf8').split('\n').filter((l) => !l.includes('@store-remove'));
      if (!keepDemo) { let skip = false; lines = lines.filter((l) => { if (l.includes('@demo-start')) skip = true; const keep = !skip; if (l.includes('@demo-end')) skip = false; return keep; }); }
      buf = Buffer.from(lines.join('\n'));
    }
    fs.writeFileSync(path.join(out, rel), buf);
  }
}
copy('');
for (const f of ['popup.js', 'content.js', 'lib/common.js', 'lib/overlay.js', 'lib/capture-main.js']) execFileSync(process.execPath, ['--check', path.join(out, f)]);
let found = ''; try { found = execFileSync('grep', ['-rlE', keepDemo ? 'xlogo.jpg' : "demo|xlogo.jpg", out, '--include=*.js', '--include=*.html']).toString(); } catch (_) { /* grep: no match */ }
const leftovers = found.trim().split('\n').filter((f) => !f.endsWith('lib/mosaic.js') && f);
if (leftovers.length) { console.error('leftovers in', leftovers); process.exit(1); }
if (zip) {
  execFileSync('python3', ['-c', `import zipfile,os,sys
out,root=sys.argv[1],sys.argv[2]
os.path.exists(out) and os.remove(out)
z=zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED)
for dp,dn,fn in os.walk(root):
  dn.sort()
  for f in sorted(fn): p=os.path.join(dp,f); z.write(p,os.path.relpath(p,root))
z.close()`, path.resolve(zip), out]);
  console.log('zip →', path.resolve(zip));
}
console.log('store build →', out, keepDemo ? '(demo kept for screenshots)' : '');
