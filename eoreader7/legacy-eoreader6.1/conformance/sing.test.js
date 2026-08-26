// Conformance · host/sing — THE SELF-DIRECTED LOOP.
//
// What this suite holds the line on: the reader searches ITSELF. The first
// pass RECEIVES (a ground to seek from is earned, never assumed); every later
// pass seeks what the last PRESERVED passage was about; only a preserved
// candidate joins the reader; the gate never sees the query; and the run ends
// with the typed gap `no_candidate` when the reader's own memory stops
// pointing at anything new.
//
// The load-bearing test is the restatement: the reader received a passage,
// its own search then returns a token-identical twin of it, and the gate
// refuses the twin — the two are told apart structurally (search/index.js
// judge), never by a surface score — while the reader still seeks, and finds,
// the passage that states something new.

import test from "node:test";
import assert from "node:assert/strict";

import { createSession } from "../packages/host/corpus.js";
import { createSinger, singPass, singRun, apertureSeries, sing } from "../packages/host/sing.js";
import { isGap } from "../nul/index.js";

// Declared, as the loop demands.
const GAMMA = 0.95;
const PRUNE_BELOW = 1e-4;
const RESEEDS = 60;
const SEED = 20260801;
const ALPHA = 1;

// ── the test corpus ─────────────────────────────────────────────────────────
//
// Three spans, hand-built so the pass sequence is deterministic:
//
//   S1  the founding passage — one relation, and the ground a reader holds.
//   S2  a TOKEN-IDENTICAL twin of S1 — the host's search scores it highest,
//      and the gate must refuse it: the reader's own reseeding reproduces it.
//   S3  a NEW relation between the same two beings — the gate must preserve it.
const S1 = "The creature hated victor.";
const S2 = "The creature hated victor.";
const S3 = "Victor defeated the creature.";

// The reader's relation vocabulary. In production this is measured from a
// real corpus (perceiver/text/relations.js::discoverRelationVocab — never a
// hand-listed English verb set); this fixture's corpus is three hand-built
// sentences with no statistics to measure it from, so the vocabulary this
// suite exercises the gate/graph with is hand-declared test data, exactly as
// S1/S2/S3 themselves are.
const VERBS = new Set(["hated", "defeated"]);

const makeSession = () => {
  const session = createSession();
  const spans = [
    { span_id: "span:s1", source_id: "test:s1", text: S1 },
    { span_id: "span:s2", source_id: "test:s2", text: S2 },
    { span_id: "span:s3", source_id: "test:s3", text: S3 },
  ];
  for (const sp of spans) session.spans.set(sp.span_id, sp);
  return session;
};

test("pass 1 RECEIVES — no query, the first ground is received, never derived", () => {
  const singer = createSinger({ session: makeSession(), gamma: GAMMA, pruneBelow: PRUNE_BELOW, reseeds: RESEEDS, seed: SEED, alpha: ALPHA, verbs: VERBS });
  const r = singPass(singer);

  assert.equal(isGap(r), false);
  assert.equal(r.pass, 1);
  assert.equal(r.query, null, "a reader with no ground does not search");
  assert.equal(r.span_id, "span:s1", "the first unread span is received");
  assert.equal(r.verdict, "preserve", "a being introduced against the nothing is the founding movement");
  assert.equal(singer.preserved.length, 1);
  assert.equal(singer.reader.nodes.size, 2, "the creature and victor — the referents exist now");
  assert.equal(singer.reader.edges.size, 1, "hated is held");
  assert.equal(singer.lastPreserved.span_id, "span:s1", "the preserved passage becomes the next query");
});

test("pass 2 seeks what it kept — and the gate refuses its token-identical twin", () => {
  const singer = createSinger({ session: makeSession(), gamma: GAMMA, pruneBelow: PRUNE_BELOW, reseeds: RESEEDS, seed: SEED, alpha: ALPHA, verbs: VERBS });
  singPass(singer);

  const nodesBefore = singer.reader.nodes.size;
  const edgesBefore = singer.reader.edges.size;
  const r = singPass(singer);

  assert.equal(r.pass, 2);
  assert.ok(typeof r.query === "string" && r.query.length > 0, "the query is the reader's own preserved passage");
  assert.ok(r.query.includes("creature"), "it seeks the words it just kept");
  assert.equal(r.span_id, "span:s2", "the identical twin outranks the new relation under coverage scoring");
  assert.equal(r.verdict, "refuse", "redundant against the reader — the ground's own reseeding reproduces it");
  assert.equal(r.ground.nodes, nodesBefore, "the graph was not touched by the refuse");
  assert.equal(r.ground.edges, edgesBefore);
  assert.equal(singer.refused.length, 1);
  assert.equal(singer.preserved.length, 1, "refuse gates preservation, never use");
  assert.equal(singer.lastPreserved.span_id, "span:s1", "the refused span is not what the reader seeks next");
});

test("pass 3 preserves the new relation the twin could not", () => {
  const singer = createSinger({ session: makeSession(), gamma: GAMMA, pruneBelow: PRUNE_BELOW, reseeds: RESEEDS, seed: SEED, alpha: ALPHA, verbs: VERBS });
  singPass(singer);
  singPass(singer);

  const r = singPass(singer);
  assert.equal(r.span_id, "span:s3");
  assert.equal(r.verdict, "preserve", "a relation the ground cannot reseed is an encounter");
  assert.equal(r.newEdges, 1);
  assert.equal(singer.preserved.length, 2);
  assert.equal(singer.reader.nodes.size, 2, "same two beings, a second relation between them");
  assert.equal(singer.reader.edges.size, 2, "hated, defeated");
});

test("the run ends with a typed gap when the reader's own search runs dry", () => {
  const singer = createSinger({ session: makeSession(), gamma: GAMMA, pruneBelow: PRUNE_BELOW, reseeds: RESEEDS, seed: SEED, alpha: ALPHA, verbs: VERBS });
  const run = singRun(singer, { passes: 20 });

  assert.equal(run.ended, "no_candidate", "the ending is a typed gap, never a silent empty list");
  assert.equal(run.preserved, 2);
  assert.equal(run.refused, 1);
  assert.equal(run.pass, 4, "the run stopped as soon as the search ran dry, not after a schedule");
  assert.equal(run.nodes, 2);
  assert.equal(run.edges, 2);
  assert.ok(run.strongest.some((e) => e.edge.includes("hated")), "the held belief is in the reader");
});

test("empty material is a typed gap, and a relation-less candidate is never fabricated into a verdict", () => {
  const session = createSession();
  session.spans.set("span:noise", { span_id: "span:noise", source_id: "test:noise", text: "A red lamp beside the window." });
  const singer = createSinger({ session, gamma: GAMMA, pruneBelow: PRUNE_BELOW, reseeds: RESEEDS, seed: SEED, alpha: ALPHA, verbs: VERBS });

  const r = singPass(singer);
  assert.equal(isGap(r), true);
  assert.equal(r.gap, "empty_material");
  assert.equal(singer.preserved.length, 0, "a passage with no relations moves nothing");
  assert.equal(singer.reader.edges.size, 0);
});

test("the pass sequence is deterministic in its declared seed", () => {
  const a = singRun(createSinger({ session: makeSession(), gamma: GAMMA, pruneBelow: PRUNE_BELOW, reseeds: RESEEDS, seed: SEED, alpha: ALPHA, verbs: VERBS }), { passes: 10 });
  const b = singRun(createSinger({ session: makeSession(), gamma: GAMMA, pruneBelow: PRUNE_BELOW, reseeds: RESEEDS, seed: SEED, alpha: ALPHA, verbs: VERBS }), { passes: 10 });
  assert.deepEqual(
    a.records.map((r) => ({ span: r.span_id, verdict: r.verdict })),
    b.records.map((r) => ({ span: r.span_id, verdict: r.verdict })),
  );
});

test("aperture is the volume of the ground the movements have built — null before there is a ground, never a gate", () => {
  const moves = [0.4, 1.1, 2.6, 0.8, 1.4];
  const out = apertureSeries(moves, { window: 3, draws: 8, seed: SEED });
  assert.equal(out[0], null, "fewer than window movements: no ground, honestly");
  assert.equal(out[1], null);
  for (let k = 2; k < out.length; k++) {
    assert.equal(typeof out[k], "number", `a ground exists from the ${k + 1}th movement onward`);
    assert.ok(out[k] >= 0, "volume is non-negative");
  }
  assert.throws(() => apertureSeries(moves, { window: 3, draws: 8 }), /seed is declared/);
});

test("SING — the reading speaks from where it stands, stamped imagined", () => {
  const singer = createSinger({ session: makeSession(), gamma: GAMMA, pruneBelow: PRUNE_BELOW, reseeds: RESEEDS, seed: SEED, alpha: ALPHA, verbs: VERBS });
  const run = singRun(singer, { passes: 10 });

  // The material the reader actually kept, in experience order.
  const tokens = [];
  for (const rec of run.records) {
    const sp = singer.session.spans.get(rec.span_id);
    if (rec.verdict === "preserve" && sp) tokens.push(...String(sp.text).toLowerCase().split(/\W+/).filter(Boolean));
  }
  assert.equal(tokens.length, 8, "two preserved passages, eight forms");
  assert.ok(tokens.includes("hated") && tokens.includes("defeated"));

  const here = tokens.length;
  const from = Math.max(0, here - 6); // the last preserved passage is the present
  const song = sing({ tokens, here, from, order: 2, alpha: ALPHA, horizon: 8, seed: SEED, selection: "mode" });

  if (isGap(song)) {
    // A song needs a ground; refusing is honest, never a silence-faked output.
    assert.ok(["no_ground", "undeclared"].includes(song.gap), `refused as a typed gap: ${song.gap}`);
    return;
  }
  assert.equal(song.kind, "sequence-scoped");
  assert.equal(song.register, "imagined", "a song is imagination, never testimony");
  assert.equal(song.selection_scope, "live-support — the mode is over what is in play, never over everything remembered");
  assert.equal(song.horizon, 8);
  assert.equal(song.scope.live, here - from);
  assert.equal(song.scope.past, from);
  assert.equal(song.emitted.length, 8);
});
