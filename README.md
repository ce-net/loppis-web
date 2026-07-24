# loppis-web — the marketplace, and why a web developer should care

This is the frontend of **loppis**, a secondhand marketplace with live bidding — and the
working demo of what CE (github.com/ce-net/ce) gives JavaScript developers that the usual
stacks do not. It is a framework-free page that is a full peer on the mesh: it uses the
IDENTICAL typed client the backends use, and its "social feed" is nothing but typed event
streams.

## Why you would want this stack (the honest pitch)

- **No login page, anywhere in this app.** There are no accounts, sessions, or cookies. Every
  caller — this page, a backend, an AI agent — is an authenticated peer; handlers get a
  verified sender identity, and what a caller MAY do is a capability declared in the API
  schema itself (`requires: "loppis:bid:place"`). The typed refusals you see in the UI
  (`self-bid`, `too-low`) come from that schema.
- **Realtime without renting websocket infrastructure.** New listings and bids appear live in
  every open page via typed pub/sub events emitted by the services. No polling, no socket
  server, no third-party realtime SaaS.
- **tRPC-grade type safety, but all directions and polyglot.** One `defineInterface`
  definition (see `@ce-net/iface`) gives compile-time types + runtime validation on BOTH ends
  of every call — and the same contract works service->service (bids validates every bid
  against listings over the mesh) and could work backend->frontend. The contract exports as
  neutral JSON for Python/Go/Rust bindings.
- **Deploys are one command, to machines you own.** `ce app install <app>` — no cloud bill,
  no cold starts, no YAML. The whole stack is deployed and configured VISUALLY by
  loppis-deploy (github.com/ce-net/loppis-deploy), whose every button wraps that same command
  over an authenticated mesh op.

Full argument: `docs/why-web-developers.md` in github.com/ce-net/ce.

## Run the demo (ce-native — one command per app)

```
ce app install ./loppis-listings     # the listings service (github.com/ce-net/loppis-listings)
ce app install ./loppis-bids         # the bidding service  (github.com/ce-net/loppis-bids)
ce app install ./loppis-deploy       # the visual control plane — or use its UI for the above
ce app install ./loppis-web          # this page, served at http://127.0.0.1:5173
```

Needs a running `ce start` node. Open the page: create a listing, bid from the form, watch
the live feed and the embedded `<ce-viz-loppis>` cell animate the real typed calls flowing
through the architecture. Use loppis-deploy's UI (http://127.0.0.1:8990/ui/) to flip the
stack between open (dev) and closed (secure) auth modes LIVE — bids start getting typed
`forbidden` refusals the moment you close it.

The page's dev server proxies `/api` to the local node with the operator token injected
server-side: same-origin, no CORS dependency, and the token never reaches the browser.

## The stack

| repo | role |
|---|---|
| github.com/ce-net/ce-iface | typed contracts: schema -> TS types + validation + abilities + events |
| github.com/ce-net/loppis-listings | listings service; exports its contract as its public API |
| github.com/ce-net/loppis-bids | bidding service; provider AND typed consumer of listings |
| github.com/ce-net/loppis-web | this page — a typed mesh peer |
| github.com/ce-net/loppis-deploy | visual deploy/config/secure control plane over `ce app` |
| github.com/ce-net/loppis-viz | self-explaining visualization cell (flows + live traffic) |

## Development (npm is internal tooling, never the operator surface)

```
npm install && npm run build         # rebuild dist/app.js (committed) from src/
```
