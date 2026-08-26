// native/eval/interlocutor.mjs — a mental model of whoever is talking to you.
//
// The claim this driver tests is that a conversation needs NO new mechanism.
// A chat is a text whose holders alternate; "what does my interlocutor
// believe" is `mentalModel(projected, them, READER)`, the same call that asks
// what the reader holds via Victor. If that is true, the organ built for a
// novel should run on dialogue unchanged — and if it is false, this driver
// is where it shows.
//
// The material is Frankenstein's own dialogue rather than a synthetic
// transcript, for the reason S2 gives about prefixes: a fixture written to
// demonstrate a mechanism demonstrates the fixture. Attributed speech in a
// real novel is a real conversation, with all the ordinary trouble — most
// lines name no speaker at all.
//
// ASSEMBLY, NAMED (P0): quotation frames + attribution (POS prior refusing,
// admitted cast from the constitutional reader) + perspective projection.
// No relation extraction inside quotations: the claim keyed here is the
// UTTERANCE, addressed by its bytes, because what a speaker said is a fact
// about the record and what it means is a different tier.
//
// Usage: node native/eval/interlocutor.mjs <book.txt> --coref <prior.json>

import fs from "node:fs";
import { stripContainer } from "../adapters/text/spans.js";
import { quotationFrames, quotedSpans, attributeQuotation } from "../adapters/text/attribution.js";
import { deltaFold } from "../kernel/fold.js";
import { READER, projectPerspectives, divergence, mentalModel, commonGround, perspectiveOperation } from "../kernel/perspective.js";
import { createSession, admitChunked, sessionReferents } from "../../legacy-eoreader6.1/packages/host/corpus.js";

const POS_PRIOR = JSON.parse(fs.readFileSync(new URL("../../legacy-eoreader6.1/bin/priors/pos/en-ud-ewt.json", import.meta.url), "utf8"));
const arg = (flag) => { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : null; };

// The POS prior REFUSES; it never admits (P3). "Is this word ever a verb in
// the treebank" is the whole question asked of it — a word the treebank has
// never seen is refused, not given the benefit of the doubt.
const makeIsVerb = (prior) => {
  const table = prior.forms ?? prior.words ?? prior;
  return (word) => {
    const entry = table[String(word).toLowerCase()];
    if (!entry) return false;
    const tags = entry.tags ?? entry;
    return Boolean(tags?.VERB);
  };
};

async function main() {
  const path = process.argv[2];
  if (!path) throw new TypeError("usage: node native/eval/interlocutor.mjs <book.txt> --coref <prior.json>");
  const corefPath = arg("--coref");
  const raw = fs.readFileSync(path, "utf8");
  const stripped = stripContainer(raw);
  const sourceId = `file:${path.split("/").pop()}`;
  const corefPrior = corefPath ? JSON.parse(fs.readFileSync(corefPath, "utf8")) : null;

  // The admitted cast — attribution may only name a being this reading has
  // already witnessed. Borrowed from the constitutional assembly rather than
  // re-derived, and said so.
  const session = createSession();
  admitChunked(session, { text: raw, sourceId, language: "en" });
  const cast = sessionReferents(session, { sourceId, priors: corefPrior ? [corefPrior] : [], limit: 200 });
  const bySurface = new Map();
  for (const ref of cast.referents ?? []) {
    for (const s of [ref.display, ...(ref.surfaces ?? []).map((x) => x.surface ?? x)]) {
      if (typeof s === "string" && s.trim()) bySurface.set(s.trim().toLowerCase(), ref.display ?? ref.id);
    }
  }
  const referentFor = (surface) => bySurface.get(String(surface).trim().toLowerCase()) ?? null;
  const isVerb = makeIsVerb(POS_PRIOR);

  // Every quoted paragraph is a candidate utterance; who owns it is the
  // question, and most of the time there is no answer in the bytes.
  const quotes = quotationFrames(stripped.text, { offset: stripped.offset });
  const entries = [];
  const spoke = new Map();
  let attributed = 0;
  let unattributed = 0;
  const gapKinds = new Map();

  const utterances = quotedSpans(stripped.text, { offset: stripped.offset });
  for (const mark of utterances.spans) {
    const result = attributeQuotation(mark.before, mark.after, { isVerb, referentFor });
    if (!result.speaker) {
      unattributed += 1;
      gapKinds.set(result.gap.type, (gapKinds.get(result.gap.type) ?? 0) + 1);
      continue;
    }
    attributed += 1;
    spoke.set(result.speaker, (spoke.get(result.speaker) ?? 0) + 1);
    const claim = `utterance:${mark.byteStart}`;
    entries.push(deltaFold([
      // The speaker asserts it; the reader holds it as reported, via them.
      perspectiveOperation({ holder: result.speaker, claim, witness: `byte:${mark.byteStart}` }),
      perspectiveOperation({ holder: READER, claim, via: [result.speaker], witness: `byte:${mark.byteStart}` }),
    ]));
  }

  const projected = projectPerspectives(entries);
  const speakers = [...spoke.entries()].sort((a, b) => b[1] - a[1]);

  // The interlocutor question, asked of the two most talkative parties: what
  // does the reading hold about what THEY hold, and what does one of them
  // hold that the other has no belief about at all — which, in a live
  // conversation, is precisely the list of things worth saying next.
  const models = speakers.slice(0, 4).map(([who]) => {
    const m = mentalModel(projected, who, READER);
    return { interlocutor: who, utterancesModelled: m.count, theyHold: m.ofHoldsInTotal, coverage: m.coverage, relayDepth: m.attributed[0]?.relayDepth ?? null };
  });
  const [a, b] = speakers.map(([who]) => who);

  console.log(JSON.stringify({
    schema: "EOInterlocutorModel@1",
    book: path.split("/").pop(),
    assembly: "quotation frames + attribution (POS prior refusing, cast from the constitutional assembly) + perspective projection — no relation extraction inside quotations (P0/P2)",
    priorsInjected: [
      { kind: "POS", giver: "bin/priors/pos/en-ud-ewt.json", role: "refuses a non-verb in the attribution slot; never admits one" },
      { kind: "coref", giver: corefPrior?.source ?? null, role: "the admitted cast attribution is allowed to name" },
    ],
    claim: "a chat needs no new mechanism — the organ built for a novel's tellers runs on dialogue unchanged; this driver is where that would show if false",
    quotations: {
      candidates: utterances.spans.length,
      attributed,
      unattributed,
      attributionRate: Number((attributed / Math.max(1, utterances.spans.length)).toFixed(3)),
      gapKinds: Object.fromEntries(gapKinds),
      note: "most dialogue in real prose names no speaker in its own two boundaries — an unowned line is an ordinary result, and inventing an owner would be worse than leaving it unowned",
    },
    speakers: speakers.slice(0, 10).map(([who, n]) => ({ who, utterances: n })),
    interlocutorModels: models,
    // Two speakers, one exchange: what each holds the other does not.
    exchange: a && b ? {
      between: [a, b],
      [`${a}_only`]: divergence(projected, a, b).asymmetric.length,
      [`${b}_only`]: divergence(projected, b, a).asymmetric.length,
      shared: commonGround(projected, a, b).count,
      reading: "utterances are addressed by their own bytes, so shared is 0 by construction — two people never say the same bytes. What this measures is turn-taking volume, and the claim tier is where agreement would live",
    } : null,
    counted: projected.counted,
  }, null, 1));
}

main().catch((err) => { console.error(err); process.exit(1); });
