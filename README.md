# loppis-web

The browser frontend of **loppis**. A framework-free page that is a full typed mesh
CONSUMER — the exact same contracts (`@loppis/listings/iface`, `@loppis/bids/iface`) and the
same `connect()` the backends and any AI agent use. Live feed = the typed `created`/`placed`
event streams. Bids and listings are compile-checked in the page code and runtime-validated
at the boundary; refusals render their typed codes.

## Run (localhost dev)

```
npm install && npm run dev       # http://localhost:5173
```
Needs: `ce start`, loppis-listings + loppis-bids running (LOPPIS_OPEN=1). The dev server
proxies /api -> the local node and injects the operator api.token SERVER-side (same-origin:
no CORS dependency, token never in the page). Production path: publish the bundle via
ce-publish and reach the mesh through the mesh-bridge — dev-server.mjs is dev-only.
