/* Spelling test engine. Words live in the page itself:
   <script type="application/json" id="sp-data">{ kicker, title, lede, rate?, patterns:[{id,name,tip,eg}], words:[{w,s,p}] }</script>
   <script src="../../../assets/spelling/spelling.js" data-key="<slug>:english:<tool>"></script>
   The device reads each word aloud (British voice), the child types it, wrong words get the tricky letters
   highlighted, the pattern tip, then Look, cover, write. Missed words are saved on the device for a re-test. */
(function () {
  var me = document.currentScript;
  var KEY = (me && me.getAttribute('data-key')) || 'spelling';
  var D = JSON.parse(document.getElementById('sp-data').textContent);
  var app = document.getElementById('app');
  var PAT = {}; D.patterns.forEach(function (p) { PAT[p.id] = p; });
  var WORD = {}; D.words.forEach(function (w) { WORD[w.w] = w; });

  function load(k, d) { try { var v = localStorage.getItem(KEY + ':' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(KEY + ':' + k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // ---- speech ----
  var voice = null, canSpeak = 'speechSynthesis' in window;
  function pickVoice() {
    if (!canSpeak) return;
    var vs = speechSynthesis.getVoices();
    voice = vs.filter(function (v) { return /en-GB/i.test(v.lang); })[0] || vs.filter(function (v) { return /^en/i.test(v.lang); })[0] || null;
  }
  if (canSpeak) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function say(parts) {
    if (!canSpeak) return;
    speechSynthesis.cancel();
    parts.forEach(function (t) {
      var u = new SpeechSynthesisUtterance(t);
      if (voice) u.voice = voice;
      u.lang = 'en-GB'; u.rate = D.rate || 0.85;
      speechSynthesis.speak(u);
    });
  }

  // Letters of the correct word that the attempt missed or got wrong (longest common subsequence).
  function marks(tryW, w) {
    var a = tryW.toLowerCase(), b = w.toLowerCase(), n = a.length, m = b.length, L = [], i, j;
    for (i = 0; i <= n; i++) { L[i] = []; for (j = 0; j <= m; j++) L[i][j] = 0; }
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    var keep = [], x = [];
    for (j = 0; j < m; j++) keep[j] = false;
    for (i = 0; i < n; i++) x[i] = true;
    i = 0; j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { keep[j] = true; x[i] = false; i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
    }
    var good = w.split('').map(function (c, k) { return keep[k] ? esc(c) : '<span class="x">' + esc(c) + '</span>'; }).join('');
    var bad = tryW.split('').map(function (c, k) { return x[k] ? '<s>' + esc(c) + '</s>' : esc(c); }).join('');
    return { good: good, bad: bad };
  }
  function same(a, b) { return a.trim().toLowerCase() === b.toLowerCase(); }
  function gap(w) { return w.s.replace(new RegExp(w.w, 'i'), '_____'); }

  // ---- screens ----
  function home() {
    speechSynthesis && canSpeak && speechSynthesis.cancel();
    var missed = load('missed', []).filter(function (w) { return WORD[w]; });
    var best = load('best', null);
    var h = '<header class="sp-head"><p class="sp-kick">' + esc(D.kicker) + '</p><h1>' + esc(D.title) + '</h1><p class="sp-lede">' + D.lede + '</p></header>';
    h += '<div class="sp-btns"><button class="sp-btn" data-go="all">Start the test (' + D.words.length + ' words)</button>';
    if (missed.length) h += '<button class="sp-btn sp-ghost" data-go="missed">My tricky words (' + missed.length + ')</button>';
    h += '</div>';
    if (best) h += '<p class="sp-note">Best so far: ' + best.score + ' out of ' + best.of + ' first time (' + esc(best.date) + ').</p>';
    if (!canSpeak) h += '<p class="sp-tip">This device can\'t read words aloud. Ask a grown-up to read each word and sentence from the list at the bottom.</p>';
    h += '<h2>The patterns to watch</h2>';
    D.patterns.forEach(function (p) {
      var n = D.words.filter(function (w) { return w.p === p.id; }).length;
      h += '<div class="sp-card sp-pat"><span class="sp-pn">' + esc(p.name) + '</span><p>' + p.tip + '</p>' + (p.eg ? '<p class="sp-eg">' + p.eg + '</p>' : '') +
        '<div class="sp-btns"><button class="sp-btn sp-ghost" data-go="p:' + p.id + '">Just these ' + n + ' words</button></div></div>';
    });
    h += '<details class="sp-card"><summary>Word list for a grown-up (paper test)</summary><ol class="sp-list">' +
      D.words.map(function (w) { return '<li><b>' + esc(w.w) + '</b>: ' + esc(w.s) + '</li>'; }).join('') + '</ol></details>';
    app.innerHTML = h;
    app.querySelectorAll('[data-go]').forEach(function (b) {
      b.onclick = function () {
        var g = b.getAttribute('data-go'), list;
        if (g === 'all') list = D.words;
        else if (g === 'missed') list = missed.map(function (w) { return WORD[w]; });
        else list = D.words.filter(function (w) { return 'p:' + w.p === g; });
        run(shuffle(list), g === 'all');
      };
    });
    window.scrollTo(0, 0);
  }

  function run(list, full) {
    var i = 0, score = 0, wrong = [];
    function word() {
      var w = list[i];
      app.innerHTML = '<header class="sp-head"><p class="sp-kick">' + esc(D.title) + '</p></header>' +
        '<p class="sp-prog">Word ' + (i + 1) + ' of ' + list.length + '</p><div class="sp-bar"><i style="width:' + (100 * i / list.length) + '%"></i></div>' +
        '<div class="sp-card"><div class="sp-btns"><button class="sp-btn" id="hear">🔊 Hear the word</button><button class="sp-btn sp-ghost" id="sent">Hear it in a sentence</button></div>' +
        '<p class="sp-gap">' + esc(gap(w)) + '</p>' +
        '<input class="sp-in" id="in" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Type the word">' +
        '<div class="sp-btns"><button class="sp-btn" id="check">Check</button></div><div id="out"></div></div>' +
        '<div class="sp-btns"><button class="sp-btn sp-ghost" id="quit">Stop and go back</button></div>';
      var inp = document.getElementById('in');
      document.getElementById('hear').onclick = function () { say([w.w]); inp.focus(); };
      document.getElementById('sent').onclick = function () { say([w.w, w.s, w.w]); inp.focus(); };
      document.getElementById('quit').onclick = home;
      say([w.w, w.s, w.w]);
      inp.focus();
      function check() {
        var v = inp.value.trim(); if (!v) return;
        document.getElementById('check').disabled = true; inp.disabled = true;
        if (same(v, w.w)) { score++; inp.classList.add('sp-ok'); setTimeout(next, 700); return; }
        inp.classList.add('sp-no'); wrong.push(w.w);
        var mk = marks(v, w.w), p = PAT[w.p] || {};
        var out = document.getElementById('out');
        out.innerHTML = '<p class="sp-try">You wrote: ' + mk.bad + '</p><p class="sp-word">' + mk.good + '</p>' +
          '<p class="sp-tip"><b>' + esc(p.name || '') + '.</b> ' + (w.t || p.tip || '') + '</p>' +
          '<p><b>Look, cover, write.</b> Look at the word and say the tricky bit. Then cover it and write it.</p>' +
          '<div class="sp-btns"><button class="sp-btn" id="cover">Cover it</button></div><div id="lcw"></div>';
        document.getElementById('cover').onclick = function () {
          out.querySelector('.sp-word').classList.add('sp-hidden');
          this.remove();
          var box = document.getElementById('lcw');
          box.innerHTML = '<input class="sp-in" id="in2" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Write it from memory">' +
            '<div class="sp-btns"><button class="sp-btn" id="c2">Check</button><button class="sp-btn sp-ghost" id="peek">Look again</button></div><p id="r2"></p>';
          var in2 = document.getElementById('in2'); in2.focus();
          document.getElementById('peek').onclick = function () { out.querySelector('.sp-word').classList.toggle('sp-hidden'); in2.focus(); };
          function c2() {
            if (same(in2.value, w.w)) {
              in2.classList.add('sp-ok'); in2.disabled = true;
              document.getElementById('r2').textContent = 'Got it. That word goes on your tricky list for next time.';
              box.querySelector('.sp-btns').innerHTML = '<button class="sp-btn" id="nx">Next word</button>';
              document.getElementById('nx').onclick = next; document.getElementById('nx').focus();
            } else {
              in2.classList.add('sp-no');
              document.getElementById('r2').textContent = 'Not quite. Tap "Look again", then cover it and try once more.';
            }
          }
          document.getElementById('c2').onclick = c2;
          in2.onkeydown = function (e) { if (e.key === 'Enter') c2(); };
        };
      }
      document.getElementById('check').onclick = check;
      inp.onkeydown = function (e) { if (e.key === 'Enter') check(); };
    }
    function next() { i++; if (i < list.length) word(); else done(); }
    function done() {
      var old = load('missed', []), right = list.filter(function (w) { return wrong.indexOf(w.w) < 0; }).map(function (w) { return w.w; });
      var keep = old.filter(function (w) { return right.indexOf(w) < 0 && wrong.indexOf(w) < 0; }).concat(wrong);
      save('missed', keep);
      var d = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      if (full) { var b = load('best', null); if (!b || score >= b.score) save('best', { score: score, of: list.length, date: d }); }
      var h = '<header class="sp-head"><p class="sp-kick">' + esc(D.title) + '</p><h1>Finished</h1></header>' +
        '<div class="sp-card"><p class="sp-big">' + score + ' / ' + list.length + '</p><p>right first time.</p>';
      if (wrong.length) {
        h += '<p>Words to practise again:</p><ul class="sp-list">' + wrong.map(function (w) { return '<li>' + esc(w) + ' <span class="sp-eg">(' + esc((PAT[WORD[w].p] || {}).name || '') + ')</span></li>'; }).join('') + '</ul>' +
          '<p class="sp-note">They\'re saved under "My tricky words". Try them again tomorrow: a word only leaves the list when you get it right first time.</p>';
      } else h += '<p>Every word right. Brilliant.</p>';
      h += '</div><div class="sp-btns">' + (wrong.length ? '<button class="sp-btn" id="again">Try the missed words now</button>' : '') + '<button class="sp-btn sp-ghost" id="home">Back to the start</button></div>';
      app.innerHTML = h; window.scrollTo(0, 0);
      document.getElementById('home').onclick = home;
      if (wrong.length) document.getElementById('again').onclick = function () { run(shuffle(wrong.map(function (w) { return WORD[w]; })), false); };
    }
    word();
  }

  home();
})();
