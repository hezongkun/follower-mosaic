# Chrome Web Store listing · 商店信息

## Product name 名称
- **Store name / 默认 (en)**: `Follower Mosaic 粉丝拼图` (34 chars, ≤ 75)
- **zh_CN**: `粉丝拼图 Follower Mosaic`
- Short name: `Follower Mosaic` / `粉丝拼图`
- Name and icon deliberately contain **no "X"/"Twitter" mark or logo**. The platform is mentioned only descriptively ("for X", "on x.com") in descriptions, with a non-affiliation disclaimer.

(These match `extension/_locales/en|zh_CN/messages.json`, which the manifest uses via `__MSG_extName__`.)

## Short description 简短描述（≤ 132 chars, = manifest description）
- **en** (110): `Turn your followers' avatars into one beautiful image. Read-only, no password or login needed, runs locally.`
- **zh_CN** (41): `一键把你的粉丝头像拼成一张好看的图片。只读取、不要密码、无需授权，全部在本地完成。`

## Category 类别
- **Lifestyle › Social Networking**（备选 Lifestyle › Art & Design）

## Language 语言
- Default: **English**; additional: **Chinese (Simplified) 中文（简体）**.
- The extension UI is fully bilingual (auto-detected from the browser language, with a 中/EN toggle). Store name/description come from `_locales/en` and `_locales/zh_CN`.
- Upload `store/assets/en/*` screenshots + the English description for the **English** listing, and `store/assets/*` (Chinese) + the Chinese description under the **zh_CN** locale.

---

## Detailed description — English

Follower Mosaic turns the avatars of your followers on X into one polished, high-resolution image you can save and share.

**How it works**
1. Open x.com and sign in as you normally do.
2. Click the extension icon. It recognises the account you are signed in with.
3. Pick a style and press "Generate". A progress page shows how far along it is and how long is left.
4. Preview the image, switch styles or colour themes instantly, and download a 2400 px PNG.

**Styles**
• Your name — or any words you like, including Chinese — spelled out with follower avatars, in 5 fonts
• Galaxy: your avatar in the centre, followers spiralling around it
• Heart
• Grid wall with title and follower count
• Five colour themes (Midnight, Aurora, Sunset, Mono, Light)

You can also type another public username to make a mosaic of that account's followers.

**Built to protect your account and privacy**
• No password, no API key, no sign-in or authorization screen: it simply works inside the x.com tab you already have open.
• Read-only: it only reads the follower list. It never posts, follows, likes or sends messages.
• Gentle: one page at a time with a pause between pages (5 s by default, adjustable 1–10 s), automatic back-off when the site asks to slow down, and a follower limit you choose (500 by default, at most 5,000).
• Everything stays on your computer. Images are composed in your browser. Nothing is sent to us or any third party. There is no server, no analytics and no tracking.
• Minimal permissions: activeTab, scripting, storage. No permanent access to any website.
• Open source (MIT).

Not affiliated with, endorsed by or sponsored by X Corp. "X" is used only to describe the website this extension works with.

---

## 详细描述 — 中文

「粉丝拼图」可以把你在 X 上的粉丝头像拼成一张精美的高清图片，方便保存和分享。

**使用方法**
1. 打开 x.com，像平时一样登录。
2. 点击浏览器右上角的插件图标，插件会自动识别你当前登录的账号。
3. 选一个样式，点「生成我的粉丝头像图」，进度页会显示进度和预计剩余时间。
4. 预览图片，随时切换样式或配色（无需重新读取），一键下载 2400 像素高清 PNG。

**样式**
• 用粉丝头像拼出你的名字，或任何你想写的字（支持中文），5 种字体可选
• 星系：你的头像在中间，粉丝围绕旋转
• 爱心
• 头像墙（带标题和粉丝数）
• 5 种配色：午夜、极光、日落、黑白、浅色

也可以输入其他公开账号的用户名，生成对方粉丝的拼图。

**保护账号与隐私**
• 不要密码、不要 API Key、没有授权页面：直接在你已经打开的 x.com 页面里工作。
• 只读：只读取粉丝列表，绝不发帖、关注、点赞或私信。
• 温和：一次只读一页，每页之间暂停（默认 5 秒，可在 1–10 秒间调整）；网站要求放慢时自动等待；读取人数有上限（默认 500，最多 5000，可调整）。
• 数据只留在你的电脑：图片在浏览器里生成，不会发送给我们或任何第三方；没有服务器、没有统计、没有追踪。
• 最少权限：activeTab、scripting、storage，不常驻访问任何网站。
• 开源（MIT 协议）。

本插件与 X Corp. 无任何关联，也未获其认可或赞助；文中的 "X" 仅用于说明插件适用的网站。

---

## Assets 素材（`store/assets/`）
| File | Size | Use |
|---|---|---|
| `store-icon-128.png` | 128×128 (96 px artwork + transparent padding) | Store icon |
| `shot1-popup.png` | 1280×800 | Screenshot 1: popup / account detection |
| `shot2-progress.png` | 1280×800 | Screenshot 2: gentle progress |
| `shot3-result.png` | 1280×800 | Screenshot 3: result, style switcher, download |
| `shot4-styles.png` | 1280×800 | Screenshot 4: style gallery |
| `en/shot1-popup.png` … `en/shot4-styles.png` | 1280×800 | **English** screenshots 1–4 (same order; English UI) |
| `tile-440x280.png` | 440×280 | Small promo tile |
| `marquee-1400x560.png` | 1400×560 | Marquee promo tile (optional) |

All screenshots use **synthetic, generated avatars** (`store/synthetic/`), not real people or brand logos. Sources for re-rendering: `store/assets-src/*.html` (Chinese) and `store/assets-src/en/*.html` (English), rendered with headless Chrome at exact sizes from the captures in `store/raw/` and `store/raw/en/`.

## Build
- Upload zip: `node extension/build-store.mjs --zip follower-mosaic-extension.zip`. This removes the X-logo style and the demo mode and puts `manifest.json` at the zip root. Use `--keep-demo` only to capture screenshots.

## Other fields
- **Developer / author**: Kuno_he — https://x.com/Kuno_he
- **Official URL / Homepage**: `https://github.com/hezongkun/follower-mosaic` (manifest `homepage_url` points to https://x.com/Kuno_he)
- **Support URL**: `https://github.com/hezongkun/follower-mosaic/issues` (or DM https://x.com/Kuno_he)
- **Privacy policy URL**: `https://hezongkun.github.io/follower-mosaic/privacy.html` (source: `docs/privacy.html`, GitHub Pages from `/docs` on `main`)
- **Visibility**: start as *Unlisted* for a soft launch, then Public.
- **Pricing**: Free. No in-app purchases.
- **Test instructions for reviewers** (Distribution › Test instructions):
  > Sign in to any X account at https://x.com, click the extension icon, keep the default "名字/Name" style and press the big button. A panel opens inside the same x.com tab; the extension opens the account's Followers list in-app and reads it slowly (about 5 s per 20 followers; an account with under 100 followers finishes in under 30 s), then shows the image with a Download button. Closing the panel returns to the previous page. You can try the UI without an account by opening the popup on any other site: it shows the "please open x.com" screen.
