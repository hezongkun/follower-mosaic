# Changelog

## 1.0.1
- **Never stuck at 0 %**: while waiting for the first page the panel shows a spinner, a moving progress bar, step text that updates, the elapsed time and a note that the first page usually takes 10–30 s. With no progress for 45 s it shows an error instead of waiting forever.
- **More robust start**: the request watcher now runs from `document_start` (manifest content script, MAIN world), so follower requests X made before you clicked, e.g. an already-open or cached Followers tab, are used directly. If X issues no request, the panel tries, in order: in-app navigation, clicking X's own Followers tab, profile → followers again, scrolling, the page's resource-timing entries, a direct read-only request with page-equivalent headers, and finally one page reload that re-opens the panel and continues.
- **Diagnostics**: every step is logged with the `[FollowerMosaic]` prefix in the page console and kept in an in-memory ring buffer. "Copy diagnostics" (progress and error views) copies a JSON report (version, browser, page path, steps, timing incl. time to first page, last 200 log lines) with cookies, tokens, authorization and transaction ids redacted.
- **Styles**: the X-logo style replaces Galaxy in all builds (order: Name, X logo, Heart, Grid), with a live thumbnail. Galaxy remains in the web generator and CLI.
- Permissions: adds host access to `x.com` / `twitter.com` only (document_start watcher + one-time resume after the reload fallback).

## 1.0.0
- First release.
