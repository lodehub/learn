# Bible Lab

A family Bible study that works through one book, one passage a week. Lives at `/bible/` (linked from the home page).

## The weekly rhythm
Five short sessions (about 10 minutes, same time each day), each opening by saying the week's verse together:
1. **Read**: the big question, the background, read the passage aloud, words to know, what did you notice?
2. **Dig**: interpretation questions, each with a guide answer behind a button (no preparation needed), plus one for younger ones.
3. **Principle**: one-sentence timeless truth, why it matters, "Jesus said it first", other cross-references.
4. **Live it**: real-life scenarios, then the family picks one "This week we will…" (goes on the printable fridge card), and a prayer prompt.
5. **Check-in**: recite together, how did it go, a note to look back on, the principles wall. Finishing the week unlocks the next one.

Alongside: **verse practice**, 2 minutes per person per day: a five-step trainer (read, first letters, fade, build, say it)
and spaced review (Leitner boxes: 1, 2, 4, 7, 14, 30, 60 days), so old verses keep coming back.

## Files
- `bible/index.html`: the page (hash-routed; see the comment at the top of `bible.js`).
- `bible/bible.json`: seasons (books) available, extra people besides the children (e.g. Grown-ups), "coming next" ideas.
- `bible/<season>/season.json`: everything for one book: background, and per week the passage text, context, words,
  questions with guide answers, principle, cross-references, scenarios, commitments, prayer, anchor and stretch verses.
- `assets/bible/bible.js`, `bible.css`: the engine.

## Saved progress
- Family progress (sessions done, commitments, notes) on the device: `bible:family`.
- Each person's verse memory: `<slug>:bible:lab:mem`. Who's practising: `bible:who`.

## Adding a book
Write `bible/<id>/season.json` in the same shape as `philippians/season.json` and add an entry to `seasons` in `bible.json`
(the first entry is the one "Start here" points to).

## Translations and copyright
- The family uses the **NIV (Anglicised)**. Biblica allows up to 500 NIV verses on a site without permission, as long as
  they never make up a whole book and are under 25% of the work, with the copyright notice shown (`credits` in `bible.json`,
  `translation` in each season). So an NIV season holds only memory verses and cross-references (`"version": "NIVUK"`),
  and each week's passage is read from the family's own Bibles, with a link to BibleGateway. Keep a running total:
  Philippians uses 42 quotations.
- A public-domain season (James, World English Bible) can embed the whole passage as `passage` rows instead.
