# Importing anything

## Command

```sh
npm run import:anything -- <file-or-url> [options]
```

Options:

- `--title NAME` — override the filename-derived page title.
- `--output FILE` — write the witness somewhere other than `public/data/active-witness.json`.
- `--stable-uri URI` — declare the stable source URI for a local file.
- `--source-dir DIR` — change where preserved source bytes are copied.

The importer uses the bundled `eoreader6/` directory by default. Set `EOREADER_ROOT` to test a different EOReader 6.1 checkout.

## Deterministic adapters

| Input | Adapter | Preserved structure |
| --- | --- | --- |
| PDF | `pdftotext -layout` | Page boundaries and recovered layout text |
| DOCX | OOXML extraction | Paragraph and text boundaries |
| HTML / XML | Markup stripping | Visible text; original markup bytes retained |
| JSON | Parsed and pretty-serialized JSON | Object/array structure in the recovered text |
| GeoJSON | GeoJSON JSON adapter | FeatureCollection structure in recovered text |
| CSV / TSV | UTF-8 text | Delimiters and rows |
| Markdown / text / YAML | UTF-8 text | Received text |
| Unknown binary | Binary witness | Hash, bytes, media type, and explicit extraction gap |

Adapters are replaceable. A new adapter must return recovered text, an adapter name, and a precise statement of what it did. It must never silently infer missing content.

## Processing sequence

1. Acquire bytes from a file or HTTP(S) URL.
2. Compute SHA-256 before interpretation.
3. Preserve a content-addressed source copy.
4. Select a deterministic format adapter.
5. Record adapter success or explicit abstention.
6. Run EOReader 6.1 on recovered content.
7. Generate page/unit and byte-addressed sentence spans.
8. Write a `CommonRecordWitness@1` JSON document.
9. Let the wiki project that witness; the projection never changes the witness.

## Large datasets

Single recovered texts larger than roughly 60,000 characters are deterministically segmented at paragraph or line boundaries. Native PDF page boundaries are retained. This keeps the browser reader navigable without claiming that generated chunks are source-authored chapters.

## Adding an adapter

Extend `extractText()` in `scripts/import-anything.mjs`. Unknown formats must continue to fall through to the binary-witness result. The original bytes must be preserved whether or not extraction succeeds.
