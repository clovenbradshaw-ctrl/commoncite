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
npm run import:anything -- /path/to/source.pdf
npm run dev
```

The bundled engine is detected automatically. Set `EOREADER_ROOT` only to test a different EOReader 7 checkout.

URL, GeoJSON, and tabular examples:

```sh
npm run import:anything -- https://example.gov/report.pdf
npm run import:anything -- https://example.gov/layer.geojson --title "Parcel layer"
npm run import:anything -- ./records.csv --stable-uri https://archive.example/records.csv
```

The importer creates:

- `public/data/active-witness.json` — the active normalized witness.
- `public/imports/<sha256>.<extension>` — the preserved source bytes.

Both paths are git-ignored: imported material stays local and never enters this repository.

The site then projects the witness as a continuous document, sections, gated concept pages, definition candidates, exact passage anchors, and an engine receipt.

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
