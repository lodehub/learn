/* Practice engine: real exam questions with instant feedback, on-screen writing marked against
   the real mark scheme, and a printable paper generated from the same content file.
   Wrapper page: <main id="app"></main>
   <script src="../../../assets/practice/practice.js" data-content="content.json" data-key="<slug>:<subject>:<tool>"></script>
   Add ?print to the URL to get the handwritten paper (print to PDF from there). See README.md. */
(function () {
  'use strict';
  var me = document.currentScript;
  var SRC = me.getAttribute('data-content') || 'content.json';
  var KEY = (me.getAttribute('data-key') || location.pathname) + ':state';
  var PRINT = /[?&]print\b/.test(location.search);
  var app = document.getElementById('app');
  var state = {};
  try { state = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { state = {}; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function st(id) { return state[id] || (state[id] = {}); }

  /* ---------- text helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // Content strings may hold simple trusted HTML. [[3/5]] and [[1 2/3]] become stacked fractions.
  function rich(s) {
    return String(s == null ? '' : s).replace(/\[\[(?:(\d+) )?(\d+)\/(\d+)\]\]/g, function (_, w, n, d) {
      return (w ? '<span class="pr-w">' + w + '</span>' : '') + '<span class="pr-fr"><span>' + n + '</span><span>' + d + '</span></span>';
    });
  }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function marksLabel(m) { return m ? '[' + m + (m == 1 ? ' mark' : ' marks') + ']' : ''; }

  /* ---------- numbers and fractions ---------- */
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a || 1; }
  // Returns {n, d, kind: 'int'|'dec'|'frac'|'mixed', proper, simple} or null.
  function parse(raw) {
    var s = String(raw).trim().replace(/[–−]/g, '-').replace(/\s+/g, ' ').replace(/,/g, '');
    var m;
    if ((m = s.match(/^(-?\d+)$/))) return { n: +m[1], d: 1, kind: 'int', simple: true };
    if ((m = s.match(/^(-?\d*\.\d+)$/))) { var p = m[1].split('.')[1].length, d = Math.pow(10, p); return { n: Math.round(parseFloat(m[1]) * d), d: d, kind: 'dec', simple: true }; }
    if ((m = s.match(/^(-?\d+) ?\/ ?(\d+)$/)) && +m[2]) return { n: +m[1], d: +m[2], kind: 'frac', simple: gcd(+m[1], +m[2]) === 1 };
    if ((m = s.match(/^(\d+) (\d+) ?\/ ?(\d+)$/)) && +m[3]) return { n: +m[1] * +m[3] + +m[2], d: +m[3], kind: 'mixed', proper: +m[2] < +m[3], simple: gcd(+m[2], +m[3]) === 1 };
    return null;
  }
  function same(a, b) { return a && b && a.n * b.d === b.n * a.d; }
  // Check an answer against a spec {answer, form, simplest, traps}. Returns {ok, msg}.
  function check(input, spec) {
    var v = parse(input);
    if (!v) return { ok: false, msg: 'Write a number, a fraction like 3/5, or a mixed number like 2 1/4 (with a space).' };
    var traps = spec.traps || [];
    for (var i = 0; i < traps.length; i++) if (same(v, parse(traps[i].value)) && (!traps[i].kind || traps[i].kind === v.kind)) return { ok: false, msg: traps[i].msg };
    var answers = [].concat(spec.answer);
    var hit = answers.some(function (a) { return same(v, parse(a)); });
    if (!hit) return { ok: false, msg: spec.wrong || 'Not quite. Check each step of your working.' };
    if (spec.form === 'mixed' && v.kind !== 'mixed' && v.kind !== 'int') return { ok: false, msg: spec.formMsg || 'Right value, wrong form. The question asks for a mixed number, so AQA would not give the mark.' };
    if (spec.form === 'mixed' && v.kind === 'mixed' && !v.proper) return { ok: false, msg: 'In a mixed number the fraction part must be less than 1.' };
    if (spec.form === 'fraction' && v.kind === 'dec') return { ok: false, msg: spec.formMsg || 'Right value, but the question says “give your answer as a fraction”. A decimal loses the last mark.' };
    if (spec.simplest && !v.simple) return { ok: false, msg: 'Right value. Now simplify it fully.' };
    return { ok: true };
  }

  /* ---------- score tracking ---------- */
  var scored = []; // {id, marks, self:boolean}
  function got(id) { var s = state[id]; return s && typeof s.got === 'number' ? s.got : null; }
  function updateSummary() {
    var box = document.getElementById('pr-summary'); if (!box) return;
    var auto = 0, autoMax = 0, self = 0, selfMax = 0, done = 0;
    scored.forEach(function (q) {
      var g = got(q.id);
      if (q.self) { selfMax += q.marks; if (g != null) { self += g; done++; } }
      else { autoMax += q.marks; if (g != null) { auto += g; done++; } }
    });
    box.innerHTML = '<div class="pr-score"><b>' + auto + '</b> / ' + autoMax + '<span>marked on screen</span></div>' +
      (selfMax ? '<div class="pr-score"><b>' + self + '</b> / ' + selfMax + '<span>you marked with the mark scheme</span></div>' : '') +
      '<p class="pr-note">' + done + ' of ' + scored.length + ' questions done. Marks on screen count your first try.</p>';
  }

  /* ---------- shared pieces ---------- */
  function head(b) {
    var top = '';
    if (b.source || b.marks) top = '<div class="pr-src"><span>' + esc(b.source || '') + '</span><span>' + marksLabel(b.marks) + '</span></div>';
    var out = top;
    if (b.stem) out += '<p class="pr-stem">' + rich(b.stem) + '</p>';
    if (b.extract) out += '<blockquote class="pr-extract">' + rich(b.extract) + '</blockquote>';
    if (b.fig) out += figure(b.fig);
    if (b.table) out += table(b.table);
    if (b.q) out += '<p class="pr-q">' + rich(b.q) + '</p>';
    return out;
  }
  function figure(f) {
    var img = '<img src="' + esc(f.src) + '" alt="' + esc(f.alt || '') + '">';
    return '<figure class="pr-fig">' + (PRINT ? img : '<a href="' + esc(f.src) + '" target="_blank" rel="noopener">' + img + '</a>') +
      (f.label ? '<figcaption>' + esc(f.label) + (PRINT ? '' : ' · tap to enlarge') + '</figcaption>' : '') + '</figure>';
  }
  function table(t) {
    return '<div class="pr-tablewrap">' + (t.title ? '<p class="pr-tabletitle">' + esc(t.title) + '</p>' : '') + '<table class="pr-table"><thead><tr>' +
      t.head.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      t.rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table>' + (t.label ? '<p class="pr-figlabel">' + esc(t.label) + '</p>' : '') + '</div>';
  }
  function msBox(b) {
    return b.ms ? '<details class="pr-ms"><summary>AQA mark scheme</summary>' + rich(b.ms) + '</details>' : '';
  }
  function card(b, extraCls) {
    var c = el('section', 'pr-card' + (extraCls ? ' ' + extraCls : ''));
    if (b.h) c.appendChild(el('h3', 'pr-h', esc(b.h)));
    return c;
  }

  /* ---------- block types ---------- */
  var R = {};

  R.info = function (b) {
    var c = card(b, 'pr-info' + (b.tone ? ' pr-' + b.tone : ''));
    c.appendChild(el('div', null, rich(b.html)));
    return c;
  };

  R.mc = function (b) {
    var c = card(b); scored.push({ id: b.id, marks: b.marks || 1 });
    c.insertAdjacentHTML('beforeend', head(b));
    var opts = el('div', 'pr-opts'), fb = el('div', 'pr-fb'), s = st(b.id);
    b.o.forEach(function (txt, i) {
      var bt = el('button', 'pr-opt', rich(txt)); bt.type = 'button';
      bt.onclick = function () { pick(i, true); };
      opts.appendChild(bt);
    });
    function pick(i, fresh) {
      Array.prototype.forEach.call(opts.children, function (x, k) { x.disabled = true; if (k === b.c) x.classList.add('right'); if (k === i && i !== b.c) x.classList.add('wrong'); });
      fb.innerHTML = (i === b.c ? '<b class="ok">Correct.</b> ' : '<b class="no">Not quite.</b> ') + rich(b.why || '') + msBox(b);
      fb.classList.add('show');
      if (fresh) { s.choice = i; s.got = i === b.c ? (b.marks || 1) : 0; save(); updateSummary(); }
    }
    c.appendChild(opts); c.appendChild(fb);
    if (s.choice != null) pick(s.choice, false);
    return c;
  };

  function answerRow(spec, onDone, saved) {
    // An input + Check button. Calls onDone(firstTry) once correct.
    var row = el('div', 'pr-row'), inp = el('input'), bt = el('button', 'pr-btn', 'Check'), fb = el('div', 'pr-fb');
    inp.type = 'text'; inp.inputMode = spec.decimal ? 'decimal' : 'text'; inp.autocomplete = 'off'; inp.spellcheck = false;
    inp.placeholder = spec.placeholder || 'Your answer';
    if (spec.unit) { row.appendChild(inp); row.appendChild(el('span', 'pr-unit', esc(spec.unit))); } else row.appendChild(inp);
    row.appendChild(bt);
    var tries = 0, wrap = el('div', 'pr-answer'); wrap.appendChild(row); wrap.appendChild(fb);
    function done(first, value) {
      inp.value = value; inp.disabled = true; bt.disabled = true; bt.textContent = '✓';
      fb.innerHTML = '<b class="ok">Correct.</b> ' + rich(spec.why || ''); fb.classList.add('show');
      onDone(first, value);
    }
    bt.onclick = function () {
      if (!inp.value.trim()) return;
      tries++;
      var r = check(inp.value, spec);
      if (r.ok) done(tries === 1, inp.value.trim());
      else {
        fb.innerHTML = '<b class="no">Not yet.</b> ' + rich(r.msg) + (tries >= 3 && spec.hint ? '<br><i>Hint:</i> ' + rich(spec.hint) : '');
        fb.classList.add('show');
        if (tries === 1) onDone(null, null, true);
      }
    };
    inp.onkeydown = function (e) { if (e.key === 'Enter') bt.onclick(); };
    if (saved != null) { inp.value = saved; inp.disabled = true; bt.disabled = true; bt.textContent = '✓'; fb.innerHTML = '<b class="ok">Correct.</b> ' + rich(spec.why || ''); fb.classList.add('show'); }
    return wrap;
  }

  R.num = function (b) {
    var c = card(b); scored.push({ id: b.id, marks: b.marks || 1 });
    c.insertAdjacentHTML('beforeend', head(b));
    var s = st(b.id), ms = el('div');
    c.appendChild(answerRow(b, function (first, value, missed) {
      if (missed) { if (s.got == null) { s.got = 0; save(); updateSummary(); } return; }
      if (s.got == null) s.got = first ? (b.marks || 1) : 0;
      s.value = value; save(); updateSummary(); ms.innerHTML = msBox(b);
    }, s.value));
    if (s.value != null) ms.innerHTML = msBox(b);
    c.appendChild(ms);
    return c;
  };

  R.steps = function (b) {
    // Multi-step method: each step is its own check, labelled with the mark it earns (M1, A1...).
    var c = card(b); scored.push({ id: b.id, marks: b.marks });
    c.insertAdjacentHTML('beforeend', head(b));
    var s = st(b.id); s.steps = s.steps || {};
    var list = el('ol', 'pr-steps'), ms = el('div');
    function unlock(i) {
      if (i >= b.steps.length) { ms.innerHTML = '<div class="pr-fb show"><b class="ok">All steps done.</b> ' + rich(b.why || '') + '</div>' + msBox(b); return; }
      var sp = b.steps[i], li = el('li', 'pr-step');
      li.innerHTML = '<div class="pr-steph">' + rich(sp.p) + (sp.mark ? ' <span class="pr-mark">' + esc(sp.mark) + '</span>' : '') + '</div>';
      li.appendChild(answerRow(sp, function (first, value, missed) {
        var ss = s.steps[i] || (s.steps[i] = {});
        if (missed) { ss.first = false; save(); return; }
        if (ss.first == null) ss.first = !!first;
        ss.value = value; tally(); save(); updateSummary(); unlock(i + 1);
      }, s.steps[i] && s.steps[i].value));
      list.appendChild(li);
      if (s.steps[i] && s.steps[i].value != null) unlock(i + 1);
    }
    function tally() {
      var n = 0, all = true;
      b.steps.forEach(function (sp, i) { var ss = s.steps[i]; if (!ss || ss.value == null) all = false; else if (ss.first) n += sp.marks == null ? 1 : sp.marks; });
      if (all) s.got = Math.min(n, b.marks);
    }
    c.appendChild(list); c.appendChild(ms); unlock(0);
    return c;
  };

  R.product = function (b) {
    // "Write fractions less than 1 in the boxes": any valid answer is accepted.
    var c = card(b); scored.push({ id: b.id, marks: b.marks || 1 });
    c.insertAdjacentHTML('beforeend', head(b));
    var s = st(b.id), row = el('div', 'pr-row pr-product'), ins = [], fb = el('div', 'pr-fb');
    for (var i = 0; i < (b.n || 2); i++) {
      if (i) row.appendChild(el('span', 'pr-op', '×'));
      var inp = el('input'); inp.type = 'text'; inp.placeholder = 'a/b'; inp.className = 'pr-small'; ins.push(inp); row.appendChild(inp);
    }
    row.appendChild(el('span', 'pr-op', '= ' + rich('[[' + b.target + ']]')));
    var bt = el('button', 'pr-btn', 'Check'); row.appendChild(bt);
    var target = parse(b.target), tries = 0;
    bt.onclick = function () {
      var vals = ins.map(function (x) { return parse(x.value); });
      var msg = '';
      if (vals.some(function (v) { return !v; })) msg = 'Fill every box with a fraction like 1/2.';
      else if (vals.some(function (v) { return v.kind !== 'frac'; })) msg = 'Each box needs a fraction (a/b), not a decimal or whole number. AQA gave no mark for decimals here.';
      else if (vals.some(function (v) { return !(v.n < v.d && v.n > 0); })) msg = 'Each fraction must be less than 1 (and more than 0).';
      else { var p = vals.reduce(function (a, v) { return { n: a.n * v.n, d: a.d * v.d }; }, { n: 1, d: 1 }); if (!same(p, target)) msg = 'Multiply them: tops times tops, bottoms times bottoms. Your boxes make ' + p.n + '/' + p.d + '.'; }
      tries++;
      if (msg) { fb.innerHTML = '<b class="no">Not yet.</b> ' + msg; fb.classList.add('show'); if (s.got == null) { s.got = 0; save(); updateSummary(); } return; }
      if (s.got == null) s.got = tries === 1 ? (b.marks || 1) : 0;
      s.vals = ins.map(function (x) { return x.value; }); save(); updateSummary(); finish();
    };
    function finish() {
      ins.forEach(function (x, k) { x.disabled = true; if (s.vals) x.value = s.vals[k]; }); bt.disabled = true; bt.textContent = '✓';
      fb.innerHTML = '<b class="ok">Correct.</b> ' + rich(b.why || '') + msBox(b); fb.classList.add('show');
    }
    c.appendChild(row); c.appendChild(fb);
    if (s.vals) finish();
    return c;
  };

  R.order = function (b) {
    // Tap the items in the right order (a Because Chain, or a level ladder).
    var c = card(b);
    c.insertAdjacentHTML('beforeend', head(b));
    var s = st(b.id), wrap = el('div', 'pr-order'), fb = el('div', 'pr-fb'), next = 0;
    var items = b.items.map(function (t, i) { return { t: t, i: i }; });
    for (var i = items.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = items[i]; items[i] = items[j]; items[j] = t; }
    if (s.done) items.sort(function (a, z) { return a.i - z.i; });
    items.forEach(function (it) {
      var bt = el('button', 'pr-ord', rich(it.t)); bt.type = 'button';
      bt.onclick = function () {
        if (bt.classList.contains('done')) return;
        if (it.i === next) {
          next++; bt.classList.add('done'); bt.innerHTML = '<span class="pr-n">' + (b.labels ? esc(b.labels[it.i]) : next) + '</span>' + rich(it.t);
          if (next === b.items.length) { fb.innerHTML = '<b class="ok">' + esc(b.doneTitle || 'In order.') + '</b> ' + rich(b.done || ''); fb.classList.add('show'); s.done = true; save(); }
        } else { bt.classList.add('nope'); setTimeout(function () { bt.classList.remove('nope'); }, 600); }
      };
      wrap.appendChild(bt);
      if (s.done) { bt.click(); }
    });
    c.appendChild(wrap); c.appendChild(fb);
    return c;
  };

  R.write = function (b) {
    // Write on screen, then mark it yourself against the real mark scheme.
    var c = card(b, 'pr-write'); scored.push({ id: b.id, marks: b.marks, self: true });
    c.insertAdjacentHTML('beforeend', head(b));
    var s = st(b.id);
    if (b.starters) c.appendChild(el('p', 'pr-starters', 'Useful starters: ' + b.starters.map(function (x) { return '<i>' + esc(x) + '</i>'; }).join(' · ')));
    var ta = el('textarea', 'pr-ta'); ta.rows = b.rows || 6; ta.placeholder = b.placeholder || 'Write in full sentences.'; ta.value = s.text || '';
    var count = el('div', 'pr-count');
    function wc() { var n = (ta.value.trim().match(/\S+/g) || []).length; count.textContent = n + ' words' + (b.minWords ? ' (aim for ' + b.minWords + '+)' : ''); }
    ta.oninput = function () { s.text = ta.value; save(); wc(); };
    wc();
    var bt = el('button', 'pr-btn', 'I have finished: mark it'); bt.type = 'button';
    var panel = el('div', 'pr-markpanel');
    bt.onclick = function () { if (!ta.value.trim()) { ta.focus(); return; } s.open = true; save(); showPanel(); };
    function showPanel() {
      panel.innerHTML = ''; bt.style.display = 'none';
      var m = b.mark || {};
      if (m.points) {
        panel.appendChild(el('p', 'pr-markh', 'Tick each point your answer makes. Be strict: it must be in your words above.'));
        s.ticks = s.ticks || [];
        m.points.forEach(function (p, i) {
          var lab = el('label', 'pr-tick'), cb = el('input'); cb.type = 'checkbox'; cb.checked = !!s.ticks[i];
          cb.onchange = function () { s.ticks[i] = cb.checked; total(); };
          lab.appendChild(cb); lab.appendChild(el('span', null, rich(p.t) + (p.m != null ? ' <span class="pr-mark">' + p.m + '</span>' : '')));
          panel.appendChild(lab);
        });
        var tot = el('p', 'pr-total'); panel.appendChild(tot);
        function total() {
          var n = 0; m.points.forEach(function (p, i) { if (s.ticks[i]) n += p.m == null ? 1 : p.m; });
          s.got = Math.min(n, b.marks); save(); updateSummary(); tot.innerHTML = 'Your mark: <b>' + s.got + ' / ' + b.marks + '</b>';
        }
        total();
      }
      if (m.levels) {
        panel.appendChild(el('p', 'pr-markh', 'Start at Level 1 and climb. Which level does your answer reach? Compare with the examiner’s example for each level.'));
        m.levels.forEach(function (lv, i) {
          var lab = el('label', 'pr-level'), rb = el('input'); rb.type = 'radio'; rb.name = 'lv-' + b.id; rb.checked = s.level === i;
          rb.onchange = function () { s.level = i; s.got = lv.mark; save(); updateSummary(); };
          lab.appendChild(rb);
          lab.appendChild(el('div', null, '<b>' + esc(lv.l) + '</b> <span class="pr-mark">' + esc(lv.m) + '</span><br>' + rich(lv.d) +
            (lv.eg ? '<details><summary>Examiner’s example at this level</summary><p>' + rich(lv.eg) + '</p></details>' : '')));
          panel.appendChild(lab);
        });
      }
      if (m.note) panel.appendChild(el('div', 'pr-ms-note', rich(m.note)));
      if (b.after) panel.appendChild(el('div', 'pr-fb show', rich(b.after)));
    }
    c.appendChild(ta); c.appendChild(count); c.appendChild(bt); c.appendChild(panel);
    if (s.open) showPanel();
    return c;
  };

  R.checklist = function (b) {
    var c = card(b), s = st(b.id); s.ticks = s.ticks || [];
    b.items.forEach(function (t, i) {
      var lab = el('label', 'pr-tick'), cb = el('input'); cb.type = 'checkbox'; cb.checked = !!s.ticks[i];
      cb.onchange = function () { s.ticks[i] = cb.checked; save(); };
      lab.appendChild(cb); lab.appendChild(el('span', null, rich(t))); c.appendChild(lab);
    });
    return c;
  };

  R.oral = function (b) {
    var c = card({ h: b.h || 'Oral check (with a parent, 5 min)' }, 'pr-oral');
    c.appendChild(el('p', 'pr-q', rich(b.q)));
    if (b.note) c.appendChild(el('p', 'pr-note', rich(b.note)));
    return c;
  };

  /* ---------- page ---------- */
  function renderPage(C) {
    document.title = C.title;
    var top = el('header', 'pr-top');
    top.innerHTML = '<p class="pr-kicker">' + esc(C.kicker || '') + '</p><h1>' + esc(C.title) + '</h1>' +
      (C.sub ? '<p class="pr-sub">' + rich(C.sub) + '</p>' : '') +
      (C.skill ? '<div class="pr-skill"><b>This week’s skill:</b> ' + rich(C.skill) + (C.target ? '<br>' + rich(C.target) : '') + '</div>' : '');
    app.appendChild(top);
    (C.sections || []).forEach(function (sec) {
      var s = el('section', 'pr-sec');
      s.appendChild(el('h2', null, esc(sec.h) + (sec.time ? ' <span>' + esc(sec.time) + '</span>' : '')));
      if (sec.sub) s.appendChild(el('p', 'pr-secsub', rich(sec.sub)));
      sec.blocks.forEach(function (b) { var f = R[b.type]; if (f) s.appendChild(f(b)); });
      app.appendChild(s);
    });
    var end = el('section', 'pr-sec');
    end.appendChild(el('h2', null, 'Your marks'));
    var sum = el('div', 'pr-card pr-summary'); sum.id = 'pr-summary'; end.appendChild(sum);
    if (C.print) end.appendChild(el('a', 'pr-btn pr-printlink', '🖨 Open the written paper (PDF)')).href = C.print;
    var reset = el('button', 'pr-link', 'Start again (clears saved answers on this device)'); reset.type = 'button';
    reset.onclick = function () { if (reset.dataset.sure) { state = {}; save(); location.reload(); } else { reset.dataset.sure = 1; reset.textContent = 'Tap again to clear everything'; } };
    end.appendChild(reset);
    app.appendChild(end);
    updateSummary();
  }

  /* ---------- print paper ---------- */
  function lines(n) { var o = ''; for (var i = 0; i < n; i++) o += '<div class="pp-line"></div>'; return o; }
  function renderPaper(C) {
    var P = C.paper; document.title = P.title;
    document.body.classList.add('pp');
    var o = '<header class="pp-head"><div><b>' + esc(P.title) + '</b><br><span>' + rich(P.sub || '') + '</span></div><div class="pp-name">Date: ____________</div></header>';
    if (P.intro) o += '<div class="pp-box">' + rich(P.intro) + '</div>';
    P.blocks.forEach(function (b, i) {
      if (b.type === 'info') { o += '<div class="pp-box' + (b.tone ? ' pp-' + b.tone : '') + (b.pageBreak ? ' pp-break' : '') + '">' + (b.h ? '<h3>' + esc(b.h) + '</h3>' : '') + rich(b.html) + '</div>'; return; }
      if (b.type === 'plan') { o += '<div class="pp-plan">' + (b.h ? '<h3>' + esc(b.h) + '</h3>' : '') + '<table><tr>' + b.cols.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr><tr>' + b.cols.map(function () { return '<td></td>'; }).join('') + '</tr></table></div>'; return; }
      if (b.type === 'table') { o += '<div class="pp-plan">' + (b.h ? '<h3>' + esc(b.h) + '</h3>' : '') + '<table><tr>' + b.cols.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr>' + b.rows.map(function (r) { return '<tr>' + r.map(function (x) { return '<td>' + rich(x) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>'; return; }
      o += '<div class="pp-q' + (b.pageBreak ? ' pp-break' : '') + '">' + head(b) +
        (b.workBox ? '<div class="pp-work" style="height:' + b.workBox + 'mm"><span>Working</span></div>' : '') +
        (b.answerLine ? '<p class="pp-ans">Answer ' + esc(b.answerLine) + '</p>' : '') +
        lines(b.lines || 0) + '</div>';
    });
    if (P.selfcheck) o += '<div class="pp-box pp-break"><h3>Self-check (5 min)</h3>' + P.selfcheck.map(function (t) { return '<p class="pp-cb">☐ ' + rich(t) + '</p>'; }).join('') + '</div>';
    (P.marking || []).forEach(function (m) { o += '<div class="pp-box pp-marking"><h3>' + esc(m.h) + '</h3>' + rich(m.html) + '</div>'; });
    o += '<footer class="pp-foot">' + esc(P.footer || '') + '</footer>';
    app.innerHTML = o;
  }

  fetch(SRC, { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (C) {
    if (PRINT && C.paper) renderPaper(C); else renderPage(C);
    document.documentElement.setAttribute('data-ready', '1');
  }).catch(function (e) { app.innerHTML = '<p class="pr-card">Could not load this page’s questions. Check your connection and reload.</p>'; console.error(e); });
})();
