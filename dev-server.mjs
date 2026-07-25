/**
 * Localhost dev server: serves the page + bundle and PROXIES /api/* to the local ce node
 * with the operator's api.token injected server-side. Same-origin (no CORS dependency),
 * and the token never reaches the page. Dev only — the mesh-bridge/public path is the
 * production story.
 */

import { createServer, request as httpRequest } from "node:http";
import { readFile } from "node:fs/promises";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const PORT = Number(process.env.PORT ?? 5173);
const NODE = process.env.CE_API ?? "http://127.0.0.1:8844";

// State (the pid-lock) lives OUTSIDE the install dir: `ce app install` replaces the whole
// versioned app dir on every deploy, so a lock kept in it would be wiped by upgrades.
const STATE_DIR = process.env.LOPPIS_STATE ?? join(homedir(), ".local", "share", "loppis-web");

/**
 * Singleton guard — the same law the loppis backends carry. Supervisors respawn this app
 * (and a node restart orphans the previous generation, which keeps the port), so without a
 * lock every respawn died on EADDRINUSE and dumped a 40-line stack trace into daemon.log —
 * megabytes of noise hiding real failures. First one wins; the rest exit quietly.
 */
function singleton(dirPath) {
  const lock = join(dirPath, "daemon.pid");
  try {
    const other = Number(readFileSync(lock, "utf8"));
    if (other > 0) {
      try {
        process.kill(other, 0);
        console.log(`another instance (pid ${other}) is live — exiting`);
        process.exit(0);
      } catch { /* stale lock */ }
    }
  } catch { /* no lock */ }
  mkdirSync(dirPath, { recursive: true });
  writeFileSync(lock, String(process.pid));
}

singleton(STATE_DIR);

function token() {
  const candidates = [
    join(homedir(), "Library", "Application Support", "ce", "api.token"),
    join(homedir(), ".local", "share", "ce", "api.token"),
  ];
  for (const p of candidates) {
    try {
      return readFileSync(p, "utf8").trim();
    } catch {}
  }
  return "";
}
const TOKEN = token();
if (!TOKEN) console.warn("no api.token found — mutating node calls will 401");

const files = {
  "/": ["index.html", "text/html"],
  "/app.js": ["dist/app.js", "text/javascript"],
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  if (url.pathname.startsWith("/api/")) {
    const target = new URL(NODE);
    const proxied = httpRequest(
      {
        host: target.hostname,
        port: target.port,
        path: url.pathname.slice(4) + url.search,
        method: req.method,
        headers: { ...req.headers, host: target.host, authorization: `Bearer ${TOKEN}` },
      },
      (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(res);
      },
    );
    proxied.on("error", (e) => {
      res.writeHead(502);
      res.end(String(e));
    });
    req.pipe(proxied);
    return;
  }
  const entry = files[url.pathname];
  if (!entry) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  try {
    const body = await readFile(new URL(entry[0], import.meta.url));
    res.writeHead(200, { "content-type": entry[1] });
    res.end(body);
  } catch (e) {
    res.writeHead(500);
    res.end(String(e));
  }
});

server.on("error", (e) => {
  // A stale lock plus a live port holder must not become an unhandled 'error' stack dump.
  if (e && e.code === "EADDRINUSE") {
    console.log(`port ${PORT} already served by another instance — exiting`);
    process.exit(0);
  }
  console.error(`loppis-web dev server failed: ${String(e)}`);
  process.exit(1);
});

server.listen(PORT, () => console.log(`loppis-web dev server: http://localhost:${PORT} (node: ${NODE})`));
