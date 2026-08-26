// eoreader6 · conformance/corpus-export-reimport — Challenge #20
// ("Export/reimport fidelity"). Locks the claim the adversarial test found
// unimplemented: a reimported session must be fold-equivalent to the
// original, not just carry the same raw source files. Before
// serializeSession/deserializeSession existed, the obvious first attempt
// (JSON.stringify(session)) silently round-tripped every span/document Map
// to `{}` and the next searchSpans() threw — measured in
// scripts/adversarial/challenge-20-export-reimport-fidelity.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createSession,
  admitChunked,
  searchSpans,
  spanUnits,
  foldSpans,
  serializeSession,
  deserializeSession,
  CORPUS_API_VERSION,
} from "../packages/host/corpus.js";

const DOC_A = [
  "The lighthouse keeper Aoife Devane climbed the spiral stairs at dawn.",
  "She logged the weather in her logbook, as she did every morning without fail.",
  "Storms rarely troubled this stretch of coast, but Aoife watched anyway.",
].join(" ");

const DOC_B = [
  "The trade caravan crossed the desert under a pale winter sun.",
  "Merchants counted their goods and argued over the price of salt.",
];

test("serializeSession -> JSON -> deserializeSession round-trips through a real JSON string (the actual OPFS export shape)", () => {
  const session = createSession();
  admitChunked(session, { text: DOC_A, sourceId: "source:lighthouse.txt" });
  admitChunked(session, { text: DOC_B.join(" "), sourceId: "source:caravan.txt" });

  const blob = serializeSession(session);
  const json = JSON.stringify(blob);
  const reimported = deserializeSession(JSON.parse(json));

  assert.ok(reimported.spans instanceof Map, "spans must reimport as a Map, not a plain object");
  assert.ok(reimported.documents instanceof Map, "documents must reimport as a Map, not a plain object");
  assert.equal(reimported.spans.size, session.spans.size);
  assert.equal(reimported.documents.size, session.documents.size);
  assert.equal(reimported.provenance.tick, session.provenance.tick);
  assert.equal(reimported.provenance.size, session.provenance.size);
  assert.equal(reimported.apiVersion, CORPUS_API_VERSION);
});

test("reimported session is fold-equivalent to the original: same search hits, same fold selection, same fold summary", () => {
  const session = createSession();
  admitChunked(session, { text: DOC_A, sourceId: "source:lighthouse.txt" });
  admitChunked(session, { text: DOC_B.join(" "), sourceId: "source:caravan.txt" });

  const QUERY = "lighthouse keeper Aoife Devane logbook";
  const originalHits = searchSpans(session, { query: QUERY, limit: 10 });
  const originalUnits = spanUnits(session, originalHits.spans);
  const originalFold = foldSpans(session, { units: originalUnits, query: QUERY, tokenBudget: 800 });

  const reimported = deserializeSession(JSON.parse(JSON.stringify(serializeSession(session))));
  const reimportedHits = searchSpans(reimported, { query: QUERY, limit: 10 });
  const reimportedUnits = spanUnits(reimported, reimportedHits.spans);
  const reimportedFold = foldSpans(reimported, { units: reimportedUnits, query: QUERY, tokenBudget: 800 });

  assert.equal(reimportedHits.spans.length, originalHits.spans.length);
  assert.equal(reimportedHits.spans[0]?.source_id, originalHits.spans[0]?.source_id);
  assert.equal(reimportedFold.selectedCount, originalFold.selectedCount);
  assert.equal(reimportedFold.tokens, originalFold.tokens);
  assert.equal(reimportedFold.summary, originalFold.summary);

  // Not just the ledger's shape — the ledger's byte-accurate content: every
  // span's text and byte range must survive exactly, since a fold is only
  // as trustworthy as the bytes it cites.
  for (const [id, span] of session.spans) {
    const re = reimported.spans.get(id);
    assert.ok(re, `span ${id} missing after reimport`);
    assert.equal(re.text, span.text);
    assert.equal(re.byte_start, span.byte_start);
    assert.equal(re.byte_end, span.byte_end);
  }
});

test("deserializeSession refuses a blob that is not its own schema, rather than silently misreading it", () => {
  assert.throws(() => deserializeSession({ not: "a session blob" }), TypeError);
  assert.throws(() => deserializeSession(null), TypeError);
});

test("serializeSession does not carry the derived _bytes cache, and deserializeSession still works without it (snip* recomputes lazily)", () => {
  const session = createSession();
  admitChunked(session, { text: DOC_A, sourceId: "source:lighthouse.txt" });
  const blob = serializeSession(session);
  assert.equal(blob._bytes, undefined, "the export blob should not carry the closure-bearing byte/line-index cache");

  const reimported = deserializeSession(JSON.parse(JSON.stringify(blob)));
  assert.ok(reimported._bytes instanceof Map);
  assert.equal(reimported._bytes.size, 0);
});
