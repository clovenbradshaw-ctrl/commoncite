const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const norm = (x) => (String(x ?? "").toLowerCase().match(WORD) ?? []).join(" ");
const slug = (x) => norm(x).replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");

const descriptor = ({ encounterRef, offset, exactSurface, canonicalSurface, determination = "definite", basis }) => Object.freeze({
  schema: "EOReferentOccurrence@1",
  id: `ref-occ:${encounterRef}:discourse:${offset}:${slug(exactSurface)}`,
  surface: exactSurface,
  canonicalSurface: canonicalSurface ?? norm(exactSurface),
  exactSurface,
  determination,
  role: null,
  encounterRef,
  edge: null,
  relation: null,
  standing: "unresolved_identity",
  provenance: Object.freeze({ giver: "text/discourse-referents", basis }),
});

const bind = ({ left, right, witness, kind, basis }) => Object.freeze({
  schema: "EODiscourseIdentityLink@1",
  id: `discourse-link:${left.id}:${right.id}`,
  leftOccurrence: left.id,
  rightOccurrence: right.id,
  witness,
  kind,
  standing: "supported",
  provenance: Object.freeze({ giver: "text/discourse-referents", basis }),
});

/**
 * Explicit English apposition between TWO descriptor occurrences.
 *
 * Example: "the wretch—the miserable monster whom I had created".
 * The right-hand phrase is preserved exactly, while its conservative head
 * projection is `the monster`; this is a text-adapter grammatical projection,
 * not a synonym assertion. The identity link concerns these two occurrences
 * only. It says nothing about every future use of either surface.
 */
export function appositionalDescriptorBindings(text, { encounterRef = "unknown", witness = null } = {}) {
  const source = String(text ?? "");
  const outOccurrences = [];
  const links = [];
  // Narrow shape: definite descriptor, dash/comma, definite descriptor of one
  // or two lexical words, then a relative/comma boundary. This intentionally
  // does not attempt a general NP grammar.
  const re = /\b(the\s+[\p{L}][\p{L}\p{M}'’]*)\s*(?:—|–|-)\s*(the\s+([\p{L}][\p{L}\p{M}'’]*)(?:\s+([\p{L}][\p{L}\p{M}'’]*))?)(?=\s+(?:who|whom|that)\b|\s*[,;:])/giu;
  let m;
  while ((m = re.exec(source))) {
    const leftExact = m[1];
    const rightExact = m[2];
    const rightHead = `the ${m[4] ?? m[3]}`;
    const left = descriptor({
      encounterRef,
      offset: m.index,
      exactSurface: leftExact,
      canonicalSurface: norm(leftExact),
      basis: "left side of explicit descriptor apposition",
    });
    const right = descriptor({
      encounterRef,
      offset: m.index + m[0].indexOf(rightExact),
      exactSurface: rightExact,
      canonicalSurface: norm(rightHead),
      basis: "right side of explicit descriptor apposition; final lexical item projected as head",
    });
    outOccurrences.push(left, right);
    links.push(bind({
      left,
      right,
      witness,
      kind: "apposition",
      basis: "explicit appositional construction supports occurrence-level co-reference",
    }));
  }
  return Object.freeze({
    schema: "EOTextDiscourseBindings@1",
    occurrences: Object.freeze(outOccurrences),
    links: Object.freeze(links),
  });
}

const unionFind = (ids) => {
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (x) => {
    let p = parent.get(x);
    if (p == null) return null;
    while (p !== parent.get(p)) p = parent.get(p);
    let y = x;
    while (parent.get(y) !== p) {
      const next = parent.get(y);
      parent.set(y, p);
      y = next;
    }
    return p;
  };
  const join = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra == null || rb == null || ra === rb) return;
    // Stable by lexical id; this is only component bookkeeping, not salience.
    if (ra < rb) parent.set(rb, ra); else parent.set(ra, rb);
  };
  return { find, join };
};

/**
 * Current discourse-referent projection from immutable occurrence/link history.
 * Only linked occurrence components of size >=2 become referents. Same surface
 * recurrence alone is deliberately insufficient.
 *
 * INCREMENTAL over the fold's delta chain (kernel chainView): occurrences
 * and links are add-only (a link is born "supported" and never re-emitted;
 * the "refused" filter is defensive), so the union-find and per-component
 * link counts persist across encounters and each delta folds in O(delta).
 * Any UPDATE touching these schemas demands the from-scratch path —
 * exactness first. A link arriving before its occurrences waits in
 * `pending` and is retried as they land, so arrival order inside or across
 * deltas cannot diverge from the whole-history reading. Output order is
 * the original's own (components in first-occurrence order), and a full
 * Frankenstein read diffed byte-identical against the pre-incremental
 * projection before this landed.
 */
import { chainView } from "../../kernel/fold.js";

const discourseState = chainView(
  (graphEntries) => {
    const st = emptyDiscourseState();
    foldDiscourse(st, graphEntries);
    return st;
  },
  (st, d) => {
    if (d.updated.some((x) => x?.schema === "EOReferentOccurrence@1" || x?.schema === "EODiscourseIdentityLink@1")) return null;
    foldDiscourse(st, d.appended);
    return st;
  },
);

const emptyDiscourseState = () => ({ occurrences: [], parent: new Map(), linkIds: new Map(), pending: [], seq: 0 });

const stFind = (parent, x) => {
  let p = parent.get(x);
  if (p == null) return null;
  while (p !== parent.get(p)) p = parent.get(p);
  let y = x;
  while (parent.get(y) !== p) { const next = parent.get(y); parent.set(y, p); y = next; }
  return p;
};

function foldDiscourse(st, entries) {
  const tryLink = (link) => {
    const ra = stFind(st.parent, link.leftOccurrence);
    const rb = stFind(st.parent, link.rightOccurrence);
    if (ra == null || rb == null) return false;
    const stamped = { seq: st.seq++, id: link.id };
    if (ra === rb) { st.linkIds.get(ra).push(stamped); return true; }
    const [keep, drop] = ra < rb ? [ra, rb] : [rb, ra]; // stable by lexical id — the original's own tiebreak
    st.parent.set(drop, keep);
    const merged = [...(st.linkIds.get(keep) ?? []), ...(st.linkIds.get(drop) ?? []), stamped];
    st.linkIds.set(keep, merged);
    st.linkIds.delete(drop);
    return true;
  };
  for (const x of entries ?? []) {
    if (x?.schema === "EOReferentOccurrence@1") {
      st.occurrences.push(x);
      if (!st.parent.has(x.id)) { st.parent.set(x.id, x.id); st.linkIds.set(x.id, st.linkIds.get(x.id) ?? []); }
      if (st.pending.length) st.pending = st.pending.filter((l) => !tryLink(l));
    } else if (x?.schema === "EODiscourseIdentityLink@1" && x.standing !== "refused") {
      if (!tryLink(x)) st.pending.push(x);
    }
  }
}

export function projectDiscourseReferents(graphEntries = []) {
  const st = discourseState(graphEntries);
  const components = new Map();
  for (const occ of st.occurrences) {
    const root = stFind(st.parent, occ.id);
    if (!root) continue;
    if (!components.has(root)) components.set(root, []);
    components.get(root).push(occ);
  }

  const referents = [];
  for (const [root, group] of components) {
    if (group.length < 2) continue;
    const stampedLinks = st.linkIds.get(root) ?? [];
    if (!stampedLinks.length) continue;
    // Global arrival order, dedup by id — the original's own [...linkedIds]
    // Set semantics over the links array.
    const linkedIds = [...new Map([...stampedLinks].sort((a, b) => a.seq - b.seq).map((l) => [l.id, l])).keys()];
    const surfaces = [...new Set(group.map((x) => x.canonicalSurface).filter(Boolean))];
    referents.push(Object.freeze({
      schema: "EOReferent@1",
      id: `ref:discourse:${slug(root)}`,
      display: group[0].surface,
      surfaces: Object.freeze(surfaces),
      occurrenceRefs: Object.freeze(group.map((x) => x.id)),
      supportRefs: Object.freeze([...linkedIds]),
      standing: "provisional",
      revisable: true,
      provenance: Object.freeze({
        giver: "text/discourse-referents::projectDiscourseReferents",
        basis: "connected component of explicitly supported occurrence-level identity links",
      }),
    }));
  }
  return Object.freeze(referents);
}
