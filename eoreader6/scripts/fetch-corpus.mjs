// eoreader6 · fetch-corpus — pipeline stage 1 (PROBLEM_CORPUS_SPEC.md §6).
//
// Pulls raw plaintext extracts from Wikipedia for the four problem-corpus
// domains and writes them under corpus/raw/<domain>/<slug>.txt, plus a
// manifest.json recording source citation per file. No marker matching, no
// generation — this stage only fetches.
//
// Usage: node scripts/fetch-corpus.mjs [outDir]

import { mkdir, writeFile } from "fs/promises";
import path from "path";

const SOURCES = {
  turbulence: [
    "Turbulence",
    "Turbulence modeling",
    "Turbulence kinetic energy",
    "Navier-Stokes existence and smoothness",
  ],
  nl_complexity: [
    "Ambiguity",
    "Winograd schema challenge",
    "Coreference",
    "Garden-path sentence",
    "Pragmatics",
  ],
  complexity_emergence: [
    "Complex system",
    "Emergence",
    "Self-organization",
    "Complexity",
  ],
  meta: [
    "Millennium Prize Problems",
    "List of unsolved problems in mathematics",
    "List of unsolved problems in physics",
    "List of unsolved problems in computer science",
  ],
};

const slugify = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const fetchExtract = async (title) => {
  const params = new URLSearchParams({
    action: "query",
    prop: "extracts",
    explaintext: "1",
    redirects: "1",
    format: "json",
    titles: title,
  });
  const url = `https://en.wikipedia.org/w/api.php?${params}`;
  const res = await fetch(url, { headers: { "User-Agent": "eoreader6-problem-corpus/0.1 (research)" } });
  if (!res.ok) throw new Error(`${title}: HTTP ${res.status}`);
  const data = await res.json();
  const pages = data?.query?.pages ?? {};
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined) throw new Error(`${title}: missing page`);
  return { extract: page.extract ?? "", canonical: page.title ?? title };
};

const main = async () => {
  const outDir = process.argv[2] || path.join(process.cwd(), "scripts", "corpus", "raw");
  const manifest = [];

  for (const [domain, titles] of Object.entries(SOURCES)) {
    const domainDir = path.join(outDir, domain);
    await mkdir(domainDir, { recursive: true });

    for (const title of titles) {
      try {
        const { extract, canonical } = await fetchExtract(title);
        if (!extract || extract.length < 200) {
          console.error(`skip (too short): ${domain}/${title}`);
          continue;
        }
        const slug = slugify(canonical);
        const file = path.join(domainDir, `${slug}.txt`);
        await writeFile(file, extract, "utf8");
        manifest.push({
          domain,
          title: canonical,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(canonical.replace(/ /g, "_"))}`,
          file: path.relative(outDir, file),
          chars: extract.length,
        });
        console.error(`fetched: ${domain}/${slug} (${extract.length} chars)`);
      } catch (err) {
        console.error(`FAILED: ${domain}/${title}: ${err.message}`);
      }
    }
  }

  await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.error(`\n${manifest.length} sources fetched -> ${outDir}/manifest.json`);
};

main();
