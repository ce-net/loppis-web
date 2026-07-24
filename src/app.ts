/**
 * loppis-web — the marketplace frontend. A thin, framework-free page that is a full typed
 * mesh CONSUMER: the same contracts the backends share, the same connect() an AI agent or
 * another service would use. The dev server proxies /api -> the local node, so the page
 * needs no token and no CORS.
 */

import { CeClient } from "@ce-net/sdk";
import { connect, CallError, type Client } from "@ce-net/iface";
import { ListingsIface, type Listing } from "@loppis/listings/iface";
import { BidsIface, type Bid } from "@loppis/bids/iface";

const ce = new CeClient({ baseUrl: `${location.origin}/api` });

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`missing element ${sel}`);
  return el;
};

const feed = $("#feed");
const listEl = $("#listings");
const status = $("#status");

function note(msg: string): void {
  status.textContent = msg;
}

function feedLine(text: string): void {
  const li = document.createElement("li");
  li.textContent = `${new Date().toLocaleTimeString()} ${text}`;
  feed.prepend(li);
  while (feed.children.length > 30) feed.lastChild?.remove();
}

const highest = new Map<string, Bid>();

function render(listings: Listing[]): void {
  listEl.replaceChildren(
    ...listings.map((l) => {
      const li = document.createElement("li");
      li.className = `listing ${l.status}`;
      const high = highest.get(l.id);
      li.innerHTML = `
        <strong></strong> <span class="price"></span>
        <em class="desc"></em>
        <span class="high"></span>`;
      li.querySelector("strong")!.textContent = l.title;
      li.querySelector(".price")!.textContent = `start ${l.startPrice} kr`;
      li.querySelector(".desc")!.textContent = l.description ?? "";
      li.querySelector(".high")!.textContent = high
        ? `highest: ${high.amount} kr (${high.bidder.slice(0, 8)}…)`
        : "no bids yet";
      const form = document.createElement("form");
      form.innerHTML = `<input name="amount" type="number" placeholder="bid (kr)" required /><button>Bid</button>`;
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        void placeBid(l.id, Number(new FormData(form).get("amount")));
      });
      if (l.status === "open") li.append(form);
      return li;
    }),
  );
}

let listings: Client<typeof ListingsIface>;
let bids: Client<typeof BidsIface>;

async function refresh(): Promise<void> {
  const all = await listings.list({ limit: 50 });
  await Promise.all(
    all.map(async (l) => {
      const h = await bids.highest({ listingId: l.id });
      if (h) highest.set(l.id, h);
    }),
  );
  render(all);
}

async function placeBid(listingId: string, amount: number): Promise<void> {
  try {
    const bid = await bids.place({ listingId, amount });
    note(`bid ${bid.amount} kr placed`);
  } catch (e) {
    note(e instanceof CallError ? `refused: ${e.code} — ${e.message}` : String(e));
  }
}

$("#create").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target as HTMLFormElement);
  void (async () => {
    try {
      const desc = String(f.get("description") ?? "");
      await listings.create({
        title: String(f.get("title")),
        startPrice: Number(f.get("startPrice")),
        ...(desc ? { description: desc } : {}),
      });
      ($("#create") as unknown as HTMLFormElement).reset();
      note("listing created");
    } catch (err) {
      note(err instanceof CallError ? `refused: ${err.code} — ${err.message}` : String(err));
    }
  })();
});

note("connecting to the mesh…");
try {
  [listings, bids] = await Promise.all([connect(ce, ListingsIface), connect(ce, BidsIface)]);
  note(`connected — listings@${listings.provider.slice(0, 8)}… bids@${bids.provider.slice(0, 8)}…`);
  await refresh();
  // The social feed IS the typed event streams.
  await listings.on("created", (l) => {
    feedLine(`new listing: ${l.title} (start ${l.startPrice} kr)`);
    void refresh();
  });
  await bids.on("placed", (b) => {
    highest.set(b.listingId, b);
    feedLine(`bid: ${b.amount} kr on ${b.listingId.slice(0, 8)}… by ${b.bidder.slice(0, 8)}…`);
    void refresh();
  });
} catch (e) {
  note(`connect failed: ${e instanceof Error ? e.message : e} — are the loppis daemons and ce node running?`);
}
