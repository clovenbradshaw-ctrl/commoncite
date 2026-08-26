# EOReader 7 Cut

EOReader 7 begins as a full copy of EOReader 6.1 at:

`73f37d92c24714ba1e3b951e6646bc2d97380807`

This commit includes the merged Fold-conditioned recursive reader and the merged provider contract for The Fold.

## Rule

Do not rewrite from scratch. Strip only under conformance.

The canonical semantic cycle is:

`Fold -> Orientation -> Encounter -> Perception -> Witness -> Interrogation -> DeltaFold -> revised Fold`

Derived dynamics follow the transformation:

- surprise derives from consequential DeltaFold
- tension derives from unresolved structure in the revised Fold
- release derives from transformations that resolve or reframe that structure

## Dependency law

`spec <- kernel <- priors/adapters <- host <- applications`

Compatibility code may depend inward on the kernel. The kernel must never depend on The Fold or any application.

## Compatibility law

The Fold is the reference application for the transition.

1. The Fold must first boot unchanged against EOReader 7.
2. Existing 6.1 paths may survive as compatibility facades.
3. A compatibility path may disappear only after The Fold has moved to a canonical v7 replacement and equivalent behavior is covered by tests.
4. Addressability, append-only witness history, typed absence, recursive identity/relation revision, defeasible priors, and EO-native transformation semantics are behavioral commitments, not directory-layout commitments.

## First stripping criterion

For every subsystem, classify it as one of:

- primitive of experience
- implementation of a primitive
- prior
- adapter
- derived projection/view
- optimization
- compatibility facade
- historical/research scaffolding

Anything that cannot be classified should not remain in the v7 kernel.

## Non-goals of the cut

The cut itself changes no reading behavior and removes nothing. It only establishes the exact source organism, the semantic kernel boundary, and the migration constraints under which stripping can begin.
