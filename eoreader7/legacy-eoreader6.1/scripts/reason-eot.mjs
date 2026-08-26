#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { reasonOverEot, renderEotReasoning } from "../packages/engine/reasoning/eot.js";

const demo = [
  ["EVA", "Figure", "Abraham Lincoln", "vice_president", "Hannibal Hamlin", {
    id: "hamlin",
    scope: { start: "1861-03-04", end: "1865-03-03" },
    witness: { source: "demo", address: "hamlin" },
  }],
  ["EVA", "Figure", "Abraham Lincoln", "vice_president", "Andrew Johnson", {
    id: "johnson",
    scope: { start: "1865-03-04", end: "1865-04-15" },
    witness: { source: "demo", address: "johnson" },
  }],
];

const path = process.argv[2];
const tuples = path ? JSON.parse(await readFile(path, "utf8")) : demo;
const subject = process.argv[3];
const predicate = process.argv[4];
const query = {
  ...(subject ? { subject } : {}),
  ...(predicate ? { predicate } : {}),
};

const result = reasonOverEot(tuples, query);
process.stdout.write(`${renderEotReasoning(result)}\n`);
