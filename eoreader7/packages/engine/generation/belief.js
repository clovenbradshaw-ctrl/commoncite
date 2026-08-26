// eoreader6 · generation/belief — a LAYERED belief, and every layer names its
// giver.
//
// This is the organ `emergence/surprise.js` has been half of since it was
// written. `priorContinuationNull` already samples continuations out of the
// reader's own belief — it builds the distribution, draws from it, and then
// throws the draw away and keeps the KL. Everything needed to *finish a
// sentence* was already there and was being discarded one line before it
// became an answer. This file keeps the draw.
//
// No model is trained here and none is downloaded. A belief is counts over
// forms the reader has actually met, decayed by how long ago it met them,
// interpolated across context lengths. That is all "guessing what comes next"
// has to be, and it is the same act `nul` performs everywhere else: carry
// forward a nothing that already says what would NOT surprise you, and read
// the next arrival against it. `loops/surf` states the anticipation clause in
// as many words; this is the first module that spends it forward instead of
// only checking it backward.
//
// ── THE PART THAT IS NOT ABOUT PREDICTION ──────────────────────────────────
//
// A belief may be fed by more than one text. Priors from other material make
// a reader better at continuing THIS one — that is the whole reason a person
// who has read widely finishes a sentence more often. But SEED.md #1 is not
// negotiable about what that costs:
//
//   "The first ground is received, never derived. A prior is a gift and must
//    name its giver."
//
// So a layer is `read` or `received`, a `received` layer cannot be constructed
// without a giver, and no distribution leaves this module without saying how
// much of its mass came from where. Content drawn from a foreign prior is
// legitimate fuel for a guess and is NEVER admissible as evidence about the
// material being read. Confabulation — SEED.md's first death — is precisely
// what it would be to let Dracula's word frequencies testify about
// Frankenstein because they were fluent enough to pass.
//
// THE GIFT FILLS THE SILENCE, IT NEVER OVERWRITES THE GROUND. Received layers
// enter only as backoff, weighted by how little evidence the read layer has
// for this context:
//
//   p(f | ctx) = λ · p_read(f | ctx) + (1 − λ) · p_received(f | ctx)
//   λ = c_read(ctx) / (c_read(ctx) + alpha)                    (Witten-Bell)
//
// λ is derived from the read material's own evidence, never chosen. Where the
// reader has met this context often, the gift is inaudible; where it has met
// it never, the gift is all there is. And because λ rises as the read material
// accumulates, a large foreign corpus cannot drown a small local one by being
// large — which is the failure mode a mixture weighted by corpus size would
// have had, and the reason it is not weighted that way.
//
// ── RELEVANCE IS MEASURED, NOT ASSIGNED — SEED.md AMENDMENT IV ─────────────
//
//   "A prior is relevant exactly insofar as it lowers the surprise of what is
//    encountered. Relevance is not a property of a prior. It is a property of
//    the meeting between a prior and this material, and its measure is the
//    surprise that did not happen."
//
// This module is where that clause is spent, so the amendment's four
// restrictions are this file's obligations and not background reading:
// relevance is never similarity, it must be able to decay, it needs a null,
// and it earns audibility rather than standing.
//
// That leaves the question of how the gifts divide the share they collectively
// earn. The first cut of this file split it by each gift's own evidence for
// the context, which is wrong in a way worth naming: it makes a book audible
// for KNOWING THIS CONTEXT rather than for BEING RELEVANT TO THIS TEXT. Moby
// Dick knows "of the" extremely well. That is not a qualification.
//
// So each received layer carries an earned weight, updated causally against
// the only evidence that bears on the question — how well it has been placing
// mass on what actually came next IN THIS MATERIAL:
//
//   log w_l  ←  rho · log w_l  +  log p_l(observed | context)
//   share_l  =  softmax(log w_l)
//
// This is a discounted Bayesian mixture-of-experts update, so nothing is
// chosen: a gift that keeps anticipating this text correctly compounds, and
// one that does not decays exponentially without anyone deciding it should.
// `rho` is the forgetting rate — declared, never defaulted, for the same
// reason gamma is: a prior that was relevant for one chapter and not the next
// must be able to lose the standing it earned, or relevance becomes a verdict
// passed once at the start of the book.
//
// AND RELEVANCE NEEDS A NOISE FLOOR, or "this gift earned 0.31 of the share"
// is a number with nothing underneath it. SEED.md #4: a statistic must be
// sensitive to what its perturbation destroys. A gift's relevance is only a
// finding if it beats a gift whose ORDER has been destroyed and whose
// vocabulary has not — see `shuffledGift` in ./candidates.js, and
// `relevanceReport` below, which puts the real gifts and the noise floor in
// one table so the comparison cannot be skipped.
//
// GROUNDEDNESS IS BINARY AND CARRIES NO CONSTANT. A form is grounded in this
// material iff the read layer had any evidence for it in this context at any
// order. Not "mostly read" — there is no threshold here to pick, because a
// threshold is exactly the hand-set constant `baselines.js` and `nul` both
// refuse. Attribution mass is reported alongside as a continuous quantity, for
// reading, never as a gate.
//
// Pure: no clock, no randomness, no I/O, no ambient state.

import { gap, isGap } from "../../../nul/index.js";

/** A form the belief has never met, reserved so smoothing mass has somewhere to go. */
export const UNSEEN = "\u0000UNSEEN";

// THE WHOLE TRUST BOUNDARY. Exactly two tiers, exactly this closed: `read`
// (perceived directly, from the material itself) and `received` (a witness's
// gift, named giver required — SEED.md #1). `createLayer` below throws for
// any other string, so a third tier — a "competency" or "install" tier fed
// by a reactive, projection-time network fetch, the mechanism challenge #12
// went looking for — cannot be bolted on by convention; the type itself
// refuses it. This is the same guarantee this file's own header already
// claims one line up ("no I/O, no ambient state"), stated here as the
// concrete, closed enum that makes it true rather than merely asserted, and
// held to the line permanently by conformance/local-first-boundary.test.js.
export const TIERS = Object.freeze(["read", "received"]);

/**
 * The separator inside a context key.
 *
 * Named and escaped rather than written inline, because it began life as an
 * invisible literal control character and the second place that built a key
 * spelled it as the empty string instead. The two agreed for single-form
 * contexts and disagreed for every longer one, so order-2-and-deeper lookups
 * missed silently and fell back to a shorter context — which is
 * indistinguishable, from the outside, from a belief that is merely weak.
 * Caught by the fast-path identity test in conformance, not by reading.
 *
 * It must be a character no tokenizer emits, or `the cat` and `thecat` would
 * be the same context.
 */
const CTX_SEP = "\u0001";

const ctxKey = (tokens, from, order) => (order === 0 ? "" : tokens.slice(from - order, from).join(CTX_SEP));

/**
 * One layer of belief: counts over forms at every context order 0..order,
 * decayed by recency.
 *
 * Decay is applied LAZILY — each cell records the observation index at which
 * it was last touched and is discounted by gamma^(now − then) on read. The
 * alternative, multiplying every count on every observation, is O(vocabulary)
 * per token and makes a book-length read quadratic. The arithmetic is
 * identical; only the schedule differs.
 *
 * `gamma` is the reader's fading, and it is declared for the same reason
 * `draws`, `reseeds` and `window` are declared in SEED.md: it sets the
 * resolution of something (here, of memory), and a resolution that arrives as
 * a default makes two runs incomparable while looking like it made them
 * comparable. gamma = 1 is a corpus statistic; gamma < 1 is a reader.
 */
/**
 * WHICH WORLD A LAYER'S FORMS BELONG TO.
 *
 * `other` — a foreign source. Its forms must clear the existence gate before
 *   they may be said here, because a gift can otherwise populate this book
 *   with somebody else's characters. The default, and the case the gate was
 *   built for.
 *
 * `this` — the SAME material, from an earlier standpoint. Whitehead's
 *   perished occasion, which `loops/surf` already names: "the many become one,
 *   and are increased by one", and in perishing the occasion becomes datum for
 *   the one after it. So the reader's own settled past is genuinely RECEIVED by
 *   its present — it names a giver like any gift, and the giver is this reader
 *   at an earlier here.
 *
 *   It is exempt from the attestation gate, and the exemption is definitional
 *   rather than convenient: the gate asks "is this form of this universe", and
 *   a form read earlier IN THIS MATERIAL is of this universe by construction.
 *   Requiring two givers to attest it would refuse the reader its own memory.
 */
export const WORLDS = Object.freeze(["this", "other"]);

export const createLayer = ({ id, tier, giver = null, order, gamma, alpha, abstraction = null, world = "other" }) => {
  if (typeof id !== "string" || !id) throw new TypeError("belief: a layer must have an id");
  if (!TIERS.includes(tier)) throw new TypeError(`belief: unknown tier ${tier}`);
  if (!WORLDS.includes(world)) throw new TypeError(`belief: unknown world ${world}`);
  if (tier === "received" && (typeof giver !== "string" || !giver))
    throw new TypeError("belief: a received layer must name its giver — a prior is a gift (SEED.md #1)");
  if (!Number.isInteger(order) || order < 0)
    throw new TypeError("belief: order is the reach of the context and is declared, never defaulted");
  if (!Number.isFinite(gamma) || gamma <= 0 || gamma > 1)
    throw new TypeError("belief: gamma is the reader's fading, declared in (0,1], never defaulted");
  if (!Number.isFinite(alpha) || alpha <= 0)
    throw new TypeError("belief: alpha is the smoothing reserve, declared and positive, never defaulted");
  if (abstraction !== null) {
    // An abstraction is itself a received prior — UniMorph is an external fact
    // about English, a word-class inventory is an external claim about what
    // groups with what — so it names its giver on exactly the same terms a
    // gift does (SEED.md #1). An abstraction derived FROM the read material
    // would be a different thing and is not this.
    if (typeof abstraction.of !== "function")
      throw new TypeError("belief: an abstraction must supply of(form)");
    if (typeof abstraction.id !== "string" || !abstraction.id)
      throw new TypeError("belief: an abstraction must have an id");
    if (typeof abstraction.giver !== "string" || !abstraction.giver)
      throw new TypeError("belief: an abstraction must name its giver — it is a prior like any other (SEED.md #1)");
  }

  // tables[j] : contextKey -> { succ: Map<form, cell>, total: cell }
  //
  // `abstractTables[j]` is the same structure keyed by the ABSTRACTED context
  // — lemmas, word classes, quantised contours, whatever the abstraction
  // supplies — while the successors it stores stay SURFACE forms. That
  // asymmetry is the point: it lets "he had gone" inform "she has gone"
  // without ever claiming the two are the same string, and it is what a
  // cross-modal prior would need in order to meet a text at all (SEED.md
  // Amendment IV, consequence 5 — the shared alphabet that amendment says is
  // owed and not provided by it).
  //
  // There is no abstractTables[0]: at order 0 the context is empty, so its
  // abstraction is also empty and the table would be a second copy of the
  // unigram table under a different name.
  const tables = Array.from({ length: order + 1 }, () => new Map());
  const abstractTables = abstraction ? Array.from({ length: order + 1 }, () => new Map()) : null;
  const vocabulary = new Set();
  let t = 0;

  // Abstraction is called once per distinct form, not once per occurrence: a
  // lemmatiser lookup is cheap but a book has 85,000 tokens and 8,000 types.
  const abstractCache = abstraction ? new Map() : null;
  const abstractOf = (form) => {
    if (!abstraction) return null;
    let a = abstractCache.get(form);
    if (a === undefined) {
      a = abstraction.of(form) ?? form; // a form its abstraction cannot place stands for itself
      abstractCache.set(form, a);
    }
    return a;
  };
  const abstractKey = (forms) => forms.map(abstractOf).join(CTX_SEP);

  const cellValue = (cell) => (cell ? cell.v * Math.pow(gamma, t - cell.t) : 0);

  const bump = (cell) => {
    if (!cell) return { v: 1, t };
    cell.v = cell.v * Math.pow(gamma, t - cell.t) + 1;
    cell.t = t;
    return cell;
  };

  const record = (table, key, form, pooledFrom = null) => {
    let entry = table.get(key);
    if (!entry) {
      entry = { succ: new Map(), total: null, sources: pooledFrom === null ? null : new Set() };
      table.set(key, entry);
    }
    // How many distinct SURFACE contexts collapse into this abstract one. See
    // `confidenceOf` — a pooled count is not a confident count.
    if (entry.sources) entry.sources.add(pooledFrom);
    entry.succ.set(form, bump(entry.succ.get(form)));
    entry.total = bump(entry.total);
  };

  /**
   * The count Witten-Bell is allowed to read as confidence.
   *
   * MEASURED, and the whole reason the abstract levels are usable at all.
   * Witten-Bell's share is n/(n+alpha), which is calibrated for "how many
   * times have I seen THIS context". An abstract context's n is inflated
   * purely by coarseness: "AUX VERB" is seen thousands of times because it
   * stands for thousands of different word pairs, not because anyone is
   * confident about what follows it. Read raw, lambda goes to 0.9999, the
   * abstract level swallows essentially all remaining mass, and the unigram
   * level below it — which is what actually covers the rare forms — is left
   * with 1e-4 of the mass it needs. That cost 1.6 nats/form and is what made
   * the first two attempts at this look like "abstraction does not work".
   *
   * Dividing by the number of distinct surface contexts pooled in recovers the
   * quantity the heuristic expects: evidence PER context rather than evidence
   * summed across contexts that were never the same context. Derived from the
   * table's own structure, so there is no constant to pick.
   */
  const confidenceOf = (entry, total) => (entry.sources && entry.sources.size > 0 ? total / entry.sources.size : total);

  const observeAt = (tokens, i) => {
    const form = tokens[i];
    vocabulary.add(form);
    for (let j = 0; j <= order; j++) {
      if (i - j < 0) break;
      record(tables[j], ctxKey(tokens, i, j), form);
      // The abstracted context predicts the SAME surface form.
      if (abstractTables && j >= 1)
        record(abstractTables[j], abstractKey(tokens.slice(i - j, i)), form, ctxKey(tokens, i, j));
    }
    t++;
  };

  /**
   * The backoff chain, in one place.
   *
   * Every consumer — `successors`, `massOf`, `evidence` — walks the same
   * sequence of tables, so there is exactly one definition of what backing off
   * MEANS. The previous shape had the walk written out three times, and they
   * drifted: two spelled the context separator one way and the third spelled
   * it another, which silently broke every multi-form lookup. One walk, three
   * readers.
   *
   * Order: at each context length, the EXACT context first, then its
   * abstraction. A specific match always outranks a general one of the same
   * reach, and both outrank anything shorter.
   */
  const chain = function* (context) {
    const reach = Math.min(order, context.length);
    for (let j = reach; j >= 1; j--) {
      const entry = tables[j].get(context.slice(context.length - j).join(CTX_SEP));
      if (entry) yield entry;
    }
    // MEASURED: the abstract levels come after the ENTIRE surface chain, not
    // interleaved with it at matching reach.
    //
    // Interleaving was the first design and it is worse at every training size
    // tested — 0.61 nats/form worse at 1k forms of training, 2.16 worse at 40k,
    // getting steadily worse as the reader accumulates. The cause is not the
    // abstraction, it is Witten-Bell meeting a pooled table: `share` rises with
    // a level's own count, and an abstract context is seen far more often than
    // any of its members SOLELY BECAUSE IT IS COARSER. So the pooled level read
    // as highly confident, took a large share immediately after the exact match
    // at the same reach, and starved the more informative surface levels below
    // it. High count meant "this is general", and the heuristic read it as
    // "this is reliable".
    //
    // Ranked last, the abstraction can only ever spend what the surface chain
    // did not — which is the same principle that governs a received layer
    // against the read one, and for the same reason.
    if (abstractTables) {
      for (let j = reach; j >= 1; j--) {
        const entry = abstractTables[j].get(abstractKey(context.slice(context.length - j)));
        if (entry) yield entry;
      }
    }
    const unigram = tables[0].get("");
    if (unigram) yield unigram;
  };

  /**
   * Successor distribution at the deepest context this layer has evidence for,
   * interpolated down through shorter contexts. Returns a Map form -> mass
   * summing to at most 1; the residue is this layer's unseen reserve, returned
   * separately so a caller can place it rather than discover it missing.
   */
  const successors = (context) => {
    const out = new Map();
    let remaining = 1;
    for (const entry of chain(context)) {
      const total = cellValue(entry.total);
      if (!(total > 0)) continue;
      // Witten-Bell: how much of this level's mass it has earned the right to
      // keep, derived from its own evidence rather than assigned.
      const conf = confidenceOf(entry, total);
      const share = remaining * (conf / (conf + alpha));
      for (const [form, cell] of entry.succ) {
        const p = cellValue(cell) / total;
        if (p > 0) out.set(form, (out.get(form) ?? 0) + share * p);
      }
      remaining -= share;
      if (remaining <= 0) break;
    }
    return { successors: out, reserve: Math.max(0, remaining) };
  };

  return {
    id,
    tier,
    giver,
    world,
    order,
    gamma,
    alpha,
    /** Feed the layer a whole token array. Contexts never straddle the call boundary. */
    train(tokens) {
      for (let i = 0; i < tokens.length; i++) observeAt(tokens, i);
      return this;
    },
    /** Feed one more token, with the context it arrived in. */
    observe(tokens, i) {
      observeAt(tokens, i);
      return this;
    },
    /** Forget everything. A new ambient ground begins here — REC · Cultivating. */
    reset() {
      for (const table of tables) table.clear();
      vocabulary.clear();
      t = 0;
      return this;
    },
    successors,
    /**
     * The mass this layer puts on ONE form, without materialising the whole
     * distribution.
     *
     * Algebraically identical to reading `successors(context).get(form)` — the
     * same interpolation, the same Witten-Bell shares — but O(order) lookups
     * instead of O(vocabulary) iterations. That difference is not a
     * micro-optimisation: `candidates.js` needs a causal surprisal for EVERY
     * token it consumes in order to feed atmosphere, and doing that through
     * the full distribution made a book-length read quadratic in vocabulary
     * (measured: ~1.3e9 map iterations on Frankenstein, before this existed).
     */
    massOf(context, form) {
      let mass = 0;
      let remaining = 1;
      for (const entry of chain(context)) {
        const total = cellValue(entry.total);
        if (!(total > 0)) continue;
        const conf = confidenceOf(entry, total);
        const share = remaining * (conf / (conf + alpha));
        const cell = entry.succ.get(form);
        if (cell) mass += (share * cellValue(cell)) / total;
        remaining -= share;
        if (remaining <= 0) break;
      }
      // The leftover is this layer's unseen reserve, returned alongside so a
      // caller scoring a form the layer never met can price it the same way
      // `successors` would, instead of taking the zero-probability floor.
      return { mass, reserve: Math.max(0, remaining) };
    },
    /** Evidence this layer holds for `context` at its deepest matching order. */
    evidence(context) {
      for (const entry of chain(context)) {
        const total = cellValue(entry.total);
        if (total > 0) return total;
      }
      return 0;
    },
    abstraction: abstraction ? Object.freeze({ id: abstraction.id, giver: abstraction.giver }) : null,
    /** Has this layer ever met this form? The existence gate consults it. */
    has: (form) => vocabulary.has(form),
    get vocabularySize() {
      return vocabulary.size;
    },
    get observations() {
      return t;
    },
  };
};

/**
 * A belief over one read layer and any number of received ones.
 *
 * Exactly one `read` layer is required. Not zero — a belief with no read layer
 * is a belief about nothing in particular, and everything it emitted would be
 * ungrounded by construction, which is a system that can only confabulate. Not
 * two — "the material being read" is one thing, and two of them would make
 * groundedness ambiguous at precisely the moment it is load-bearing.
 */
export const createBelief = ({ layers, rho, referents = null }) => {
  if (!Array.isArray(layers) || layers.length === 0) throw new TypeError("belief: at least one layer is required");
  const read = layers.filter((l) => l.tier === "read");
  if (read.length !== 1)
    throw new TypeError(`belief: exactly one read layer is required, got ${read.length}`);
  const received = layers.filter((l) => l.tier === "received");
  const readLayer = read[0];

  // The forgetting rate of relevance. Required exactly when there is more than
  // one gift to choose between — with none, or one, there is no share to
  // divide and demanding the number would be ceremony.
  if (received.length > 1 && (!Number.isFinite(rho) || rho <= 0 || rho > 1))
    throw new TypeError(
      "belief: rho is the forgetting rate of relevance, declared in (0,1], never defaulted — without it a prior's standing is a verdict passed once at the start of the book",
    );

  // log w_l, one per received layer, all equal at the start: before this
  // reader has met any of this material, no gift has earned anything and
  // pretending otherwise would be a prior on the priors that nobody declared.
  /**
   * THE EXISTENCE GATE — may a gift say this form at all?
   *
   * Admitted if this book has met it, OR if at least two independent givers
   * attest it.
   *
   * The first version of this gate admitted only forms the read text had
   * already met, and that was too strict in a way that defeats the point of
   * having read anything else: a reader confined to the vocabulary of the book
   * in front of it can never learn a word, and "having read widely" would buy
   * nothing but reordering. What actually went wrong on real material was
   * narrower — reading Frankenstein against Moby-Dick produced `peleg`, a
   * named individual who exists in exactly one world.
   *
   * So the question is not "is this word ours" but "is this word OF THIS
   * UNIVERSE", and SEED.md #6 already says how to ask it: plural grounds, and
   * their disagreement is the only self-check. A form only one giver attests
   * is that giver's own — its characters, its places, its proper names. A form
   * several independent givers attest is the shared world's, and borrowing it
   * is how a reader's vocabulary grows at all.
   *
   * The threshold is structural rather than tuned: one versus more than one,
   * the same singleton/plural distinction the repo uses everywhere instead of
   * a hand-set constant. Noise controls are excluded from attestation — a
   * shuffled gift carries its source's vocabulary exactly, so counting it
   * would let a single giver attest itself twice and vote its own referents in.
   */
  const attestors = new Map();
  const sources = received.filter((l) => !l.id.startsWith("shuffled:") && l.world !== "this");
  const isReferent = typeof referents === "function" ? referents : (f) => referents?.has?.(f) === true;
  // The reader's own perished past. Received, and of THIS world — so it is
  // neither an attestor (it cannot vote a foreign referent in) nor subject to
  // the gate (its forms came from this material and need no visa). See
  // `WORLDS` above; without this a reader scoped to a live wave could not
  // reach its own memory, because one giver can never satisfy `n >= 2`.
  const selfPast = received.filter((l) => l.world === "this");

  const attestedBy = (form) => {
    let n = attestors.get(form);
    if (n === undefined) {
      n = 0;
      for (const l of sources) if (l.has(form)) n++;
      attestors.set(form, n);
    }
    return n;
  };

  const admits = (form) => {
    if (readLayer.has(form)) return true; // our own world, referents included
    // A form this same reader met earlier in this same material. Of this
    // universe by construction, so the gate has nothing to protect against.
    for (const l of selfPast) if (l.has(form)) return true;
    // A REFERENT DOES NOT CROSS. Attestation by two givers is the right bar for
    // ordinary vocabulary and much too weak here: `elizabeth`, `london` and
    // `god` are attested by several worlds and are exactly the things that must
    // not travel. A name is the existence tier — it picks out a particular in
    // one world — and importing it does not enrich this book's vocabulary, it
    // populates this book with somebody else's characters.
    //
    // "Or at least require very high intensity" has a reading here that costs
    // no constant: climb the ladder of structural quantifiers rather than pick
    // a number. One giver, more than one, ALL of them. A referent every
    // independent world attests is not really a referent of any of them — it is
    // furniture of the shared world (`god`, `england`) — and unanimity is the
    // strongest bar expressible without inventing a threshold.
    const n = attestedBy(form);
    return isReferent(form) ? sources.length > 0 && n === sources.length : n >= 2;
  };

  const logW = new Map(received.map((l) => [l.id, 0]));
  const relevanceObservations = { n: 0 };
  // The discounted count of encounters the weights are a sum over: Z <- rho*Z + 1.
  // See `shares` — without it the weights are a SUM and the mixture saturates.
  let discountedZ = 0;

  /**
   * softmax over each gift's MEAN log-likelihood per encounter.
   *
   * MEASURED. The first version took the softmax over the discounted SUM, and
   * on a real book that is degenerate: the sum's scale grows with the
   * effective window (1/(1 − rho)), so after a few thousand forms the gaps
   * between gifts are hundreds of nats, `exp` underflows, and the mixture
   * collapses to one-hot. Reading Frankenstein against three gifts it reported
   * jane-eyre 100.00% and everything else exactly 0.00% at every checkpoint —
   * relevance had become a hard SELECTION rather than a graded mixture, and
   * restriction 2 was satisfied only on paper: a gift 300 nats ahead cannot be
   * caught by any stretch of text a book actually contains.
   *
   * Dividing by the discounted encounter count makes the quantity a per-
   * encounter mean, which is what SEED.md Amendment IV says relevance IS —
   * "the surprise that did not happen", per thing encountered, not summed over
   * everything ever read. So this is not a rescue of the arithmetic; it is the
   * arithmetic finally saying what the clause says.
   */
  const shares = () => {
    if (received.length === 0) return [];
    // A LONE GIFT IS UNGATED, AND THAT IS A HOLE RATHER THAN A SIMPLIFICATION.
    //
    // There is no share to divide between one gift and nothing, so this
    // returns 1 — and it means the gift receives the whole of `1 - lambda`
    // without ever being asked whether it earned any of it. Every restriction
    // Amendment IV places on relevance is silently skipped: no decay, no
    // noise floor, no measured standing.
    //
    // MEASURED, and it was invisible for as long as every run had three gifts.
    // A standpoint reader with one perished layer of 354 forms of Project
    // Gutenberg boilerplate reached back 6 times in 20 and said the
    // publisher's name, a copyright year and a page number, because at a rare
    // context lambda collapses and an unweighted lone gift takes almost
    // everything. A 192-form container ground received exactly the share a
    // 46,000-form memory would.
    //
    // The hole is not closed here, because closing it means measuring
    // relevance against a floor and a floor is something a caller SUPPLIES —
    // see `shuffledGift` in ./candidates.js. What is fixed here is the
    // silence: `relevanceReport` now declares `gated: false` so a lone gift's
    // unearned share is visible in the record instead of being a number with
    // nothing underneath it.
    if (received.length === 1) return [1];
    const z = discountedZ > 0 ? discountedZ : 1;
    const mean = received.map((l) => logW.get(l.id) / z);
    let max = -Infinity;
    for (const m of mean) max = Math.max(max, m);
    const raw = mean.map((m) => Math.exp(m - max));
    const total = raw.reduce((a, b) => a + b, 0);
    return total > 0 ? raw.map((r) => r / total) : received.map(() => 1 / received.length);
  };

  /**
   * Update every gift's standing against a form that has actually arrived.
   *
   * Causal by construction: the caller passes the context the form arrived in
   * and the form itself, and it is only ever called for material already read.
   * A gift that placed no mass at all is priced at its own unseen reserve
   * rather than at zero, so "I did not know" costs less than "I was confident
   * and wrong" — which is the ordering a proper score gives and the one that
   * stops a narrow gift from being annihilated for being narrow.
   */
  const witnessForm = (context, form) => {
    if (received.length === 0) return;
    const ctx = Array.isArray(context) ? context : [];
    for (const layer of received) {
      const { mass, reserve } = layer.massOf(ctx, form);
      const p = mass > 0 ? mass : reserve;
      const ll = p > 0 ? Math.log(p) : Math.log(Number.MIN_VALUE);
      logW.set(layer.id, (received.length > 1 ? rho : 1) * logW.get(layer.id) + ll);
    }
    discountedZ = (received.length > 1 ? rho : 1) * discountedZ + 1;
    relevanceObservations.n++;
  };

  /**
   * The conditional distribution over what comes next.
   *
   * Returns a frozen categorical plus the two things nothing downstream is
   * allowed to have to guess at: `attribution` (how much mass came from each
   * layer) and `grounded` (the set of forms the read layer itself supplied).
   */
  const distribution = (context) => {
    const ctx = Array.isArray(context) ? context : [];
    const readOut = readLayer.successors(ctx);
    const readEvidence = readLayer.evidence(ctx);

    // λ: the read material's earned share. Derived from its own evidence, on
    // the same Witten-Bell footing used inside a layer, so the gift's audibility
    // falls as the reader accumulates its own encounters with this context.
    const lambda = readEvidence / (readEvidence + readLayer.alpha);

    const probs = Object.create(null);
    const attribution = Object.create(null);
    const grounded = new Set();

    let readMass = 0;
    let giftMass = 0;
    for (const [form, p] of readOut.successors) {
      const m = lambda * p;
      if (m <= 0) continue;
      probs[form] = (probs[form] ?? 0) + m;
      grounded.add(form);
      readMass += m;
    }
    attribution[readLayer.id] = readMass;

    // Received layers split what the read layer did not earn, in proportion to
    // their own evidence for this context. Peers among themselves; strictly
    // subordinate to the read layer.
    const giftShare = 1 - lambda;
    if (giftShare > 0 && received.length > 0) {
      // Earned relevance, not context evidence. See the header: splitting by
      // evidence made a gift audible for knowing the context rather than for
      // being relevant to this text.
      const earned = shares();
      received.forEach((layer, k) => {
        const share = giftShare * earned[k];
        const out = layer.successors(ctx);
        // THE EXISTENCE GATE — see `admits`. A gift may place mass only on forms
        // of this universe, and its structure is renormalised over those.
        let admissible = 0;
        for (const [form, p] of out.successors) if (admits(form)) admissible += p;
        if (!(admissible > 0)) return; // this gift has nothing sayable here
        let mass = 0;
        for (const [form, p] of out.successors) {
          if (!admits(form)) continue;
          const m = (share * p) / admissible;
          if (m <= 0) continue;
          probs[form] = (probs[form] ?? 0) + m;
          mass += m;
          giftMass += m;
        }
        attribution[layer.id] = (attribution[layer.id] ?? 0) + mass;
      });
    }

    // Whatever no layer placed is the reserve: the mass of "a form I have never
    // met." It is named rather than normalised away, because a distribution
    // that silently renormalises has claimed it can place anything, which is a
    // zero-width null in probabilistic clothing (SEED.md #3).
    let placed = 0;
    for (const key in probs) placed += probs[key];
    const reserve = Math.max(0, 1 - placed);
    if (reserve > 0) probs[UNSEEN] = reserve;

    if (!(placed > 0) && !(reserve > 0))
      return gap("degenerate_ground", { reason: "belief placed no mass anywhere", context: ctx.length });

    return Object.freeze({
      kind: "categorical",
      probs: Object.freeze(probs),
      // True by construction, and pinned by conformance rather than trusted:
      // every layer's backoff runs down to order 0, whose context is the empty
      // string and whose successor table therefore holds every form that layer
      // has ever met. Witten-Bell's lambda is strictly below 1 at every order
      // because alpha is strictly positive, so `remaining` never reaches zero
      // early and order 0 is always reached. Hence: met implies placed.
      covers_vocabulary: true,
      attribution: Object.freeze(attribution),
      grounded: Object.freeze([...grounded]),
      read_mass: readMass,
      // Summed from what the gifts actually placed, NOT derived as
      // (placed - readMass). The subtraction accumulates float error, so a
      // read-only belief reported a received mass of ~1e-17 instead of zero —
      // and since the crossing now turns on "was any gift audible", that
      // epsilon refused every read-only continuation as testimony. A gate that
      // fires on rounding noise is worse than no gate.
      received_mass: giftMass,
      unseen_mass: reserve,
      lambda_read: lambda,
    });
  };

  /**
   * Draw the form at cumulative position `u` ∈ [0,1) of the distribution.
   *
   * The caller supplies the uniform rather than a seed, so this module stays
   * free of randomness and the PRNG lives at exactly one place upstream
   * (./emit.js), declared. The UNSEEN reserve is excluded from the draw and
   * its mass redistributed proportionally — the reserve is a statement that
   * some form was never met, and there is no such word to say.
   */
  const draw = (context, u) => {
    const d = distribution(context);
    if (isGap(d)) return d;
    let total = 0;
    for (const form in d.probs) if (form !== UNSEEN) total += d.probs[form];
    if (!(total > 0)) return gap("no_ground", { reason: "every form this belief could place was the unseen reserve" });
    let acc = 0;
    const threshold = u * total;
    let chosen = null;
    for (const form in d.probs) {
      if (form === UNSEEN) continue;
      acc += d.probs[form];
      if (acc >= threshold) {
        chosen = form;
        break;
      }
    }
    if (chosen === null) return gap("no_ground", { reason: "the draw fell off the end of the distribution" });
    return Object.freeze({
      form: chosen,
      p: d.probs[chosen] / total,
      grounded: d.grounded.includes(chosen),
      attribution: d.attribution,
      lambda_read: d.lambda_read,
    });
  };

  /**
   * The least-surprising continuation: the mode of the distribution.
   *
   * Deterministic. Right for a testimony and for a competency comparison, and
   * WRONG for a demonstration of what a reader expects — greedy argmax on a
   * backoff belief falls into cycles within a few forms, because the most
   * likely successor of the most likely successor is very often the word you
   * just left. That is a real property of the mode and not a defect to tune
   * away; it is why `draw` exists beside it and why the choice between them is
   * declared per emission rather than settled here. Ties break toward the form
   * the READ layer supplied, then lexicographically, so a run is a run.
   */
  const mode = (context) => {
    const d = distribution(context);
    if (isGap(d)) return d;
    let best = null;
    let bestP = -1;
    for (const form in d.probs) {
      if (form === UNSEEN) continue; // never emit the reserve as a word
      const p = d.probs[form];
      const isGrounded = d.grounded.includes(form);
      if (
        p > bestP ||
        (p === bestP &&
          best !== null &&
          (isGrounded !== d.grounded.includes(best) ? isGrounded : form < best))
      ) {
        best = form;
        bestP = p;
      }
    }
    if (best === null)
      return gap("no_ground", { reason: "every form this belief could place was the unseen reserve" });
    return Object.freeze({
      form: best,
      p: bestP,
      grounded: d.grounded.includes(best),
      attribution: d.attribution,
      lambda_read: d.lambda_read,
    });
  };

  /**
   * p(form | context) across the layered belief, without building the
   * distribution. Same mixture as `distribution`, same lambda, same peer
   * weighting among gifts — see `createLayer.massOf` for why this exists.
   * Returns { p, reserve }. `p` is 0 for a form no layer has met, and
   * `reserve` is the mass this belief holds for "a form I have not met" — the
   * same quantity `distribution` parks under UNSEEN, so a caller can price an
   * unmet form exactly as the full distribution would.
   */
  const probabilityOf = (context, form) => {
    const ctx = Array.isArray(context) ? context : [];
    const readEvidence = readLayer.evidence(ctx);
    const lambda = readEvidence / (readEvidence + readLayer.alpha);
    const own = readLayer.massOf(ctx, form);
    let p = lambda * own.mass;
    let reserve = lambda * own.reserve;
    const giftShare = 1 - lambda;
    if (giftShare > 0 && received.length > 0) {
      // Earned relevance, not context evidence. See the header: splitting by
      // evidence made a gift audible for knowing the context rather than for
      // being relevant to this text.
      const earned = shares();
      received.forEach((layer, k) => {
        const share = giftShare * earned[k];
        // The same existence gate `distribution` applies, and it must be the
        // same or the fast path and the full distribution stop being one
        // belief. Renormalising needs the gift's admissible total, so this is
        // O(successors) rather than O(order) whenever gifts are present — the
        // price of the gate, paid here and not hidden.
        const out = layer.successors(ctx);
        let admissible = 0;
        for (const [f, q] of out.successors) if (admits(f)) admissible += q;
        if (admissible > 0) {
          // Renormalised, so an admitted gift places its WHOLE share and keeps
          // no reserve of its own. Adding one here was the fast path's second
          // disagreement with the full distribution, and the identity test
          // caught it the same way it caught the first.
          if (admits(form)) p += (share * (out.successors.get(form) ?? 0)) / admissible;
        } else {
          reserve += share; // nothing this gift wanted to say exists in this book
        }
      });
    } else if (giftShare > 0) {
      reserve += giftShare;
    }
    return { p, reserve };
  };

  /**
   * What each gift has earned, and what a gift would earn by accident.
   *
   * Returned as a table rather than a verdict. A share is only a finding if it
   * beats the noise floor a `shuffled:` control sets, and this puts both in
   * one place so the comparison cannot be skipped by reading only the number
   * you hoped for.
   */
  const relevanceReport = () => {
    const earned = shares();
    const floor = received
      .map((l, k) => ({ l, k }))
      .filter(({ l }) => l.id.startsWith("shuffled:"))
      .reduce((m, { k }) => Math.max(m, earned[k]), 0);
    return Object.freeze({
      observations: relevanceObservations.n,
      rho: received.length > 1 ? rho : null,
      effective_encounters: discountedZ,
      // Whether any gift's share was EARNED. False for a lone gift: with
      // nothing to divide against, `shares()` returns 1 unconditionally and
      // every restriction Amendment IV places on relevance is skipped. Stated
      // rather than left to be inferred from `rho: null`, because the failure
      // it produces looks like a working reader — see `shares()`.
      gated: received.length > 1,
      ungated_reason:
        received.length === 1
          ? "a single received layer takes the whole of 1 - lambda without earning it: no decay, no noise floor, no measured standing. Supply a control (see shuffledGift) to make relevance measurable."
          : null,
      referent_gate: referents ? "referents require unanimity" : "no referent inventory supplied — nothing is treated as a name",
      noise_floor: floor > 0 ? floor : null,
      layers: Object.freeze(
        received.map((l, k) =>
          Object.freeze({
            id: l.id,
            giver: l.giver,
            share: earned[k],
            log_weight: logW.get(l.id),
            is_noise_control: l.id.startsWith("shuffled:"),
            // null when no control was supplied — an absent floor is stated,
            // never silently read as "cleared".
            above_noise: floor > 0 ? earned[k] > floor : null,
          }),
        ),
      ),
    });
  };

  /**
   * WHAT THE MIXTURE DISCARDS ON THE WAY TO ONE NUMBER.
   *
   * `distribution()`/`probabilityOf()` blend every layer into a single
   * p(form | context) by design — THE GIFT FILLS THE SILENCE, IT NEVER
   * OVERWRITES THE GROUND, see the file header — and that blend is not
   * reversed here. Reversing it would make a received layer audible exactly
   * where SEED.md #1 says it must stay silent (a context the read layer
   * already knows well), which is the load-bearing behaviour the header
   * argues for, not a bug in it.
   *
   * What the blend has never had a name for is what it disagreed about
   * BEFORE being blended. SEED.md #6: "plural grounds for one figure are
   * legal, and their disagreement is the only self-check" — `nul::disagreement`
   * already has exactly this shape for `pattern()`'s plural grounds
   * (`nul/index.js`); this is the same shape for a belief's plural layers,
   * reported rather than reconciled, same as there.
   *
   * Each layer's own surprisal for the form that actually arrived, in bits,
   * priced with the SAME mass>0?mass:reserve convention `witnessForm` (above)
   * and `candidates.js`'s regime-belief candidate already use to price an
   * unmet form — not a second, more lenient scoring rule invented for this
   * report. `spread` is the widest gap between any two layers' bits, the
   * same statistic `nul::disagreement` calls `spread`, for the same reason:
   * a number a caller can threshold or plot, not a verdict.
   *
   * This does not, by itself, distinguish a genre/register anomaly from an
   * ordinary rare proper noun — both present as "the read layer knows this
   * form here and a received layer does not." It surfaces the disagreement a
   * flat p(form | context) cannot show; it does not classify what kind of
   * disagreement it is. That is a real limit of this channel, not something
   * a bigger constant would fix.
   */
  const scaleDisagreement = (context, form) => {
    const ctx = Array.isArray(context) ? context : [];
    const bitsOf = (layer) => {
      const { mass, reserve } = layer.massOf(ctx, form);
      const p = mass > 0 ? mass : reserve;
      return p > 0 ? -Math.log2(p) : -Math.log2(Number.MIN_VALUE);
    };
    const bits = Object.freeze({
      [readLayer.id]: bitsOf(readLayer),
      ...Object.fromEntries(received.map((l) => [l.id, bitsOf(l)])),
    });
    const values = Object.values(bits);
    return Object.freeze({
      bits,
      // null, not 0, when there is nothing to disagree with — a lone read
      // layer is not "in agreement with itself", it has no peer to differ
      // from, the same distinction `nul::disagreement` draws for one ground.
      spread: values.length > 1 ? Math.max(...values) - Math.min(...values) : null,
    });
  };

  return Object.freeze({
    distribution,
    probabilityOf,
    scaleDisagreement,
    witnessForm,
    relevanceReport,
    mode,
    draw,
    // The longest context any layer can use. Callers pass histories that are
    // book-length; without this they would copy the whole history once per
    // emitted form, which turns a linear read into a quadratic one.
    maxOrder: layers.reduce((m, l) => Math.max(m, l.order), 0),
    readLayer,
    receivedLayers: Object.freeze([...received]),
    layerIds: Object.freeze(layers.map((l) => l.id)),
    /** The givers of every received layer, for the record. SEED.md #1. */
    givers: Object.freeze(received.map((l) => ({ id: l.id, giver: l.giver }))),
  });
};
