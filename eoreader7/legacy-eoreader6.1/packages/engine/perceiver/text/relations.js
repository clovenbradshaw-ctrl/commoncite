// eoreader6 · perceiver/text/relations — SVO extraction from prose.
//
// MEDIUM-SPECIFIC BY CONSTRUCTION, and that is why it lives in the perceiver.
// The organ above it (emergence/graph.js) consumes (subject, verb, object,
// polarity) triples and never learns where they came from — a video
// perceiver would supply its own triples from actor-action-target and the
// graph would not change a line.
//
// THE VOCABULARY IS DERIVED, NEVER TYPED IN. This file used to carry a
// 90-word hand-listed English verb string (`married|fought|led|wrote|...`),
// and that list was the whole terrain's bottleneck: every triple the graph
// ever saw was gated on a literal match against it, so any English prose
// that didn't happen to use one of those 90 words produced zero triples —
// zero nodes, zero edges, no Network, nothing for `induceKinds` to induce a
// Kind from. MEASURED on a civic-prose passage using ordinary verbs the list
// omitted (praised, approved, filed, briefed, lobbied, summoned): 0 triples.
// Rewriting the same sentences with verbs the list happened to contain
// (told, gave, found, knew, saw) produced a full graph. The list was not a
// simplification of English, it was a sample of it standing in for the
// whole, and every terrain built on CON·Link inherited that sample's edges.
//
// `discoverRelationVocab` replaces the list with a measurement: a candidate
// verb is the token immediately FOLLOWING a candidate referent surface
// (perceiver/text/surfaces.js::extractSurfaces — the SAME blind, capitalised-
// run detector every other organ in this ladder already uses to find the
// cast) — the slot SVO order puts a verb in, with the surface standing as
// the clause's subject. Admitted only if it is not itself capitalised (not a
// surface), not a bare number, and not a member of this text's own closed
// class (material.js::functionWordSet, Zipf-derived, no stopword list).
//
// TWO SHAPES WERE MEASURED AND ONE WAS REFUSED. The first attempt anchored on
// BOTH ends — the token strictly BETWEEN two surfaces — matching the shape a
// hand-verb-list would have matched. On Frankenstein (64 blind referents,
// 1,031 surface occurrences in ~78k words) it found *six* candidates in the
// whole novel: name-dense civic prose (the case this design was first argued
// from) has a named object in most clauses; a first-person novel does not —
// objects are pronouns, which this ladder cannot yet resolve to a referent
// (surfaces.js's own documented model-tier gap). Anchoring on ONE end — what
// immediately follows a surface acting as subject — needs no object-side
// referent and found 165 candidates, 33 of them recurring across ≥2 DISTINCT
// surfaces: entered, went, came, appeared, became, nursed, shone, spent, saw,
// spoke, seemed, soothed, desired among them, alongside residual noise
// (auxiliaries and prepositions the Zipf threshold didn't catch at this
// book's size — `were`, `could`, `from` — the same tuning tension
// material.js's own DEFAULT_RELEVANCE_THRESHOLD comment already names).
// Anchoring on the token BEFORE a surface was tried too and refused: it
// mixes true object-final verbs with premodifying epithets ("dear
// Elizabeth", "poor Justine") that recur next to many names for reasons that
// have nothing to do with being a relation.
//
// `minSurfaces` applies the same recurrence discipline
// `referents/entity.js::admitEntity` applies to a being: a candidate seen
// after only ONE surface scored well once; one seen after several DIFFERENT
// surfaces recurs, and only a recurring difference is testimony (SEED.md,
// "the unit of record").
//
// This is still a heuristic, and still declared as such. It will not
// fabricate: no triple is emitted without a literal match against the
// vocabulary it was handed, and a caller that hands in no vocabulary gets no
// triples back, never a guessed one.
//
// NEGATION MARKERS ARE NOT IN SCOPE HERE. "not", "never", "didn't" and the
// rest are a small closed grammatical category, the same tier as narrator.js's
// FIRST_PERSON pronoun set or surfaces.js's Roman-numeral grammar — a
// received fact about a language's function words, not an open-class
// semantic list standing in for content the text should be measured for.
// Amendment V says this directly: such a set "is a received prior with a
// named giver... not a set mined from the material." What was mined out
// above is the open class (verbs), which has no such standing.
//
//   · POLARITY IS READ, NEVER ASSERTED. "never married" and "did not love"
//     are negative relations, not absent ones. Defaulting to affirmative
//     would fabricate the most consequential bit in the triple.
//
// The extraction is heuristic and declared as such. It will not fabricate:
// no triple is emitted without a literal verb match in the clause.

import { diaNorm } from "./surfaces.js";
import { NEGATION_WORDS, THIRD_PERSON_SINGULAR } from "./priors.js";

// The cell this organ occupies on the operator grid (engine/operators.js):
// CON · Link · Binding — subject · verb · object triples; the graph's
// medium-specific mouth. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "CON", grain: "Figure" });

// Unicode-aware: translated prose is full of accented names (Natásha, Hélène)
// that ASCII \w silently truncates mid-name.
const W = "[\\p{L}\\p{N}_'’]+";
const TOKEN_STRIP = /^[^\p{L}\p{N}'’]+|[^\p{L}\p{N}'’]+$/gu;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A received closed class (Amendment V: a small set of function words is a
// named prior, not content mined from the material — the same tier as
// narrator.js's FIRST_PERSON or surfaces.js's Roman-numeral grammar). Held
// as a Set so discoverRelationVocab can refuse to admit "never" as a verb —
// measured on Frankenstein at minSurfaces=1: it followed a surface once and
// nothing here knew to say no. Migrated to the prior register (priors.js).
//
// No word-count cap (`{0,2}` or any other value) gates the window this
// class is tested against (built in extractRelations, see `windowStart`
// below) — MEASURED against pg2600 (War and Peace), a cap has no principled
// value: {0,2} silently missed hundreds of real same-clause negations ("I
// have never yet asked you for...", "he did not like the conversation"),
// and every value tried up to {0,6} still read as correct by hand, so the
// cap was measuring nothing except how conservative the guess happened to
// be. What actually distinguishes a connected negation from an unrelated
// one is not word count — it's whether an INDEPENDENT clause with its own
// verb sits between the trigger and this verb, which the window is already
// bounded by. Once that's true, the check reduces to a plain existence
// test: ANY trigger anywhere in an already-clause-bounded window is a real
// one — the regex below does not need to also anchor "and nothing but words
// after it to the end", so it doesn't try to. That anchored shape was tried
// first (`\s+(?:W\s+)*$`) and measured to be a real ReDoS: `W` itself is a
// `+` nested inside the outer `*`, so on a non-match (the common case —
// most windows are affirmative) the engine had to try every way of
// partitioning the window into word+space runs before giving up. MEASURED:
// switching {0,2} to that unbounded anchored form took full-book extraction
// from 15s to 97-285s (non-deterministic — classic backtracking blowup,
// worse on some runs than others), concentrated on short, unrelated
// sentences with no real cause to be slow. This plain existence form has no
// repeated group to backtrack through at all.
//
// `bin/priors/lang/en.json`'s own pattern (spans.js::splitSentences's
// `{abbreviations}` seam) is applied here too: "a mechanism is
// language-agnostic or it is not a mechanism," and a hardcoded English
// closed class is a lie for every other language. `words` is a
// caller-supplied Set (a vendored `NegationPrior@1`, e.g.
// `bin/priors/lang/eu.json`'s `negation: ["ez", ...]` for Basque, which
// fronts its own negation particle BEFORE the finite verb exactly as this
// window already checks for — see that file's own provenance for the
// citation). Reference equality against the module's own default
// `NEGATION_WORDS` (never a value comparison, which an injected Set that
// happens to contain the same English words would wrongly satisfy) is how
// the English-only "no longer" idiom stays English-only: it is appended
// ONLY when nothing was injected, never presumed to apply to a vendored
// language's own closed class.
const negationBeforeVerbFor = (words) => {
  const alt = [...words].map(escapeRe).join("|");
  const extra = words === NEGATION_WORDS ? "|no longer" : "";
  return new RegExp(`\\b(?:${alt}${extra})\\b`, "iu");
};

// The exact complement of W: any run of characters that is not part of a
// word — whitespace, commas, parens, quote marks, em-dashes, a Gutenberg
// hard-wrap newline. Collapsing every such run to one space before testing
// the negation-before-verb regex lets it see past formatting exactly as it already
// sees past ordinary whitespace — it can only turn a non-match into a match
// (it never deletes, splits, or reorders a word), so no sentence that
// already resolved "-" changes.
const NOISE_RUN = /[^\p{L}\p{N}_'’]+/gu;

// Sentence-ending punctuation — a real boundary already used elsewhere in
// this file's own design (MATCHER's object terminator below), not a
// negation-specific invention. Commas are deliberately excluded: they set
// off parenthetical asides WITHIN a clause ("did not, truly, love") and
// stopping there would undo the NOISE_RUN collapse above.
const SENTENCE_END = /[.!?;]/g;

/**
 * The text's own relation vocabulary — measured, not typed in.
 *
 * `surfaces` is whatever perceiver/text/surfaces.js::extractSurfaces already
 * found blind (an array of `{surface}` or a plain iterable of surface
 * strings) — the same candidate cast every referent-gated reader in this
 * ladder builds before it ever calls this organ, so nothing new is asked of
 * a caller that already runs the ladder in order (SIG before CON;
 * operators.js::OPERATOR_ORDER).
 *
 * A candidate is the token immediately following a surface occurrence — at
 * most a few characters of whitespace away, never crossing a clause break
 * (a comma, a full stop, a quote mark ends the run of letters this reads, so
 * "Victor. Elizabeth" or "Victor, who" both find no candidate there, exactly
 * as intended). It is admitted to the vocabulary only if:
 *
 *   · it is not itself capitalised — a capitalised token there is shaped
 *     like a surface, not a verb ("Victor AND Elizabeth" excluded by case,
 *     not by a conjunction list);
 *   · it is not a bare number;
 *   · it is not a member of `functionWords` — this text's own Zipf-derived
 *     closed class (material.js::functionWordSet). Omit `functionWords` and
 *     this filter simply does not run, same discipline as
 *     surfaces.js::extractSurfaces;
 *   · it follows at least `minSurfaces` DISTINCT surfaces. `minSurfaces` is
 *     declared by the caller, never defaulted here, for the same reason
 *     `referents/entity.js`'s `minArrivals` is never defaulted: how much
 *     recurrence makes a pattern rather than a coincidence is a property of
 *     the reading, not a constant this file gets to assume for every
 *     caller's material.
 *
 * `negationWords` (bin/priors/lang/en.json's own pattern, the same seam
 * spans.js::splitSentences's `{abbreviations}` already opened): defaults to
 * this file's own English `NEGATION_WORDS` (priors.js, giver lang/en). A
 * caller reading a different language's material injects that language's
 * OWN vendored negation prior instead — e.g. Basque's "ez" (bin/priors/
 * lang/eu.json) — never a second hardcoded English list standing in for a
 * language it was never measured against.
 *
 * Returns `{ verbs, candidates }`. `candidates` is every token that followed
 * at least one surface, ranked by how many distinct surfaces it followed,
 * kept so a caller can inspect what the gate let through and what it
 * refused — a gap is a result, and so is the sorted list around a threshold.
 * Each candidate also carries `surfaceForms` — the distinct surfaces it
 * followed — so a causal reader can accumulate admission frame by frame
 * (LOSS-LESS-LADDER.md L3: a verb is admitted once it has ALREADY followed
 * minSurfaces distinct surfaces, never on the strength of the whole text).
 *
 * `posPrior`, when supplied, is a giver-named `POSPrior@1`. A connector is
 * admitted only when VERB+AUX account for more than half of its attested
 * uses. Unattested forms remain admitted as an explicit prior gap rather
 * than being treated as non-verbs: a witness cannot refuse what it never
 * saw. Genuinely mixed attested forms are refused and remain available to an
 * occurrence-level resolver; one anomalous annotation cannot turn a common
 * preposition into a verb.
 * Omit the prior and the original material-only behaviour is unchanged.
 */
export const discoverRelationVocab = (text, { surfaces, functionWords = null, minSurfaces, negationWords = NEGATION_WORDS, posPrior = null } = {}) => {
  if (!Number.isInteger(minSurfaces) || minSurfaces < 1)
    throw new TypeError("discoverRelationVocab: minSurfaces is declared — how much recurrence counts as a pattern is the caller's to say, never a default here");

  const s = String(text ?? "");
  const names = [...(surfaces ?? [])]
    .map((x) => (typeof x === "string" ? x : x?.surface))
    .filter((x) => typeof x === "string" && x.length > 0);
  const uniqueNames = [...new Set(names)].sort((a, b) => b.length - a.length);
  if (!uniqueNames.length) return { verbs: new Set(), candidates: [] };

  // Longest-first alternation, same discipline as read-people.mjs's
  // surfaceToId: "Victor Frankenstein" must win over "Victor" at the same
  // start offset, or the shorter surface eats half the longer one's hits.
  const SURFACE_RE = new RegExp(`\\b(?:${uniqueNames.map(escapeRe).join("|")})\\b`, "gu");
  const AFTER = /^\s*([\p{L}\p{N}'’]+)/u;

  const surfacesByToken = new Map(); // lowercase token -> Set(surfaces it directly followed)
  let m;
  while ((m = SURFACE_RE.exec(s)) !== null) {
    const end = m.index + m[0].length;
    const after = s.slice(end, end + 40).match(AFTER);
    if (!after) continue;

    const cleaned = after[1].replace(TOKEN_STRIP, "");
    if (!cleaned) continue;
    if (/^\p{Lu}/u.test(cleaned)) continue;       // capitalised — shaped like a surface, not a verb
    if (/^\p{Nd}+$/u.test(cleaned)) continue;     // a bare number, not a verb
    const lower = cleaned.toLowerCase();
    if (functionWords && functionWords.has(lower)) continue; // this text's own closed class
    if (negationWords.has(lower)) continue; // a negation marker modifies a verb; it is not one

    if (!surfacesByToken.has(lower)) surfacesByToken.set(lower, new Set());
    surfacesByToken.get(lower).add(diaNorm(m[0]));
  }

  const verbs = new Set();
  const candidates = [];
  for (const [token, seenAfter] of surfacesByToken) {
    const attested = posPrior?.forms?.[token] ?? null;
    const attestedTotal = attested ? Object.values(attested).reduce((sum, count) => sum + count, 0) : 0;
    const verbShare = attestedTotal ? ((attested.VERB ?? 0) + (attested.AUX ?? 0)) / attestedTotal : 0;
    const verbDominant = !posPrior || !attested || verbShare > 0.5;
    const posStanding = !posPrior ? "not_supplied" : !attested ? "gap" : verbDominant ? "verb_dominant" : "nonverb_dominant";
    candidates.push({ verb: token, surfaces: seenAfter.size, surfaceForms: Array.from(seenAfter), verbDominant, verbShare, posStanding, upos: attested });
    if (seenAfter.size >= minSurfaces && verbDominant) verbs.add(token);
  }
  candidates.sort((x, y) => y.surfaces - x.surfaces);

  return { verbs, candidates };
};

/**
 * Triples stated in one passage, against a vocabulary the caller measured
 * (`discoverRelationVocab`, or any other named Set — the mouth does not care
 * where a Set came from, only that nothing is matched that isn't in it).
 * `limit` defaults to Infinity: that cap is a display concern, and silently
 * dropping relations before the graph has seen them would make the belief
 * structure a function of a presentation default.
 *
 * No `verbs`, or an empty one, yields no triples — never a guessed match.
 * That is the same refusal every organ in this repo makes when handed no
 * ground to perceive through: the honest answer to "what did this passage
 * say" before a vocabulary exists to hear it with is nothing, not a fallback
 * dictionary.
 *
 * `negationWords`: same param, same default, same seam as
 * discoverRelationVocab's own — see negationBeforeVerbFor's header, above.
 *
 * `functionWords` (this text's own Zipf-derived closed class,
 * material.js::functionWordSet — same discipline as discoverRelationVocab's
 * own `functionWords` param, same file, above): bounds the OBJECT capture at
 * the next function-word boundary instead of the next clause terminator.
 * MEASURED (NEXT-RELATION-SLOTS.md, full War and Peace reading, 2,863 bound
 * pronouns classified by what the object capture did with them): the old
 * `.+?` clause-final capture swallowed 54.3% of them inside a wider object
 * (mean width 45 chars) that no filler mechanism could attach to; bounding
 * at the next function word instead cut that to 13.2% and nearly doubled
 * the isolated-capture rate a pronoun/name lookup CAN attach to (12.2% ->
 * 20.5%). Also validated against a scored civic-prose clause-agency golden
 * this function feeds (see READING-POLICY.md A19 for the number — deliberately
 * not repeated here: a conformance test pins that no file outside that
 * golden's own directory may name it by path, so production code is never
 * tuned toward one eval set): every genre improved, none regressed. Omit
 * `functionWords` and this bound simply does not run — the object capture
 * falls back to the original clause-final shape, same discipline as every
 * other optional filter in this file.
 */
export const extractRelations = (text, { verbs, limit = Infinity, functionWords = null, negationWords = NEGATION_WORDS } = {}) => {
  const negationBeforeVerb = negationBeforeVerbFor(negationWords);
  const vocab = verbs instanceof Set ? verbs : new Set(verbs ?? []);
  if (vocab.size === 0) return [];

  const VERB_ALT = [...vocab].map(escapeRe).join("|");
  // The object group always requires at least one token (mandatory first
  // `${W}`) — a pronoun or name sitting immediately after the verb is never
  // refused for being function-word-shaped itself ("gave HIM the letter":
  // "him" is a function word by Zipf frequency, and must still be captured,
  // or the one case this bound exists to help — a pronoun as the whole
  // object — would be the one case it broke). Only tokens AFTER that first
  // one stop at a function-word boundary. No trailing anchor after the
  // object group (unlike negationBeforeVerbFor's earlier ReDoS, fixed above)
  // — the object simply matches as much as it structurally can and the
  // pattern ends there, so there is nothing for a failed later requirement
  // to backtrack the object choice against. MEASURED adversarially (a
  // 5,000-token run with no function word anywhere, and the same run with
  // no matching verb at all, forcing a full scan): both resolve in single-
  // digit milliseconds.
  const OBJECT_GROUP = functionWords && functionWords.size
    ? `(${W}(?:\\s+(?!(?:${[...functionWords].map(escapeRe).join("|")})\\b)${W})*)`
    : `(.+?)(?:\\.|,|;|$)`;
  // Subject and verb and object are ALL read straight from MATCHER's own
  // m[1]/m[2]/m[3] — a chorus review (CHORUS-LOG.md, Diaconis) found this
  // file used to re-derive them via a second regex (SPLITTER) applied to
  // m[0], a bare `.+?` with no dotAll flag. That worked while the object
  // group was clause-terminator-bounded (never crossed a line break
  // either), but once OBJECT_GROUP started spanning a Gutenberg hard-wrap
  // newline (its `\s+` separators match `\n`, by design — the whole point
  // of NOISE_RUN elsewhere in this file), SPLITTER's `.` could not follow
  // it across that same newline and silently re-split at a LATER verb
  // occurrence instead, corrupting the subject to several tokens. Confirmed
  // reproducing a real corrupted admit in the checked-in civic-prose golden
  // data before this fix. Two regexes agreeing to parse the same text is a
  // liability by construction; one is now the only source of truth.
  const MATCHER = new RegExp(`(?<=^|[^\\p{L}])(${W}(?:\\s+${W})?)\\s+(${VERB_ALT})\\s+${OBJECT_GROUP}`, "giu");

  // The exact terminator set the OLD (pre-function-word-bound) object
  // capture used to reach: `.`, `,`, `;`, or end of string. Used below only
  // to find the TRUE clause boundary for polarity-window purposes — never
  // to bound what is captured as the object, which is now deliberately
  // narrower (the function-word boundary). Decoupling these two was a
  // second chorus finding (Dijkstra/Frankfurt/Alexander, independently):
  // reusing the object's own (now narrower) end as "how far this clause's
  // territory reaches" left a trailing negation word AFTER a truncated
  // object ("...never abandoned hope, and...") unclaimed by either match,
  // so it silently bled into the NEXT relation's polarity window instead of
  // being walled off with the clause it actually belongs to. Confirmed
  // reproducing a fabricated negative polarity on an entirely affirmative
  // clause before this fix.
  const clauseEndAfter = (from) => {
    let end = s.length;
    for (const ch of [".", ",", ";"]) {
      const idx = s.indexOf(ch, from);
      if (idx !== -1 && idx < end) end = idx;
    }
    return end === s.length ? end : end + 1;
  };

  const rels = [];
  const seen = new Set();
  const s = String(text ?? "");
  let m;
  // The end of the previous match's own CLAUSE (via clauseEndAfter, not
  // just where its now-narrower object capture stopped) — a triple with
  // its own verb already claims everything up to its clause boundary, so a
  // negation trigger sitting before that belongs to THAT clause, not this
  // one. Real signal already computed by this loop, not a second
  // vocabulary or a guessed reach.
  let previousMatchEnd = 0;
  // Sentence-terminator scan advances forward ALONGSIDE the main match loop
  // (never rewound to 0) — MATCHER's own m.index is monotonically
  // increasing, so each terminator is visited once across the whole call,
  // not once per match. Re-scanning from the start of `s` for every match
  // would make this O(document length × match count) instead of O(document
  // length), the exact cost this file's existing 40-char-slice design used
  // to avoid by staying small — this stays cheap by staying forward-only.
  let lastSentenceEnd = -1;
  SENTENCE_END.lastIndex = 0;

  while ((m = MATCHER.exec(s)) !== null) {
    // The subject group is at most 2 tokens ("Prince Andrew"), and a leading
    // conjunction or determiner ("and he", "the King") can occupy the FIRST
    // of those 2 slots exactly the way a wide object used to swallow a
    // pronoun — the same defect, mirrored to the other end of the triple.
    // Post-processed here rather than bounded in MATCHER itself: rejecting a
    // function-word-shaped token at match-start via the regex would also
    // reject the single most important case this exists to serve — "He told
    // her" IS a bare pronoun subject and must stay "He", not be refused for
    // being function-word-shaped. Stripping only fires when there are TWO
    // tokens and the FIRST is the function word, so a lone pronoun subject
    // is never touched (nothing left to strip it down to). Also refused
    // when the REMAINING token is itself a negation trigger (the effective
    // `negationWords` — this file's own NEGATION_WORDS by default, or
    // whatever the caller injected) — a chorus finding (Dijkstra): "does not
    // measure" captures subject "does not", and stripping "does" (a function
    // word) left "not" standing in as the reported subject, a fabricated
    // referent that is actually the negation marker for the verb, not an
    // entity at all. Left as the original 2-token form instead — garbage
    // that plainly fails referent matching, not garbage disguised as a name.
    // And refused when the STRIPPED token is itself a third-person singular
    // pronoun (THIRD_PERSON_SINGULAR, already a received prior elsewhere in
    // this file's own ladder — priors.js, giver lang/en) — another chorus
    // finding (Holmes): "his King"/"her King" both strip to bare "King",
    // and for a caller with no referent-resolution seam of its own
    // (packages/host/sing.js, wired to this parameter by the same session
    // that added it), the stripped string IS the identity the belief graph
    // keys on — two distinct people sharing a title, distinguished only by
    // a possessive, would silently merge into one graph node. "the King" ->
    // "King" stays fine ("the" carries no identity of its own to lose);
    // only a pronoun that itself carries person/gender is refused.
    let subject = m[1].trim();
    if (functionWords && functionWords.size) {
      const subjTokens = subject.split(/\s+/);
      if (
        subjTokens.length === 2 &&
        functionWords.has(subjTokens[0].toLowerCase()) &&
        !negationWords.has(subjTokens[1].toLowerCase()) &&
        !(subjTokens[0].toLowerCase() in THIRD_PERSON_SINGULAR)
      ) subject = subjTokens[1];
    }
    const verb = m[2].trim().toLowerCase();
    const object = m[3].trim().replace(/[.,;]$/, "");
    if (!subject || !object) { previousMatchEnd = clauseEndAfter(m.index + m[0].length); continue; }

    const key = `${subject}|${verb}|${object}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);

      // The polarity window's backward bound is whichever is CLOSER: the
      // previous match's own clause end (see comment above
      // `previousMatchEnd`), or the most recent sentence-ending punctuation
      // — both real facts already in hand, never a character or word count.
      const subjEnd = m.index + m[1].length;
      while (SENTENCE_END.lastIndex <= m.index) {
        const sm = SENTENCE_END.exec(s);
        if (sm === null) break;
        // Overshot this match — put the cursor back exactly on it (not all
        // the way to 0) so the NEXT match's scan still finds it; exec()
        // otherwise advances lastIndex past it permanently.
        if (sm.index >= m.index) { SENTENCE_END.lastIndex = sm.index; break; }
        lastSentenceEnd = sm.index;
      }
      const windowStart = Math.max(previousMatchEnd, lastSentenceEnd + 1, 0);
      const before = s.slice(windowStart, subjEnd + 1).replace(NOISE_RUN, " ");
      rels.push({
        subject,
        verb,
        object,
        polarity: negationBeforeVerb.test(before) ? "-" : "+",
        offset: m.index,
        subjectOffset: m.index,
        objectOffset: m.index + m[0].lastIndexOf(m[3]),
      });
      if (rels.length >= limit) { previousMatchEnd = clauseEndAfter(m.index + m[0].length); break; }
    }
    previousMatchEnd = clauseEndAfter(m.index + m[0].length);
  }

  return rels;
};
