# EOReader 7

EOReader 7 now has a native canonical recursive-reading kernel.

New code should import:

```js
import { createRecursiveReader } from "./kernel.js";
```

The native implementation lives in `native/kernel/`. It has no implementation dependency on EOReader 6.1.

## Canonical cycle

```text
Fold
  -> Orientation
  -> Encounter
  -> Perception
  -> Challenge
  -> Witness
  -> Interrogation
  -> DeltaFold
  -> revised Fold
```

`Challenge` is constitutive but non-evidentiary: candidate interpretations are always challengeable before witness. Without a challenger the stage is identity-preserving.

Derived only after transformation:

- surprise = consequential revision in `DeltaFold`, not observation novelty
- tension = persistent consequential unresolved structure in the revised Fold
- release = witnessed transformation that closes or reframes that structure

The EO cube is the complete 27-address question surface. The current operator set is exactly:

`NUL SIG INS / SEG CON SYN / DEF EVA REC`

`ALT` and `SUP` are not canonical operators. `NUL` records no transformation. `Void` is an Existence terrain and is not synonymous with NUL.

## Priors and witness

Priors may condition orientation, nominate perceptions, and focus interrogation. They cannot become witness merely by being prior. Modality adapters determine how structural possibilities manifest in an encounter; they do not replace the EO ontology.

## Compatibility

EOReader 7 began from frozen EOReader 6.1 commit `e20e441d3cdfb735d605c75037e6d73892e707c0`. That exact source remains pinned as the `legacy-eoreader6.1` submodule solely for:

1. compatibility with applications that still import historical `packages/engine` / `packages/host` paths;
2. parity tests while those consumers migrate.

Root compatibility symlinks still expose those historical paths. They are not the v7 architecture.

Clone compatibility surfaces with:

```sh
git clone --recurse-submodules https://github.com/clovenbradshaw-ctrl/eoreader7.git
```

The Fold is the reference compatibility application: it currently consumes EOReader 7 through the frozen legacy path contract while new v7 work targets `kernel.js`.

## Ratchet

A compatibility subsystem may be retired only when its native replacement passes behavioral/conformance tests. `native/conformance/native-boundary.test.mjs` additionally forbids the native kernel from importing legacy implementation paths, and locks the current nine-operator semantics.
