// node_modules/@ce-net/sdk/dist/index.js
var CREDIT = 1000000000000000000n;
var Amount = class Amount2 {
  /** Signed base units, mirrors ce-rs `Amount(i128)`. */
  base;
  constructor(base) {
    this.base = base;
  }
  /** The zero amount. */
  static ZERO = new Amount2(0n);
  /**
  * Construct from raw base units — the wire form. Accepts a decimal string
  * (`"1500000000000000000"`) or a `bigint`. Rejects floats and malformed strings.
  */
  static fromBaseUnits(s) {
    if (typeof s === "bigint") return new Amount2(s);
    const t2 = s.trim();
    if (!/^-?\d+$/.test(t2)) throw new RangeError(`invalid base-unit amount: ${JSON.stringify(s)}`);
    return new Amount2(BigInt(t2));
  }
  /**
  * Parse a human credit decimal (`"1000"`, `"1.5"`, `"0.000000000000000001"`),
  * up to 18 decimal places. Pure string math — never `parseFloat`. Mirrors
  * ce-rs `Amount::parse_credits`. Also accepts `number`/`bigint`, but a `number` MUST be
  * an integer count of credits: a fractional `number` (e.g. `0.1 + 0.2`) cannot be
  * represented exactly in IEEE-754, so accepting it would silently encode float error
  * into the ledger. Pass fractional credits as a string (`fromCredits("0.3")`) instead.
  */
  static fromCredits(s) {
    if (typeof s === "bigint") return new Amount2(s * CREDIT);
    if (typeof s === "number") {
      if (!Number.isFinite(s)) throw new RangeError(`invalid credit amount: ${s}`);
      if (!Number.isInteger(s)) throw new RangeError(`fromCredits(number) requires an integer credit count (got ${s}); pass fractional credits as a string, e.g. fromCredits("0.3")`);
      return new Amount2(BigInt(s) * CREDIT);
    }
    const trimmed = s.trim();
    const neg = trimmed.startsWith("-");
    const body = neg ? trimmed.slice(1) : trimmed;
    if (body === "") throw new RangeError(`invalid credit amount: ${JSON.stringify(s)}`);
    const [wholeStr, fracStr = ""] = body.split(".");
    if (body.split(".").length > 2) throw new RangeError(`invalid credit amount: ${JSON.stringify(s)}`);
    if (fracStr.length > 18) throw new RangeError(`amount ${JSON.stringify(s)} has more than 18 decimal places`);
    if (wholeStr !== "" && !/^\d+$/.test(wholeStr)) throw new RangeError(`invalid credit amount: ${JSON.stringify(s)}`);
    if (fracStr !== "" && !/^\d+$/.test(fracStr)) throw new RangeError(`invalid credit amount: ${JSON.stringify(s)}`);
    const whole = wholeStr === "" ? 0n : BigInt(wholeStr);
    const fracPadded = (fracStr + "0".repeat(18)).slice(0, 18);
    const frac = fracPadded === "" ? 0n : BigInt(fracPadded);
    const baseAbs = whole * CREDIT + frac;
    return new Amount2(neg ? -baseAbs : baseAbs);
  }
  /** Construct from `n` whole credits (`n * CREDIT`). Mirrors ce-rs `from_credits`. */
  static fromWholeCredits(n) {
    if (typeof n === "number") {
      if (!Number.isInteger(n)) throw new RangeError(`fromWholeCredits expects an integer, got ${n}`);
      return new Amount2(BigInt(n) * CREDIT);
    }
    return new Amount2(n * CREDIT);
  }
  /** Wire form: a decimal string of base units, e.g. `"1500000000000000000"`. */
  toBaseUnits() {
    return this.base.toString();
  }
  /** Human form: a decimal credit string, trimming trailing zeros, e.g. `"1.5"`. */
  toCredits() {
    const sign = this.base < 0n ? "-" : "";
    const v = this.base < 0n ? -this.base : this.base;
    const whole = v / CREDIT;
    const frac = v % CREDIT;
    if (frac === 0n) return `${sign}${whole.toString()}`;
    const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "");
    return `${sign}${whole.toString()}.${fracStr}`;
  }
  /** `"1.5 credits"`. Mirrors ce-rs `Display`. */
  toString() {
    return `${this.toCredits()} credits`;
  }
  /**
  * Serializes to the base-unit decimal string so `JSON.stringify({ amount })` is
  * correct and never throws on a bare `bigint`.
  */
  toJSON() {
    return this.toBaseUnits();
  }
  add(o) {
    return new Amount2(this.base + o.base);
  }
  sub(o) {
    return new Amount2(this.base - o.base);
  }
  cmp(o) {
    if (this.base < o.base) return -1;
    if (this.base > o.base) return 1;
    return 0;
  }
  eq(o) {
    return this.base === o.base;
  }
  isZero() {
    return this.base === 0n;
  }
  isNegative() {
    return this.base < 0n;
  }
};
async function resolveToken(src) {
  if (src === void 0) return void 0;
  if (typeof src === "string") return src;
  const out = src();
  return out instanceof Promise ? await out : out;
}
function envToken() {
  const proc = globalThis.process;
  if (proc?.env?.CE_API_TOKEN) return proc.env.CE_API_TOKEN;
  const deno = globalThis.Deno;
  if (deno?.env) try {
    const v = deno.env.get("CE_API_TOKEN");
    if (v) return v;
  } catch {
  }
}
function isNodeLike() {
  const proc = globalThis.process;
  return Boolean(proc?.versions?.node);
}
function defaultDataDir() {
  const proc = globalThis.process;
  const env = proc?.env;
  if (!env) return void 0;
  if (env.CE_DATA_DIR) return env.CE_DATA_DIR;
  if (env.XDG_DATA_HOME) return `${env.XDG_DATA_HOME}/ce`;
  const home = env.HOME ?? env.USERPROFILE;
  if (!home) return void 0;
  if (proc?.platform === "win32" && env.APPDATA) return `${env.APPDATA}/ce`;
  if (proc?.platform === "darwin") return `${home}/Library/Application Support/ce`;
  return `${home}/.local/share/ce`;
}
async function discoverApiToken() {
  const fromEnv = envToken();
  if (fromEnv) return fromEnv;
  if (!isNodeLike()) return void 0;
  const dir = defaultDataDir();
  if (!dir) return void 0;
  try {
    const tok = (await (await import("node:fs/promises")).readFile(`${dir}/api.token`, "utf8")).trim();
    return tok.length > 0 ? tok : void 0;
  } catch {
    return;
  }
}
var CeError = class extends Error {
  name = "CeError";
  constructor(message, options) {
    super(message, options);
    Object.setPrototypeOf(this, new.target.prototype);
  }
};
var CeApiError = class extends CeError {
  name = "CeApiError";
  /** HTTP status code. */
  status;
  /** Parsed `error` field, or the raw body text. */
  body;
  /** Correlation id from a response header, if the node provided one. */
  requestId;
  constructor(message, status2, body, requestId) {
    super(message);
    this.status = status2;
    this.body = body;
    if (requestId !== void 0) this.requestId = requestId;
  }
};
var CeBadRequestError = class extends CeApiError {
  name = "CeBadRequestError";
};
var CeAuthError = class extends CeApiError {
  name = "CeAuthError";
};
var CeInsufficientFundsError = class extends CeApiError {
  name = "CeInsufficientFundsError";
};
var CeNotFoundError = class extends CeApiError {
  name = "CeNotFoundError";
};
var CeRateLimitError = class extends CeApiError {
  name = "CeRateLimitError";
  /** Seconds to wait, parsed from `Retry-After`, if present. */
  retryAfter;
  constructor(message, status2, body, retryAfter, requestId) {
    super(message, status2, body, requestId);
    if (retryAfter !== void 0) this.retryAfter = retryAfter;
  }
};
var CePeerError = class extends CeApiError {
  name = "CePeerError";
};
var CeUnavailableError = class extends CeApiError {
  name = "CeUnavailableError";
};
var CeTimeoutError = class extends CeApiError {
  name = "CeTimeoutError";
};
var CeServerError = class extends CeApiError {
  name = "CeServerError";
};
var CeConnectionError = class extends CeError {
  name = "CeConnectionError";
  constructor(message, options) {
    super(message, options);
  }
};
var CeStreamError = class extends CeError {
  name = "CeStreamError";
  constructor(message, options) {
    super(message, options);
  }
};
function errorFromStatus(status2, message, body, opts) {
  const requestId = opts?.requestId;
  switch (status2) {
    case 400:
      return new CeBadRequestError(message, status2, body, requestId);
    case 401:
    case 403:
      return new CeAuthError(message, status2, body, requestId);
    case 402:
      return new CeInsufficientFundsError(message, status2, body, requestId);
    case 404:
      return new CeNotFoundError(message, status2, body, requestId);
    case 429:
      return new CeRateLimitError(message, status2, body, opts?.retryAfter, requestId);
    case 502:
      return new CePeerError(message, status2, body, requestId);
    case 503:
      return new CeUnavailableError(message, status2, body, requestId);
    case 504:
      return new CeTimeoutError(message, status2, body, requestId);
    default:
      if (status2 >= 500) return new CeServerError(message, status2, body, requestId);
      return new CeApiError(message, status2, body, requestId);
  }
}
var RETRYABLE_STATUS = /* @__PURE__ */ new Set([
  408,
  425,
  429,
  500,
  502,
  503,
  504
]);
var Transport = class {
  baseUrl;
  tokenSource;
  fetchImpl;
  timeoutMs;
  maxRetries;
  defaultHeaders;
  constructor(opts) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.tokenSource = opts.token;
    const f = opts.fetch ?? globalThis.fetch;
    if (typeof f !== "function") throw new CeConnectionError("no global fetch available; pass `fetch` in CeClientOptions");
    this.fetchImpl = opts.fetch ?? f.bind(globalThis);
    this.timeoutMs = opts.timeoutMs ?? 3e4;
    this.maxRetries = opts.maxRetries ?? 2;
    this.defaultHeaders = opts.headers ?? {};
  }
  /** The resolved base URL (used by the SSE layer). */
  url(path) {
    return `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  }
  /** The fetch implementation in use (shared with the SSE layer). */
  fetch() {
    return this.fetchImpl;
  }
  /** Resolve the current auth token (string | sync | async source). */
  async authToken() {
    return resolveToken(this.tokenSource);
  }
  /** Default headers (used by the SSE layer to share auth posture). */
  baseHeaders() {
    return { ...this.defaultHeaders };
  }
  /** Perform a typed request, returning the decoded body. */
  async request(method, path, decode, opts = {}) {
    const isGet = method === "GET";
    const needAuth = opts.auth ?? !isGet;
    const maxRetries = opts.maxRetries ?? this.maxRetries;
    const url = this.url(path);
    const headers = {
      Accept: "application/json, text/plain, */*",
      ...this.defaultHeaders,
      ...opts.headers
    };
    let bodyInit;
    if (opts.rawBody !== void 0) {
      bodyInit = toArrayBufferView(opts.rawBody);
      headers["Content-Type"] ??= "application/octet-stream";
    } else if (opts.body !== void 0) {
      bodyInit = JSON.stringify(opts.body);
      headers["Content-Type"] ??= "application/json";
    }
    if (needAuth) {
      const token = await this.authToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    if (opts.idempotent && headers["Idempotency-Key"] === void 0) headers["Idempotency-Key"] = randomUuid();
    let attempt = 0;
    for (; ; ) {
      const { controller, cleanup } = makeAbort(opts.timeoutMs ?? this.timeoutMs, opts.signal);
      try {
        const res = await this.fetchImpl(url, {
          method,
          headers,
          ...bodyInit !== void 0 ? { body: bodyInit } : {},
          signal: controller.signal
        });
        cleanup();
        if (res.ok) return await decodeBody(res, decode);
        const apiErr = await buildApiError(res);
        if (attempt < maxRetries && RETRYABLE_STATUS.has(res.status)) {
          await sleep$3(backoffMs(attempt, retryAfterMs(res)));
          attempt++;
          continue;
        }
        throw apiErr;
      } catch (err) {
        cleanup();
        if (isCeApiError(err)) throw err;
        const connErr = toConnectionError(err, opts.signal);
        if (attempt < maxRetries && !isCallerAbort(opts.signal)) {
          await sleep$3(backoffMs(attempt));
          attempt++;
          continue;
        }
        throw connErr;
      }
    }
  }
};
function isCeApiError(e) {
  return typeof e === "object" && e !== null && "status" in e && "body" in e && e instanceof Error;
}
async function buildApiError(res) {
  let bodyText = "";
  try {
    bodyText = await res.text();
  } catch {
    bodyText = "";
  }
  let message = res.statusText || `HTTP ${res.status}`;
  let parsed = bodyText;
  if (bodyText) try {
    const j = JSON.parse(bodyText);
    if (typeof j.error === "string") {
      message = j.error;
      parsed = j.error;
    }
  } catch {
  }
  const requestId = res.headers.get("x-request-id") ?? res.headers.get("x-ce-request-id") ?? void 0;
  const retryAfter = retryAfterSeconds(res);
  return errorFromStatus(res.status, message, parsed, {
    ...retryAfter !== void 0 ? { retryAfter } : {},
    ...requestId !== void 0 ? { requestId } : {}
  });
}
async function decodeBody(res, decode) {
  switch (decode) {
    case "void":
      try {
        await res.arrayBuffer();
      } catch {
      }
      return;
    case "text":
      return await res.text();
    case "bytes":
      return new Uint8Array(await res.arrayBuffer());
    case "json": {
      const txt = await res.text();
      if (txt.trim() === "") return void 0;
      return JSON.parse(txt);
    }
  }
}
function toConnectionError(err, signal) {
  if (err instanceof CeConnectionError) return err;
  if (isAbortError(err)) {
    if (isCallerAbort(signal)) return new CeConnectionError("request aborted by caller", { cause: err });
    return new CeConnectionError("request timed out", { cause: err });
  }
  return new CeConnectionError(`network request failed: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
}
function isAbortError(err) {
  return typeof err === "object" && err !== null && "name" in err && err.name === "AbortError";
}
function isCallerAbort(signal) {
  return signal?.aborted === true;
}
function makeAbort(timeoutMs, caller) {
  const controller = new AbortController();
  let timer;
  if (timeoutMs > 0) timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (caller) if (caller.aborted) controller.abort();
  else caller.addEventListener("abort", onAbort, { once: true });
  const cleanup = () => {
    if (timer !== void 0) clearTimeout(timer);
    if (caller) caller.removeEventListener("abort", onAbort);
  };
  return {
    controller,
    cleanup
  };
}
function retryAfterMs(res) {
  const s = retryAfterSeconds(res);
  return s === void 0 ? void 0 : s * 1e3;
}
function retryAfterSeconds(res) {
  const h = res.headers.get("retry-after");
  if (!h) return void 0;
  const n = Number(h);
  if (Number.isFinite(n)) return n;
  const date = Date.parse(h);
  if (Number.isFinite(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1e3));
}
function backoffMs(attempt, floor) {
  const exp = Math.min(1e4, 200 * 2 ** attempt);
  const jittered = Math.random() * exp;
  return Math.max(floor ?? 0, jittered);
}
function sleep$3(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function randomUuid() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = Math.random() * 16 | 0;
    return (ch === "x" ? r : r & 3 | 8).toString(16);
  });
}
function toArrayBufferView(bytes) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}
var CapabilitiesApi = class {
  t;
  constructor(t2) {
    this.t = t2;
  }
  /** `POST /capabilities/revoke` → tx id. Revokes a capability this node issued. */
  async revoke(nonce) {
    return (await this.t.request("POST", "/capabilities/revoke", "json", { body: { nonce } })).tx_id;
  }
  /** `GET /capabilities/revoked` → on-chain revoked `(issuer, nonce)` set. */
  async revoked() {
    return (await this.t.request("GET", "/capabilities/revoked", "json", { auth: false }) ?? []).map((e) => Array.isArray(e) ? {
      issuer: e[0],
      nonce: e[1]
    } : {
      issuer: e.issuer,
      nonce: e.nonce
    });
  }
};
var HEX_CHARS = "0123456789abcdef";
function toHex(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    out += HEX_CHARS[b >> 4] + HEX_CHARS[b & 15];
  }
  return out;
}
function fromHex(hex) {
  let s = hex.trim();
  if (s.startsWith("0x") || s.startsWith("0X")) s = s.slice(2);
  if (s.length % 2 !== 0) throw new RangeError(`hex string has odd length: ${s.length}`);
  if (s.length > 0 && !/^[0-9a-fA-F]+$/.test(s)) throw new RangeError("hex string contains non-hex characters");
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function utf8ToBytes(s) {
  return new TextEncoder().encode(s);
}
var DEFAULT_CHUNK_SIZE = 1024 * 1024;
async function cid(bytes) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new CeError("crypto.subtle is unavailable in this runtime");
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const digest = await subtle.digest("SHA-256", buf);
  return toHex(new Uint8Array(digest));
}
async function chunkObject(bytes, size = DEFAULT_CHUNK_SIZE) {
  const chunks = [];
  const cids = [];
  for (let off = 0; off < bytes.length || off === 0 && bytes.length === 0; off += size) {
    const slice = bytes.subarray(off, Math.min(off + size, bytes.length));
    const c = await cid(slice);
    chunks.push([c, slice]);
    cids.push(c);
    if (bytes.length === 0) break;
  }
  return {
    manifest: {
      kind: "ce-object-v1",
      chunkSize: size,
      totalSize: bytes.length,
      chunks: cids
    },
    chunks
  };
}
async function reassemble(manifest, fetchChunk) {
  const out = new Uint8Array(manifest.totalSize);
  let off = 0;
  for (const c of manifest.chunks) {
    const bytes = await fetchChunk(c);
    const got = await cid(bytes);
    if (got !== c) throw new CeError(`chunk hash mismatch: expected ${c}, got ${got}`);
    out.set(bytes, off);
    off += bytes.length;
  }
  if (off !== manifest.totalSize) throw new CeError(`reassembled size ${off} != manifest total ${manifest.totalSize}`);
  return out;
}
function manifestToWire(m) {
  return {
    kind: m.kind,
    chunk_size: m.chunkSize,
    total_size: m.totalSize,
    chunks: m.chunks
  };
}
function wireToManifest(r) {
  return {
    kind: "ce-object-v1",
    chunkSize: r.chunk_size,
    totalSize: r.total_size,
    chunks: r.chunks ?? []
  };
}
function isManifestJson(bytes) {
  try {
    const txt = new TextDecoder().decode(bytes);
    const j = JSON.parse(txt);
    if (j && j.kind === "ce-object-v1" && Array.isArray(j.chunks)) return j;
    return null;
  } catch {
    return null;
  }
}
var DataApi = class {
  t;
  constructor(t2) {
    this.t = t2;
  }
  /** `POST /blobs` (raw binary) → 64-hex sha256 hash. */
  async putBlob(bytes) {
    return (await this.t.request("POST", "/blobs", "json", {
      rawBody: bytes,
      idempotent: true
    })).hash;
  }
  /** `GET /blobs/:hash` → blob bytes. */
  async getBlob(hash) {
    return this.t.request("GET", `/blobs/${encodeURIComponent(hash)}`, "bytes", { auth: false });
  }
  /**
  * Upload an object of any size: split into chunks, store each as a blob, then store
  * the manifest. Returns the object CID (the manifest's blob hash).
  */
  async putObject(bytes, size = DEFAULT_CHUNK_SIZE) {
    const { manifest, chunks } = await chunkObject(bytes, size);
    for (const [, chunkBytes] of chunks) await this.putBlob(chunkBytes);
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifestToWire(manifest)));
    return this.putBlob(manifestBytes);
  }
  /** Fetch an object by CID: resolve manifest, pull+verify chunks, reassemble. */
  async getObject(cidStr) {
    const manifestBytes = await this.getBlob(cidStr);
    const raw = isManifestJson(manifestBytes);
    if (!raw) return manifestBytes;
    return reassemble(wireToManifest(raw), (c) => this.getBlob(c));
  }
  /** `POST /data/fetch` → paid chunk fetch over the mesh; verified against `cid`. */
  async fetchChunkPaid(provider, cidStr, channelId, cumulative) {
    return this.t.request("POST", "/data/fetch", "bytes", { body: {
      provider,
      cid: cidStr,
      channel_id: channelId,
      cumulative: cumulative.toBaseUnits()
    } });
  }
};
function amt(s) {
  return Amount.fromBaseUnits(s);
}
function toChannel(r) {
  return {
    channelId: r.channel_id,
    payer: r.payer,
    host: r.host,
    capacity: amt(r.capacity),
    expiryHeight: r.expiry_height
  };
}
function toReceipt(r) {
  return {
    channelId: r.channel_id,
    cumulative: amt(r.cumulative),
    payerSig: r.payer_sig
  };
}
function toNodeHistory(r) {
  const h = {
    nodeId: r.node_id,
    jobsHosted: r.jobs_hosted,
    jobsPaid: r.jobs_paid,
    heartbeatsHosted: r.heartbeats_hosted,
    heartbeatsPaid: r.heartbeats_paid,
    expiries: r.expiries,
    earned: amt(r.earned),
    spent: amt(r.spent),
    firstHeight: r.first_height,
    lastHeight: r.last_height,
    isNewcomer() {
      return h.firstHeight === 0;
    },
    deliveredWork() {
      return h.jobsHosted + h.heartbeatsHosted;
    }
  };
  return h;
}
function toTxRecord(r) {
  return {
    txId: r.tx_id,
    height: r.height,
    kind: r.kind,
    amount: amt(r.amount),
    counterparty: r.counterparty ?? null,
    direction: r.direction
  };
}
var ChannelsApi = class {
  t;
  constructor(t2) {
    this.t = t2;
  }
  /** `GET /channels` → open channels. */
  async list() {
    return (await this.t.request("GET", "/channels", "json", { auth: false }) ?? []).map(toChannel);
  }
  /** `POST /channels/open` → channel id. Locks capacity; idempotency-keyed. */
  async open(host, capacity, expiryHeight = 0) {
    return (await this.t.request("POST", "/channels/open", "json", {
      body: {
        host,
        capacity: capacity.toBaseUnits(),
        expiry_height: expiryHeight
      },
      idempotent: true,
      maxRetries: 0
    })).channel_id;
  }
  /** `POST /channels/receipt` → the node signs an off-chain receipt (no tx). */
  async signReceipt(channelId, host, cumulative) {
    return toReceipt(await this.t.request("POST", "/channels/receipt", "json", { body: {
      channel_id: channelId,
      host,
      cumulative: cumulative.toBaseUnits()
    } }));
  }
  /** `POST /channels/:id/close` — host redeems the highest receipt. */
  async close(channelId, cumulative, payerSig) {
    await this.t.request("POST", `/channels/${encodeURIComponent(channelId)}/close`, "void", { body: {
      cumulative: cumulative.toBaseUnits(),
      payer_sig: payerSig
    } });
  }
  /** `POST /channels/:id/expire` — payer reclaims after expiry. */
  async expire(channelId) {
    await this.t.request("POST", `/channels/${encodeURIComponent(channelId)}/expire`, "void", {});
  }
};
var EconomyApi = class {
  t;
  channels;
  constructor(t2) {
    this.t = t2;
    this.channels = new ChannelsApi(t2);
  }
  /** `POST /transfer` → tx id. Idempotency-keyed; retries off (double-spend safety). */
  async transfer(to, amount) {
    return (await this.t.request("POST", "/transfer", "json", {
      body: {
        to,
        amount: amount.toBaseUnits()
      },
      idempotent: true,
      maxRetries: 0
    })).tx_id;
  }
  /** `GET /history/:node_id` → immutable interaction history. */
  async history(nodeId) {
    return toNodeHistory(await this.t.request("GET", `/history/${encodeURIComponent(nodeId)}`, "json", { auth: false }));
  }
  /**
  * `GET /transactions/:node_id` → confirmed transactions touching a node,
  * newest first. Page older with `{ before: <oldest.height> }`.
  */
  async transactions(nodeId, q = {}) {
    const params = new URLSearchParams();
    if (q.limit != null) params.set("limit", String(q.limit));
    if (q.before != null) params.set("before", String(q.before));
    const qs = params.toString();
    const path = `/transactions/${encodeURIComponent(nodeId)}${qs ? `?${qs}` : ""}`;
    return (await this.t.request("GET", path, "json", { auth: false }) ?? []).map(toTxRecord);
  }
  /** `POST /relay/pay` — pay a relay over a payment channel. */
  async payRelay(relay, channelId, cumulative) {
    await this.t.request("POST", "/relay/pay", "void", { body: {
      relay,
      channel_id: channelId,
      cumulative: cumulative.toBaseUnits()
    } });
  }
};
function optAmt(s) {
  return s == null ? null : Amount.fromBaseUnits(s);
}
function toJob(r) {
  return {
    jobId: r.job_id,
    status: r.status,
    payer: r.payer ?? null,
    containerId: r.container_id ?? null,
    cost: optAmt(r.cost),
    bid: optAmt(r.bid)
  };
}
function toDeployment(r) {
  return {
    jobId: r.job_id,
    output: r.output ?? null
  };
}
function bidBody(spec) {
  return {
    image: spec.image,
    cmd: spec.cmd ?? [],
    env: spec.env ?? [],
    cpu_cores: spec.cpuCores,
    mem_mb: spec.memMb,
    duration_secs: spec.durationSecs,
    bid: spec.bid.toBaseUnits()
  };
}
var JobsApi = class {
  t;
  constructor(t2) {
    this.t = t2;
  }
  /** `GET /jobs` → all jobs this node tracks. */
  async list() {
    return (await this.t.request("GET", "/jobs", "json", { auth: false }) ?? []).map(toJob);
  }
  /** `GET /jobs/:id` → one job. */
  async get(id) {
    return toJob(await this.t.request("GET", `/jobs/${encodeURIComponent(id)}`, "json", { auth: false }));
  }
  /** `POST /jobs/bid` → job id. Idempotency-keyed (state-creating money op). */
  async bid(spec) {
    return (await this.t.request("POST", "/jobs/bid", "json", {
      body: bidBody(spec),
      idempotent: true,
      maxRetries: 0
    })).job_id;
  }
  /**
  * `POST /jobs/:id/settle` — payer co-signs settlement. The SDK forwards a
  * caller-built `payerSig` (128-hex) and `cost`; it performs no signing.
  */
  async settle(id, spec) {
    await this.t.request("POST", `/jobs/${encodeURIComponent(id)}/settle`, "void", { body: {
      cost: spec.cost.toBaseUnits(),
      payer_sig: spec.payerSig
    } });
  }
  /** `DELETE /jobs/:id` → force-stop a local job. */
  async kill(id) {
    await this.t.request("DELETE", `/jobs/${encodeURIComponent(id)}`, "void");
  }
  /**
  * `POST /mesh-deploy` (Docker) → host-assigned job id. Directed placement on a
  * specific host over the mesh. `grant` is an opaque base64 capability chain.
  */
  async meshDeploy(nodeId, spec, grant) {
    const body = {
      node_id: nodeId,
      ...bidBody(spec),
      inputs: []
    };
    if (grant !== void 0) body["grant"] = grant;
    return (await this.t.request("POST", "/mesh-deploy", "json", {
      body,
      idempotent: true,
      maxRetries: 0
    })).job_id;
  }
  /** `POST /mesh-deploy` (WASM) → `{ jobId, output }`. */
  async meshDeployWasm(opts) {
    const body = {
      node_id: opts.nodeId,
      wasm_module: opts.wasmModule,
      wasm_entry: opts.wasmEntry,
      cmd: [],
      cpu_cores: opts.cpuCores,
      mem_mb: opts.memMb,
      duration_secs: opts.durationSecs,
      bid: opts.bid.toBaseUnits(),
      inputs: opts.inputs ?? []
    };
    if (opts.grant !== void 0) body["grant"] = opts.grant;
    if (opts.hintMultiaddr !== void 0) body["hint_multiaddr"] = opts.hintMultiaddr;
    return toDeployment(await this.t.request("POST", "/mesh-deploy", "json", {
      body,
      idempotent: true,
      maxRetries: 0
    }));
  }
  /** `POST /mesh-kill` → stop a mesh-deployed job on a specific host. */
  async meshKill(nodeId, jobId, grant) {
    const body = {
      node_id: nodeId,
      job_id: jobId
    };
    if (grant !== void 0) body["grant"] = grant;
    await this.t.request("POST", "/mesh-kill", "void", { body });
  }
};
async function* sseEvents(source, opts = {}) {
  const reconnect = opts.reconnect ?? true;
  const baseMs = opts.reconnectBaseMs ?? 1e3;
  const maxMs = opts.reconnectMaxMs ?? 15e3;
  let lastId = opts.lastEventId;
  let attempt = 0;
  while (!opts.signal?.aborted) {
    let connectedThisRound = false;
    try {
      const headers = {
        ...source.headers,
        Accept: "text/event-stream",
        "Cache-Control": "no-cache"
      };
      if (lastId !== void 0) headers["Last-Event-ID"] = lastId;
      const token = await source.authToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await source.fetch(source.url, {
        method: "GET",
        headers,
        ...opts.signal ? { signal: opts.signal } : {}
      });
      if (!res.ok) throw new CeStreamError(`SSE endpoint returned HTTP ${res.status}`);
      if (!res.body) throw new CeStreamError("SSE response had no body");
      connectedThisRound = true;
      attempt = 0;
      for await (const ev of parseSseStream(res.body)) {
        if (ev.id !== void 0) lastId = ev.id;
        if (ev.data === "" && ev.event === "message") continue;
        yield ev;
      }
    } catch (err) {
      if (opts.signal?.aborted) return;
      if (!reconnect) {
        if (err instanceof CeStreamError) throw err;
        throw new CeStreamError(`SSE stream failed: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
      }
    }
    if (opts.signal?.aborted) return;
    if (!reconnect) return;
    const delay = connectedThisRound ? baseMs : Math.min(maxMs, baseMs * 2 ** attempt) * (0.5 + Math.random() * 0.5);
    if (!connectedThisRound) attempt++;
    await sleep$2(delay, opts.signal);
  }
}
async function* parseSseStream(body) {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = "";
  let dataLines = [];
  let eventType = "message";
  let lastEventId;
  let sawData = false;
  const flush = () => {
    if (!sawData) {
      dataLines = [];
      eventType = "message";
      return;
    }
    const ev = {
      event: eventType,
      data: dataLines.join("\n")
    };
    if (lastEventId !== void 0) ev.id = lastEventId;
    dataLines = [];
    eventType = "message";
    sawData = false;
    return ev;
  };
  try {
    for (; ; ) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = indexOfLineEnd(buffer)) !== -1) {
        const lineEnd = nl;
        let next = lineEnd + 1;
        if (buffer[lineEnd] === "\r" && buffer[next] === "\n") next = lineEnd + 2;
        const line = buffer.slice(0, lineEnd);
        buffer = buffer.slice(next);
        if (line === "") {
          const ev2 = flush();
          if (ev2) yield ev2;
          continue;
        }
        if (line.startsWith(":")) continue;
        const colon = line.indexOf(":");
        let field;
        let val;
        if (colon === -1) {
          field = line;
          val = "";
        } else {
          field = line.slice(0, colon);
          val = line.slice(colon + 1);
          if (val.startsWith(" ")) val = val.slice(1);
        }
        switch (field) {
          case "data":
            dataLines.push(val);
            sawData = true;
            break;
          case "event":
            eventType = val;
            break;
          case "id":
            if (!val.includes("\0")) lastEventId = val;
            break;
          case "retry":
            break;
          default:
            break;
        }
      }
    }
    const ev = flush();
    if (ev) yield ev;
  } finally {
    try {
      reader.releaseLock();
    } catch {
    }
  }
}
function indexOfLineEnd(s) {
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\n" || ch === "\r") return i;
  }
  return -1;
}
function sleep$2(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        resolve();
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}
function decodeAppMessage(r, exactReplyToken) {
  const payloadHex = r.payload_hex ?? "";
  const replyToken = exactReplyToken !== void 0 ? exactReplyToken : r.reply_token != null ? String(r.reply_token) : null;
  return {
    from: r.from,
    topic: r.topic,
    payloadHex,
    receivedAt: r.received_at ?? null,
    replyToken,
    payload() {
      return fromHex(payloadHex);
    }
  };
}
function decodeSignal(r) {
  const payloadHex = r.payload_hex ?? "";
  return {
    from: r.from,
    to: r.to,
    capabilities: r.capabilities ?? [],
    payloadHex,
    burnProof: r.burn_proof ?? null,
    nonce: r.nonce,
    id: r.id,
    payload() {
      return fromHex(payloadHex);
    }
  };
}
function decodeBlockEvent(r) {
  return {
    index: r.index,
    hash: r.hash,
    prevHash: r.prev_hash,
    timestamp: r.timestamp,
    miner: r.miner,
    txCount: r.tx_count,
    nonce: r.nonce
  };
}
function decodeTxEvent(r) {
  const kind = r.kind;
  return {
    id: r.id,
    origin: r.origin,
    kind,
    amount: r.amount ? Amount.fromBaseUnits(r.amount) : Amount.ZERO
  };
}
function exactIntField(json, key) {
  const m = new RegExp(`"${key}"\\s*:\\s*(\\d+)`).exec(json);
  return m ? m[1] : null;
}
var MeshApi = class {
  t;
  constructor(t2) {
    this.t = t2;
  }
  /** `POST /mesh/send` — directed signed message to a node. */
  async send(to, topic, payload) {
    await this.t.request("POST", "/mesh/send", "void", { body: {
      to,
      topic,
      payload_hex: toHex(payload)
    } });
  }
  /** `GET /mesh/messages` — inbox snapshot. */
  async messages() {
    return (await this.t.request("GET", "/mesh/messages", "json", { auth: false }) ?? []).map((m) => decodeAppMessage(m));
  }
  /** `POST /mesh/subscribe` — subscribe to an app pub/sub topic. Idempotent. */
  async subscribe(topic) {
    await this.t.request("POST", "/mesh/subscribe", "void", { body: { topic } });
  }
  /** `POST /mesh/publish` — publish a signed message to a topic. Auto-subscribes. */
  async publish(topic, payload) {
    await this.t.request("POST", "/mesh/publish", "void", { body: {
      topic,
      payload_hex: toHex(payload)
    } });
  }
  /** `POST /mesh/request` — sync request/response; resolves with the reply payload. */
  async request(to, topic, payload, timeoutMs) {
    const body = {
      to,
      topic,
      payload_hex: toHex(payload)
    };
    if (timeoutMs !== void 0) body["timeout_ms"] = timeoutMs;
    return fromHex((await this.t.request("POST", "/mesh/request", "json", {
      body,
      ...timeoutMs !== void 0 ? { timeoutMs: timeoutMs + 5e3 } : {}
    })).payload_hex);
  }
  /**
  * `POST /mesh/reply` — answer an inbound request by its `replyToken`.
  *
  * `token` is the (string) `replyToken` from the inbound {@link AppMessage}. It is a u64 that can
  * exceed JS's 2^53 safe integer, so the body is serialized by hand with the token as an exact
  * JSON numeric literal (matching the node's wire form) — `JSON.stringify` would round a large
  * number and the reply would never route.
  */
  async reply(token, payload) {
    const literal = String(token);
    if (!/^\d+$/.test(literal)) throw new Error(`ce.mesh.reply: invalid reply token ${JSON.stringify(token)}`);
    const body = `{"token":${literal},"payload_hex":${JSON.stringify(toHex(payload))}}`;
    await this.t.request("POST", "/mesh/reply", "void", {
      rawBody: utf8ToBytes(body),
      headers: { "Content-Type": "application/json" }
    });
  }
  /** `GET /mesh/messages/stream` — SSE of inbound app messages, as an AsyncIterable. */
  async *streamMessages(opts) {
    const source = {
      url: this.t.url("/mesh/messages/stream"),
      fetch: this.t.fetch(),
      authToken: () => this.t.authToken(),
      headers: this.t.baseHeaders()
    };
    for await (const ev of sseEvents(source, opts)) {
      if (ev.data === "") continue;
      yield decodeAppMessage(JSON.parse(ev.data), exactIntField(ev.data, "reply_token"));
    }
  }
};
var NamesApi = class {
  t;
  constructor(t2) {
    this.t = t2;
  }
  /** `POST /names/claim` — claim a human-readable name (mined async). */
  async claim(name) {
    await this.t.request("POST", "/names/claim", "void", { body: { name } });
  }
  /** `GET /names/:name` → owning NodeId hex, or `null` if unclaimed. */
  async resolve(name) {
    try {
      return (await this.t.request("GET", `/names/${encodeURIComponent(name)}`, "json", { auth: false })).node_id ?? null;
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }
};
var DiscoveryApi = class {
  t;
  constructor(t2) {
    this.t = t2;
  }
  /** `POST /discovery/advertise` — advertise a named service (re-call periodically). */
  async advertise(service) {
    await this.t.request("POST", "/discovery/advertise", "void", { body: { service } });
  }
  /** `GET /discovery/find/:service` → NodeId hexes advertising the service. */
  async find(service) {
    return (await this.t.request("GET", `/discovery/find/${encodeURIComponent(service)}`, "json", { auth: false })).providers ?? [];
  }
};
function isNotFound(err) {
  return typeof err === "object" && err !== null && "status" in err && err.status === 404;
}
var SignalsApi = class {
  t;
  constructor(t2) {
    this.t = t2;
  }
  /** `GET /signals` → last 100 validated CEP-1 signals (newest at end). */
  async list() {
    return (await this.t.request("GET", "/signals", "json", { auth: false }) ?? []).map(decodeSignal);
  }
  /** `POST /signals/send` → `{ id, nonce }`. */
  async send(opts) {
    const body = {
      to: opts.to,
      capabilities: opts.capabilities
    };
    if (opts.payload !== void 0) body["payload_hex"] = toHex(opts.payload);
    if (opts.burnTxIdHex !== void 0) body["burn_tx_id_hex"] = opts.burnTxIdHex;
    return this.t.request("POST", "/signals/send", "json", { body });
  }
  /** `GET /signals/stream` → SSE of validated CEP-1 signals, as an AsyncIterable. */
  async *stream(opts) {
    const source = {
      url: this.t.url("/signals/stream"),
      fetch: this.t.fetch(),
      authToken: () => this.t.authToken(),
      headers: this.t.baseHeaders()
    };
    for await (const ev of sseEvents(source, opts)) {
      if (ev.data === "") continue;
      yield decodeSignal(JSON.parse(ev.data));
    }
  }
};
function toNodeStatus(r) {
  return {
    nodeId: r.node_id,
    peerId: r.peer_id ?? "",
    listenPort: r.listen_port ?? 0,
    economy: r.economy ?? null
  };
}
function toAtlasEntry(r) {
  return {
    nodeId: r.node_id,
    cpuCores: r.cpu_cores,
    memMb: r.mem_mb,
    runningJobs: r.running_jobs,
    lastSeenSecs: r.last_seen_secs,
    tags: r.tags ?? []
  };
}
var StatusApi = class {
  t;
  constructor(t2) {
    this.t = t2;
  }
  /** `GET /health` → `true` when the node is live. */
  async health() {
    try {
      return (await this.t.request("GET", "/health", "text", {
        auth: false,
        maxRetries: 0
      })).trim().length > 0;
    } catch {
      return false;
    }
  }
  /** `GET /status` → full node state snapshot. */
  async status() {
    return toNodeStatus(await this.t.request("GET", "/status", "json", { auth: false }));
  }
  /** `GET /bootstrap` → advertised multiaddrs. */
  async bootstrap() {
    return { peers: (await this.t.request("GET", "/bootstrap", "json", { auth: false })).peers ?? [] };
  }
  /** `GET /beacon` → PoW tip (verifiable randomness). */
  async beacon() {
    const r = await this.t.request("GET", "/beacon", "json", { auth: false });
    return {
      height: r.height,
      hash: r.hash
    };
  }
  /** `GET /atlas` → peer capacity snapshot. */
  async atlas() {
    return (await this.t.request("GET", "/atlas", "json", { auth: false }) ?? []).map(toAtlasEntry);
  }
};
var StreamsApi = class {
  t;
  constructor(t2) {
    this.t = t2;
  }
  source(path) {
    return {
      url: this.t.url(path),
      fetch: this.t.fetch(),
      authToken: () => this.t.authToken(),
      headers: this.t.baseHeaders()
    };
  }
  /** `GET /blocks/stream` — every accepted block. */
  async *blocks(opts) {
    for await (const ev of sseEvents(this.source("/blocks/stream"), opts)) {
      if (ev.data === "") continue;
      yield decodeBlockEvent(JSON.parse(ev.data));
    }
  }
  /** `GET /transactions/stream` — every verified transaction. */
  async *transactions(opts) {
    for await (const ev of sseEvents(this.source("/transactions/stream"), opts)) {
      if (ev.data === "") continue;
      yield decodeTxEvent(JSON.parse(ev.data));
    }
  }
  /** `GET /signals/stream` — validated CEP-1 signals. */
  async *signals(opts) {
    for await (const ev of sseEvents(this.source("/signals/stream"), opts)) {
      if (ev.data === "") continue;
      yield decodeSignal(JSON.parse(ev.data));
    }
  }
  /** `GET /mesh/messages/stream` — inbound app messages. */
  async *messages(opts) {
    for await (const ev of sseEvents(this.source("/mesh/messages/stream"), opts)) {
      if (ev.data === "") continue;
      yield decodeAppMessage(JSON.parse(ev.data));
    }
  }
};
var TAG_PREFIX = "tag:";
function tagService(tag) {
  return `${TAG_PREFIX}${tag}`;
}
var TagsApi = class {
  discovery;
  constructor(discovery) {
    this.discovery = discovery;
  }
  /**
  * Advertise that this node carries `tag` (`"infer"`, `"gpu"`, `"tier:hi"`,
  * `"model:llama-3-8b"`), discoverable by {@link find}. Provider records expire — re-advertise
  * periodically (see {@link refresh}). Complements `/atlas` (see module docs).
  */
  advertise(tag) {
    return this.discovery.advertise(tagService(tag));
  }
  /** Advertise several tags. Resolves once all succeed; rejects on the first failure. */
  async advertiseAll(tags) {
    for (const t2 of tags) await this.advertise(t2);
  }
  /** Find the NodeId hexes of peers advertising `tag` (`GET /discovery/find/:service`). */
  find(tag) {
    return this.discovery.find(tagService(tag));
  }
  /**
  * Find peers advertising **all** of `tags` (set intersection of each tag's providers).
  * Empty `tags` yields `[]`.
  */
  async findAll(tags) {
    if (tags.length === 0) return [];
    let acc;
    for (const t2 of tags) {
      const providers = await this.find(t2);
      acc = acc === void 0 ? providers : acc.filter((p) => providers.includes(p));
    }
    return acc ?? [];
  }
  /** Find peers advertising **any** of `tags` (de-duplicated union). */
  async findAny(tags) {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const t2 of tags) for (const p of await this.find(t2)) if (!seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
    return out;
  }
  /** Re-advertise `tags` once. Call on an interval to keep DHT records from expiring. */
  async refresh(tags) {
    for (const t2 of tags) await this.advertise(t2);
  }
};
var WalletApi = class {
  t;
  channelsApi;
  constructor(t2, channelsApi) {
    this.t = t2;
    this.channelsApi = channelsApi;
  }
  /** Open payment channels (delegates to `ce.channels`). */
  get channels() {
    return this.channelsApi;
  }
  /**
  * Balance breakdown: total / free / locked-in-channels / locked-in-bond / bond.
  *
  * Balances are an economy-adapter concept, not substrate — an economy node still exposes them
  * on `/status`, so this reads the raw ledger fields directly (they are absent from the core
  * `NodeStatus` type). On a core (economy-free) node the economy is disabled, so this throws a
  * `CeUnavailableError` like the other economic calls. (This whole surface moves to the economy
  * adapter's own SDK.)
  */
  async balance() {
    const r = await this.t.request("GET", "/status", "json", { auth: false });
    if (r.economy === false) throw new CeUnavailableError("economy is disabled on this node (core/personal-mesh) \u2014 the ledger lives in the economy adapter", 503, "economy disabled");
    const amt2 = (s) => s == null ? Amount.ZERO : Amount.fromBaseUnits(s);
    const total = amt2(r.balance);
    const lockedChannels = amt2(r.locked_channels);
    const lockedBond = amt2(r.locked_bond);
    let free = amt2(r.free);
    if (r.free == null) {
      const derived = total.sub(lockedChannels).sub(lockedBond);
      free = derived.isNegative() ? Amount.ZERO : derived;
    }
    return {
      total,
      free,
      lockedChannels,
      lockedBond,
      bond: amt2(r.bond)
    };
  }
  /**
  * Itemized transaction history for `nodeId`, newest first
  * (`GET /transactions/:node_id`). Page older with `{ before: <oldest.height> }`. On a light
  * node only post-checkpoint history is available.
  */
  async transactions(nodeId, q = {}) {
    const params = new URLSearchParams();
    if (q.limit != null) params.set("limit", String(q.limit));
    if (q.before != null) params.set("before", String(q.before));
    const qs = params.toString();
    const path = `/transactions/${encodeURIComponent(nodeId)}${qs ? `?${qs}` : ""}`;
    return (await this.t.request("GET", path, "json", { auth: false }) ?? []).map(toTxRecord);
  }
  /**
  * Live tail of confirmed transactions over `GET /transactions/stream`, each mapped to a
  * {@link TxRecord} relative to `selfNodeId` (so `direction`/`counterparty` are filled in
  * client-side — the stream frame only carries `{ id, origin, kind, amount }`). `height` is
  * unknown for the live tail (0).
  */
  async *streamTransactions(selfNodeId, opts) {
    const source = {
      url: this.t.url("/transactions/stream"),
      fetch: this.t.fetch(),
      authToken: () => this.t.authToken(),
      headers: this.t.baseHeaders()
    };
    for await (const ev of sseEvents(source, opts)) {
      if (ev.data === "") continue;
      const tx = decodeTxEvent(JSON.parse(ev.data));
      yield {
        txId: tx.id,
        height: 0,
        kind: tx.kind,
        amount: tx.amount,
        counterparty: tx.origin === selfNodeId ? null : tx.origin,
        direction: tx.origin === selfNodeId ? "out" : "in"
      };
    }
  }
  /** `POST /transfer` → tx id. Idempotency-keyed; retries off. */
  async transfer(to, amount) {
    return (await this.t.request("POST", "/transfer", "json", {
      body: {
        to,
        amount: amount.toBaseUnits()
      },
      idempotent: true,
      maxRetries: 0
    })).tx_id;
  }
  /** `POST /channels/open` → channel id. Locks capacity. */
  openChannel(host, capacity, expiryHeight = 0) {
    return this.channelsApi.open(host, capacity, expiryHeight);
  }
  /** `POST /channels/receipt` → node-signed off-chain receipt. */
  signReceipt(channelId, host, cumulative) {
    return this.channelsApi.signReceipt(channelId, host, cumulative);
  }
  /**
  * `POST /channels/:id/close` — host redeems the highest receipt. `payerSig` is the payer's
  * co-signature, passed through as opaque hex (the wallet never produces key material).
  */
  closeChannel(channelId, cumulative, payerSig) {
    return this.channelsApi.close(channelId, cumulative, payerSig);
  }
  /** `POST /channels/:id/expire` — payer reclaims after expiry. */
  expireChannel(channelId) {
    return this.channelsApi.expire(channelId);
  }
  /** `GET /channels` → open channels. */
  listChannels() {
    return this.channelsApi.list();
  }
};
var DEFAULT_BASE_URL = "http://127.0.0.1:8844";
var CeClient = class CeClient2 {
  /** The substrate transport hatch. Domain-SDK ceapps ride it: `new EconomyApi(ce.transport)`. */
  transport;
  status;
  jobs;
  economy;
  channels;
  data;
  mesh;
  signals;
  names;
  discovery;
  capabilities;
  streams;
  /** Cohesive money view (balance breakdown, history, transfers, channels, tx stream). */
  wallet;
  /** Atlas-style self-tagging over the discovery DHT (advertise/find peers by tag). */
  tags;
  constructor(opts = {}) {
    let token = opts.token;
    this.transport = new Transport({
      baseUrl: opts.baseUrl ?? DEFAULT_BASE_URL,
      ...token !== void 0 ? { token } : {},
      ...opts.fetch !== void 0 ? { fetch: opts.fetch } : {},
      timeoutMs: opts.timeoutMs ?? 3e4,
      maxRetries: opts.maxRetries ?? 2,
      ...opts.headers !== void 0 ? { headers: opts.headers } : {}
    });
    this.status = new StatusApi(this.transport);
    this.jobs = new JobsApi(this.transport);
    this.economy = new EconomyApi(this.transport);
    this.channels = this.economy.channels;
    this.data = new DataApi(this.transport);
    this.mesh = new MeshApi(this.transport);
    this.signals = new SignalsApi(this.transport);
    this.names = new NamesApi(this.transport);
    this.discovery = new DiscoveryApi(this.transport);
    this.capabilities = new CapabilitiesApi(this.transport);
    this.streams = new StreamsApi(this.transport);
    this.wallet = new WalletApi(this.transport, this.economy.channels);
    this.tags = new TagsApi(this.discovery);
  }
  /** Client for `http://127.0.0.1:8844`, lazily auto-discovering `api.token` (Node). */
  static local() {
    let cached;
    const lazyToken = () => {
      if (cached === void 0) cached = discoverApiToken();
      return cached;
    };
    return new CeClient2({
      baseUrl: DEFAULT_BASE_URL,
      token: lazyToken
    });
  }
  /** Client for an explicit base URL + token (or read-only when token omitted). */
  static withToken(baseUrl, token) {
    return new CeClient2(token !== void 0 ? {
      baseUrl,
      token
    } : { baseUrl });
  }
  /** `GET /health`. */
  health() {
    return this.status.health();
  }
  /** `GET /status`. */
  getStatus() {
    return this.status.status();
  }
  /** `GET /bootstrap`. */
  bootstrap() {
    return this.status.bootstrap();
  }
  /** `GET /beacon`. */
  beacon() {
    return this.status.beacon();
  }
  /** `GET /atlas`. */
  atlas() {
    return this.status.atlas();
  }
  /** `GET /jobs`. */
  listJobs() {
    return this.jobs.list();
  }
  /** `GET /jobs/:id`. */
  job(id) {
    return this.jobs.get(id);
  }
  /** `POST /jobs/bid`. */
  bid(spec) {
    return this.jobs.bid(spec);
  }
  /** `POST /jobs/:id/settle`. */
  settle(id, spec) {
    return this.jobs.settle(id, spec);
  }
  /** `DELETE /jobs/:id`. */
  kill(id) {
    return this.jobs.kill(id);
  }
  /** `POST /transfer`. */
  transfer(to, amount) {
    return this.economy.transfer(to, amount);
  }
  /** `GET /history/:node_id`. */
  history(nodeId) {
    return this.economy.history(nodeId);
  }
  /** `GET /transactions/:node_id` — confirmed txs touching a node, newest first. */
  transactions(nodeId, q) {
    return this.economy.transactions(nodeId, q);
  }
  /** `POST /relay/pay`. */
  payRelay(relay, channelId, cumulative) {
    return this.economy.payRelay(relay, channelId, cumulative);
  }
  /** `GET /channels`. */
  listChannels() {
    return this.channels.list();
  }
  /** `POST /channels/open`. */
  channelOpen(host, capacity, expiryHeight) {
    return this.channels.open(host, capacity, expiryHeight);
  }
  /** `POST /channels/receipt`. */
  signReceipt(channelId, host, cumulative) {
    return this.channels.signReceipt(channelId, host, cumulative);
  }
  /** Directed Docker deploy (`POST /mesh-deploy`). */
  meshDeploy(nodeId, spec, grant) {
    return this.jobs.meshDeploy(nodeId, spec, grant);
  }
  /** Directed WASM deploy (`POST /mesh-deploy`). */
  meshDeployWasm(opts) {
    return this.jobs.meshDeployWasm(opts);
  }
  /** `POST /mesh-kill`. */
  meshKill(nodeId, jobId, grant) {
    return this.jobs.meshKill(nodeId, jobId, grant);
  }
  /** `POST /chain/save` → `{ saved: <path> }`. */
  async chainSave() {
    return this.transport.request("POST", "/chain/save", "json", {});
  }
  /**
  * `POST /tunnel` — open a TCP tunnel to a remote port over the mesh. Node-host-side
  * (binds 127.0.0.1 on the node host); not meaningful from a browser.
  */
  async tunnel(opts) {
    const body = {
      node_id: opts.nodeId,
      local_port: opts.localPort,
      remote_port: opts.remotePort
    };
    if (opts.caps !== void 0) body["caps"] = opts.caps;
    if (opts.hint !== void 0) body["hint"] = opts.hint;
    const r = await this.transport.request("POST", "/tunnel", "json", { body });
    return {
      localPort: r.local_port,
      remotePort: r.remote_port,
      nodeId: r.node_id
    };
  }
  /**
  * `POST /mesh-app-install` — install a published ceapp on a remote node over the mesh: the
  * programmatic form of `ce app install <app> --on node=<id>`, cap-gated by the node. The node
  * forwards an AppInstall RPC carrying `grant` (the caller's capability); the target verifies it and
  * runs its appmgr flow, resolving the manifest + artifacts from `registry`. Omit `grant` to rely on
  * a capability the node already holds for the target.
  */
  async meshAppInstall(nodeId, app, registry, grant) {
    const body = {
      node_id: nodeId,
      app,
      registry
    };
    if (grant !== void 0) body["grant"] = grant;
    return this.transport.request("POST", "/mesh-app-install", "json", { body });
  }
};

// node_modules/@loppis/viz/components/viz.js
var CSS = `
  :host { display: block; }
  .card { background: #14171c; border: 1px solid #232a33; border-radius: 10px;
          padding: 16px 18px; color: #dfe3e8;
          font: 13px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; }
  .head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
  .head b { font-size: 15px; letter-spacing: .2px; }
  .kind { color: #8b95a1; font-size: 11px; border: 1px solid #232a33; border-radius: 99px; padding: 1px 8px; }
  .status { margin-left: auto; font-size: 11px; display: inline-flex; align-items: center; gap: 6px; }
  .dot { width: 7px; height: 7px; border-radius: 99px; background: #8b95a1; display: inline-block; }
  .ok .dot { background: #43e0a0; } .ok { color: #43e0a0; }
  .bad .dot { background: #ff5d72; } .bad { color: #ff5d72; }
  .what { color: #9aa3ad; margin: 4px 0 12px; max-width: 72ch; }
  .sect { color: #6b7280; font-size: 10px; text-transform: uppercase; letter-spacing: .12em; margin: 12px 0 6px; }
  svg { display: block; max-width: 100%; height: auto; }
  svg text { font: 11px ui-monospace, Menlo, monospace; fill: #b9c2cc; }
  .bx { fill: #191d23; stroke: #39424f; }
  .bx.frontend { stroke: #43e0a0; }
  .bx.contract { fill: #221c10; stroke: #d9a13c; }
  .bx.substrate { fill: #10161f; stroke: #3d7bbf; }
  .bx.sdk { stroke: #8b95a1; stroke-dasharray: 0; }
  .bx.peer { stroke-dasharray: 4 3; }
  .klabel { fill: #6b7280; font-size: 9px; letter-spacing: .1em; }
  .edge { stroke: #4a5462; stroke-width: 1.3; fill: none; }
  .edge.event { stroke-dasharray: 5 4; }
  .edge.contract { stroke: #d9a13c; stroke-dasharray: 2 3; }
  .elbl { fill: #7d8794; font-size: 9.5px; }
  .dim { opacity: .16; transition: opacity .25s; }
  .hot { stroke: #ff5d72 !important; stroke-width: 2.4; }
  .ring { fill: none; stroke: #ff5d72; stroke-width: 2.2; }
  .runner { fill: #ff5d72; }
  .live-pulse { fill: #43e0a0; }
  .live-pulse.ev { fill: none; stroke: #d9a13c; stroke-width: 2; }
  nav { display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0 4px; }
  button { font: inherit; font-size: 11px; padding: 3px 10px; border-radius: 99px;
           border: 1px solid #39424f; background: none; color: #b9c2cc; cursor: pointer; }
  button.active, button:hover { border-color: #ff5d72; color: #ff5d72; }
  .caption { min-height: 2.4em; color: #dfe3e8; font-size: 12px; padding-top: 4px; }
  .caption b { color: #ff5d72; }
  .foot { color: #6b7280; font-size: 10.5px; margin-top: 10px; }
  .foot a { color: #8b95a1; }
`;
var W = 980;
var H = 470;
var NODES = [
  { id: "web", label: "loppis-web", kind: "frontend", x: 14, y: 22, d: "Browser page. A full typed mesh consumer: same contracts, same connect() as the backends. The live feed IS the typed event streams." },
  { id: "agent", label: "AI agent / any peer", kind: "peer", x: 14, y: 62, d: "Any authenticated peer uses the identical typed client \u2014 AI agents call, subscribe, and can provide. Nothing here is browser-special." },
  { id: "lc", label: "listings contract", kind: "contract", x: 40, y: 14, d: "defineInterface: methods create/get/list/close + events created/closed. Abilities (loppis:listing:create) live IN the schema. Exported by the provider repo as its public API." },
  { id: "bc", label: "bids contract", kind: "contract", x: 40, y: 46, d: "place/highest/listForListing + event placed. Typed refusal codes: too-low, self-bid, unknown-listing, listing-closed." },
  { id: "iface", label: "@ce-net/iface", kind: "sdk", x: 40, y: 78, d: "The enabler: schema builder -> compile-time TS types + runtime validation both ends + ability-in-schema + typed events + DHT-discovered typed clients. ifaceSchema() exports the language-neutral contract for polyglot codegen and reflection." },
  { id: "ls", label: "loppis-listings", kind: "service", x: 72, y: 18, d: "Listings backend ce app. provide(): decode -> validate -> authorize(ability) -> handler -> validate -> reply. Emits typed created/closed events." },
  { id: "bs", label: "loppis-bids", kind: "service", x: 72, y: 54, d: "Bidding backend ce app. Provider of loppis.bids/1 AND typed consumer of loppis.listings/1 \u2014 validates every bid against the live listings service over the mesh." },
  { id: "mesh", label: "ce mesh (substrate)", kind: "substrate", x: 90, y: 86, d: "Locked substrate: authenticated peers, request/reply, pub/sub, DHT discovery. Every arrow in this graph actually travels here." }
];
var EDGES = [
  { id: "web-lc", from: "web", to: "lc", kind: "call", label: "create() / list()" },
  { id: "web-bc", from: "web", to: "bc", kind: "call", label: "place()" },
  { id: "ag-bc", from: "agent", to: "bc", kind: "call", label: "same typed client" },
  { id: "lc-ls", from: "lc", to: "ls", kind: "contract", label: "implements" },
  { id: "bc-bs", from: "bc", to: "bs", kind: "contract", label: "implements" },
  { id: "bs-lc", from: "bs", to: "lc", kind: "call", label: "get() \u2014 service to service" },
  { id: "ls-web", from: "ls", to: "web", kind: "event", label: "created / closed" },
  { id: "bs-web", from: "bs", to: "web", kind: "event", label: "placed" },
  { id: "if-lc", from: "iface", to: "lc", kind: "contract", label: "defineInterface" },
  { id: "if-bc", from: "iface", to: "bc", kind: "contract" },
  { id: "ls-mesh", from: "ls", to: "mesh", kind: "call", label: "advertise" },
  { id: "bs-mesh", from: "bs", to: "mesh", kind: "call" }
];
var FLOWS = [
  { id: "call", title: "a typed call", steps: [
    { at: "web", text: "The page calls listings.create({title, startPrice}) \u2014 the input is COMPILE-checked, then validated locally before it leaves." },
    { at: "web-lc", text: "The request travels the mesh to a provider found by DHT discovery \u2014 no endpoint config, no gateway, no URL anywhere." },
    { at: "lc", text: "The contract says create requires ability loppis:listing:create \u2014 security is IN the schema, visible to every consumer." },
    { at: "lc-ls", text: "The provider enforces the contract around the handler: decode -> validate -> authorize -> handler -> validate output." },
    { at: "ls", text: "The handler runs with the AUTHENTICATED caller (ctx.from) \u2014 the mesh verified the sender; there is no session, no cookie, no login." },
    { at: "ls-web", text: "The reply is runtime-validated on arrival and typed at compile time. Both ends honest, all the way." }
  ] },
  { id: "s2s", title: "service -> service", steps: [
    { at: "web-bc", text: "A bid arrives at loppis-bids\u2026" },
    { at: "bs", text: "\u2026which is ALSO a typed consumer: it validates the listing against the live listings service." },
    { at: "bs-lc", text: "bids calls listings.get() over the mesh with the exact same typed client the browser uses. All ways, same machinery." },
    { at: "bc", text: "Refusals are typed CODES in the contract \u2014 too-low, self-bid, unknown-listing \u2014 never string matching." }
  ] },
  { id: "events", title: "typed events (the feed)", steps: [
    { at: "ls", text: "A mutation happened: the provider emits a typed event \u2014 the payload is schema-validated before it is published." },
    { at: "ls-web", text: "Every subscriber gets it over pub/sub: the page's social feed IS this stream. No polling, no websockets to manage." },
    { at: "bs-web", text: "Same for bids: the auction updates live in every open page \u2014 and in every subscribed service or agent." }
  ] },
  { id: "ai", title: "why AI cares", steps: [
    { at: "iface", text: "ifaceSchema() exports every method, type, and required ability as neutral JSON \u2014 the mesh is self-describing." },
    { at: "agent", text: "An agent is just a peer: it discovers the contract, holds an attenuated capability, and calls type-safely \u2014 no scraping, no wrappers." },
    { at: "ag-bc", text: "Generated types turn hallucinated integrations into compile errors. Compiles + conformance green = deployable, not just plausible." }
  ] }
];
var TOPIC_EDGE = [
  { match: "loppis.listings/1/ev/", edge: "ls-web", ev: true },
  { match: "loppis.bids/1/ev/", edge: "bs-web", ev: true },
  { match: "loppis.listings/1", edge: "web-lc", ev: false },
  { match: "loppis.bids/1", edge: "web-bc", ev: false }
];
var box = (n) => {
  const w = Math.max(120, n.label.length * 7.6 + 26), h = 46;
  return { x: n.x / 100 * W - w / 2, y: n.y / 100 * H - h / 2, w, h };
};
var clip = (cx, cy, w, h, tx, ty) => {
  const dx = tx - cx, dy = ty - cy;
  const k = Math.min(
    Math.abs(dx) > 0.01 ? (w / 2 + 6) / Math.abs(dx) : 1e9,
    Math.abs(dy) > 0.01 ? (h / 2 + 6) / Math.abs(dy) : 1e9
  );
  return [cx + dx * Math.min(1, k), cy + dy * Math.min(1, k)];
};
var esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
var CeVizLoppis = class extends HTMLElement {
  connectedCallback() {
    this.flow = null;
    this.step = -1;
    this.timer = 0;
    this.es = null;
    const r = this.attachShadow({ mode: "open" });
    r.innerHTML = `<style>${CSS}</style>
      <div class="card">
        <div class="head"><b>loppis</b><span class="kind">typed marketplace stack</span>
          <span class="status" id="live-l"><span class="dot"></span>listings</span>
          <span class="status" id="live-b" style="margin-left:8px"><span class="dot"></span>bids</span></div>
        <div class="what">A secondhand marketplace as three decoupled ce apps sharing TYPED CONTRACTS
          (@ce-net/iface): compile-time types + runtime validation on both ends of every mesh edge,
          abilities in the schema, typed events as the social feed. Green pulses below are REAL
          traffic on this node, animating the architecture they belong to.</div>
        <div class="sect">how it works \u2014 pick a flow</div>
        <nav>${FLOWS.map((f) => `<button data-f="${f.id}">${esc(f.title)}</button>`).join("")}
          <button data-step>step</button><button data-play>play</button></nav>
        <div class="caption">click a flow above, or a box for details</div>
        <svg viewBox="0 0 ${W} ${H}">${this.body()}</svg>
        <div class="foot">repos: ce-iface \xB7 loppis-listings \xB7 loppis-bids \xB7 loppis-web (github.com/ce-net)
          \u2014 contracts travel as the provider repo's public export; consumers dep the repo.</div>
      </div>`;
    r.querySelectorAll("button[data-f]").forEach((b) => b.addEventListener("click", () => this.pick(b.dataset.f)));
    r.querySelector("[data-step]").addEventListener("click", () => this.advance());
    r.querySelector("[data-play]").addEventListener("click", () => this.play());
    r.querySelectorAll("g.node").forEach((g) => g.addEventListener("click", () => this.detail(g.dataset.id)));
    this.svg = r.querySelector("svg");
    this.caption = r.querySelector(".caption");
    void this.liveStatus();
    this.liveTraffic();
  }
  disconnectedCallback() {
    clearInterval(this.timer);
    this.es?.close();
  }
  nodeUrl() {
    return this.getAttribute("node-url") || "/api";
  }
  async nodeFetch(path, init) {
    if (window.__ceNode?.request) return window.__ceNode.request(path, init);
    const res = await fetch(this.nodeUrl() + path, init);
    return res.json();
  }
  body() {
    const p = [];
    for (const e of EDGES) {
      const a = NODES.find((n) => n.id === e.from), b = NODES.find((n) => n.id === e.to);
      const A = box(a), B = box(b);
      const [x1, y1] = clip(A.x + A.w / 2, A.y + A.h / 2, A.w, A.h, B.x + B.w / 2, B.y + B.h / 2);
      const [x2, y2] = clip(B.x + B.w / 2, B.y + B.h / 2, B.w, B.h, A.x + A.w / 2, A.y + A.h / 2);
      p.push(`<g class="edgeg" data-id="${e.id}"><path class="edge ${e.kind}" d="M ${x1} ${y1} L ${x2} ${y2}" marker-end="url(#ar)"/>` + (e.label ? `<text class="elbl" x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 5}" text-anchor="middle">${esc(e.label)}</text>` : "") + `</g>`);
    }
    for (const n of NODES) {
      const { x, y, w, h } = box(n);
      p.push(`<g class="node" data-id="${n.id}" style="cursor:pointer"><rect class="bx ${n.kind}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${n.kind === "contract" ? 4 : n.kind === "frontend" || n.kind === "peer" ? 22 : 9}"/><text x="${x + w / 2}" y="${y + h / 2 + 1}" text-anchor="middle">${esc(n.label)}</text><text class="klabel" x="${x + w / 2}" y="${y + h - 6}" text-anchor="middle">${n.kind.toUpperCase()}</text></g>`);
    }
    return `<defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6.5" markerHeight="6.5" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="#4a5462"/></marker></defs>${p.join("")}`;
  }
  pick(id) {
    clearInterval(this.timer);
    this.flow = FLOWS.find((f) => f.id === id) || null;
    this.step = -1;
    this.shadowRoot.querySelectorAll("button[data-f]").forEach((b) => b.classList.toggle("active", b.dataset.f === id));
    this.advance();
  }
  play() {
    if (!this.flow) return this.pick(FLOWS[0].id), this.play();
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.advance();
      if (this.step === this.flow.steps.length - 1) clearInterval(this.timer);
    }, 2100);
  }
  advance() {
    if (!this.flow) return;
    this.step = (this.step + 1) % this.flow.steps.length;
    const st = this.flow.steps[this.step];
    this.caption.innerHTML = `<b>${this.step + 1}/${this.flow.steps.length}</b> ${esc(st.text)}`;
    const seen = new Set(this.flow.steps.slice(0, this.step + 1).map((s) => s.at));
    this.shadowRoot.querySelectorAll("g.node, g.edgeg").forEach((g2) => g2.classList.toggle("dim", !seen.has(g2.dataset.id)));
    this.shadowRoot.querySelectorAll(".hot").forEach((el) => el.classList.remove("hot"));
    this.shadowRoot.querySelectorAll(".ring, .runner").forEach((el) => el.remove());
    const g = this.shadowRoot.querySelector(`g[data-id="${st.at}"]`);
    if (!g) return;
    const path = g.querySelector("path.edge");
    if (path) {
      path.classList.add("hot");
      this.runDot(path, "runner", 1100);
    } else {
      const rect = g.querySelector("rect");
      const ring = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      for (const a of ["x", "y", "width", "height", "rx"]) ring.setAttribute(a, rect.getAttribute(a));
      ring.setAttribute("class", "ring");
      this.svg.append(ring);
    }
  }
  runDot(path, cls, ms) {
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("class", cls);
    dot.setAttribute("r", "5");
    this.svg.append(dot);
    const t0 = performance.now();
    const total = path.getTotalLength();
    const run = (t2) => {
      const k = Math.min(1, (t2 - t0) / ms);
      const pt = path.getPointAtLength(k * total);
      dot.setAttribute("cx", pt.x);
      dot.setAttribute("cy", pt.y);
      if (k < 1 && dot.isConnected) requestAnimationFrame(run);
      else if (cls.includes("live")) dot.remove();
    };
    requestAnimationFrame(run);
  }
  detail(id) {
    const n = NODES.find((x) => x.id === id);
    if (n) this.caption.innerHTML = `<b>${esc(n.label)}</b> \u2014 ${esc(n.d)}`;
  }
  async liveStatus() {
    const set = (id, ok) => {
      const el = this.shadowRoot.getElementById(id);
      el.classList.remove("ok", "bad");
      el.classList.add(ok ? "ok" : "bad");
    };
    const probe = async (svc, id) => {
      try {
        const r = await this.nodeFetch(`/discovery/find/${encodeURIComponent(svc)}`);
        set(id, Array.isArray(r?.providers ?? r) ? (r.providers ?? r).length > 0 : false);
      } catch {
        set(id, false);
      }
    };
    await probe("loppis.listings/1", "live-l");
    await probe("loppis.bids/1", "live-b");
    setTimeout(() => this.liveStatus(), 2e4);
  }
  liveTraffic() {
    let es;
    try {
      es = new EventSource(this.nodeUrl() + "/mesh/messages/stream");
    } catch {
      return;
    }
    this.es = es;
    es.onerror = () => {
      es.close();
      setTimeout(() => this.liveTraffic(), 3e3);
    };
    es.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);
        const hit = TOPIC_EDGE.find((t2) => (m.topic || "").startsWith(t2.match));
        if (!hit) return;
        const path = this.shadowRoot.querySelector(`g[data-id="${hit.edge}"] path.edge`);
        if (path) this.runDot(path, hit.ev ? "live-pulse ev" : "live-pulse", 800);
      } catch {
      }
    };
  }
};
if (!customElements.get("ce-viz-loppis")) customElements.define("ce-viz-loppis", CeVizLoppis);

// node_modules/@ce-net/iface/dist/schema.js
var SchemaError = class extends Error {
  path;
  expected;
  got;
  constructor(path, expected, got) {
    super(`schema mismatch at ${path || "$"}: expected ${expected}, got ${describe(got)}`);
    this.path = path;
    this.expected = expected;
    this.got = got;
    this.name = "SchemaError";
  }
};
function describe(v) {
  if (v === null)
    return "null";
  if (Array.isArray(v))
    return "array";
  return typeof v;
}
function prim(kind) {
  return {
    kind,
    parse(v, path = "") {
      if (typeof v !== kind || kind === "number" && !Number.isFinite(v)) {
        throw new SchemaError(path, kind, v);
      }
      return v;
    },
    json: () => ({ type: kind })
  };
}
var OPTIONAL = Symbol("optional");
var t = {
  string: () => prim("string"),
  number: () => prim("number"),
  boolean: () => prim("boolean"),
  literal(value) {
    return {
      kind: "literal",
      parse(v, path = "") {
        if (v !== value)
          throw new SchemaError(path, `literal ${JSON.stringify(value)}`, v);
        return value;
      },
      json: () => ({ const: value })
    };
  },
  nul: () => ({
    kind: "null",
    parse(v, path = "") {
      if (v !== null)
        throw new SchemaError(path, "null", v);
      return null;
    },
    json: () => ({ type: "null" })
  }),
  optional(inner) {
    return {
      kind: "optional",
      [OPTIONAL]: true,
      parse(v, path = "") {
        return v === void 0 ? void 0 : inner.parse(v, path);
      },
      json: () => inner.json()
    };
  },
  array(item) {
    return {
      kind: "array",
      parse(v, path = "") {
        if (!Array.isArray(v))
          throw new SchemaError(path, "array", v);
        return v.map((x, i) => item.parse(x, `${path}[${i}]`));
      },
      json: () => ({ type: "array", items: item.json() })
    };
  },
  object(props) {
    return {
      kind: "object",
      parse(v, path = "") {
        if (v === null || typeof v !== "object" || Array.isArray(v)) {
          throw new SchemaError(path, "object", v);
        }
        const src = v;
        const out = {};
        for (const [k, s] of Object.entries(props)) {
          const parsed = s.parse(src[k], path ? `${path}.${k}` : k);
          if (parsed !== void 0)
            out[k] = parsed;
        }
        return out;
      },
      json: () => ({
        type: "object",
        properties: Object.fromEntries(Object.entries(props).map(([k, s]) => [k, s.json()])),
        required: Object.entries(props).filter(([, s]) => !(OPTIONAL in s)).map(([k]) => k)
      })
    };
  },
  union(a, b) {
    return {
      kind: "union",
      parse(v, path = "") {
        try {
          return a.parse(v, path);
        } catch {
          return b.parse(v, path);
        }
      },
      json: () => ({ anyOf: [a.json(), b.json()] })
    };
  },
  /** Escape hatch for payloads the contract deliberately leaves open. */
  unknown: () => ({
    kind: "unknown",
    parse: (v) => v,
    json: () => ({})
  })
};

// node_modules/@ce-net/iface/dist/iface.js
function defineInterface(def) {
  if (!/^[a-z][a-z0-9._-]*$/.test(def.name)) {
    throw new Error(`interface name must be dotted-lowercase, got: ${def.name}`);
  }
  return { events: {}, ...def };
}
function rpcTopic(def) {
  return `${def.name}/${def.version}`;
}
function eventTopic(def, event) {
  return `${def.name}/${def.version}/ev/${event}`;
}

// node_modules/@ce-net/iface/dist/wire.js
var enc = new TextEncoder();
var dec = new TextDecoder();
function encodeRequest(m, i) {
  return enc.encode(JSON.stringify({ m, i }));
}
function decodeReply(payload) {
  const v = JSON.parse(dec.decode(payload));
  if (v && typeof v === "object" && ("ok" in v || "err" in v))
    return v;
  throw new Error("malformed reply envelope");
}
function decodeEvent(payload) {
  return JSON.parse(dec.decode(payload));
}
var CallError = class extends Error {
  code;
  constructor(code, msg) {
    super(`${code}: ${msg}`);
    this.code = code;
    this.name = "CallError";
  }
};

// node_modules/@ce-net/iface/dist/connect.js
async function connect(ce2, def, opts = {}) {
  const topic = rpcTopic(def);
  const warn = opts.onWarn ?? (() => {
  });
  let provider = opts.provider;
  if (!provider) {
    const retries = opts.findRetries ?? 5;
    for (let i = 0; i <= retries && !provider; i++) {
      const found = await ce2.discovery.find(topic);
      const self = await selfId(ce2);
      provider = found.find((n) => n !== self) ?? found[0];
      if (!provider && i < retries)
        await sleep(opts.findRetryMs ?? 500);
    }
    if (!provider)
      throw new CallError("no-provider", `no provider advertising ${topic}`);
  }
  const bound = provider;
  const call = async (m, input) => {
    const reply = await ce2.mesh.request(bound, topic, encodeRequest(m, input));
    const wire = decodeReply(reply);
    if ("err" in wire)
      throw new CallError(wire.err.code, wire.err.msg);
    return wire.ok;
  };
  const client = {
    provider: bound,
    async on(event, fn) {
      const schema = def.events[event];
      if (!schema)
        throw new Error(`${def.name} has no event ${event}`);
      const topic2 = eventTopic(def, event);
      await ce2.mesh.subscribe(topic2);
      const ac = new AbortController();
      void (async () => {
        while (!ac.signal.aborted) {
          try {
            for await (const msg of ce2.mesh.streamMessages({ signal: ac.signal })) {
              if (msg.topic !== topic2)
                continue;
              try {
                fn(schema.parse(decodeEvent(fromHex2(msg.payloadHex)), "event"));
              } catch (e) {
                warn(`event ${event} rejected`, e);
              }
            }
          } catch (e) {
            if (!ac.signal.aborted) {
              warn("event stream reconnecting", e);
              await sleep(500);
            }
          }
        }
      })();
      return () => ac.abort();
    }
  };
  for (const m of Object.keys(def.methods)) {
    client[m] = (input) => {
      const parsed = def.methods[m].input.parse(input, "input");
      return call(m, parsed).then((ok) => def.methods[m].output.parse(ok, "output"));
    };
  }
  return client;
}
async function selfId(ce2) {
  try {
    return (await ce2.status.status()).nodeId;
  } catch {
    return void 0;
  }
}
function fromHex2(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++)
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// node_modules/@loppis/listings/dist/iface.js
var Listing = t.object({
  id: t.string(),
  title: t.string(),
  description: t.optional(t.string()),
  /** Starting price in whole kronor (MVP; money-as-base-units when an economy adapter meters). */
  startPrice: t.number(),
  /** Seller NodeId (hex) — the authenticated mesh sender at create time. */
  seller: t.string(),
  createdAt: t.number(),
  status: t.union(t.literal("open"), t.literal("closed"))
});
var ListingsIface = defineInterface({
  name: "loppis.listings",
  version: 1,
  doc: "Secondhand-item listings: the catalog every other loppis app composes on.",
  methods: {
    create: {
      input: t.object({
        title: t.string(),
        description: t.optional(t.string()),
        startPrice: t.number()
      }),
      output: Listing,
      requires: "loppis:listing:create",
      doc: "Create a listing; seller = the authenticated caller."
    },
    get: {
      input: t.object({ id: t.string() }),
      output: t.union(Listing, t.nul())
    },
    list: {
      input: t.object({ limit: t.optional(t.number()) }),
      output: t.array(Listing),
      doc: "Newest first."
    },
    close: {
      input: t.object({ id: t.string() }),
      output: t.union(Listing, t.nul()),
      requires: "loppis:listing:close",
      doc: "Close a listing (only the seller may; enforced by the handler)."
    }
  },
  events: {
    /** The social feed IS this typed event stream. */
    created: Listing,
    closed: Listing
  }
});

// node_modules/@loppis/bids/dist/iface.js
var Bid = t.object({
  id: t.string(),
  listingId: t.string(),
  /** Bidder NodeId (hex) — the authenticated mesh sender. */
  bidder: t.string(),
  amount: t.number(),
  placedAt: t.number()
});
var BidsIface = defineInterface({
  name: "loppis.bids",
  version: 1,
  doc: "Bidding on loppis listings. Validates the listing against loppis.listings/1 over the mesh (typed service-to-service).",
  methods: {
    place: {
      input: t.object({ listingId: t.string(), amount: t.number() }),
      output: Bid,
      requires: "loppis:bid:place",
      doc: "Place a bid; must exceed the current highest (or meet startPrice) and the listing must be open. Errors: unknown-listing, listing-closed, too-low, self-bid."
    },
    highest: {
      input: t.object({ listingId: t.string() }),
      output: t.union(Bid, t.nul())
    },
    listForListing: {
      input: t.object({ listingId: t.string() }),
      output: t.array(Bid),
      doc: "Highest first."
    }
  },
  events: {
    /** Live auction feed: every accepted bid, typed. */
    placed: Bid
  }
});

// src/app.ts
var ce = new CeClient({ baseUrl: `${location.origin}/api` });
var $ = (sel) => {
  const el = document.querySelector(sel);
  if (!el) throw new Error(`missing element ${sel}`);
  return el;
};
var feed = $("#feed");
var listEl = $("#listings");
var status = $("#status");
function note(msg) {
  status.textContent = msg;
}
function feedLine(text) {
  const li = document.createElement("li");
  li.textContent = `${(/* @__PURE__ */ new Date()).toLocaleTimeString()} ${text}`;
  feed.prepend(li);
  while (feed.children.length > 30) feed.lastChild?.remove();
}
var highest = /* @__PURE__ */ new Map();
function render(listings2) {
  listEl.replaceChildren(
    ...listings2.map((l) => {
      const li = document.createElement("li");
      li.className = `listing ${l.status}`;
      const high = highest.get(l.id);
      li.innerHTML = `
        <strong></strong> <span class="price"></span>
        <em class="desc"></em>
        <span class="high"></span>`;
      li.querySelector("strong").textContent = l.title;
      li.querySelector(".price").textContent = `start ${l.startPrice} kr`;
      li.querySelector(".desc").textContent = l.description ?? "";
      li.querySelector(".high").textContent = high ? `highest: ${high.amount} kr (${high.bidder.slice(0, 8)}\u2026)` : "no bids yet";
      const form = document.createElement("form");
      form.innerHTML = `<input name="amount" type="number" placeholder="bid (kr)" required /><button>Bid</button>`;
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        void placeBid(l.id, Number(new FormData(form).get("amount")));
      });
      if (l.status === "open") li.append(form);
      return li;
    })
  );
}
var listings;
var bids;
async function refresh() {
  const all = await listings.list({ limit: 50 });
  await Promise.all(
    all.map(async (l) => {
      const h = await bids.highest({ listingId: l.id });
      if (h) highest.set(l.id, h);
    })
  );
  render(all);
}
async function placeBid(listingId, amount) {
  try {
    const bid = await bids.place({ listingId, amount });
    note(`bid ${bid.amount} kr placed`);
  } catch (e) {
    note(e instanceof CallError ? `refused: ${e.code} \u2014 ${e.message}` : String(e));
  }
}
$("#create").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  void (async () => {
    try {
      const desc = String(f.get("description") ?? "");
      await listings.create({
        title: String(f.get("title")),
        startPrice: Number(f.get("startPrice")),
        ...desc ? { description: desc } : {}
      });
      $("#create").reset();
      note("listing created");
    } catch (err) {
      note(err instanceof CallError ? `refused: ${err.code} \u2014 ${err.message}` : String(err));
    }
  })();
});
note("connecting to the mesh\u2026");
try {
  [listings, bids] = await Promise.all([connect(ce, ListingsIface), connect(ce, BidsIface)]);
  note(`connected \u2014 listings@${listings.provider.slice(0, 8)}\u2026 bids@${bids.provider.slice(0, 8)}\u2026`);
  await refresh();
  await listings.on("created", (l) => {
    feedLine(`new listing: ${l.title} (start ${l.startPrice} kr)`);
    void refresh();
  });
  await bids.on("placed", (b) => {
    highest.set(b.listingId, b);
    feedLine(`bid: ${b.amount} kr on ${b.listingId.slice(0, 8)}\u2026 by ${b.bidder.slice(0, 8)}\u2026`);
    void refresh();
  });
} catch (e) {
  note(`connect failed: ${e instanceof Error ? e.message : e} \u2014 are the loppis daemons and ce node running?`);
}
