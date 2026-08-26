// eoreader6 · goldens/cast/extract-cast — turns each frozen third-party
// wikitext into a list of principal-character names.
//
// THIS IS OUR ACT, NOT THE GIVER'S. fetch.mjs deliberately stops before this
// step: pulling names out of a wikitable is a judgement, and folding it into
// the fetch would make the received gift unauditable. So the raw wikitext
// stays verbatim under refs/, and every rule applied to it is declared here,
// by name, revisable on its own.
//
// There is no general rule. Nine references, six different shapes — a
// definition list in Finnish, h3 subsections in German, a wikitable in
// 紅樓夢, bolded bullets in French, {{lang|grc}} annotations on the English
// Homeric list, and comma-separated inline groups in Hungarian. A single
// "smart" parser over all of them would silently do the wrong thing on most.
// Each strategy names the article it was written for.
//
// Usage: node goldens/cast/extract-cast.mjs [--only <lang>] [--show <tag>]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- wikitext bits

// File/image links must go BEFORE unlink, because their caption is the last
// pipe field and unlink would promote it to a "name" — that is how
// "bélyegkép|250px|Janicsár tisztek" became a cast member on first run. They
// also nest ([[Kép:x|thumb|[[Janicsár]] tisztek]]), so bracket-count rather
// than regex-match. Namespace prefixes are language-specific by nature; this
// is a property of MediaWiki, not of the text being read, so listing them is
// not a language prior on the material.
const FILE_NS = /^(?:file|image|kép|fájl|tiedosto|datei|bestand|imagen|εικόνα|文件|图像|档案)\s*:/i;
const stripFileLinks = (s) => {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "[" && s[i + 1] === "[") {
      const inner = s.slice(i + 2);
      if (FILE_NS.test(inner)) {
        let depth = 1, j = i + 2;
        while (j < s.length && depth > 0) {
          if (s[j] === "[" && s[j + 1] === "[") { depth++; j += 2; continue; }
          if (s[j] === "]" && s[j + 1] === "]") { depth--; j += 2; continue; }
          j++;
        }
        i = j - 1;
        out += " ";
        continue;
      }
    }
    out += s[i];
  }
  return out;
};

/** [[Target|Display]] -> Display, [[Target]] -> Target. Display is what a reader sees. */
const unlink = (s) => s.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, "$1");

const stripTemplates = (s) => {
  // {{Mme}} and friends. Iterate: templates nest.
  let prev;
  do { prev = s; s = s.replace(/\{\{[^{}]*\}\}/g, " "); } while (s !== prev);
  return s;
};

const cleanName = (s) =>
  stripTemplates(unlink(stripFileLinks(String(s ?? ""))))
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, " ")
    .replace(/<ref[^>]*\/>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/'''?/g, "")
    .replace(/\([^)]*\)/g, " ")   // parenthetical glosses
    .replace(/[„“”"«»]/g, " ")
    .replace(/[*†‡]/g, " ")        // footnote markers, common in hu lists
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[;:,.\-–—]+|[;:,.\-–—]+$/g, "")
    .trim();

/** Body of a section by heading text, at any heading depth, up to the next heading of equal-or-shallower depth. */
const section = (wikitext, headingRe) => {
  const lines = wikitext.split("\n");
  let depth = null;
  const out = [];
  for (const line of lines) {
    const h = line.match(/^(=+)\s*(.+?)\s*=+\s*$/);
    if (h) {
      const d = h[1].length;
      if (depth === null) {
        if (headingRe.test(h[2])) depth = d;
        continue;
      }
      if (d <= depth) break;      // left the section
      out.push(line);              // subsection heading, kept — some strategies need it
      continue;
    }
    if (depth !== null) out.push(line);
  }
  return depth === null ? null : out.join("\n");
};

/** Sub-headings of a given depth inside a block. */
const subHeadings = (block, depth) => {
  const re = new RegExp(`^={${depth}}\\s*([^=].*?)\\s*={${depth}}\\s*$`, "gm");
  return [...block.matchAll(re)].map((m) => cleanName(m[1])).filter(Boolean);
};

// ---------------------------------------------------------------- strategies

const STRATEGIES = {
  // de: `== Figuren des Romans ==` with one `=== Name ===` per principal.
  // The cleanest reference in the slate. NOTE the `=== Erster Teil ===`
  // headings under `== Inhalt ==` are PLOT PARTS, not figures — scoping to
  // the Figuren section is what keeps them out.
  "de-34811": (w) => {
    const b = section(w, /^Figuren des Romans$/i);
    return b ? subHeadings(b, 3) : [];
  },

  // fr: `=== Personnages ===`, bulleted, each opening with a '''bolded''' name.
  // Entries like "Les Lorilleux" (a couple) and "La grande Clémence et Mme
  // Putois" (two people in one bullet) are kept as written — splitting them
  // would be us inventing cast members the reference did not list.
  "fr-6497": (w) => {
    const b = section(w, /^Personnages$/i);
    if (!b) return [];
    return [...b.matchAll(/^\*+\s*'''(.+?)'''/gm)].map((m) => cleanName(m[1])).filter(Boolean);
  },

  // fi: `== Hahmot ja paikat ==`, a definition list `; [[Juhani (…)|Juhani]]`.
  // The seven brothers are an exactly closed set and each has his own article.
  "fi-11940": (w) => {
    const b = section(w, /^Hahmot ja paikat$/i);
    if (!b) return [];
    return [...b.matchAll(/^;\s*(.+)$/gm)].map((m) => cleanName(m[1])).filter(Boolean);
  },

  // hu (Pál utcai fiúk): `== Szereplők ==` mixes two shapes — bolded group
  // lines with comma-separated names ("'''A Pál utcai fiúk''': Nemecsek Ernő,
  // Boka János, …") and `=== Name ===` subsections for the four principals.
  // Take both. The comma split is safe here because Hungarian puts the family
  // name first and writes each person as a bare two-token name.
  "hu-69689": (w) => {
    const b = section(w, /^Szereplők$/i);
    if (!b) return [];
    const names = new Set(subHeadings(b, 3));
    for (const line of b.split("\n")) {
      if (/^=/.test(line) || !line.trim()) continue;
      const body = line.replace(/^'''[^']+''':?/, "");  // drop the group label
      for (const piece of cleanName(body).split(/[,،]/)) {
        const n = cleanName(piece);
        // A cast entry here is 1-3 tokens; longer pieces are descriptive prose.
        if (n && n.split(/\s+/).length <= 3 && /\p{Lu}/u.test(n)) names.add(n);
      }
    }
    return [...names];
  },

  // hu (Egri csillagok): `== Szereplők ==`, `* '''[[Link|Name]]'''` bullets
  // under "Valós főszereplők", plus an inline "További szereplők" list.
  "hu-76235": (w) => {
    const b = section(w, /^Szereplők$/i);
    if (!b) return [];
    const names = new Set();
    for (const m of b.matchAll(/^\*+\s*'''(.+?)'''/gm)) {
      const n = cleanName(m[1]);
      if (n) names.add(n);
    }
    const more = b.split(/További szereplők/)[1];
    if (more) {
      for (const piece of cleanName(more.split("\n\n")[0]).split(/[,]/)) {
        const n = cleanName(piece);
        if (n && n.split(/\s+/).length <= 3 && /\p{Lu}/u.test(n)) names.add(n);
      }
    }
    return [...names];
  },

  // nl: `===Gebruikte pseudoniemen===` is a definition list mapping CHARACTER
  // to the real person behind them — a roman-à-clef key, not a character
  // list. The TERM side is the character. Droogstoppel, Stern and Multatuli
  // are not in it; they get their own h3 subsections, so both are taken.
  // Flagged in the manifest as a partial reference.
  "nl-11024": (w) => {
    const b = section(w, /^Gebruikte pseudoniemen$/i);
    const names = new Set(["Droogstoppel", "Stern", "Multatuli"]); // the three h3 subsections
    if (b) {
      for (const m of b.matchAll(/^;\s*([^:\n]+)/gm)) {
        const n = cleanName(m[1]);
        if (n) names.add(n);
      }
    }
    return [...names];
  },

  // zh 紅樓夢: genealogical wikitables, first cell is the character.
  // explaintext DROPS these entirely, which is how the cast vanishes if you
  // fetch the article the obvious way.
  "zh-24264": (w) =>
    [...new Set([...w.matchAll(/^\|\s*\[\[([^\]|]+)(?:\|[^\]]*)?\]\]\s*\|\|/gm)].map((m) => cleanName(m[1])))].filter(Boolean),

  // zh 西遊記: NOT a table — nested `=== Name ===` / `==== Name ====`
  // subsections. Same article family, different shape; assuming one shape for
  // both Chinese entries would have returned nothing here.
  "zh-23962": (w) =>
    [...new Set([...w.matchAll(/^={3,4}\s*([^=\n]+?)\s*={3,4}\s*$/gm)].map((m) => cleanName(m[1])))].filter(Boolean),

  // el: the English "List of Homeric characters". Every entry carries the
  // Greek-script name in {{lang|grc|…}}, so this doubles as an alignment
  // table. The GREEK is what we match against the material — the English
  // lemma cannot appear in a Greek text.
  "el-homeric": (w) => {
    const names = [];
    for (const m of w.matchAll(/^\*+\s*(.+)$/gm)) {
      const line = m[1];
      // {{lang|grc|Ἀχιλλεύς}} or a bare parenthesised Greek form
      const grc =
        line.match(/\{\{lang\|grc\|([^}|]+)\}\}/) ||
        line.match(/\(([Ͱ-Ͽἀ-῿][^)]*)\)/);
      if (!grc) continue;
      const greek = cleanName(grc[1].replace(/\[\[|\]\]/g, ""));
      const en = cleanName((line.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/) || [])[2] ||
                           (line.match(/\[\[([^\]|]+)/) || [])[1] || "");
      if (greek) names.push({ name: greek, gloss: en });
    }
    // Dedupe on the Greek surface.
    const seen = new Set();
    return names.filter((n) => !seen.has(n.name) && seen.add(n.name));
  },
};
STRATEGIES["el-36248"] = STRATEGIES["el-homeric"];
STRATEGIES["el-30613"] = STRATEGIES["el-homeric"];

// ---------------------------------------------------------------- run

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const show = args.includes("--show") ? args[args.indexOf("--show") + 1] : null;

const MANIFEST = JSON.parse(readFileSync(join(HERE, "manifest.json"), "utf8"));
mkdirSync(join(HERE, "cast"), { recursive: true });

const rows = [];
for (const b of MANIFEST.books) {
  const tag = `${b.lang}-${b.pgId}`;
  if (only && b.lang !== only) continue;
  const wtPath = join(HERE, "refs", `${tag}.wikitext`);
  if (!existsSync(wtPath)) { rows.push({ tag, gap: "no_frozen_wikitext" }); continue; }

  const strategy = STRATEGIES[tag];
  if (!strategy) { rows.push({ tag, gap: "no_declared_strategy" }); continue; }

  const wikitext = readFileSync(wtPath, "utf8");
  const raw = strategy(wikitext);
  const entries = raw.map((n) => (typeof n === "string" ? { name: n } : n)).filter((e) => e.name);

  const meta = JSON.parse(readFileSync(join(HERE, "refs", `${tag}.meta.json`), "utf8"));
  writeFileSync(
    join(HERE, "cast", `${tag}.cast.json`),
    JSON.stringify(
      {
        tag, lang: b.lang, pgId: b.pgId, title: b.title,
        reference: { wiki: meta.wiki, title: meta.title, revId: meta.revId, sha256: meta.wikitextSha256 },
        strategy: strategy.name || tag,
        count: entries.length,
        entries,
      },
      null, 2,
    ),
    "utf8",
  );
  rows.push({ tag, count: entries.length, sample: entries.slice(0, 6).map((e) => e.name) });
  if (show === tag) console.log(entries.map((e) => e.name).join("\n"));
}

if (!show) {
  for (const r of rows) {
    if (r.gap) { console.log(`${r.tag.padEnd(12)} GAP ${r.gap}`); continue; }
    console.log(`${r.tag.padEnd(12)} ${String(r.count).padStart(3)}  ${r.sample.join(" · ')".slice(0, 3))}`);
  }
  const total = rows.reduce((s, r) => s + (r.count ?? 0), 0);
  console.log(`\n${rows.filter((r) => !r.gap).length} references · ${total} reference names extracted`);
}
