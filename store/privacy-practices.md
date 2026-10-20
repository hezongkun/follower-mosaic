# Chrome Web Store · Privacy practices tab（隐私权规范）

Copy each block into the matching field of the CWS Developer Dashboard → *Privacy practices*.

## Single purpose 单一用途
> Create a single collage image from the profile pictures of an X account's followers. The user starts it from the toolbar button while on x.com. The extension reads that account's follower list (read-only), then composes and downloads the image locally in the browser.
>
> 把某个 X 账号的粉丝头像拼成一张图片：用户在 x.com 上点击插件按钮后，插件只读地读取粉丝列表，并在浏览器本地生成、下载图片。

## Permission justifications 权限说明

**activeTab**
> Used only after the user clicks the toolbar button. It gives temporary access to the current tab, so the extension can (1) check that the tab is x.com and (2) run its helper script in that tab. Host access is limited to x.com / twitter.com (see Host permissions).

**scripting**
> Used, only after the user clicks the toolbar button and then “Generate”, to inject the extension's own bundled scripts into the active x.com tab with chrome.scripting.executeScript (granted by activeTab / the x.com host permission). (1) A small script in the page's own context (world: MAIN) watches the follower-list requests that x.com itself makes when the extension opens the account's Followers tab in-app. It reuses the same request format (query id, parameters, headers) to read further pages, changing only the cursor. Requests are read-only GETs to three operations (Followers, BlueVerifiedFollowers, UserByScreenName), one page about every 5 seconds. (2) An overlay (Shadow DOM) shows progress, the preview and the download button inside the same tab. Everything uses the session the user already has; no data is sent to any other server. No remote code is injected; all scripts ship in the package.

**storage**
> chrome.storage.local stores small UI preferences only: interface language (zh/en), chosen font, the custom text per account, reading speed and follower limit. The follower list exists only in the x.com tab's memory while the overlay is open and is discarded when it is closed. Nothing leaves the device.

**Host permissions: `https://x.com/*`, `https://twitter.com/*`**
> Needed for two small content scripts and for one fallback. (1) `lib/capture-main.js` runs in the page's own context (world MAIN) at document_start so it can see x.com's own follower-list requests even when the page loaded them before the user opened the extension (for example when the user is already on the Followers tab, which X then serves from its cache). It only keeps the most recent few of those responses in the tab's memory, sends nothing anywhere and stays silent until the user presses “Generate”. (2) `lib/resume.js` checks a one-time flag in sessionStorage; it does nothing unless the panel itself reloaded the tab as a last fallback, in which case it asks the service worker to re-open the panel so reading continues. The service worker (`background.js`) only re-injects the extension's own bundled panel into that x.com tab, which needs host access because `activeTab` ends with the reload. No other site is accessed. Avatar images load from pbs.twimg.com as normal CORS `<img>` requests; no permission is requested for them.

## Remote code 远程代码
**No, I am not using remote code.**
> All JavaScript is packaged in the extension. Nothing is loaded from a server and run, and there is no eval and no `new Function`. To find current GraphQL operation IDs, the content script downloads x.com's public JavaScript bundle as plain text and reads one ID string from it with a regular expression. That text is never executed.

## Data usage 数据使用

**What user data do you plan to collect from users now or in the future?**
Under CWS's definition, "collect" means the extension handles the data, even if only locally. Recommended boxes to tick, for full transparency:

| Category | Tick? | What exactly | Where it goes |
|---|---|---|---|
| Personally identifiable information | ✅ | Public display names and @usernames of the chosen account and its followers | Kept in this browser only (memory + chrome.storage.local) |
| Website content | ✅ | Public profile pictures (avatar URLs and images) from x.com / pbs.twimg.com | Drawn onto a canvas locally; the PNG is saved only if the user clicks Download |
| Authentication information | ✅ (conservative) | No passwords or tokens are collected. The page's existing CSRF cookie (`ct0`) is read inside the x.com tab and attached to the same-site request, just as x.com's own web app does | Never stored, logged or sent anywhere except back to x.com in that request |
| Health, Financial/payment, Personal communications, Location, Web history, User activity | ❌ | Not accessed | — |

*(If you prefer a minimal disclosure, "Authentication information" may be left unticked: the extension never sees passwords or OAuth tokens and does not store the cookie. Ticking it is the safer choice in review.)*

## Certifications 认证（tick all three）
- ☑ I do not sell or transfer user data to third parties, outside of the approved use cases.
- ☑ I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Privacy policy URL
`https://hezongkun.github.io/follower-mosaic/privacy.html`
(GitHub Pages, served from `docs/privacy.html` on the `main` branch.)
