# Hand-built literary character networks (public domain source texts)

## les-mis / lesmis.json
Les Misérables (Victor Hugo, 1862). 77 characters, 254 weighted co-occurrence
edges (co-appearance by chapter). Compiled by Donald Knuth, 1993, as part of
the Stanford GraphBase. Fetched from a GitHub mirror of the widely-reused
d3.js example dataset.

## stanford-graphbase/huck.dat + huckleberry-finn-{nodes,edges}.csv
Huckleberry Finn (Mark Twain, 1885/1993 SGB encoding). 74 characters, 301
unique co-occurrence edges, 552 total chapter co-occurrences. huck.dat is
Knuth's original file, untouched (its own header says "may be freely copied
but please do not change it in any way"); the CSVs are my parse of it —
chapter-grouped co-occurrence turned into a weighted edge list.

## stanford-graphbase/david.dat + david-copperfield-{nodes,edges}.csv
David Copperfield (Charles Dickens, 1850/1993 SGB encoding). 87 characters,
406 unique co-occurrence edges, 1390 total chapter co-occurrences. Same
original-plus-parse structure as Huck Finn above.

## shakespeare-networks.zip
All 37 of Shakespeare's plays (public domain), two co-occurrence networks
each (speech-based and time-based on-stage co-presence), Pajek .net format.
Built by Bastian Rieck et al. for "Shall I compare thee to a network?"
(IEEE VIS 2016). MIT licensed. Source: github.com/Pseudomanifold/Shakespeare.

Not included: a hand-built War and Peace network. The two papers that built
one (part-by-part co-occurrence; physical-proximity contact-tracing) never
released it as open data — only as tables/figures inside the papers
themselves.
