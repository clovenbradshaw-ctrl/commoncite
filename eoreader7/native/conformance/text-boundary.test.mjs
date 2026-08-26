import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as text from "../../text.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const textDir = path.resolve(here, "../adapters/text");

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : entry.name.endsWith(".js") ? [full] : [];
});

test("canonical text API exposes native encounter, perception, and revision", () => {
  for (const name of [
    "stripContainer", "splitSentences", "createCausalTextPerceiver", "textEncounters",
    "reviseTextFold", "extractSurfaces", "discoverReferents", "discoverRelationVocab",
  ]) assert.equal(typeof text[name], "function", `${name} must be a callable native text capability`);
});

test("native text adapter never imports legacy or historical engine paths", () => {
  for (const file of walk(textDir)) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /legacy-eoreader6\.1/, `${file} imports the frozen provider`);
    assert.doesNotMatch(source, /packages\/engine/, `${file} imports historical engine paths`);
  }
});

test("Gutenberg container stripping keeps front matter separate from body coordinates", () => {
  const sample = [
    "Title: Test Work",
    "Author: Example Author",
    "*** START OF THE PROJECT GUTENBERG EBOOK TEST WORK ***",
    "",
    "This is the actual work. It remains addressable.",
    "",
    "*** END OF THE PROJECT GUTENBERG EBOOK TEST WORK ***",
  ].join("\n");
  const stripped = text.stripContainer(sample);
  assert.ok(stripped.text.includes("This is the actual work"));
  assert.equal(stripped.front.find((x) => x.field === "Title")?.value, "Test Work");
  assert.ok(stripped.offset > 0);
  assert.doesNotMatch(stripped.text, /START OF THE PROJECT GUTENBERG/);
});
