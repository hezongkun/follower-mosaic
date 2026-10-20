// GENERATED from web/index.html by extension/build.mjs — do not edit.
(() => {
'use strict';
if (self.XAM) return;
const $ = (id) => document.getElementById(id);

const tr = (k, v) => (self.XAM_I18N ? self.XAM_I18N.t(k, v) : k);
const num = (n) => (self.XAM_I18N ? self.XAM_I18N.num(n) : String(n));
const FONT = '"Inter","SF Pro Display","Segoe UI","Helvetica Neue",Arial,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
const CJK_SANS = '"PingFang SC","Hiragino Sans GB","Noto Sans SC","Noto Sans CJK SC","Source Han Sans SC","Microsoft YaHei",sans-serif';
// Fonts for the text style. "XAM *" faces are bundled (SIL OFL, Latin subset) and loaded locally — never from the network.
const FONTS = {
  sans:    { family: `"Inter","Arial Black","Helvetica Neue",Arial,${CJK_SANS}`, weight: 900 },
  rounded: { family: `"XAM Fredoka","Arial Rounded MT Bold","Yuanti SC",${CJK_SANS}`, weight: 700, bundled: { family: 'XAM Fredoka', file: 'Fredoka-Bold.woff', weight: '700' } },
  serif:   { family: 'Georgia,"Times New Roman","Songti SC","STSong","Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC",SimSun,serif', weight: 900 },
  hand:    { family: '"XAM Pacifico","Kaiti SC","STKaiti",KaiTi,"Noto Serif CJK SC",cursive', weight: 400, bundled: { family: 'XAM Pacifico', file: 'Pacifico.woff', weight: '400' } },
  cjk:     { family: CJK_SANS, weight: 900 },
};
const fontReady = new Map();
async function ensureFont(key, text) {
  const f = FONTS[key] || FONTS.sans;
  try {
    if (f.bundled && !fontReady.has(key)) {
      const data = (window.XAM_FONT_DATA || {})[f.bundled.file];
      // embedded fonts are passed as bytes (not a data: URL) so strict page CSPs (font-src) don't block them
      const src = data ? Uint8Array.from(atob(data.slice(data.indexOf(',') + 1)), (c) => c.charCodeAt(0)).buffer
        : `url(${(window.XAM_FONT_BASE || 'fonts/') + f.bundled.file})`;
      const face = new FontFace(f.bundled.family, src, { weight: f.bundled.weight });
      fontReady.set(key, face.load().then((ff) => document.fonts.add(ff)).catch(() => {}));
    }
    await fontReady.get(key);
    await document.fonts.load(`${f.weight} 100px ${f.family}`, text || 'Aa\u4e2d');
  } catch (_) { /* fall back to system fonts */ }
  return f;
}
const HAS_CJK = /[\u2E80-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\u3040-\u30FF]/;
// Strip emoji / symbols that would only draw as tofu or color glyphs in the mask.
function cleanText(t) {
  return String(t || '').replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D\u20E3]/gu, '')
    .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 2).join('\n');
}
function defaultText(owner) {
  return cleanText(owner && owner.name) || (owner && owner.screen_name) || tr('text.fallback');
}
// Split one long line into two balanced lines (prefer a space, else the middle character).
function wrapLines(ctx, text) {
  if (text.includes('\n')) return text.split('\n');
  const chars = Array.from(text);
  if (chars.length < 4) return [text];
  const full = ctx.measureText(text);
  const h = full.actualBoundingBoxAscent + full.actualBoundingBoxDescent || 70;
  if (full.width / h < (HAS_CJK.test(text) ? 5.2 : 6.5)) return [text];
  let best = [text], bestW = Infinity;
  const cands = [];
  chars.forEach((c, i) => { if (c === ' ') cands.push(i); });
  if (!cands.length) for (let i = 1; i < chars.length; i++) cands.push(i);
  for (const i of cands) {
    const a = chars.slice(0, i).join('').trim(), b = chars.slice(i).join('').trim();
    if (!a || !b) continue;
    const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
    if (w < bestW) { bestW = w; best = [a, b]; }
  }
  return best;
}

const X_PATH = 'M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.163 519.284ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.828Z';
const THEMES = {
  midnight: { bg: ['#04060d', '#0b1230', '#1a0f40'], g1: 'rgba(29,155,240,.32)', g2: 'rgba(150,80,255,.26)', fg: '#fff', mut: 'rgba(214,224,255,.62)', ring: 'rgba(255,255,255,.5)', acc: '#1d9bf0', star: '255,255,255' },
  aurora:   { bg: ['#020a0e', '#04263a', '#06362c'], g1: 'rgba(0,255,190,.22)', g2: 'rgba(40,140,255,.28)', fg: '#fff', mut: 'rgba(200,255,240,.6)', ring: 'rgba(200,255,240,.5)', acc: '#3ef0c3', star: '220,255,245' },
  sunset:   { bg: ['#0f030c', '#36092b', '#4f1616'], g1: 'rgba(255,120,60,.30)', g2: 'rgba(255,60,150,.26)', fg: '#fff', mut: 'rgba(255,220,210,.62)', ring: 'rgba(255,220,200,.55)', acc: '#ff8a4c', star: '255,235,220' },
  mono:     { bg: ['#000', '#090909', '#151515'], g1: 'rgba(255,255,255,.07)', g2: 'rgba(255,255,255,.05)', fg: '#fff', mut: 'rgba(255,255,255,.55)', ring: 'rgba(255,255,255,.4)', acc: '#ffffff', star: '255,255,255' },
  light:    { bg: ['#fbfcfe', '#eef3fb', '#e3eaf7'], g1: 'rgba(29,155,240,.16)', g2: 'rgba(255,110,200,.12)', fg: '#0f1419', mut: 'rgba(15,20,25,.55)', ring: 'rgba(255,255,255,1)', acc: '#1d9bf0', star: '15,20,25' },
};

// ---------- data ----------
let DATA = { owner: {}, followers: [] };
const cache = new Map(); // url -> ImageBitmap | null

function normalize(json) {
  const arr = Array.isArray(json) ? json : (json.followers || json.users || []);
  const seen = new Set();
  const followers = [];
  for (const u of arr) {
    const sn = u.screen_name || u.username || u.handle || '';
    const key = u.id || sn;
    if (!key || seen.has(key)) continue; seen.add(key);
    let av = u.avatar || u.profile_image_url_https || u.profile_image_url || '';
    av = av.replace(/_normal(\.\w+)$/, '_400x400$1');
    followers.push({ screen_name: sn, name: u.name || sn, avatar: av, followers_count: +u.followers_count || 0 });
  }
  const o = json.owner || {};
  const owner = { screen_name: o.screen_name || o.username || '', name: o.name || o.screen_name || '',
    avatar: (o.avatar || o.profile_image_url_https || '').replace(/_normal(\.\w+)$/, '_400x400$1'),
    followers_count: +o.followers_count || 0 };
  return { owner, followers };
}

function loadOne(url, thumb) {
  if (!url) return Promise.resolve(null);
  const k = url + '@' + thumb;
  if (cache.has(k)) return Promise.resolve(cache.get(k));
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';           // pbs.twimg.com sends Access-Control-Allow-Origin
    img.referrerPolicy = 'no-referrer';
    const done = (v) => { clearTimeout(t); cache.set(k, v); resolve(v); };
    const t = setTimeout(() => done(null), 20000);
    img.onload = async () => {
      try {
        const s = Math.min(img.naturalWidth, img.naturalHeight);
        done(await createImageBitmap(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s,
          { resizeWidth: thumb, resizeHeight: thumb, resizeQuality: 'high' }));
      } catch (_) { done(null); }
    };
    img.onerror = () => done(null);
    img.src = url;
  });
}

async function loadAll(urls, thumb, onProgress) {
  let i = 0, n = 0;
  const worker = async () => { while (i < urls.length) { const u = urls[i++]; await loadOne(u, thumb); onProgress && onProgress(++n, urls.length); } };
  await Promise.all(Array.from({ length: 16 }, worker));
}

// ---------- helpers ----------
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(a, r) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function hashHue(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 360; }
function fill(list, count, repeat, r) {
  if (!list.length) return [];
  if (!repeat) return list.slice(0, count);
  const out = []; let pool = [];
  while (out.length < count) { if (!pool.length) pool = shuffle(list, r); out.push(pool.pop()); }
  return out;
}

function background(ctx, W, H, T, stars, r) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, T.bg[0]); g.addColorStop(0.55, T.bg[1]); g.addColorStop(1, T.bg[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const M = Math.max(W, H);
  for (const [x, y, c, rad] of [[0.18 * W, 0.12 * H, T.g1, 0.75 * M], [0.88 * W, 0.92 * H, T.g2, 0.7 * M]]) {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, rad);
    rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  }
  if (stars) {
    const n = Math.round((W * H) / 6000);
    for (let i = 0; i < n; i++) {
      const s = r() ** 3 * (W / 900) + W / 4000;
      ctx.fillStyle = `rgba(${T.star},${0.15 + r() * 0.55})`;
      ctx.beginPath(); ctx.arc(r() * W, r() * H, s, 0, Math.PI * 2); ctx.fill();
    }
  }
  // vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, M * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, T === THEMES.light ? 'rgba(0,0,0,.05)' : 'rgba(0,0,0,.45)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

function avatar(ctx, u, x, y, d, T, thumb, ringW) {
  const bmp = u && cache.get(u.avatar + '@' + thumb);
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, d / 2, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
  if (bmp) ctx.drawImage(bmp, x - d / 2, y - d / 2, d, d);
  else {
    const h = hashHue((u && u.screen_name) || 'x');
    const g = ctx.createLinearGradient(x - d / 2, y - d / 2, x + d / 2, y + d / 2);
    g.addColorStop(0, `hsl(${h},70%,55%)`); g.addColorStop(1, `hsl(${(h + 50) % 360},70%,35%)`);
    ctx.fillStyle = g; ctx.fillRect(x - d / 2, y - d / 2, d, d);
    if (d > 18) {
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = `700 ${d * 0.45}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(((u && (u.name || u.screen_name)) || '?').trim().charAt(0).toUpperCase(), x, y + d * 0.03);
    }
  }
  ctx.restore();
  const lw = ringW ?? Math.max(1, d * 0.045);
  ctx.lineWidth = lw; ctx.strokeStyle = T.ring;
  ctx.beginPath(); ctx.arc(x, y, d / 2 - lw / 2, 0, Math.PI * 2); ctx.stroke();
}

// Sample hex-grid points inside a shape drawn by drawMask(ctx).
function maskPoints(W, H, drawMask, target, r, fixedS) {
  const k = Math.min(1, 900 / Math.max(W, H));
  const mw = Math.ceil(W * k), mh = Math.ceil(H * k);
  const c = document.createElement('canvas'); c.width = mw; c.height = mh;
  const m = c.getContext('2d'); m.scale(k, k); m.fillStyle = '#fff'; drawMask(m);
  const px = m.getImageData(0, 0, mw, mh).data;
  let area = 0; for (let i = 3; i < px.length; i += 4) if (px[i] > 127) area++;
  area /= k * k;
  const inside = (x, y) => { const xi = (x * k) | 0, yi = (y * k) | 0; return xi >= 0 && yi >= 0 && xi < mw && yi < mh && px[(yi * mw + xi) * 4 + 3] > 127; };
  let s = fixedS || Math.sqrt(area / (target * 0.866)), pts = [];
  s = Math.max(W / 260, Math.min(W / 14, s));
  for (let iter = 0; iter < (fixedS ? 1 : 6); iter++) {
    pts = [];
    const dy = s * 0.866;
    for (let row = 0, y = dy / 2; y < H; row++, y += dy)
      for (let x = (row % 2 ? s : s / 2); x < W; x += s) if (inside(x, y)) pts.push([x, y]);
    const ratio = pts.length / target;
    if (ratio > 0.93 && ratio < 1.08) break;
    s = Math.max(W / 260, Math.min(W / 14, s * Math.sqrt(ratio)));
  }
  return { pts, s, inside };
}

function glowShape(ctx, drawMask, T, W) {
  ctx.save(); ctx.filter = `blur(${Math.round(W / 45)}px)`; ctx.globalAlpha = 0.55;
  ctx.fillStyle = T.acc; drawMask(ctx); ctx.restore();
}

function caption(ctx, W, y, title, sub, T, scale = 1) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if (title) { ctx.fillStyle = T.fg; ctx.font = `800 ${W * 0.034 * scale}px ${FONT}`; ctx.fillText(title, W / 2, y); }
  if (sub) { ctx.fillStyle = T.mut; ctx.font = `500 ${W * 0.017 * scale}px ${FONT}`; ctx.fillText(sub, W / 2, y + W * 0.032 * scale); }
}

// ---------- styles ----------
const MIN_PTS = { text: 1200, xlogo: 700, heart: 480 };

function placeInMask(ctx, list, W, H, drawMask, o, T, r, thumb, style, fixedS) {
  const target = Math.round(o.repeat ? Math.max(list.length, MIN_PTS[style]) * o.density : Math.min(list.length, Math.max(list.length * o.density, 1)));
  const { pts, s } = maskPoints(W, H, drawMask, Math.max(target, 1), r, o.repeat ? fixedS : undefined);
  glowShape(ctx, drawMask, T, W);
  const users = fill(list, pts.length, o.repeat, r);
  // place larger ones later so they sit on top
  const items = pts.slice(0, users.length).map((p, i) => ({ x: p[0] + (r() - 0.5) * s * 0.08, y: p[1] + (r() - 0.5) * s * 0.08, d: s * (0.78 + 0.2 * r()), u: users[i] }));
  items.sort((a, b) => a.d - b.d).forEach((it) => avatar(ctx, it.u, it.x, it.y, it.d, T, thumb));
  return pts.length;
}

const STYLES = {
  text(ctx, o, T, r, thumb, list) {
    const W = o.W, capH = o.caption ? W * 0.075 : 0;
    const F = o.fontInfo || FONTS.sans;
    let text = Array.from(cleanText(o.text) || defaultText({ screen_name: o.handle })).slice(0, 40).join('');
    const cjk = HAS_CJK.test(text);
    const ls = cjk ? 0.04 : 0.07;                          // letter spacing (em)
    const setFont = (c, px) => { c.font = `${F.weight} ${px}px ${F.family}`; c.letterSpacing = `${px * ls}px`; };
    // measure at 100px
    setFont(ctx, 100);
    const lines = wrapLines(ctx, text);
    const ms = lines.map((l) => ctx.measureText(l));
    const asc = Math.max(...ms.map((m) => m.actualBoundingBoxAscent)), desc = Math.max(...ms.map((m) => m.actualBoundingBoxDescent));
    const lineH = asc + desc, gap = lineH * 0.18;
    const tw = Math.max(...ms.map((m) => m.width)), th = lineH * lines.length + gap * (lines.length - 1);
    const ratio = tw / th;
    const H = Math.round(Math.max(W * 0.37, Math.min(W * (lines.length > 1 ? 0.9 : 0.75), (W * 0.86) / ratio / 0.62 + capH)));
    const availH = H - capH - W * 0.04;
    const k = Math.min((W * 0.86) / tw, (availH * 0.8) / th);
    const size = 100 * k;
    const y0 = W * 0.03 + (availH - th * k) / 2 + asc * k;
    resize(ctx, W, H); background(ctx, W, H, T, o.stars, r);
    const drawMask = (c) => {
      setFont(c, size);
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.lineJoin = 'round'; c.lineWidth = size * (cjk ? 0.03 : 0.015); c.strokeStyle = c.fillStyle;
      lines.forEach((l, i) => { const y = y0 + i * (lineH + gap) * k; c.fillText(l, W / 2, y); c.strokeText(l, W / 2, y); });
    };
    // Spacing from glyph size so thin strokes (esp. Chinese) stay legible; never coarser than needed to show everyone once.
    const strokeFrac = cjk ? 0.034 : F.weight >= 700 ? 0.05 : 0.04;
    const fixedS = Math.max(W / 240, (size * strokeFrac) / Math.sqrt(o.density || 1));
    placeInMask(ctx, list, W, H, drawMask, o, T, r, thumb, 'text', fixedS);
    if (o.caption) caption(ctx, W, H - capH * 0.55, o.title || (o.handle ? '@' + o.handle : ''), o.sub, T, 0.75);
  },

  xlogo(ctx, o, T, r, thumb, list) {
    const W = o.W, H = W, capH = o.caption ? W * 0.12 : 0;
    resize(ctx, W, H); background(ctx, W, H, T, o.stars, r);
    const size = Math.min(W * 0.66, (H - capH) * 0.78);
    const sc = size / 1227, x0 = (W - 1200 * sc) / 2, y0 = (H - capH - size) / 2 + W * 0.01;
    const path = new Path2D(X_PATH);
    const drawMask = (c) => { c.save(); c.translate(x0, y0); c.scale(sc, sc); c.fill(path); c.restore(); };
    placeInMask(ctx, list, W, H, drawMask, o, T, r, thumb, 'xlogo');
    if (o.caption) caption(ctx, W, H - capH * 0.62, o.title || o.name, o.sub, T);
  },

  heart(ctx, o, T, r, thumb, list) {
    const W = o.W, H = W, capH = o.caption ? W * 0.12 : 0;
    resize(ctx, W, H); background(ctx, W, H, T, o.stars, r);
    const cx = W / 2, cy = (H - capH) / 2 + W * 0.02, sc = Math.min(W, H - capH) * 0.026;
    const drawMask = (c) => {
      c.beginPath();
      for (let t = 0; t <= Math.PI * 2 + 0.01; t += 0.01) {
        const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        c.lineTo(cx + x * sc, cy - y * sc - sc * 0.5);
      }
      c.closePath(); c.fill();
    };
    placeInMask(ctx, list, W, H, drawMask, o, T, r, thumb, 'heart');
    if (o.caption) caption(ctx, W, H - capH * 0.62, o.title || o.name, o.sub, T);
  },

  galaxy(ctx, o, T, r, thumb, list) {
    const W = o.W, H = W, capH = o.caption ? W * 0.11 : 0;
    resize(ctx, W, H); background(ctx, W, H, T, o.stars, r);
    const cx = W / 2, cy = (H - capH) / 2 + W * 0.015;
    const Rmax = (H - capH) * 0.47, R0 = W * 0.1, Rg = R0 * 1.32;
    const users = list.slice().sort((a, b) => b.followers_count - a.followers_count);
    const N = users.length, k = Math.sqrt((Rmax * Rmax - Rg * Rg) / Math.max(N, 1));
    const GA = Math.PI * (3 - Math.sqrt(5));
    // orbit rings
    ctx.save(); ctx.strokeStyle = T.ring; ctx.globalAlpha = 0.12; ctx.lineWidth = Math.max(1, W / 1600);
    for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(cx, cy, Rg + (Rmax - Rg) * i / 4.2, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    const items = users.map((u, i) => {
      const rad = Math.sqrt(Rg * Rg + k * k * (i + 0.5)), t = i / Math.max(N - 1, 1);
      const a = i * GA + (rad / Rmax) * 1.6;
      return { u, x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad, d: Math.min(k * 1.5 * (1.12 - 0.42 * t), W * 0.09) };
    });
    items.reverse().forEach((it) => avatar(ctx, it.u, it.x, it.y, it.d, T, thumb));
    // owner in the center with glow
    const glow = ctx.createRadialGradient(cx, cy, R0 * 0.8, cx, cy, R0 * 2.1);
    glow.addColorStop(0, T.g1.replace(/[\d.]+\)$/, '0.9)')); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R0 * 2.1, 0, Math.PI * 2); ctx.fill();
    const own = { screen_name: o.handle, name: o.name, avatar: o.ownerAvatar };
    avatar(ctx, own, cx, cy, R0 * 2, T, thumb, W * 0.006);
    ctx.lineWidth = W * 0.003; ctx.strokeStyle = T.acc; ctx.beginPath(); ctx.arc(cx, cy, R0 + W * 0.009, 0, Math.PI * 2); ctx.stroke();
    if (o.caption) caption(ctx, W, H - capH * 0.6, o.title || o.name, o.sub, T);
  },

  grid(ctx, o, T, r, thumb, list) {
    const W = o.W, N = Math.max(list.length, 1), mx = W * 0.06, head = o.caption ? W * 0.2 : W * 0.06, foot = W * 0.06;
    const cols = Math.max(4, Math.min(80, Math.round(Math.sqrt(N * 1.15))));
    const cell = (W - 2 * mx) / cols, rows = Math.ceil(N / cols);
    const H = Math.round(head + rows * cell + foot);
    resize(ctx, W, H); background(ctx, W, H, T, o.stars, r);
    if (o.caption) {
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = T.fg; ctx.font = `800 ${W * 0.055}px ${FONT}`;
      ctx.fillText(o.title || o.name, mx, head * 0.5);
      ctx.fillStyle = T.mut; ctx.font = `500 ${W * 0.022}px ${FONT}`;
      ctx.fillText(o.sub, mx, head * 0.5 + W * 0.045);
      ctx.fillStyle = T.acc; ctx.fillRect(mx, head * 0.5 + W * 0.068, W * 0.06, W * 0.005);
    }
    list.forEach((u, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      const inRow = row === rows - 1 ? N - row * cols : cols;
      const off = (cols - inRow) * cell / 2;
      avatar(ctx, u, mx + off + col * cell + cell / 2, head + row * cell + cell / 2, cell * 0.86, T, thumb);
    });
  },
};

function resize(ctx, W, H) { ctx.canvas.width = W; ctx.canvas.height = H; }

// ---------- main render ----------
async function render(opts = {}) {
  const o = {
    style: 'text', W: 2400, theme: 'midnight', density: 1, repeat: true, caption: true, stars: true, seed: 7, ...opts,
  };
  const list = DATA.followers;
  const own = DATA.owner;
  o.handle = o.handle ?? own.screen_name;
  o.name = o.name || own.name || own.screen_name || o.text || tr('text.fallback');
  o.text = cleanText(o.text) || defaultText(own);
  o.ownerAvatar = o.ownerAvatar || own.avatar || (list[0] && list[0].avatar);
  const count = own.count || list.length;
  o.sub = o.sub ?? `${o.handle ? '@' + o.handle + '  ·  ' : ''}${tr('n.followers', { n: num(count) })}`;
  if (o.style === 'text') o.sub = o.subOverride ?? tr('n.followers', { n: num(count) });
  const thumb = list.length <= 300 ? 256 : list.length <= 1500 ? 160 : 96;
  const T = THEMES[o.theme] || THEMES.midnight;
  const urls = [...new Set([o.ownerAvatar, ...list.map((u) => u.avatar)].filter(Boolean))];
  await loadAll(urls, thumb, o.onProgress);
  if (o.style === 'text') o.fontInfo = await ensureFont(o.font, o.text);
  const ctx = o.canvas ? o.canvas.getContext('2d') : $('out').getContext('2d');
  (STYLES[o.style] || STYLES.text)(ctx, o, T, rng(o.seed), thumb, list);
  const failed = urls.filter((u) => !cache.get(u + '@' + thumb)).length;
  return { width: ctx.canvas.width, height: ctx.canvas.height, avatars: urls.length, failed };
}

window.XAM = {
  load(json) { DATA = normalize(json); DATA.owner.count = DATA.followers.length; return DATA; },
  render, get data() { return DATA; }, canvas: $('out'), themes: Object.keys(THEMES), styles: Object.keys(STYLES),
  fonts: Object.fromEntries(Object.entries(FONTS).map(([k, f]) => [k, { family: f.family, weight: f.weight }])), // labels: XAM_I18N.t('font.' + key)
  defaultText: (owner) => defaultText(owner || DATA.owner), cleanText, ensureFont,
};


})();
