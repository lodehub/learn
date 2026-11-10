/* Reading shelf: articles to read, made easy to read.
   One JSON file per shelf (data-content), two kinds of item:
     kind "full"  : the article text lives here (openly licensed only, e.g. CC BY-NC-SA), shown in a reader
     kind "guide" : copyrighted article: a link to the original plus our own reading guide
   Routes: #/ = shelf, #/<id> = one item. Notes are saved on the device and sent with LearnSend. See README.md. */
(function () {
  'use strict';
  var me = document.currentScript, SRC = me.getAttribute('data-content') || 'reading.json';
  var KEY = me.getAttribute('data-key') || 'reading';
  var app = document.getElementById('app'), DATA = null;

  function load(k, d) { try { var v = localStorage.getItem(KEY + ':' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function keep(k, v) { try { localStorage.setItem(KEY + ':' + k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function el(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }

  /* ---------- text size (saved per device) ---------- */
  var SIZES = [17, 19, 21, 24], size = load('size', 1);
  function applySize() { document.documentElement.style.setProperty('--rd-size', SIZES[size] + 'px'); }
  applySize();

  /* ---------- glossary: first use of each key word becomes a tap-to-explain button ---------- */
  function gloss(html, words, used) {
    (words || []).forEach(function (w, i) {
      if (used[i]) return;
      var re = new RegExp('(^|[^\\w>])(' + w.w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:s|es)?)(?![\\w])', 'i');
      var parts = html.split(/(<[^>]+>)/), done = false;
      for (var j = 0; j < parts.length && !done; j++) {
        if (parts[j].charAt(0) === '<') continue;
        if (re.test(parts[j])) {
          parts[j] = parts[j].replace(re, function (m, pre, word) { return pre + '<button type="button" class="rd-term" data-i="' + i + '">' + word + '</button>'; });
          done = true;
        }
      }
      if (done) { used[i] = true; html = parts.join(''); }
    });
    return html;
  }
  function wireTerms(root, words) {
    root.addEventListener('click', function (ev) {
      var b = ev.target.closest('.rd-term'); if (!b) return;
      var next = b.nextElementSibling;
      if (next && next.classList.contains('rd-def')) { next.remove(); b.classList.remove('on'); return; }
      var w = words[+b.getAttribute('data-i')];
      var d = el('span', 'rd-def', '<b>' + esc(w.w) + ':</b> ' + w.d); b.classList.add('on');
      b.insertAdjacentElement('afterend', d);
    });
  }

  /* ---------- shelf ---------- */
  function shelf() {
    document.title = DATA.title;
    app.innerHTML = '';
    var head = el('header', 'rd-head');
    head.innerHTML = '<p class="rd-kick">' + esc(DATA.kicker || '') + '</p><h1>' + esc(DATA.title) + '</h1>' + (DATA.sub ? '<p class="rd-lede">' + DATA.sub + '</p>' : '');
    app.appendChild(head);
    if (DATA.how) app.appendChild(el('div', 'rd-how', DATA.how));
    var read = load('read', {});
    var topics = [];
    DATA.items.forEach(function (it) { if (topics.indexOf(it.topic) < 0) topics.push(it.topic); });
    topics.forEach(function (t) {
      app.appendChild(el('h2', 'rd-topic', esc(t)));
      DATA.items.filter(function (it) { return it.topic === t; }).forEach(function (it) {
        var a = el('a', 'rd-card' + (read[it.id] ? ' rd-done' : ''));
        a.href = '#/' + it.id;
        a.innerHTML = '<span class="rd-badge ' + (it.kind === 'full' ? 'rd-b-full' : 'rd-b-guide') + '">' + (it.kind === 'full' ? 'Read it here' : 'Reading guide + link') + '</span>' +
          (read[it.id] ? '<span class="rd-tick" aria-label="read">✓ read</span>' : '') +
          '<b class="rd-ct">' + esc(it.title) + '</b>' +
          '<span class="rd-cm">' + esc(it.author) + ' · ' + esc(it.source) + (it.year ? ', ' + esc(it.year) : '') + ' · about ' + esc(it.minutes) + ' min</span>' +
          (it.why ? '<span class="rd-cw">' + it.why + '</span>' : '');
        app.appendChild(a);
      });
    });
    if (DATA.footer) app.appendChild(el('p', 'rd-foot', DATA.footer));
    window.scrollTo(0, 0);
  }

  /* ---------- one item ---------- */
  function item(it) {
    document.title = it.title;
    app.innerHTML = '';
    var bar = el('div', 'rd-bar');
    bar.innerHTML = '<a class="rd-backlink" href="#/">← All articles</a><span class="rd-sz"><button type="button" data-d="-1" aria-label="Smaller text">A−</button><button type="button" data-d="1" aria-label="Bigger text">A+</button></span>';
    bar.addEventListener('click', function (e) { var b = e.target.closest('button[data-d]'); if (!b) return; size = Math.max(0, Math.min(SIZES.length - 1, size + +b.getAttribute('data-d'))); keep('size', size); applySize(); });
    app.appendChild(bar);

    var art = el('article', 'rd-art');
    art.innerHTML = '<p class="rd-kick">' + esc(it.topic) + '</p><h1>' + esc(it.title) + '</h1>' +
      '<p class="rd-by">' + esc(it.author) + ' · ' + esc(it.source) + (it.year ? ', ' + esc(it.year) : '') + ' · about ' + esc(it.minutes) + ' min</p>' +
      (it.level ? '<p class="rd-level">' + it.level + '</p>' : '');

    if (it.readFor && it.readFor.length) art.appendChild(el('div', 'rd-box rd-for', '<h3>Read for</h3><ol>' + it.readFor.map(function (q) { return '<li>' + q + '</li>'; }).join('') + '</ol>'));
    if (it.words && it.words.length) {
      var kw = el('details', 'rd-box rd-words'); kw.open = it.kind !== 'full' || it.words.length <= 6;
      kw.innerHTML = '<summary>Key words (' + it.words.length + ')</summary><dl>' + it.words.map(function (w) { return '<dt>' + esc(w.w) + '</dt><dd>' + w.d + '</dd>'; }).join('') + '</dl>' +
        (it.kind === 'full' ? '<p class="rd-note">In the article, tap an <span class="rd-term-eg">underlined word</span> to see what it means.</p>' : '');
      art.appendChild(kw);
    }

    if (it.kind === 'full') {
      var body = el('div', 'rd-text'), used = {};
      var list = null;
      it.text.forEach(function (b) {
        var tag = b[0], html = gloss(b[1], it.words, used);
        if (tag === 'li') { if (!list) { list = el('ul'); body.appendChild(list); } list.appendChild(el('li', null, html)); return; }
        list = null;
        body.appendChild(el(tag === 'h2' ? 'h2' : tag === 'blockquote' ? 'blockquote' : 'p', null, html));
      });
      wireTerms(body, it.words);
      art.appendChild(body);
    } else {
      if (it.intro) art.appendChild(el('p', 'rd-intro', it.intro));
      if (it.points) art.appendChild(el('div', 'rd-box rd-points', '<h3>The main points, in plain English</h3><ol>' + it.points.map(function (p) { return '<li>' + p + '</li>'; }).join('') + '</ol>'));
      if (it.facts) art.appendChild(el('div', 'rd-box rd-facts', '<h3>Facts you can use as evidence</h3><ul>' + it.facts.map(function (f) { return '<li><i>' + esc(f[0]) + '</i> ' + f[1] + '</li>'; }).join('') + '</ul>'));
      if (it.quote) art.appendChild(el('blockquote', 'rd-quote', it.quote));
    }
    if (it.debate) art.appendChild(el('div', 'rd-box rd-debate', '<h3>Historians disagree</h3>' + it.debate));
    if (it.url) art.appendChild(el('p', 'rd-orig', '<a href="' + esc(it.url) + '" target="_blank" rel="noopener">' + (it.kind === 'full' ? 'See the original article (with pictures)' : 'Read the whole article on ' + esc(it.source)) + ' ↗</a>'));

    // notebook: her own So What, saved on the device and sent to the parent's sheet
    var notes = load('notes', {}), nb = el('div', 'rd-box rd-nb');
    nb.innerHTML = '<h3>Your notebook</h3><p>' + (it.note || 'Write one thing you learned, then: <b>so what</b> does it tell us about what people wanted, feared or believed?') + '</p>';
    var ta = el('textarea'); ta.rows = 5; ta.placeholder = 'Write in full sentences.'; ta.value = notes[it.id] || '';
    var timer = null;
    ta.oninput = function () {
      notes[it.id] = ta.value; keep('notes', notes);
      clearTimeout(timer); timer = setTimeout(function () { sendNote(it, ta.value); }, 4000);
    };
    nb.appendChild(ta);
    var done = el('button', 'rd-btn', load('read', {})[it.id] ? '✓ Marked as read' : 'I have read it'); done.type = 'button';
    done.onclick = function () { var r = load('read', {}); r[it.id] = new Date().toISOString().slice(0, 10); keep('read', r); done.textContent = '✓ Marked as read'; sendNote(it, ta.value, true); };
    nb.appendChild(done);
    art.appendChild(nb);

    if (it.credit) art.appendChild(el('p', 'rd-credit', it.credit));
    app.appendChild(art);
    window.scrollTo(0, 0);
  }

  function sendNote(it, text, finished) {
    var S = window.LearnSend; if (!S || !S.enabled()) return;
    S.put('note:' + it.id, { type: 'note', q: 'Reading: ' + it.title + ' (notebook)', answer: text || '', result: finished ? 'marked as read' : 'note', source: it.source });
    if (finished) S.flush();
  }

  function route() {
    var id = decodeURIComponent((location.hash || '').replace(/^#\/?/, ''));
    var it = id && DATA.items.filter(function (x) { return x.id === id; })[0];
    if (it) item(it); else shelf();
  }

  fetch(SRC, { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (d) {
    DATA = d;
    if (window.LearnSend) window.LearnSend.init({ key: KEY, title: d.title, kind: 'explore' });
    window.addEventListener('hashchange', route);
    route();
    document.documentElement.setAttribute('data-ready', '1');
  }).catch(function (e) { app.innerHTML = '<p class="rd-box">Could not load the reading shelf. Check your connection and reload.</p>'; console.error(e); });
})();
