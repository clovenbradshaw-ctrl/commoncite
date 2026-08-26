# Vendored from clovenbradshaw-ctrl/eoreader7

- Repository: https://github.com/clovenbradshaw-ctrl/eoreader7
- Commit: `dcec657f5e76c5d3528818d50fa38fbb3070868f`
- Vendored: 2026-08-25

This is a flattened, git-history-free copy — the same convention the prior
`eoreader6/` vendor drop used. The upstream repo exposes its legacy
compatibility surface (`packages/`, `bin/`, `scripts/`, ...) as symlinks
into a `legacy-eoreader6.1` git submodule pinned at commit `e20e441d3cdfb735d605c75037e6d73892e707c0`
(https://github.com/clovenbradshaw-ctrl/eoreader6.1). Symlinks don't survive
checksummed vendoring cleanly (plain `shasum` can't hash a symlink-to-directory,
and this host's git had trouble even staging one), so every symlink here has
been dereferenced into a real copy. That means the legacy compatibility
content exists twice in this tree: once at the flattened top-level paths
(`packages/`, `bin/`, etc. — what those paths resolved to upstream) and
once again under `legacy-eoreader6.1/` (the complete submodule checkout,
kept for full provenance). They are byte-identical; the duplication is the
cost of a checksum-friendly, symlink-free vendor copy.

This is EOReader 7's own documented migration path: existing consumers import
through the frozen v6.1 compatibility surface while native `kernel.js` /
`text.js` / `native/` is adopted incrementally. Commoncite's importer
currently reads through that compatibility surface (`packages/host/*`),
unchanged in shape from the eoreader6 vendor drop it replaces — see
MANIFEST.json for what specifically points where.
