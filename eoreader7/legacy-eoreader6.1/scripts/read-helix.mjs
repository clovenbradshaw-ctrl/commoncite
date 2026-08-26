// eoreader6 · read-helix — the reading as a HELIX, asserted by DEFs.
//
// A thing is not a span because a window happened to exceed a null. A thing
// BECOMES a span only where the ground FAILS — ⑦ DEF · Atmosphere · Clearing
// — and, after enough consecutive failures, ⑨ REC re-zeros and the span is
// closed. That is the only assertion of extent this engine has, and it is what
// the earlier ladder and the first helix draft both skipped: they objectified
// POINTS upward instead of SPANS.
//
// Superposition is held at the span level, the same way it is held at the
// figure level. runTurn (the canonical DEF/EVA/REC loop) is run once per
// perturbation family. The two runs rarely re-zero at the same index, so:
//
//   BOTH re-zero within `tolerance`  → a DEFINITE span. The ground failed under
//     two structurally different readings of noise. This is the collapse.
//   ONE re-zeros                     → a LIVE boundary. Kept, not dismissed
//     (SEED.md #6: censored differences are kept).
//
// Each definite span is then objectified — turned into ONE number, how far the
// span moved the ground beyond what reseeding alone does (displacement ÷
// reseed-null) — and those numbers become the material of the next turn. The
// same measurement, one grain up. That is the helix: measure → collapse →
// objectify → re-enter, until nothing fails anymore.
//
// The first span whose `before` is too short to ground is received, not
// derived (SEED.md #1): it is asserted but does not objectify.
//
// Each turn is a higher grain and DECLARES its own reach, exactly as tiers.js
// declares gamma per tier, never defaulted.
//
// Control: the ENTIRE helix rerun on order-destroyed material (shuffleControl).
// If depth and span counts survive shuffling, the reading is arithmetic.

import { readFileSync } from "node:fs";
import { splitSentences, stripContainer } from "../packages/engine/perceiver/text/spans.js";
import { ground, pattern, isGap, keep, objectify } from "../nul/index.js";
import { runTurn } from "../packages/engine/loops/turn.js";
import { shuffleControl } from "./lib/surrogates.mjs";

// ── declared, never defaulted ───────────────────────────────────────────────
const DRAWS = 128;    // resolution of testimony: finest rank sayable is 1/draws
const RESEEDS = 16;   // resolution of pattern
const MAX_TURNS = 5;  // how many times the loop is allowed to come around

// Each turn of the helix is a HIGHER GRAIN, and a grain declares its own reach
// — exactly as tiers.js declares gamma per tier. The raw book is measured with
// a wide reach, the rarer event-streams with a narrow one.
const TURN_REACH = [
  { window: 12, history: 48, tolerance: 3 }, // turn 0 — the raw book (~3400 units)
  { window: 6, history: 12, tolerance: 3 },  // turn 1 — the objectified spans
  { window: 4, history: 8, tolerance: 2 },   // turn 2 — second-order spans
  { window: 3, history: 6, tolerance: 2 },   // turn 3
  { window: 2, history: 4, tolerance: 2 },   // turn 4
];

const FAMILIES = ["shuffle", "resample"];
const CONTROL_RUNS = 3;

const WORD_RE = /[\p{L}\p{N}']+/gu;
const words = (t) => String(t ?? "").toLowerCase().match(WORD_RE) ?? [];

const TEXT_PATH = process.argv[2] || "scripts/adversarial/fixtures/pg84-frankenstein.txt";
const { text } = stripContainer(readFileSync(TEXT_PATH, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
const sentences = splitSentences(text);

const material = [];
const sentenceOf = []; // material index → sentence index
for (let i = 0; i < sentences.length; i++) {
  const ws = words(sentences[i].text);
  if (ws.length === 0) continue;
  material.push(ws.length);
  sentenceOf.push(i);
}

// ── one turn of the helix ───────────────────────────────────────────────────
// Run runTurn per family, merge the REC boundaries into definite spans and
// live boundaries, and objectify each definite span into the next material.
const readTurn = (material, origins, { window, history, tolerance }) => {
  const turns = FAMILIES.map((perturbation) =>
    runTurn({ material, window, draws: DRAWS, reseeds: RESEEDS, tolerance, seed: 0, perturbation }),
  );
  if (turns.some(isGap)) return { spans: [], live: [], excesses: [], excessOrigins: [] };

  const boundaries = turns.map((t) => t.events.filter((e) => e.op === "REC").map((e) => e.at));

  // ── merge: a definite boundary is where BOTH families re-zeroed ───────────
  const used = new Set();
  const definite = [];
  for (const x of boundaries[0]) {
    let best = null;
    for (let j = 0; j < boundaries[1].length; j++) {
      if (used.has(j)) continue;
      const d = Math.abs(boundaries[1][j] - x);
      if (d <= tolerance && (!best || d < best.d)) best = { j, d };
    }
    if (best) { used.add(best.j); definite.push({ at: x, delta: best.d }); }
  }
  const inDefinite = (x) => definite.some((m) => Math.abs(m.at - x) <= tolerance);
  const live = [
    ...boundaries[0].filter((x) => !inDefinite(x)),
    ...boundaries[1].filter((x, j) => !used.has(j)),
  ].sort((a, b) => a - b);

  // ── objectify each definite span ──────────────────────────────────────────
  const spans = [];
  const excesses = [];
  const excessOrigins = [];
  let prev = 0;
  for (const bnd of definite) {
    const start = prev;
    const end = bnd.at;
    prev = bnd.at;
    if (end - start < 1) continue;

    let peak = start;
    for (let j = start + 1; j < end; j++)
      if (material[j] > material[peak]) peak = j;
    const origin = origins[peak];

    // the span's `before`: enough past material to grow a ground from.
    // A span whose before is too short is RECEIVED, not derived (SEED.md #1):
    // it is asserted — both grounds failed it — but it does not objectify.
    const before = material.slice(Math.max(0, start - history), start);
    const span = { start, end, asserted: true, origin, moved: null, opened: null, excess: null };
    if (before.length < window + 2) { spans.push(span); continue; }

    const gBefore = ground({ material: before, draws: DRAWS, window, seed: 0, perturbation: "shuffle" });
    if (isGap(gBefore)) { spans.push(span); continue; }
    const afterSlice = material.slice(Math.max(0, start - history), Math.min(material.length, end + window));
    const gAfter = ground({ material: afterSlice, draws: DRAWS, window, seed: 0, perturbation: "shuffle" });
    if (isGap(gAfter)) { spans.push(span); continue; }

    const p = pattern({ before: gBefore, after: gAfter, material: before, reseeds: RESEEDS });
    if (isGap(p)) { spans.push(span); continue; }
    span.moved = p.moved;
    span.opened = p.opened;

    const record = {
      ground: keep(gBefore),
      figure: { observed: 0, note: "span-level objectification" },
      pattern: p,
    };
    const obj = p.moved && p.reseedNull > 0 ? objectify(record) : null;
    if (obj && !isGap(obj)) {
      span.excess = obj.value;
      excesses.push(obj.value);
      excessOrigins.push(origin);
    }
    spans.push(span);
  }

  return { spans, live, excesses, excessOrigins, clearings: turns.map((t) => t.clearings) };
};

// ── the whole helix ─────────────────────────────────────────────────────────
const runHelix = (material, origins) => {
  const turns = [];
  let current = material;
  let currentOrigins = origins;
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const reach = TURN_REACH[turn];
    if (!reach || current.length < reach.window + 2) break;
    const { spans, live, excesses, excessOrigins, clearings } = readTurn(current, currentOrigins, reach);
    turns.push({
      turn,
      n: current.length,
      spans: spans.length,
      moved: spans.filter((s) => s.moved === true).length,
      opened: spans.filter((s) => s.opened === true).length,
      objectified: excesses.length,
      liveBoundaries: live.length,
      clearings,
    });
    if (turn === 0 && spans.length) turns[turns.length - 1].spanTable = spans;
    if (excesses.length < 2) break; // not enough material to objectify a next turn
    current = excesses;
    currentOrigins = excessOrigins;
  }
  return { turns, depth: turns.length, totalSpans: turns.reduce((a, t) => a + t.spans, 0) };
};

// ── run real + control ──────────────────────────────────────────────────────
const result = runHelix(material, sentenceOf);
const control = shuffleControl(material, (s) => runHelix(s, sentenceOf.slice()), CONTROL_RUNS, 73);
const controlDepth = control.reduce((a, c) => a + c.depth, 0) / CONTROL_RUNS;
const controlSpans = control.reduce((a, c) => a + c.totalSpans, 0) / CONTROL_RUNS;

// ── output ──────────────────────────────────────────────────────────────────
console.log(`HELIX ${TEXT_PATH.split("/").pop()} — ${sentences.length} sentences → ${material.length} material units`);
console.log(`declared: draws ${DRAWS}, reseeds ${RESEEDS}, max turns ${MAX_TURNS}`);
console.log(`control (${CONTROL_RUNS} full helical reads on order-destroyed material): depth ${controlDepth.toFixed(1)}, spans ${controlSpans.toFixed(1)}\n`);

const shown = (sIdx) => {
  const t = sentences[sIdx].text.replace(/\s+/g, " ").trim();
  return t.length > 180 ? t.slice(0, 180).replace(/\s+\S*$/, "") + "…" : t;
};
const pct = (sIdx) => ((sentences[sIdx].offset / text.length) * 100).toFixed(1);

for (const t of result.turns) {
  console.log(`TURN ${t.turn} — ${t.n} material units`);
  console.log(`  DEF-asserted spans ${t.spans}  (moved the ground ${t.moved}, encounters ${t.opened})  objectified ${t.objectified}`);
  console.log(`  live boundaries ${t.liveBoundaries}  clearings per family ${t.clearings.join("/")}`);
  console.log("");
  if (t.spanTable) {
    for (const s of t.spanTable) {
      const first = shown(sentenceOf[Math.max(s.start, 0)]);
      const last = shown(sentenceOf[Math.min(s.end - 1, sentenceOf.length - 1)]);
      const where = `units ${s.start}–${s.end - 1} (${pct(s.origin)}%)`;
      const verdict = s.excess != null
        ? `EXCESS ${s.excess.toFixed(2)}`
        : s.moved === true
          ? "moved the ground (no excess)"
          : "cleared by surfeit only";
      console.log(`  ${where}  [${verdict}]`);
      console.log(`    ${first}`);
      console.log(`    ${last}`);
      console.log("");
    }
  }
}
console.log(`helix depth: ${result.depth} turns (control ${controlDepth.toFixed(1)})`);
console.log(`total DEF-asserted spans: ${result.totalSpans} (control ${controlSpans.toFixed(1)})`);
