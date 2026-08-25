// eoreader6 · goldens/cast/fetch — pulls the two received gifts this golden is
// made of and freezes both.
//
//   MATERIAL  — Project Gutenberg plaintext, by id.
//   REFERENCE — a third-party human analysis of the same book (a Wikipedia
//               character list or Figuren/Personnages/Szereplők section),
//               pinned to a REVISION ID at fetch time.
//
// Pinning is not bookkeeping. An unpinned reference is a moving target and a
// golden scored against one means nothing six months later — the number moves
// and nobody can say whether the engine or the encyclopedia changed. SEED.md #1:
// a prior is a gift and must name its giver. The revision id is the giver's
// signature.
//
// Raw wikitext is frozen VERBATIM under refs/. Cast extraction is deliberately
// NOT done here: pulling names out of a wikitable is our act, not the giver's,
// and folding it into the fetch would make the received gift unauditable. The
// extraction rules differ per article anyway (h3 subsections for de, bolded
// list items for fr, wikitables for zh, {{lang|grc}} annotations for el) and
// each is a judgement that should be reviewable on its own.
//
// THE EMPTY-BODY TRAP, wired in rather than written down. Bare requests to
// api.php return HTTP 200 with an empty body under load. Parsed naively that
// is indistinguishable from "no such article" — which is how two independent
// surveys of this slate both recorded live articles as missing. So: a
// descriptive User-Agent on every call, and an empty body is RETRIED, never
// read as absence. If it still fails, it is reported as a fetch gap, which is
// a different result from "the article does not exist."
//
// Usage: node goldens/cast/fetch.mjs [--only <lang>] [--refs-only]

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = JSON.parse(readFileSync(join(HERE, "manifest.json"), "utf8"));

// Wikimedia asks that automated clients identify themselves and a contact.
// This is also what keeps us out of the 429 that masquerades as absence.
const UA = "eoreader6-cast-golden/1.0 (research fixture builder; https://www.gutenberg.org)";

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const refsOnly = args.includes("--refs-only");

// An empty 200 is the failure mode this whole wrapper exists for. Distinguish
// "retryable emptiness" from "the server said no" and from "genuinely absent".
const get = async (url, { attempts = 4, expectJson = false } = {}) => {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.status === 429 || res.status >= 500) {
        lastErr = `http_${res.status}`;
        await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
        continue;
      }
      if (!res.ok) return { gap: `http_${res.status}` };
      const body = Buffer.from(await res.arrayBuffer());
      if (body.length === 0) {
        // The trap. Not absence.
        lastErr = "empty_body";
        await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
        continue;
      }
      if (expectJson) {
        try {
          return { json: JSON.parse(body.toString("utf8")), bytes: body.length };
        } catch {
          lastErr = "unparseable_body";
          await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
          continue;
        }
      }
      return { body, bytes: body.length };
    } catch (e) {
      lastErr = `network_${e.message}`;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  return { gap: `unresolved_after_${attempts}_attempts:${lastErr}` };
};

// Fetch the article's CURRENT revision id and its wikitext in one call, so the
// id and the content can never drift apart.
const fetchReference = async ({ wiki, title }) => {
  const url =
    `https://${wiki}/w/api.php?action=query&format=json&prop=revisions` +
    `&rvprop=ids|timestamp|content&rvslots=main&formatversion=2&titles=${encodeURIComponent(title)}`;
  const r = await get(url, { expectJson: true });
  if (r.gap) return { gap: r.gap };

  const page = r.json?.query?.pages?.[0];
  if (!page) return { gap: "no_page_in_response" };
  if (page.missing) return { gap: "article_missing" }; // genuinely absent — a real result
  const rev = page.revisions?.[0];
  const content = rev?.slots?.main?.content;
  if (!content) return { gap: "no_content_in_revision" };

  return {
    wiki,
    title: page.title,
    pageId: page.pageid,
    revId: rev.revid,
    revTimestamp: rev.timestamp,
    wikitextBytes: Buffer.byteLength(content, "utf8"),
    wikitextSha256: sha256(Buffer.from(content, "utf8")),
    wikitext: content,
  };
};

const fetchMaterial = async (pgId) => {
  const url = `https://www.gutenberg.org/ebooks/${pgId}.txt.utf-8`;
  const r = await get(url);
  if (r.gap) return { gap: r.gap, url };
  return { url, bytes: r.bytes, sha256: sha256(r.body), body: r.body };
};

const run = async () => {
  mkdirSync(join(HERE, "refs"), { recursive: true });
  mkdirSync(join(HERE, "texts"), { recursive: true });

  const books = MANIFEST.books.filter((b) => !only || b.lang === only);
  const lock = [];

  for (const b of books) {
    const tag = `${b.lang}-${b.pgId}`;
    process.stdout.write(`${tag.padEnd(12)} ${String(b.title).slice(0, 28).padEnd(30)}`);

    const record = { pgId: b.pgId, lang: b.lang, title: b.title, script: b.script };

    // --- reference (the third-party analysis) ---
    const ref = await fetchReference(b.ref);
    if (ref.gap) {
      record.reference = { gap: ref.gap, wiki: b.ref.wiki, title: b.ref.title };
      process.stdout.write(` ref=GAP(${ref.gap})`);
    } else {
      const { wikitext, ...meta } = ref;
      writeFileSync(join(HERE, "refs", `${tag}.wikitext`), wikitext, "utf8");
      writeFileSync(
        join(HERE, "refs", `${tag}.meta.json`),
        JSON.stringify({ ...meta, extraction: b.ref.extraction, section: b.ref.section ?? null }, null, 2),
        "utf8",
      );
      record.reference = meta;
      process.stdout.write(` ref=r${meta.revId} ${(meta.wikitextBytes / 1024).toFixed(0)}KB`);
    }

    // --- material (the book) ---
    const ids = [b.pgId, ...(b.companionIds ?? [])];
    record.material = [];
    for (const id of ids) {
      const dest = join(HERE, "texts", `pg${id}.txt`);
      if (refsOnly) continue;
      if (existsSync(dest) && statSync(dest).size > 0) {
        const body = readFileSync(dest);
        record.material.push({ pgId: id, bytes: body.length, sha256: sha256(body), cached: true });
        continue;
      }
      const m = await fetchMaterial(id);
      if (m.gap) {
        record.material.push({ pgId: id, gap: m.gap });
        continue;
      }
      writeFileSync(dest, m.body);
      record.material.push({ pgId: id, bytes: m.bytes, sha256: m.sha256, url: m.url });
    }
    const got = record.material.filter((m) => !m.gap);
    process.stdout.write(refsOnly ? "  (refs only)\n" : `  text=${got.length}/${ids.length}\n`);

    lock.push(record);
  }

  writeFileSync(
    join(HERE, "fetched.lock.json"),
    JSON.stringify({ fetchedBy: "goldens/cast/fetch.mjs", books: lock }, null, 2),
    "utf8",
  );

  const refGaps = lock.filter((r) => r.reference?.gap);
  const matGaps = lock.flatMap((r) => r.material.filter((m) => m.gap));
  console.log(`\n${lock.length} books · ${refGaps.length} reference gaps · ${matGaps.length} material gaps`);
  if (refGaps.length) console.log("reference gaps:", refGaps.map((r) => `${r.lang}-${r.pgId}:${r.reference.gap}`).join(", "));
  if (matGaps.length) console.log("material gaps:", matGaps.map((m) => `pg${m.pgId}:${m.gap}`).join(", "));
  console.log("Timestamps are the giver's, not ours — nothing here reads a clock.");
};

run();
