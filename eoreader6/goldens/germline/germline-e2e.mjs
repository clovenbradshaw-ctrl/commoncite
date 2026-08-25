// eoreader6 · goldens/germline — a LOCAL model (llama.cpp, CPU) as the
// guide-emitter: it fills the perceiver template's three typed holes,
// schema-constrained at decode time; the enzyme assembles; the gates
// select. One bounded repair round on a typed refusal, same as plans.
//
// The model's entire creative output here is three short strings. It
// writes no file, names no import, touches no I/O — the template owns
// all of that. What survives the gates is an executable organ; what
// doesn't, doesn't exist.
//
// Run:  node goldens/germline/germline-e2e.mjs [task] [fixture]

import { readFileSync, writeFileSync } from "node:fs";
import {
  PERCEIVER_TEMPLATE,
  GERMLINE_API_VERSION,
  germline,
  isGap,
} from "../../packages/host/germline.js";
import { selectGuide, appendEntry } from "../../packages/host/guide-array.js";

const ARRAY_PATH = new URL("../../bin/priors/germline/guide-array.json", import.meta.url);

const LLM_URL = process.env.LLM_URL || "http://127.0.0.1:8033/v1/chat/completions";
const REPAIR_ROUNDS = 1;
const MAX_TOKENS = 500;

const FIXTURE = process.argv[3] ||
  new URL("../../scripts/adversarial/fixtures/frankenstein-excerpt.txt", import.meta.url).pathname;
const TASK = process.argv[2] ||
  "Units are the non-empty lines of the text. The reduced series is the number of words on each line read so far (split on whitespace).";

const SCHEMA = {
  type: "object",
  properties: {
    load_body: { type: "string", minLength: 1, maxLength: 300 },
    unit_count_expr: { type: "string", minLength: 1, maxLength: 80 },
    reduce_body: { type: "string", minLength: 1, maxLength: 300 },
  },
  required: ["load_body", "unit_count_expr", "reduce_body"],
};

const SYSTEM = `You fill three typed holes in a fixed JavaScript perceiver template. You write no imports, no I/O, no clocks, no randomness — the template owns all of that. Reply with a JSON object only.

The template:
  load(path):   const text = <file contents>;  { YOUR load_body }   // statements over: text, opts — must return the units array
  reduce(units, {fraction}): const readTo = max(2, floor(( YOUR unit_count_expr ) * fraction));  { YOUR reduce_body }   // statements over: units, readTo, opts — must return an array of numbers over units[0..readTo)

Rules: load_body returns an array of units from \`text\` (it must contain a return statement). unit_count_expr is one expression over \`units\`. reduce_body returns numbers for the first readTo units only (it must contain a return statement; readTo is already computed for you — never recompute it). If a string literal needs a newline character, write \\\\n (escaped) — a raw newline inside a string literal is a syntax error.`;

// Retrieval before generation: the exemplar shown to the model is a guide
// that previously SURVIVED the gates, retrieved from the array by task
// overlap — imitation of verified material, not of a hand-written sample.
// No survivor overlapping the task is a no_candidate result, and the
// fallback exemplar is the hand-written one, labelled as such.
const FALLBACK_EXEMPLAR = {
  task: "units are sentences; series is characters per sentence",
  fillings: {
    load_body: "return text.split(/[.!?]+/).filter(s => s.trim().length > 0);",
    unit_count_expr: "units.length",
    reduce_body: "return units.slice(0, readTo).map(s => s.length);",
  },
  source: "hand-written fallback (no surviving guide overlapped this task)",
};

async function chat(messages, schema) {
  const res = await fetch(LLM_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages, temperature: 0, max_tokens: MAX_TOKENS,
      response_format: { type: "json_object", schema },
    }),
  });
  if (!res.ok) throw new Error(`llm ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).choices[0].message.content;
}

const parse = (t) => {
  const m = String(t).match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : null;
};

async function main() {
  const trace = { task: TASK, fixture: FIXTURE, llm: LLM_URL, rounds: [] };

  let arrayData = JSON.parse(readFileSync(ARRAY_PATH, "utf8"));
  const retrieved = selectGuide(arrayData, TASK);
  const exemplar = isGap(retrieved)
    ? FALLBACK_EXEMPLAR
    : {
        task: retrieved.entry.task,
        fillings: retrieved.entry.fillings,
        source: `guide-array:${retrieved.entry.id} (survived the gates; score ${retrieved.score.toFixed(2)})`,
      };
  trace.retrieval = isGap(retrieved)
    ? { gap: { ...retrieved } }
    : { id: retrieved.entry.id, score: retrieved.score };
  console.log("exemplar:", exemplar.source);

  const systemWithExemplar = `${SYSTEM}

Example (for the task "${exemplar.task}"):
${JSON.stringify(exemplar.fillings)}`;

  const baseMessages = [
    { role: "system", content: systemWithExemplar },
    { role: "user", content: `Task: ${TASK}\nEmit the three fillings.` },
  ];

  let raw = await chat(baseMessages, SCHEMA);
  let fillings = parse(raw);
  trace.rounds.push({ kind: "guide", raw });

  let verdict = await germline(PERCEIVER_TEMPLATE, fillings ?? {}, {
    giver: "local-model qwen2.5-1.5b via germline-e2e.mjs",
    fixturePath: FIXTURE,
  });

  for (let round = 0; isGap(verdict); round++) {
    trace.rounds.push({ kind: "refusal", gap: { ...verdict } });
    console.log("refused:", JSON.stringify({ ...verdict }));
    if (round >= REPAIR_ROUNDS) break;
    raw = await chat([
      ...baseMessages,
      { role: "assistant", content: JSON.stringify(fillings) },
      { role: "user", content: `The gates refused that guide with this typed gap — repair the fillings and emit them again, JSON only:\n${JSON.stringify({ ...verdict })}` },
    ], SCHEMA);
    fillings = parse(raw);
    trace.rounds.push({ kind: "repaired-guide", raw });
    verdict = await germline(PERCEIVER_TEMPLATE, fillings ?? {}, {
      giver: "local-model qwen2.5-1.5b via germline-e2e.mjs (repair round)",
      fixturePath: FIXTURE,
    });
  }

  if (isGap(verdict)) {
    trace.outcome = { survived: false, finalGap: { ...verdict } };
    console.log("\nOUTCOME: the candidate did not survive selection. That is a result, not an error.");
  } else {
    const units = await verdict.organ.load(FIXTURE);
    const series = verdict.organ.reduce(units, { fraction: 1 });
    trace.outcome = {
      survived: true,
      cleared: [...verdict.cleared],
      extent: verdict.series.extent,
      sample: series.slice(0, 12),
      source: verdict.candidate.source,
    };
    console.log("\nOUTCOME: cleared", verdict.cleared.join(" → "));
    console.log(`series extent ${verdict.series.extent}; first values: ${series.slice(0, 12).join(", ")}`);
    console.log("\n--- the organ that now exists ---\n" + verdict.candidate.source);
  }

  // The array remembers this encounter — survivor or refusal, equal weight.
  const entry = {
    template: PERCEIVER_TEMPLATE.name,
    germline_version: GERMLINE_API_VERSION,
    task: TASK,
    fillings: fillings ?? {},
    giver: "local-model qwen2.5-1.5b via germline-e2e.mjs",
    outcome: isGap(verdict)
      ? { survived: false, gap: verdict.gap, gate: verdict.gate ?? null }
      : { survived: true, cleared: [...verdict.cleared] },
    fixture: { path: FIXTURE },
  };
  const appended = appendEntry(arrayData, entry);
  if (!isGap(appended) && appended.entries.length !== arrayData.entries.length) {
    writeFileSync(ARRAY_PATH, JSON.stringify(appended, null, 1) + "\n");
    console.log(`archived: ${appended.entries.at(-1).id} (${entry.outcome.survived ? "survivor" : "refusal"})`);
  }

  writeFileSync(new URL("./run.json", import.meta.url), JSON.stringify(trace, null, 2));
  console.log("\ntrace written to goldens/germline/run.json");
}

main().catch((err) => { console.error(err); process.exit(1); });
