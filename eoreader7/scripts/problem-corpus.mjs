import { ground, admissible, isGap, burstiness, difference, gap } from "../nul/index.js";
import { verdict } from "../verdict/index.js";
import { createRegistry, register, lookup } from "../provenance/index.js";
import { createLog, tick, findByType } from "../event_log/index.js";
import { tokenize, buildFrequencyTable, surprisalMicrobits, chunkWords as chunkIntoWords } from "../packages/engine/perceiver/text/material.js";

const MARKERS = [
  // Scientific/research problems
  { category: "unresolved", re: /\b(remains? unsolved|an open (problem|question)|is not (yet )?fully understood|still debated|no exact solution)\b/i },
  { category: "disagreement", re: /\bin contrast to\b.{0,60}\bargues?\b/i },
  { category: "disagreement", re: /\bcompeting (accounts?|theories|explanations)\b/i },
  { category: "existence", re: /\b(existence and smoothness|whether solutions exist|well-?posedness)\b/i },
  { category: "ambiguity", re: /\b(multiple readings?|scope ambiguity|ambiguous (reference|attachment))\b/i },
  // Literary/philosophical problems
  { category: "moral", re: /\b(whether it (was|is) (right|wrong|just)|could not (determine|decide|tell)|moral (dilemma|ambiguity))\b/i },
  { category: "uncertainty", re: /\b(could not be (known|certain|sure)|it is (not )?certain whether|no way of knowing)\b/i },
  { category: "existential", re: /\b(what (am|are) I|who am I|the nature of|what is the purpose|why (am|do) we)\b/i },
  { category: "contradiction", re: /\b(contradict(s|ed|ory)|paradox|inconsistent with)\b/i },
  { category: "mystery", re: /\b(mystery|inexplicable|impenetrable (secret|mystery)|beyond (my|all) comprehension)\b/i },
  { category: "doubt", re: /\b(doubt(ed|ful)?|uncertain(ty)?|perplex(ed|ity)?)\b.{0,60}\b(whether|if|how)\b/i },
];

const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

const splitSentences = (text) => {
  return text.replace(/\s+/g, " ").trim().split(SENTENCE_SPLIT);
};

export const extractProblemSpans = (text, source, domain) => {
  const sentences = splitSentences(text);
  const spans = [];
  for (let i = 0; i < sentences.length; i++) {
    for (const marker of MARKERS) {
      if (marker.re.test(sentences[i])) {
        const lo = Math.max(0, i - 2);
        const hi = Math.min(sentences.length, i + 3);
        const spanText = sentences.slice(lo, hi).join(" ");
        spans.push({
          text: spanText,
          source,
          domain,
          marker: marker.category,
          matchedSentence: sentences[i],
        });
        break;
      }
    }
  }
  return spans;
};

// Real-data frequency model, shared with every other perceiver via
// packages/engine/perceiver/text/material.js. Everything the ground is
// built from, and everything a span is measured against, comes from the
// actual corpus text — never a length proxy. "Surprisal" here is the mean
// Laplace-smoothed -log2(word frequency) over a passage's own words, scaled
// to microbits per PROBLEM_CORPUS_SPEC.md's event schema.

export const kPassMeasurement = ({
  registry, log, spans, domain, fullText = "", passes = 3, draws = 128, window = 12,
  chunkSize = 40,
}) => {
  const results = { passes: [] };

  const words = tokenize(fullText);
  const priorSurprisal = new Map(); // span index -> surprisal_microbits from previous pass

  for (let p = 0; p < passes; p++) {
    const seed = p * 1000 + 42;
    const adjustedDraws = draws + p * 32;

    // Each pass sees a growing fraction of the real corpus, modeling reader
    // assimilation: early passes are provisional (small vocabulary sample),
    // later passes incorporate more of the actual text.
    const fraction = Math.min(1, (p + 1) / (passes + 1));
    const readWordCount = Math.max(Math.min(words.length, chunkSize * (window + 2)), Math.floor(words.length * fraction));
    const readWords = words.slice(0, Math.min(words.length, readWordCount));
    const table = buildFrequencyTable(readWords);

    const chunks = chunkIntoWords(readWords, chunkSize);
    const material = chunks.map((c) => surprisalMicrobits(c, table));

    if (material.length < window + 2) {
      results.passes.push({ pass: p, error: gap("empty_material", { reason: "not enough real text read yet to build a ground", have: material.length, need: window + 2 }) });
      continue;
    }

    const g = ground({ material, draws: adjustedDraws, window, seed });
    if (isGap(g)) {
      results.passes.push({ pass: p, error: g });
      continue;
    }

    const verdicts = [];
    for (let i = 0; i < spans.length; i++) {
      const span = spans[i];
      const refId = register(registry, {
        sourceId: span.source,
        byteStart: 0,
        byteEnd: span.text.length,
        text: span.text,
      });

      const observed = surprisalMicrobits(span.text, table);
      const v = verdict(observed, g, { reseeds: p > 0 ? 2 : 0 });
      verdicts.push({ refId, verdict: v, pass: p, surprisal: observed });

      tick(log, {
        type: p === 0 ? "PROBLEM_SPAN_INGEST" : "PROBLEM_SPAN_REREAD",
        domain,
        source: span.source,
        span_text: span.text.slice(0, 80),
        marker_matched: span.marker,
        ingest_pass: p,
        verdict: v.verdict,
        surprisal_microbits: { prior_relative: priorSurprisal.get(i) ?? null, posterior_relative: observed },
      });
    }

    results.passes.push({ pass: p, verdicts });
    for (let i = 0; i < verdicts.length; i++) priorSurprisal.set(i, verdicts[i].surprisal);
  }

  return results;
};

export const report = (log) => {
  const counts = {};
  for (const ev of log.events) {
    const d = ev.domain || "unknown";
    if (!counts[d]) counts[d] = 0;
    counts[d]++;
  }

  const lines = ["=== Problem-Corpus Report ==="];
  for (const [domain, total] of Object.entries(counts)) {
    lines.push(`${domain}: ${total} events`);
  }
  lines.push(`Total: ${log.events.length} events`);
  return lines.join("\n");
};

// CLI
const args = process.argv.slice(2);
if (args.length > 0 && args[0] !== "--help") {
  const filePath = args[0];
  const domain = args[1] || "nl_complexity";
  const passes = parseInt(args[2]) || 3;

  const fs = await import("fs");
  const text = fs.readFileSync(filePath, "utf8");
  const source = filePath.replace(/^.*[/\\]/, "");
  const spans = extractProblemSpans(text, source, domain);

  console.error(`Extracted ${spans.length} problem spans from ${source}`);

  const registry = createRegistry();
  const log = createLog();

  kPassMeasurement({ registry, log, spans, domain, passes });
  console.log(report(log));
}
