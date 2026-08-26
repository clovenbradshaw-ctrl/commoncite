// eoreader6 · host/pocket-manifest — a pocket's own declared shape: which
// tier it runs at, and therefore what it may do to a live conversation.
//
// Step 1 of the tiered-priors build (off / structural / online — see the
// spec this implements, carried on the eoWebLLM side of the pair). No
// retrieval code reads this yet: attachPocketGround (tier "structural") and
// the span store (tier "online") are later, separate steps. This module is
// intentionally inert — a type with validation, no behavior change — so the
// tier becomes a first-class, inspectable property of an installed pocket
// instead of an implicit assumption a reader has to track by hand.
//
// Declared-not-defaulted, the same discipline reading-regime.js's own
// `channel` argument already uses: a manifest missing a required field
// throws immediately rather than silently defaulting to "off" or an empty
// hash. A tier is a claim about what a pocket is trusted to do; a default
// tier would be a claim nobody made.

export const POCKET_TIERS = Object.freeze(["off", "structural", "online"]);
export const POCKET_SOURCE_KINDS = Object.freeze([
  "bulk-installed",
  "reactive-competency",
]);

function required(fields, name) {
  if (fields[name] === undefined || fields[name] === null || fields[name] === "")
    throw new TypeError(
      `definePocketManifest: ${name} is declared — never a default`,
    );
}

/**
 * Build a frozen PocketManifest. Enforces the invariants the tiered-priors
 * spec states as structural, not advisory — each one is checked here so a
 * caller cannot construct an inconsistent manifest by omission:
 *
 *   - `tier` is one of the three declared values, nothing else.
 *   - `online` requires a `spanStoreRef`; every other tier must carry none —
 *     a `structural` pocket has no span store to reference, so a manifest
 *     that claimed one would be lying about what it can surface.
 *   - a `reactive-competency` pocket may never be tier `online` — the
 *     search-sourced/bulk-installed trust split this spec's own §1 names as
 *     already settled elsewhere. Enforced here on the strength of THIS
 *     spec's own statement of the rule; see the accompanying note for what
 *     could and could not be verified against this repo's history.
 */
export function definePocketManifest(fields) {
  required(fields, "id");
  required(fields, "version");
  required(fields, "hash");
  required(fields, "tier");
  required(fields, "installedAt");
  required(fields, "sourceKind");

  if (!POCKET_TIERS.includes(fields.tier))
    throw new TypeError(
      `definePocketManifest: tier must be one of ${POCKET_TIERS.join(", ")}, got "${fields.tier}"`,
    );
  if (!POCKET_SOURCE_KINDS.includes(fields.sourceKind))
    throw new TypeError(
      `definePocketManifest: sourceKind must be one of ${POCKET_SOURCE_KINDS.join(", ")}, got "${fields.sourceKind}"`,
    );

  const spanStoreRef = fields.spanStoreRef ?? null;
  if (fields.tier === "online" && !spanStoreRef)
    throw new TypeError(
      `definePocketManifest: tier "online" requires spanStoreRef`,
    );
  if (fields.tier !== "online" && spanStoreRef !== null)
    throw new TypeError(
      `definePocketManifest: tier "${fields.tier}" must not carry a spanStoreRef — it has no span store to reference`,
    );
  if (fields.tier === "online" && fields.sourceKind === "reactive-competency")
    throw new TypeError(
      `definePocketManifest: a reactive-competency pocket may never be tier "online"`,
    );

  return Object.freeze({
    id: fields.id,
    version: fields.version,
    hash: fields.hash,
    tier: fields.tier,
    installedAt: fields.installedAt,
    sourceKind: fields.sourceKind,
    spanStoreRef,
  });
}

export function isOnlineTier(manifest) {
  return manifest.tier === "online";
}

export function isStructuralTier(manifest) {
  return manifest.tier === "structural";
}
