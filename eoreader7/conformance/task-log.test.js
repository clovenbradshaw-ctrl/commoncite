// eoreader6 · task-log — conformance for the re-earned append-only log.
//
// Ported from eochat/server/task-log.test.js (now legacy — constitution
// Article I.2), re-pointed at this package's own operators.js instead of a
// duplicate, and extended for what re-earning changed: `isProductionOrder`
// must agree with the real `validateChain`/`OPERATOR_ORDER`, not an invented
// ordinal table, and `deriveLevels`'s existence-dependency must stay honestly
// DECLARED rather than silently upgrading to a measured claim it has not
// earned (see holon/task-log.js's own header).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createTaskLog, append, projectTasks, deriveLevels, foldToWorkingSet, produce,
  proposeDiscovered, proposeGaps, readyToSynthesize,
  isGrainProgression, isProductionOrder, checkCubeProgression, legalNextCells,
  ENTRY_KINDS, OPERATOR_BASIS, STRUCTURE_ROW, REFUSAL_OPERATOR,
} from "../packages/engine/holon/task-log.js";
import { GRAINS, OPERATOR_ORDER, cellOf, validateChain } from "../packages/engine/operators.js";

const propose = (task_id, extra = {}) => ({ kind: ENTRY_KINDS.PROPOSE, task_id, ...extra });

test("the log is append-only — a revision supersedes without erasing", () => {
  let log = createTaskLog();
  log = append(log, propose("t1", { description: "first reading" }));
  log = append(log, { kind: ENTRY_KINDS.SUPERSEDE, task_id: "t2", supersedes: "t1", description: "revised reading" });

  const live = projectTasks(log);
  assert.deepEqual(live.map((t) => t.task_id), ["t2"]);
  assert.equal(log.entries.length, 2, "nothing was deleted from log.entries");
  assert.equal(log.entries[0].description, "first reading", "the earlier view is still answerable");
});

test("level is derived from a declared depends_on claim, never stored", () => {
  let log = createTaskLog();
  log = append(log, propose("whole"));
  log = append(log, propose("part", { depends_on: ["whole"] }));

  const { levels, relations } = deriveLevels(projectTasks(log));
  assert.equal(levels.find((l) => l.task_id === "whole").depth, 0);
  assert.equal(levels.find((l) => l.task_id === "part").depth, 1);

  const rel = relations.find((r) => r.a === "part" && r.b === "whole");
  assert.equal(rel.relation, "b-above-a");
  assert.equal(rel.earned_by, "existence-dependency");
});

test("peer is a first-class result, not a failed ranking", () => {
  let log = createTaskLog();
  log = append(log, propose("a"));
  log = append(log, propose("b"));

  const { relations } = deriveLevels(projectTasks(log));
  assert.equal(relations.length, 1);
  assert.equal(relations[0].relation, "peer");
  assert.equal(relations[0].earned_by, null);
});

test("deriveLevels reports a dependency cycle instead of flattening it to a root", () => {
  let log = createTaskLog();
  log = append(log, propose("a", { depends_on: ["c"] }));
  log = append(log, propose("b", { depends_on: ["a"] }));
  log = append(log, propose("c", { depends_on: ["b"] }));

  const { cycles } = deriveLevels(projectTasks(log));
  assert.equal(cycles.length, 1);
  assert.deepEqual([...cycles[0]].sort(), ["a", "b", "c"]);
});

test("an operator may not be carried without stating how it came to be", () => {
  const log = createTaskLog();
  assert.throws(
    () => append(log, propose("t", { operator: "SEG" })),
    /operator_basis/,
    "a bare operator is the silent default this module exists to prevent"
  );
});

test("createTaskLog defaults to admitting all nine operators — no application-specific restriction to protect", () => {
  const log = createTaskLog();
  assert.deepEqual([...log.admits].sort(), [...OPERATOR_ORDER].sort());
});

test("a log may still declare a narrower admission set explicitly", () => {
  const log = createTaskLog({ admits: STRUCTURE_ROW });
  assert.throws(
    () => append(log, propose("t", { operator: "REC", operator_basis: OPERATOR_BASIS.PRODUCED })),
    /not admitted by this log/
  );
});

test("createTaskLog refuses an admission set that is not made of real operators", () => {
  assert.throws(() => createTaskLog({ admits: ["SEG", "NOPE"] }), /not one of the nine operators/);
  assert.throws(() => createTaskLog({ admits: [] }), /non-empty/);
});

test("a task with no operator reports a gap rather than defaulting to SEG", () => {
  let log = createTaskLog();
  log = append(log, propose("t"));
  const [t] = projectTasks(log);
  assert.equal(t.operator, null);
  assert.equal(t.operator_basis, OPERATOR_BASIS.ABSENT);
  assert.match(t.operator_gap, /has been earned/);
});

test("a grain without its operator has no cell to belong to", () => {
  const log = createTaskLog();
  assert.throws(() => append(log, propose("t", { grain: "Figure" })), /operator that shares its cell/);
});

test("an unrecognized grain is a type error, never a coerced value", () => {
  const log = createTaskLog();
  assert.throws(
    () => append(log, propose("t", { operator: "SEG", operator_basis: OPERATOR_BASIS.PRODUCED, grain: "Depth" })),
    /three grains/
  );
});

test("operator + grain together resolve the full cell via THIS package's own cellOf, not a duplicate", () => {
  let log = createTaskLog();
  log = append(log, propose("t", { operator: "SEG", operator_basis: OPERATOR_BASIS.PRODUCED, grain: "Figure" }));
  const [t] = projectTasks(log);
  assert.deepEqual(t.cell, cellOf("SEG", "Figure"));
  assert.equal(t.cell.terrain, "Link");
  assert.equal(t.cell.stance, "Dissecting");
});

test("a task with an operator but no grain reports its own gap, not a fabricated cell", () => {
  let log = createTaskLog();
  log = append(log, propose("t", { operator: "CON", operator_basis: OPERATOR_BASIS.PRODUCED }));
  const [t] = projectTasks(log);
  assert.equal(t.cell, null);
  assert.match(t.grain_gap, /no grain has been earned/);
});

test("production types each entry by the rule that fired, and halts at closure", () => {
  let log = createTaskLog();
  log = append(log, propose("root", { description: "incoherent evidence" }));

  const rules = {
    SEG: (tasks) =>
      tasks
        .filter((t) => t.task_id === "root" && !tasks.some((x) => x.task_id === "root/part"))
        .map(() => ({ task_id: "root/part", depends_on: ["root"], description: "a part" })),
  };

  const { log: out, closed, halted_by, steps } = produce(log, rules);
  const live = projectTasks(out);
  const part = live.find((t) => t.task_id === "root/part");

  assert.equal(part.operator, "SEG", "the type is the rule that fired");
  assert.equal(part.operator_basis, OPERATOR_BASIS.PRODUCED);
  assert.equal(closed, true);
  assert.equal(halted_by, "operational-closure");
  assert.ok(steps >= 2);

  const { levels } = deriveLevels(live);
  assert.equal(levels.find((l) => l.task_id === "root/part").depth, 1);
});

test("produce fires rules in the ENGINE'S real OPERATOR_ORDER, not an invented one", () => {
  const fired = [];
  let log = createTaskLog();
  log = append(log, propose("seed"));

  produce(log, {
    DEF: (tasks) => { fired.push("DEF"); return tasks.some((t) => t.task_id === "g") ? [] : [{ task_id: "g", operator: undefined }]; },
    SEG: (tasks) => { fired.push("SEG"); return tasks.some((t) => t.task_id === "part") ? [] : [{ task_id: "part", depends_on: ["seed"] }]; },
  }, { maxSteps: 3 });

  // OPERATOR_ORDER = [NUL, SEG, SIG, CON, EVA, DEF, INS, SYN, REC] — SEG (index 1)
  // precedes DEF (index 5), regardless of the rule object's own key order.
  assert.equal(fired[0], "SEG");
  assert.equal(fired[1], "DEF");
});

test("closure is measured on the fold, not on how many entries were written", () => {
  const forgetful = { SEG: () => [{ task_id: "same", description: "the one task" }] };
  const out = produce(createTaskLog(), forgetful, { maxSteps: 8 });
  assert.equal(out.closed, true, "a duplicate append changes the log but not the fold");
  assert.equal(out.halted_by, "operational-closure");
  assert.equal(projectTasks(out.log).length, 1);
  assert.ok(out.steps < 8);
});

test("a runaway production reports the guard, not closure", () => {
  let log = createTaskLog();
  log = append(log, propose("seed"));
  const rules = { SYN: (tasks) => [{ task_id: `t${tasks.length}`, description: "another" }] };
  const { closed, halted_by } = produce(log, rules, { maxSteps: 5 });
  assert.equal(closed, false);
  assert.equal(halted_by, "max-steps-guard");
});

test("a live refusal prevents closure and names itself", () => {
  let log = createTaskLog();
  log = append(log, propose("whole"));
  log = proposeGaps(log, [{ task_id: "gap:unmeasured", grain: "Pattern", reason: "not yet checked", depends_on: ["whole"] }]);

  const out = produce(log, { SEG: () => [] });
  assert.equal(out.closed, false);
  assert.equal(out.halted_by, "open-gaps-remain");
  assert.deepEqual(out.open_gaps, ["gap:unmeasured"]);
  assert.equal(out.fixpoint, true, "production exhausted even though the work is not done — the two are different facts");
});

test("superseding the gap reaches operational closure", () => {
  let log = createTaskLog();
  log = append(log, propose("whole"));
  log = proposeGaps(log, [{ task_id: "gap:unmeasured", grain: "Pattern", reason: "not yet checked" }]);
  log = append(log, { kind: ENTRY_KINDS.SUPERSEDE, task_id: "answer", supersedes: "gap:unmeasured", description: "checked" });

  const out = produce(log, { SEG: () => [] });
  assert.equal(out.closed, true);
  assert.equal(out.halted_by, "operational-closure");
});

test("answering a task does not re-type it — a RESULT attaches, it does not constitute", () => {
  let log = createTaskLog();
  log = proposeGaps(log, [{ task_id: "gap", grain: "Pattern", reason: "unchecked" }]);

  const out = produce(log, {
    SYN: (tasks) => tasks.filter((t) => t.result == null).map((t) => ({ kind: ENTRY_KINDS.RESULT, task_id: t.task_id, result: "an answer" })),
  }, { maxSteps: 6 });

  const [t] = projectTasks(out.log);
  assert.equal(t.operator, "DEF", "still the refusal it was produced as");
  assert.equal(t.result, "an answer");
  assert.deepEqual(out.open_gaps, ["gap"], "only a SUPERSEDE discharges a refusal");
});

test("proposeGaps refuses a gap with no stated grain or no reason", () => {
  const log = createTaskLog();
  assert.throws(() => proposeGaps(log, [{ task_id: "g", reason: "r" }]), /must declare the grain/);
  assert.throws(() => proposeGaps(log, [{ task_id: "g", grain: "Figure" }]), /must state a reason/);
});

test("readyToSynthesize distinguishes a missing task from one with no result yet", () => {
  let log = createTaskLog();
  log = append(log, propose("done"));
  log = append(log, { kind: ENTRY_KINDS.RESULT, task_id: "done", result: "something" });
  log = append(log, propose("pending"));

  const tasks = projectTasks(log);
  assert.deepEqual(readyToSynthesize(tasks, ["done"]), { ready: true, missing: [] });
  const notYet = readyToSynthesize(tasks, ["done", "pending", "never-proposed"]);
  assert.equal(notYet.ready, false);
  assert.deepEqual(notYet.missing, [
    { task_id: "pending", reason: "no result yet" },
    { task_id: "never-proposed", reason: "not in the live fold" },
  ]);
});

test("the mouth takes a handful and says what it withheld", () => {
  let log = createTaskLog();
  for (let i = 0; i < 12; i++) {
    log = append(log, propose(`t${i}`));
    log = append(log, { kind: ENTRY_KINDS.EVIDENCE, task_id: `t${i}`, evidence: Array.from({ length: i }, (_, j) => `span:${i}:${j}`) });
  }
  const { working, withheld, withheld_ids } = foldToWorkingSet(projectTasks(log), { k: 7 });
  assert.equal(working.length, 7);
  assert.equal(withheld, 5, "truncation is reported, never silent");
  assert.equal(withheld_ids.length, 5);
});

test("isProductionOrder agrees with the real validateChain, not an invented ordinal table", () => {
  for (const a of ["NUL", "SEG", "SIG", "CON", "EVA", "DEF", "INS", "SYN", "REC"]) {
    for (const b of ["NUL", "SEG", "SIG", "CON", "EVA", "DEF", "INS", "SYN", "REC"]) {
      let expected;
      try { validateChain([a, b]); expected = true; } catch { expected = false; }
      assert.equal(isProductionOrder(a, b), expected, `${a} -> ${b}`);
    }
  }
});

test("isGrainProgression: Ground -> Figure -> Pattern is legal, the reverse is not", () => {
  assert.equal(isGrainProgression("Ground", "Figure"), true);
  assert.equal(isGrainProgression("Pattern", "Ground"), false);
  assert.equal(isGrainProgression("Figure", "Figure"), true);
});

test("isGrainProgression on an unrecognized grain is a typed absence, not a guessed verdict", () => {
  assert.equal(isGrainProgression("Depth", "Figure"), null);
});

test("proposeDiscovered requires a task_id per discovery, same discipline as append", () => {
  const log = createTaskLog();
  assert.throws(() => proposeDiscovered(log, [{ description: "no id" }]), /every discovery needs a task_id/);
});

test("checkCubeProgression flags a single thread that coarsens its own grain", () => {
  let log = createTaskLog();
  log = append(log, { kind: ENTRY_KINDS.PROPOSE, task_id: "t1", operator: "SEG", operator_basis: OPERATOR_BASIS.PRODUCED, grain: "Pattern" });
  log = append(log, { kind: ENTRY_KINDS.SUPERSEDE, task_id: "t2", supersedes: "t1", operator: "SEG", operator_basis: OPERATOR_BASIS.PRODUCED, grain: "Ground" });

  const flags = checkCubeProgression(log);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].kind, "grain-coarsened");
  assert.equal(flags[0].from, "Pattern");
  assert.equal(flags[0].to, "Ground");
});

test("checkCubeProgression flags a thread whose operator runs backward against the real dependency order", () => {
  let log = createTaskLog();
  log = append(log, { kind: ENTRY_KINDS.PROPOSE, task_id: "t1", operator: "DEF", operator_basis: OPERATOR_BASIS.PRODUCED, grain: "Ground" });
  log = append(log, { kind: ENTRY_KINDS.SUPERSEDE, task_id: "t2", supersedes: "t1", operator: "SEG", operator_basis: OPERATOR_BASIS.PRODUCED, grain: "Ground" });

  const flags = checkCubeProgression(log);
  assert.ok(flags.some((f) => f.kind === "production-order-reversed"), "SEG precedes DEF in OPERATOR_ORDER — running SEG after DEF is backward");
});

test("checkCubeProgression is silent on a clean, monotonic thread", () => {
  let log = createTaskLog();
  log = append(log, { kind: ENTRY_KINDS.PROPOSE, task_id: "t1", operator: "SEG", operator_basis: OPERATOR_BASIS.PRODUCED, grain: "Ground" });
  log = append(log, { kind: ENTRY_KINDS.SUPERSEDE, task_id: "t2", supersedes: "t1", operator: "CON", operator_basis: OPERATOR_BASIS.PRODUCED, grain: "Figure" });
  assert.deepEqual(checkCubeProgression(log), []);
});

test("checkCubeProgression does not merge threads that were never linked by supersedes", () => {
  let log = createTaskLog();
  log = append(log, { kind: ENTRY_KINDS.PROPOSE, task_id: "t1", operator: "SEG", operator_basis: OPERATOR_BASIS.PRODUCED, grain: "Pattern" });
  log = append(log, { kind: ENTRY_KINDS.PROPOSE, task_id: "t2", operator: "SEG", operator_basis: OPERATOR_BASIS.PRODUCED, grain: "Ground" });
  assert.deepEqual(checkCubeProgression(log), []);
});

// ── produce()'s trace: the bearing log, not just the sighting ─────────────

test("trace records one entry per step, entriesAdded and foldChanged both true on real progress", () => {
  let log = createTaskLog();
  log = append(log, { kind: ENTRY_KINDS.PROPOSE, task_id: "root" });
  const rules = {
    SEG: (tasks) =>
      tasks.some((t) => t.task_id === "root/part")
        ? []
        : [{ task_id: "root/part", depends_on: ["root"] }],
  };
  const { trace, steps } = produce(log, rules);
  assert.equal(trace.length, steps);
  assert.equal(trace[0].entriesAdded, 1, "one SEG entry produced on the first step");
  assert.equal(trace[0].foldChanged, true);
  assert.equal(trace[trace.length - 1].foldChanged, false, "the closing step is the one that found nothing new");
});

test("trace distinguishes churn (entries added, fold unchanged) from real progress", () => {
  let log = createTaskLog();
  log = append(log, { kind: ENTRY_KINDS.PROPOSE, task_id: "root" });
  // A rule with no idempotence guard: re-proposes the identical task every
  // step. Step 1 is real progress — "same" does not exist in the fold yet,
  // so it is a genuine new task. Step 2 re-proposes IDENTICAL content onto an
  // already-live task_id: entriesAdded is still 1 (the log grew), but
  // projectTasks' last-write-wins collapse means the live fold is byte-for-
  // byte what it already was — foldChanged is false, and THAT is the churn:
  // an entry appended that changed nothing. The OLD entries.length-only
  // comparison could not see this distinction at all.
  const churning = { SEG: () => [{ task_id: "same", description: "always the same" }] };
  const { trace, closed, halted_by } = produce(log, churning, { maxSteps: 4 });
  assert.equal(closed, true);
  assert.equal(halted_by, "operational-closure");
  assert.deepEqual(trace, [
    { step: 1, entriesAdded: 1, foldChanged: true },
    { step: 2, entriesAdded: 1, foldChanged: false },
  ]);
});

test("trace shows a branching SEG production growing before it converges — not shrinking", () => {
  let log = createTaskLog();
  log = append(log, { kind: ENTRY_KINDS.PROPOSE, task_id: "root", evidence: ["a", "b", "c", "d"] });
  // Splits by half until each part has one piece of evidence, then stops.
  // MEASURED (not assumed): total entriesAdded per step is [2, 4, 0] here —
  // it GROWS before it converges, because step 2 has TWO eligible parents
  // (root/a, root/b) splitting in parallel, not one. Frontier width can
  // outpace per-branch shrinkage; that is still bounded, healthy
  // convergence. See task-log.js's own trace doc for why "entriesAdded
  // shrinks monotonically" is the wrong universal signature to look for.
  const rules = {
    SEG: (tasks) => {
      const out = [];
      for (const t of tasks) {
        const ev = t.evidence ?? [];
        if (ev.length <= 1) continue;
        const [a, b] = [`${t.task_id}/a`, `${t.task_id}/b`];
        if (tasks.some((x) => x.task_id === a)) continue;
        const half = Math.ceil(ev.length / 2);
        out.push({ task_id: a, depends_on: [t.task_id], evidence: ev.slice(0, half) });
        out.push({ task_id: b, depends_on: [t.task_id], evidence: ev.slice(half) });
      }
      return out;
    },
  };
  const { trace, closed } = produce(log, rules, { maxSteps: 16 });
  assert.equal(closed, true, "bounded depth (evidence strictly halves) still terminates");
  assert.deepEqual(
    trace.map((s) => s.entriesAdded),
    [2, 4, 0],
    "width growth mid-run, then the real closing step — the signal that actually holds is foldChanged reaching false at all, not a monotone entriesAdded",
  );
  assert.deepEqual(trace.map((s) => s.foldChanged), [true, true, false]);
});

test("a runaway production's trace shows sustained entriesAdded through every step to the guard", () => {
  let log = createTaskLog();
  log = append(log, { kind: ENTRY_KINDS.PROPOSE, task_id: "seed" });
  const runaway = { SYN: (tasks) => [{ task_id: `t${tasks.length}`, description: "another" }] };
  const { trace, halted_by } = produce(log, runaway, { maxSteps: 5 });
  assert.equal(halted_by, "max-steps-guard");
  assert.equal(trace.length, 5, "every step ran and left a bearing, right up to the guard");
  assert.ok(trace.every((s) => s.foldChanged), "never once stabilized — this is drift, not slow convergence");
});

// ── legalNextCells: the algebra's own geometry, no classification ─────────

test("legalNextCells from SEG.Ground: every operator at or after SEG in the real dependency order, every grain at or after Ground", () => {
  // OPERATOR_ORDER = [NUL, SEG, SIG, CON, EVA, DEF, INS, SYN, REC] — SEG is
  // index 1, so everything except NUL (the ground every chain starts from
  // and nothing depends on) qualifies operator-wise.
  const cells = legalNextCells("SEG", "Ground");
  const pairs = cells.map((c) => `${c.op}.${c.grain}`).sort();
  assert.deepEqual(pairs, [
    "CON.Figure", "CON.Ground", "CON.Pattern",
    "DEF.Figure", "DEF.Ground", "DEF.Pattern",
    "EVA.Figure", "EVA.Ground", "EVA.Pattern",
    "INS.Figure", "INS.Ground", "INS.Pattern",
    "REC.Figure", "REC.Ground", "REC.Pattern",
    "SEG.Figure", "SEG.Ground", "SEG.Pattern",
    "SIG.Figure", "SIG.Ground", "SIG.Pattern",
    "SYN.Figure", "SYN.Ground", "SYN.Pattern",
  ], "NUL never appears — it fires strictly before SEG in the real dependency order");
});

test("legalNextCells narrows sharply near the end of the real order: from SYN.Pattern only REC and itself remain", () => {
  // SYN is index 7 of 8 (REC is last) — only SYN and REC qualify operator-
  // wise, and Pattern is the deepest grain, so only Pattern-grain survives.
  const cells = legalNextCells("SYN", "Pattern");
  const pairs = cells.map((c) => `${c.op}.${c.grain}`).sort();
  assert.deepEqual(pairs, ["REC.Pattern", "SYN.Pattern"],
    "Ground and Figure are both a coarsening from Pattern; DEF/EVA/INS/SEG/CON/SIG all fire before SYN");
});

test("legalNextCells from REC.Pattern (the terminal cell) admits only itself", () => {
  const cells = legalNextCells("REC", "Pattern");
  assert.equal(cells.length, 1);
  assert.equal(cells[0].op, "REC");
  assert.equal(cells[0].grain, "Pattern");
});

test("legalNextCells respects a narrowed admits set — DEF/EVA/REC never appear for a Structure-only log", () => {
  const cells = legalNextCells("SEG", "Ground", { admits: STRUCTURE_ROW });
  const ops = new Set(cells.map((c) => c.op));
  assert.deepEqual([...ops].sort(), ["CON", "SEG", "SYN"]);
});

test("legalNextCells returns real cube cells — terrain and stance included, not just the address", () => {
  const cells = legalNextCells("SEG", "Ground");
  const segGround = cells.find((c) => c.op === "SEG" && c.grain === "Ground");
  assert.equal(segGround.mode, "Differentiate");
  assert.equal(segGround.domain, "Structure");
  assert.ok(segGround.terrain, "a real terrain, not derived by this function — cellOf's own job");
  assert.ok(segGround.stance);
});

test("legalNextCells throws on an unrecognized operator or grain rather than guessing", () => {
  assert.throws(() => legalNextCells("NOPE", "Ground"), /not one of the nine operators/);
  assert.throws(() => legalNextCells("SEG", "Depth"), /not one of the three grains/);
});

test("legalNextCells knows nothing about existence-dependency — it is pure geometry, no fold argument exists to consult", () => {
  // The function's own signature is the proof: (operator, grain, { admits })
  // — no log, no tasks, no depends_on. A cell can be geometrically legal here
  // and still blocked by an incomplete prerequisite; that is a fold question
  // for readyToSynthesize/deriveLevels, never this function's to answer.
  assert.equal(legalNextCells.length, 2, "arity is (operator, grain) plus an options object — nothing fold-shaped");
});
