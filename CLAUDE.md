# Learn hub: the blueprint

One file for everything: the rules (Part 1) and what has been built so far (Part 2).
Update Part 2 whenever something is added, archived or planned.

# Part 1: Rules and conventions

Static site on GitHub Pages (no build step, no framework), served from the repo root on main.
Owner account: ceejay77 (anonymous by design).

## Children (slugs are folder names; labels can change freely)
| slug  | label | colour | icon        |
|-------|-------|--------|-------------|
| ember | Ember | orange | flame       |
| ninja | Ninja | purple | swords      |
| bingo | Bingo | blue   | paw         |
| heeler | Heeler | green | star        |

## Structure
- `/index.html`: "Who's learning?" child picker, reads `/children.json`
- `/assets/`: shared style.css and ui.js used by every page
- `/assets/lab/`: the Language Lab engine (French Lab, Mandarin Lab), shared by every child. Content lives in its JSON files; each child has a thin wrapper page. See assets/lab/README.md.
- `/bible/`: Bible Lab, a family Bible study (one book, one passage a week, verse memory per person). Engine in `/assets/bible/`, content in `bible/<book>/season.json`. See assets/bible/README.md.
- `/<slug>/index.html`: subject picker, reads that child's `manifest.json`
- `/<slug>/<subject>/<tool>/`: HTML tools to practise on screen
- `/<slug>/<subject>/pdfs/`: that subject's PDF shelf (printables). A worksheet that belongs to one tool can stay in the tool's folder instead.

## Privacy rules (important)
- Never use real names, initials, schools, dates of birth or any personal data anywhere: slugs and labels only.
- Git identity for this repo must be the ceejay77 no-reply email. Check `git config user.email` before every commit.
- Do not commit anything that links to any other personal account or website.

## Rules
- ALL links relative, so the site works at ceejay77.github.io/learn/ and later at a custom domain.
- Each tool stores its own progress in localStorage under a key prefixed `<slug>:<subject>:<tool>:`. No shared save file.
- Adding material = put files in the subject folder + add one entry to that child's manifest.json. Never hand-edit picker HTML.
- manifest entry: { title, path, type: "html"|"pdf", year, status: "current"|"archived", strand?, topic?, term?, print?, printTitle? }.
- `"strand": "explore"` marks a first-principles journey (learning a topic for its own sake, not exam prep). It lives in the normal subject folder but shows in its own "Explore" box above Practise. Name the folder `explore-<topic>/`. Style: rooms the child moves through at their own pace, a "predict first" question before each reveal, an interactive to try, a "Big idea" box, and a notebook prompt saved on the device. No scores, no marks. Optional `topic` groups items under a heading within the subject (e.g. "Times tables"); leave it out while a subject is small.
- "This week" box: a child's manifest can set top-level `"currentWeek": N`; every non-archived item with `"week": N` then appears in one box at the top of that child's page, across subjects, with a tick each (saved on the device under `<slug>:home:this-week:wN`). New week = bump `currentWeek`, tag the new items, archive last week's. Optional top-level `"checkin": "<path>"` adds a link to the half-term check-in in that box.
- Each subject page shows up to three sections: **Explore** (only if it has explore items), **Practise** (type "html") and **Print** (type "pdf", plus any `print` worksheet attached to an HTML tool). Each child page also has an "All printables" shelf listing every PDF by subject.
- A standalone PDF = file in `<subject>/pdfs/` + an entry with type "pdf". A PDF that goes with one HTML tool = add `"print": "<path to pdf>"` (and optionally `"printTitle"`) to that tool's entry, so it gets a print button and appears on the Print shelf.
- Every HTML tool includes `<script src="../../../assets/back.js"></script>` before `</body>` so it has a back button when installed as an app.
- Archiving finished work = set `"status": "archived"` (optionally add `"term": "Autumn"`). Never move or rename the files: the URL, saved progress and printouts keep working. Archived items appear behind the "Archive" toggle, styled exactly like current work, grouped by year (newest first) then topic.
- Deleting old material = remove the folder and its manifest entry.
- Renaming a child's slug means renaming the folder and updating every link: do it in one commit.
- Mobile-first, big tap targets, works on iPad Safari. Add a web manifest and service worker per child folder so each can be installed as a PWA (scoped to that folder).
- Before pushing: open each page locally, check for broken links, then commit with a clear message.

# Part 2: What exists (state as of 31 Oct 2026)

## What it is

A static family learning site: plain HTML/CSS/JS, no build step, no framework, served by GitHub Pages from the repo root on `main`.
All links are relative, so it works at `/learn/` on GitHub Pages and later on a custom domain.

- Home page `index.html`: "Who's learning?" picker (reads `children.json`), plus links to the **Languages** hub and **Bible Lab**.
- One folder per child, each with a subject picker driven by `manifest.json`, plus its own web manifest, icons and service worker so it installs as an app (PWA) on iPad.
- Progress is saved on the device in `localStorage`, one key per tool, prefixed `<slug>:<subject>:<tool>:`.

## Learners

| slug | colour / icon | Subjects |
|------|---------------|----------|
| ember | orange / flame | English, Maths, Science, History, Geography, French, Weekly packs, Mandarin |
| ninja | purple / swords | English, Maths, French, Mandarin |
| bingo | blue / paw | English, Maths, French, Mandarin |
| heeler | green / star | French, Mandarin (was "Bandit", renamed) |

Privacy: slugs and labels only, never real names, schools or personal data. Commit with the ceejay77 no-reply email.

## Site features (shared engine: `assets/style.css`, `assets/ui.js`, `assets/back.js`)

- **Subject pages** show up to three sections: **Explore** (first-principles journeys, `"strand": "explore"`), **Practise** (HTML tools) and **Print** (PDFs and worksheets attached to a tool via `"print"`).
- **All printables** shelf on each child's page, grouped by subject.
- **Archive** toggle: `"status": "archived"` hides finished work without moving files (URLs and saved progress keep working). Grouped by year, then `topic`. Older items were archived to keep the latest two per subject for ember, ninja and bingo.
- **This week** box: manifest top-level `"currentWeek": N`; items tagged `"week": N` show at the top with a tick each. Optional `"checkin"` path adds the half-term check-in link. Currently only ember uses it (`currentWeek: 3`).
- **Back button** on every tool via `back.js` (needed when installed as an app).
- **Explore strand** style: rooms at the child's own pace, "predict first" before each reveal, an interactive, a "Big idea" box, a notebook prompt saved on the device. No scores.

## Content by learner

### Ember (secondary, weekly homework rhythm, currently Week 3)
Current (Week 3):
- English Week 3: symbolism in *Tsunami Girl* (+ PDF)
- Maths Week 3: multiplying fractions, with working and a check (+ PDF)
- Science Week 3: forces and the Because Chain (+ PDF)
- History Week 3: the Black Death (So What?) (+ PDF)
- Geography Week 3: megacities, evidence and a judgement (+ PDF)
- Week 3 homework pack, full, with parent answers (PDF, `weekly/pdfs/`)
- Half-term check-in: how is each subject going? (`weekly/check-in/`)

Also current: French Week 2 (verbs and extending a sentence), French Lab, Mandarin Lab, and **Explore: "Why triangles know things", trigonometry from scratch**.

Archived: English Weeks 1–2 (language analysis); Maths Algebra Quest, Sign Squad, Forming and solving equations, Weeks 1–2; Science B4 Organisms (lungs and gas exchange, breathing, drugs/alcohol/smoking, nutrients and food tests, Weeks 1–2); History Rome 14-day revision road, Roman life and equality, So What? coaching, writing task 2 (Roman childhood), Tie it back to the question, Week 2 PDF; Geography megacities Weeks 1–2.

### Ninja (upper primary, Year 5/6)
- Maths: Mean, median, mode and area; Cancelling: percentages and ratios. Archived: Football stats (+ quiz), Shape Up: area formulas.
- Explore: "Letters that stand for numbers", algebra from scratch; "Detective and Machine", logic and pattern puzzles.
- English: Answer it the way the question asks; Grammar Workshop (Year 5 and 6).
- French Lab, Mandarin Lab.

### Bingo (lower primary, Year 3)
- Maths: Times tables 2s and 5s; Times tables 1 to 10. Archived: Times Table Blast Off 3s and 4s, Match & Blast, Say it then flip it, Climb the threes/fours, Threes Bakery.
- Explore: "Secret Number and Pattern Train", thinking puzzles.
- English: Grammar and Writing Pack; English Quest.
- French Lab, Mandarin Lab.

### Heeler (adult / fluent speaker)
- French **Phrase Lab**: 12 weeks of everyday structures, rebuilt around real situations in Madagascar (audio removed).
- French **Verb Dials** (Language Lab level 4).
- **Mainland Mandarin**: for a fluent Malaysian Chinese speaker; habits to swap, conversation moves, themes.

## Language Lab (`assets/lab/`, see its README.md)
One engine for any language: a language-neutral `blueprint.json` (10 stages, ~110 words, sentence frames with slots) plus one file per language (`french.json`, `mandarin.json`). Each child has a thin wrapper page with `data-lang="..."`.
- `lab.js` / `lab.css`: French Lab and Mandarin Lab (levels 1–3).
- `dials.js` + `french-dials.json`: Verb Dials (37 verbs, six tenses, transform / pick the form / 60-second speed round).
- `mainland.js` + `mainland.json`: Mainland Mandarin.
- `phrase-lab/`: Phrase Lab engine and content (`units.json`, `structures.json`).

**Languages hub** at `/languages/` (driven by `languages/languages.json`): every language tool in level order, pick a person, same saved progress as their own page.

## Bible Lab (`/bible/`, engine in `assets/bible/`, see its README.md)
Family Bible study: one book a month, about a chapter a week, five ~10-minute sessions per week (Read, Dig, Principle, Live it, Check-in), plus per-person verse memory with spaced review.
- Written: **Philippians** (Nov 2026), **Ruth** (Dec 2026), **James** (Jan 2027), each `bible/<book>/season.json`.
- Planned in `bible/bible.json`, not yet written: Jonah (Feb 2027), 1 Peter, Colossians, Ephesians, 1 John, Habakkuk, Titus, Galatians, 1 Thessalonians (Oct 2027).
- NIV (Anglicised) copyright limit: only memory verses and cross-references are embedded; passages are read from the family's Bibles. Running total: **53 NIV verses** used (limit 500). Keep this count updated when adding books.

## How to add things (quick reference)
- **New tool**: create `<slug>/<subject>/<tool>/index.html` (include `../../../assets/back.js`), then add one entry to `<slug>/manifest.json`:
  `{ title, path, type: "html"|"pdf", year, status: "current", topic?, strand?, week?, print?, printTitle? }`. Never hand-edit picker HTML.
- **New week for Ember**: bump `currentWeek`, tag new items with `"week": N`, archive last week's.
- **New Bible book**: write `bible/<id>/season.json` like `philippians/season.json`, add to `seasons`, point the month's `plan` entry at it. Next due: **Jonah for Feb 2027**.
- **New language**: copy `french.json`, translate, add a wrapper page.

## Git history in brief
PRs #1–#29 all merged to `main`. Rough order: initial hub and conventions → first maths/science/English tools → Practise/Print split, printables shelf and archive (#2) → Ember Weeks 1–3 and history coaching (#3–#14) → Ninja/Bingo maths and English (#9–#16) → archive tidy-up (#17) → site restore after an accidental merge of an old local commit (#18) → Heeler added and language tools (#19–#23) → Languages hub (#24) → Bible Lab (#25) → Explore strand (#26–#28) → This-week box and half-term check-in (#29).

## Working locally
```bash
git clone https://github.com/lodehub/learn.git && cd learn
```
```bash
git config user.email   # must be the ceejay77 GitHub no-reply address
```
```bash
python3 -m http.server 8000   # then open http://localhost:8000/
```
- Pull before starting (`git pull origin main`): the last local-commit accident (#18) came from merging stale local history.
- Check pages locally for broken links before pushing.
