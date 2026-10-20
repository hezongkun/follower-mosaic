// Builds fetch/bookmarklet.txt and fetch/bookmarklet.html from fetch-followers.js.
// node fetch/build-bookmarklet.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
let src = fs.readFileSync(path.join(dir, 'fetch-followers.js'), 'utf8');
src = src.replace(/^\/\*![\s\S]*?\*\/\s*/, '')                 // drop header comment
  .replace(/ASK_TARGET:\s*false/, 'ASK_TARGET: true')            // bookmarklet asks for a target
  .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');    // drop full-line comments
const href = 'javascript:' + encodeURIComponent(src);
fs.writeFileSync(path.join(dir, 'bookmarklet.txt'), href + '\n');
const btn = `<p><a class="bm" href="${href.replace(/"/g, '&quot;')}">📸 Export X followers</a></p>`;
// Installer page: both languages, auto-picked from the browser language, with a 中/EN toggle (remembered in localStorage).
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Follower Mosaic · Bookmarklet</title>
<style>body{font:15px/1.7 system-ui,"PingFang SC",sans-serif;background:#0b0f1a;color:#e7ecf5;max-width:720px;margin:60px auto;padding:0 20px}
a.bm{display:inline-block;padding:12px 22px;border-radius:999px;background:#1d9bf0;color:#fff;font-weight:700;text-decoration:none;cursor:grab}
code{background:#1a2133;padding:2px 6px;border-radius:4px} .mut{color:#8b97b0} a{color:#1d9bf0}
#lang{float:right;padding:4px 12px;border-radius:999px;border:1px solid #2a3550;background:none;color:#e7ecf5;cursor:pointer}
html[lang=en] [lang=zh], html[lang=zh] [lang=en]{display:none}</style></head><body>
<button id="lang"></button>
<div lang="en">
<h1>Follower Mosaic · Bookmarklet</h1>
<p>👉 Drag this button to your <b>bookmarks bar</b>:</p>${btn}
<ol><li>Open <code>https://x.com</code> and make sure you are logged in.</li>
<li>Click the bookmark and enter a screen name (empty = yourself).</li>
<li>Keep the tab open (F12 → Console shows progress); <code>followers-*.json</code> downloads when done.</li>
<li>Open the <a href="../web/index.html">generator</a> and load that file.</li></ol>
<p class="mut">Read-only GET requests · 5 s between pages · data stays on your computer.</p>
</div>
<div lang="zh">
<h1>X 粉丝拼图 · 书签工具</h1>
<p>👉 把下面的按钮<b>拖到浏览器书签栏</b>：</p>${btn}
<ol><li>打开 <code>https://x.com</code> 并保持登录。</li>
<li>点击书签，输入要抓取的用户名（留空 = 自己）。</li>
<li>保持标签页打开（F12 → Console 可看进度），结束后自动下载 <code>followers-*.json</code>。</li>
<li>打开<a href="../web/index.html">生成器</a>加载该文件。</li></ol>
<p class="mut">只读 GET 请求 · 每页间隔 5 秒 · 数据只保存在你的电脑上。</p>
</div>
<script>(function(){var k='xam-lang',l;try{l=localStorage.getItem(k)}catch(e){}
if(l!=='zh'&&l!=='en')l=/^zh/i.test(navigator.language||'')?'zh':'en';
var b=document.getElementById('lang');function set(x){l=x;document.documentElement.lang=x;b.textContent=x==='zh'?'EN':'中';}
set(l);b.onclick=function(){set(l==='zh'?'en':'zh');try{localStorage.setItem(k,l)}catch(e){}};})();</script>
</body></html>`;
fs.writeFileSync(path.join(dir, 'bookmarklet.html'), html);
console.log(`bookmarklet: ${href.length} chars`);
