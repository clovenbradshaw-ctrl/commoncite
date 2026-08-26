// native/eval/being-superposition.mjs — does a span's role collapse
// PER OCCURRENCE, contextually, where a type-level tag cannot?
//
// THE DEFECT THIS INTERROGATES. descriptorBeings' being-evidence measure
// (native/adapters/text/anchoring.js, driven by levers.mjs) decides whether
// a descriptor ACTS by asking whether the word following it is a verb — and
// answers that from the UD EWT prior's TYPE-level counts, keeping a form
// only when VERB > AUX. Measured on Frankenstein, four of its five
// admissions are licensed by `had` or `became`:
//
//   the murder  ← "the murder had been committed"          (passive: patient)
//   the child   ← "the child had been missed"              (passive: patient)
//   the city    ← "the appearance of the city had ..."     (PP-internal: not the subject)
//   the south   ← "the passage towards the south became"   (PP-internal: not the subject)
//   the Turk    ← "the Turk entered his daughter's apartment"  (the one real agent)
//
// The prior ALREADY holds the answer in superposition — `had` is
// {AUX: 154, VERB: 335}, a distribution — and the gate destroys it with one
// `>` before any occurrence is seen. This driver asks whether the collapse
// can instead be made where it belongs: at the occurrence, by context.
//
// THE CONSTRUCTION, and its precedent. Forms the prior tags with exactly ONE
// class are unambiguous and seed the roles as declared evidence; forms it
// tags with several are held in superposition and are what gets resolved.
// That is mine-1-span-role.mjs's own construction (unambiguous forms as
// known evidence, ambiguous forms as the spans to resolve), pointed at the
// AUX/VERB distinction the gate's wall is actually about. Nothing is
// hand-listed: which forms are ambiguous is the received prior's own fact.
//
// The organ is roles.js::resolveSpanRole (engine, unmodified) — the general
// sibling of pronouns.js, whose own header states the rule the gate breaks:
// "a surface span is never the thing with a role — the OCCURRENCE is."
//
// PREDICTION, RECORDED BEFORE THE RUN so the result cannot be read backwards
// into it: `had` in "the murder had been committed" should collapse AUX and
// `had` in "the appearance of the city had ... beauty" should collapse VERB.
// The known risk is granularity, not principle: resolveSpanRole evidences a
// role per SENTENCE, and most English sentences contain both an unambiguous
// auxiliary and an unambiguous verb, so most frames will be labelled with
// both roles and the margin may vanish. If it does, that is a real finding
// about where this organ's grain sits — reported, never tuned away.
//
// Usage: node native/eval/being-superposition.mjs <book.txt>

import fs from "node:fs";
import { stripContainer, splitSentences } from "../adapters/text/spans.js";
import { resolveSpanRole } from "../../legacy-eoreader6.1/packages/engine/perceiver/text/roles.js";

const POS_PRIOR = JSON.parse(fs.readFileSync(new URL("../../legacy-eoreader6.1/bin/priors/pos/en-ud-ewt.json", import.meta.url), "utf8"));

// Declared, and cited rather than invented: host/corpus.js's own operating
// point for one-hop activation binding, disclosed there as unvalidated. The
// same reuse hypergraph.js made when it composed resolvePronouns — moving
// these is expected, and is not a regression.
const RECALL = { minActivation: 0.05, minMargin: 0.2 };

const ROLES = ["AUX", "VERB"]; // the distinction the gate's wall is about, and nothing wider
const WORD_RE = /[\p{L}][\p{L}'’]*/gu;

const classesOf = (form) => Object.keys(POS_PRIOR.forms?.[form] ?? {});

// The candidates whose licensing tokens this run is about — read from the
// gate's own admissions, so the run interrogates the shipped measure rather
// than a restatement of it.
const WATCHED = ["the murder", "the child", "the city", "the south", "the turk", "the woman"];

function main() {
  const path = process.argv[2];
  if (!path) throw new TypeError("usage: node native/eval/being-superposition.mjs <book.txt>");
  const stripped = stripContainer(fs.readFileSync(path, "utf8"));
  const sentences = splitSentences(stripped.text);

  const occurrences = [];
  const watchedHits = [];
  let seeds = 0;
  let superposed = 0;

  for (const s of sentences) {
    const lower = s.text.toLowerCase();
    WORD_RE.lastIndex = 0;
    let m;
    while ((m = WORD_RE.exec(s.text))) {
      const form = m[0].toLowerCase();
      const classes = classesOf(form);
      if (!classes.length) continue;
      const roleClasses = classes.filter((c) => ROLES.includes(c));
      if (!roleClasses.length) continue;

      if (classes.length === 1) {
        // unambiguous in the received prior — declared evidence, not a guess
        occurrences.push({ sentenceOrder: s.order, role: roleClasses[0], id: `seed:${s.order}:${m.index}`, offset: m.index });
        seeds += 1;
        continue;
      }
      if (roleClasses.length < 2) continue; // ambiguous, but not between the two roles under test

      // held in superposition: resolved only if it is a token the gate's own
      // measure would have consulted — the word standing right after a
      // watched descriptor.
      const before = lower.slice(0, m.index);
      const watched = WATCHED.find((w) => new RegExp(`${w.replace(/ /g, "\\s+")}\\s+$`).test(before));
      if (!watched) continue;
      const id = `superposed:${s.order}:${m.index}`;
      occurrences.push({ sentenceOrder: s.order, role: null, id, offset: m.index });
      superposed += 1;
      watchedHits.push({ id, descriptor: watched, form, prior: POS_PRIOR.forms[form], sentenceOrder: s.order, text: s.text.replace(/\s+/g, " ").trim().slice(0, 200) });
    }
  }

  const { bindings, gaps } = resolveSpanRole(sentences, occurrences, RECALL);
  const byId = new Map(bindings.map((b) => [b.id, b]));
  const gapById = new Map(gaps.map((g) => [g.id, g]));

  const rows = watchedHits.map((h) => {
    const b = byId.get(h.id);
    const g = gapById.get(h.id);
    return {
      descriptor: h.descriptor,
      form: h.form,
      priorSuperposition: h.prior,
      typeLevelVerdict: (h.prior.VERB ?? 0) > (h.prior.AUX ?? 0) ? "VERB (the gate admits)" : "AUX (the gate refuses)",
      collapsedTo: b ? b.role : null,
      activation: b?.activation ?? null,
      margin: b?.margin ?? null,
      gap: b ? null : (g?.reason ?? "not_reported"),
      sentenceOrder: h.sentenceOrder,
      text: h.text,
    };
  });

  console.log(JSON.stringify({
    schema: "EOBeingSuperpositionRun@1",
    book: path.split("/").pop(),
    organ: "engine perceiver/text/roles.js::resolveSpanRole, unmodified",
    declared: { RECALL, ROLES, watched: WATCHED },
    prior: { giver: POS_PRIOR.provenance?.giver ?? POS_PRIOR.provenance ?? null, language: POS_PRIOR.language ?? null, forms: Object.keys(POS_PRIOR.forms ?? {}).length },
    construction: {
      seedOccurrences: seeds,
      superposedOccurrences: superposed,
      note: "seeds are forms the prior tags with exactly one class; superposed are AUX/VERB-ambiguous forms standing where the gate's own measure would read them",
    },
    rows,
  }, null, 1));
}

main();
