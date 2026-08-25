// scripts/adversarial/fixtures/write-novella-offline-harness.mjs
//
// Spawned as a real subprocess by conformance/local-first-boundary.test.js
// (so the actual exit behavior — crash vs. typed gap — is captured exactly
// as it would be for a real invocation, and so a raw exception inside
// write-novella.mjs cannot bring the test runner's own process down).
//
// Mocks the network boundary write-novella.mjs's callModel() calls through
// (global fetch) to fail exactly the way a real fetch does when nothing is
// reachable — a TypeError wrapping an ECONNREFUSED-shaped cause, the same
// shape challenge #14 (scripts/adversarial/challenge-14-offline-degradation-
// of-the-reactive-fall.mjs) verified against Node's own undici — then calls
// the real, unmodified, exported main() and reports, via exit code and
// captured stderr, whether the failure surfaced through this repo's typed-
// gap vocabulary (nul/index.js's gap()/isGap()) or escaped as a raw,
// unclassified exception.
import { isGap } from "../../../nul/index.js";

let fetchWasCalled = false;
globalThis.fetch = async (...args) => {
  fetchWasCalled = true;
  console.error(`[harness] fetch() called with url=${args[0]} — network BLOCKED (mocked offline)`);
  const err = new TypeError("fetch failed");
  err.cause = new Error("connect ECONNREFUSED 127.0.0.1:11434 (mocked: no network available)");
  throw err;
};

// A safety net, not the primary mechanism: main() is awaited directly below
// in a try/catch, so its own rejection is caught normally. This only fires
// if something escapes that (e.g. a synchronous throw during the dynamic
// import itself), so a bug elsewhere in this harness can't masquerade as a
// silent pass.
process.on("uncaughtException", (e) => {
  console.error(`[harness] UNCAUGHT EXCEPTION reached the top of the process: ${e.constructor.name}: ${e.message}`);
  process.exit(97);
});

const { main } = await import("../../write-novella.mjs");
try {
  await main();
  console.error("[harness] main() completed without error — unexpected under mocked-offline");
  process.exit(0);
} catch (e) {
  console.error(`[harness] fetch was called: ${fetchWasCalled}`);
  if (isGap(e)) {
    console.error(`[harness] main() stopped on a typed gap: ${e.gap} — cause: ${e.cause}`);
    process.exit(2);
  }
  console.error(`[harness] main() threw a NON-gap error: ${e}`);
  process.exit(1);
}
