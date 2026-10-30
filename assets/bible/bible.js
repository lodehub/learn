/* Bible Lab engine. One page (bible/index.html), routed by the hash:
     #                     home: this week, today's verse practice, how it works
     #<season>             season overview, context, weeks, principles wall
     #<season>/<n>[/<s>]   week n, session s (1 Read, 2 Dig, 3 Principle, 4 Live it, 5 Check-in)
     #card/<season>/<n>    printable fridge card
     #wall/<season>        printable principles wall
     #memory               verse practice for whoever is picked
     #learn/<cardId>       five-step trainer for one verse
     #review               spaced review of every verse due today
   Family progress (sessions, commitments, notes) is shared on the device under "bible:family".
   Verse memory is per person under "<slug>:bible:lab:mem". */
(function () {
  'use strict';
  var app = document.getElementById('app');
  var SESSIONS = ['Read', 'Dig', 'Principle', 'Live it', 'Check-in'];
  var SESSION_BLURB = [
    'Where are we? Read the passage aloud and notice what it says.',
    'What did it mean to them? Questions with guide answers.',
    'The timeless truth, and where Jesus said it first.',
    'Where does this show up for us? Choose what we will do.',
    'Say the verse, see how it went, finish the week.'
  ];
  var DAYS = [0, 1, 2, 4, 7, 14, 30, 60]; // review gap in days for each box
  var data, kids, seasons = {};

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function get(url) { return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(url); return r.json(); }); }
  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  function today(off) {
    var d = new Date(); d.setDate(d.getDate() + (off || 0));
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function each(sel, fn) { Array.prototype.forEach.call(app.querySelectorAll(sel), fn); }
  function bar(back, title) {
    return '<div class="bar"><a class="back" href="' + back + '" aria-label="Back">&#8592;</a><h1>' + title + '</h1></div>';
  }
  function season(id) {
    if (seasons[id]) return Promise.resolve(seasons[id]);
    var s = data.seasons.filter(function (x) { return x.id === id; })[0];
    if (!s) return Promise.reject(new Error('No season ' + id));
    return get(s.path).then(function (j) { seasons[id] = j; return j; });
  }

  // ---------- family progress ----------
  function fam() { return load('bible:family', { active: null, seasons: {} }); }
  function famSeason(f, id) {
    f.seasons[id] = f.seasons[id] || { done: [], sessions: {}, commit: {}, notes: {} };
    return f.seasons[id];
  }
  function currentWeek(fs, total) {
    for (var n = 1; n <= total; n++) if (fs.done.indexOf(n) < 0) return n;
    return total + 1; // finished
  }

  // ---------- people and memory ----------
  function people() { return kids.concat(data.people || []); }
  function who() { return load('bible:who', null); }
  function person(slug) { return people().filter(function (p) { return p.slug === slug; })[0]; }
  function memKey(slug) { return slug + ':bible:lab:mem'; }
  function mem(slug) { return load(memKey(slug), { cards: {}, stretch: false, days: {} }); }
  function paint(slug) { var p = person(slug); document.body.className = p ? 'c-' + p.colour : ''; }

  // Every verse unlocked so far (anchors up to the current week, stretch verses if chosen), across seasons.
  function unlocked(m) {
    var f = fam(), out = [];
    data.seasons.forEach(function (s) {
      var j = seasons[s.id], fs = f.seasons[s.id];
      if (!j || !fs) return;
      var cur = currentWeek(fs, j.weeks.length);
      j.weeks.forEach(function (w) {
        if (w.n > cur) return;
        if (w.anchor) out.push({ id: s.id + '-' + w.n + '-a', v: w.anchor, w: w, s: s.id, now: w.n === cur });
        if (w.stretch && m.stretch) out.push({ id: s.id + '-' + w.n + '-s', v: w.stretch, w: w, s: s.id, now: w.n === cur, stretch: true });
      });
    });
    return out;
  }
  function cardById(m, id) { return unlocked(m).filter(function (c) { return c.id === id; })[0]; }
  function isDue(st) { return st && st.box > 0 && st.due <= today(); }
  function strength(st) {
    if (!st || !st.box) return 'New';
    if (st.box <= 2) return 'Learning';
    if (st.box <= 4) return 'Growing';
    return 'Known';
  }
  function grade(slug, id, how) {
    var m = mem(slug), st = m.cards[id] || { box: 0 };
    if (how === 'got') st.box = Math.min((st.box || 0) + 1, DAYS.length - 1);
    else if (how === 'nearly') st.box = Math.max(st.box || 1, 1);
    else st.box = 1;
    st.due = how === 'got' ? today(DAYS[st.box]) : today(1);
    m.cards[id] = st;
    m.days[today()] = 1;
    save(memKey(slug), m);
  }
  function practisedThisWeek(m) {
    var d = new Date(), dow = (d.getDay() + 6) % 7, out = [];
    for (var i = 0; i < 7; i++) out.push(!!m.days[today(i - dow)]);
    return out;
  }

  // ---------- verse text tools ----------
  function words(t) { return t.split(/\s+/).filter(Boolean); }
  function initial(w) {
    var m = /^([^A-Za-z0-9]*)([A-Za-z0-9])[A-Za-z0-9’'\-]*(.*)$/.exec(w);
    return m ? m[1] + m[2] + m[3] : w;
  }
  // Phrase-sized pieces: break at punctuation, then split anything still long.
  function chunks(t) {
    var out = [], cur = [];
    words(t).forEach(function (w) {
      cur.push(w);
      if (/[,;:.!?—”]$/.test(w) || cur.length >= 7) { out.push(cur.join(' ')); cur = []; }
    });
    if (cur.length) out.push(cur.join(' '));
    return out;
  }
  function seeded(n, seed) {
    var a = [], s = 0, i;
    for (i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
    for (i = 0; i < n; i++) a.push(i);
    for (i = n - 1; i > 0; i--) { s = (s * 1103515245 + 12345) >>> 0; var j = s % (i + 1), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function verseBox(v, label) {
    return '<div class="vbox"><div class="vlabel">' + esc(label || 'This week\'s verse') + '</div>' +
      '<p class="verse">' + esc(v.text) + '</p><p class="vref">' + esc(v.ref) + '</p></div>';
  }
  function passageHtml(rows, w) {
    var hi = {};
    [w.anchor, w.stretch].forEach(function (v) {
      if (!v) return;
      var m = /(\d+):(\d+)(?:-(\d+))?$/.exec(v.ref);
      for (var x = +m[2]; x <= +(m[3] || m[2]); x++) hi[m[1] + ':' + x] = 1;
    });
    var html = '<div class="passage"><p>', lastC = null;
    rows.forEach(function (r, i) {
      if (i && r[3]) html += '</p><p>';
      var num = r[0] !== lastC ? '<b class="ch">' + r[0] + '</b>' : '<sup>' + r[1] + '</sup>';
      lastC = r[0];
      html += '<span class="' + (hi[r[0] + ':' + r[1]] ? 'hi' : '') + '">' + num + esc(r[2]) + '</span> ';
    });
    return html + '</p></div>';
  }

  // ---------- views ----------
  function home() {
    document.body.className = '';
    var f = fam(), html = bar('../', 'Bible Lab');
    html += '<p class="lead">' + esc(data.about) + '</p>';
    var active = f.active && data.seasons.filter(function (s) { return s.id === f.active; })[0];
    if (active && seasons[active.id]) {
      var j = seasons[active.id], fs = famSeason(f, active.id), n = currentWeek(fs, j.weeks.length);
      if (n <= j.weeks.length) {
        var w = j.weeks[n - 1], did = fs.sessions[n] || [];
        html += '<a class="thisweek" href="#' + active.id + '/' + n + '"><span class="vlabel">This week · ' + esc(j.title) + ' · week ' + n + ' of ' + j.weeks.length + '</span>' +
          '<span class="tw-title">' + esc(w.title) + '</span><span class="muted">' + esc(w.big) + '</span>' +
          dots(did) + '<span class="btn">' + (did.length ? 'Carry on' : 'Start this week') + '</span></a>';
        if (fs.commit[n]) html += '<p class="commit"><b>This week we will:</b> ' + esc(fs.commit[n]) + '</p>';
      } else {
        html += '<div class="card"><b>You finished ' + esc(j.title) + '.</b> Keep reviewing the verses below, and pick what comes next.</div>';
      }
    } else {
      html += '<div class="card start"><h2>Start here</h2><p>Pick a book below. Each week has five short sessions (about 10 minutes, at the same time each day: after dinner works well) and one verse to learn by heart.</p></div>';
    }
    // Verse practice
    var me = who();
    html += '<h2 id="who">Today\'s verse practice <span class="muted small">2 minutes each</span></h2><div class="verbchips">' + people().map(function (p) {
      var m = mem(p.slug), due = unlocked(m).filter(function (c) { return !m.cards[c.id] || isDue(m.cards[c.id]); }).length;
      return '<button type="button" class="chip' + (p.slug === me ? ' on' : '') + '" data-who="' + esc(p.slug) + '">' + esc(p.label) +
        (due ? ' <span class="due">' + due + '</span>' : '') + '</button>';
    }).join('') + '</div><p class="muted small">The number is how many verses are waiting for that person today.</p>';
    // How it works
    html += '<details class="how"><summary>How Bible Lab works</summary><div class="prose">' +
      '<p><b>One book, one passage a week.</b> Small enough to finish, deep enough to matter. You stay with a few verses all week instead of skimming.</p>' +
      '<ol class="ladder">' + SESSIONS.map(function (s, i) { return '<li><b>' + s + ':</b> ' + SESSION_BLURB[i] + '</li>'; }).join('') + '</ol>' +
      '<p><b>Same time, same place.</b> Attach it to something you already do every day (a meal, bedtime). Every session opens by saying the verse together, so the whole family hears it five times a week before anyone practises alone.</p>' +
      '<p><b>One thing to do.</b> Each week ends with a "This week we will…" that goes on the fridge card. Check-in day asks how it went.</p>' +
      '<p><b>Verses keep coming back.</b> Each person practises for 2 minutes a day. Old verses come back for review just before they would be forgotten, so twelve weeks means twelve verses kept, not twelve verses lost.</p>' +
      '<p><b>Missed a day?</b> Just carry on from where you are. Weeks don\'t have dates; a week can stretch to two. The only rule is: don\'t stop.</p>' +
      '<p class="muted small">Leading it: nothing to prepare. Each question has a guide answer behind a button: ask first, let everyone answer, then open it.</p></div></details>';
    // Seasons
    html += '<h2>Books</h2><ul class="stages">' + data.seasons.map(function (s) {
      var fs = f.seasons[s.id], badge = '';
      if (fs) { var c = fs.done.length; badge = c >= s.weeks ? 'Finished' : 'Week ' + Math.min(c + 1, s.weeks) + ' of ' + s.weeks; }
      return '<li><a class="stage tool' + (f.active === s.id ? ' next' : '') + '" href="#' + s.id + '"><span class="name">' + esc(s.title) +
        '<span class="blurb">' + esc(s.tagline) + ' · ' + s.weeks + ' weeks</span></span>' + (badge ? '<span class="badge">' + badge + '</span>' : '') + '</a></li>';
    }).join('') + '</ul>';
    if (data.next && data.next.length) {
      html += '<h2>Coming next <span class="muted small">ideas</span></h2><ul class="stages">' + data.next.map(function (s) {
        return '<li><div class="stage tool off"><span class="name">' + esc(s.title) + ' <span class="muted small">' + esc(s.ref) + '</span>' +
          '<span class="blurb">' + esc(s.blurb) + '</span></span></div></li>';
      }).join('') + '</ul>';
    }
    app.innerHTML = html;
    each('[data-who]', function (b) {
      b.onclick = function () { save('bible:who', b.getAttribute('data-who')); location.hash = 'memory'; };
    });
  }

  function dots(did) {
    return '<span class="sessdots">' + SESSIONS.map(function (s, i) {
      return '<span class="' + (did.indexOf(i + 1) >= 0 ? 'on' : '') + '" title="' + s + '">' + (i + 1) + '</span>';
    }).join('') + '</span>';
  }

  function seasonView(id) {
    document.body.className = '';
    var j = seasons[id], f = fam(), fs = f.seasons[id], cur = fs ? currentWeek(fs, j.weeks.length) : 0;
    var html = bar('#', esc(j.title) + ' <span class="muted small">' + esc(j.tagline) + '</span>');
    html += '<p class="lead">' + j.intro.map(esc).join(' ') + '</p>';
    html += '<p class="oneline">' + esc(j.oneLine) + '</p>';
    if (!fs) html += '<div class="actions"><button class="btn" id="begin">Start ' + esc(j.title) + ' as a family</button></div>';
    html += '<h2>The background</h2><div class="cards">' + j.context.map(function (c) {
      return '<div class="card"><b>' + esc(c.h) + '</b><p class="small">' + esc(c.p) + '</p></div>';
    }).join('') + '</div>';
    html += '<p class="muted small">Threads to listen for: ' + j.threads.map(esc).join(' · ') + '</p>';
    html += '<h2>The weeks</h2><ul class="stages">' + j.weeks.map(function (w) {
      var done = fs && fs.done.indexOf(w.n) >= 0, did = (fs && fs.sessions[w.n]) || [];
      return '<li><a class="stage tool' + (w.n === cur ? ' next' : '') + '" href="#' + id + '/' + w.n + '"><span class="name">' +
        '<span class="muted small">Week ' + w.n + ' · ' + esc(j.title) + ' ' + esc(w.ref) + '</span><br>' + esc(w.title) +
        '<span class="blurb">' + esc(w.big) + '</span></span>' +
        (done ? '<span class="badge">Done ✓</span>' : did.length ? '<span class="badge">' + did.length + ' / 5</span>' : '') + '</a></li>';
    }).join('') + '</ul>';
    if (fs && fs.done.length) html += wall(j, fs) + '<p><a class="chip" href="#wall/' + id + '">Print the principles wall</a></p>';
    html += '<p class="muted small">Bible text: ' + esc(j.translation) + '.</p>';
    if (fs) html += '<details class="how"><summary>Start again</summary><p class="small">Clears this book\'s family progress (sessions, commitments, notes) on this device. Everyone\'s verse practice is kept.</p>' +
      '<button class="btn ghost" id="reset">Clear and start again</button></details>';
    app.innerHTML = html;
    var b = document.getElementById('begin');
    if (b) b.onclick = function () { var f2 = fam(); famSeason(f2, id); f2.active = id; save('bible:family', f2); location.hash = id + '/1'; };
    var r = document.getElementById('reset');
    if (r) r.onclick = function () {
      if (!confirm('Clear ' + j.title + ' and start again?')) return;
      var f2 = fam(); delete f2.seasons[id]; if (f2.active === id) f2.active = null; save('bible:family', f2); route();
    };
  }

  function wall(j, fs) {
    var ws = j.weeks.filter(function (w) { return fs.done.indexOf(w.n) >= 0 && !w.review; });
    if (!ws.length) return '';
    return '<h2>Principles wall</h2><ol class="wall">' + ws.map(function (w) {
      return '<li><span class="pr">' + esc(w.principle) + '</span><span class="muted small">' + esc(w.anchor ? w.anchor.ref : j.title + ' ' + w.ref) + ' · ' + esc(w.title) + '</span></li>';
    }).join('') + '</ol>';
  }

  function weekView(id, n, s) {
    document.body.className = '';
    var j = seasons[id], w = j.weeks[n - 1], f = fam(), fs = famSeason(f, id);
    if (!f.active) { f.active = id; save('bible:family', f); }
    var did = fs.sessions[n] || [];
    if (!s) { s = 1; while (s < 5 && did.indexOf(s) >= 0) s++; }
    var html = bar('#' + id, '<span class="muted small">Week ' + n + ' · ' + esc(j.title) + ' ' + esc(w.ref) + '</span><br>' + esc(w.title));
    html += '<div class="toggle sess" role="tablist">' + SESSIONS.map(function (name, i) {
      return '<a class="tab" role="tab" href="#' + id + '/' + n + '/' + (i + 1) + '" aria-pressed="' + (s === i + 1) + '">' +
        (did.indexOf(i + 1) >= 0 ? '✓ ' : (i + 1) + ' ') + name + '</a>';
    }).join('') + '</div>';
    html += '<p class="muted small sblurb">' + SESSION_BLURB[s - 1] + ' About 10 minutes.</p>';
    var v = w.anchor;
    if (v) html += verseBox(v, s === 5 ? 'Say it together, from memory' : 'Start by saying the verse together');
    html += session(id, j, w, fs, s);
    var label = s === 5 ? (n === j.weeks.length ? 'Finish ' + j.title : 'Finish week ' + n) : 'Done: on to ' + SESSIONS[s];
    html += '<div class="actions"><button class="btn" id="next">' + label + '</button></div>';
    html += '<p class="center"><a class="chip" href="#card/' + id + '/' + n + '">Print the fridge card</a> <a class="chip" href="#memory">Verse practice</a></p>';
    app.innerHTML = html;
    wire(id, j, w, s);
    document.getElementById('next').onclick = function () {
      var f2 = fam(), fs2 = famSeason(f2, id), d = fs2.sessions[n] || [];
      if (d.indexOf(s) < 0) d.push(s);
      fs2.sessions[n] = d;
      if (s === 5) {
        if (fs2.done.indexOf(n) < 0) fs2.done.push(n);
        save('bible:family', f2);
        location.hash = n < j.weeks.length ? id + '/' + (n + 1) + '/1' : id;
        if (n < j.weeks.length) setTimeout(function () { alert('Week ' + n + ' done. Its principle is on the wall, and its verse joins everyone\'s review.'); }, 50);
      } else {
        save('bible:family', f2);
        location.hash = id + '/' + n + '/' + (s + 1);
      }
      window.scrollTo(0, 0);
    };
  }

  function session(id, j, w, fs, s) {
    var html = '';
    if (s === 1) {
      html += '<p class="bigq">' + esc(w.big) + '</p>';
      html += '<h2>Where are we?</h2><div class="prose">' + w.context.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>';
      html += '<h2>Read it aloud <span class="muted small">twice: once by one reader, then a verse each</span></h2>';
      html += w.review ? j.weeks.filter(function (x) { return x.passage; }).map(function (x) {
        return '<h3 class="small muted">' + esc(x.ref) + ' · ' + esc(x.title) + '</h3>' + passageHtml(x.passage, x);
      }).join('') : passageHtml(w.passage, w);
      if (w.words.length) html += '<h2>Words to know</h2><ul class="vocab">' + w.words.map(function (x) {
        return '<li><b>' + esc(x[0]) + '</b><span class="en">' + esc(x[1]) + '</span></li>';
      }).join('') + '</ul>';
      html += '<h2>What did you notice?</h2><ul class="qs">' + w.notice.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ul>';
    } else if (s === 2) {
      if (w.passage) html += '<details class="how"><summary>The passage</summary>' + passageHtml(w.passage, w) + '</details>';
      html += '<p class="muted small">Ask, let everyone answer (youngest first), then open the guide answer.</p><ol class="dig">' + w.dig.map(function (d) {
        return '<li><p class="q">' + esc(d.q) + '</p><details class="guide"><summary>Guide answer</summary><p>' + esc(d.a) + '</p></details></li>';
      }).join('') + '</ol>';
      html += '<div class="tips"><p><b>For the younger ones</b></p><p>' + esc(w.young) + '</p></div>';
    } else if (s === 3) {
      html += '<div class="principle"><div class="vlabel">The principle</div><p>' + esc(w.principle) + '</p></div>';
      html += '<p>' + esc(w.why) + '</p>';
      html += '<p class="muted small">Can each person say the principle in their own words? Then try: where did you see this today?</p>';
      html += '<h2>Jesus said it first</h2>' + xref(w.jesus);
      if (w.also.length) html += '<h2>Elsewhere in the Bible</h2>' + w.also.map(xref).join('');
    } else if (s === 4) {
      if (w.scenarios.length) html += '<h2>Where would this show up?</h2><p class="muted small">Talk through each one: what would living this week\'s principle look like?</p><ul class="qs">' +
        w.scenarios.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ul>';
      html += '<h2>This week we will…</h2><p class="muted small">Choose one as a family, or write your own. It goes on the fridge card.</p><div class="opts">' +
        w.tryThis.map(function (t) {
          return '<button type="button" class="opt' + (fs.commit[w.n] === t ? ' right' : '') + '" data-commit="' + esc(t) + '">' + esc(t) + '</button>';
        }).join('') + '</div>';
      var own = fs.commit[w.n] && w.tryThis.indexOf(fs.commit[w.n]) < 0 ? fs.commit[w.n] : '';
      html += '<p><input class="type" id="own" placeholder="Or write your own…" value="' + esc(own) + '"></p>';
      html += '<h2>Pray</h2><p>' + esc(w.pray) + '</p>';
    } else {
      if (fs.commit[w.n]) html += '<p class="commit"><b>This week we said we would:</b> ' + esc(fs.commit[w.n]) + '</p>';
      html += '<ol class="dig">' + j.checkin.map(function (q) { return '<li><p class="q">' + esc(q) + '</p></li>'; }).join('') + '</ol>';
      html += '<h2>What happened? <span class="muted small">a line to look back on</span></h2><textarea class="type" id="note" rows="3" placeholder="Where we saw it, what was hard, what we\'ll keep…">' + esc(fs.notes[w.n] || '') + '</textarea>';
      var next = j.weeks[w.n];
      if (next) html += '<p class="muted small">Next week: <b>' + esc(next.title) + '</b> (' + esc(j.title) + ' ' + esc(next.ref) + ').</p>';
      html += wall(j, { done: fs.done.concat([w.n]) });
    }
    return html;
  }

  function xref(x) {
    return '<blockquote class="xref"><p class="verse">' + esc(x.text) + '</p><p class="vref">' + esc(x.ref) + '</p>' +
      (x.note ? '<p class="small muted">' + esc(x.note) + '</p>' : '') + '</blockquote>';
  }

  function wire(id, j, w, s) {
    function setCommit(t) { var f = fam(), fs = famSeason(f, id); fs.commit[w.n] = t; save('bible:family', f); }
    each('[data-commit]', function (b) {
      b.onclick = function () {
        setCommit(b.getAttribute('data-commit'));
        each('[data-commit]', function (x) { x.className = 'opt' + (x === b ? ' right' : ''); });
        document.getElementById('own').value = '';
      };
    });
    var own = document.getElementById('own');
    if (own) own.oninput = function () {
      if (own.value.trim()) { setCommit(own.value.trim()); each('[data-commit]', function (x) { x.className = 'opt'; }); }
    };
    var note = document.getElementById('note');
    if (note) note.oninput = function () { var f = fam(), fs = famSeason(f, id); fs.notes[w.n] = note.value; save('bible:family', f); };
  }

  function cardView(id, n) {
    document.body.className = 'printing';
    var j = seasons[id], w = j.weeks[n - 1], fs = famSeason(fam(), id);
    var html = '<div class="noprint">' + bar('#' + id + '/' + n, 'Fridge card') +
      '<p class="muted">Print it, cut it out, stick it where everyone will see it. Tick each session as you go.</p>' +
      '<div class="actions"><button class="btn" onclick="window.print()">Print</button></div></div>';
    html += '<section class="fridge"><div class="fc-top"><span>' + esc(j.title) + ' · Week ' + n + '</span><span>Bible Lab</span></div>' +
      '<h2>' + esc(w.title) + '</h2>';
    if (w.anchor) html += '<p class="verse">' + esc(w.anchor.text) + '</p><p class="vref">' + esc(w.anchor.ref) + '</p>';
    html += '<p class="fc-pr"><b>Principle:</b> ' + esc(w.principle) + '</p>' +
      '<p><b>Big question:</b> ' + esc(w.big) + '</p>' +
      '<p><b>This week we will:</b> ' + (fs.commit[n] ? esc(fs.commit[n]) : '<span class="lines"></span><span class="lines"></span>') + '</p>' +
      '<p class="fc-ticks">' + SESSIONS.map(function (s) { return '<span>☐ ' + s + '</span>'; }).join('') + '</p></section>';
    app.innerHTML = html;
  }

  function wallView(id) {
    document.body.className = 'printing';
    var j = seasons[id], fs = famSeason(fam(), id);
    app.innerHTML = '<div class="noprint">' + bar('#' + id, 'Principles wall') +
      '<div class="actions"><button class="btn" onclick="window.print()">Print</button></div></div>' +
      '<section class="wallprint"><h1>' + esc(j.title) + ': ' + esc(j.tagline) + '</h1>' + (wall(j, fs) || '<p class="empty">Finish a week to add its principle.</p>') + '</section>';
  }

  // ---------- verse practice ----------
  function memoryView() {
    var me = who(), p = person(me);
    var html = bar('#', 'Verse practice');
    html += '<div class="verbchips">' + people().map(function (x) {
      return '<button type="button" class="chip' + (x.slug === me ? ' on' : '') + '" data-who="' + esc(x.slug) + '">' + esc(x.label) + '</button>';
    }).join('') + '</div>';
    if (!p) { document.body.className = ''; app.innerHTML = html + '<p class="muted">Who\'s practising?</p>'; wireWho(); return; }
    paint(me);
    var m = mem(me), cards = unlocked(m);
    if (!cards.length) {
      app.innerHTML = html + '<p class="empty">No verses yet. Start a book on the Bible Lab page and this week\'s verse appears here.</p>';
      wireWho(); return;
    }
    var week = practisedThisWeek(m);
    html += '<p class="weekdots">' + ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(function (d, i) {
      return '<span class="' + (week[i] ? 'on' : '') + '">' + d + '</span>';
    }).join('') + '<span class="muted small">days practised this week</span></p>';
    var fresh = cards.filter(function (c) { return c.now; });
    fresh.forEach(function (c) {
      var st = m.cards[c.id];
      html += '<div class="vbox now"><div class="vlabel">' + (c.stretch ? 'Stretch verse' : 'This week\'s verse') + ' · ' + strength(st) + '</div>' +
        '<p class="verse">' + esc(c.v.text) + '</p><p class="vref">' + esc(c.v.ref) + '</p>' +
        '<div class="actions"><a class="btn" href="#learn/' + c.id + '">' + (st && st.box ? 'Practise again' : 'Learn it') + '</a></div></div>';
    });
    var due = cards.filter(function (c) { return !c.now && (!m.cards[c.id] || isDue(m.cards[c.id])); });
    html += '<h2>Review</h2>';
    html += due.length ? '<a class="stage next tool" href="#review"><span class="name">' + due.length + ' verse' + (due.length === 1 ? '' : 's') +
      ' to review today<span class="blurb">Say each one from memory, then check.</span></span><span class="badge">Start</span></a>'
      : '<p class="muted">Nothing due today. Each verse comes back just before it would fade.</p>';
    html += '<h2>All my verses</h2><ul class="stages">' + cards.map(function (c) {
      var st = m.cards[c.id], b = (st && st.box) || 0;
      return '<li><a class="stage tool" href="#learn/' + c.id + '"><span class="name">' + esc(c.v.ref) + (c.stretch ? ' <span class="muted small">stretch</span>' : '') +
        '<span class="blurb">' + esc(c.w.title) + '</span><span class="strength"><span style="width:' + Math.round(b / (DAYS.length - 1) * 100) + '%"></span></span></span>' +
        '<span class="badge">' + strength(st) + '</span></a></li>';
    }).join('') + '</ul>';
    html += '<label class="switch"><input type="checkbox" id="stretch"' + (m.stretch ? ' checked' : '') + '> Stretch verses too <span class="muted small">(a second verse each week, for older ones and grown-ups)</span></label>';
    app.innerHTML = html;
    wireWho();
    document.getElementById('stretch').onchange = function () { var m2 = mem(me); m2.stretch = this.checked; save(memKey(me), m2); route(); };
  }
  function wireWho() {
    each('[data-who]', function (b) { b.onclick = function () { save('bible:who', b.getAttribute('data-who')); route(); }; });
  }

  var STEPS = ['Read', 'First letters', 'Fade', 'Build', 'Say it'];
  function learnView(cid, step) {
    var me = who(); if (!person(me)) { location.hash = 'memory'; return; }
    paint(me);
    var m = mem(me), c = cardById(m, cid);
    if (!c) { location.hash = 'memory'; return; }
    step = step || 1;
    var t = c.v.text, ws = words(t);
    var html = bar('#memory', esc(c.v.ref));
    html += '<div class="toggle sess">' + STEPS.map(function (s, i) {
      return '<a class="tab" href="#learn/' + cid + '/' + (i + 1) + '" aria-pressed="' + (step === i + 1) + '">' + (i + 1) + ' ' + s + '</a>';
    }).join('') + '</div>';
    if (step === 1) {
      html += '<p class="ask">Read it aloud three times, one phrase at a time. Tap a circle after each read.</p>' +
        '<div class="vbox"><p class="verse lines">' + chunks(t).map(esc).join('<br>') + '</p><p class="vref">' + esc(c.v.ref) + '</p></div>' +
        '<p class="reads center"><button class="readdot" type="button"></button><button class="readdot" type="button"></button><button class="readdot" type="button"></button></p>';
    } else if (step === 2) {
      html += '<p class="ask">Only the first letter of each word. Say the whole verse from these. Tap a letter if you\'re stuck.</p>' +
        '<div class="vbox"><p class="verse letters">' + ws.map(function (w) {
          return '<button type="button" class="peek" data-w="' + esc(w) + '">' + esc(initial(w)) + '</button>';
        }).join(' ') + '</p><p class="vref">' + esc(c.v.ref) + '</p></div>';
    } else if (step === 3) {
      html += '<p class="ask">Say it, then hide more words and say it again. Tap a gap to peek.</p>' +
        '<div class="vbox"><p class="verse" id="fade"></p><p class="vref">' + esc(c.v.ref) + '</p></div>' +
        '<div class="actions"><button class="btn ghost" id="less">Show more</button><button class="btn" id="more">Hide more</button></div>';
    } else if (step === 4) {
      html += '<p class="ask">Tap the phrases in order.</p><div class="answer" id="ans"></div><div class="bank" id="bank"></div><div id="fb"></div>';
    } else {
      html += '<p class="ask">Say the whole verse out loud from memory, with its reference. Then check.</p>' +
        '<div class="vbox"><p class="verse" id="hidden"><span class="muted">' + esc(ws.slice(0, 2).join(' ')) + ' …</span></p><p class="vref">' + esc(c.v.ref) + '</p></div>' +
        '<div class="actions"><button class="btn" id="reveal">Check</button></div><div id="gradebox"></div>';
    }
    if (step < 5) html += '<div class="actions"><a class="btn" href="#learn/' + cid + '/' + (step + 1) + '">Next: ' + STEPS[step] + '</a></div>';
    app.innerHTML = html;

    each('.readdot', function (b) { b.onclick = function () { b.classList.toggle('on'); }; });
    each('.peek', function (b) {
      b.onclick = function () { var w = b.getAttribute('data-w'), cur = b.textContent; b.textContent = cur === w ? initial(w) : w; };
    });
    if (step === 3) {
      var order = seeded(ws.length, cid), level = 1, el = document.getElementById('fade');
      var drawFade = function () {
        var hide = {}, k = Math.round(ws.length * level / 4);
        order.slice(0, k).forEach(function (i) { hide[i] = 1; });
        el.innerHTML = ws.map(function (w, i) {
          return hide[i] ? '<button type="button" class="gapw" data-w="' + esc(w) + '">' + new Array(Math.max(2, w.length) + 1).join('&#8199;') + '</button>' : esc(w);
        }).join(' ');
        Array.prototype.forEach.call(el.querySelectorAll('.gapw'), function (g) {
          g.onclick = function () { g.textContent = g.getAttribute('data-w'); g.classList.add('shown'); };
        });
        document.getElementById('more').disabled = level >= 4;
        document.getElementById('less').disabled = level <= 0;
      };
      document.getElementById('more').onclick = function () { level++; drawFade(); };
      document.getElementById('less').onclick = function () { level--; drawFade(); };
      drawFade();
    }
    if (step === 4) buildGame(chunks(t), cid);
    if (step === 5) {
      document.getElementById('reveal').onclick = function () {
        document.getElementById('hidden').textContent = t;
        this.parentNode.style.display = 'none';
        document.getElementById('gradebox').innerHTML = gradeButtons() + '<p class="muted small">Principle: ' + esc(c.w.principle) + '</p>';
        each('[data-grade]', function (b) {
          b.onclick = function () {
            grade(me, cid, b.getAttribute('data-grade'));
            var g = b.getAttribute('data-grade');
            document.getElementById('gradebox').innerHTML = '<div class="fb ' + (g === 'got' ? 'ok' : 'plain') + '"><b>' +
              (g === 'got' ? 'Well done.' : g === 'nearly' ? 'Nearly there.' : 'Good practice.') + '</b><div>' +
              (g === 'got' ? 'It will come back for review in a few days.' : 'It will come back tomorrow. Try the steps again any time.') + '</div></div>' +
              '<div class="actions"><a class="btn" href="#memory">Done</a></div>';
          };
        });
      };
    }
  }
  function gradeButtons() {
    return '<p class="ask">How did it go?</p><div class="actions grade">' +
      '<button class="btn ghost" data-grade="not">Not yet</button><button class="btn ghost" data-grade="nearly">Nearly</button><button class="btn" data-grade="got">Got it</button></div>';
  }
  function buildGame(parts, seed) {
    var order = seeded(parts.length, seed + 'b'), next = 0, slips = 0;
    var bank = document.getElementById('bank'), ans = document.getElementById('ans'), fb = document.getElementById('fb');
    bank.innerHTML = order.map(function (i) { return '<button type="button" class="tile-w" data-i="' + i + '">' + esc(parts[i]) + '</button>'; }).join('');
    Array.prototype.forEach.call(bank.querySelectorAll('.tile-w'), function (b) {
      b.onclick = function () {
        if (+b.getAttribute('data-i') !== next) { slips++; b.classList.add('nope'); setTimeout(function () { b.classList.remove('nope'); }, 400); return; }
        next++; ans.appendChild(b); b.onclick = null;
        if (next === parts.length) fb.innerHTML = '<div class="fb ok"><b>' + (slips ? 'Done, with ' + slips + ' slip' + (slips === 1 ? '' : 's') + '.' : 'Perfect.') + '</b></div>';
      };
    });
  }

  function reviewView() {
    var me = who(); if (!person(me)) { location.hash = 'memory'; return; }
    paint(me);
    var m = mem(me), queue = unlocked(m).filter(function (c) { return !c.now && (!m.cards[c.id] || isDue(m.cards[c.id])); });
    var i = 0, again = [];
    function show() {
      if (i >= queue.length && again.length) { queue = again; again = []; i = 0; }
      if (i >= queue.length) {
        app.innerHTML = bar('#memory', 'Review') + '<div class="done"><p class="score">✓</p><p class="star-win">All done for today.</p>' +
          '<p class="muted">Hidden in your heart a little deeper.</p></div><div class="actions"><a class="btn" href="#memory">Back</a></div>';
        return;
      }
      var c = queue[i], ws = words(c.v.text);
      app.innerHTML = bar('#memory', 'Review') + '<div class="meter"><span style="width:' + Math.round(i / queue.length * 100) + '%"></span></div>' +
        '<p class="ask">' + esc(c.w.title) + '</p><p class="prompt">' + esc(c.v.ref) + '</p>' +
        '<div class="vbox"><p class="verse" id="hidden"><span class="muted">Say it from memory…</span></p></div>' +
        '<div class="actions" id="pre"><button class="btn ghost" id="hint">First letters</button><button class="btn" id="reveal">Check</button></div><div id="gradebox"></div>';
      document.getElementById('hint').onclick = function () {
        document.getElementById('hidden').textContent = ws.map(initial).join(' ');
      };
      document.getElementById('reveal').onclick = function () {
        document.getElementById('hidden').textContent = c.v.text;
        document.getElementById('pre').style.display = 'none';
        document.getElementById('gradebox').innerHTML = gradeButtons() + '<p class="muted small">Principle: ' + esc(c.w.principle) + '</p>';
        each('[data-grade]', function (b) {
          b.onclick = function () {
            var g = b.getAttribute('data-grade');
            grade(me, c.id, g);
            if (g === 'not') again.push(c);
            i++; show();
          };
        });
      };
    }
    if (!queue.length) { location.hash = 'memory'; return; }
    show();
  }

  // ---------- router ----------
  function route() {
    var h = decodeURIComponent(location.hash.slice(1)), p = h.split('/');
    window.scrollTo(0, 0);
    if (!h) return home();
    if (p[0] === 'memory') return memoryView();
    if (p[0] === 'review') return reviewView();
    if (p[0] === 'learn') return learnView(p[1], +p[2] || 1);
    if (p[0] === 'card') return season(p[1]).then(function () { cardView(p[1], +p[2]); }).catch(fail);
    if (p[0] === 'wall') return season(p[1]).then(function () { wallView(p[1]); }).catch(fail);
    season(p[0]).then(function (j) {
      var n = +p[1];
      if (n >= 1 && n <= j.weeks.length) weekView(p[0], n, +p[2] || 0);
      else seasonView(p[0]);
    }).catch(fail);
  }
  function fail(e) {
    app.innerHTML = '<p class="empty">Could not load this page. Check your connection and try again.</p>';
    console.error(e);
  }

  Promise.all([get('../children.json'), get('bible.json')]).then(function (res) {
    kids = res[0].children; data = res[1];
    // Load every season the family has started, so home and verse practice know their verses.
    var f = fam();
    return Promise.all(data.seasons.filter(function (s) { return f.seasons[s.id]; }).map(function (s) { return season(s.id); }));
  }).then(function () {
    window.addEventListener('hashchange', route);
    route();
  }).catch(fail);
})();
