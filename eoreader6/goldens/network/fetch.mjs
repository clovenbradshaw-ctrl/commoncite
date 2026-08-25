// eoreader6 · goldens/network/fetch — pulls the MATERIAL this golden reads.
// The REFERENCE (the four co-occurrence networks under refs/) is not fetched
// here — it was a one-time gift from the user, already frozen under refs/
// with its own provenance recorded in manifest.json's `givers` block, the
// same "raw wikitext is frozen verbatim" discipline goldens/cast/fetch.mjs
// keeps between a received gift and this repo's own derived acts.
//
// Novels: Project Gutenberg plaintext, by id.
// Plays: github.com/Pseudomanifold/Shakespeare (MIT) — the exact corpus its
// authors built the reference networks from, fetched file-by-file from a
// pinned commit rather than `git clone`, because that repo's Corpus/
// directory (not needed here) has filenames that are not valid UTF-8 and
// abort a naive clone's checkout.
//
// Usage: node goldens/network/fetch.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = JSON.parse(readFileSync(join(HERE, "manifest.json"), "utf8"));
const SHAKESPEARE_COMMIT = "ca06b5e335585ddf7bab1c0f4738655ade7b2a57";

const UA = "eoreader6-network-golden/1.0 (research fixture builder)";

const get = async (url, { attempts = 4 } = {}) => {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.status === 429 || res.status >= 500) { lastErr = `http_${res.status}`; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); continue; }
      if (!res.ok) return { gap: `http_${res.status}` };
      const body = Buffer.from(await res.arrayBuffer());
      if (body.length === 0) { lastErr = "empty_body"; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); continue; }
      return { body };
    } catch (e) {
      lastErr = `network_${e.message}`;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  return { gap: `unresolved_after_${attempts}_attempts:${lastErr}` };
};

const run = async () => {
  mkdirSync(join(HERE, "texts"), { recursive: true });
  mkdirSync(join(HERE, "texts", "shakespeare"), { recursive: true });

  let ok = 0;
  let gaps = 0;

  for (const b of MANIFEST.books.filter((b) => b.kind === "novel")) {
    const dest = join(HERE, "texts", b.text);
    process.stdout.write(`${b.tag.padEnd(34)} `);
    if (existsSync(dest) && statSync(dest).size > 0) { console.log("cached"); ok++; continue; }
    const r = await get(`https://www.gutenberg.org/ebooks/${b.pgId}.txt.utf-8`);
    if (r.gap) { console.log(`GAP ${r.gap}`); gaps++; continue; }
    writeFileSync(dest, r.body);
    console.log(`${(r.body.length / 1024).toFixed(0)}KB`);
    ok++;
  }

  for (const b of MANIFEST.books.filter((b) => b.kind === "play")) {
    const dest = join(HERE, "texts", b.text);
    process.stdout.write(`${b.tag.padEnd(34)} `);
    if (existsSync(dest) && statSync(dest).size > 0) { console.log("cached"); ok++; continue; }
    const filename = b.text.split("/").pop();
    // Which of the three category folders a given play lives under is not
    // recorded in the manifest (only the flat filename is) — try all three
    // rather than duplicating Pseudomanifold's own categorisation here.
    let found = null;
    for (const category of ["tragedies", "historical", "comedies"]) {
      const url = `https://raw.githubusercontent.com/Pseudomanifold/Shakespeare/${SHAKESPEARE_COMMIT}/Plays/${category}/${encodeURIComponent(filename.replace(/_/g, " ")).replace(/%2F/g, "/")}`;
      const r = await get(url);
      if (!r.gap) { found = r.body; break; }
    }
    if (!found) { console.log("GAP not_found_in_any_category"); gaps++; continue; }
    writeFileSync(dest, found);
    console.log(`${(found.length / 1024).toFixed(0)}KB`);
    ok++;
  }

  console.log(`\n${ok} fetched/cached, ${gaps} gaps`);
};

run();
