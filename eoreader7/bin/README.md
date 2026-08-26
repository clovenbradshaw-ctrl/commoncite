# bin — staged priors, not an organ

Everything here is **data**, waiting to move to `eoPriors`. No code, no
imports, nothing in `packages/` or the root organs may hardcode any of it.

The rule this exists to keep: a mechanism is language-agnostic or it is not a
mechanism. `perceiver/text/material.js` already holds the line — it derives
token relevance from Zipf's law rather than carrying an English stopword list,
on the grounds that "a hardcoded English stopword list would be a lie for every
other language." Sentence segmentation needs the same treatment and did not
have it: `spans.js` split `Mr. Darcy` into two sentences, which severed every
titled name in every English text from its title.

The fix is not an English list inside the splitter. It is an injected prior:

```js
import { splitSentences } from "../packages/engine/perceiver/text/spans.js";
const en = JSON.parse(readFileSync("bin/priors/lang/en.json", "utf8"));
const sentences = splitSentences(text, { abbreviations: en.abbreviations });
```

`splitSentences` still works with nothing injected — it derives a weaker set
from the material itself, Zipf-style, with no word list — but the derived set
is a floor and a fragile one. Measured, using eoreader6's own splitter:

| | no handling | derived | with `en.json` |
|---|---|---|---|
| Pride and Prejudice, sentences | 7,791 | 7,769 | **6,591** |
| `Mr. Darcy` inside one sentence | 0 | 0 | **249** |
| `Mrs. Bennet` inside one sentence | 0 | 0 | **140** |
| Frankenstein, `Mr. Kirwin` | 0 | 13 | 13 |
| Frankenstein, `Mrs. Saville` | 0 | 0 | 4 |

The ~1,200 phantom sentences in Pride and Prejudice were titles split off as
sentences of their own. The fallback recovers some of this on Frankenstein and
none of it on Pride and Prejudice, because "always written with a period" is
all-or-nothing: one period-less occurrence anywhere in the file, licence header
included, disqualifies a token for the whole text.

## Layout

```
bin/priors/lang/en.json     abbreviations that take a period without ending a sentence
```

A Basque or Russian prior is a **different file**, not an extension of `en.json`.
Basque additionally needs something no list supplies: it case-marks names
agglutinatively (*Peru* → *Peruk*, *Peruri*, *Peruren*), so surface matching
there needs a morphology step, not a longer word list.

## Why `bin/` is in the root-directory conformance test

`conformance/seed.test.js` asserts the exact set of root directories so that an
unearned organ cannot be planted quietly. `bin/` is not an organ — it is staged
data with no importable surface — and the test names it separately for that
reason. If it ever grows code, it has become an organ and has to be earned like
one.
