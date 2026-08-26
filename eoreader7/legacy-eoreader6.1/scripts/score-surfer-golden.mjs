// scripts/score-surfer-golden.mjs — THE number for surfer (snip) work.
//
// Scores the frozen omnilingual × omnigenre surfer golden
// (conformance/golden/surfer-snips-golden.json): every case is a document
// set, a prompt, and the segment label (or typed gap) that prompt MUST
// return. The golden exists because the address ladder (source → heading →
// content → window, or a typed gap) is a capability contract: the engine
// underneath may be re-earned at any time, and one command must say whether
// the surfer can still do the thing. See the golden's notes for what the
// fixtures are and are not.
//
// The surfer is deterministic host code, so unlike the emergent span-golden
// (a ceiling tracker) this golden is a 100% contract: any FAIL is a
// regression, and conformance/surfer-golden.test.js asserts exactly that on
// every npm test.
//
// LIVE baseline as of 2026-07-31: 33/33 (every case green; 5 typed-gap
// cases, 1 of them prior-gated to the CJK segmentation prior).
//
// Amendment 2026-07-31: en-multi-doc-unsaid deliberately moved from the
// `no_source_addressed` typed gap to a fan — an unsaid source is an address
// to every document (the CON·bind act aimed at every target, engine/operators
// fan-out). The scorer now checks `expect.fan`, an ordered per-document list
// of the same checks a single case gets.
//
// Usage: node scripts/score-surfer-golden.mjs
// Re-score after any engine change; only a deliberate golden amendment moves
// the baseline.

import { readFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join, resolve } from "path";
import { createSession, admitChunked } from "../packages/host/corpus.js";
import { executePrompt } from "../packages/host/surfer.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GOLDEN = JSON.parse(readFileSync(
  join(ROOT, "conformance/golden/surfer-snips-golden.json"), "utf-8"));

export function scoreSurferGolden({ quiet = false } = {}) {
  const groups = new Map();
  let pass = 0;
  let fail = 0;
  const fails = [];

  const line = (s) => { if (!quiet) console.log(s); };

  for (const c of GOLDEN.cases) {
    const session = createSession();
    for (const docId of c.docs) {
      const doc = GOLDEN.documents[docId];
      if (!doc) throw new Error(`case ${c.id}: unknown document "${docId}"`);
      admitChunked(session, { text: doc.text, sourceId: docId });
    }
    const out = executePrompt(session, c.prompt);
    const e = c.expect || {};

    const checkOutcome = (outcome, x) => {
      const checks = [];
      if (x.gap) {
        if (outcome.gap !== x.gap) checks.push(`gap: expected "${x.gap}", got ${outcome.gap ? `"${outcome.gap}"` : `a segment ("${outcome.segment}")`}`);
        if (x.windowed !== undefined && outcome.gap && outcome.windowed !== x.windowed) checks.push(`windowed: expected ${x.windowed}, got ${outcome.windowed}`);
      } else {
        if (outcome.gap) checks.push(`expected a segment, got gap "${outcome.gap}" (${outcome.reason ?? ""})`);
        if (!outcome.gap && outcome.segment !== x.segment) checks.push(`segment: expected "${x.segment}", got "${outcome.segment}"`);
        if (x.addressed_by && outcome.addressed_by !== x.addressed_by) checks.push(`addressed_by: expected "${x.addressed_by}", got "${outcome.addressed_by}"`);
        if (x.source && outcome.source !== x.source) checks.push(`source: expected "${x.source}", got "${outcome.source}"`);
        if (x.text_contains && !(outcome.text ?? "").includes(x.text_contains)) checks.push(`text: expected to contain ${JSON.stringify(x.text_contains)}, got ${JSON.stringify(String(outcome.text ?? "").slice(0, 80))}…`);
        if (x.windowed !== undefined && outcome.windowed !== x.windowed) checks.push(`windowed: expected ${x.windowed}, got ${outcome.windowed}`);
      }
      return checks;
    };

    const checks = [];
    if (e.fan) {
      if (!Array.isArray(out.fan)) {
        checks.push(`fan: expected ${e.fan.length} per-document entries, got ${out.gap ? `gap "${out.gap}"` : `a single segment ("${out.segment}")`}`);
      } else if (out.fan.length !== e.fan.length) {
        checks.push(`fan: expected ${e.fan.length} entries, got ${out.fan.length} (${out.fan.map((r) => r.source).join(", ")})`);
      } else {
        for (let i = 0; i < e.fan.length; i++)
          for (const ch of checkOutcome(out.fan[i], e.fan[i])) checks.push(`fan[${i}] ${ch}`);
      }
    } else {
      checks.push(...checkOutcome(out, e));
    }

    const doc = GOLDEN.documents[c.docs[0]];
    const group = `${doc.language}/${doc.genre}`;
    if (!groups.has(group)) groups.set(group, { pass: 0, fail: 0 });
    const g = groups.get(group);

    if (checks.length === 0) {
      pass++;
      g.pass++;
      const label = e.fan
        ? `fan → ${out.fan.map((r) => `${r.source}:${r.segment ?? r.gap}`).join(" | ")}`
        : e.gap ? `gap ${e.gap}` : `"${out.segment}"`;
      line(`  PASS  ${c.prior_gated ? "⇥ prior-gated  " : ""}${c.id}  →  ${label}`);
    } else {
      fail++;
      g.fail++;
      fails.push({ id: c.id, checks });
      line(`  FAIL  ${c.id}`);
      for (const ch of checks) line(`        - ${ch}`);
    }
  }

  line(`\nTOTAL: ${pass}/${GOLDEN.cases.length} passing (${fail} failing)`);
  for (const [g, v] of groups) line(`  ${g.padEnd(28)} ${v.pass}/${v.pass + v.fail}`);
  return { pass, fail, total: GOLDEN.cases.length, fails, groups };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const r = scoreSurferGolden();
  if (r.fail > 0) {
    console.error(`\nSurfer golden REGRESSED: ${r.fail}/${r.total} failing.`);
    process.exit(1);
  }
}
