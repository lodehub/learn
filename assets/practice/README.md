# Practice engine

Real exam questions with instant feedback, on-screen writing marked against the real mark scheme,
and a printable paper, all generated from one `content.json` per tool.

## Files
- `practice.js`, `practice.css`: the engine (uses the tokens in `/assets/style.css`).
- Each tool is a thin wrapper at `/<slug>/<subject>/<tool>/index.html` that loads `practice.js` with
  `data-content="content.json"` and `data-key="<slug>:<subject>:<tool>"` (progress is saved under `<key>:state`).
- Figures used by a tool live in its own `fig/` folder.

## Printable paper
Open the tool with `?print` (e.g. `.../week3plus-forces/?print`) and print to PDF (A4). Save it in the tool
folder and point the manifest entry's `print` at it. Same content file, so screen and paper never drift apart.

## content.json
Top level: `kicker`, `title`, `sub`, `skill`, `target`, `print` (PDF file name), `sections[]`, `paper`.
Each section: `{ h, time, sub, blocks[] }`. Every question block can carry `source`, `marks`, `stem`,
`extract`, `fig {src, alt, label}`, `table {title, head, rows, label}`, `q` and `ms` (mark scheme HTML).
Text may hold simple HTML; `[[3/5]]` and `[[2 1/4]]` render as stacked fractions.

| type | what it does | key fields |
|---|---|---|
| `info` | a note or the question itself | `html`, `tone: "big"` |
| `mc` | multiple choice, marked instantly | `o[]`, `c` (index), `why` |
| `num` | typed number/fraction answer | `answer` (or list), `form: "mixed" \| "fraction"`, `simplest`, `traps[{value,msg}]`, `unit` |
| `steps` | a method, one checked step at a time | `steps[{p, answer, mark, marks, hint}]` |
| `product` | “write fractions less than 1 in the boxes” | `target`, `n` |
| `order` | tap items into order (a chain, a level ladder) | `items[]` (correct order), `labels[]`, `done` |
| `write` | write on screen, then self-mark | `mark.points[{t, m}]` or `mark.levels[{l, m, mark, d, eg}]`, `mark.note` |
| `checklist` | ticks saved on the device | `items[]` |
| `oral` | a question for a parent to ask | `q`, `note` |

Marks: on-screen questions score on the first try; `write` blocks score what the learner awards themselves.

`paper`: `{ title, sub, intro, blocks[], selfcheck[], marking[{h, html}], footer }`. Paper blocks are questions
(`lines`, `workBox` in mm, `answerLine`), `info`, `plan {cols}` or `table {cols, rows}`; `pageBreak: true` starts a new page.
