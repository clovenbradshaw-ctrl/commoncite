// Probe: does eoreader6's EXISTING machinery already handle the numeric cases
// in the signal-from-noise corpus, with no new code? Every case here is scored
// against real `nul`/`temporality` calls — nothing hand-waved.
import { ground, difference, isGap, admissible, keep, witness, pattern } from "../../nul/index.js";
import { temporality } from "../../temporality/index.js";

const report = (name, series, note) => {
  console.log(`\n=== ${name} ===  ${note}`);
  const window = Math.max(2, Math.min(3, Math.floor(series.length / 3)));
  const g = ground({ material: series, draws: 200, window, seed: 1 });
  if (isGap(g)) { console.log("  ground:", g.gap); return; }
  console.log("  volume (aperture):", g.samples[Math.floor(g.samples.length * 0.75)] - g.samples[Math.floor(g.samples.length * 0.25)]);
  // score the single largest windowed mean against the ground
  let best = -Infinity, at = -1;
  for (let i = 0; i + window <= series.length; i++) {
    let s = 0; for (let j = i; j < i + window; j++) s += series[j];
    if (s / window > best) { best = s / window; at = i; }
  }
  const d = difference(best, g);
  console.log(`  peak window @${at}: ${best.toFixed(3)} ->`, isGap(d) ? `${d.gap} (${d.direction})` : `rank ${d.rank}`);

  const t = temporality({ material: series, draws: 99, window: Math.max(2, Math.min(4, Math.floor(series.length / 3))) });
  console.log("  temporality:", isGap(t) ? t.gap : t.verdict);
};

// B1 — mean-shift spike
report("B1 mean-shift", [4.1,4.0,4.2,3.9,4.1,41.7,4.0,4.2,3.9,4.1], "expect: engine catches this trivially");

// B2 — variance change, mean constant
report("B2 variance-shift", [5.0,5.1,4.9,5.0,8.2,1.9,9.4,0.6], "expect: burstiness (mean-based) should MISS this; needs a spread statistic");

// B6 — frozen sensor (S3), inverse-outlier
report("B6 frozen sensor S3", [21.0,21.0,21.0,21.0,21.0,21.0], "expect: zero variance -> ground degenerate, should GAP not silently pass");
report("B6 normal sensor S1", [21.2,21.4,21.1,21.3,21.5,21.2], "control");

// B7 — exact repeat in near-random space (hash collision analog): treat as
// categorical recurrence, not a numeric series. burstiness can't see this at
// all — flag explicitly.
console.log("\n=== B7 hash collision ===  categorical exact-match; NOT a numeric-series case at all");
console.log("  h1..h6 with h4===h2: this needs an IDENTITY/recurrence test (activation.js), not ground/difference on magnitudes.");

// B8 — ordinal/rank surprise: prior-relative vs posterior-relative
console.log("\n=== B8 ordinal surprise ===  prior-relative vs posterior-relative");
const times = [58.2, 59.1, 59.8, 41.0, 61.2, 61.9];
report("B8 as raw series", times, "posterior-relative: is 41.0 surprising IN THIS SEQUENCE");
console.log("  prior-relative reading requires an EXTERNAL population of race times (a witness/prior) -- not in the material at all.");
