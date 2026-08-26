// challenge-21 · host-pipeline worker (child process)
//
// argv[2] = absolute path to the corpus fixture to ingest
// env NETBLOCK_MODE = "throw" | "hang" | "none" (default "none")
// env NETBLOCK_LOG  = path to append call-attempt records to (optional)
//
// If NETBLOCK_MODE is throw/hang, the network-blockade preload is imported
// FIRST — before packages/host/corpus.js — so every network primitive is
// hostile for the entire lifetime of this process before any pipeline code
// runs a single line.
//
// Runs the real host-tier fold/ingest pipeline
// (createSession -> ingestFile -> searchSpans x3 -> spanUnits -> foldSpans
// -> sessionReferents) against the fixture and prints one JSON line to
// stdout summarizing deterministic results, so the parent process can diff
// mode=none vs mode=throw vs mode=hang byte-for-byte.

const mode = process.env.NETBLOCK_MODE || "none";
if (mode === "throw" || mode === "hang") {
  await import("./challenge-21-network-blockade.mjs");
}

const { createSession, ingestFile, searchSpans, spanUnits, foldSpans, sessionReferents } = await import(
  "../../../packages/host/corpus.js"
);

const fixturePath = process.argv[2];
if (!fixturePath) {
  console.error("usage: node challenge-21-host-pipeline-worker.mjs <absolute-fixture-path>");
  process.exit(2);
}

const t0 = Date.now();

const session = createSession({ spanCap: Number.MAX_SAFE_INTEGER }); // matches eochat's live config
const admitted = ingestFile(session, fixturePath);

const queries = ["Odysseus and Penelope", "the suitors in the house", "Telemachus sailed to Pylos"];
const searchResults = queries.map((q) => {
  const { spans } = searchSpans(session, { query: q, limit: 5 });
  return {
    query: q,
    hits: spans.map((s) => ({ span_id: s.span_id, score: Number(s.score.toFixed(6)), byte_start: s.byte_start })),
  };
});

const { spans: foldQuerySpans } = searchSpans(session, { query: queries[0], limit: 10 });
const units = spanUnits(session, foldQuerySpans);
const folded = foldSpans(session, { units, query: queries[0], tokenBudget: 800 });

const sourceId = `source:${fixturePath}`;
const referents = sessionReferents(session, { sourceId, limit: 10 });

const elapsedMs = Date.now() - t0;

const summary = {
  mode,
  elapsedMs,
  chunks: admitted.chunks,
  spanCount: session.spans.size,
  documentCount: session.documents.size,
  searchResults,
  folded: {
    selectedCount: folded.selectedCount,
    tokens: folded.tokens,
    dropped: folded.dropped,
    summaryLength: folded.summary.length,
  },
  referents: {
    count: referents.referents.length,
    top: referents.referents.slice(0, 5).map((r) => ({ display: r.display, mentions: r.mentions })),
    gapCount: referents.gaps.length,
  },
};

console.log(JSON.stringify(summary));
