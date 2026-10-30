# Language Lab

One engine, any language. The idea: every language is built from the same few kinds of sentence
(ask, name it, where is it, I want, I like/have, describe, actions, other people, past/future, join).
Learn one sentence frame at a time, with a small pack of words, and keep recycling old frames with new words.

## Files
- `blueprint.json`: the language-neutral plan: levels, stages, word ids (+ English), fixed phrases and sentence frames.
- `french.json`, `mandarin.json`: one file per language: translations of the words, phrases and frames, plus tips per stage.
- `lab.js`, `lab.css`: the engine. Each child's page is a thin wrapper at `/<slug>/<subject>/<lang>-lab/index.html`
  that loads `lab.js` with `data-lang="french"` (the JSON file name). Progress is saved per child under `<slug>:<subject>:<tool>:state`.

## Frames
A frame is a template with slots: `"I want {n.a}."` with `"slots": { "n": "food|drink" }`.
Each slot is filled with a random word carrying one of those tags, from any stage the learner has started,
so every new word makes every old frame bigger.

Token syntax: `{slot}`, `{slot.form}`, `{slot~other}` (agree with / conjugate for another slot),
`{slot@other}` (preposition + its object), `{=wordId~other}` (a fixed word, conjugated).

| form | English | French | Mandarin |
|------|---------|--------|----------|
| `the` / `le` | the dog | le chien, l'eau | 狗 |
| `a` / `un` | a dog, some water | un chien, de l'eau | 狗 |
| `gen` | dogs, water | les chiens, l'eau | 狗 |
| `de` | | (pas) de chien | |
| `to` / `a` (places) | to the park, to school | au parc, à l'école | 公园 |
| `one` | | | 一只狗 (adds the measure word) |
| verbs: `inf`, `je`, `pc`, `past`, `s` | eat, ate | manger, je mange, j'ai mangé | 吃 |

Mandarin text is written as `汉字|pinyin` pairs separated by spaces; each pair is one tile in Build.

## Adding things
- **A word**: add it to `blueprint.json` (id, stage, tags, English) and to each language file. A language can skip a word
  (Mandarin has no "the").
- **A frame or stage**: add to `blueprint.json`, then a translation in each language file.
- **A language**: copy `french.json`, translate, and add a wrapper page with `data-lang="<file name>"`.
  A language whose grammar works differently (cases, measure words...) may need a few lines in `lab.js` next to the
  French and Mandarin renderers.

## Beyond the starter pack
- **Verb Dials** (`dials.js` + `french-dials.json`, level 4): every sentence has dials (person, tense, negative,
  question). The engine conjugates any verb in six tenses from the rules plus the irregular forms listed in the JSON,
  and drills Transform (turn a dial, type the result; accents optional), Pick the form (near-miss options such as
  *j'ai allé*) and a 60-second speed round. Page: `heeler/french/verb-dials/`.
- **Mainland Mandarin** (`mainland.js` + `mainland.json`): for a fluent Malaysian Chinese speaker. Habits to swap
  (Malaysian → mainland), conversation moves (reusable chunks), and themes (word swaps, vocab, a model conversation).
  Add a theme by adding an object to `themes`. Page: `heeler/mandarin/mainland/`.
