# Importing anything

Two equivalent ways in: the browser (drop a file or paste a URL at `http://localhost:5173` while `npm run dev` is running — see the README's Quick start), or the CLI documented here. Both call the same adapter code in `scripts/import-core.mjs`.

## Command

```sh
npm run import:anything -- <file-or-url> [options]
```

Options:

- `--title NAME` — override the filename-derived page title.
- `--output FILE` — write the witness somewhere other than `public/data/active-witness.json`.
- `--stable-uri URI` — declare the stable source URI for a local file.
- `--source-dir DIR` — change where preserved source bytes are copied.

The importer uses the bundled `eoreader7/` directory by default. Set `EOREADER_ROOT` to test a different EOReader 7 checkout.

## Deterministic adapters

| Input | Adapter | Preserved structure |
| --- | --- | --- |
| PDF | `pdftotext` (content-stream order, not `-layout`) | Page boundaries and recovered text — see below for why `-layout` isn't used |
| DOCX | OOXML extraction | Paragraph and text boundaries |
| HTML / XML | Markup stripping | Visible text; original markup bytes retained |
| JSON | Parsed and pretty-serialized JSON | Object/array structure in the recovered text |
| GeoJSON | GeoJSON JSON adapter | FeatureCollection structure in recovered text |
| CSV / TSV | UTF-8 text | Delimiters and rows |
| Markdown / text / YAML | UTF-8 text | Received text |
| Unknown binary | Binary witness | Hash, bytes, media type, and explicit extraction gap |

Adapters are replaceable. A new adapter must return recovered text, an adapter name, and a precise statement of what it did. It must never silently infer missing content.

### Why the PDF adapter doesn't use `-layout`

`pdftotext -layout` reconstructs a visual X/Y grid — the right choice for a genuinely tabular PDF, but actively wrong for the letterhead-sidebar shape common in real government correspondence: a column of names (recipients, commissioners, a CC list) running down the margin, parallel to the letter body. `-layout` reads left-to-right per vertical band, so a sidebar name and a body-text line that happen to share a Y-position get fused into one output line — two unrelated text streams interleaved into something that reads like a real, garbled sentence. Plain `pdftotext` reads the PDF's own internal content-stream order instead, which keeps each text object (sidebar, body) intact and sequential.

Verified on a real determination letter: identical word count either way — nothing is lost by dropping `-layout` — but `-layout` produced a commissioner's name fused directly into the body paragraph's own opening sentence, while plain mode kept the roster and the letter as two clean, separately-readable blocks.

## Processing sequence

1. Acquire bytes from a file or HTTP(S) URL.
2. Compute SHA-256 before interpretation.
3. Preserve a content-addressed source copy.
4. Select a deterministic format adapter.
5. Record adapter success or explicit abstention.
6. Run EOReader 7 on recovered content.
7. Generate page/unit and byte-addressed sentence spans.
8. Write a `CommonRecordWitness@1` JSON document.
9. Let the wiki project that witness; the projection never changes the witness.

## Large datasets

Single recovered texts larger than roughly 60,000 characters are deterministically segmented at paragraph or line boundaries. Native PDF page boundaries are retained. This keeps the browser reader navigable without claiming that generated chunks are source-authored chapters.

## Adding an adapter

Extend `extractText()` in `scripts/import-core.mjs` — both the CLI and the browser's local import service (`scripts/import-server.mjs`) call it, so a new adapter works everywhere at once. Unknown formats must continue to fall through to the binary-witness result. The original bytes must be preserved whether or not extraction succeeds.
