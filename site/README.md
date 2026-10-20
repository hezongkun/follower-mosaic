# Product page (https://x.sdkmini.com)

Static bilingual (zh-CN / en) intro page for Follower Mosaic. No build step.

- `index.html` – the page. Language: `?lang=zh|en`, then the toggle (saved in localStorage), then the browser language.
- `privacy.html` – privacy policy (matches the 1.0.0 store build), served at `/privacy.html`.
- `assets/` – icon and store screenshots (zh in `assets/`, en in `assets/en/`).
- `downloads/follower-mosaic-1.0.0.zip` – not in git; built with `node extension/build-store.mjs --zip ...` and copied next to the page on deploy.

**Chrome Web Store link:** once the listing is approved, set `CHROME_STORE_URL` near the top of the `<script>` in `index.html`. The "审核中 / Coming soon" card switches to "添加到 Chrome / Add to Chrome" automatically.

Deploy: copy this folder (plus `downloads/`) to `/opt/1panel/www/sites/x.sdkmini.com/index/` on the server.
