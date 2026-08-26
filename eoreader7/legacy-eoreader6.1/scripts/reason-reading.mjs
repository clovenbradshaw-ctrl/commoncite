#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createSession, admitChunked } from "../packages/host/corpus.js";
import { reasonSession, renderSessionReasoning } from "../packages/host/reasoning.js";

const path = process.argv[2];
if (!path) {
  process.stderr.write("usage: node scripts/reason-reading.mjs <text-file> [subject] [predicate]\n");
  process.exit(2);
}

const text = await readFile(path, "utf8");
const sourceId = `source:${path}`;
const session = createSession();
admitChunked(session, { sourceId, text });

const subject = process.argv[3];
const predicate = process.argv[4];
const query = {
  ...(subject ? { subject } : {}),
  ...(predicate ? { predicate } : {}),
};

const result = reasonSession(session, { sourceId, query });
process.stdout.write(`${renderSessionReasoning(result)}\n`);
