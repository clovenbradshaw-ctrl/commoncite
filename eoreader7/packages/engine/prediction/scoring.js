// eoreader6 · prediction/scoring — proper scoring rules.
//
// Re-earned from eoreader5's packages/engine/prediction/scoring. The rules
// themselves are mathematics and do not change between repos; what is re-earned
// is the refusal discipline, which lands exactly on SEED.md #7 ("refusal has
// two tiers: type error before null"). A malformed distribution is an algebra
// violation and THROWS. A well-formed distribution whose kind has no proper
// rule is not an error — it returns { loss: null, proper: false } and the
// caller must decide, in the open, whether to fall back to a point loss. A
// point forecast is never laundered into a proper score.
//
// The predictive output is a tagged union so one reveal path serves every
// modality this engine perceives:
//
//   { kind: "point",       value }                    — a bare point estimate
//   { kind: "gaussian",    mean, sd }                 — a continuous density
//   { kind: "categorical", probs: { label: p, ... } } — a finite event mass
//   { kind: "quantiles",   levels: [{ tau, value }] } — predictive quantiles
//   { kind: "samples",     values: [n, ...] }         — an empirical ensemble
//   { kind: "sequence",    steps: [categorical, ...] } — a committed continuation
//
// "samples" matters more here than it did in v5: a nul ground IS an empirical
// ensemble — `ground().samples` is already a sorted draw from a constructed
// nothing — so this is the kind by which this engine's own organs enter a
// scored comparison at all. See ./candidates.js.
//
// "sequence" is the generation kind, added when `generation/` was built. It is
// deliberately NOT a new scoring mechanism: a sequence is a list of committed
// categoricals, and its loss is the sum of their log-losses, which is the
// joint log-loss of the continuation under the chain rule. Nothing here knows
// or cares whether those categoricals were produced free-running or
// teacher-forced — that distinction is real and load-bearing, and it is
// enforced where it belongs, on the task record, not smuggled into a score.
//
// Pure: no clock, no randomness, no I/O, no ambient state.

const TWO_PI = Math.PI * 2;

const assertFinite = (value, label) => {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`scoring: ${label} must be a finite number`);
};

const assertDistribution = (dist) => {
  if (!dist || typeof dist !== "object" || Array.isArray(dist))
    throw new TypeError("scoring: predictive output must be an object");
  if (typeof dist.kind !== "string") throw new TypeError("scoring: predictive output needs a kind");
};

const normalPdf = (y, mean, sd) => {
  const z = (y - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(TWO_PI));
};

/** Standard normal cdf, Abramowitz & Stegun 7.1.26. */
const normalCdf = (x) => {
  const t = 1 / (1 + (0.3275911 * Math.abs(x)) / Math.SQRT2);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(x * x) / 2);
  return 0.5 * (1 + Math.sign(x) * y);
};

const stdNormalPdf = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(TWO_PI);

const improper = (rule, kind, note) => Object.freeze({ rule, loss: null, proper: false, kind, note });

/**
 * Logarithmic loss: −log p(observed). Lower is better. Proper for a density or
 * a finite mass; undefined for anything else, and reported as such.
 */
export const logLoss = (dist, observed) => {
  assertDistribution(dist);
  if (dist.kind === "gaussian") {
    assertFinite(dist.mean, "gaussian.mean");
    assertFinite(dist.sd, "gaussian.sd");
    if (dist.sd <= 0) throw new RangeError("scoring: gaussian.sd must be positive");
    assertFinite(observed, "observed");
    const density = normalPdf(observed, dist.mean, dist.sd);
    // log(0) underflow: the loss is enormous but must stay finite, or one
    // unlucky step would make every cumulative comparison downstream NaN.
    return Object.freeze({
      rule: "log-loss",
      loss: density > 0 ? -Math.log(density) : -Math.log(Number.MIN_VALUE),
      proper: true,
      kind: dist.kind,
    });
  }
  if (dist.kind === "categorical") {
    const p = dist.probs?.[observed];
    if (typeof p !== "number" || p < 0)
      throw new TypeError(`scoring: categorical output has no probability for ${JSON.stringify(observed)}`);
    return Object.freeze({
      rule: "log-loss",
      loss: p > 0 ? -Math.log(p) : -Math.log(Number.MIN_VALUE),
      proper: true,
      kind: dist.kind,
    });
  }
  return improper("log-loss", dist.kind, `log-loss undefined for a ${dist.kind} output`);
};

/** Brier: sum over labels of (p_k − 1[observed = k])². Lower is better; proper for a categorical. */
export const brierScore = (dist, observed) => {
  assertDistribution(dist);
  if (dist.kind !== "categorical") return improper("brier", dist.kind, "brier requires a categorical output");
  const probs = dist.probs ?? {};
  let loss = 0;
  for (const label of Object.keys(probs)) {
    assertFinite(probs[label], `probs.${label}`);
    loss += (probs[label] - (label === observed ? 1 : 0)) ** 2;
  }
  // An observed label that carried no probability at all still costs (0 − 1)².
  if (!(observed in probs)) loss += 1;
  return Object.freeze({ rule: "brier", loss, proper: true, kind: dist.kind });
};

/**
 * Continuous Ranked Probability Score. Closed form for a gaussian, empirical
 * estimator for an ensemble. Lower is better; proper.
 *
 * CRPS is the rule the comparisons in this repo default to, for a reason that
 * is about nul rather than about taste: a ground-derived candidate emits a
 * spread it derived itself, and an early, momentarily miscalibrated spread
 * sends log-loss to a near-infinite value that dominates every later step of a
 * cumulative sum. CRPS is in the units of the observable and degrades
 * gracefully, so a candidate that is well-located but badly scaled is
 * penalised proportionately instead of being annihilated by one step.
 */
export const crps = (dist, observed) => {
  assertDistribution(dist);
  // The kind is checked BEFORE the observation. This module's contract is that
  // a well-formed distribution whose kind has no proper rule returns improper
  // rather than throwing; checking `observed` first inverted that for every
  // non-numeric kind, so scoring a well-formed `sequence` emission by crps
  // threw "observed must be a finite number" instead of reporting, correctly,
  // that crps does not apply to it. Found by conformance/generation.test.js.
  if (dist.kind !== "gaussian" && dist.kind !== "samples")
    return improper("crps", dist.kind, "crps requires a gaussian or samples output");
  assertFinite(observed, "observed");
  if (dist.kind === "gaussian") {
    assertFinite(dist.mean, "gaussian.mean");
    assertFinite(dist.sd, "gaussian.sd");
    if (dist.sd <= 0) throw new RangeError("scoring: gaussian.sd must be positive");
    const z = (observed - dist.mean) / dist.sd;
    return Object.freeze({
      rule: "crps",
      loss: dist.sd * (z * (2 * normalCdf(z) - 1) + 2 * stdNormalPdf(z) - 1 / Math.sqrt(Math.PI)),
      proper: true,
      kind: dist.kind,
    });
  }
  if (dist.kind === "samples") {
    const xs = dist.values;
    if (!Array.isArray(xs) || xs.length === 0) throw new TypeError("scoring: samples.values must be non-empty");
    // CRPS = E|X − y| − ½E|X − X'|, over the ensemble.
    let term1 = 0;
    for (const x of xs) {
      assertFinite(x, "samples.value");
      term1 += Math.abs(x - observed);
    }
    term1 /= xs.length;
    let term2 = 0;
    for (const a of xs) for (const b of xs) term2 += Math.abs(a - b);
    term2 /= 2 * xs.length * xs.length;
    return Object.freeze({ rule: "crps", loss: term1 - term2, proper: true, kind: dist.kind });
  }
};

/** Pinball loss over the declared quantile levels. Lower is better; proper. */
export const pinballLoss = (dist, observed) => {
  assertDistribution(dist);
  // Kind before observation, for the same reason as crps above.
  if (dist.kind !== "quantiles" || !Array.isArray(dist.levels) || dist.levels.length === 0)
    return improper("pinball", dist.kind, "pinball requires a quantiles output");
  assertFinite(observed, "observed");
  let loss = 0;
  for (const { tau, value } of dist.levels) {
    assertFinite(tau, "quantile tau");
    assertFinite(value, "quantile value");
    if (tau <= 0 || tau >= 1) throw new RangeError("scoring: quantile tau must be in (0, 1)");
    const diff = observed - value;
    loss += diff >= 0 ? tau * diff : (tau - 1) * diff;
  }
  return Object.freeze({ rule: "pinball", loss: loss / dist.levels.length, proper: true, kind: dist.kind });
};

/**
 * Joint log-loss of a committed continuation: Σ_t −log p(observed_t).
 *
 * Proper, by the chain rule, provided every step's categorical was committed
 * before that step's target was revealed — which the commitment seal and the
 * leakage guard in ./commitments.js are what enforce. This function assumes it
 * and cannot check it; that is the division of labour, not an oversight.
 *
 * THE UNSEEN RESERVE, AND THE LOOPHOLE IT OPENS IF LEFT ALONE. A belief built
 * causally from material read so far will regularly be asked to score a form
 * it has never met. Renormalising over the forms it happens to know would make
 * it claim it could place anything, which is a zero-width null wearing a
 * probability's coat (SEED.md #3). So an emission may declare `unseen_label`:
 * the key under which it parked the mass for "a form I have not met."
 *
 * That alone is exploitable, and was exploited by an emitter in this repo's
 * own baseline suite before it was caught. `baseline:copy-previous` put a
 * sliver of mass on the form it was copying and ALL the rest on the reserve;
 * every target it failed to copy then collected nearly the whole reserve and
 * cost it almost nothing, and it beat every real belief on the first run. The
 * reserve had quietly become a bucket for "any word other than my guess,"
 * which is the opposite of what it is for.
 *
 * So the fallback is conditional on `covers_vocabulary`: an emission may route
 * an absent target to its reserve ONLY if it asserts that every form it has
 * met appears in every step's support. Under that assertion a missing key
 * really does mean unmet. An emission that does not assert it takes the finite
 * floor for a missing target, which is the correct price for having declined
 * to place mass on a form it knew about.
 *
 * Length is checked, not truncated. Scoring a 5-token continuation against a
 * 3-token target by quietly stopping at 3 would make a short guess cheaper
 * than a long one, which rewards exactly the wrong thing.
 */
export const sequenceLogLoss = (dist, observed) => {
  assertDistribution(dist);
  if (dist.kind !== "sequence") return improper("sequence-log-loss", dist.kind, "requires a sequence output");
  if (!Array.isArray(dist.steps) || dist.steps.length === 0)
    throw new TypeError("scoring: sequence.steps must be a non-empty array");
  if (!Array.isArray(observed))
    throw new TypeError("scoring: a sequence output must be scored against an array of observed forms");
  if (observed.length !== dist.steps.length)
    throw new RangeError(
      `scoring: horizon mismatch — committed ${dist.steps.length} steps, revealed ${observed.length} targets`,
    );

  const FLOOR = -Math.log(Number.MIN_VALUE);
  let loss = 0;
  let unplaced = 0;
  for (let i = 0; i < dist.steps.length; i++) {
    const step = dist.steps[i];
    if (!step || step.kind !== "categorical" || !step.probs)
      throw new TypeError(`scoring: sequence.steps[${i}] must be a categorical output`);
    let p = step.probs[observed[i]];
    if (typeof p !== "number" && dist.unseen_label != null && dist.covers_vocabulary === true) {
      p = step.probs[dist.unseen_label];
      unplaced++;
    }
    if (typeof p !== "number") {
      loss += FLOOR;
      unplaced++;
      continue;
    }
    if (p < 0) throw new RangeError(`scoring: sequence.steps[${i}] has a negative probability`);
    loss += p > 0 ? -Math.log(p) : FLOOR;
  }
  return Object.freeze({
    rule: "sequence-log-loss",
    loss,
    proper: true,
    kind: dist.kind,
    steps: dist.steps.length,
    unplaced,
    ...(unplaced > 0 ? { note: `${unplaced} of ${dist.steps.length} targets fell outside the committed support` } : {}),
  });
};

/** The mode of each committed step — what the emitter would actually say. */
const emittedForms = (dist) =>
  dist.steps.map((step) => {
    let best = null;
    let bestP = -1;
    for (const form in step.probs) {
      if (dist.unseen_label != null && form === dist.unseen_label) continue;
      if (step.probs[form] > bestP) {
        bestP = step.probs[form];
        best = form;
      }
    }
    return best;
  });

/**
 * How many leading forms the emission got right before its first mistake.
 * Reported as a LOSS (horizon − agreement) so lower stays better everywhere,
 * and improper, because nothing stops a degenerate emitter from gaming it.
 */
export const prefixAgreement = (dist, observed) => {
  assertDistribution(dist);
  if (dist.kind !== "sequence") return improper("prefix-agreement", dist.kind, "requires a sequence output");
  const forms = emittedForms(dist);
  let agreed = 0;
  while (agreed < forms.length && agreed < observed.length && forms[agreed] === observed[agreed]) agreed++;
  return Object.freeze({
    rule: "prefix-agreement",
    loss: forms.length - agreed,
    proper: false,
    kind: dist.kind,
    agreed,
    emitted: forms,
  });
};

/** 0 if the whole continuation matched, 1 otherwise. Improper; for reading, not for ranking. */
export const exactMatch = (dist, observed) => {
  assertDistribution(dist);
  if (dist.kind !== "sequence") return improper("exact-match", dist.kind, "requires a sequence output");
  const forms = emittedForms(dist);
  const same = forms.length === observed.length && forms.every((f, i) => f === observed[i]);
  return Object.freeze({ rule: "exact-match", loss: same ? 0 : 1, proper: false, kind: dist.kind });
};

/** Collapse any distribution to its central value. */
const pointOf = (dist) => {
  switch (dist.kind) {
    case "point":
      assertFinite(dist.value, "point.value");
      return dist.value;
    case "gaussian":
      assertFinite(dist.mean, "gaussian.mean");
      return dist.mean;
    case "samples": {
      if (!Array.isArray(dist.values) || dist.values.length === 0)
        throw new TypeError("scoring: samples.values must be non-empty");
      return dist.values.reduce((a, b) => a + b, 0) / dist.values.length;
    }
    case "quantiles": {
      const mid = dist.levels?.find((l) => l.tau === 0.5) ?? dist.levels?.[Math.floor((dist.levels.length - 1) / 2)];
      if (!mid) throw new TypeError("scoring: quantiles output has no levels");
      return mid.value;
    }
    default:
      throw new TypeError(`scoring: cannot take a point of a ${dist.kind} output`);
  }
};

/** Squared error of the central value. Not proper — flagged, never laundered. */
export const squaredError = (dist, observed) => {
  assertDistribution(dist);
  assertFinite(observed, "observed");
  return Object.freeze({ rule: "squared-error", loss: (pointOf(dist) - observed) ** 2, proper: false, kind: dist.kind });
};

/** Absolute error of the central value. Not proper — flagged, never laundered. */
export const absoluteError = (dist, observed) => {
  assertDistribution(dist);
  assertFinite(observed, "observed");
  return Object.freeze({
    rule: "absolute-error",
    loss: Math.abs(pointOf(dist) - observed),
    proper: false,
    kind: dist.kind,
  });
};

/**
 * Sequence log loss for a SCOPED emission — the live ground written out, the
 * settled ground by reference.
 *
 * ── WHY THIS IS A SEPARATE RULE AND NOT A BRANCH ──────────────────────────
 *
 * Declared as its own rule id so two runs that scored differently are visibly
 * two measurements rather than one. `sequence-log-loss` reads a materialised
 * `probs` object per step; this reads a live object plus a reference, and has
 * to be HANDED the settled ground at reveal time. Folding them together would
 * let a caller that forgot to supply the ground silently fall through to the
 * live support alone, which prices every remembered form at the floor and
 * makes a scoped emitter look catastrophically worse than it is.
 *
 * ── THE HASH IS THE TAMPER GUARD, AND IT REPLACES THE COPY ────────────────
 *
 * This is what `settled.js` was for. A horizon-20 continuation over a
 * 3,523-form vocabulary carried 70,480 probability entries, and
 * `commitPrediction` canonical-hashed all of them while `revealAndScore`
 * hashed them again — 235ms to seal what took 121ms to imagine.
 *
 * A commitment has to be tamper-evident over WHAT THE EMITTER CHOSE. The
 * settled ground is not something the emitter chose; it is what it inherited,
 * and it cannot have changed, because the material behind the fold has
 * perished. So sealing the live distribution plus the ground's content hash
 * covers exactly the emitter's freedom, and this function REFUSES a ground
 * whose hash does not match the one that was sealed. The guarantee is the
 * same; the copy is gone.
 *
 * ── AND IT MUST AGREE WITH THE UNSCOPED RULE ──────────────────────────────
 *
 * Pinned by conformance, because "the same belief, scored two ways" is exactly
 * the shape of test that caught four of the five defects in the last round of
 * this work. A scoped emission and the full emission of the same belief over
 * the same targets must produce the same loss to float equality.
 */
export const scopedSequenceLogLoss = (dist, observed, settled) => {
  if (!dist || dist.kind !== "sequence-scoped")
    return improper("scoped-sequence-log-loss", dist?.kind, "requires a scoped sequence output");
  if (!Array.isArray(dist.steps) || dist.steps.length === 0)
    throw new TypeError("scoring: sequence-scoped.steps must be a non-empty array");
  if (!Array.isArray(observed))
    throw new TypeError("scoring: a sequence output must be scored against an array of observed forms");
  if (observed.length !== dist.steps.length)
    throw new RangeError(
      `scoring: horizon mismatch — committed ${dist.steps.length} steps, revealed ${observed.length} targets`,
    );
  // A scoped emission that referenced a settled ground cannot be scored
  // without it. Refusing is the only honest move: scoring from the live
  // support alone would price every remembered form at the floor and report a
  // number that looks like a measurement.
  if (dist.settled !== null) {
    if (!settled || typeof settled.massOf !== "function")
      throw new TypeError(
        "scoring: a scoped emission referencing a settled ground must be handed that ground at reveal — its absence is not a zero",
      );
    if (settled.hash !== dist.settled.hash)
      throw new Error(
        `scoring: the settled ground supplied at reveal is not the one that was sealed (${settled.hash} vs ${dist.settled.hash}) — a perished ground cannot have changed, so this is a substitution`,
      );
  }

  const FLOOR = -Math.log(Number.MIN_VALUE);
  let loss = 0;
  let unplaced = 0;
  let reachedBack = 0;

  for (let i = 0; i < dist.steps.length; i++) {
    const step = dist.steps[i];
    if (!step || !step.live) throw new TypeError(`scoring: sequence-scoped.steps[${i}] must carry a live support`);
    // BOTH GROUNDS CONTRIBUTE, ALWAYS — the settled one is not a fallback.
    //
    // Caught by the conformance identity test, and it is the same defect shape
    // as the reserve bug in settled.js. The first version read
    // `step.live[form]` and consulted memory only when the present had no
    // entry at all. But a form the present AND the past both know receives
    // mass from both, and belief.js sums them. Taking only the live share
    // under-priced every such form — 0.045 against 0.033 on a three-form
    // target: small enough to pass for float noise, systematic enough to be
    // wrong on every common word in the language.
    const inLive = typeof step.live[observed[i]] === "number";
    let p = inLive ? step.live[observed[i]] : 0;
    if (dist.settled !== null) {
      // The same renormalisation belief.js applies to any received layer, so
      // the two paths stay one belief rather than becoming two conventions.
      if (!inLive) reachedBack++;
      const ctx = step.context ?? [];
      const admissible = 1 - settled.reserveAt(ctx);
      if (admissible > 0) p += (step.settled_mass * settled.massOf(ctx, observed[i]).mass) / admissible;
    }
    if (!(p > 0)) {
      // THE UNSEEN RESERVE, AND THE SAME CONDITION `sequenceLogLoss` PUTS ON
      // IT. A form neither the present nor the settled ground has ever met is
      // not a wrong guess, it is an unmet form, and its price is the mass the
      // emission parked for exactly that. Charging the finite floor instead
      // made ONE unmet form cost 708 nats and dominate an entire continuation:
      // measured at 815 against 81 on a twelve-form target, which is what sent
      // the scoped reader to 27 nats/form against the full reader's 7.
      //
      // Conditional on `covers_vocabulary`, because that is what makes a
      // missing key mean UNMET rather than "any word other than my guess" —
      // the loophole `baseline:copy-previous` exploited in this repo's own
      // suite before it was caught. A scoped emission may assert it: both its
      // grounds back off to order 0, so between them they place every form
      // either has met.
      if (dist.covers_vocabulary === true && typeof step.unseen_mass === "number" && step.unseen_mass > 0) {
        loss += -Math.log(step.unseen_mass);
      } else {
        loss += FLOOR;
      }
      unplaced++;
      continue;
    }
    loss += -Math.log(p);
  }

  return Object.freeze({
    rule: "scoped-sequence-log-loss",
    loss,
    proper: true,
    kind: dist.kind,
    steps: dist.steps.length,
    unplaced,
    // How often the present could not supply the target and memory was
    // consulted. A reading of the material, not a statistic about the run.
    reached_back: reachedBack,
    ...(unplaced > 0 ? { note: `${unplaced} of ${dist.steps.length} targets fell outside both the present and what it settled` } : {}),
  });
};

const SCORING_RULES = Object.freeze({
  "log-loss": logLoss,
  brier: brierScore,
  crps,
  pinball: pinballLoss,
  "squared-error": squaredError,
  "absolute-error": absoluteError,
  "sequence-log-loss": sequenceLogLoss,
  "scoped-sequence-log-loss": scopedSequenceLogLoss,
  "prefix-agreement": prefixAgreement,
  "exact-match": exactMatch,
});

/**
 * Score `observed` under `dist` by a named rule. Returns a frozen
 * { rule, loss, proper, kind, note? }. `loss` is null when the rule does not
 * apply to the emitted kind; the caller records that limitation rather than
 * treating an improper score as a proper one.
 */
export const score = (dist, observed, { rule = "crps", settled = null } = {}) => {
  const fn = SCORING_RULES[rule];
  if (!fn) throw new TypeError(`scoring: unknown scoring rule ${rule}`);
  // The settled ground is passed through rather than closed over, so a rule
  // that needs one receives it and every rule that does not is unchanged. A
  // scoped emission handed no ground raises inside its own rule rather than
  // quietly scoring from the live support alone.
  return fn(dist, observed, settled);
};
