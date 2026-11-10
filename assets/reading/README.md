# Reading shelf

Articles to read, made easy to read. One JSON file per shelf; a thin wrapper page loads the engine:

```html
<link rel="stylesheet" href="../../../assets/fonts/atkinsonhyperlegible-c24f9e.css">
<link rel="stylesheet" href="../../../assets/style.css">
<link rel="stylesheet" href="../../../assets/reading/reading.css">
<main id="app" class="rd-page"></main>
<script src="../../../assets/send.js"></script>
<script src="../../../assets/reading/reading.js" data-content="reading.json" data-key="<slug>:<subject>:reading"></script>
```

Routes: `#/` is the shelf (cards grouped by `topic`), `#/<id>` opens one item. Text size (A− / A+), "read" ticks and
notebook entries are saved on the device; notebook entries are also sent with LearnSend.

## Copyright: which kind to use
- `"kind": "full"`: the article text is stored here. **Only for openly licensed text** (World History Encyclopedia is
  CC BY-NC-SA 4.0: keep the `credit` line with author, date, link, licence and "adapted"). Drop pictures (their licences differ).
- `"kind": "guide"`: anything copyrighted (History Today, newspapers, books). Never copy its text: write our own
  plain-English `points` and `facts`, link to the original with `url`, and credit "Article © <source>".

## Item fields
`id, kind, topic, title, author, source, year, minutes, url, why` (card line), `level`, `readFor[]`,
`words[{w, d}]` (key words; in full text the first use of each becomes tap-to-explain), `note` (notebook prompt), `credit`.
- full: `text[[tag, html]]` with tag `p | h2 | li | blockquote` (simple `<i>`/`<b>` only).
- guide: `intro`, `points[]`, `facts[[when/where, fact]]`, optional `quote`.
- either: `debate` (HTML, a "Historians disagree" box).

## Adding an article
Add one object to `items` in the shelf's JSON. A new topic heading appears automatically.
For a World History Encyclopedia article, fetch the page and keep only the paragraphs, headings, lists and quotes
inside `class="text body"` (drop adverts, "Follow us", book promotions and picture captions).
