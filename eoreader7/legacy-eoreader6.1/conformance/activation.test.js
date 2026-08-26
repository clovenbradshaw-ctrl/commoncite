// eoreader6 · activation — associative memory, held to the one property that
// makes it a READING rather than an analysis of a finished object.
//
// The load-bearing test is `prefix stability`. eoreader5's store fails it by
// construction — its idf, trigram-df, and df >= 2 gate are computed over every
// frame before the first one is read — and that is the entire reason this
// module was re-derived instead of imported. Everything else in here is
// secondary.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readForward, codeOf, seriesOf, tokens } from "../packages/engine/emergence/activation.js";

// A small corpus with deliberate structure: two motifs that recur at range,
// separated by material that shares nothing with them.
const FRAMES = [
  "the lantern swung above the harbour wall and the water answered",
  "gulls turned over the harbour wall while the lantern guttered",
  "in the counting house the ledgers were stacked in careful columns",
  "the ledgers balanced and the columns were ruled again in careful ink",
  "somewhere far inland a train crossed a bridge over nothing at all",
  "the lantern swung again above the harbour wall and the water answered",
  "the columns of the ledgers were ruled once more in careful ink",
].map((text, order) => ({ order, offset: order * 100, text }));

test("PREFIX STABILITY — reading the first k frames gives exactly what reading all of it gave", () => {
  // This is what "left to right" means, mechanically. A reader whose account
  // of page 3 changes once they have seen page 7 was not reading page 3; they
  // were reviewing. Any whole-document table — idf, document frequency, a
  // vocabulary — breaks this the moment it is consulted.
  const whole = readForward(FRAMES).records;

  for (let k = 1; k <= FRAMES.length; k++) {
    const prefix = readForward(FRAMES.slice(0, k)).records;
    assert.equal(prefix.length, k);
    for (let i = 0; i < k; i++) {
      assert.deepEqual(
        prefix[i],
        whole[i],
        `frame ${i} read differently when only ${k} frames were available — the future is leaking backwards`
      );
    }
  }
});

test("a frame never recalls itself, and never recalls what it is about to wire", () => {
  const { records } = readForward(FRAMES);
  for (const r of records) {
    assert.notEqual(r.strongest?.order, r.order, "a frame recalling itself is a memory reporting the present");
    if (r.strongest) assert.ok(r.strongest.order < r.order, "recall reached forward in time");
  }
});

test("the first frame has nothing to remember, and says so rather than saying zero", () => {
  const { records } = readForward(FRAMES);
  assert.equal(records[0].activation, 0);
  assert.equal(records[0].reach, null, "no echo and an echo at distance zero are different findings");
  assert.equal(records[0].recalled, 0);
});

test("a motif is a key only once it has ALREADY recurred — not once it will", () => {
  // The df >= 2 gate, made causal. In eoreader5 this gate admits a key on the
  // strength of a recurrence that has not happened yet, which is the sharpest
  // form of the leak: the reader is told in advance what will matter.
  const state = { df: new Map(), gramDf: new Map(), posting: new Map(), edges: new Map(), read: 40 };
  const ws = tokens("lantern harbour lantern");
  assert.equal(codeOf(ws, state).cue.size, 0, "nothing has been seen before; nothing can be a key");

  state.df.set("lantern", 2); // seen in two frames already read
  const code = codeOf(ws, state).cue;
  assert.ok(code.has("lantern"));
  assert.ok(!code.has("harbour"), "a form seen once is a hapax and could not retrieve anything anyway");
});

// Long enough that a motif can be both RECURRING (df >= 2) and RARE
// (df/t <= e^-2). In a seven-frame document nothing can be both, and the code
// is correctly empty — a short text has no distant memory to have.
const LONG = Array.from({ length: 40 }, (_, i) => ({
  order: i,
  offset: i * 100,
  text: `frame ${i} the ordinary business of the day continued much as before with letters and accounts`,
}));
// The motif appears three times, widely separated. Three, not two: the second
// occurrence cannot recall the first, because at that moment the tables have
// counted only one. The third is the first that can place it.
for (const at of [3, 11, 34]) LONG[at].text += " the lantern swung above the harbour wall and the water answered";

test("recall reaches past intervening material to the frames it shares a motif with", () => {
  const { records } = readForward(LONG);

  assert.equal(records[11].strongest, null, "the SECOND occurrence must not recall: df is still 1 when it is read");

  const r = records[34];
  assert.ok(r.strongest, "the third occurrence has a key and must recall the earlier two");
  assert.ok(r.reach >= 23, `loudest echo was only ${r.reach} frames back — recall is not reaching`);
  // ...and it reached one of the frames that actually carries the motif, not
  // whatever happened to be nearby.
  assert.ok([3, 11].includes(r.strongest.order), `recalled frame ${r.strongest.order}, which does not carry the motif`);
});

test("the intervening frames, which share only ordinary vocabulary, do not recall the motif", () => {
  // The sparse-coding gate exists to stop exactly this: a flood through dense
  // common vocabulary that reaches everything and distinguishes nothing.
  const { records } = readForward(LONG);
  for (const i of [20, 21, 22]) {
    assert.equal(records[i].codeSize, 0, `frame ${i} is pure filler and must have no distinctive key`);
    assert.equal(records[i].activation, 0);
  }
});

test("a gap is declared at the call site, never defaulted to zero", () => {
  const { records } = readForward(FRAMES);
  assert.throws(() => seriesOf(records, "reach"), /declared, never defaulted/);
  const s = seriesOf(records, "reach", { missing: 0 });
  assert.equal(s.length, records.length);
  assert.equal(s[0], 0);
});

test("reading is causal in the tables too: a frame is never counted in its own idf", () => {
  // Off-by-one here is the difference between reading and reviewing. If the
  // frame advanced the tables before being coded, every one of its own forms
  // would carry a document frequency that includes itself.
  const twice = [
    { order: 0, text: "lantern lantern lantern harbour harbour harbour" },
    { order: 1, text: "lantern harbour" },
  ];
  const { records } = readForward(twice);
  assert.equal(records[0].codeSize, 0, "the first frame cannot have keys: nothing has recurred across frames yet");
});

// ── the model tier ──────────────────────────────────────────────────────────

test("with no embedder the model tier is a TYPED GAP, never a zero and never omitted", () => {
  // The cardinal regression in this lineage is faking a model-tier absence.
  // Descriptor synonymy (monster ~ creature) is exactly what the sparse code
  // cannot reach, so the channel that would reach it must be visibly missing
  // rather than silently empty.
  const { records } = readForward(LONG);
  for (const r of records) {
    assert.ok(r.resonance, "the model tier must be reported on every record, present or not");
    assert.equal(r.resonance.gap, "undeclared");
    assert.equal(r.resonance.what, "embed");
  }
});

test("the model tier may refine what the engine tier surfaced, and may never invent it", () => {
  // A deliberately degenerate embedder: every token maps to the same vector,
  // so MaxSim carries no information at all. It must still never produce a
  // memory on a frame where the sparse code surfaced nothing — the tier
  // boundary is structural, not a matter of how good the model is.
  const embed = (ws) => ws.map(() => Float32Array.from([1, 0]));
  const { records } = readForward(LONG, { embed });

  for (const r of records) {
    if (r.recalled === 0) {
      assert.equal(r.resonance.gap, "no_ground", "the model tier conjured a memory the engine tier never had");
    } else {
      assert.equal(r.resonance.n, r.recalled, "the model tier reranked a different set than was surfaced");
      assert.ok(r.resonance.top.order < r.order, "reranking reached forward in time");
    }
  }
});

test("the two channels' disagreement is reported, not reconciled", () => {
  // An embedder that scores by nothing but frame recency, guaranteeing it
  // disagrees with the engine tier wherever the loudest echo is not the
  // nearest one. SEED.md #6: the disagreement is the only self-check there is.
  const embed = (ws) => ws.map((w) => Float32Array.from([w.length, 1]));
  const { records } = readForward(LONG, { embed });
  const judged = records.filter((r) => r.resonance && !r.resonance.gap);
  assert.ok(judged.length > 0, "test setup: some frame must have had something to rerank");
  for (const r of judged) assert.equal(typeof r.resonance.agrees, "boolean");
});
