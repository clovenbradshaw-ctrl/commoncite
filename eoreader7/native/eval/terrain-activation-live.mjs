// native/eval/terrain-activation-live.mjs — watch activation light the
// terrains, one proposition at a time, at flat cost.
//
// Two claims, both measured here rather than asserted:
//   1. Per-proposition cost is O(what the proposition touches) — the
//      activation update does not grow with the book. (READING-SPEC S4: a
//      reader whose per-step cost grows is re-reading, not reading.)
//   2. Each proposition LIGHTS its relevant terrains as it arrives — Entity
//      from its beings, Link from its arrangements, Network from resolved
//      co-arrivals, Lens from identity evidence, Void from typed refusals —
//      and what is lit FADES, so "what is the reading holding right now" is
//      small, terrain-shaped, and always current. This is presence, never
//      persistence: the lexicon (projected from the log) keeps everything;
//      this keeps the present. P1's own table, made runnable.
//
// ASSEMBLY, NAMED (P0): the causal text perceiver only, stepped in order —
// revision/fold tier not exercised. The lighting consumes exactly the
// entries the perceiver emits per encounter.
//
// THE WINDOW IS MEASURED, NOT SET (S5): dmdWindow over the first quarter's
// own mention stream — derive = the top beings of that prefix (a real
// reader conclusion), candidates declared. A measurement gap is reported
// and the run then says it is running the undecayed control, never a
// silent fallback.
//
// Usage: node native/eval/terrain-activation-live.mjs <book.txt>

import fs from "node:fs";
import { stripContainer } from "../adapters/text/spans.js";
import { createCausalTextPerceiver, textEncounters } from "../adapters/text/recursive.js";
import { createTerrainActivation, dmdWindow } from "../kernel/terrain-activation.js";

const POS_PRIOR = JSON.parse(fs.readFileSync(new URL("../../legacy-eoreader6.1/bin/priors/pos/en-ud-ewt.json", import.meta.url), "utf8"));
const ANCHORING = { minActivation: 0.05, minMargin: 0.2 };
const WINDOW_CANDIDATES = [8, 16, 32, 64, 128, 256]; // declared: which depths are worth testing
const PRESENCE_FLOOR = 1; // declared: one full arrival's worth still present — structural, not tuned
const TOP_BEINGS = 8; // declared: the prefix conclusion dmd measures against

async function main() {
  const path = process.argv[2];
  if (!path) throw new TypeError("usage: node native/eval/terrain-activation-live.mjs <book.txt>");
  const stripped = stripContainer(fs.readFileSync(path, "utf8"));
  if (!stripped.looks_like_material) throw new Error("input does not look like readable material");
  const encounters = textEncounters(stripped.text, { source: `file:${path.split("/").pop()}`, offset: stripped.offset });

  // ── pass 0: measure the window on the first quarter's mention stream ──
  const prefixEnd = Math.floor(encounters.length / 4);
  const prefixPerceiver = createCausalTextPerceiver({ minRelationSurfaces: 2, refreshEvery: 25, posPrior: POS_PRIOR });
  const mentionObs = [];
  for (const enc of encounters.slice(0, prefixEnd)) {
    const refs = [];
    for (const c of (await prefixPerceiver.perceive(enc, {})) ?? []) {
      for (const g of c.candidate?.graphEntries ?? []) if (g?.schema === "EOMention@1" && g.referent) refs.push(g.referent);
    }
    mentionObs.push(refs);
  }
  const topN = (n) => (obs) => {
    const m = new Map();
    for (const r of obs.flat()) m.set(r, (m.get(r) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([r]) => r).sort();
  };
  // Two conclusions, two reaches — both measured, both reported. The
  // top-8 cast of a whole prefix inherently reaches its beginning (early
  // beings never leave that set), so its gap is INFORMATIVE, not a failure:
  // reach is a property of the CONCLUSION, and dmd measures it per
  // conclusion. "Who is this stretch about" (top-1) has short reach and
  // measures finite — that is the window presence runs at here, with the
  // derive named so the number cannot be quoted apart from its question.
  const castMeasure = dmdWindow(mentionObs, topN(TOP_BEINGS), { candidates: WINDOW_CANDIDATES });
  const protagonistMeasure = dmdWindow(mentionObs, topN(1), { candidates: WINDOW_CANDIDATES });
  const measured = protagonistMeasure.window != null ? protagonistMeasure : castMeasure;
  const window = measured.window; // null only if BOTH gapped → undecayed control, SAID below

  // ── the live read: light per proposition, time per proposition ────────
  const perceiver = createCausalTextPerceiver({ minRelationSurfaces: 2, refreshEvery: 25, posPrior: POS_PRIOR, descriptorAnchoring: ANCHORING });
  const presence = createTerrainActivation({ window });
  const litSamples = [];
  const stepMicros = [];
  const checkpoints = new Map([1, 2, 3].map((q) => [Math.floor((encounters.length * q) / 4), `${q * 25}%`]));
  const presenceAt = {};
  const unknownSchemas = new Map();
  let pos = 0;
  for (const enc of encounters) {
    const out = (await perceiver.perceive(enc, {})) ?? [];
    const entries = out.flatMap((c) => [...(c.candidate?.graphEntries ?? []), ...(c.candidate?.hyperedges ?? [])]);
    const t0 = process.hrtime.bigint();
    const { lit, unknown } = presence.light(entries);
    stepMicros.push(Number(process.hrtime.bigint() - t0) / 1000);
    for (const s of unknown) unknownSchemas.set(s, (unknownSchemas.get(s) ?? 0) + 1);
    if (Object.keys(lit).length && litSamples.length < 400 && pos % 250 === 0) {
      litSamples.push({ at: pos, sentence: enc.material.slice(0, 70), lit: Object.fromEntries(Object.entries(lit).map(([t, ids]) => [t, ids.slice(0, 3)])) });
    }
    if (checkpoints.has(pos)) {
      const snap = presence.present(PRESENCE_FLOOR);
      presenceAt[checkpoints.get(pos)] = Object.fromEntries(
        Object.entries(snap).filter(([, xs]) => xs.length).map(([t, xs]) => [t, { active: xs.length, hottest: xs.slice(0, 4) }]),
      );
    }
    pos += 1;
  }

  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const half = Math.floor(stepMicros.length / 2);
  const now = presence.present(PRESENCE_FLOOR);

  console.log(JSON.stringify({
    schema: "EOTerrainActivationLive@1",
    book: path.split("/").pop(),
    assembly: "causal text perceiver only, stepped in order — revision/fold tier not exercised (P0: named)",
    windowMeasurement: {
      conclusions: {
        [`top-${TOP_BEINGS}-cast`]: castMeasure.window != null ? { window: castMeasure.window } : { gap: castMeasure.gap, reading: "the whole-prefix cast reaches the prefix's beginning — long-reach conclusion, correctly gapped" },
        "top-1-protagonist": protagonistMeasure.window != null ? { window: protagonistMeasure.window, gamma: protagonistMeasure.gamma } : { gap: protagonistMeasure.gap },
      },
      running: measured.window != null
        ? { window: measured.window, gamma: measured.gamma, derive: measured === protagonistMeasure ? "top-1 (who is this stretch about)" : `top-${TOP_BEINGS} cast`, basis: measured.basis }
        : { gap: measured.gap, consequence: "running the UNDECAYED CONTROL — said, not silent" },
      candidates: WINDOW_CANDIDATES,
    },
    encounters: encounters.length,
    costPerProposition: {
      meanMicroseconds: Number(mean(stepMicros).toFixed(1)),
      firstHalfMean: Number(mean(stepMicros.slice(0, half)).toFixed(1)),
      secondHalfMean: Number(mean(stepMicros.slice(half)).toFixed(1)),
      claim: "flat — the lighting cost does not grow with the book; growth here would mean re-reading (S4)",
    },
    liveLighting: litSamples.slice(0, 10),
    presenceAtCheckpoints: presenceAt,
    presentNow: {
      floor: PRESENCE_FLOOR,
      perTerrain: Object.fromEntries(Object.entries(now).map(([t, xs]) => [t, { active: xs.length, hottest: xs.slice(0, 5) }])),
      note: "the reach of the present at the last proposition — presence, never to be exported as the reading's content (P1/P6)",
    },
    unknownSchemas: [...unknownSchemas.entries()].map(([schema, n]) => ({ schema, n })),
  }, null, 1));
}

main().catch((err) => { console.error(err); process.exit(1); });
