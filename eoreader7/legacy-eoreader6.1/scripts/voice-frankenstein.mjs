// eoreader6 · voice-frankenstein — the attribution channel on real material.
//
// What the eoPriors coref prior actually gives is the CREATURE's narrator
// spans, received, with a named giver. Walton's and Victor's spans are not in
// it, so they are not asserted here — the honest consequence is that most of
// the book returns a typed gap, and that is the correct answer rather than a
// defect. Guessing Victor because he narrates "most of it" is precisely the
// move that hands the creature's acts to him.
//
// Nested quotation INSIDE the creature's tale is derived from quote marks:
// engine-tier, defeasible, and marked as such so a received assertion would
// override it and the disagreement would surface.

import { readFileSync } from "node:fs";
import { stripContainer } from "../packages/engine/perceiver/text/spans.js";
import { resolveNarratorSpans } from "../packages/engine/perceiver/text/narrator.js";
import { createVoiceLog, enterVoice, exitVoice, voiceAt, voiceTransitions } from "../packages/engine/emergence/shabda.js";

const TEXT_PATH = "scripts/adversarial/fixtures/pg84-frankenstein.txt";
const COREF_PATH = "scripts/adversarial/fixtures/pg84-frankenstein.coref.json";

const { text } = stripContainer(readFileSync(TEXT_PATH, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
const coref = JSON.parse(readFileSync(COREF_PATH, "utf8"));
const prior = coref.referents.find((r) => r.id === "creature");
const { resolved } = resolveNarratorSpans(text, "creature", prior.narratorSpans);

const log = createVoiceLog();
for (const s of resolved) {
  enterVoice(log, { referentId: "creature", at: s.from, basis: `eoPriors:${COREF_PATH.split("/").pop()}`, tier: "received" });
  exitVoice(log, { at: s.to, basis: "narrator span ends", tier: "received" });
}

// Nested citation inside his tale: a long quoted passage the creature reports.
// Derived, so it is defeasible and says so.
const inCreature = (o) => resolved.some((s) => o >= s.from && o < s.to);
let quotes = 0;
const QUOTE = /[“][^”]{200,}[”]/g;
let m;
while ((m = QUOTE.exec(text)) !== null) {
  if (!inCreature(m.index)) continue;
  enterVoice(log, { referentId: "quoted-within-creature", at: m.index, basis: "balanced quote marks, >=200 chars", tier: "derived", mode: "cited" });
  exitVoice(log, { at: m.index + m[0].length, basis: "quote closes", tier: "derived" });
  quotes++;
}

const pct = (o) => ((o / text.length) * 100).toFixed(1);

console.log(`VOICE CHANNEL — Frankenstein`);
console.log(`  received: ${resolved.length} creature narrator spans (eoPriors, named giver)`);
console.log(`  derived:  ${quotes} nested citations inside them (quote marks, defeasible)\n`);

console.log(`the attribution spine:`);
for (const t of voiceTransitions(log)) {
  console.log(`  ${pct(t.at).padStart(6)}%  ${(t.from ?? "—").padEnd(24)} -> ${(t.to ?? "— (gap)").padEnd(24)} depth ${t.depth}  [${t.tier}]`);
}

console.log(`\nwho is speaking, sampled across the book:`);
for (const frac of [0.05, 0.25, 0.41, 0.5, 0.61, 0.75, 0.985]) {
  const off = Math.floor(text.length * frac);
  const v = voiceAt(log, off);
  const who = v.speaker
    ? `${v.speaker.referentId} (depth ${v.depth}, ${v.speaker.mode}, ${v.speaker.tier})`
    : `GAP — ${v.gap.reason}`;
  console.log(`  ${(frac * 100).toFixed(1).padStart(5)}%  ${who}`);
}

const asserted = resolved.reduce((t, s) => t + (s.to - s.from), 0);
console.log(`\ncoverage: ${((asserted / text.length) * 100).toFixed(1)}% asserted, ${(100 - (asserted / text.length) * 100).toFixed(1)}% typed gap`);
console.log(`(the gap is the prior's silence about Walton and Victor, reported rather than filled)`);
