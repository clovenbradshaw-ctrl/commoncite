import { DEFINITE_DETERMINERS, INDEFINITE_DETERMINERS } from "./priors.js";

const WORD = /\p{L}[\p{L}\p{M}'’]*/gu;
const TITLE = /^\p{Lu}/u;
const LOWER = /^\p{Ll}/u;
const DETERMINERS = new Set([...DEFINITE_DETERMINERS, ...INDEFINITE_DETERMINERS]);
const APPOSITIONAL_DELIMITER = /^\s*[,;:—–-]\s*$/u;
const APPOSITIONAL_CLOSE = /^\s*[,;:—–-]/u;
const norm = (x) => String(x ?? "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const rows = (text) => [...String(text ?? "").matchAll(WORD)].map((m, at) => ({
  token: m[0],
  key: norm(m[0]),
  at,
  charStart: m.index,
  charEnd: m.index + m[0].length,
}));

const supportEvidence = (text, witness, giver) => {
  const rs = rows(text);
  const supports = [];
  for (let i = 0; i < rs.length; i += 1) {
    if (!DETERMINERS.has(rs[i].key)) continue;
    // Conservative English shape: determiner + 1..2 lowercase descriptor
    // tokens + appositional delimiter + one Title-case naming token + close.
    for (let nameAt = i + 2; nameAt <= Math.min(i + 3, rs.length - 1); nameAt += 1) {
      if (!TITLE.test(rs[nameAt].token)) continue;
      const descriptorRows = rs.slice(i + 1, nameAt);
      if (!descriptorRows.length || !descriptorRows.every((x) => LOWER.test(x.token))) continue;
      const delimiter = text.slice(descriptorRows.at(-1).charEnd, rs[nameAt].charStart);
      if (!APPOSITIONAL_DELIMITER.test(delimiter)) continue;
      const afterName = text.slice(rs[nameAt].charEnd, rs[nameAt + 1]?.charStart ?? text.length);
      if (!APPOSITIONAL_CLOSE.test(afterName)) continue;
      supports.push(Object.freeze({
        left: [rs[i].key, ...descriptorRows.map((x) => x.key)].join(" "),
        right: rs[nameAt].key,
        witness,
        giver,
        reason: "text_appositional_identity",
      }));
    }
  }
  return supports;
};

const phraseStarts = (rs, phrase) => {
  const target = norm(phrase).split(/\s+/).filter(Boolean);
  const starts = [];
  if (!target.length) return starts;
  for (let i = 0; i <= rs.length - target.length; i += 1) {
    let match = true;
    for (let j = 0; j < target.length; j += 1) {
      if (rs[i + j].key !== target[j]) { match = false; break; }
    }
    if (match) starts.push({ start: i, end: i + target.length - 1 });
  }
  return starts;
};

const attackEvidence = (text, alternatives, supports, witness, giver) => {
  const rs = rows(text);
  const supportKeys = new Set(supports.map((x) => `${norm(x.left)}\u0000${norm(x.right)}`));
  const attacks = [];
  for (const identity of alternatives ?? []) {
    if (identity?.schema !== "EOIdentityAlternative@1" || identity.standing === "distinct" || identity.standing === "refused") continue;
    const leftHits = phraseStarts(rs, identity.left);
    const rightHits = phraseStarts(rs, identity.right);
    if (!leftHits.length || !rightHits.length) continue;
    if (supportKeys.has(`${norm(identity.left)}\u0000${norm(identity.right)}`) || supportKeys.has(`${norm(identity.right)}\u0000${norm(identity.left)}`)) continue;

    const leftWidth = norm(identity.left).split(/\s+/).length;
    const separated = leftHits.some((left) => rightHits.some((right) => {
      const leftCenter = (left.start + left.end) / 2;
      const rightCenter = (right.start + right.end) / 2;
      return Math.abs(rightCenter - leftCenter) > leftWidth + 3;
    }));
    if (!separated) continue;
    attacks.push(Object.freeze({
      left: identity.left,
      right: identity.right,
      witness,
      giver,
      reason: "text_separated_copresentation",
    }));
  }
  return attacks;
};

/**
 * English identity evidence from already-witnessed text.
 *
 * Apposition is support, not proof. Separated co-presentation of both sides of
 * a live alternative is incompatible multiplicity and attacks it. No synonymy,
 * similarity, or world knowledge is introduced here.
 */
export function textIdentityEvidence(text, { alternatives = [], witness = null, giver = "lang/en:text-identity@1" } = {}) {
  const source = String(text ?? "");
  const supports = supportEvidence(source, witness, giver);
  const attacks = attackEvidence(source, alternatives, supports, witness, giver);
  return Object.freeze({
    schema: "EOTextIdentityEvidence@1",
    supports: Object.freeze(supports),
    attacks: Object.freeze(attacks),
  });
}
