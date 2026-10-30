/* Verb Dials: Language Lab level 4.
   Every sentence has dials: person, tense, negative, question. The engine builds any setting of the dials
   from a verb table (regular rules + listed irregular forms), then drills turning them.
   Used by /<slug>/<subject>/<tool>/index.html with:
   <script src="../../../assets/lab/dials.js" data-data="french-dials"></script> */
(function () {
  'use strict';

  var script = document.currentScript;
  var BASE = script.src.replace(/[^/]*$/, '');
  var DATA = script.getAttribute('data-data');
  var app = document.getElementById('app');
  var SLUG = Learner.slug;
  var KEY = Learner.key('state');

  var D, S = load(), session = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* private mode */ }
    s = s || {};
    s.stages = s.stages || {};
    return s;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(url); return r.json(); });
  }

  /* ---------- conjugation ---------- */
  var FUT = ['ai', 'as', 'a', 'ons', 'ez', 'ont'];
  var IMP = ['ais', 'ais', 'ait', 'ions', 'iez', 'aient'];
  function verb(inf) { return D.verbs.filter(function (v) { return v.inf === inf; })[0]; }
  function present(v) {
    if (v.pres) return v.pres;
    var st = v.inf.slice(0, -2);
    if (v.g === 'ir') return ['is', 'is', 'it', 'issons', 'issez', 'issent'].map(function (e) { return st + e; });
    return ['e', 'es', 'e', 'ons', 'ez', 'ent'].map(function (e) { return st + e; });
  }
  function participle(v) { return v.pp || v.inf.slice(0, -2) + (v.g === 'ir' ? 'i' : 'é'); }
  function futStem(v) { return v.fs || (/re$/.test(v.inf) ? v.inf.slice(0, -1) : v.inf); }
  function imparfait(v) {
    if (v.imp) return v.imp;
    var st = v.is || present(v)[3].replace(/ons$/, '');
    return IMP.map(function (e) { return st + e; });
  }
  function usesEtre(v) { return v.aux === 'être'; }
  // The verb group for one setting: head (the word ne … pas wraps) + tail.
  function verbGroup(v, person, tense, opts) {
    var p = opts && opts.formP != null ? opts.formP : person.p;
    var etre = opts && opts.swapAux ? !usesEtre(v) : usesEtre(v);
    switch (tense) {
      case 'pc':
        return { head: present(verb(etre ? 'être' : 'avoir'))[p], tail: participle(v) + (etre ? person.agr : '') };
      case 'fp': return { head: present(verb('aller'))[p], tail: v.inf };
      case 'fut': return { head: futStem(v) + FUT[p], tail: '' };
      case 'imp': return { head: imparfait(v)[p], tail: '' };
      case 'cond': return { head: futStem(v) + IMP[p], tail: '' };
      default: return { head: present(v)[p], tail: '' };
    }
  }
  var VOWEL = /^[aeiouyéèêëàâîïôûh]/i;
  function joinFr(words) {
    var out = '';
    words.filter(Boolean).forEach(function (w, i, a) {
      out += w;
      if (i === a.length - 1) return;
      var next = a[i + 1];
      if (/^(je|ne|que)$/.test(w) && VOWEL.test(next)) out = out.slice(0, -1) + "'";
      else out += ' ';
    });
    return out;
  }
  // st = { v, person, tense, neg, q }
  function sentence(st, opts) {
    var g = verbGroup(st.v, st.person, st.tense, opts);
    var words = [st.person.fr, st.neg ? 'ne' : '', g.head, st.neg ? 'pas' : '', g.tail, st.neg && st.v.cn ? st.v.cn : st.v.c];
    if (st.q) words.unshift('est-ce', 'que');
    return cap(joinFr(words)) + (st.q ? ' ?' : '.');
  }

  /* ---------- checking typed answers ---------- */
  function norm(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[’‘`]/g, "'").replace(/[.?!,;:«»"]/g, ' ').replace(/-/g, ' ')
      .replace(/\s*'\s*/g, "'").replace(/\s+/g, ' ').trim();
  }
  function matcher(expected) {
    var n = norm(expected).replace(/[.*+?^${}|[\]\\]/g, '\\$&');
    n = n.replace(/\\?\(e\\?\)/g, 'e?').replace(/\\?\(s\\?\)/g, 's?').replace(/[()]/g, '');
    return new RegExp('^' + n + '$');
  }
  function accepts(st, typed) {
    var t = norm(typed).replace(/[()]/g, '');
    if (matcher(sentence(st)).test(t)) return true;
    // A question can also be asked by intonation alone.
    if (st.q) return matcher(sentence(clone(st, { q: false }))).test(t);
    return false;
  }
  function clone(st, ch) {
    var o = {};
    Object.keys(st).forEach(function (k) { o[k] = st[k]; });
    Object.keys(ch || {}).forEach(function (k) { o[k] = ch[k]; });
    return o;
  }

  /* ---------- generating drills ---------- */
  function stageVerbs(sg) {
    return D.verbs.filter(function (v) {
      return sg.sets.indexOf(v.set) >= 0 && (!sg.verbAux || (v.aux || 'avoir') === sg.verbAux);
    });
  }
  function randomState(sg) {
    return { v: pick(stageVerbs(sg)), person: pick(D.persons), tense: pick(sg.tenses), neg: false, q: false };
  }
  function turn(st, dial, sg) {
    var o = clone(st);
    if (dial === 'person') o.person = pick(D.persons.filter(function (p) { return p.p !== st.person.p; }));
    if (dial === 'tense') o.tense = pick(sg.tenses.filter(function (t) { return t !== st.tense; }));
    if (dial === 'neg') { o.neg = !st.neg; o.q = false; }
    if (dial === 'q') { o.q = !st.q; o.neg = false; }
    return o;
  }
  function label(dial, st) {
    if (dial === 'person') return '→ ' + st.person.fr;
    if (dial === 'tense') return '→ ' + tenseName(st.tense);
    if (dial === 'neg') return st.neg ? '→ negative' : '→ positive';
    return st.q ? '→ question' : '→ statement';
  }
  function tenseName(id) { return D.tenses.filter(function (t) { return t.id === id; })[0].name; }

  function makeTransform(sg) {
    var dials = sg.dials.slice(), from = randomState(sg);
    var first = pick(dials), chosen = [first];
    if (sg.multi && Math.random() < 0.5) {
      var rest = dials.filter(function (d) { return d !== first && !(first === 'neg' && d === 'q') && !(first === 'q' && d === 'neg'); });
      if (rest.length) chosen.push(pick(rest));
    }
    // Start from a state the dial can move away from: a negative or question to undo, sometimes.
    if (chosen.indexOf('neg') >= 0 && Math.random() < 0.3) from.neg = true;
    if (chosen.indexOf('q') >= 0 && Math.random() < 0.3) from.q = true;
    var to = from;
    chosen.forEach(function (d) { to = turn(to, d, sg); });
    return { type: 'transform', from: from, to: to, labels: chosen.map(function (d) { return label(d, to); }) };
  }
  function makePick(sg) {
    var st = randomState(sg);
    if (sg.dials.indexOf('neg') >= 0 && Math.random() < 0.3) st.neg = true;
    var right = sentence(st), seen = {}, opts = [];
    seen[right] = 1;
    function add(s) { if (opts.length < 3 && !seen[s]) { seen[s] = 1; opts.push(s); } }
    if (st.tense === 'pc') add(sentence(st, { swapAux: true }));
    shuffle([0, 1, 2, 3, 4, 5]).forEach(function (p) { if (p !== st.person.p && Math.random() < 0.6) add(sentence(st, { formP: p })); });
    shuffle(D.tenses).forEach(function (t) { if (t.id !== st.tense) add(sentence(clone(st, { tense: t.id }))); });
    shuffle([0, 1, 2, 3, 4, 5]).forEach(function (p) { if (p !== st.person.p) add(sentence(st, { formP: p })); });
    return { type: 'pick', st: st, right: right, opts: shuffle([right].concat(opts)) };
  }

  /* ---------- screens ---------- */
  function bar(title, back) {
    return '<div class="bar"><a class="back" href="' + back + '" aria-label="Back">&#8592;</a><h1>' + esc(title) + '</h1></div>';
  }
  function stars(id) {
    var s = S.stages[id] || {};
    return (s.learn ? 1 : 0) + (s.tr >= 8 ? 1 : 0) + (s.pick >= 8 ? 1 : 0);
  }
  function starHTML(n) {
    return '<span class="stars" aria-label="' + n + ' of 3 stars">' +
      [0, 1, 2].map(function (i) { return '<span class="' + (i < n ? 'on' : '') + '">★</span>'; }).join('') + '</span>';
  }
  function stageById(id) { return D.stages.filter(function (s) { return s.id === id; })[0]; }

  function home() {
    var next = D.stages.filter(function (s) { return stars(s.id) < 3; })[0];
    var html = bar(D.title, Learner.back);
    html += '<p class="lead">' + esc(D.about) + '</p>';
    html += '<div class="dialrow"><span class="dial">who</span><span class="dial">when</span><span class="dial">yes / no</span><span class="dial">statement / question</span></div>';
    html += '<ul class="stages">' + D.stages.map(function (s, i) {
      return '<li><a class="stage' + (next === s ? ' next' : '') + '" href="#/stage/' + s.id + '"><span class="big-emoji">' + s.emoji + '</span>' +
        '<span class="name"><span class="muted small">Stage 4.' + (i + 1) + (next === s ? ' · up next' : '') + '</span><br>' + esc(s.title) + '</span>' + starHTML(stars(s.id)) + '</a></li>';
    }).join('') + '</ul>';
    app.innerHTML = html;
  }

  function stagePage(id) {
    var sg = stageById(id);
    if (!sg) return home();
    var st = S.stages[id] || {};
    var html = bar(sg.title, '#/') + '<p class="lead">' + esc(sg.intro) + '</p>';
    html += '<ul class="modes">' +
      mode('#/learn/' + id, '📖', 'Learn', 'Rules and the full tables', st.learn ? '★ done' : '') +
      mode('#/start/transform/' + id, '🎛️', 'Transform', 'Turn a dial, type the new sentence', st.tr != null ? 'best ' + st.tr + '/10' : '') +
      mode('#/start/pick/' + id, '✅', 'Pick the form', 'Spot the right one among near-misses', st.pick != null ? 'best ' + st.pick + '/10' : '') +
      mode('#/start/speed/' + id, '⚡', 'Speed round', '60 seconds of Pick the form', st.speed != null ? 'best ' + st.speed : '') + '</ul>';
    html += '<p class="muted small">A star each for Learn, Transform (8/10 or more) and Pick (8/10 or more).</p>';
    html += '<div class="tips"><h2>Rules</h2><ul>' + sg.tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
    app.innerHTML = html;
  }
  function mode(href, emoji, title, sub, badge) {
    return '<li><a class="mode" href="' + href + '"><span class="big-emoji">' + emoji + '</span><span class="name"><b>' + title + '</b><br><span class="muted small">' + sub +
      '</span></span>' + (badge ? '<span class="badge">' + badge + '</span>' : '') + '</a></li>';
  }

  var TABLE_PERSONS = ['je', 'tu', 'il', 'nous', 'vous', 'ils'];
  function learnPage(id, inf) {
    var sg = stageById(id);
    if (!sg) return home();
    S.stages[id] = S.stages[id] || {};
    if (!S.stages[id].learn) { S.stages[id].learn = 1; save(); }
    var vs = stageVerbs(sg), v = (inf && verb(inf)) || vs[0];
    var html = bar('Learn: ' + sg.title, '#/stage/' + id) + '<p class="lead">' + esc(sg.intro) + '</p>';
    html += '<div class="tips"><ul>' + sg.tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
    html += '<h2>The tables</h2><div class="verbchips">' + vs.map(function (x) {
      return '<a class="chip' + (x === v ? ' on' : '') + '" href="#/learn/' + id + '/' + encodeURIComponent(x.inf) + '">' + esc(x.inf) + '</a>';
    }).join('') + '</div>';
    html += '<div class="card"><p><b lang="fr">' + esc(v.inf + ' ' + v.c) + '</b> <span class="muted">= ' + esc(v.en) + (usesEtre(v) ? ' · past with être' : '') + '</span></p>';
    html += '<div class="tablewrap"><table class="conj"><thead><tr>' + sg.tenses.map(function (t) {
      return '<th>' + esc(tenseName(t)) + '<br><span class="muted small">' + esc(D.tenses.filter(function (x) { return x.id === t; })[0].en) + '</span></th>';
    }).join('') + '</tr></thead><tbody>' + TABLE_PERSONS.map(function (pid) {
      var person = D.persons.filter(function (p) { return p.id === pid; })[0];
      return '<tr>' + sg.tenses.map(function (t) {
        var g = verbGroup(v, person, t);
        return '<td lang="fr">' + esc(joinFr([pid, g.head, g.tail])) + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody></table></div></div>';
    html += '<div class="actions"><a class="btn" href="#/start/transform/' + id + '">Now turn some dials 🎛️</a></div>';
    app.innerHTML = html;
  }

  /* ---------- play ---------- */
  function start(kind, id) {
    var sg = stageById(id);
    if (!sg) return home();
    session = { kind: kind, sg: sg, i: 0, score: 0, n: kind === 'speed' ? Infinity : 10, q: null };
    if (kind === 'speed') session.ends = Date.now() + 60000;
    nextQ();
    if (location.hash === '#/play') play(); else location.replace('#/play');
  }
  function nextQ() {
    session.q = session.kind === 'transform' ? makeTransform(session.sg) : makePick(session.sg);
  }
  function play() {
    if (!session) { location.hash = '#/'; return; }
    var s = session;
    if (s.i >= s.n || (s.ends && Date.now() >= s.ends && !s.q.done)) return finish();
    var q = s.q;
    var html = bar(s.sg.title, '#/stage/' + s.sg.id);
    if (s.ends) html += '<div class="progress timer"><span id="timer" style="width:' + Math.max(0, (s.ends - Date.now()) / 600) + '%"></span></div><p class="muted small">Score: ' + s.score + '</p>';
    else html += '<div class="progress"><span style="width:' + (10 * s.i) + '%"></span></div>';
    html += q.type === 'transform' ? transformHTML(q) : pickHTML(q);
    app.innerHTML = html;
    if (q.type === 'transform') bindTransform(q); else bindPick(q);
    if (s.ends) tick();
  }
  var timer;
  function tick() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var el = document.getElementById('timer');
      if (!session || !session.ends || !el) return;
      var left = session.ends - Date.now();
      el.style.width = Math.max(0, left / 600) + '%';
      if (left <= 0) finish(); else tick();
    }, 250);
  }

  function transformHTML(q) {
    var v = q.from.v;
    var html = '<p class="ask">Turn the dial' + (q.labels.length > 1 ? 's' : '') + ':</p>';
    html += '<p class="prompt" lang="fr">' + esc(sentence(q.from)) + '</p>';
    html += '<p class="muted small">' + esc(v.inf + ' ' + v.c + ' = ' + v.en) + ' · now: ' + esc(tenseName(q.from.tense)) + '</p>';
    html += '<div class="dialrow">' + q.labels.map(function (l) { return '<span class="dial on">' + esc(l) + '</span>'; }).join('') + '</div>';
    if (!q.done) {
      html += '<input id="ans" class="type" lang="fr" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Type the new sentence">';
      html += '<p class="muted small">Accents optional. allé(e): type either form.</p>';
      html += '<div class="actions"><button type="button" class="btn ghost" id="show">Just show me</button><button type="button" class="btn" id="check">Check</button></div>';
    } else {
      var right = sentence(q.to);
      if (q.typed != null) html += '<p class="muted small">You wrote: <span lang="fr">' + esc(q.typed) + '</span></p>';
      html += '<div class="fb ' + (q.ok ? 'ok' : q.typed == null ? 'plain' : 'no') + '"><b>' + (q.ok ? 'Yes ✓' : q.typed == null ? 'Answer:' : 'Not quite. It\'s:') + '</b><div class="tl big" lang="fr">' + esc(right) + '</div></div>';
      if (q.typed == null) html += '<p class="ask">Did you have it?</p><div class="actions"><button type="button" class="btn ghost" id="nope">Not yet</button><button type="button" class="btn" id="yes">Got it ✓</button></div>';
      else html += '<div class="actions"><button type="button" class="btn" id="next">Next →</button></div>';
    }
    return html;
  }
  function bindTransform(q) {
    var inp = document.getElementById('ans');
    function check() {
      if (!inp.value.trim()) return;
      q.typed = inp.value; q.ok = accepts(q.to, q.typed); q.done = true;
      if (q.ok) session.score++;
      play();
    }
    if (inp) {
      inp.focus();
      inp.onkeydown = function (e) { if (e.key === 'Enter') check(); };
      document.getElementById('check').onclick = check;
      document.getElementById('show').onclick = function () { q.done = true; q.typed = null; play(); };
    }
    var y = document.getElementById('yes'), n = document.getElementById('nope'), nx = document.getElementById('next');
    if (y) y.onclick = function () { session.score++; advance(); };
    if (n) n.onclick = advance;
    if (nx) { nx.onclick = advance; nx.focus(); }
  }

  function pickHTML(q) {
    var st = q.st;
    var html = '<p class="ask">Which is right?</p>';
    html += '<p class="prompt"><span lang="fr">' + esc(st.person.fr) + ' · ' + esc(st.v.inf + ' ' + st.v.c) + '</span></p>';
    html += '<div class="dialrow"><span class="dial on">' + esc(tenseName(st.tense)) + '</span>' + (st.neg ? '<span class="dial on">negative</span>' : '') + '</div>';
    html += '<div class="opts">' + q.opts.map(function (o, i) {
      var cls = q.done ? (o === q.right ? ' right' : (i === q.chosen ? ' wrong' : '')) : '';
      return '<button type="button" class="opt' + cls + '" data-o="' + i + '" lang="fr"' + (q.done ? ' disabled' : '') + '>' + esc(o) + '</button>';
    }).join('') + '</div>';
    if (q.done) html += '<div class="actions"><button type="button" class="btn" id="next">Next →</button></div>';
    return html;
  }
  function bindPick(q) {
    Array.prototype.forEach.call(app.querySelectorAll('[data-o]'), function (b) {
      b.onclick = function () {
        if (q.done) return;
        q.chosen = +b.getAttribute('data-o');
        q.done = true;
        var ok = q.opts[q.chosen] === q.right;
        if (ok) session.score++;
        // Speed rounds don't wait: a right answer moves straight on.
        if (session.ends && ok) return advance();
        play();
      };
    });
    var nx = document.getElementById('next');
    if (nx) nx.onclick = advance;
  }
  function advance() { session.i++; nextQ(); play(); window.scrollTo(0, 0); }

  function finish() {
    clearTimeout(timer);
    var s = session;
    if (!s || s.finished) return;
    s.finished = true;
    var st = S.stages[s.sg.id] = S.stages[s.sg.id] || {};
    var key = { transform: 'tr', pick: 'pick', speed: 'speed' }[s.kind];
    var before = stars(s.sg.id), prevBest = st[key];
    st[key] = Math.max(st[key] || 0, s.score);
    save();
    var msg = stars(s.sg.id) > before ? '<p class="star-win">⭐ New star!</p>' :
      s.kind === 'speed' && s.score > (prevBest || 0) ? '<p class="star-win">New best!</p>' :
      s.kind !== 'speed' && s.score < 8 ? '<p class="muted">8 or more for a star. Every round is new sentences.</p>' : '';
    var html = bar(s.sg.title, '#/stage/' + s.sg.id);
    html += '<div class="card done"><p class="score">' + s.score + (s.kind === 'speed' ? '' : ' / 10') + '</p><p>' +
      (s.kind === 'speed' ? 'right in 60 seconds' : s.score >= 9 ? 'Excellent.' : s.score >= 7 ? 'Good work.' : 'Keep turning those dials.') + '</p>' + msg + '</div>';
    html += '<div class="actions"><a class="btn ghost" href="#/stage/' + s.sg.id + '">Done</a><button type="button" class="btn" id="again">Go again</button></div>';
    app.innerHTML = html;
    document.getElementById('again').onclick = function () { start(s.kind, s.sg.id); };
  }

  function route() {
    clearTimeout(timer);
    var h = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    switch (h[0]) {
      case 'stage': stagePage(h[1]); break;
      case 'learn': learnPage(h[1], h[2]); break;
      case 'start': start(h[1], h[2]); return;
      case 'play': play(); break;
      default: home();
    }
    window.scrollTo(0, 0);
  }

  getJSON(BASE + DATA + '.json').then(function (d) {
    D = d;
    document.title = D.title;
    window.addEventListener('hashchange', route);
    route();
    getJSON('../../../children.json').then(function (c) {
      var me = c.children.filter(function (x) { return x.slug === SLUG; })[0];
      if (me) document.body.classList.add('c-' + me.colour);
    }).catch(function () {});
  }).catch(function (e) {
    app.innerHTML = '<p class="empty">Could not load. Check your connection and try again.</p>';
    console.error(e);
  });

  // For testing in the console.
  window.Dials = { sentence: function (st) { return sentence(st); }, accepts: function (st, t) { return accepts(st, t); }, data: function () { return D; } };
})();
