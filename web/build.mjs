// Embeds web/i18n.js and web/fonts/*.woff into index.html so the page stays a single offline file
// (file:// pages can't load sibling files reliably). Run after editing i18n.js or fonts: node web/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const data = {};
for (const f of fs.readdirSync(path.join(dir, 'fonts')).filter((f) => f.endsWith('.woff')))
  data[f] = 'data:font/woff;base64,' + fs.readFileSync(path.join(dir, 'fonts', f)).toString('base64');
const i18n = fs.readFileSync(path.join(dir, 'i18n.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const p = path.join(dir, 'index.html');
let html = fs.readFileSync(p, 'utf8');
html = html.replace(/\/\*XAM-FONT-DATA-START\*\/[\s\S]*?\/\*XAM-FONT-DATA-END\*\//, () => `/*XAM-FONT-DATA-START*/window.XAM_FONT_DATA = ${JSON.stringify(data)};/*XAM-FONT-DATA-END*/`);
html = html.replace(/\/\*XAM-I18N-START\*\/[\s\S]*?\/\*XAM-I18N-END\*\//, () => `/*XAM-I18N-START*/\n${i18n}\n/*XAM-I18N-END*/`);
fs.writeFileSync(p, html);
console.log(`embedded i18n + ${Object.keys(data).join(', ')} → index.html ${(html.length / 1024).toFixed(0)} KB`);
