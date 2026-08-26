# Vendored from clovenbradshaw-ctrl/eoreader7

- Repository: https://github.com/clovenbradshaw-ctrl/eoreader7
- Commit: `dcec657f5e76c5d3528818d50fa38fbb3070868f`
- Vendored: 2026-08-25

This is a flattened, git-history-free copy — the same convention the prior `eoreader6/` vendor drop used.

## Why every symlink here is a real copy

Upstream exposes its legacy compatibility surface (`packages/`, `bin/`, `scripts/`, ...) as symlinks into a `legacy-eoreader6.1` git submodule, pinned at commit `e20e441d3cdfb735d605c75037e6d73892e707c0` (https://github.com/clovenbradshaw-ctrl/eoreader6.1).

Symlinks don't survive checksummed vendoring cleanly: plain `shasum` can't hash a symlink-to-directory, and this host's git had trouble even staging one. So every symlink here has been dereferenced into a real copy.

That means the legacy compatibility content exists **twice** in this tree:

- once at the flattened top-level paths (`packages/`, `bin/`, etc. — what those paths resolved to upstream), and
- once again under `legacy-eoreader6.1/` (the complete submodule checkout, kept for full provenance).

The two copies are byte-identical, with one deliberate exception — see below.

## The one deliberate edit: `package.json`

The root-level `package.json`'s `"name"` field reads `eoreader7` here, not the upstream `eoreader6` it carries in `legacy-eoreader6.1/`.

- Upstream itself has no first-class root `package.json` — that path only ever resolved to the legacy submodule's own descriptor via symlink, so there was no "correct" eoreader7 identity being overwritten.
- The rename exists so name-based discovery (grep, `npm ls`, an agent checking "what package is this") doesn't return `eoreader6` for a tree that is, in fact, eoreader7.
- Nothing in Commoncite's own tooling reads this field.
- `legacy-eoreader6.1/package.json` is untouched and stays byte-faithful to the real upstream submodule.

## How Commoncite actually reads this

This is EOReader 7's own documented migration path: existing consumers import through the frozen v6.1 compatibility surface while native `kernel.js` / `text.js` / `native/` is adopted incrementally.

Commoncite's importer currently reads through that compatibility surface (`packages/host/*`), unchanged in shape from the eoreader6 vendor drop it replaces — see `MANIFEST.json` for what specifically points where.

## This is a pin, not the only copy

`/Users/mlacy/Documents/3.0/eoreader7` (outside this repo) is a real, live `git clone` of the same upstream, tracking `origin/main` and able to `git pull` forward.

- As of 2026-08-25 both copies sit at the same commit (`dcec657f`) — by coincidence of timing, not by any sync mechanism between them.
- This directory will not follow upstream on its own; that's the point of vendoring a pin. If upstream moves and the live clone follows, this copy stays at `dcec657f` until someone re-vendors on purpose.
- If something behaves differently here than in that other clone, check `EOREADER_COMMIT` on both sides before assuming it's the same bug.
