# Spelling test engine

One shared engine for dictation-style spelling tests. Each tool is a single page holding its own word list.

- The device reads each word, then a sentence, then the word again (British voice, `speechSynthesis`; rate set by `rate`).
- The child types it. Wrong: the letters they missed are highlighted, the word's tip (or its pattern's tip) shows, then **Look, cover, write** until they spell it from memory.
- Score = right first time. Missed words are saved on the device (`<data-key>:missed`) as "My tricky words"; a word leaves the list only when it is right first time. Best full-test score is kept (`<data-key>:best`).
- Start screen: full test, one pattern at a time, tricky words, and a word list for a grown-up (paper test, or devices with no speech).
- Nothing is sent anywhere.

Page = copy `ninja/english/spelling-test/index.html` and change the JSON:
`{ kicker, title, lede (HTML), rate?, patterns: [{id, name, tip (HTML), eg}], words: [{w, p (pattern id), s (sentence containing the word), t? (word tip)}] }`.
Sentences must be original and contain the word exactly once (it is blanked on screen).
