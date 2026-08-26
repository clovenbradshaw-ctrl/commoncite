// eoreader6 · generation/conventions — what order a system's roles take,
// received and looked up, never derived.
//
//   CON · Network · Tracing   (Relate · Structure · Pattern)
//
// ── WHY THIS IS A LOOKUP AND NOT A MEASUREMENT ────────────────────────────
//
// The constitution's II.2 lists the answer almost verbatim: "knowledge about
// the material — who a name denotes, that two words name one thing, what a
// narrator calls someone, WHICH WORDS BIND A RELATION — is witness knowledge
// and belongs in priors, and it must name its giver. A missing giver is a
// wall, not a gap-in-waiting: report a typed gap, never derive."
//
// What order the roles of a system take is that kind of knowledge. It was
// tried as a derivation and the attempt is logged: `scripts/word-order.mjs`
// measured English against Basque by embedding-perturbation magnitude and got
// d = -0.37, the WRONG SIGN, with the minimal pair "the dog bit the man" /
// "the man bit the dog" sitting at cos 0.9782. Three other derivation
// mechanisms elsewhere in this lineage collapsed toward the material's own
// vocabulary at r ~ 0.974. That is the wall II.2 describes, felt from inside.
//
// So this module holds no order convention of its own. It consumes a received
// prior, and where the prior is silent it returns a typed gap.
//
// ── AND IT IS NOT NATURAL-LANGUAGE-SHAPED, WHICH TOOK TWO TRIES ───────────
//
// Recorded because the first version was exactly the failure the spec warns
// about. It keyed everything on ISO 639 language codes and WALS feature
// numbers — so "what order do the roles take" was askable of English and
// unaskable of a leitmotif, a chunk sequence or a table. II.1: if a mechanism
// can only be stated in terms of a name string or a language-specific rule,
// it is not engine. specs/surprise-as-revision.md names the same thing as
// "the remaining danger: a text-shaped universal schema."
//
// The general claim is that MATERIAL BELONGS TO A SYSTEM AND A SYSTEM HAS
// RECEIVED CONVENTIONS ABOUT THE ORDER OF ITS ROLES. A natural language is
// one instance; sonata form, a cadence, a chunk sequence and a wire format
// are others. So:
//
//   · systems are keyed by an opaque id, never by a language code
//   · ROLES ARE OPAQUE STRINGS THIS MODULE NEVER INTERPRETS. Nothing here
//     knows that "S" means subject or that "dominant" is a chord. It knows
//     there is an inventory and an order over it. That is what makes the
//     organ modality-blind rather than modality-agnostic-by-assertion.
//   · `order` may be longer than `roles` (roles recur — twelve-bar blues),
//     so nothing may assume order.length === roles.length.
//
// ── THREE STATES, AND COLLAPSING ANY TWO IS THE BUG ───────────────────────
//
//   attested + an order     the giver found a dominant order
//   attested + rigidity none  THE GIVER FOUND NO DOMINANT ORDER. A real
//                             measurement — WALS codes German this way — and
//                             categorically different from silence.
//   absent                    this prior has never heard of the system. A
//                             typed gap (III.3). NEVER a default.
//
// The failure mode this exists to prevent is specific and is the English-
// shaped bug in disguise: an engine that returns SVO for an unknown system,
// because SVO was what the developer's own language did.
//
// ── SURVEYED VERSUS STIPULATED ────────────────────────────────────────────
//
// The same disagreement between prior and material means opposite things:
//
//   surveyed    a departure is MARKED. Verse, inversion, a translator's
//               syntax, a composer breaking form. The departure is a FINDING
//               and the prior is not thereby wrong.
//   stipulated  a departure is MALFORMED, or the system was misidentified.
//               There is no marked reading of an invalid chunk sequence.
//
// An organ that pooled these would report a corrupt PNG as a bold stylistic
// choice, and a sonnet's inversion as a parse error.
//
// Pure: no clock, no I/O, no randomness. The host loads the JSON (III.2).

import { gap, isGap } from "../../../nul/index.js";

export const CELL = Object.freeze({ op: "CON", terrain: "Network", stance: "Tracing" });

export const BASIS_KINDS = Object.freeze(["surveyed", "stipulated"]);
export const RIGIDITY_KINDS = Object.freeze(["fixed", "dominant", "none"]);

/**
 * Validate and freeze a received prior.
 *
 * Refuses a prior whose systems do not name their givers, on the same terms
 * `createLayer` refuses a received layer without one. A gift whose provenance
 * was lost cannot be loaded at all, rather than loaded and quietly untracked.
 */
export const loadConventions = (prior) => {
  if (!prior || typeof prior !== "object") throw new TypeError("conventions: a prior object is required");
  if (prior.schema !== "OrderConventionPrior@1")
    throw new TypeError(`conventions: expected OrderConventionPrior@1, got ${prior.schema}`);
  if (!prior.systems || typeof prior.systems !== "object")
    throw new TypeError("conventions: a prior must carry a systems map");

  for (const [id, s] of Object.entries(prior.systems)) {
    if (typeof s.giver !== "string" || !s.giver)
      throw new TypeError(`conventions: system ${id} names no giver — a prior is a gift (SEED.md #1, II.2)`);
    if (!BASIS_KINDS.includes(s.basis))
      throw new TypeError(
        `conventions: system ${id} must declare basis as ${BASIS_KINDS.join(" | ")} — a surveyed departure is marked and a stipulated one is malformed, and they are never defaulted between`,
      );
    if (!RIGIDITY_KINDS.includes(s.rigidity))
      throw new TypeError(`conventions: system ${id} must declare rigidity as ${RIGIDITY_KINDS.join(" | ")}`);
    if (!Array.isArray(s.roles) || s.roles.length === 0)
      throw new TypeError(`conventions: system ${id} must declare a role inventory`);
    if (s.rigidity === "none") {
      if (s.order !== null)
        throw new TypeError(`conventions: system ${id} has rigidity none and must carry order: null — "no dominant order" is a measurement, not a hidden order`);
    } else if (!Array.isArray(s.order) || s.order.length === 0) {
      throw new TypeError(`conventions: system ${id} declares rigidity ${s.rigidity} and must carry an order`);
    }
    // Roles recur in an order (twelve-bar blues), so this is a subset check
    // and never a length check.
    if (Array.isArray(s.order)) {
      const inventory = new Set(s.roles);
      for (const r of s.order)
        if (!inventory.has(r)) throw new TypeError(`conventions: system ${id} orders role ${r} which is not in its inventory`);
    }
  }
  return Object.freeze({
    id: prior.id,
    provenance: prior.provenance,
    systems: prior.systems,
    implications: Array.isArray(prior.implications) ? prior.implications : [],
  });
};

/**
 * What order does this system's roles take?
 *
 * Returns one of three things and never a fourth:
 *   { order: [...], rigidity }        the giver found one
 *   { order: null, rigidity: "none" } THE GIVER FOUND NONE — attested
 *   gap("unreceived_origin")          this prior has never heard of it
 *
 * The gap type is `unreceived_origin` and not `degenerate_ground`, because
 * nothing failed to be measured here. Nobody gave us this. That is the
 * distinction II.2 draws between a wall and a gap-in-waiting, carried into
 * the return value so a caller cannot treat the two alike.
 */
export const orderFor = (conventions, systemId) => {
  const s = conventions.systems[systemId];
  if (!s)
    return gap("unreceived_origin", {
      reason: `no giver has told this reader what order ${systemId} takes. A missing prior is a wall, not a default (II.2, III.3)`,
      system: systemId,
      known: Object.keys(conventions.systems).length,
    });
  return Object.freeze({
    system: systemId,
    modality: s.modality ?? null,
    basis: s.basis,
    giver: s.giver,
    roles: Object.freeze([...s.roles]),
    order: s.order === null ? null : Object.freeze([...s.order]),
    rigidity: s.rigidity,
    role_marking: s.role_marking ?? null,
    attested: true,
  });
};

/**
 * WHAT WOULD SATISFY THIS POSITION — the lookup half of the question this
 * whole line of work is about.
 *
 * Given the roles already filled, which role does the convention expect next?
 * Modality-blind: the roles are whatever the giver called them.
 *
 * Returns `expected` as a LIST, because a convention need not be
 * deterministic, and `null` order (rigidity "none") yields the whole
 * inventory rather than a guess — a system with no dominant order genuinely
 * expects any of its roles here, and saying so is the honest answer.
 *
 * The engine-tier counterpart is `slots.js`'s `slotExpectation`, which asks
 * the MATERIAL the same question. The two are meant to be read together and
 * to be allowed to disagree — see `compareWithMeasured`.
 */
export const expectedNext = (conventions, systemId, filled = []) => {
  const o = orderFor(conventions, systemId);
  if (isGap(o)) return o;
  if (o.order === null)
    return Object.freeze({
      system: systemId,
      expected: Object.freeze([...o.roles]),
      constrained: false,
      basis: o.basis,
      reason: "the giver found no dominant order — every role is admissible here, and that is a measurement rather than an absence",
    });

  const at = filled.length;
  // Conventions may be cyclic (a chord progression repeats); a position past
  // the end wraps rather than refusing, and says that it did.
  const wrapped = at >= o.order.length;
  const index = o.order.length > 0 ? at % o.order.length : 0;
  return Object.freeze({
    system: systemId,
    position: at,
    wrapped,
    expected: Object.freeze([o.order[index]]),
    constrained: true,
    basis: o.basis,
    rigidity: o.rigidity,
    // What a departure from this expectation would MEAN. Carried on the
    // answer so a consumer cannot lose it between here and the verdict.
    departure_means: o.basis === "stipulated" ? "malformed" : "marked",
  });
};

/**
 * Apply the prior's own implications to a system, marking what is IMPLIED.
 *
 * An implication is a gift like everything else and names its giver. What it
 * produces is never promoted to `attested`: a value Greenberg's Universal 3
 * predicts is a prediction, and a reader that could not tell it from a value
 * a linguist recorded would be laundering inference as observation.
 */
export const impliedFor = (conventions, systemId) => {
  const s = conventions.systems[systemId];
  if (!s) return gap("unreceived_origin", { reason: "unknown system", system: systemId });
  const out = [];
  for (const rule of conventions.implications) {
    if (rule.scope && rule.scope !== s.modality) continue;
    if (!Array.isArray(s.order)) continue;
    const w = rule.when ?? {};
    let fires = true;
    if (w.order_starts_with !== undefined) fires = fires && s.order[0] === w.order_starts_with;
    if (w.object_precedes_verb !== undefined) {
      const iO = s.order.indexOf("O");
      const iV = s.order.indexOf("V");
      fires = fires && iO >= 0 && iV >= 0 && (iO < iV) === w.object_precedes_verb;
    }
    if (!fires) continue;
    for (const [feature, value] of Object.entries(rule.then ?? {})) {
      const attestedValue = s.features?.[feature];
      out.push(
        Object.freeze({
          feature,
          value,
          status: "implied",
          giver: rule.giver,
          strength: rule.strength ?? null,
          // Where the giver ALSO attested a value, the two are reported side
          // by side rather than merged. Agreement is corroboration and
          // disagreement is a finding; neither is an average (II.8).
          attested: attestedValue ?? null,
          agrees: attestedValue === undefined ? null : attestedValue === value,
        }),
      );
    }
  }
  return Object.freeze({ system: systemId, implied: Object.freeze(out) });
};

/**
 * The prior meets the material, and the disagreement is kept.
 *
 * SEED.md #6: plural grounds for one figure are legal, and their disagreement
 * is the only self-check. II.6: bring your priors and let them be adjusted —
 * "a reading that leaves the interpreter's ground unchanged is a tour, not an
 * encounter."
 *
 * `measured` is whatever the engine established about THIS material's order
 * rigidity, on its own null. This function does not compute it and must not:
 * it holds the two grounds side by side and refuses to resolve them.
 *
 * The verdict vocabulary is deliberately not "correct/incorrect":
 *
 *   corroborated  the material does what the giver said this system does
 *   marked        surveyed prior, material departs. A FINDING about this
 *                 material — verse, inversion, a composer breaking form —
 *                 and NOT evidence the prior is wrong.
 *   malformed     stipulated prior, material departs. The material is
 *                 invalid, or the system was misidentified.
 *   unconstrained the giver found no dominant order, so there is nothing to
 *                 depart from and the material's own rigidity stands alone.
 */
export const compareWithMeasured = ({ conventions, systemId, measured }) => {
  const o = orderFor(conventions, systemId);
  if (isGap(o)) return o;
  if (!measured || typeof measured.rigid !== "boolean")
    return gap("unknown_spec", {
      reason: "a comparison needs a measured rigidity carrying its own null — this module measures nothing",
    });

  let verdict;
  if (o.rigidity === "none") verdict = "unconstrained";
  else if (measured.rigid) verdict = "corroborated";
  else verdict = o.basis === "stipulated" ? "malformed" : "marked";

  return Object.freeze({
    system: systemId,
    verdict,
    prior: Object.freeze({ order: o.order, rigidity: o.rigidity, basis: o.basis, giver: o.giver }),
    measured: Object.freeze({ ...measured }),
    // Both grounds are retained verbatim. Nothing here overwrites the prior
    // with the measurement or the measurement with the prior; a caller that
    // wants one number has to declare which and why (II.8, no averaging of
    // grounds).
    resolved: false,
    note:
      verdict === "marked"
        ? "the material departs from a SURVEYED convention: this is a finding about the material, not a correction to the gift"
        : verdict === "malformed"
          ? "the material departs from a STIPULATED convention: it is invalid, or the system was misidentified"
          : null,
  });
};
