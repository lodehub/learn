/* Mainland Mandarin: for a fluent Malaysian Chinese speaker learning how mainland China talks.
   Three layers from mainland.json: habits (Malaysian → mainland), conversation moves (reusable chunks),
   and themes (swaps, vocab and a model conversation). Progress per child under "<slug>:<subject>:<tool>:state".
   <script src="../../../assets/lab/mainland.js"></script> */
(function () {
  'use strict';

  var BASE = document.currentScript.src.replace(/[^/]*$/, '');
  var app = document.getElementById('app');
  var SLUG = Learner.slug;
  var KEY = Learner.key('state');
  var D, S = load(), session = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function today() { var d = new Date(); return Math.floor((d - d.getTimezoneOffset() * 60000) / 864e5); }
  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* private mode */ }
    s = s || {};
    s.sr = s.sr || {};
    s.seen = s.seen || {};
    s.settings = s.settings || { py: true };
    return s;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(url); return r.json(); });
  }

  /* ---------- items: everything practisable gets an id ---------- */
  var GAPS = [0, 1, 2, 4, 7, 14, 30];
  function mark(id, ok) {
    var r = S.sr[id] || { b: 0, d: 0 };
    r.b = ok ? Math.min(r.b + 1, GAPS.length - 1) : 0;
    r.d = today() + (ok ? GAPS[r.b] : 0);
    S.sr[id] = r;
    save();
  }
  function items() {
    var out = [];
    D.habits.forEach(function (h, i) { out.push({ id: 'h:' + i, kind: 'habit', group: 'habits', x: h }); });
    D.moves.forEach(function (m) {
      m.chunks.forEach(function (c, i) { out.push({ id: 'c:' + m.id + ':' + i, kind: 'chunk', group: 'm:' + m.id, x: c }); });
    });
    D.themes.forEach(function (t) {
      t.swaps.forEach(function (s, i) { out.push({ id: 's:' + t.id + ':' + i, kind: 'swap', group: 't:' + t.id, x: s }); });
      t.vocab.forEach(function (v, i) { out.push({ id: 'v:' + t.id + ':' + i, kind: 'vocab', group: 't:' + t.id, x: v }); });
    });
    return out;
  }
  function known(list) { return list.filter(function (it) { return (S.sr[it.id] || {}).b >= 2; }).length; }
  function visit(group) { if (!S.seen[group]) { S.seen[group] = 1; save(); } }

  /* ---------- display ---------- */
  function zh(text, py, big) {
    return '<span class="zhline' + (big ? ' big' : '') + '" lang="zh-Hans"><span class="h">' + esc(text) + '</span>' +
      (py ? '<span class="p">' + esc(py) + '</span>' : '') + '</span>';
  }
  function bar(title, back) {
    return '<div class="bar"><a class="back" href="' + back + '" aria-label="Back">&#8592;</a><h1>' + esc(title) + '</h1>' +
      '<button type="button" class="chip" id="py" aria-pressed="' + !!S.settings.py + '">Pinyin</button></div>';
  }
  function bindBar() {
    var b = document.getElementById('py');
    if (b) b.onclick = function () { S.settings.py = !S.settings.py; save(); applyPy(); b.setAttribute('aria-pressed', S.settings.py); };
  }
  function applyPy() { document.body.classList.toggle('nopy', !S.settings.py); }
  function meter(list) {
    var k = known(list);
    return '<span class="muted small">' + k + ' / ' + list.length + ' known</span>';
  }
  function byGroup(g) { return items().filter(function (it) { return it.group === g; }); }

  function home() {
    var all = items(), t = today();
    var due = all.filter(function (it) { var r = S.sr[it.id]; return r && r.d <= t; }).length;
    var html = bar(D.title, Learner.back);
    html += '<p class="lead">' + esc(D.about) + '</p>';
    html += '<div class="cards">';
    html += '<a class="card go" href="#/review"><span class="big-emoji">🔁</span><span><b>Review</b><br><span class="muted">' +
      (due ? due + ' ready to practise again' : Object.keys(S.sr).length ? 'Nothing due. Extra practice?' : 'Mixed practice from what you\'ve opened') + '</span></span></a>';
    html += '<a class="card go" href="#/how"><span class="big-emoji">🧱</span><span><b>How it fits together</b><br><span class="muted">Habits × moves × themes</span></span></a>';
    html += '</div>';
    html += '<h2 class="lvl">1 · Habits to swap <span>Malaysian → mainland</span></h2>';
    html += '<ul class="stages"><li><a class="stage" href="#/habits"><span class="big-emoji">🔄</span><span class="name">' + D.habits.length +
      ' habits that give you away<br>' + meter(byGroup('habits')) + '</span></a></li></ul>';
    html += '<h2 class="lvl">2 · Conversation moves <span>the skeleton of any chat</span></h2><ul class="stages">' + D.moves.map(function (m) {
      return '<li><a class="stage" href="#/move/' + m.id + '"><span class="big-emoji">' + m.emoji + '</span><span class="name">' + esc(m.title) +
        ' <span class="muted small">' + esc(m.en) + '</span><br>' + meter(byGroup('m:' + m.id)) + '</span></a></li>';
    }).join('') + '</ul>';
    html += '<h2 class="lvl">3 · Themes <span>the words for each situation</span></h2><ul class="stages">' + D.themes.map(function (th) {
      return '<li><a class="stage" href="#/theme/' + th.id + '"><span class="big-emoji">' + th.emoji + '</span><span class="name">' + esc(th.title) +
        '<br>' + meter(byGroup('t:' + th.id)) + '</span></a></li>';
    }).join('') + '</ul>';
    app.innerHTML = html;
    bindBar();
  }

  function howPage() {
    var html = bar('How it fits together', '#/');
    html += '<div class="card prose">' +
      '<p><b>Habits</b> are the Malaysian patterns that make you sound like an outsider even when your Chinese is good: 有 + verb for the past, 先 at the end, English and Malay words mid-sentence, lah. Fix these first; they appear in every conversation.</p>' +
      '<p><b>Moves</b> are the structure. Every conversation, about anything, is the same moves in a different order: open, say who you are, ask, react, give a view, agree or disagree, ask for things, tell a story, close. Each move has a handful of mainland chunks. Once they come out automatically, you can stay in any conversation.</p>' +
      '<p><b>Themes</b> are the context: the words that change from one situation to the next, the Malaysian words to swap, and a model conversation that uses the moves.</p>' +
      '<p><b>Building on it.</b> Each new theme reuses the same moves with new words, so it gets quicker. Good themes to add next: health and doctors, school and kids, travel and hotels, news and opinions, WeChat messaging.</p>' +
      '<p><b>Practice.</b> Say every answer out loud before you reveal it. Review brings back what is due: tomorrow, then in 2, 4, 7, 14 and 30 days.</p></div>';
    app.innerHTML = html;
    bindBar();
  }

  function habitsPage() {
    visit('habits');
    var html = bar('Habits to swap', '#/');
    html += '<p class="lead">Each one is fine in Malaysia and marks you out in China. Cover the right-hand side and fix them yourself first.</p>';
    html += '<div class="actions"><a class="btn" href="#/start/habits">Fix them (practice) 🔄</a></div>';
    html += '<ul class="vocab swaps">' + D.habits.map(function (h) {
      return '<li><span class="my" lang="zh-Hans">' + esc(h.my) + '</span><span class="arrow">→</span>' + zh(h.cn, h.py) +
        '<span class="note">' + esc(h.en) + ' · ' + esc(h.note) + '</span></li>';
    }).join('') + '</ul>';
    app.innerHTML = html;
    bindBar();
  }

  function movePage(id) {
    var m = D.moves.filter(function (x) { return x.id === id; })[0];
    if (!m) return home();
    visit('m:' + id);
    var html = bar(m.emoji + ' ' + m.title, '#/') + '<p class="lead">' + esc(m.en) + '. Learn these until they come out without thinking.</p>';
    html += '<div class="actions"><a class="btn ghost" href="#/start/movepick/' + id + '">Pick ✅</a><a class="btn" href="#/start/movesay/' + id + '">Say it 🗣️</a></div>';
    html += '<ul class="vocab">' + m.chunks.map(function (c) {
      return '<li>' + zh(c.zh, c.py) + '<span class="en">' + esc(c.en) + '</span>' + (c.note ? '<span class="note">' + esc(c.note) + '</span>' : '') + '</li>';
    }).join('') + '</ul>';
    app.innerHTML = html;
    bindBar();
  }

  function themePage(id, tab) {
    var th = D.themes.filter(function (x) { return x.id === id; })[0];
    if (!th) return home();
    visit('t:' + id);
    tab = tab || 'swaps';
    var html = bar(th.emoji + ' ' + th.title, '#/') + '<p class="lead">' + esc(th.intro) + '</p>';
    html += '<div class="toggle" role="group">' + [['swaps', 'Swaps'], ['words', 'Words'], ['talk', 'Conversation']].map(function (t) {
      return '<a class="tab" href="#/theme/' + id + '/' + t[0] + '" aria-pressed="' + (tab === t[0]) + '">' + t[1] + '</a>';
    }).join('') + '</div>';
    if (tab === 'swaps') {
      html += '<div class="actions"><a class="btn" href="#/start/swap/' + id + '">Swap quiz 🔄</a></div>';
      html += '<ul class="vocab swaps">' + th.swaps.map(function (s) {
        return '<li><span class="my" lang="zh-Hans">' + esc(s.my) + '</span><span class="arrow">→</span>' + zh(s.cn, s.py) +
          '<span class="note">' + esc(s.en) + (s.note ? ' · ' + esc(s.note) : '') + '</span></li>';
      }).join('') + '</ul>';
    } else if (tab === 'words') {
      html += '<div class="actions"><a class="btn" href="#/start/vocab/' + id + '">Words quiz ✅</a></div>';
      html += '<ul class="vocab">' + th.vocab.map(function (v) {
        return '<li>' + zh(v.zh, v.py) + '<span class="en">' + esc(v.en) + '</span>' + (v.note ? '<span class="note">' + esc(v.note) + '</span>' : '') + '</li>';
      }).join('') + '</ul>';
    } else {
      html += '<p class="muted small">Read it through, then take the 你 part: the English shows, you say the Chinese, then tap to check.</p>';
      html += '<div class="actions"><button type="button" class="btn" id="yt">Your turn 🗣️</button></div>';
      html += '<div class="dlg" id="dlg">' + th.dialogue.map(function (l, i) {
        return '<div class="line' + (l.who === '你' ? ' me' : '') + '" data-i="' + i + '"><span class="who" lang="zh-Hans">' + esc(l.who) + '</span>' +
          '<span class="say"><span class="h" lang="zh-Hans">' + esc(l.zh) + '</span><span class="en">' + esc(l.en) + '</span></span></div>';
      }).join('') + '</div>';
    }
    app.innerHTML = html;
    bindBar();
    var yt = document.getElementById('yt');
    if (yt) yt.onclick = function () {
      var dlg = document.getElementById('dlg');
      dlg.classList.toggle('turn');
      Array.prototype.forEach.call(dlg.querySelectorAll('.line.me'), function (l) { l.classList.remove('shown'); });
      yt.textContent = dlg.classList.contains('turn') ? 'Show everything' : 'Your turn 🗣️';
    };
    Array.prototype.forEach.call(app.querySelectorAll('.line.me'), function (l) {
      l.onclick = function () { l.classList.add('shown'); };
    });
  }

  /* ---------- practice ---------- */
  function sayQ(it) {
    var x = it.x;
    if (it.kind === 'habit') return { type: 'say', it: it, ask: 'Say it the mainland way:', prompt: '<span lang="zh-Hans">' + esc(x.my) + '</span>', sub: x.en, answer: zh(x.cn, x.py, true), note: x.note };
    if (it.kind === 'swap') return { type: 'say', it: it, ask: 'What do they say in the mainland?', prompt: '<span lang="zh-Hans">' + esc(x.my) + '</span>', sub: x.en, answer: zh(x.cn, x.py, true), note: x.note };
    return { type: 'say', it: it, ask: 'Say this in mainland Mandarin:', prompt: esc(x.en), answer: zh(x.zh, x.py, true), note: x.note };
  }
  function pickQ(it, pool) {
    var x = it.x, right, prompt, ask, opts;
    var others = shuffle(pool.filter(function (o) { return o.id !== it.id; }));
    if (it.kind === 'swap') {
      ask = 'Mainland word for:';
      prompt = '<span lang="zh-Hans">' + esc(x.my) + '</span> <span class="muted">(' + esc(x.en) + ')</span>';
      right = zh(x.cn, x.py);
      opts = others.filter(function (o) { return o.kind === 'swap'; }).map(function (o) { return zh(o.x.cn, o.x.py); });
    } else {
      ask = 'Which one means:';
      prompt = esc(x.en);
      right = zh(x.zh || x.cn, x.py);
      opts = others.map(function (o) { return zh(o.x.zh || o.x.cn, o.x.py); });
    }
    var uniq = [];
    opts.forEach(function (o) { if (o !== right && uniq.indexOf(o) < 0 && uniq.length < 3) uniq.push(o); });
    return { type: 'pick', it: it, ask: ask, prompt: prompt, right: right, opts: shuffle([right].concat(uniq)), note: x.note };
  }
  function start(kind, id) {
    var qs = [], list, back = '#/', title = 'Review';
    if (kind === 'habits') {
      list = byGroup('habits'); back = '#/habits'; title = 'Habits';
      qs = shuffle(list).slice(0, 10).map(sayQ);
    } else if (kind === 'movesay' || kind === 'movepick') {
      list = byGroup('m:' + id); back = '#/move/' + id;
      title = D.moves.filter(function (m) { return m.id === id; })[0].title;
      var chunks = items().filter(function (it) { return it.kind === 'chunk'; });
      qs = shuffle(list).map(function (it) { return kind === 'movesay' ? sayQ(it) : pickQ(it, chunks); });
    } else if (kind === 'swap' || kind === 'vocab') {
      back = '#/theme/' + id + '/' + (kind === 'swap' ? 'swaps' : 'words');
      title = D.themes.filter(function (t) { return t.id === id; })[0].title;
      list = byGroup('t:' + id).filter(function (it) { return it.kind === kind; });
      var pool = items().filter(function (it) { return it.kind === kind; });
      qs = shuffle(list).map(function (it, i) { return i % 3 === 2 ? sayQ(it) : pickQ(it, list.length >= 4 ? list : pool); });
    } else {
      // Review: what's most due, from everything opened so far.
      var t = today();
      list = items().filter(function (it) { return S.seen[it.group] || S.sr[it.id]; });
      if (!list.length) list = items();
      list = shuffle(list).sort(function (a, b) {
        var ra = S.sr[a.id] || { b: 0, d: t }, rb = S.sr[b.id] || { b: 0, d: t };
        return (ra.d - rb.d) || (ra.b - rb.b);
      }).slice(0, 12);
      var all = items();
      qs = shuffle(list).map(function (it, i) {
        if (it.kind === 'habit' || i % 2) return sayQ(it);
        return pickQ(it, all.filter(function (o) { return o.kind === it.kind; }));
      });
    }
    session = { qs: qs, i: 0, score: 0, back: back, title: title };
    if (location.hash === '#/play') play(); else location.replace('#/play');
  }

  function play() {
    if (!session) { location.hash = '#/'; return; }
    var s = session;
    if (s.i >= s.qs.length) return finish();
    var q = s.qs[s.i];
    var html = bar(s.title, s.back) + '<div class="progress"><span style="width:' + Math.round(100 * s.i / s.qs.length) + '%"></span></div>';
    html += '<p class="ask">' + esc(q.ask) + '</p><p class="prompt">' + q.prompt + '</p>' + (q.sub ? '<p class="muted">' + esc(q.sub) + '</p>' : '');
    if (q.type === 'say') {
      if (!q.shown) html += '<div class="actions"><button type="button" class="btn" id="show">I\'ve said it: show me</button></div>';
      else html += '<div class="fb plain"><div>' + q.answer + '</div>' + (q.note ? '<p class="muted small">' + esc(q.note) + '</p>' : '') + '</div>' +
        '<div class="actions"><button type="button" class="btn ghost" id="nope">Not yet</button><button type="button" class="btn" id="yes">Got it ✓</button></div>';
    } else {
      html += '<div class="opts">' + q.opts.map(function (o, i) {
        var cls = q.done ? (o === q.right ? ' right' : (i === q.chosen ? ' wrong' : '')) : '';
        return '<button type="button" class="opt' + cls + '" data-o="' + i + '"' + (q.done ? ' disabled' : '') + '>' + o + '</button>';
      }).join('') + '</div>';
      if (q.done) html += (q.note ? '<p class="muted small">' + esc(q.note) + '</p>' : '') + '<div class="actions"><button type="button" class="btn" id="next">Next →</button></div>';
    }
    app.innerHTML = html;
    bindBar();
    function next() { s.i++; play(); window.scrollTo(0, 0); }
    function done(ok) { if (ok) s.score++; mark(q.it.id, ok); next(); }
    var el;
    if ((el = document.getElementById('show'))) el.onclick = function () { q.shown = true; play(); };
    if ((el = document.getElementById('yes'))) el.onclick = function () { done(true); };
    if ((el = document.getElementById('nope'))) el.onclick = function () { done(false); };
    if ((el = document.getElementById('next'))) el.onclick = next;
    Array.prototype.forEach.call(app.querySelectorAll('[data-o]'), function (b) {
      b.onclick = function () {
        if (q.done) return;
        q.done = true;
        q.chosen = +b.getAttribute('data-o');
        var ok = q.opts[q.chosen] === q.right;
        if (ok) s.score++;
        mark(q.it.id, ok);
        play();
      };
    });
  }
  function finish() {
    var s = session, n = s.qs.length;
    var html = bar(s.title, s.back) + '<div class="card done"><p class="score">' + s.score + ' / ' + n + '</p><p>' +
      (s.score === n ? 'Perfect.' : s.score >= n * 0.75 ? 'Good work.' : 'These will come back in Review until they stick.') + '</p></div>' +
      '<div class="actions"><a class="btn ghost" href="' + s.back + '">Done</a></div>';
    app.innerHTML = html;
    bindBar();
  }

  function route() {
    var h = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    switch (h[0]) {
      case 'habits': habitsPage(); break;
      case 'move': movePage(h[1]); break;
      case 'theme': themePage(h[1], h[2]); break;
      case 'how': howPage(); break;
      case 'review': start('review'); return;
      case 'start': start(h[1], h[2]); return;
      case 'play': play(); break;
      default: home();
    }
    window.scrollTo(0, 0);
  }

  getJSON(BASE + 'mainland.json').then(function (d) {
    D = d;
    document.title = D.title;
    applyPy();
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
})();
