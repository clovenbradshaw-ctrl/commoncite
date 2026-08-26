// native/tests/omnimodal-kernel.test.js — the kernel is medium-blind, PROVEN
// by driving it with music and video, not asserted from its comments.
//
// S6's law is structural ("the kernel never speaks a medium's grammar; an
// arrangement has ends, not parts of speech"), and the honest test of a
// structural law is a foreign medium: if a music adapter or a video adapter
// needs ONE kernel change to read, S6 is already violated. So these tests
// import ONLY kernel modules, feed them observations shaped by two synthetic
// non-text adapters, and pin that every organ answers exactly as it does
// for text:
//
//   activation/dmdWindow — a melody's own recurrence measures a window,
//     in the melody's own fold unit (the bar), no notion of "sentence"
//   terrain-activation — a motif co-arrival lights Link/Entity/Network/
//     Field from declared terrains and ordinal ends; a video shot does the
//     same with detected beings
//   perspective — a film's POV shots project per holder exactly as a
//     novel's tellers do; mentalModel(camera-of-character) works unchanged
//
// The adapters here are deliberately tiny and synthetic: the claim under
// test is the KERNEL's blindness (structural), not any adapter's empirical
// quality on real recordings — that would be its own driver with its own
// declared assembly (S1) and real material (S2).

import test from "node:test";
import assert from "node:assert/strict";
import { createActivation, dmdWindow, gammaFor } from "../kernel/activation.js";
import { createTerrainActivation } from "../kernel/terrain-activation.js";
import { READER, STANCE, projectPerspectives, divergence, mentalModel, perspectiveOperation } from "../kernel/perspective.js";
import { deltaFold } from "../kernel/fold.js";

// ── music: a bar-by-bar observation stream ──────────────────────────────
// A 12-bar form: theme A (bars 0-3), theme B (4-7), theme A returns (8-11).
// Each bar is one observation of the pitches sounding in it — the fold unit
// is the BAR, declared by the adapter, exactly as text declares the sentence.
const BARS = [
  ["c4", "e4", "g4"], ["c4", "e4", "g4"], ["d4", "f4"], ["c4", "e4", "g4"],
  ["a3", "c4"], ["a3", "c4"], ["b3", "d4"], ["a3", "c4"],
  ["c4", "e4", "g4"], ["c4", "e4", "g4"], ["d4", "f4"], ["c4", "e4", "g4"],
];

test("music: dmdWindow measures the reach of 'what chord is sounding' in bars, no kernel change", () => {
  // The conclusion: the modal pitch of the recent stream. Short-reach by
  // construction (the present chord), so a finite window must measure.
  const modalPitch = (obs) => {
    const m = new Map();
    for (const p of obs.flat()) m.set(p, (m.get(p) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };
  const measured = dmdWindow(BARS, modalPitch, { candidates: [2, 4, 8] });
  assert.ok(measured.window != null, "a finite window measured from the music's own behavior");
  assert.equal(measured.gamma, gammaFor(measured.window));
});

test("music: activation decays per BAR — the adapter's declared fold unit, not a text unit", () => {
  const act = createActivation({ window: 4 });
  for (const bar of BARS.slice(0, 8)) act.observe(bar.map((p) => `pitch:${p}`));
  // Theme A's tonic pitch was rearticulated at bar 3 then absent through B —
  // it must have faded relative to B's own pitches, which are current.
  assert.ok(act.activationOf("pitch:a3") > act.activationOf("pitch:e4"),
    "the sounding theme is hotter than the faded one (P1, in a medium with no words)");
});

test("music: a motif co-arrival lights Link/Entity/Network/Field from declared terrain and ordinal ends", () => {
  const presence = createTerrainActivation({ window: 4 });
  // The adapter DECLARES terrain on its entries (terrain-activation's own
  // contract: "an entry that carries its own terrain is taken at its word")
  // and gives arrangements ends by ordinal position — no schema mapping,
  // no grammar, nothing text-shaped anywhere in the entry.
  const { lit, unknown } = presence.light([
    { terrain: "Entity", id: "motif:theme-a" },
    { terrain: "Link", id: "arr:answer:1", participants: [
      { standing: "referent", ref: "motif:theme-a" },
      { standing: "referent", ref: "motif:theme-b" },
    ], scope: { sequencePosition: 4 }, meta: { source: "score:12bar" } },
  ]);
  assert.deepEqual(lit.Link, ["arr:answer:1"]);
  assert.ok(lit.Entity.includes("motif:theme-a") && lit.Entity.includes("motif:theme-b"));
  assert.deepEqual(lit.Network, ["motif:theme-a|motif:theme-b"]);
  assert.deepEqual(lit.Field, ["score:12bar"]);
  assert.deepEqual(unknown, [], "nothing here needed a text schema to be placed");
});

// ── video: shots, detected beings, and point of view ────────────────────
test("video: POV shots project per holder exactly as a novel's tellers — mentalModel unchanged", () => {
  // A three-shot scene: an objective wide shot, then Ada's POV, then Bram's.
  // The adapter attributes each shot's claims to its holder; the kernel
  // neither knows nor asks what a "shot" is.
  const ops = [
    perspectiveOperation({ holder: READER, claim: "being:ada|present|scene:1", stance: STANCE.HOLDS, witness: "shot:1" }),
    perspectiveOperation({ holder: "being:ada", claim: "being:bram|holds|object:letter", stance: STANCE.HOLDS, witness: "shot:2" }),
    perspectiveOperation({ holder: READER, claim: "being:bram|holds|object:letter", stance: STANCE.HOLDS, via: ["being:ada"], witness: "shot:2" }),
    perspectiveOperation({ holder: "being:ada", claim: "being:ada|approaches|object:door", stance: STANCE.HOLDS, witness: "shot:2" }),
    perspectiveOperation({ holder: READER, claim: "being:ada|approaches|object:door", stance: STANCE.HOLDS, via: ["being:ada"], witness: "shot:2" }),
    perspectiveOperation({ holder: "being:bram", claim: "being:bram|holds|object:letter", stance: STANCE.REFUSES, witness: "shot:3" }),
    perspectiveOperation({ holder: READER, claim: "being:bram|holds|object:letter", stance: STANCE.REFUSES, via: ["being:bram"], witness: "shot:3" }),
  ];
  const projected = projectPerspectives([deltaFold(ops)]);
  const ada = mentalModel(projected, "being:ada", READER);
  // The letter claim was relayed via Ada and then SUPERSEDED by Bram's own
  // refusal reaching the reader — folding per claim is the kernel's design,
  // so the model of Ada carries the claim only SHE relayed and still holds.
  assert.ok(ada.attributed.some((h) => h.claim === "being:ada|approaches|object:door"),
    "the reader's model of Ada attributes what her POV shot showed");
  const div = divergence(projected, "being:ada", "being:bram");
  assert.ok(div.conflicting.length >= 1,
    "two POVs disagreeing about one claim is CONFLICT — the same lens arithmetic that reads a novel's tellers");
});

test("video: shot presence fades between scenes — same organ, same floor discipline", () => {
  const presence = createTerrainActivation({ window: 4 });
  presence.light([{ terrain: "Entity", id: "being:ada" }, { terrain: "Field", id: "scene:1" }]);
  for (let shot = 0; shot < 10; shot += 1) {
    presence.light([{ terrain: "Entity", id: "being:bram" }, { terrain: "Field", id: "scene:2" }]);
  }
  const now = presence.present(1);
  const entities = now.Entity.map((e) => e.id);
  assert.ok(entities.includes("being:bram") && !entities.includes("being:ada"),
    "the being on screen is present; the one ten shots gone has faded");
  assert.throws(() => presence.present(), /declared/, "the floor stays the caller's to declare in every medium");
});
