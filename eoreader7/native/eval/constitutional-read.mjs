// native/eval/constitutional-read.mjs — the CONSTITUTIONAL reader, run as 6.1
// specifies it, from the v7 repo.
//
// READING-POLICY P0: "Read through the host session unless you are
// deliberately isolating one organ. Any claim about 'what this system can do'
// must name the assembly it was measured on." The assembly here is the
// LEGACY HOST — packages/host/corpus.js::discoveredCast via sessionReferents:
// surfaces -> witnessed referents -> pronoun binding -> relation vocabulary ->
// SVO triples — which V7-CUT's compatibility law explicitly keeps alive
// ("Existing 6.1 paths may survive as compatibility facades") while native
// re-earns each stage under conformance. This driver exists because the v7
// native path was being reported as "the reader" while missing P2 stages 4-8
// outright; the constitutional baseline must be RUNNABLE from this repo, not
// remembered.
//
// P3: priors are INJECTED, never derived, and every reported run states which.
// This driver injects the language prior (bin/priors/lang/en.json, via
// `language: "en"`) and the per-text coref prior when one exists for the
// source (pg84-frankenstein.coref.json — the human-curated "the creature"
// cluster; P3: "A result produced with an empty coref prior is a result about
// an unprimed reader").
//
// P2: "A run reports which it used; unused stages are not implied." The
// manifest below names stages run AND stages not run.
//
// P5.2: byte-offset self-verification is mandatory for anything that emits a
// seekable address — a sample of admitted spans is re-sliced and compared.
//
// Usage: node native/eval/constitutional-read.mjs <book.txt> [--coref <prior.json>] [--language en]

import fs from "node:fs";
// Imported from corpus.js directly rather than the host/index.js barrel:
// the pinned submodule's assertion-resolution.js carries a pre-existing
// SyntaxError (an unbalanced paren in a one-line reducer), and index.js
// re-exports it, so the barrel cannot even parse. The organs this driver
// needs all live in corpus.js; the broken file is reported, not patched —
// it is the frozen 6.1 mount's own byte, and fixing it belongs upstream.
import {
  createSession,
  admitChunked,
  sessionReferents,
  sessionRelations,
} from "../../legacy-eoreader6.1/packages/host/corpus.js";

const arg = (flag) => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : null;
};

async function main() {
  const path = process.argv[2];
  if (!path) throw new TypeError("usage: node native/eval/constitutional-read.mjs <book.txt> [--coref <prior.json>] [--language en]");
  const language = arg("--language") ?? "en";
  const corefPath = arg("--coref");
  const text = fs.readFileSync(path, "utf8");
  const sourceId = `file:${path.split("/").pop()}`;

  // P3 — the injected priors, each with its giver, stated up front.
  const corefPrior = corefPath ? JSON.parse(fs.readFileSync(corefPath, "utf8")) : null;
  const priorsInjected = [
    { kind: "language", giver: `bin/priors/lang/${language}.json`, via: `admitChunked({ language: "${language}" })` },
    ...(corefPrior
      ? [{ kind: "coref", giver: corefPrior.source ?? corefPath, version: corefPrior.coref_prior_version ?? null, via: "sessionReferents({ priors })" }]
      : []),
  ];

  const session = createSession();
  const admitted = admitChunked(session, { text, sourceId, language });

  // P5.2 — byte-offset self-verification over a sample of admitted spans.
  // Spans register under the per-chunk id (`<sourceId>#<n>`), not the bare
  // document id — the first cut filtered on equality, sampled zero, and
  // P5.2's own rule line flagged it: 0-verified is the bug's shape.
  const spans = [...session.spans.values()].filter((s) => String(s.source_id ?? "").startsWith(sourceId));
  const sample = spans.filter((_, i) => i % Math.max(1, Math.floor(spans.length / 25)) === 0).slice(0, 25);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const decoder = new TextDecoder();
  let verified = 0;
  for (const span of sample) {
    const sliced = decoder.decode(bytes.slice(span.byte_start, span.byte_end));
    if (sliced === span.text) verified += 1;
  }

  const cast = sessionReferents(session, { sourceId, priors: corefPrior ? [corefPrior] : [], limit: 200 });
  const relations = sessionRelations(session, { sourceId });

  const report = {
    schema: "EOConstitutionalRead@1",
    // P0 — the assembly, named.
    assembly: "legacy-eoreader6.1 packages/host — createSession / admitChunked / sessionReferents (discoveredCast: surfaces -> witnessed referents -> pronoun binding -> relation vocabulary) / sessionRelations",
    source: sourceId,
    // P3 — which priors were injected. An empty coref slot means an unprimed reader, said as such.
    priorsInjected,
    corefPrimed: Boolean(corefPrior),
    // P5.4 — the fold unit, declared.
    foldUnit: "sentence (the perceiver's own unit)",
    // P2 — stages run and stages NOT run, never implied.
    stagesRun: [
      "1 perception (statistics from the material)",
      "2 witnessed admission (byte-accurate spans, provenance registered)",
      "3 alias resolution (name-variant coreference)",
      "4 pronoun binding (one-hop activation recall)",
      "5a typed directional relation - SVO extraction (the thin layer; P6: 2.1% admission on the reference run)",
    ],
    stagesNotRun: [
      "5b binding layer (displacement null / transfer entropy / reversal null - emergence/binding.js; P6 calls THIS the substantive product; 6.1's own reference run drives it from a script, not the host)",
      "6 altitude (tiers)",
      "7 population (classifyIndividuation)",
      "8 kind (jati/induceKinds)",
    ],
    admission: { chunks: admitted.chunks ?? admitted.admitted?.length ?? null, spans: spans.length },
    byteVerification: { sampled: sample.length, verified, rule: "P5.2 - offsets re-sliced against the received bytes; 0-verified is the CRLF bug's shape" },
    cast: {
      referents: (cast.referents ?? []).length,
      // sessionReferents rides pronoun bindings ON each referent
      // (pronounMentions), never as a top-level array — read the host's own
      // shape instead of the internal one.
      pronounMentions: (cast.referents ?? []).reduce((n, r) => n + (r.pronounMentions ?? 0), 0),
      gapDetails: (cast.gaps ?? []).map((g) => (typeof g === "string" ? g : `${g.reason}: ${g.detail ?? ""}`)).slice(0, 6),
      top: (cast.referents ?? [])
        .map((r) => ({ display: r.display, mentions: r.mentions ?? 0, pronounMentions: r.pronounMentions ?? 0, fromPrior: r.fromPrior === true, individuation: r.individuation ?? null }))
        .sort((a, b) => b.mentions - a.mentions)
        .slice(0, 12),
    },
    relations: { triples: (relations?.relations ?? relations ?? []).length ?? null },
  };
  console.log(JSON.stringify(report, null, 1));
}

main().catch((err) => { console.error(err); process.exit(1); });
