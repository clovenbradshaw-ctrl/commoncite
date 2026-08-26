# Agency-in-civic-text annotation guideline

## The question, and only the question

For each clause, answer exactly one of:

- **NAMED** — this clause states, within itself, who or what performed the
  action. "Who" can be a proper name, a role, a title, an organization, a
  pronoun, or a coordinated subject carried over from earlier in the same
  sentence. It does not have to be a *specific*, *identifiable* individual —
  "staff", "the committee", "she", "someone in the audience" all count.
- **AGENTLESS** — this clause has a verb naming an action, but no agent is
  expressed anywhere in the clause. Usually a passive with the `by`-phrase
  dropped, or an intransitive/existential construction that backgrounds the
  actor entirely.
- **NOMINALIZED** — this clause has no finite verb assigning an agent role at
  all. The action is expressed as a noun ("approval," "filing," "review,"
  "the decision"), so there is no syntactic slot for an agent to occupy in
  the first place — the clause cannot even be AGENTLESS, because AGENTLESS
  presupposes a verb that dropped its subject.

That is the entire task. Do not annotate anything else — see "What this is
not," below, before starting.

## Why the three buckets, not two

AGENTLESS and NOMINALIZED are different failures and must not be merged.
AGENTLESS is a choice within a clause that has a verb: the writer could have
written "the Council approved" and wrote "was approved" instead. NOMINALIZED
is a choice one level up, before any verb was selected at all: "approval
followed" never had an agent slot to fill or drop. Collapsing them would
hide exactly the distinction a downstream reader most needs — one is the
passive voice doing its classic work (backgrounding a known but
uninteresting actor), the other is bureaucratic prose that has turned an
action into a filed object. Keep them apart even when it is tempting to
lump both into "no agent visible."

## Worked examples

| clause | verdict | why |
|---|---|---|
| "The Council approved the measure." | NAMED | subject present, active voice |
| "The measure was approved by the Council." | NAMED | passive, but the `by`-phrase names the agent |
| "The measure was approved." | AGENTLESS | passive, no agent anywhere in the clause |
| "Staff recommends adoption of the ordinance." | NAMED | "staff" is a generic but real agent noun phrase, subject of "recommends" |
| "Approval of the measure followed a public hearing." | NOMINALIZED | "approval" is a noun; nothing in the clause could be rewritten as "X approved" without adding a word the clause doesn't have |
| "The witness stated that she had not been informed." | NAMED (outer clause) | "the witness" names who stated |
| "...that she had not been informed." (same sentence, second clause, scored on its own) | NAMED | "she" has a clear antecedent one clause earlier in the SAME sentence ("the witness") — a pronoun with an in-sentence antecedent still names an agent |
| "Concerns were raised about the timeline." | AGENTLESS | passive, no `by`-phrase, no earlier antecedent in the sentence |
| "It was determined that the filing was late." | AGENTLESS | impersonal "it," no agent expressed |
| "The rule was violated." | AGENTLESS | classic agentless passive |
| "Filing errors occurred during the transition." | NOMINALIZED | "errors occurred" — "occur" takes no agent; "filing" modifies the noun, is not a verb here |
| "Council will consider an ordinance making four technical amendments." | NAMED | "Council" is the subject of "will consider" |
| "No opposition is known." | AGENTLESS | passive, no agent; note this is NOT nominalized — "known" is a verb (albeit stative), so an agent slot exists and is empty |

## What counts as the clause's own agent (in-clause and in-sentence rules)

- Judge the clause **in the context of its full sentence**, which will
  always be shown alongside it. A pronoun or elided subject that clearly
  refers back to a named agent **earlier in the same sentence** counts as
  NAMED (e.g. a coordinated verb phrase: "The Board reviewed the file and
  then approved it" — the second conjunct's implicit subject is "the
  Board").
- Do **not** reach outside the sentence. If the antecedent is only
  recoverable from a previous sentence or paragraph, treat the clause on its
  own terms — a bare "it was approved" two sentences later is still
  AGENTLESS even if a careful reader could trace the antecedent by rereading
  the whole document. The meter this golden validates only ever sees one
  clause's own admitted material; the human judgment should face the same
  constraint, or the comparison is not fair to either side.
- A generic or institutional noun phrase ("staff," "the committee," "the
  agency," "commenters") is a real agent for this task. This is not a
  specificity judgment — it is a presence/absence judgment.
- "By the Council," "at the direction of the Chair," "pursuant to a motion
  from Commissioner X" — all name an agent, however the phrase is
  introduced grammatically.

## What this is NOT

- **Not coreference.** Do not resolve *which* real-world person or entity a
  name or pronoun refers to. "She" counts as NAMED whether or not you can
  say who "she" is.
- **Not ground truth about who actually acted.** You are not fact-checking
  the document. A clause that says "the Council approved the measure" is
  NAMED even if you have separate knowledge that a different body actually
  made the decision. This golden measures what the text says, not what
  happened.
- **Not a grammaticality or style judgment.** Do not mark a clause AGENTLESS
  because the passive voice reads badly, or NAMED because the sentence is
  well constructed. Score only presence or absence of an expressed agent.
- **Not a judgment about whether the omission is suspicious, evasive, or
  deliberate.** Some agentless passives are entirely unremarkable ("the
  meeting was called to order"). Do not let a sense that "this omission
  seems fine" pull a verdict toward NAMED, or that "this omission seems
  slippery" pull it toward AGENTLESS. The bucket is mechanical.

## Segmentation you will be shown, and how to handle a bad split

Clauses are pre-segmented mechanically (split on semicolons and coordinating
conjunctions/relative pronouns) — you are not asked to re-segment. If a
segment is not really a clause (a sentence fragment with no verb at all, a
list-item stub, a citation, a header/footer artifact), mark it **SKIP** with
a one-line reason instead of forcing NAMED/AGENTLESS/NOMINALIZED onto it.
`SKIP` is a legitimate answer and is excluded from scoring, not folded into
either the AGENTLESS or NOMINALIZED count.

## Format

You will receive a JSON list of `{id, sentence, clause, genre}` records.
Return a JSON list of `{id, verdict, note}` in the same order, where
`verdict` is one of `NAMED`, `AGENTLESS`, `NOMINALIZED`, `SKIP`, and `note`
is an optional short (<15 word) justification — required only for `SKIP`.
Do not add fields, do not omit records, do not reorder.
