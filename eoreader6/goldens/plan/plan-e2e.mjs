// eoreader6 · goldens/plan — the end-to-end steering demo NEXT-PLAN-EXECUTOR.md
// specs: a LOCAL model (llama.cpp server, CPU) steers; the physics executes.
//
// What the model does here, and ALL it does: (1) emit a plan — JSON chosen
// from the organ menu, schema-constrained at decode time so an ill-formed
// plan is unrepresentable (L5 made literal: the schema is the constraint,
// not the prompt); (2) after execution, render prose over the HANDLES —
// bounded gists and addresses, never payloads — citing [task_id] after
// each claim. Every citation is then checked mechanically against the
// handles it was actually given (the-fold's checkCitations, one size
// down). Validation refusals are typed gaps; the model gets ONE bounded
// repair round (DEFAULT_RECONCILE_ROUNDS = 1, the generation side's law).
//
// Run:  python3 -m llama_cpp.server --model <gguf> --port 8033 ... &
//       node goldens/plan/plan-e2e.mjs [question] [fixture]
//
// Declared numbers: REPAIR_ROUNDS = 1 (the reconcile law), PLAN_MAX_TOKENS
// = 700 / RENDER_MAX_TOKENS = 400 (transport budgets, not measurements),
// temperature 0 (steering is a choice, not a sample).

import { writeFileSync } from "node:fs";
import { createSession } from "../../packages/host/index.js";
import { executePlan, ADAPTERS } from "../../packages/host/execute.js";
import { validatePlan, isGap } from "../../packages/host/plan.js";
import { ORGANS } from "../../packages/engine/operators.js";

const LLM_URL = process.env.LLM_URL || "http://127.0.0.1:8033/v1/chat/completions";
const REPAIR_ROUNDS = 1;
const PLAN_MAX_TOKENS = 700;
const RENDER_MAX_TOKENS = 400;

const FIXTURE = process.argv[3] ||
  new URL("../../scripts/adversarial/fixtures/frankenstein-excerpt.txt", import.meta.url).pathname;
const SOURCE_ID = `source:${FIXTURE}`;
const QUESTION = process.argv[2] || "Who recurs in this text, and who travels with whom?";

const organById = new Map(ORGANS.map((o) => [o.id, o]));
const MENU = Object.entries(ADAPTERS).map(([id, a]) => {
  const o = organById.get(id);
  return `- organ "${id}" (operator ${o.op}, grain ${o.grain}, verb ${o.verb}): ${o.what}\n  adapter: ${a.what}`;
}).join("\n");

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    steps: {
      type: "array", minItems: 1, maxItems: 6,
      items: {
        type: "object",
        properties: {
          task_id: { type: "string", minLength: 1, maxLength: 24 },
          operator: { enum: ["NUL", "SEG", "SIG", "CON", "EVA", "DEF", "INS", "SYN", "REC"] },
          grain: { enum: ["Ground", "Figure", "Pattern"] },
          organ: { enum: Object.keys(ADAPTERS) },
          target: {
            type: "object",
            properties: {
              file: { type: "string" }, sourceId: { type: "string" },
              prompt: { type: "string" }, sourceFilter: { type: "string" },
            },
          },
          depends_on: { type: "array", items: { type: "string" } },
        },
        required: ["task_id", "operator", "grain", "organ", "target", "depends_on"],
      },
    },
  },
  required: ["steps"],
};

async function chat(messages, { schema, maxTokens }) {
  const body = {
    messages, temperature: 0, max_tokens: maxTokens,
    ...(schema ? { response_format: { type: "json_object", schema } } : {}),
  };
  const res = await fetch(LLM_URL, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`llm ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

const parsePlan = (text) => {
  const m = String(text).match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : null;
};

const STEER_SYSTEM = `You steer a reading engine. You never compute anything yourself — you emit a plan, and the engine's own organs execute it. Reply with a JSON object only.

A plan is {"steps": [...]}. Each step: {"task_id": short id, "operator": the organ's operator, "grain": the organ's grain, "organ": an id from the menu, "target": an address object, "depends_on": [earlier task_ids]}.

Rules:
- operator and grain must match the menu line for the organ you chose.
- Admit the source first (target: {"file": <path>}). Later steps inherit their source through depends_on — leave sourceId out; the executor resolves it. A host/surfer step still needs a "prompt" in its target.
- Choose only steps that answer the question. Results come back as addressed handles, not data.

Example (for the question "what kinds of beings appear?" over /tmp/book.txt):
{"steps":[
 {"task_id":"admit","operator":"INS","grain":"Ground","organ":"host/corpus/admit","target":{"file":"/tmp/book.txt"},"depends_on":[]},
 {"task_id":"cast","operator":"CON","grain":"Figure","organ":"referents/index","target":{},"depends_on":["admit"]}
]}

ORGAN MENU:
${MENU}`;

async function main() {
  const trace = { question: QUESTION, fixture: FIXTURE, llm: LLM_URL, rounds: [] };

  // ── steering call 1: the plan ──
  let planText = await chat([
    { role: "system", content: STEER_SYSTEM },
    { role: "user", content: `Question: ${QUESTION}\nSource file: ${FIXTURE}\nEmit the plan.` },
  ], { schema: PLAN_SCHEMA, maxTokens: PLAN_MAX_TOKENS });
  let plan = parsePlan(planText);
  trace.rounds.push({ kind: "plan", raw: planText });

  // ── typed refusal → one bounded repair round ──
  let v = plan ? validatePlan(plan) : { gap: "empty_material", reason: "no JSON object in reply" };
  for (let round = 0; isGap(v) || v.gap; round++) {
    trace.rounds.push({ kind: "refusal", gap: { ...v } });
    if (round >= REPAIR_ROUNDS) {
      console.error("plan refused after repair round:", v);
      writeFileSync(new URL("./run.json", import.meta.url), JSON.stringify(trace, null, 2));
      process.exit(1);
    }
    planText = await chat([
      { role: "system", content: STEER_SYSTEM },
      { role: "user", content: `Question: ${QUESTION}\nSource file: ${FIXTURE}\nEmit the plan.` },
      { role: "assistant", content: JSON.stringify(plan) },
      { role: "user", content: `The engine refused that plan with this typed gap — repair the plan and emit it again, JSON only:\n${JSON.stringify({ ...v })}` },
    ], { schema: PLAN_SCHEMA, maxTokens: PLAN_MAX_TOKENS });
    plan = parsePlan(planText);
    v = plan ? validatePlan(plan) : { gap: "empty_material", reason: "no JSON object in reply" };
    trace.rounds.push({ kind: "repaired-plan", raw: planText });
  }
  trace.plan = plan;
  console.log("PLAN (validated):", JSON.stringify(plan, null, 2));

  // ── physics executes ──
  const session = createSession();
  const run = executePlan(session, plan);
  if (run.refused) {
    console.error("executor refused:", run.refused);
    process.exit(1);
  }
  const handles = run.handles.map(({ task_id, organ, event_id, tick, gist, address, gaps }) =>
    ({ task_id, organ, event_id, tick, gist, address, gaps }));
  trace.handles = handles;
  trace.log_ticks = run.log.tick;
  console.log("\nHANDLES:", JSON.stringify(handles, null, 2));

  // ── steering call 2: render over handles only ──
  const answer = await chat([
    {
      role: "system",
      content: "Answer the question from the handles below and nothing else. After each claim, cite the handle it came from as [task_id]. If the handles do not cover something, say so plainly instead of filling the gap.",
    },
    { role: "user", content: `Question: ${QUESTION}\n\nHANDLES:\n${JSON.stringify(handles, null, 2)}` },
  ], { maxTokens: RENDER_MAX_TOKENS });
  trace.answer = answer;
  console.log("\nANSWER:\n" + answer);

  // ── mechanical citation check (checkCitations, one size down) ──
  const known = new Set(handles.map((h) => h.task_id));
  const cited = [...new Set([...answer.matchAll(/\[([A-Za-z0-9_-]{1,24})\]/g)].map((m) => m[1]))];
  const used = cited.filter((c) => known.has(c));
  const unsupported = cited.filter((c) => !known.has(c));
  trace.citationCheck = { cited, used, unsupported, uncitedHandles: [...known].filter((k) => !cited.includes(k)) };
  console.log("\nCITATION CHECK:", JSON.stringify(trace.citationCheck, null, 2));

  writeFileSync(new URL("./run.json", import.meta.url), JSON.stringify(trace, null, 2));
  console.log("\ntrace written to goldens/plan/run.json");
}

main().catch((err) => { console.error(err); process.exit(1); });
