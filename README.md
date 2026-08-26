# Commoncite

A data-free, model-free starter for turning arbitrary source material into a Wikipedia-style public record.

This repository contains **no bundled witness or project-specific source data**. It contains the portal source, the EOReader 7 engine revision used by the importer, a deterministic importer, the witness schema, adapter contract, provenance rules, and deployment-ready UI.

## What's included

| Path | What it is |
| --- | --- |
| `site-source/` | The complete portable wiki application. |
| `site-source/scripts/import-anything.mjs` | Generic file/URL importer. |
| `eoreader7/` | The pinned EOReader 7 source, vendored with its bundled EOReader 6.1 compatibility surface for existing consumers. |
| `schema/CommonRecordWitness.schema.json` | Normalized witness contract. |
| `docs/IMPORTING.md` | Formats, commands, and abstention behavior. |
| `docs/PROVENANCE.md` | Citation and self-grounding rules. |
| `SHA256SUMS` | Checksums for every tracked file in this tree. |

Two things worth knowing before you touch anything:

- The bundled engine is pinned to the revision recorded in `MANIFEST.json`. Project-specific fixtures, corpus-derived reports, and upstream repository history are omitted; the generic runtime and conformance material remain.
- `site-source/` and `eoreader7/` **must stay siblings** — the importer resolves the bundled engine at `../eoreader7` relative to the site root.

## Quick start

Requirements:

- Node.js 22.13 or later
- `pdftotext` for PDF input
- `unzip` for DOCX input

```sh
cd site-source
npm install
npm run dev
```

Open `http://localhost:5173` and drop a file, or paste a URL. That's the primary way to import — no separate command to run first.

The CLI still works too, for scripting or batch imports:

```sh
npm run import:anything -- /path/to/source.pdf
npm run import:anything -- https://example.gov/report.pdf
npm run import:anything -- https://example.gov/layer.geojson --title "Parcel layer"
npm run import:anything -- ./records.csv --stable-uri https://archive.example/records.csv
```

Both paths share the same adapter code (`scripts/import-core.mjs`) and the same bundled engine, detected automatically. Set `EOREADER_ROOT` only to test a different EOReader 7 checkout.

A few differences worth knowing:

- Both preserve the original bytes to `public/imports/<sha256>.<extension>` — git-ignored, so imported material stays local and never enters this repository.
- A CLI import also writes the normalized witness to `public/data/active-witness.json` (or `--output`). A browser import keeps its witness in that tab's own memory instead, so a second import in another tab never collides with the first.
- The browser path needs a second process, described next.

The site then projects the witness as a continuous document, sections, gated concept pages, definition candidates, exact passage anchors, and an engine receipt.

### Why `npm run dev` starts two processes

`pdftotext`, `unzip`, and the vendored EOReader engine all need a real Node process with real filesystem access. This app's own route handlers don't have that — they run in a sandboxed Workers/Miniflare runtime with no `child_process` and no access to anything outside the bundled site.

So `npm run dev` (via `scripts/dev.sh`) starts two things together, stopped together:

- vite, serving the app itself.
- `scripts/import-server.mjs` — a plain, dependency-free Node HTTP server that does the real import work. `vite.config.ts`'s dev-server proxy exposes it to the browser at `/local-import/*`, same-origin, no CORS setup needed.

This is dev-only. There's no equivalent path in a deployed Cloudflare Worker build, since Workers can't spawn `pdftotext` either. If the browser's import UI reports the service isn't running, check the terminal `npm run dev` is running in.

## The important boundary

"Import anything" does not mean "pretend to understand anything."

- Every input is content-addressed and retained.
- Supported adapters produce deterministic text or structure for EOReader.
- Unsupported binary formats enter as valid source roots with an explicit semantic-extraction gap. No model fills that gap.

## No LLM

The importer does not call an LLM.

- Article leads use fixed templates.
- Concept pages require co-reference and salience thresholds.
- Definition statements require explicit grammatical patterns.
- If a gate fails, the page abstains.

## Verifying this tree

```sh
shasum -a 256 -c SHA256SUMS
```

## Naming and lineage

Commoncite is the project name for the application. The wire format keeps its original identifier: witnesses are `CommonRecordWitness@1` and the schema file name is unchanged, so witnesses produced by, or destined for, other Common Record tooling stay interchangeable. Renaming the contract would have broken that compatibility for no gain.

This repository was seeded from the `Common Record Portable 1.0.0` export dated 2026-08-21:

- The first commit is that export verbatim, and all 774 of its original checksums verified against it.
- The rename to Commoncite is the commit on top.
- `SHA256SUMS` was regenerated to match the current tree.
