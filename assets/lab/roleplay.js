/* Language Lab: Role-play. Practise speaking with a script.
   Each line is shown as a prompt ("Ask for a croissant"); the learner says it out loud, then reveals the words.
   The other part is read aloud by a partner (or by the learner on their own).
   Used by /<slug>/<subject>/role-play/index.html with:
     <script src="../../../assets/lab/learner.js"></script>
     <script src="../../../assets/lab/roleplay.js" data-lang="french"></script>
   Content: assets/lab/<lang>-roleplay.json (see README.md). */
(function () {
  'use strict';
  var me = document.currentScript;
  var LANG = me.getAttribute('data-lang') || 'french';
  var BASE = me.src.replace(/[^/]*$/, '');
  // Optional data-content picks another scenes file, e.g. a set for one learner (default <lang>-roleplay.json).
  var FILE = me.getAttribute('data-content') || LANG + '-roleplay';
  var app = document.getElementById('app');
  var KEY = Learner.key('state');
  var D, S, run;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* private mode */ }
    return s && s.scenes ? s : { scenes: {} };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  function sceneById(id) { return D.scenes.filter(function (s) { return s.id === id; })[0]; }
  function other(r) { return r === 'A' ? 'B' : 'A'; }
  function rec(id) { return S.scenes[id] || {}; }
  // Stars: played as A, played as B, a whole run with every line right first time.
  function stars(id) { var r = rec(id); return (r.A ? 1 : 0) + (r.B ? 1 : 0) + (r.clean ? 1 : 0); }
  function starHTML(n) {
    return '<span class="stars" aria-label="' + n + ' of 3 stars">' +
      [0, 1, 2].map(function (i) { return '<span class="' + (i < n ? 'on' : '') + '">★</span>'; }).join('') + '</span>';
  }
  function bar(title, back, extra) {
    return '<div class="bar"><a class="back" href="' + back + '" aria-label="Back">&#8592;</a><h1>' + esc(title) + '</h1>' + (extra || '') + '</div>';
  }
  // Target-language text. "汉字|pinyin" (as in the Lab) shows the characters with pinyin underneath.
  function tl(s, more, big) {
    var p = String(s).split('|'), lang = D.code === 'zh' ? 'zh-Hans' : D.code;
    if (p.length < 2) return '<span class="h" lang="' + esc(lang) + '">' + esc(p[0] + (more || '')) + '</span>';
    return '<span class="zhline' + (big ? ' big' : '') + '"><span class="h" lang="' + esc(lang) + '">' + esc(p[0] + (more || '')) + '</span>' +
      '<span class="p">' + esc(p[1] + (more || '')) + '</span></span>';
  }
  function say(l) { return l.say || l.fr; }

  /* ---------- pages ---------- */
  function home() {
    var html = bar(D.title, Learner.back);
    html += '<p class="lead">' + esc(D.about) + '</p>';
    html += '<div class="tips small"><ul>' + D.how.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul></div>';
    D.levels.forEach(function (lv) {
      var list = D.scenes.filter(function (s) { return s.level === lv.id; });
      if (!list.length) return;
      html += '<h2 class="lvl">' + esc(lv.title) + '<span>' + esc(lv.note) + '</span></h2><ul class="stages">';
      list.forEach(function (s) {
        html += '<li><a class="stage" href="#/scene/' + s.id + '"><span class="big-emoji">' + s.emoji + '</span>' +
          '<span class="name">' + esc(s.title) + '<br><span class="small muted">' + esc(s.roles.A) + ' and ' + esc(s.roles.B) + '</span></span>' +
          starHTML(stars(s.id)) + '</a></li>';
      });
      html += '</ul>';
    });
    html += '<div class="actions"><a class="btn ghost" href="#/print">Print all the scripts</a></div>';
    app.innerHTML = html;
  }

  function scenePage(id) {
    var s = sceneById(id);
    if (!s) return home();
    var r = rec(id);
    var html = bar(s.title, '#/');
    html += '<p class="lead">' + s.emoji + ' ' + esc(s.setting) + '</p>';
    html += '<h2>Who are you?</h2><ul class="modes">';
    ['A', 'B'].forEach(function (role) {
      html += '<li><a class="mode" href="#/play/' + id + '/' + role + '"><span class="big-emoji">' + (role === 'A' ? '🙋' : '🧑‍💼') + '</span>' +
        '<span class="name">Play as: ' + esc(s.roles[role]) + '<br><span class="small muted">Partner plays: ' + esc(s.roles[other(role)]) + '</span></span>' +
        (r[role] ? '<span class="badge">done ✓</span>' : '') + '</a></li>';
    });
    html += '</ul>';
    html += '<div class="actions"><a class="btn ghost" href="#/script/' + id + '">Read the whole script</a></div>';
    if (s.tip) html += '<div class="tips"><p><b>Tip:</b> ' + esc(s.tip) + '</p></div>';
    app.innerHTML = html;
  }

  function scriptHTML(s) {
    return '<div class="dlg rp">' + s.lines.map(function (l) {
      return '<div class="line' + (l.who === 'A' ? ' me' : '') + '"><span class="who">' + esc(s.roles[l.who]) + '</span>' +
        '<span class="say">' + tl(say(l)) + '<span class="en">' + esc(l.en) + '</span></span></div>';
    }).join('') + '</div>';
  }
  function scriptPage(id) {
    var s = sceneById(id);
    if (!s) return home();
    var html = bar(s.title, '#/scene/' + id);
    html += '<p class="lead">Read it through together first, then close it and play it from the prompts.</p>';
    html += scriptHTML(s);
    html += '<div class="actions no-print"><button type="button" class="btn ghost" onclick="window.print()">Print</button>' +
      '<a class="btn" href="#/scene/' + id + '">Play it</a></div>';
    app.innerHTML = html;
  }
  function printPage() {
    var html = bar(D.title + ': scripts', '#/', '<button type="button" class="chip no-print" onclick="window.print()">Print</button>');
    html += '<p class="lead no-print">Every script on one page. Fold the paper so only the English shows, then try to say it in ' + esc(D.name) + '.</p>';
    D.scenes.forEach(function (s) {
      html += '<section class="rp-print"><h2>' + s.emoji + ' ' + esc(s.title) + '</h2><p class="muted small">' + esc(s.setting) + '</p>' +
        '<table class="rp-table"><tbody>' + s.lines.map(function (l) {
          return '<tr><th>' + esc(s.roles[l.who]) + '</th><td class="en">' + esc(l.cue) + '</td><td>' + tl(say(l)) + '</td></tr>';
        }).join('') + '</tbody></table></section>';
    });
    app.innerHTML = html;
  }

  /* ---------- playing a scene ---------- */
  function startPlay(id, role) {
    var s = sceneById(id);
    if (!s || (role !== 'A' && role !== 'B')) return home();
    run = { s: s, role: role, i: 0, shown: false, hint: false, misses: 0, mine: 0, log: [] };
    play();
  }
  function play() {
    var s = run.s, role = run.role;
    // Partner lines need no answer: show them and move on to the next line of mine.
    while (run.i < s.lines.length && s.lines[run.i].who !== role) {
      run.log.push({ l: s.lines[run.i], partner: true });
      run.i++;
    }
    var html = bar(s.title, '#/scene/' + s.id, '<span class="badge rp-role">' + esc(s.roles[role]) + '</span>');
    html += '<div class="dlg rp">' + run.log.map(function (x) {
      var l = x.l;
      return '<div class="line' + (x.partner ? '' : ' me') + '"><span class="who">' + esc(s.roles[l.who]) + '</span>' +
        '<span class="say">' + (l.surprise && x.partner ? '<span class="rp-surprise">❗ Unexpected question</span>' : '') +
        tl(say(l)) + '<span class="en">' + esc(l.en) + '</span>' + (x.ok === false ? '<span class="rp-again">↻ practise this one</span>' : '') + '</span></div>';
    }).join('') + '</div>';

    if (run.i >= s.lines.length) return finish(html);

    var l = s.lines[run.i];
    html += '<div class="card rp-turn" id="turn"><p class="ask">Your turn. Say it out loud:</p>' +
      '<p class="prompt">' + esc(l.cue) + '</p>';
    if (run.hint && l.hint) html += '<p class="rp-hint">Starts with: ' + tl(l.hint, '…') + '</p>';
    if (!run.shown) {
      html += '<div class="actions">' + (l.hint && !run.hint ? '<button type="button" class="btn ghost" id="hint">Hint</button>' : '') +
        '<button type="button" class="btn" id="show">I\'ve said it: show me</button></div>';
    } else {
      html += '<div class="fb plain"><div class="tl big">' + tl(say(l), '', true) + '</div><div class="muted">' + esc(l.en) + '</div>' +
        (l.alt && l.alt.length ? '<div class="small">Also fine: ' + l.alt.map(function (a) { return tl(a); }).join(' · ') + '</div>' : '') +
        '</div><p class="ask">Did you say something like that?</p><div class="actions">' +
        '<button type="button" class="btn ghost" id="nope">Not yet</button><button type="button" class="btn" id="yes">Got it ✓</button></div>';
    }
    html += '</div>';
    app.innerHTML = html;

    var h = document.getElementById('hint');
    if (h) h.onclick = function () { run.hint = true; play(); };
    var sh = document.getElementById('show');
    if (sh) sh.onclick = function () { run.shown = true; play(); };
    function answer(ok) {
      run.log.push({ l: l, ok: ok });
      run.mine++;
      if (!ok) run.misses++;
      run.i++; run.shown = false; run.hint = false;
      play();
    }
    var y = document.getElementById('yes'), n = document.getElementById('nope');
    if (y) y.onclick = function () { answer(true); };
    if (n) n.onclick = function () { answer(false); };
    var t = document.getElementById('turn');
    if (t && t.scrollIntoView) t.scrollIntoView({ block: 'end', behavior: run.log.length > 1 ? 'smooth' : 'auto' });
  }
  function finish(html) {
    var s = run.s, role = run.role, r = S.scenes[s.id] = S.scenes[s.id] || {};
    var before = stars(s.id);
    r[role] = true;
    if (!run.misses) r.clean = true;
    save();
    var got = run.mine - run.misses;
    html += '<div class="card done"><p class="score">' + got + ' / ' + run.mine + '</p><p>' +
      (!run.misses ? 'Every line first time. Brilliant!' : run.misses === 1 ? 'Nearly all of it. Go again for the one marked ↻.' : 'Good going. Run it again and the marked lines get easier.') + '</p>' +
      (stars(s.id) > before ? '<p class="star-win">⭐ New star!</p>' : '') + '</div>';
    html += '<div class="actions"><button type="button" class="btn ghost" id="again">Go again</button>' +
      '<a class="btn" href="#/play/' + s.id + '/' + other(role) + '">Swap roles ⇄</a></div>';
    html += '<div class="actions"><a class="btn ghost" href="#/">All scenes</a></div>';
    app.innerHTML = html;
    document.getElementById('again').onclick = function () { startPlay(s.id, role); };
    window.scrollTo(0, document.body.scrollHeight);
  }

  /* ---------- routing ---------- */
  function route() {
    var h = location.hash.replace(/^#\/?/, '').split('/');
    switch (h[0]) {
      case 'scene': scenePage(h[1]); break;
      case 'script': scriptPage(h[1]); break;
      case 'play': startPlay(h[1], h[2]); return;
      case 'print': printPage(); break;
      default: home();
    }
    window.scrollTo(0, 0);
  }

  fetch(BASE + FILE + '.json', { cache: 'no-cache' }).then(function (r) {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }).then(function (d) {
    D = d;
    S = load();
    document.title = D.title;
    window.addEventListener('hashchange', route);
    route();
    // Take on the child's colour from the hub.
    fetch('../../../children.json').then(function (r) { return r.json(); }).then(function (c) {
      var mine = c.children.filter(function (x) { return x.slug === Learner.slug; })[0];
      if (mine) document.body.classList.add('c-' + mine.colour);
    }).catch(function () {});
  }).catch(function (e) {
    app.innerHTML = '<p class="empty">Could not load the role-plays. Check your connection and try again.</p>';
    console.error(e);
  });
})();
