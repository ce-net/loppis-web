---
name: loppis-web
description: The loppis marketplace web frontend — typed mesh consumer page + dev server with /api proxy. Read before using or editing.
---
# loppis-web
Vanilla-TS page (src/app.ts) bundled by esbuild; index.html; dev-server.mjs serves + proxies
/api to the local node with api.token injected server-side (dev only — never expose it
publicly). The page uses connect() from @ce-net/iface with baseUrl location.origin+"/api".
Run: npm i && npm run dev (needs ce start + both loppis backends with LOPPIS_OPEN=1).
UI updates ride the typed event subscriptions; keep all mesh types imported from the
"/iface" exports of the backend repos — never redeclare payload shapes here.
