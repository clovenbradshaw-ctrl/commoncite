// challenge-21 · network blockade preload
//
// Loaded via `node --import` (subprocess mode) or a plain top-of-file ESM
// import (in-process mode) BEFORE any pipeline code runs. Monkey-patches
// every network primitive Node exposes so that, if the core fold/ingest
// pipeline ever reaches for the network, that attempt is (a) recorded to
// process.env.NETBLOCK_LOG (a JSON-lines file) so the outer test can prove
// a call count, and (b) made to fail — either immediately ("throw" mode,
// the realistic failure shape for each API) or to hang forever ("hang"
// mode), selected by NETBLOCK_MODE=throw|hang (default "throw").
//
// This intentionally patches the *real* mutable singleton objects Node's
// CJS/ESM interop exposes for core builtins (http/https/net/dns/tls) — not
// copies — so the patch is visible to every module in the process,
// including ones eoreader6's pipeline code imports internally that this
// harness never touches directly.
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import { EventEmitter } from "node:events";

const MODE = process.env.NETBLOCK_MODE === "hang" ? "hang" : "throw";
const LOG_PATH = process.env.NETBLOCK_LOG || null;

function record(api, arg) {
  const entry = { t: Date.now(), api, arg: String(arg ?? "").slice(0, 200), mode: MODE };
  // stderr trace, always
  process.stderr.write(`[netblock] BLOCKED CALL api=${entry.api} mode=${MODE} arg=${entry.arg}\n`);
  if (LOG_PATH) {
    try {
      fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n");
    } catch {
      /* best-effort logging only, never let logging itself throw */
    }
  }
}

// ── fetch ────────────────────────────────────────────────────────────────
const realFetch = globalThis.fetch;
globalThis.fetch = function blockedFetch(input, init) {
  record("fetch", typeof input === "string" ? input : input?.url ?? input);
  if (MODE === "hang") return new Promise(() => {}); // never resolves, never rejects
  return Promise.reject(new TypeError("fetch failed (blocked by challenge-21 network blockade harness)"));
};
globalThis.__netblockRealFetch = realFetch;

// ── WebSocket ────────────────────────────────────────────────────────────
if (typeof globalThis.WebSocket === "function") {
  const RealWebSocket = globalThis.WebSocket;
  class BlockedWebSocket extends EventTarget {
    constructor(url, protocols) {
      super();
      record("WebSocket", url);
      this.url = String(url);
      this.readyState = 0; // CONNECTING
      if (MODE === "throw") {
        setTimeout(() => {
          this.readyState = 3; // CLOSED
          this.dispatchEvent(new Event("error"));
          this.dispatchEvent(new Event("close"));
        }, 0);
      }
      // hang mode: never transitions out of CONNECTING
    }
    send() {}
    close() {}
  }
  globalThis.WebSocket = BlockedWebSocket;
  globalThis.__netblockRealWebSocket = RealWebSocket;
}

// ── http / https: request + get ─────────────────────────────────────────
function fakeClientRequest(apiName, arg) {
  record(apiName, arg);
  const req = new EventEmitter();
  req.end = () => req;
  req.write = () => true;
  req.destroy = () => req;
  req.setTimeout = () => req;
  req.abort = () => {};
  if (MODE === "throw") {
    setTimeout(() => req.emit("error", new Error(`ECONNREFUSED (blocked by challenge-21 harness): ${apiName} ${arg ?? ""}`)), 0);
  }
  // hang mode: no event ever fires — request sits open forever, exactly
  // like a socket to an unreachable/blocked host.
  return req;
}

for (const [mod, name] of [[http, "http"], [https, "https"]]) {
  const realRequest = mod.request;
  const realGet = mod.get;
  mod.request = function (...args) {
    const arg = typeof args[0] === "string" ? args[0] : args[0]?.hostname || args[0]?.host || args[0];
    return fakeClientRequest(`${name}.request`, arg);
  };
  mod.get = function (...args) {
    const arg = typeof args[0] === "string" ? args[0] : args[0]?.hostname || args[0]?.host || args[0];
    return fakeClientRequest(`${name}.get`, arg);
  };
  mod.__netblockReal = { request: realRequest, get: realGet };
}

// ── net / tls: connect + createConnection ───────────────────────────────
function fakeSocket(apiName, arg) {
  record(apiName, arg);
  const sock = new EventEmitter();
  sock.write = () => true;
  sock.end = () => sock;
  sock.destroy = () => sock;
  sock.setTimeout = () => sock;
  sock.setNoDelay = () => sock;
  sock.setKeepAlive = () => sock;
  if (MODE === "throw") {
    setTimeout(() => sock.emit("error", new Error(`ENETUNREACH (blocked by challenge-21 harness): ${apiName} ${arg ?? ""}`)), 0);
  }
  return sock;
}

for (const [mod, name] of [[net, "net"], [tls, "tls"]]) {
  const realConnect = mod.connect;
  const realCreateConnection = mod.createConnection;
  const wrap = (apiName) =>
    function (...args) {
      const arg = typeof args[0] === "object" ? args[0]?.host || args[0]?.port : args[0];
      return fakeSocket(apiName, arg);
    };
  mod.connect = wrap(`${name}.connect`);
  mod.createConnection = wrap(`${name}.createConnection`);
  mod.__netblockReal = { connect: realConnect, createConnection: realCreateConnection };
}

// ── dns (callback style) ────────────────────────────────────────────────
const dnsMethods = ["lookup", "resolve", "resolve4", "resolve6", "resolveCname", "resolveMx", "resolveTxt", "resolveSrv", "resolveNs", "resolvePtr", "reverse"];
for (const m of dnsMethods) {
  if (typeof dns[m] !== "function") continue;
  const real = dns[m];
  dns[m] = function (...args) {
    const hostname = args[0];
    const cb = args[args.length - 1];
    record(`dns.${m}`, hostname);
    if (typeof cb !== "function") return real.apply(this, args); // e.g. no callback given, defer to real (shouldn't happen for us)
    if (MODE === "throw") {
      setTimeout(() => cb(new Error(`ENOTFOUND (blocked by challenge-21 harness): ${hostname}`)), 0);
    }
    // hang mode: callback is simply never invoked.
  };
  dns[m].__netblockReal = real;
}

// ── dns/promises ─────────────────────────────────────────────────────────
for (const m of dnsMethods) {
  if (typeof dnsPromises[m] !== "function") continue;
  const real = dnsPromises[m];
  dnsPromises[m] = function (hostname, ...rest) {
    record(`dns.promises.${m}`, hostname);
    if (MODE === "hang") return new Promise(() => {});
    return Promise.reject(new Error(`ENOTFOUND (blocked by challenge-21 harness): ${hostname}`));
  };
  dnsPromises[m].__netblockReal = real;
}

process.stderr.write(`[netblock] armed, mode=${MODE}, log=${LOG_PATH ?? "(none)"}\n`);
