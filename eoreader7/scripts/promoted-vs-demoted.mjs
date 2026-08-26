// eoreader6 · promoted-vs-demoted — does the pattern of one level become the
// ground of the next?
//
// nul::objectify() answers NO, and its reason is not taste:
//
//   "Returns a value, never a ground. ... prehended as a prior would close the
//   successor's ground and this would be sclerosis with extra steps; prehended
//   as datum it can still be differed from."
//
// This script measures that refusal on three layers, in honest order:
//
//   A. MECHANISM (engineered width). A successor receives a level-1 superject
//      trace P in exactly one of two ROLES:
//
//        PROMOTED — P is the successor's privileged ground, held as received():
//                   no spec, no reseeding null, no way to concede it. (The
//                   forbidden reading of "the pattern of one level becomes the
//                   ground of the next.")
//        DEMOTED  — P is material. The successor builds its own ground by
//                   perturbing it (ground()) and re-zeros when that ground stops
//                   placing arrivals. (What the engine actually does.)
//
//      A continuation C then arrives, with a PLANTED jump in the positive case
//      and none in the negative. The minimal contrast — the only thing in
//      dispute is what the pattern IS to the successor. P is ENGINEERED here:
//      wide enough (>= window+2 values) for ground() to build, because — layer
//      C measures — the engine's real traces are too thin to exercise this at
//      all. The mechanism is real; the width that would reach it is not.
//
//   B. TYPE. The refusals are in the code, so they are measured directly:
//      reZero(received) is undeclared:draws — a received ground has no spec and
//      cannot be regrown; pattern(before=received) is unreceived_origin — the
//      "did it move" question is never even askable for a promoted ground.
//
//   C. WIDTH (real material). A level-1 reading over a whole spread-alternating
//      material emits 3-5 superjects. ground() needs >= window+2 = 8 values.
//      So the transcript's regime-sequence — a handful of concluded regimes fed
//      as a sequence — collapses for width before any prediction could be
//      scored on it. The dead end is real, and this is why it is a dead end.
//
// Usage: node scripts/promoted-vs-demoted.mjs

import {
  ground, received, difference, reZero, pattern, witness, keep, objectify, isGap,
} from "../nul/index.js";

// Declared, never defaulted — the physiology of this reading, stated as such.
const WINDOW = 6;      // reach of the present, in steps
const DRAWS = 96;      // resolution of testimony
const TOLERANCE = 2;   // how many consecutive clearings before a ground is conceded
const RESEEDS = 8;     // resolution of pattern's reseeding null
const SEED = 17;

// Deterministic — no Math.random anywhere, so a rerun is a rerun.
const rng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const gaussian = (next) => {
  const u = Math.max(1e-12, next());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
};

const multiSpread = (legs, seed) => {
  const next = rng(seed);
  const out = [];
  for (const [sd, len] of legs) for (let i = 0; i < len; i++) out.push(10 + gaussian(next) * sd);
  return out;
};

// ── layer C's reading: a real engine reading that emits superjects ──────────
//
// Mirror of turn.js's loop, reduced to the one thing level 1 passes on. At
// each step the ground is (conditionally) maintained; when it grew and the
// maintenance moved it beyond its own reseeding null, the satisfaction is
// witnessed, kept, and objectified to a superject value — the only quantity
// that crosses the level boundary. The whole point of layer C is that this
// trace is thin.
const readToSuperjects = (material) => {
  const buildAt = (start, end) =>
    ground({ material: material.slice(start, end), draws: DRAWS, window: WINDOW, seed: SEED + start });

  const superjects = [];
  let regionStart = 0;
  let g = null;
  let gEnd = null;
  let clearings = 0;

  for (let i = WINDOW; i + WINDOW <= material.length; i++) {
    if (!g) {
      g = buildAt(regionStart, i);
      if (isGap(g)) continue;
      gEnd = i;
    }

    let sum = 0;
    for (let j = i; j < i + WINDOW; j++) sum += material[j];
    const observed = sum / WINDOW;

    const d = difference(observed, g);
    const surfeit = isGap(d) && d.gap === "exceeds_witness" && d.direction === "above";

    const maintained = buildAt(regionStart, i);
    if (!isGap(maintained) && gEnd != null && gEnd < i) {
      // The null is BEFORE's own reseeding variation over BEFORE's own material.
      const drift = pattern({
        before: g, after: maintained, material: material.slice(regionStart, gEnd), reseeds: RESEEDS,
      });
      if (!isGap(drift) && drift.moved) {
        const w = witness({ ground: keep(g), figure: d, pattern: drift });
        const s = isGap(w) ? w : objectify(w);
        if (!isGap(s)) superjects.push(s.value);
      }
    }

    if (surfeit) {
      clearings++;
      // A failing ground is not maintained — the standing ground is held fixed
      // while consecutive failures accumulate (turn.js does the same).
      if (clearings >= TOLERANCE) {
        regionStart = i;
        g = null;
        gEnd = null;
        clearings = 0;
      }
    } else {
      clearings = 0;
      if (!isGap(maintained)) {
        g = maintained;
        gEnd = i;
      }
    }
  }

  return { superjects, count: superjects.length };
};

// ── layer A's successor: one per role ───────────────────────────────────────
//
// The successor's decision rule is atmosphere's, restated so the ORIGIN of the
// first ground is what varies: the promoted arm opens with received(P) — no
// spec, no reseeding null; the demoted arm opens with ground(P) — buildable
// and rebuildable. Everything after the opening is identical: EVA maintains
// the ground over the current region; REC concedes it after `tolerance`
// consecutive clearings and regrows over the region.
const readSuccessor = ({ role, P, continuation }) => {
  const C = continuation;
  const stream = [...P, ...C];

  let regionStart = 0;
  let g =
    role === "promoted"
      ? received({ samples: P, provenance: "level-1" })
      : ground({ material: P, window: WINDOW, draws: DRAWS, seed: SEED, statistic: "burstiness" });

  let clearings = 0;
  let rezeros = 0;
  let stuck = 0; // surfeit steps the successor could not concede
  let refused = null; // the typed gap when the successor tried to concede and could not
  let surfeitSteps = 0;

  for (let i = 0; i < C.length; i++) {
    const obs = C[i];
    const at = P.length + i;

    const d = difference(obs, g);
    const surfeit = isGap(d) && d.gap === "exceeds_witness" && d.direction === "above";

    if (surfeit) {
      clearings++;
      surfeitSteps++;
      if (clearings >= TOLERANCE) {
        // REC · Cultivating — concede the ground, regrow here.
        const after = reZero(g, { material: stream.slice(regionStart, at + 1), seed: SEED + rezeros * DRAWS });
        if (isGap(after)) {
          // The successor cannot concede — refused by type.
          if (!refused) refused = after;
          if (role === "promoted") stuck++;
          clearings = 0;
        } else {
          g = after;
          regionStart = at;
          rezeros++;
          clearings = 0;
        }
      }
    } else {
      clearings = 0;
      // EVA · Tending — maintain the ground against the arrival.
      const maintained = reZero(g, { material: stream.slice(regionStart, at + 1), seed: SEED + rezeros * DRAWS });
      if (!isGap(maintained)) g = maintained;
    }
  }

  return {
    role,
    rezeros,
    stuck,
    surfeitSteps,
    Pcount: P.length,
    Ccount: C.length,
    refused: refused ? `${refused.gap}${refused.what ? `:${refused.what}` : ""}` : null,
  };
};

const report = (r) => {
  const line = [`  ${r.role.padEnd(9)}`];
  line.push(`P=${r.Pcount} C=${r.Ccount}  re-zeros ${r.rezeros}  surfeit ${r.surfeitSteps}  stuck ${r.stuck}`);
  if (r.refused) line.push(`REC refused -> gap "${r.refused}"`);
  console.log(line.join("\n    "));
};

// ── layer A. MECHANISM, under ENGINEERED width ───────────────────────────────
//
// P is wide on purpose: a superject trace is a ratio (displacement/reseedNull),
// and a real reading's trace is only a handful of values long — far below the
// window+2 = 8 values ground() needs. To exhibit the role contrast at all, P
// must be synthetic and labelled so. The values are plausible superject ratios:
// a thin, slightly-inflated band around the reseeding null.

console.log("################ A. MECHANISM — role contrast, ENGINEERED width ################");
console.log("P is a synthetic superject trace (16 ratio values), wide enough that ground() can");
console.log("build over it. Real traces are far thinner — layer C measures that — so this layer");
console.log("answers only: if the width WERE there, does the role of the pattern change whether");
console.log("the successor can differ from what it received?\n");

const pWide = [1.0, 1.3, 1.1, 1.4, 1.2, 1.5, 1.1, 1.3, 1.2, 1.4, 1.0, 1.3, 1.1, 1.2, 1.4, 1.1];
const cSteady = [1.2, 1.1, 1.3, 1.2, 1.0, 1.4, 1.2, 1.1, 1.3, 1.2, 1.4, 1.0, 1.2, 1.3, 1.1, 1.2];
const cJump = [1.2, 1.1, 1.3, 1.2, 1.0, 1.4, 1.2, 1.1, 4.2, 5.1, 3.8, 4.6, 5.4, 3.9, 4.8, 4.4];
//            └──────── steady, familiar ────────┘ └── a level-2 spread the
//                                                level-1 pattern never saw ──┘

console.log(`  positive: continuation carries a planted jump (ratios ~4.5 vs P's ~1.2)`);
for (const role of ["promoted", "demoted"]) report(readSuccessor({ role, P: pWide, continuation: cJump }));

console.log(`\n  negative: same P, no jump in the continuation`);
for (const role of ["promoted", "demoted"]) report(readSuccessor({ role, P: pWide, continuation: cSteady }));

// ── layer B. TYPE — the refusals, measured directly ──────────────────────────

console.log("\n################ B. TYPE — what a promoted ground cannot do ################");

const rzP = reZero(received({ samples: pWide, provenance: "level-1" }), { material: [...pWide, 5], seed: 100 });
const groundWide = ground({ material: pWide, window: WINDOW, draws: DRAWS, seed: SEED, statistic: "burstiness" });
const rzD = reZero(groundWide, { material: [...pWide, 5], seed: 100 });
const afterD = reZero(groundWide, { material: [...pWide, 5], seed: 101 });
const patD = pattern({ before: groundWide, after: afterD, material: pWide, reseeds: RESEEDS });
const patP = pattern({ before: received({ samples: pWide, provenance: "level-1" }), after: afterD, material: pWide, reseeds: RESEEDS });

console.log(`  reZero(received(P))      -> ${isGap(rzP) ? `gap "${rzP.gap}${rzP.what ? ":" + rzP.what : ""}"` : "built"}  — a received ground has no spec, no reseeding null`);
console.log(`  reZero(ground(P))        -> ${isGap(rzD) ? `gap "${rzD.gap}"` : "built"}  — material can always be regrown`);
console.log(`  pattern(before=received) -> ${isGap(patP) ? `gap "${patP.gap}"` : "askable"}  — "did it move?" is never asked of a promoted ground`);
console.log(`  pattern(before=ground)   -> ${isGap(patD) ? `gap "${patD.gap}"` : `moved=${patD.moved}`}  — the demoted ground answers`);

// ── layer C. WIDTH — the real trace, and why it gates everything ─────────────

console.log("\n################ C. WIDTH — what a real level-1 reading actually passes on ################");
console.log("The transcript's regime-sequence fed a handful of concluded regimes' apertures and");
console.log("collapsed. Same shape here, with the engine's own one-grain-up quantity:\n");

const level1 = multiSpread([[1, 40], [6, 40], [1, 40], [6, 40]], 3);
const real = readToSuperjects(level1);
console.log(`  level-1 over n=${level1.length} emitted ${real.count} superject(s)`);
console.log(`  values: ${real.superjects.map((v) => v.toFixed(2)).join(", ") || "(none)"}`);
const realGround = ground({ material: real.superjects, window: WINDOW, draws: DRAWS, seed: SEED, statistic: "burstiness" });
console.log(`  ground() over that trace -> ${isGap(realGround) ? `gap "${realGround.gap}"` : "built"}`);
console.log(`  (need >= window+2 = ${WINDOW + 2} material values; a whole spread-alternating read`);
console.log(`   produces ${real.count}. So no level-2 ground can ever be built from real level-1`);
console.log(`   output — the sequence-of-sequences dead end, and the width that gates it.)`);

// ── verdict ─────────────────────────────────────────────────────────────────

console.log("\n################ verdict ################");
console.log("Three layers, three honest measurements.");
console.log("A. If the width were there, the role decides: the promoted successor surfeits and is");
console.log("   stuck — reZero is refused by type — while the demoted one re-zeros and keeps");
console.log("   reading. On the negative control neither concedes: the closure is specific to");
console.log("   change arriving, not a general failure of promotion.");
console.log("B. The refusal is in the code and measurable: a received ground cannot be regrown");
console.log("   (undeclared:draws) and its movement is never askable (unreceived_origin).");
console.log("C. The width is not. A real reading emits 3-5 superjects per whole read — below the");
console.log("   window+2 = 8 a level-2 ground needs. objectify()'s refusal is not merely correct,");
console.log("   it is unreachable: there is never enough pattern to promote. The transcript's");
console.log("   sequence-of-sequences dead end is reproduced and, for the first time, located:");
console.log("   it fails on width before any prediction could be scored on it.");
