/* Phrase Lab: everyday French for real situations. Data: units.json, structures.json in this folder.
   Loaded by a thin page at /<slug>/french/phrase-lab/ or /languages/french/phrase-lab/ after ../learner.js. */
(function () {
  'use strict';

  var BASE = document.currentScript.src.replace(/[^/]*$/, '');
  var KEY = Learner.key('v2');
  var DAY = 86400000;
  // Review gaps in days for boxes 0..6. Box 0 = new or forgotten.
  var GAPS = [0, 1, 2, 4, 8, 16, 32];

  var app = document.getElementById('app');
  var UNITS = [], PAT = {}, CARDS = {};
  var state = load();

  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    s = s || {};
    s.done = s.done || {};
    s.cards = s.cards || {};
    s.mine = s.mine || [];
    s.own = s.own || {};
    s.spotted = s.spotted || [];
    return s;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function on(sel, ev, fn) { var el = typeof sel === 'string' ? document.querySelector(sel) : sel; if (el) el.addEventListener(ev, fn); }

  function clean(text) { return String(text).split(' / ')[0].replace(/\([^)]*\)/g, '').replace(/[«»]/g, ''); }

  // ---------- Content ----------
  function patterns() { return Object.keys(PAT).map(function (k) { return PAT[k]; }).concat(state.mine); }
  function patById(id) { return PAT[id] || state.mine.filter(function (s) { return s.id === id; })[0]; }
  function unitById(id) { return UNITS.filter(function (u) { return u.id === id; })[0]; }

  // Every phrase and practice sentence becomes a card; review state lives in state.cards.
  function buildCards() {
    CARDS = {};
    UNITS.forEach(function (u) {
      u.flat.forEach(function (p) { CARDS[p.key] = p; });
    });
    patterns().forEach(function (s) {
      s.practice.forEach(function (p, i) {
        var k = s.id + ':' + i;
        CARDS[k] = { key: k, en: p[0], fr: p[1], hint: s.pattern, label: s.title };
      });
    });
  }
  function patCards(s) { return s.practice.map(function (p, i) { return CARDS[s.id + ':' + i]; }); }
  function unlock(cards) {
    cards.forEach(function (c) { if (!state.cards[c.key]) state.cards[c.key] = { box: 0, due: today() }; });
  }
  function dueCards() {
    var now = today();
    return Object.keys(state.cards).filter(function (k) { return CARDS[k] && state.cards[k].due <= now; })
      .map(function (k) { return CARDS[k]; });
  }
  function knownCards() { return Object.keys(state.cards).filter(function (k) { return CARDS[k]; }).map(function (k) { return CARDS[k]; }); }
  function grade(key, g) {
    var st = state.cards[key] || { box: 0, due: today() };
    if (g === 'again') st.box = 0;
    else if (g === 'good') st.box = Math.min(st.box + 1, GAPS.length - 1);
    st.due = today() + (g === 'again' ? 0 : Math.max(1, GAPS[st.box]) * DAY);
    state.cards[key] = st;
    save();
  }

  // ---------- Units and steps ----------
  function stepsOf(u) {
    var s = [{ key: 'phrases', kind: 'phrases', title: 'Key phrases', blurb: 'Read and say out loud ' + u.flat.length + ' phrases.' }];
    u.patterns.forEach(function (id) {
      var p = patById(id);
      if (p) s.push({ key: 'pat:' + id, kind: 'pattern', id: id, title: 'Pattern: ' + p.title, blurb: p.meaning });
    });
    s.push(
      { key: 'build', kind: 'build', title: 'Build the sentence', blurb: 'Put the words in the right order.' },
      { key: 'dialogue', kind: 'dialogue', title: 'Conversation', blurb: 'Read it, then take your part.' },
      { key: 'replies', kind: 'replies', title: 'What would you say?', blurb: 'Pick the natural reply.' },
      { key: 'translate', kind: 'translate', title: 'Say it in French', blurb: 'English to French, from memory.' },
      { key: 'talk', kind: 'talk', title: 'Role-play with ChatGPT or Gemini', blurb: 'A ready-made prompt for this situation.' }
    );
    return s;
  }
  function doneKey(u, st) { return u.id + '/' + st.key; }
  function isDone(u, st) { return !!state.done[doneKey(u, st)]; }
  function unitProgress(u) {
    var st = stepsOf(u), n = st.filter(function (x) { return isDone(u, x); }).length;
    return { done: n, total: st.length };
  }
  function nextStep(u) { return stepsOf(u).filter(function (x) { return !isDone(u, x); })[0]; }
  function started(u) { return u.id === state.current || stepsOf(u).some(function (x) { return isDone(u, x); }); }
  function currentUnit() {
    var cur = unitById(state.current);
    if (cur && nextStep(cur)) return cur;
    return UNITS.filter(function (u) { return nextStep(u); })[0] || null;
  }

  // ---------- Answer checking ----------
  function norm(t, keepAccents) {
    t = t.toLowerCase().replace(/[’']/g, "'").replace(/œ/g, 'oe');
    if (!keepAccents) t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return t.replace(/[.,!?;:«»"—–…-]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  // "Enchanté(e)" accepts both "enchanté" and "enchantée".
  function variants(model) {
    var out = [];
    model.split(' / ').forEach(function (a) {
      out.push(a.replace(/\([^)]*\)/g, ''));
      out.push(a.replace(/[()]/g, ''));
    });
    return out;
  }
  function check(input, model) {
    if (!input.trim()) return null;
    var alts = variants(model);
    if (alts.some(function (a) { return norm(a, true) === norm(input, true); })) return 'ok';
    if (alts.some(function (a) { return norm(a) === norm(input); })) return 'accents';
    return 'diff';
  }

  // ---------- Exercises ----------
  function finish(el, html, onEnd) {
    el.innerHTML = '<div class="card accent"><div class="eyebrow">Done</div>' + html + '</div>';
    if (onEnd) onEnd();
  }
  function progressHead(i, n, label) {
    return '<div class="eyebrow">' + (i + 1) + ' of ' + n + (label ? ' · ' + esc(label) : '') + '</div>' +
      '<div class="bar"><span style="width:' + Math.round(i / n * 100) + '%"></span></div>';
  }

  // English → French from memory, graded for spaced review.
  function runDeck(el, cards, onEnd) {
    var i = 0, tally = { good: 0, hard: 0, again: 0 };
    function show() {
      if (i >= cards.length) {
        return finish(el, '<p><strong>' + plural(cards.length, 'sentence') + '.</strong> ' + tally.good + ' got it · ' +
          tally.hard + ' nearly · ' + tally.again + ' again.</p>' +
          (tally.again ? '<p class="muted small">The ones you marked "Again" come back in Review today.</p>' : ''), onEnd);
      }
      var c = cards[i];
      el.innerHTML = '<div class="card drill">' + progressHead(i, cards.length, c.label) +
        (c.hint ? '<div class="pattern">' + esc(c.hint) + '</div>' : '') +
        '<p class="prompt">' + esc(c.en) + '</p>' +
        '<label for="ans">Say it out loud, then type it (or just tap Check)</label>' +
        '<textarea id="ans" lang="fr" autocapitalize="sentences" spellcheck="false" placeholder="En français…"></textarea>' +
        '<div class="row"><button type="button" class="primary" id="reveal">Check</button></div>' +
        '<div id="result"></div></div>';
      var ans = el.querySelector('#ans');
      on(el.querySelector('#reveal'), 'click', function () { reveal(c, ans.value); });
      on(ans, 'keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); reveal(c, ans.value); } });
    }
    function reveal(c, input) {
      var r = check(input, c.fr);
      var verdict = r === 'ok' ? '<div class="verdict ok">Spot on.</div>' :
        r === 'accents' ? '<div class="verdict near">Right words. Check the accents and apostrophes.</div>' :
        r === 'diff' ? '<div class="verdict near">Compare with the model. Small differences can still be right.</div>' : '';
      el.querySelector('#reveal').disabled = true;
      el.querySelector('#result').innerHTML = '<div class="answer">' + verdict +
        '<div class="ex" style="border:0;padding:0">' + '<div><div class="fr" lang="fr">' + esc(c.fr) + '</div>' +
        (c.note ? '<div class="note">' + esc(c.note) + '</div>' : '') + '</div></div>' +
        (input.trim() && r !== 'ok' ? '<div class="yours">You wrote: <span lang="fr">' + esc(input) + '</span></div>' : '') +
        '</div><div class="grades">' +
        '<button type="button" class="again" data-g="again">Again<small>today</small></button>' +
        '<button type="button" data-g="hard">Nearly<small>soon</small></button>' +
        '<button type="button" class="primary" data-g="good">Got it<small>later</small></button></div>';
      Array.prototype.forEach.call(el.querySelectorAll('[data-g]'), function (b) {
        on(b, 'click', function () {
          var g = b.getAttribute('data-g');
          tally[g]++; grade(c.key, g); i++; show(); setTabs(); window.scrollTo(0, 0);
        });
      });
    }
    show();
  }

  // Tap the words into order.
  function tokens(text) {
    var raw = clean(text).trim().split(/\s+/), out = [];
    raw.forEach(function (w) {
      if (/^[?!:;»]$/.test(w) && out.length) out[out.length - 1] += ' ' + w;
      else out.push(w);
    });
    return out;
  }
  function runBuild(el, items, onEnd) {
    var i = 0, right = 0;
    function show() {
      if (i >= items.length) return finish(el, '<p><strong>' + right + ' of ' + items.length + '</strong> right first time.</p>', onEnd);
      var p = items[i], target = tokens(p.fr), placed = [], bank = shuffle(target.map(function (w, k) { return { w: w, k: k }; }));
      if (bank.map(function (b) { return b.w; }).join(' ') === target.join(' ')) bank.reverse();
      var first = true;
      function draw(result) {
        el.innerHTML = '<div class="card">' + progressHead(i, items.length) +
          '<p class="prompt" style="font-size:1.15rem;font-weight:600">' + esc(p.en) + '</p>' +
          '<div class="chips answer-line" id="line">' + placed.map(function (b, n) {
            return '<button type="button" class="chip" data-out="' + n + '" lang="fr">' + esc(b.w) + '</button>';
          }).join('') + '</div>' +
          '<div class="chips" id="bank">' + bank.map(function (b, n) {
            return '<button type="button" class="chip" data-in="' + n + '" lang="fr">' + esc(b.w) + '</button>';
          }).join('') + '</div>' + (result || '') +
          '<div class="row"><button type="button" id="reset">Start again</button>' +
          (result ? '<button type="button" class="primary" id="next">Next</button>' : '') + '</div></div>';
        Array.prototype.forEach.call(el.querySelectorAll('[data-in]'), function (b) {
          on(b, 'click', function () { placed.push(bank.splice(+b.getAttribute('data-in'), 1)[0]); after(); });
        });
        Array.prototype.forEach.call(el.querySelectorAll('[data-out]'), function (b) {
          on(b, 'click', function () { bank.push(placed.splice(+b.getAttribute('data-out'), 1)[0]); draw(); });
        });
        on('#reset', 'click', function () { bank = shuffle(bank.concat(placed)); placed = []; draw(); });
        on('#next', 'click', function () { i++; show(); });
      }
      function after() {
        if (bank.length) return draw();
        var ok = placed.map(function (b) { return b.w; }).join(' ') === target.join(' ');
        if (ok && first) right++;
        first = false;
        draw(ok ? '<div class="answer"><div class="verdict ok">Parfait !</div></div>'
          : '<div class="answer"><div class="verdict near">Not quite. The model:</div><div class="fr" lang="fr">' + esc(p.fr) + '</div></div>');
      }
      draw();
    }
    show();
  }

  // Situational multiple choice.
  function runReplies(el, items, onEnd) {
    var i = 0, right = 0;
    function show() {
      if (i >= items.length) return finish(el, '<p><strong>' + right + ' of ' + items.length + '</strong> natural replies.</p>', onEnd);
      var r = items[i], opts = shuffle(r.options.map(function (o, k) { return { o: o, k: k }; }));
      el.innerHTML = '<div class="card">' + progressHead(i, items.length, r.unitTitle) +
        '<p class="muted small" style="margin-top:10px">Someone says:</p>' +
        '<div class="say-line">' + '<span lang="fr">' + esc(r.say) + '</span></div>' +
        '<p class="muted small">What\'s the best reply?</p>' +
        '<div class="options">' + opts.map(function (x) {
          return '<button type="button" data-k="' + x.k + '" lang="fr">' + esc(x.o) + '</button>';
        }).join('') + '</div><div id="why"></div></div>';
      Array.prototype.forEach.call(el.querySelectorAll('[data-k]'), function (b) {
        on(b, 'click', function () {
          var k = +b.getAttribute('data-k');
          if (k === 0) right++;
          Array.prototype.forEach.call(el.querySelectorAll('[data-k]'), function (x) {
            x.disabled = true;
            if (+x.getAttribute('data-k') === 0) x.classList.add('right');
            else if (x === b) x.classList.add('wrong');
          });
          el.querySelector('#why').innerHTML = '<div class="answer"><div class="verdict ' + (k === 0 ? 'ok">Yes!' : 'bad">Not that one.') + '</div>' +
            (r.why ? '<div>' + esc(r.why) + '</div>' : '') + '</div><div class="row"><button type="button" class="primary" id="next">Next</button></div>';
          on('#next', 'click', function () { i++; show(); });
        });
      });
    }
    show();
  }

  function dialogueHTML(u) {
    return '<p class="muted">' + esc(u.dialogue.setting) + '</p>' +
      '<div class="toggles"><button type="button" id="mode" aria-pressed="false">Your turn: hide my lines</button>' +
      '<button type="button" id="english" aria-pressed="true">English</button></div>' +
      '<div class="chat" id="chat"></div>';
  }
  function runDialogue(u) {
    var lines = u.dialogue.lines, practice = false, english = true, hidden = {};
    function draw() {
      document.getElementById('chat').innerHTML = lines.map(function (l, n) {
        var me = l[0] === 'Vous', hide = practice && me && hidden[n] !== false;
        return '<div class="bubble' + (me ? ' me' : '') + '">' +
          '<div class="who">' + esc(me ? 'You' : l[0]) + '</div>' +
          (hide
            ? '<div class="hiddenline">' + esc(l[2]) + '</div><button type="button" class="speak" data-show="' + n + '" style="margin-top:6px">Show</button>'
            : '<div class="line-row">' + '<div><div class="fr" lang="fr">' + esc(l[1]) + '</div>' +
              (english ? '<div class="en">' + esc(l[2]) + '</div>' : '') + '</div></div>') +
          '</div>';
      }).join('');
      Array.prototype.forEach.call(document.querySelectorAll('[data-show]'), function (b) {
        on(b, 'click', function () { hidden[+b.getAttribute('data-show')] = false; draw(); });
      });
    }
    on('#mode', 'click', function () {
      practice = !practice; hidden = {}; this.setAttribute('aria-pressed', practice);
      if (practice) toast('Your lines are hidden. Say each one out loud, then tap Show.');
      draw();
    });
    on('#english', 'click', function () { english = !english; this.setAttribute('aria-pressed', english); draw(); });
    draw();
  }

  function patternHTML(s) {
    var html = '<div class="pattern">' + esc(s.pattern) + '</div><p><strong>' + esc(s.meaning) + '</strong></p>';
    if (s.notes && s.notes.length) {
      html += '<h3>How it works</h3><ul class="notes">' + s.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';
    }
    if (s.examples && s.examples.length) {
      html += '<h3>Examples</h3><div>' +
        s.examples.map(function (e) {
          return '<div class="ex">' + '<div><div class="fr" lang="fr">' + esc(e[0]) + '</div><div class="en">' + esc(e[1]) + '</div></div></div>';
        }).join('') + '</div>';
    }
    return html;
  }
  function ownHTML(s) {
    return '<label for="own-' + esc(s.id) + '">Write 3 sentences of your own with ' + esc(s.title) +
      ' <span class="muted small">(about your work, family, church, Madagascar)</span></label>' +
      '<textarea id="own-' + esc(s.id) + '" data-own="' + esc(s.id) + '" lang="fr" placeholder="Une phrase par ligne…">' +
      esc(state.own[s.id] || '') + '</textarea>' +
      '<p class="muted small">Saved as you type. They go into your role-play prompts so ChatGPT or Gemini can correct them.</p>';
  }
  app.addEventListener('input', function (e) {
    var id = e.target.getAttribute('data-own');
    if (id) { state.own[id] = e.target.value; save(); }
  });

  function phrasesHTML(u) {
    return u.sections.map(function (sec) {
      var list = u.flat.filter(function (p) { return p.section === sec.title; });
      return '<h3>' + esc(sec.title) + '</h3><div class="card" style="padding:6px 16px">' + list.map(phraseRow).join('') + '</div>';
    }).join('');
  }
  function phraseRow(p) {
    return '<div class="ex">' + '<div><div class="fr" lang="' + (p.lang || 'fr') + '">' + esc(p.fr) + '</div>' +
      '<div class="en">' + esc(p.en) + '</div>' + (p.note ? '<div class="note">' + esc(p.note) + '</div>' : '') + '</div></div>';
  }

  function talkPrompt(u) {
    var sample = [];
    u.sections.forEach(function (sec) {
      u.flat.filter(function (p) { return p.section === sec.title && p.lang !== 'mg'; }).slice(0, 3)
        .forEach(function (p) { sample.push('- ' + p.fr); });
    });
    var pats = u.patterns.map(patById).filter(Boolean);
    var own = pats.map(function (s) { return (state.own[s.id] || '').trim(); }).filter(Boolean).join('\n');
    var lines = [
      "I'm learning French (about B1 level). I'm preparing to go to Madagascar to work as a researcher and teacher, so I need everyday conversational French. Let's do a role-play in French.",
      '',
      'Situation: ' + u.title + '.',
      u.roleplay,
      '',
      'Phrases I am practising for this situation (please create chances for me to use them):'
    ].concat(sample);
    if (pats.length) {
      lines.push('', 'Grammar patterns I am practising:');
      pats.forEach(function (s) { lines.push('- ' + s.pattern + ' = ' + s.meaning); });
    }
    if (own) lines.push('', 'Before we start, please correct these sentences I wrote, with a short English explanation for each mistake:', own);
    lines.push('',
      'Rules:',
      '- You play the other people in the scene; I play myself.',
      '- Keep each of your turns short (1 to 3 sentences) so I do most of the talking.',
      '- Speak natural, everyday French, as people in Madagascar would.',
      '- After each of my replies, briefly correct any mistakes (the corrected French plus a few words of English), then carry on in character.',
      '- Halfway through, add a small complication or surprise.',
      '- After about 15 exchanges, stop and give me: what I did well, my 3 most frequent mistakes, and 8 useful phrases for this situation that I did not use.',
      '',
      'Commence la scène.');
    return lines.join('\n');
  }

  function copy(text) {
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
      ta.select(); try { document.execCommand('copy'); toast('Copied'); } catch (e) { toast('Select the text and copy it'); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast('Copied'); }, fallback);
    else fallback();
  }

  // ---------- Views ----------
  function viewToday() {
    var u = currentUnit(), due = dueCards().length;
    var all = 0, done = 0;
    UNITS.forEach(function (x) { var p = unitProgress(x); all += p.total; done += p.done; });
    var html = '<h1>Bonjour !</h1><p class="muted">Aim for 20 to 30 minutes a day: two or three steps, plus your review.</p>' +
      '<div class="bar"><span style="width:' + Math.round(done / all * 100) + '%"></span></div>' +
      '<p class="muted small">' + done + ' of ' + all + ' steps done across ' + UNITS.length + ' situations</p>';
    if (u) {
      var steps = stepsOf(u).filter(function (x) { return !isDone(u, x); }).slice(0, 3), pr = unitProgress(u);
      html += '<div class="card accent"><div class="eyebrow">Your situation · ' + pr.done + ' of ' + pr.total + ' steps</div>' +
        '<h2 style="margin:6px 0">' + u.emoji + ' ' + esc(u.title) + '</h2><p class="muted" style="margin:0">' + esc(u.fr) + '</p>' +
        '<ul class="steps">' + steps.map(function (st, n) {
          return '<li><a href="#u/' + u.id + '/' + encodeURIComponent(st.key) + '"' + (n === 0 ? ' class="next"' : '') + '>' +
            '<span class="tick' + (n === 0 ? ' now' : '') + '"></span><span class="t">' + esc(st.title) + '<small>' + esc(st.blurb) + '</small></span>' +
            (n === 0 ? '<span class="tag">Next</span>' : '') + '</a></li>';
        }).join('') + '</ul><p class="small" style="margin-bottom:0"><a href="#units">Pick a different situation</a></p></div>';
    } else {
      html += '<div class="card accent"><div class="eyebrow">Every situation done</div><p>Félicitations ! Keep reviewing, use the quick practice below, and add new phrases under <a href="#mine">Mine</a>.</p></div>';
    }
    html += '<div class="card"><div class="eyebrow">Review</div>' +
      (due ? '<p><strong>' + plural(due, 'sentence') + '</strong> due. Do these every day: it\'s what makes phrases stick.</p><div class="row"><a class="btn primary" href="#review">Review now</a></div>'
        : '<p class="muted">Nothing due. Sentences you practise come back here just before you\'d forget them.</p>') + '</div>';
    html += '<div class="card"><div class="eyebrow">Quick practice · 5 minutes</div><p class="muted small">Mixed from the situations you\'ve started.</p>' +
      '<div class="row"><a class="btn" href="#quick/replies">💬 What would you say?</a><a class="btn" href="#quick/build">🧩 Word order</a></div></div>';
    html += '<div class="card"><div class="eyebrow">In the wild</div><p>When you meet one of your phrases in your novel, the Bible, a sermon, a song or a podcast, note it under <a href="#mine">Mine</a>.</p></div>';
    app.innerHTML = html;
  }

  function viewUnits() {
    var html = '<h1>Situations</h1><p class="muted">Work through them in order, or jump to whatever you need next. Each has key phrases, patterns, word order, a conversation, quick replies, translation and a role-play.</p><div class="units">';
    html += UNITS.map(function (u) {
      var p = unitProgress(u), complete = p.done === p.total;
      return '<a href="#u/' + u.id + '"' + (complete ? ' class="complete"' : '') + '><span class="emo">' + u.emoji + '</span><span class="t"><b>' + esc(u.title) + '</b>' +
        '<span>' + esc(u.fr) + ' · ' + (complete ? 'done ✓' : p.done + '/' + p.total) + '</span>' +
        '<div class="bar"><span style="width:' + Math.round(p.done / p.total * 100) + '%"></span></div></span></a>';
    }).join('');
    app.innerHTML = html + '</div>';
  }

  function viewUnit(u) {
    var steps = stepsOf(u), nx = nextStep(u), pr = unitProgress(u);
    app.innerHTML = '<p class="small"><a href="#units">← All situations</a></p>' +
      '<h1>' + u.emoji + ' ' + esc(u.title) + '</h1><p class="muted" style="margin-top:0">' + esc(u.fr) + '</p>' +
      '<p>' + esc(u.intro) + '</p>' +
      '<div class="bar"><span style="width:' + Math.round(pr.done / pr.total * 100) + '%"></span></div>' +
      '<ul class="steps">' + steps.map(function (st) {
        var d = isDone(u, st), n = nx && nx.key === st.key;
        return '<li><a href="#u/' + u.id + '/' + encodeURIComponent(st.key) + '"' + (n ? ' class="next"' : '') + '>' +
          '<span class="tick' + (d ? ' done' : n ? ' now' : '') + '">' + (d ? '✓' : '') + '</span>' +
          '<span class="t">' + esc(st.title) + '<small>' + esc(st.blurb) + '</small></span>' + (n ? '<span class="tag">Next</span>' : '') + '</a></li>';
      }).join('') + '</ul>';
  }

  function viewStep(u, key) {
    var steps = stepsOf(u), st = steps.filter(function (x) { return x.key === key; })[0];
    if (!st) { location.hash = '#u/' + u.id; return; }
    var pos = steps.indexOf(st);
    var html = '<p class="small"><a href="#u/' + u.id + '">← ' + u.emoji + ' ' + esc(u.title) + '</a></p>' +
      '<p class="eyebrow">Step ' + (pos + 1) + ' of ' + steps.length + '</p><h1>' + esc(st.title) + '</h1>';
    var doneBtn = '<div class="row"><button type="button" class="primary" id="done">' + (isDone(u, st) ? 'Done ✓ · next step' : 'Mark done · next step') + '</button></div>';
    var flatFr = u.flat.filter(function (p) { return p.lang !== 'mg'; });

    if (st.kind === 'phrases') {
      html += '<p class="muted">Say every phrase out loud. Then cover the French and try to say it from the English.</p>' +
        phrasesHTML(u) + doneBtn;
      app.innerHTML = html;
    } else if (st.kind === 'pattern') {
      var s = patById(st.id);
      html += '<div class="card">' + patternHTML(s) + '</div><h2>Drill</h2><div id="deck"></div>' +
        '<div id="after" hidden><div class="card">' + ownHTML(s) + '</div>' + doneBtn + '</div>';
      app.innerHTML = html;
      runDeck(document.getElementById('deck'), patCards(s), reveal);
      skipLink();
    } else if (st.kind === 'build') {
      var buildable = flatFr.filter(function (p) { var n = tokens(p.fr).length; return n >= 4 && n <= 14 && p.fr.indexOf('…') < 0 && p.fr.indexOf(' / ') < 0; });
      html += '<p class="muted">Tap the words in the right order. Tap a word in your answer to send it back.</p><div id="deck"></div><div id="after" hidden>' + doneBtn + '</div>';
      app.innerHTML = html;
      runBuild(document.getElementById('deck'), shuffle(buildable).slice(0, 8), reveal);
      skipLink();
    } else if (st.kind === 'dialogue') {
      html += dialogueHTML(u) + '<p class="muted small">Read it with English on, then with English off. Then switch on "Your turn": say each of your lines out loud before you tap Show.</p>' + doneBtn;
      app.innerHTML = html;
      runDialogue(u);
    } else if (st.kind === 'replies') {
      html += '<div id="deck"></div><div id="after" hidden>' + doneBtn + '</div>';
      app.innerHTML = html;
      runReplies(document.getElementById('deck'), shuffle(u.replies.map(function (r) { return Object.assign({ unitTitle: '' }, r); })), reveal);
      skipLink();
    } else if (st.kind === 'translate') {
      html += '<p class="muted">From memory. These join your daily Review, so they come back until they stick.</p><div id="deck"></div><div id="after" hidden>' + doneBtn + '</div>';
      app.innerHTML = html;
      runDeck(document.getElementById('deck'), shuffle(u.flat).slice(0, 12), reveal);
      skipLink();
    } else {
      var text = talkPrompt(u);
      html += '<ol class="notes"><li>Copy the prompt.</li><li>Paste it into ChatGPT or Gemini. Voice mode is best: you practise speaking and listening.</li>' +
        '<li>Play the scene for 10 to 15 minutes. Use the phrases from this situation.</li><li>Save any good new sentences under <a href="#mine">Mine</a>.</li></ol>' +
        '<div class="card"><div class="row" style="margin-top:0"><button type="button" class="primary" id="copy">Copy prompt</button></div>' +
        '<pre class="prompt-text">' + esc(text) + '</pre></div>' + doneBtn;
      app.innerHTML = html;
      on('#copy', 'click', function () { copy(text); });
    }
    function reveal() { var a = document.getElementById('after'); if (a) a.hidden = false; var s2 = document.getElementById('skip'); if (s2) s2.parentNode.remove(); }
    on('#done', 'click', function () {
      state.done[doneKey(u, st)] = true; state.current = u.id; save();
      var nx = nextStep(u);
      toast(nx ? 'Bien joué !' : 'Situation complete. Bravo !');
      location.hash = nx ? '#u/' + u.id + '/' + encodeURIComponent(nx.key) : '#u/' + u.id;
    });
  }
  // Lets you finish a step without doing every item.
  function skipLink() {
    var deck = document.getElementById('deck');
    var p = document.createElement('p');
    p.className = 'small muted';
    p.innerHTML = '<a href="#" id="skip">Skip to the end of this step</a>';
    deck.insertAdjacentElement('afterend', p);
    on('#skip', 'click', function (e) {
      e.preventDefault(); document.getElementById('after').hidden = false; p.remove();
      document.getElementById('after').scrollIntoView({ behavior: 'smooth' });
    });
  }

  function quickPool() {
    var s = UNITS.filter(started);
    return s.length ? s : [currentUnit() || UNITS[0]];
  }
  function viewQuick(kind) {
    var pool = quickPool(), html = '<p class="small"><a href="#today">← Today</a></p>';
    if (kind !== 'build') {
      html += '<h1>What would you say?</h1><div id="deck"></div>';
      app.innerHTML = html;
      var rs = [];
      pool.forEach(function (u) { u.replies.forEach(function (r) { rs.push(Object.assign({ unitTitle: u.title }, r)); }); });
      runReplies(document.getElementById('deck'), shuffle(rs).slice(0, 8), againBtn);
    } else {
      var ph = [];
      pool.forEach(function (u) { ph = ph.concat(u.flat.filter(function (p) { return p.lang !== 'mg'; })); });
      ph = ph.filter(function (p) { var n = tokens(p.fr).length; return n >= 4 && n <= 14 && p.fr.indexOf('…') < 0 && p.fr.indexOf(' / ') < 0; });
      html += '<h1>Word order</h1><div id="deck"></div>';
      app.innerHTML = html;
      runBuild(document.getElementById('deck'), shuffle(ph).slice(0, 8), againBtn);
    }
    function againBtn() {
      document.getElementById('deck').insertAdjacentHTML('beforeend', '<div class="row"><button type="button" id="again">Another round</button><a class="btn primary" href="#today">Done</a></div>');
      on('#again', 'click', function () { viewQuick(kind); window.scrollTo(0, 0); });
    }
  }

  function viewBook() {
    var html = '<h1>Phrasebook</h1><p class="muted">Every phrase, by situation. Handy on the spot, too.</p>' +
      '<input type="search" id="q" placeholder="Search in French or English…" autocomplete="off">' +
      '<div id="results"></div>';
    app.innerHTML = html;
    var q = document.getElementById('q');
    function draw() {
      var t = norm(q.value || '');
      var out = '';
      if (!t) {
        out += '<details class="group"><summary>🧩 Grammar patterns (' + patterns().length + ')</summary><div class="list">' +
          patterns().map(function (s) {
            return '<a href="#p/' + encodeURIComponent(s.id) + '"><div class="t">' + esc(s.title) + '</div><div class="m">' + esc(s.meaning) + '</div></a>';
          }).join('') + '</div></details>';
      }
      UNITS.forEach(function (u) {
        var hits = u.flat.filter(function (p) { return !t || norm(p.fr).indexOf(t) >= 0 || norm(p.en).indexOf(t) >= 0; });
        if (!hits.length) return;
        out += '<details class="group"' + (t ? ' open' : '') + '><summary>' + u.emoji + ' ' + esc(u.title) + ' (' + hits.length + ')</summary><div>' +
          hits.map(phraseRow).join('') + '</div></details>';
      });
      document.getElementById('results').innerHTML = out || '<p class="empty">No phrases match.</p>';
    }
    on(q, 'input', draw);
    draw();
  }

  function viewPattern(id) {
    var s = patById(id);
    if (!s) { location.hash = '#book'; return; }
    app.innerHTML = '<p class="small"><a href="#book">← Phrasebook</a></p><h1>' + esc(s.title) + '</h1>' +
      '<div class="card">' + patternHTML(s) + '</div><div class="card">' + ownHTML(s) + '</div>' +
      '<div class="row"><button type="button" id="drill">Drill these sentences</button></div><div id="deck"></div>';
    on('#drill', 'click', function () { this.parentNode.remove(); runDeck(document.getElementById('deck'), patCards(s)); });
  }

  function viewReview() {
    var due = dueCards(), html = '<h1>Review</h1>';
    if (due.length) {
      html += '<p class="muted">' + due.length + ' due. "Got it" sends a sentence further away (1, 2, 4, 8, 16, then 32 days). "Again" brings it back today.</p><div id="deck"></div>';
      app.innerHTML = html;
      runDeck(document.getElementById('deck'), shuffle(due).slice(0, 20), function () {
        var more = dueCards().length, deck = document.getElementById('deck');
        deck.insertAdjacentHTML('beforeend', more
          ? '<div class="row"><button type="button" class="primary" id="more">Keep going (' + more + ' left)</button></div>'
          : '<div class="row"><a class="btn primary" href="#today">Back to Today</a></div>');
        on('#more', 'click', function () { viewReview(); window.scrollTo(0, 0); });
      });
    } else {
      var known = knownCards();
      html += '<div class="empty"><p><strong>All caught up.</strong></p><p>Sentences come back here just before you\'d forget them.</p></div>';
      if (known.length) html += '<div class="row"><button type="button" id="extra">Practise 10 random sentences anyway</button></div><div id="deck"></div>';
      else html += '<p class="muted" style="text-align:center">Do a "Say it in French" step or a pattern drill first. Start from <a href="#today">Today</a>.</p>';
      app.innerHTML = html;
      on('#extra', 'click', function () { this.parentNode.remove(); runDeck(document.getElementById('deck'), shuffle(known).slice(0, 10)); });
    }
  }

  function viewMine() {
    var html = '<h1>Mine</h1>' +
      '<div class="card"><div class="eyebrow">Add a phrase you picked up</div>' +
      '<p class="muted small">From a Facebook lesson, a sermon, a song, a conversation… It gets its own page and drill, and joins your Review.</p>' +
      '<label for="m-title">The phrase or structure</label><input type="text" id="m-title" lang="fr" placeholder="e.g. Je suis sur le point de…">' +
      '<label for="m-pattern">The pattern <span class="muted small">(optional)</span></label><input type="text" id="m-pattern" lang="fr" placeholder="e.g. être sur le point de + infinitif">' +
      '<label for="m-meaning">What it means</label><input type="text" id="m-meaning" placeholder="e.g. to be about to">' +
      '<label for="m-notes">Notes <span class="muted small">(optional, one per line)</span></label><textarea id="m-notes" placeholder="Anything the video pointed out"></textarea>' +
      '<label for="m-ex">Examples: one per line, French = English</label>' +
      '<textarea id="m-ex" lang="fr" placeholder="Je suis sur le point de partir. = I\'m about to leave.\nOn était sur le point de manger. = We were about to eat."></textarea>' +
      '<div class="row"><button type="button" class="primary" id="m-add">Add phrase</button></div></div>';
    if (state.mine.length) {
      html += '<h2>Your phrases</h2><div class="list">' + state.mine.map(function (s) {
        return '<div style="display:flex;gap:8px;align-items:center"><a style="flex:1" href="#p/' + esc(s.id) + '"><div class="t">' + esc(s.title) +
          '</div><div class="m">' + esc(s.meaning) + ' · ' + plural(s.practice.length, 'example') + '</div></a>' +
          '<button type="button" data-del="' + esc(s.id) + '" aria-label="Delete ' + esc(s.title) + '">✕</button></div>';
      }).join('') + '</div>';
    }
    html += '<div class="card"><div class="eyebrow">Spotted in the wild</div>' +
      '<p class="muted small">A sentence you read or heard that uses something you\'re learning.</p>' +
      '<label for="sp-text">The sentence</label><textarea id="sp-text" lang="fr"></textarea>' +
      '<label for="sp-where">Where</label><select id="sp-where"><option>Novel</option><option>Bible</option><option>Sermon</option>' +
      '<option>Podcast</option><option>Song</option><option>Facebook lesson</option><option>Conversation</option><option>Other</option></select>' +
      '<div class="row"><button type="button" id="sp-add">Save it</button></div>';
    if (state.spotted.length) {
      html += '<div style="margin-top:12px">' + state.spotted.slice().reverse().map(function (x) {
        return '<div class="ex">' + '<div><div class="fr" lang="fr">' + esc(x.text) + '</div><div class="en">' +
          esc(x.where) + ' · ' + new Date(x.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + '</div></div></div>';
      }).join('') + '</div>';
    }
    html += '</div><div class="card"><div class="eyebrow">Keep them safe</div>' +
      '<p class="muted small">Your progress lives in this browser only. Copy your phrases and sentences, and paste them to Claude to have them added to the site permanently.</p>' +
      '<div class="row"><button type="button" id="export">Copy my phrases and sentences</button></div></div>';
    app.innerHTML = html;

    on('#m-add', 'click', addMine);
    on('#sp-add', 'click', function () {
      var t = document.getElementById('sp-text').value.trim();
      if (!t) { toast('Write the sentence first'); return; }
      state.spotted.push({ text: t, where: document.getElementById('sp-where').value, date: Date.now() });
      save(); toast('Saved'); viewMine();
    });
    Array.prototype.forEach.call(app.querySelectorAll('[data-del]'), function (b) {
      on(b, 'click', function () {
        var id = b.getAttribute('data-del');
        if (!confirm('Delete this phrase and its review cards?')) return;
        state.mine = state.mine.filter(function (s) { return s.id !== id; });
        Object.keys(state.cards).forEach(function (k) { if (k.indexOf(id + ':') === 0) delete state.cards[k]; });
        save(); buildCards(); setTabs(); viewMine();
      });
    });
    on('#export', 'click', function () { copy(JSON.stringify({ mine: state.mine, own: state.own, spotted: state.spotted }, null, 2)); });
  }

  function addMine() {
    var v = function (id) { return document.getElementById(id).value.trim(); };
    var title = v('m-title'), meaning = v('m-meaning');
    var ex = v('m-ex').split('\n').map(function (l) {
      var p = l.split('=');
      return p.length >= 2 ? [p[0].trim(), p.slice(1).join('=').trim()] : null;
    }).filter(function (p) { return p && p[0] && p[1]; });
    if (!title || !meaning) { toast('Add the phrase and what it means'); return; }
    if (!ex.length) { toast('Add at least one example: French = English'); return; }
    var s = {
      id: 'mine-' + Date.now().toString(36), mine: true, title: title, pattern: v('m-pattern') || title, meaning: meaning,
      notes: v('m-notes').split('\n').map(function (n) { return n.trim(); }).filter(Boolean),
      examples: ex, practice: ex.map(function (e) { return [e[1], e[0]]; })
    };
    state.mine.push(s); buildCards(); unlock(patCards(s)); save(); setTabs();
    toast('Added: it\'s in your Review now');
    location.hash = '#p/' + s.id;
  }

  // ---------- Routing ----------
  function setTabs() {
    var tab = location.hash.slice(1).split('/')[0] || 'today';
    if (tab === 'u') tab = 'units';
    if (tab === 'p') tab = 'book';
    if (tab === 'quick') tab = 'today';
    var due = dueCards().length;
    Array.prototype.forEach.call(document.querySelectorAll('#tabs a'), function (a) {
      var t = a.getAttribute('data-tab');
      if (t === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      if (t === 'review') a.innerHTML = 'Review' + (due ? '<span class="count">' + due + '</span>' : '');
    });
  }
  function route() {
    var parts = location.hash.slice(1).split('/').map(decodeURIComponent);
    var r = parts[0] || 'today';
    if (r === 'u') {
      var u = unitById(parts[1]);
      if (!u) location.hash = '#units';
      else if (parts.length > 2) viewStep(u, parts.slice(2).join('/'));
      else viewUnit(u);
    }
    else if (r === 'p') viewPattern(parts.slice(1).join('/'));
    else if (r === 'units') viewUnits();
    else if (r === 'book') viewBook();
    else if (r === 'review') viewReview();
    else if (r === 'mine') viewMine();
    else if (r === 'quick') viewQuick(parts[1]);
    else viewToday();
    setTabs();
    window.scrollTo(0, 0);
  }

  Promise.all([
    fetch(BASE + 'units.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }),
    fetch(BASE + 'structures.json', { cache: 'no-cache' }).then(function (r) { return r.json(); })
  ]).then(function (res) {
    UNITS = res[0].units;
    res[1].structures.forEach(function (s) { PAT[s.id] = s; });
    UNITS.forEach(function (u) {
      u.flat = [];
      u.sections.forEach(function (sec) {
        sec.phrases.forEach(function (p) {
          u.flat.push({ key: 'ph:' + u.id + ':' + p[0], fr: p[0], en: p[1], note: p[2] || '', lang: sec.lang || 'fr',
            section: sec.title, label: u.title, hint: sec.title });
        });
      });
    });
    buildCards();
    window.addEventListener('hashchange', route);
    route();
  }).catch(function () {
    app.innerHTML = '<p>Couldn\'t load the phrases. Check your connection and reload.</p>';
  });
})();
