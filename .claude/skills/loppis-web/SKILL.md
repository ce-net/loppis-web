---
name: loppis-web
description: The loppis marketplace web frontend — typed mesh consumer page + dev server with /api proxy. Read before using or editing.
---
# loppis-web
Vanilla-TS page (src/app.ts) bundled by esbuild; index.html; dev-server.mjs serves + proxies
/api to the local node with api.token injected server-side (dev only — never expose it
publicly). The page uses connect() from @ce-net/iface with baseUrl location.origin+"/api".
Run: `ce app install ./loppis-web` (needs `ce start` + both loppis backends in open auth
mode). npm is INTERNAL build tooling only — `npm run build` regenerates the committed
dist/app.js; it is never the operator surface.
UI updates ride the typed event subscriptions; keep all mesh types imported from the
"/iface" exports of the backend repos — never redeclare payload shapes here.

Singleton: dev-server.mjs takes a pid-lock at ~/.local/share/loppis-web/daemon.pid (outside
the install dir, which `ce app install` wipes) and exits quietly if another instance is live
or the port is held — the same law the backends carry. Without it every supervisor respawn
died on EADDRINUSE and dumped a stack trace into daemon.log.

Gotcha that killed the demo once: a stray `node dist/main.js` left running in a backend repo
is a SECOND provider on the same topic. Both answer, replies race, and the two instances hold
divergent state (a get() hits on one and MISSes on the other). Only ever run the backends
through `ce app install`; check with `ps ax | grep dist/main.js` before debugging state bugs.
