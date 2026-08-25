// eoreader6 · scripts/read-dfr-flights — read a police DFR (drone-as-first-
// responder) program's public flight feed with the engine's own organs.
//
// The question, per city: what KINDS of flights does this program fly (are
// non-call-indexed kinds — planned operations, officer-initiated, overwatch —
// real kinds or just labels), and which flights belong to one MATTER (one
// real-world situation minting several CAD numbers / several flights).
//
// Organs used, per CLAUDE.md's search-first rule:
//   emergence/kinds.js::induceKinds     — flight-kind induction, its own
//                                         permutation-null gates throughout
//   emergence/binding.js::displacementNull — same-matter co-arrival test over
//                                         the program's own flight-order
//                                         positions (the reading's reach
//                                         units), exactly as bindLinks reads
//                                         co-arrival in a text
//
// What is deliberately NOT an organ call: medians, calendars, endpoint
// clustering — descriptive arithmetic, no significance claimed.
//
// THE FOLD'S OWN LIMIT, DISCLOSED (II.21, and the seam Alexander watches):
// induction runs SIDEWAYS first — once per local calendar week — and only the
// kinds a week certifies are reified and folded upward. This is NOT equivalent
// to inducing over the whole population: a DIFFUSE kind (say two flights a
// week for a year, cohering only in aggregate) is certified by no single week,
// is therefore never reified, and CANNOT appear at any altitude. What the
// ladder finds is "kinds a single week certified" — and, at the level above,
// kinds OF THOSE WEEK-KINDS. It is never "kinds of the year."
//
// A prior version of this paragraph said the ladder finds week-kinds "that
// recur across weeks." That was itself an unmeasured claim and is withdrawn:
// `reify` (jati.js) carries a week-kind's members and attributes but no week
// identity, so the upper induction cannot see which weeks its records came
// from, and nothing anywhere measures recurrence. Two week-kinds with the same
// label in the artifact are two independent certifications that happen to
// share a label — read them that way. (The per-label counts reported in the
// artifact are descriptive tallies over `week_level`, with no null and no
// significance claimed.)
//
// The gain is that this runs at all (flat induction on 8,823 records did not
// finish; folded, 11.5 min), and every altitude keeps its way back down
// (members are carried at every level, below). The loss is real and is named
// here rather than left for a reader to discover.
//
// Known defect, declared: displacementNull builds its pool EXCLUDING A's
// occupied positions (binding.js line ~152), the same restricted-pool shape
// shown to inflate reversalNull's false-positive rate 2-3x (null-first
// measurement paper §5, 2026-08-15). Every established pair is therefore
// cross-checked against an unrestricted-pool variant, labeled as the paper's
// corrected pool; a pair is only reported established if BOTH agree.
//
// SELECTION IS AN AXIS (II.10, 2nd consequence) — found by the Chorus, fixed.
// E2 candidates are screened on co-arrival within WINDOW, which is EXACTLY the
// statistic displacementNull then tests, so every candidate reaching the null
// has observed >= 1 BY CONSTRUCTION while an unconditional null's draws do
// not. That is a best-of-n observation placed against a drawn-at-random null,
// and it inflates significance. The null must undergo what the observation
// underwent, so the p-value used here is CONDITIONAL on the screen:
//
//     p = |{draws : count >= observed}| / |{draws : count >= 1}|
//
// computed from the null's own returned samples. This is weakly conservative
// relative to the raw p (the denominator can only shrink), which is why the
// zero-established result below survives the correction rather than depending
// on it. Both raw and conditional p are reported so the gap is visible.
//
// THE CENSORING FLOOR, AND WHAT THE BAR ACTUALLY IS. With DRAWS = 199 the
// smallest non-zero p is 1/199 ≈ 0.0050, so `expected = p * n_candidates`
// (n_candidates ≈ 180-240) cannot fall below ALPHA = 0.05 for ANY non-zero p.
// The operative test is therefore binary — "did zero of 199 draws meet or beat
// the observation" — and the multiplicity arithmetic, while correctly
// computed, never binds. Saying so plainly is the point: a p reported as 0 is
// censored at < 1/draws, never a measured zero, and `expected_null_count` must
// not be read as a calibrated family-wise rate. Raising DRAWS is the real fix
// and is deliberately NOT done here, because choosing a draw count by what it
// does to these verdicts is the tuning CLAUDE.md forbids; it needs a power
// argument made independently of this data.
//
// Declared numbers (never tuned against results):
//   induceKinds opts   — the same declared set scripts/read-kinds-networked.mjs
//                        uses: minPrevalence .25, minKindSize 3,
//                        permutations 200, quantile .95, seed 42, reseeds 24
//   draws 199, seed 42 — binding family convention in this repo
//   E2 window          — MEASURED from the ground-truth-positive class: the
//                        p95 of flight-order gaps among same-citation
//                        (relaunch) pairs in this same feed. Not hand-set.
//   CAD-like citation  — >= 6 digits after splitting on , / ; ("TEST",
//                        "TRNG" purpose-words chain unrelated test flights
//                        into one fake matter otherwise; measured on LAPD:
//                        56,518 spurious shared-citation pairs).
//   launch exclusion   — each flight excludes its OWN endpoint cell of highest
//                        global frequency (its launch/return point), PLUS
//                        everything within DOCK_EXCL_KM of it. An earlier
//                        header claimed this rule had "ZERO tuned constants";
//                        that was FALSE and is corrected here — the 150 m
//                        radius, the 45 m and 150 m grids, and launch_sites'
//                        2%/top-8 display bar are all hand-set, and the
//                        "a shared destination can never be swallowed"
//                        guarantee does NOT hold inside the radius: a
//                        destination within 150 m of a flight's own dock is
//                        invisible to that flight. None of these values was
//                        selected by checking its effect on a result, but
//                        unmeasured is not the same as zero, and the
//                        distinction is the whole of CLAUDE.md's rule. Treat
//                        every one as calibrated-by-inspection, not measured.
//                        (A first draft ALSO excluded all endpoint cells
//                        >= 0.5% share globally; on a 315-flight feed that
//                        made 47 "launch sites" and risked blinding real
//                        repeat destinations. Withdrawn.)
//                        Reported launch_sites are descriptive only, and are
//                        a truncated top-8 view, never the program's site set.
//
// Usage: node scripts/read-dfr-flights.mjs <feed.jsonl> <label> <IANA-tz> <outdir>

import { readFileSync, writeFileSync } from "node:fs";
import { induceKinds } from "../packages/engine/emergence/kinds.js";
import { foldHolons, reify } from "../packages/engine/emergence/jati.js";
import { displacementNull, shuffle } from "../packages/engine/emergence/binding.js";

const [feedPath, label, tzName, outdir] = process.argv.slice(2);
if (!feedPath || !label || !tzName || !outdir) {
  console.error("usage: node scripts/read-dfr-flights.mjs <feed.jsonl> <label> <tz> <outdir>");
  process.exit(1);
}

const CELL = 0.0004;   // ~45 m — endpoint/launch grid (matches the feed reducer)
const LOC = 0.0013;    // ~150 m — property-scale destination grid
const DOCK_EXCL_KM = 0.15;
const OPTS = { minPrevalence: 0.25, minKindSize: 3, permutations: 200, quantile: 0.95, seed: 42, reseeds: 24 };
const DRAWS = 199;
const SEED = 42;
const ALPHA = 0.05;

const kmDist = (la1, lo1, la2, lo2) => {
  const R = 6371.0;
  const dl = ((la2 - la1) * Math.PI) / 180;
  const dn = ((lo2 - lo1) * Math.PI) / 180;
  const a = Math.sin(dl / 2) ** 2 +
    Math.cos((la1 * Math.PI) / 180) * Math.cos((la2 * Math.PI) / 180) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

// ── load the reduced feed ───────────────────────────────────────────────────
const flights = readFileSync(feedPath, "utf8").split("\n").filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((r) => r.takeoff && r.landing)
  .sort((a, b) => a.takeoff - b.takeoff);
console.log(`[${label}] ${flights.length} flights`);

// ── launch sites: endpoint cells >= 0.5% share, merged under 200 m ──────────
const epc = new Map();
let epTotal = 0;
for (const r of flights)
  for (const [lat, lon] of r.endpoints) {
    const k = `${Math.round(lat / CELL)},${Math.round(lon / CELL)}`;
    epc.set(k, (epc.get(k) ?? 0) + 1);
    epTotal++;
  }
const sites = [];
for (const [k, n] of [...epc.entries()].sort((a, b) => b[1] - a[1])) {
  const [ci, cj] = k.split(",").map(Number);
  const lat = ci * CELL, lon = cj * CELL;
  const home = sites.find((s) => kmDist(lat, lon, s.lat, s.lon) < 0.2);
  if (home) home.n += n;
  else sites.push({ lat, lon, n });
}
// DISPLAY ONLY, and truncated — never "the program's launch sites" (II.17: a
// selection presented as the whole state is refused). The 2% bar and the top-8
// cap are hand-set for legibility, they gate nothing downstream (per-flight
// exclusion uses each flight's own home cell, not this list), and both the bar
// and the count of sites above it are carried in the artifact so the
// truncation is visible rather than implied.
const LAUNCH_DISPLAY_BAR = 0.02;
const LAUNCH_DISPLAY_CAP = 8;
const sitesAboveBar = sites.filter((s) => s.n / epTotal >= LAUNCH_DISPLAY_BAR);
const launchSites = sitesAboveBar.slice(0, LAUNCH_DISPLAY_CAP)
  .map((s) => ({ lat: s.lat, lon: s.lon, share: +(s.n / epTotal).toFixed(4) }));
console.log(`[${label}] ${launchSites.length} of ${sitesAboveBar.length} site(s) above the ${LAUNCH_DISPLAY_BAR * 100}% display bar (descriptive only, truncated)`);

// ── per-flight destination: densest cell clear of the flight's OWN home ─────
// (home = its endpoint cell with the highest global endpoint frequency)
const tzHour = new Intl.DateTimeFormat("en-US", { timeZone: tzName, hour: "numeric", hour12: false });
const tzWeekday = new Intl.DateTimeFormat("en-US", { timeZone: tzName, weekday: "short" });
for (const r of flights) {
  let home = null, homeFreq = -1;
  for (const [lat, lon] of r.endpoints) {
    const f = epc.get(`${Math.round(lat / CELL)},${Math.round(lon / CELL)}`) ?? 0;
    if (f > homeFreq) { home = [lat, lon]; homeFreq = f; }
  }
  let best = null, bestN = 0;
  for (const [ci, cj, n] of r.cells) {
    const lat = ci * CELL, lon = cj * CELL;
    if (home && kmDist(lat, lon, home[0], home[1]) <= DOCK_EXCL_KM) continue;
    if (n > bestN) { best = [lat, lon]; bestN = n; }
  }
  r._dest = best;
  r._distKm = best && home ? kmDist(best[0], best[1], home[0], home[1]) : null;
  const d = new Date(r.takeoff);
  r._hour = Number(tzHour.format(d));
  r._weekday = tzWeekday.format(d);
  r._durMin = (r.landing - r.takeoff) / 60000;
}

// ── citations: CAD-like tokens only (declared: >= 6 digits) ─────────────────
// Identity is EXACT STRING after trim/split. Two spellings of one case number
// ("24-123456" vs "2024-123456") read as two citations and SPLIT a matter that
// is really one. Normalizing spellings would derive who-denotes-what from
// surface shape, which II.2 refuses, so the split is left standing.
//
// CORRECTION — an earlier version of this note claimed the error "never merges
// two real matters into one." That is FALSE and the Chorus was right to catch
// it: E1 unions every flight sharing a literal >=6-digit token with no null and
// no refusal, so any non-identifying token that happens to carry six digits
// (a unit number, a date-like string, a padded sequence) merges every flight
// citing it into one matter. The >=6-digit gate is itself a surface-shape
// heuristic standing in for a giver-supplied identity claim — it narrows that
// exposure, it does not remove it. `e1_suspect_citations` below reports any
// citation carried by an implausible number of distinct flights so the
// exposure is visible per city rather than assumed away.
const citationsOf = (r) => {
  const raw = (r.external_id ?? "").trim();
  if (!raw) return [];
  return raw.split(/[,/;]/).map((s) => s.trim())
    .filter((s) => (s.match(/[0-9]/g) ?? []).length >= 6);
};

// ═══ A. FLIGHT-KIND INDUCTION — holonic, the fold used correctly ═══════════
// Induction cost is quadratic in a level's population, so the fold goes
// SIDEWAYS first: partition into the program's own natural sub-wholes —
// calendar weeks, the granularity the schedule analysis shows programs
// actually operate at — induce within each week (small, cheap, parallelable),
// reify each week's certified kinds into holon records, then fold the union
// UPWARD with foldHolons. Full populations run whole; no subsample needed.
const kindFlights = flights;
// NO identity-grained fields in the kind vocabulary. A 150 m dest cell is an
// IDENTITY (nearly one value per record), not a TYPE: it can never clear
// minPrevalence, but the engine still pays to measure and refuse hundreds of
// junk parameters against 200 permutations each — a first draft fed dest_cell
// in and turned a 1-minute induction into an unbounded one. Place recurrence
// is the arrival-stream arm's question (below), never the kind vocabulary's.
const records = kindFlights.map((r) => Object.freeze({
  id: r.flight_id,
  attributes: Object.freeze([
    Object.freeze({ field_id: "purpose", value_type: "categorical", value: (r.flight_purpose ?? "unlogged").trim().toLowerCase(), count: 1 }),
    Object.freeze({ field_id: "weekday", value_type: "categorical", value: r._weekday, count: 1 }),
    Object.freeze({ field_id: "cited", value_type: "categorical", value: citationsOf(r).length ? "cad" : ((r.external_id ?? "").trim() ? "non-cad" : "none"), count: 1 }),
    // NO `hour` FIELD — found by the Chorus. Hour-of-day is CIRCULAR and this
    // value algebra has no circular kernel (values.js VALUE_TYPES: boolean,
    // categorical, ordinal, numeric, vector). Read as `numeric` its kernel is
    // linear |a-b|/IQR, so 23:00 and 00:00 — one hour apart — read as maximally
    // distant, and jati.js's `reify` takes the MEAN, so a week of flights
    // straddling midnight reifies to a midday value no member is near: content
    // that exists at altitude and nowhere below it (II.21). That distortion is
    // live for exactly the 24/7 programs in this panel. A missing kernel is a
    // typed gap, not a licence to use the wrong one (II.5, III.3), so the field
    // is withheld rather than misread. Schedule structure is still carried by
    // `weekday`, and the descriptive hour histogram is reported outside the
    // induction where no kernel is claimed.
    Object.freeze({ field_id: "duration_min", value_type: "numeric", value: +r._durMin.toFixed(1), count: 1 }),
    ...(r._distKm != null ? [Object.freeze({ field_id: "dist_km", value_type: "numeric", value: +r._distKm.toFixed(2), count: 1 })] : []),
  ]),
}));
// sideways: one induction per local calendar week
const weekOf = (r) => {
  const d = new Date(r.takeoff);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: tzName, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const dt = new Date(day + "T00:00:00Z");
  const monday = new Date(dt);
  monday.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
};
const byWeek = new Map();
kindFlights.forEach((r, i) => {
  const w = weekOf(r);
  if (!byWeek.has(w)) byWeek.set(w, []);
  byWeek.get(w).push(records[i]);
});
console.log(`[${label}] folding: ${records.length} records across ${byWeek.size} week(s)…`);
const t0 = Date.now();
const weekLadder = [];
let unfolded = 0;
const reifiedUnion = [];
for (const [wk, recs] of [...byWeek.entries()].sort()) {
  if (recs.length < OPTS.minKindSize) { unfolded += recs.length; continue; }
  const wkKinds = induceKinds(recs, { population: `${label}-wk-${wk}`, ...OPTS });
  weekLadder.push({ week: wk, n: recs.length, kinds: wkKinds });
  reifiedUnion.push(...reify(wkKinds, recs));
}
console.log(`[${label}] week level: ${weekLadder.reduce((s, w) => s + w.kinds.length, 0)} kind(s) across ${weekLadder.length} week(s), ${unfolded} record(s) in weeks below minKindSize (reported, not dropped) — ${((Date.now() - t0) / 60000).toFixed(1)} min`);

// upward: the ladder over the reified week-kinds
const fold = reifiedUnion.length >= OPTS.minKindSize
  ? foldHolons(reifiedUnion, { population: `${label}-dfr-weekkinds`, levels: 2, ...OPTS })
  : { ladder: [], halted: { at: 0, reason: `only ${reifiedUnion.length} reified week-kind(s) — below minKindSize` } };
const kinds = fold.ladder.length ? fold.ladder[0].kinds : [];
console.log(`[${label}] fold up: ${fold.ladder.map((l) => `L${l.level + 1}:${l.kinds.length} kinds/${l.records.length} recs`).join("  ")}${fold.halted ? `  (halted: ${fold.halted.reason})` : ""} — total ${((Date.now() - t0) / 60000).toFixed(1)} min`);

// ═══ B. MATTERS — E1 shared CAD citation; E2 displacementNull co-arrival ════
// Positions are the program's own flight order (the reading's reach units).
const byCitation = new Map();
flights.forEach((r, pos) => {
  for (const c of citationsOf(r)) {
    if (!byCitation.has(c)) byCitation.set(c, []);
    byCitation.get(c).push(pos);
  }
});

// E2 window: p95 of same-citation (relaunch) position gaps — measured from
// the feed's own ground-truth-positive class.
const e1Gaps = [];
for (const posns of byCitation.values())
  for (let i = 1; i < posns.length; i++) e1Gaps.push(posns[i] - posns[i - 1]);
e1Gaps.sort((a, b) => a - b);
const WINDOW = e1Gaps.length >= 20 ? Math.max(1, e1Gaps[Math.floor(e1Gaps.length * 0.95)]) : null;
console.log(`[${label}] E1 relaunch pairs: ${e1Gaps.length}; E2 window (p95 of E1 gaps): ${WINDOW ?? "REFUSED — too few relaunches to measure a window"}`);

// Unrestricted-pool cross-check (the paper's corrected pool): identical to
// displacementNull except B may land on A's occupied positions, as the real
// data can.
//
// The shared seed is DELIBERATE and is the II.10 discipline, not a defect: the
// two runs are a matched counterfactual differing in exactly one axis (the
// pool restriction), so they must share draws, window, and arrival streams.
// Do not "fix" this by re-seeding — that would add a second axis and the
// comparison would stop measuring the pool. It is also why the pair is a
// BIAS CHECK and not independent corroboration (Pearl's distinction): both
// read the same two arrival streams and share every cause but the one.
const displacementNullUnrestricted = (aArr, bArr, { window, draws, seed }) => {
  const countOverlap = (xs, ys, w) => {
    let c = 0, j = 0;
    for (const x of xs) {
      while (j < ys.length && ys[j] < x - w) j++;
      for (let k = j; k < ys.length && ys[k] <= x + w; k++) c++;
    }
    return c;
  };
  const observed = countOverlap(aArr, bArr, window);
  const all = [...new Set([...aArr, ...bArr])].sort((a, b) => a - b);
  const lo = all[0], hi = all[all.length - 1];
  const pool = [];
  for (let p = lo; p <= hi; p++) pool.push(p);
  let state = seed | 0;
  const rnd = () => { state = (state * 1664525 + 1013904223) | 0; return (state >>> 0) / 4294967296; };
  const samples = [];
  for (let d = 0; d < draws; d++) {
    const s = pool.slice();
    shuffle(s, rnd);
    const placed = s.slice(0, bArr.length).sort((a, b) => a - b);
    samples.push(countOverlap(aArr, placed, window));
  }
  const atOrAbove = samples.filter((s) => s >= observed).length;
  return { observed, samples, pValue: atOrAbove / draws };
};

/** The screen-matched (conditional) p — II.10's "the null undergoes what the
 *  observation underwent". Candidates were selected for having at least one
 *  co-arrival, so the null is restricted to draws that clear the same screen.
 *  Returns a typed refusal when no draw clears it: with no admissible null
 *  there is no ground, and a ratio over an empty denominator is not a p. */
const conditionalP = (samples, observed) => {
  const admissible = samples.filter((s) => s >= 1);
  if (admissible.length === 0)
    return { p: null, refused: "no null draw cleared the candidate screen — no admissible ground", n_admissible: 0 };
  return {
    p: admissible.filter((s) => s >= observed).length / admissible.length,
    n_admissible: admissible.length,
  };
};

let matters = null;
if (WINDOW != null) {
  // Candidate pairs: distinct citations with flights co-arriving within the
  // window AND destinations in the same/adjacent 150 m cell (declared gate).
  const cellOf = (r) => r._dest ? [Math.round(r._dest[0] / LOC), Math.round(r._dest[1] / LOC)] : null;
  const near = (a, b) => a && b && Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1;
  const cits = [...byCitation.entries()];
  const candidates = [];
  for (let i = 0; i < cits.length; i++) {
    for (let j = i + 1; j < cits.length; j++) {
      const [ca, pa] = cits[i], [cb, pb] = cits[j];
      let coArrive = false;
      for (const x of pa) { if (pb.some((y) => Math.abs(x - y) <= WINDOW)) { coArrive = true; break; } }
      if (!coArrive) continue;
      let spatial = false;
      for (const x of pa) {
        for (const y of pb) {
          if (Math.abs(x - y) <= WINDOW && near(cellOf(flights[x]), cellOf(flights[y]))) { spatial = true; break; }
        }
        if (spatial) break;
      }
      if (spatial) candidates.push([ca, cb, pa, pb]);
    }
  }
  console.log(`[${label}] E2 candidate citation pairs (co-arriving + co-located): ${candidates.length}`);

  // The operative bar, stated once so no reader infers a calibrated rate from
  // `expected_null_count`: p is censored at 1/DRAWS, so `expected < ALPHA` is
  // reachable only at a censored zero (see the header). Both pools must clear
  // it on the SCREEN-MATCHED p. The earlier `corrected <= shipped * 3` slack
  // clause is REMOVED — the Chorus was right that a factor of 3 appeared in no
  // declaration and was answerable to nothing; agreement is now simply that
  // both pools clear the same bar.
  const CENSOR = 1 / DRAWS;
  const results = [];
  for (const [ca, cb, pa, pb] of candidates) {
    // PER-PAIR SEED — found by the Chorus. An earlier version passed the same
    // constant SEED to every candidate, so two pairs with equal pool size and
    // equal |B| received a bit-identical permutation stream and their nulls
    // were perfectly rank-correlated — while the family arithmetic below treats
    // the pair tests as exchangeable independent draws, which is the only
    // reading under which `p * candidates.length` estimates a count. The organ
    // itself varies the seed per pair (binding.js:199, `seed + aArrivals.length`);
    // this now follows that convention. NOTE the distinction from the shared
    // seed BETWEEN the two pool variants of ONE pair, which is deliberate and
    // required (see the header): the seed is constant across the pool axis and
    // varies across pairs.
    const pairSeed = SEED + pa.length + 31 * pb.length;
    const shipped = displacementNull(pa, pb, { window: WINDOW, draws: DRAWS, seed: pairSeed });
    const corrected = displacementNullUnrestricted(pa, pb, { window: WINDOW, draws: DRAWS, seed: pairSeed });
    const shippedCond = conditionalP(shipped.samples, shipped.observed);
    const correctedCond = conditionalP(corrected.samples, corrected.observed);
    const bothMeasurable = shippedCond.p != null && correctedCond.p != null;
    const expected = bothMeasurable ? shippedCond.p * candidates.length : null;
    const expectedCorrected = bothMeasurable ? correctedCond.p * candidates.length : null;
    results.push({
      citations: [ca, cb],
      flights: [pa.length, pb.length],
      observed_coarrivals: shipped.observed,
      // raw (unconditional) p — reported only so the selection effect is visible
      shipped_p_raw: shipped.pValue, corrected_p_raw: corrected.pValue,
      // screen-matched p — the one the verdict uses
      shipped_p_conditional: shippedCond.p, corrected_p_conditional: correctedCond.p,
      p_censored_below: CENSOR,
      n_admissible_null_draws: [shippedCond.n_admissible, correctedCond.n_admissible],
      // BOTH POOLS GOVERN EVERY BOUNDARY — found by Marshall. An earlier
      // version let the corrected pool gate only `matter_established`, while
      // expected_null_count, the ambiguous/independent boundary and the sort
      // were computed from the RESTRICTED pool alone — i.e. every number
      // actually reported about a non-established pair came from the pool the
      // header itself declares defective. The reported expectation is now the
      // more conservative of the two, so the declared defect cannot flatter
      // any verdict, established or not.
      expected_null_count: expected == null ? null : +Math.max(expected, expectedCorrected).toFixed(4),
      expected_null_count_by_pool: expected == null ? null
        : { restricted: +expected.toFixed(4), unrestricted: +expectedCorrected.toFixed(4) },
      verdict: !bothMeasurable
        ? "refused_no_admissible_ground"
        : Math.max(expected, expectedCorrected) < ALPHA
          ? "matter_established"
          : Math.max(expected, expectedCorrected) < 1 ? "matter_ambiguous" : "independent",
      ...(bothMeasurable ? {} : { refused: shippedCond.refused ?? correctedCond.refused }),
    });
  }
  results.sort((a, b) => (a.expected_null_count ?? Infinity) - (b.expected_null_count ?? Infinity));

  // Union-find: E1 always; E2 established only.
  const parent = new Map(flights.map((r) => [r.flight_id, r.flight_id]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const posns of byCitation.values())
    for (let i = 1; i < posns.length; i++) union(flights[posns[0]].flight_id, flights[posns[i]].flight_id);
  for (const r of results.filter((x) => x.verdict === "matter_established")) {
    const [ca, cb] = r.citations;
    union(flights[byCitation.get(ca)[0]].flight_id, flights[byCitation.get(cb)[0]].flight_id);
  }
  const roots = new Map();
  for (const r of flights) { const k = find(r.flight_id); roots.set(k, (roots.get(k) ?? 0) + 1); }
  const sizeDist = {};
  for (const n of roots.values()) sizeDist[n] = (sizeDist[n] ?? 0) + 1;

  // III.3 — found by the Chorus. A flight carrying NO CAD-like citation can
  // never be unioned by either arm, so it necessarily lands in a singleton.
  // Counting those inside `n_matters` silently converts "this flight cannot be
  // grouped, because nothing identifies what it responded to" into "this
  // flight is its own matter" — an unknown reported as a measurement, which is
  // exactly the substitution III.3 refuses. They are separated here, and the
  // groupable subtotal is the only one a reader should compare across cities:
  // for a program like Denver (99.6% uncitable) the unpartitioned count is
  // near-meaningless and now visibly so.
  const uncitable = flights.filter((r) => citationsOf(r).length === 0);
  const uncitableIds = new Set(uncitable.map((r) => r.flight_id));
  const groupableRoots = new Set();
  for (const r of flights) if (!uncitableIds.has(r.flight_id)) groupableRoots.add(find(r.flight_id));

  // E1 exposure, reported not assumed away (see the citationsOf note): how
  // many DISTINCT flights each citation carries. A citation carried by many
  // flights is either a real long-running matter or a non-identifying token
  // that E1 merged unconditionally — this driver cannot tell those apart, so
  // it reports the tail rather than setting a bar to hide it.
  const perCitation = [...byCitation.entries()]
    .map(([c, posns]) => [c, new Set(posns).size])
    .sort((a, b) => b[1] - a[1]);
  const citationSizeDist = {};
  for (const [, n] of perCitation) citationSizeDist[n] = (citationSizeDist[n] ?? 0) + 1;

  matters = {
    window: WINDOW, draws: DRAWS, alpha: ALPHA, p_censored_below: CENSOR,
    e1_flights_per_citation_distribution: citationSizeDist,
    e1_largest_citations: perCitation.slice(0, 5).map(([c, n]) => ({ citation: c, distinct_flights: n })),
    e1_caveat: "E1 unions on a literal shared token with no null; a large group is either one real matter or one non-identifying token, and this driver cannot distinguish them",
    operative_bar: "p is censored at 1/draws, so `expected < alpha` binds only at a censored zero; expected_null_count is not a calibrated family-wise rate",
    p_used: "screen-matched (conditional on the candidate screen); raw p reported alongside",
    n_candidate_pairs: candidates.length,
    established: results.filter((x) => x.verdict === "matter_established"),
    ambiguous: results.filter((x) => x.verdict === "matter_ambiguous").length,
    refused_no_admissible_ground: results.filter((x) => x.verdict === "refused_no_admissible_ground").length,
    n_flights: flights.length,
    n_flights_uncitable: uncitable.length,
    n_matters_among_citable: groupableRoots.size,
    n_partitions_including_uncitable_singletons: roots.size,
    matter_size_distribution: sizeDist,
  };
  console.log(`[${label}] matters: ${flights.length - uncitable.length} citable flights -> ${groupableRoots.size} matters (+${uncitable.length} uncitable, ungroupable) | established: ${matters.established.length} | ambiguous: ${matters.ambiguous} | refused: ${matters.refused_no_admissible_ground}`);
} else {
  matters = { refused: "too few same-citation relaunch pairs to measure an E2 window from the data" };
}

// ═══ output ═════════════════════════════════════════════════════════════════
const runStamp = new Date().toISOString();
const t0ms = Math.min(...flights.map((r) => r.takeoff));
const t1ms = Math.max(...flights.map((r) => r.landing));
const out = {
  // II.17: a projection names its cursor and its extent. These numbers are a
  // reading of ONE pull of a LIVE feed — the feeds grow, and a later pull will
  // not reproduce them. `read_at` is the host's clock (III.2: the script owns
  // it, the engine has none); `feed_extent` is what this artifact actually saw.
  read_at: runStamp,
  feed: { path: feedPath, n_flights: flights.length,
          first_takeoff: new Date(t0ms).toISOString(),
          last_landing: new Date(t1ms).toISOString() },
  label, tz: tzName, n_flights: flights.length,
  launch_sites: launchSites,
  launch_sites_display: { bar: LAUNCH_DISPLAY_BAR, cap: LAUNCH_DISPLAY_CAP,
                          n_above_bar: sitesAboveBar.length,
                          truncated: sitesAboveBar.length > LAUNCH_DISPLAY_CAP,
                          note: "display selection, not the program's site set" },
  declared: { ...OPTS, draws: DRAWS, alpha: ALPHA, loc_cell_deg: LOC, dock_excl_km: DOCK_EXCL_KM,
              sideways_fold: "per-local-calendar-week" },
  // II.21: every altitude keeps the way back down to the material it folded.
  // Week-kind members ARE flight_ids; upper-level members are week-kind ids,
  // which resolve against week_level below — so an L1 kind drills to its
  // week-kinds and thence to flights. Dropping `members` here (an earlier
  // draft did) would leave a figure with no ground: a fold that cannot be
  // drilled back down has not folded.
  fold: {
    week_level: weekLadder.map((w) => ({
      week: w.week, n_records: w.n,
      kinds: w.kinds.map((k) => ({
        id: k.id, label: k.label ?? null,
        size: k.members?.length ?? null,
        members: k.members ?? [],
      })),
    })),
    records_in_unfoldable_weeks: unfolded,
    halted: fold.halted,
    upper_ladder: fold.ladder.map((l) => ({
      level: l.level + 1, population: l.population, n_records: l.records.length,
      kinds: l.kinds.map((k) => ({
        id: k.id, label: k.label ?? null,
        size: k.members?.length ?? null,
        members: k.members ?? [],
        core: k.core ?? null,
      })),
    })),
  },
  matters,
};
writeFileSync(`${outdir}/eoread-${label}.json`, JSON.stringify(out, null, 1));
// The first UPPER-fold level's kind objects (NOT level-0 / week level, which
// lives in `fold.week_level` above) — schema varies by engine version. Empty
// where the upward fold halted before certifying any kind; that is a halt, not
// an empty run.
writeFileSync(`${outdir}/eoread-${label}-kinds-full.json`, JSON.stringify(kinds, null, 1));
console.log(`[${label}] wrote ${outdir}/eoread-${label}.json`);
