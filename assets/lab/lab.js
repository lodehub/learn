/* Language Lab: one engine for every language.
   blueprint.json holds the stages, sentence frames and word ids (the same for every language);
   <lang>.json holds that language's words, phrases, frames and tips.
   A frame + the words you know = endless new sentences to practise.
   Used by /<slug>/<subject>/<tool>/index.html with:
   <script src="../../../assets/lab/lab.js" data-lang="french"></script> */
(function () {
  'use strict';

  var script = document.currentScript;
  var LANG = script.getAttribute('data-lang');
  var BASE = script.src.replace(/[^/]*$/, '');
  var app = document.getElementById('app');

  // Progress lives under "<slug>:<subject>:<tool>:" (see learner.js).
  var SLUG = Learner.slug;
  var KEY = Learner.key('state');

  var D;                // prepared data
  var S = load();       // saved progress
  var session = null;   // the practice round in progress

  /* ---------- small helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function today() { var d = new Date(); return Math.floor((d - d.getTimezoneOffset() * 60000) / 864e5); }
  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* private mode */ }
    s = s || {};
    s.stages = s.stages || {};
    s.sr = s.sr || {};
    s.settings = s.settings || { py: true };
    return s;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

  /* ---------- spaced repetition: a box per item, higher box = longer gap ---------- */
  var GAPS = [0, 1, 2, 4, 7, 14, 30];
  function mark(id, ok) {
    var r = S.sr[id] || { b: 0, d: 0 };
    r.b = ok ? Math.min(r.b + 1, GAPS.length - 1) : 0;
    r.d = today() + (ok ? GAPS[r.b] : 0);
    S.sr[id] = r;
    save();
  }
  function known(id) { return (S.sr[id] || {}).b >= 2; }

  /* ---------- data ---------- */
  function prepare(bp, lang) {
    var d = { bp: bp, lang: lang, zh: lang.code === 'zh', stages: bp.stages, si: {}, byId: {} };
    bp.stages.forEach(function (s, i) { d.si[s.id] = i; });
    d.words = bp.words.filter(function (w) { return lang.words[w.id] != null; }).map(function (w) {
      var o = { kind: 'w', id: w.id, stage: w.stage, si: d.si[w.stage], tags: w.tags,
        en: typeof w.en === 'string' ? { w: w.en } : w.en, t: lang.words[w.id] };
      d.byId[w.id] = o;
      return o;
    });
    d.phrases = bp.phrases.filter(function (p) { return lang.phrases[p.id]; }).map(function (p) {
      return { kind: 'p', id: p.id, stage: p.stage, si: d.si[p.stage], en: p.en, t: lang.phrases[p.id] };
    });
    d.frames = bp.frames.filter(function (f) { return lang.frames[f.id]; }).map(function (f) {
      return { kind: 'f', id: f.id, stage: f.stage, si: d.si[f.stage], en: f.en, t: lang.frames[f.id], slots: f.slots };
    });
    return d;
  }
  function itemKey(it) { return it.kind + ':' + it.id; }
  function ofStage(list, id) { return list.filter(function (x) { return x.stage === id; }); }
  function stageById(id) { return D.stages.filter(function (s) { return s.id === id; })[0]; }
  function started(id) { var s = S.stages[id]; return !!(s && (s.learn || s.build != null || s.quiz != null)); }
  function reach() { // furthest stage started: frames draw words from everything up to here
    var m = 0;
    D.stages.forEach(function (s, i) { if (started(s.id)) m = i; });
    return m;
  }
  function stars(id) {
    var s = S.stages[id] || {};
    return (s.learn ? 1 : 0) + (s.build >= 6 ? 1 : 0) + (s.quiz >= 6 ? 1 : 0);
  }

  /* ---------- templates: "{slot.form~agree@obj}" or "{=wordId~agree}" ---------- */
  function tokens(tpl) {
    var re = /\{([^}]+)\}/g, out = [], last = 0, m;
    while ((m = re.exec(tpl))) {
      if (m.index > last) out.push({ lit: tpl.slice(last, m.index) });
      var p = m[1].match(/^(=?)([a-z_]+)(?:\.([a-z]+))?(?:~([a-z]+))?(?:@([a-z]+))?$/i);
      out.push({ tok: { fixed: !!p[1], slot: p[2], form: p[3], agree: p[4], obj: p[5] } });
      last = re.lastIndex;
    }
    if (last < tpl.length) out.push({ lit: tpl.slice(last) });
    return out;
  }
  function itemOf(tk, f) { return tk.fixed ? D.byId[tk.slot] : f[tk.slot]; }

  // English
  function enPlural(w) {
    if (/(s|sh|ch|x)$/.test(w)) return w + 'es';
    if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies';
    return w + 's';
  }
  function enTok(tk, f) {
    var e = itemOf(tk, f).en;
    if (tk.obj) return e.w + ' the ' + f[tk.obj].en.w;
    if (e.base) return e[tk.agree ? f[tk.agree].en.per : (tk.form || 'base')] || e.base;
    switch (tk.form) {
      case 'the': return 'the ' + e.w;
      case 'a': return (e.mass ? 'some ' : 'a ') + e.w;
      case 'gen': return e.gen || (e.mass ? e.w : (e.pl || enPlural(e.w)));
      case 'to': return e.to || 'to the ' + e.w;
      default: return e.w;
    }
  }
  function enRender(tpl, f) {
    var s = tokens(tpl).map(function (x) { return x.lit != null ? x.lit : enTok(x.tok, f); }).join('');
    return cap(s.replace(/\b([Aa]) ([aeiou])/g, '$1n $2'));
  }

  // French
  var VOWEL = /^[aeiouyàâäéèêëîïôöûùüœ]/i;
  function frNoun(it, form) {
    var t = it.t, w = t.w, el = t.el != null ? t.el : VOWEL.test(w), fem = t.g === 'f';
    if (t.forms && t.forms[form]) return t.forms[form];
    var le = el ? "l'" + w : (fem ? 'la ' : 'le ') + w;
    var some = el ? "de l'" + w : (fem ? 'de la ' : 'du ') + w;
    switch (form) {
      case 'le': return le;
      case 'un': return t.mass ? some : (fem ? 'une ' : 'un ') + w;
      case 'gen': return t.mass ? le : 'les ' + (t.pl || w + 's');
      case 'de': return (el ? "d'" : 'de ') + w;
      case 'a': return el ? "à l'" + w : (fem ? 'à la ' : 'au ') + w;
      case 'dele': return some;
      default: return w;
    }
  }
  function frTok(tk, f) {
    var it = itemOf(tk, f), t = it.t;
    if (tk.obj) return t.w + ' ' + frNoun(f[tk.obj], t.mode);
    if (typeof t === 'string') return t;
    if (t.inf) return t[tk.agree ? f[tk.agree].t.per : (tk.form || 'inf')] || t.inf;
    if (t.m) return tk.agree && f[tk.agree].t.g === 'f' ? (t.f || t.m) : t.m;
    if (t.per) return t.w;
    return frNoun(it, tk.form);
  }
  function frText(tpl, f) {
    return cap(tokens(tpl).map(function (x) { return x.lit != null ? x.lit : frTok(x.tok, f); }).join(''));
  }
  // Words and punctuation as segments: { t } or { t, punct, sp } (sp = space before, as in French " ?").
  function frSegs(s) {
    var out = [];
    s.trim().split(/\s+/).forEach(function (c) {
      if (/^[?!:;]$/.test(c)) { out.push({ t: c, punct: true, sp: true }); return; }
      var m = c.match(/^(.*?)([,.]?)$/);
      if (m[1]) out.push({ t: m[1] });
      if (m[2]) out.push({ t: m[2], punct: true });
    });
    return out;
  }

  // Mandarin: "汉字|pinyin" chunks; a bare latin chunk continues the previous pinyin.
  function zhSegs(str) {
    var out = [];
    String(str).trim().split(/\s+/).forEach(function (c) {
      if (!c) return;
      var i = c.indexOf('|');
      if (i >= 0) out.push({ t: c.slice(0, i), p: c.slice(i + 1) });
      else if (/^[　-〿＀-￯…]+$/.test(c)) out.push({ t: c, punct: true });
      else if (out.length) out[out.length - 1].p += ' ' + c;
    });
    return out;
  }
  function zhWord(it) { return zhSegs(typeof it.t === 'string' ? it.t : it.t.s); }
  function yi(p) { return /[àèìòùǜ]/.test(p) ? 'yí' : 'yì'; } // 一 changes tone before a 4th tone
  function zhTok(tk, f) {
    var it = itemOf(tk, f);
    if (tk.obj) return zhWord(f[tk.obj]).concat(zhSegs(it.t.post));
    if (tk.form === 'one') {
      var mw = zhSegs(it.t.mw || '个|gè')[0];
      return [{ t: '一' + mw.t, p: yi(mw.p) + ' ' + mw.p }];
    }
    return zhWord(it);
  }
  function zhRender(tpl, f) {
    var out = [];
    tokens(tpl).forEach(function (x) { out = out.concat(x.lit != null ? zhSegs(x.lit) : zhTok(x.tok, f)); });
    return out;
  }

  /* ---------- making sentences ---------- */
  function pool(spec, max, used) {
    var tags = spec.split('|');
    var list = D.words.filter(function (w) {
      return used.indexOf(w.id) < 0 && w.tags.some(function (t) { return tags.indexOf(t) >= 0; });
    });
    var near = list.filter(function (w) { return w.si <= max; });
    return near.length ? near : list;
  }
  function fills(frame) {
    var max = Math.max(frame.si, reach()), f = {}, used = [];
    Object.keys(frame.slots).forEach(function (k) {
      f[k] = pick(pool(frame.slots[k], max, used));
      used.push(f[k].id);
    });
    return f;
  }
  // gen(item) -> { en, segs } for a frame (freshly filled) or a fixed phrase.
  function gen(it) {
    if (it.kind === 'p') return { en: it.en, segs: D.zh ? zhSegs(it.t) : frSegs(it.t) };
    var f = fills(it);
    return { en: enRender(it.en, f), segs: D.zh ? zhRender(it.t, f) : frSegs(frText(it.t, f)) };
  }
  function segText(segs) {
    return segs.map(function (s, i) {
      if (D.zh) return s.t;
      return (i && (!s.punct || s.sp) ? ' ' : '') + s.t;
    }).join('');
  }
  var PUNCT_PY = { '，': ',', '。': '.', '？': '?', '！': '!' };
  function segPy(segs) {
    return cap(segs.map(function (s, i) {
      return s.punct ? (PUNCT_PY[s.t] || '') : (i ? ' ' : '') + s.p;
    }).join(''));
  }

  /* ---------- showing target-language text ---------- */
  var LANGATTR = function () { return D.zh ? 'zh-Hans' : D.lang.code; };
  function sentenceHTML(segs, big) {
    var cls = 'tl' + (big ? ' big' : '');
    if (!D.zh) return '<span class="' + cls + '" lang="' + LANGATTR() + '">' + esc(segText(segs)) + '</span>';
    return '<span class="' + cls + ' zh" lang="zh-Hans">' + segs.map(function (s, i) {
      if (s.punct) return '<span class="w"><span class="h">' + esc(s.t) + '</span><span class="p">&nbsp;</span></span>';
      return '<span class="w"><span class="h">' + esc(s.t) + '</span><span class="p">' + esc(i ? s.p : cap(s.p)) + '</span></span>';
    }).join('') + '</span>';
  }
  function wordSegs(it) {
    var t = it.t;
    if (t.show) { var i = t.show.indexOf('|'); return [{ t: t.show.slice(0, i), p: t.show.slice(i + 1) }]; }
    if (t.post) return zhSegs(t.post);
    return zhWord(it);
  }
  function wordFr(it) {
    var t = it.t;
    if (typeof t === 'string') return t;
    if (t.inf) return t.inf + (t.je ? ' · ' + t.je : '');
    if (t.m) return t.m + (t.f && t.f !== t.m ? ' / ' + t.f : '');
    if (t.mode) return t.show || t.w;
    if (t.per) return t.w;
    return frNoun(it, 'un');
  }
  function wordHTML(it, big) {
    if (D.zh) {
      // Nouns show their measure word too: 狗 (一只).
      var mw = it.t.mw && zhTok({ form: 'one', slot: 'x' }, { x: it });
      return sentenceHTML(wordSegs(it), big) + (mw ? ' <span class="mw" lang="zh-Hans">' + esc(mw[0].t) + ' <span class="p">' + esc(mw[0].p) + '</span></span>' : '');
    }
    return '<span class="tl' + (big ? ' big' : '') + '" lang="' + LANGATTR() + '">' + esc(wordFr(it)) + '</span>';
  }
  function wordEn(it) { return it.en.w || it.en.base; }
  function itemHTML(it, g, big) { return it.kind === 'w' ? wordHTML(it, big) : sentenceHTML(g.segs, big); }
  function itemEn(it, g) { return it.kind === 'w' ? wordEn(it) : g.en; }

  // A frame as a pattern with labelled gaps: "Je veux [food / drink]".
  function patternHTML(fr) {
    var labels = D.bp.pools;
    function chip(tk, lang) {
      var it = tk.fixed && D.byId[tk.slot];
      if (it) {
        if (lang === 'en') return esc(it.en.s + ' / ' + it.en.base);
        if (D.zh) return esc(segText(zhWord(it)));
        return esc(it.t.il + ' / ' + it.t.nous);
      }
      var spec = fr.slots[tk.slot] || '';
      var name = spec.split('|').map(function (t) { return labels[t] || t; }).join(' / ');
      if (tk.obj) name += ' + ' + (labels[fr.slots[tk.obj]] || fr.slots[tk.obj]);
      if (D.zh && tk.form === 'one' && lang !== 'en') name = '一 + measure word';
      return '<span class="gap">' + esc(name) + '</span>';
    }
    function side(tpl, lang) {
      return tokens(tpl).map(function (x) {
        if (x.tok) return chip(x.tok, lang);
        if (lang !== 'en' && D.zh) return esc(segText(zhSegs(x.lit)));
        return esc(x.lit);
      }).join('');
    }
    return '<div class="pattern"><div class="tl" lang="' + LANGATTR() + '">' + side(fr.t, 'tl') + '</div>' +
      '<div class="en">' + side(fr.en, 'en') + '</div></div>';
  }

  /* ---------- questions ---------- */
  function tileText(s, i) { return D.zh ? s.t : (i === 0 ? s.t.charAt(0).toLowerCase() + s.t.slice(1) : s.t); }
  function distractors(avoid, n) {
    var cands = [];
    D.words.filter(function (w) { return w.si <= Math.max(reach(), 1); }).forEach(function (w) {
      (D.zh ? zhWord(w) : frSegs(wordFr(w).split(' · ')[0])).forEach(function (s) {
        if (!s.punct && !/[\/…]/.test(s.t) && avoid.indexOf(s.t.toLowerCase()) < 0) cands.push(s);
      });
    });
    var out = [], seen = {};
    shuffle(cands).forEach(function (s) { if (out.length < n && !seen[s.t]) { seen[s.t] = 1; out.push(s); } });
    return out;
  }
  function makeBuild(it) {
    var g = gen(it);
    var target = g.segs.map(function (s, i) { return s.punct ? null : { t: tileText(s, i), p: s.p }; }).filter(Boolean);
    var bank = shuffle(target.concat(distractors(target.map(function (s) { return s.t.toLowerCase(); }), 2)));
    return { type: 'build', it: it, g: g, target: target, bank: bank, picked: [] };
  }
  function makeQuiz(it) {
    var g = it.kind === 'w' ? null : gen(it);
    var right = { it: it, g: g, en: itemEn(it, g) };
    var others = [], seen = {};
    seen[right.en] = 1;
    function add(o) { if (others.length < 3 && !seen[o.en]) { seen[o.en] = 1; others.push(o); } }
    if (it.kind === 'w') {
      var lvl = stageById(it.stage).level;
      var same = D.words.filter(function (w) { return w !== it && stageById(w.stage).level === lvl; });
      shuffle(same).forEach(function (w) { add({ it: w, en: wordEn(w) }); });
      shuffle(D.words).forEach(function (w) { add({ it: w, en: wordEn(w) }); });
    } else {
      // Same frame, different words: you have to notice the word that changed.
      if (it.kind === 'f') for (var k = 0; k < 25 && others.length < 3; k++) { var x = gen(it); add({ it: it, g: x, en: x.en }); }
      var near = D.frames.concat(D.phrases).filter(function (o) { return o !== it && o.stage === it.stage; });
      var far = D.frames.concat(D.phrases).filter(function (o) { return o !== it && o.si <= Math.max(reach(), it.si); });
      shuffle(near).concat(shuffle(far)).forEach(function (o) { var y = gen(o); add({ it: o, g: y, en: y.en }); });
    }
    var toEn = it.kind === 'w' ? Math.random() < 0.75 : Math.random() < 0.5;
    return { type: 'quiz', it: it, right: right, toEn: toEn, opts: shuffle([right].concat(others)), done: false };
  }
  function makeSay(it) { return { type: 'say', it: it, g: it.kind === 'w' ? null : gen(it), shown: false }; }

  /* ---------- sessions ---------- */
  function startSession(kind, stageId) {
    var qs = [], st = stageId && stageById(stageId);
    if (stageId) {
      var here = ofStage(D.frames, stageId).concat(ofStage(D.phrases, stageId));
      var words = ofStage(D.words, stageId);
      var earlier = D.frames.concat(D.phrases).filter(function (x) { return x.si < st.n - 1 && started(x.stage); });
      var src;
      if (kind === 'quiz') src = shuffle(words).slice(0, 4).concat(shuffle(here));
      else if (kind === 'say') src = shuffle(here).concat(shuffle(words));
      else src = shuffle(here);
      var list = [];
      while (list.length < 8 && src.length) list = list.concat(src);
      list = list.slice(0, kind === 'say' ? 8 : 6);
      // Keep two from earlier stages in every round: that is where the repetition comes from.
      list = list.concat(shuffle(earlier).slice(0, 2));
      while (list.length < 8 && here.length) list.push(pick(here));
      list = list.slice(0, 8);
      qs = (kind === 'quiz' || kind === 'say') ? shuffle(list) : list;
      qs = qs.map(function (it) {
        if (kind === 'say') return makeSay(it);
        if (kind === 'quiz' || it.kind === 'w') return makeQuiz(it);
        return makeBuild(it);
      });
    } else {
      // Review: the items most due, from every stage you have started.
      var all = D.words.concat(D.frames, D.phrases).filter(function (x) { return started(x.stage); });
      var t = today();
      all = shuffle(all).sort(function (a, b) {
        var ra = S.sr[itemKey(a)] || { b: 0, d: t }, rb = S.sr[itemKey(b)] || { b: 0, d: t };
        return (ra.d - rb.d) || (ra.b - rb.b);
      }).slice(0, 10);
      qs = shuffle(all).map(function (it, i) {
        if (it.kind === 'w') return i % 3 === 2 ? makeSay(it) : makeQuiz(it);
        return [makeBuild, makeQuiz, makeSay][i % 3](it);
      });
    }
    session = { kind: kind, stage: stageId, qs: qs, i: 0, score: 0 };
    // Replace the "start" link in history so Back doesn't restart the round.
    if (location.hash === '#/play') { play(); window.scrollTo(0, 0); }
    else location.replace('#/play');
  }

  /* ---------- screens ---------- */
  function bar(title, back) {
    var py = D.zh ? '<button type="button" class="chip" id="py" aria-pressed="' + !!S.settings.py + '">Pinyin</button>' : '';
    return '<div class="bar"><a class="back" href="' + back + '" aria-label="Back">&#8592;</a><h1>' + esc(title) + '</h1>' + py + '</div>';
  }
  function bindBar() {
    var b = document.getElementById('py');
    if (b) b.onclick = function () { S.settings.py = !S.settings.py; save(); applyPy(); b.setAttribute('aria-pressed', S.settings.py); };
  }
  function applyPy() { document.body.classList.toggle('nopy', D.zh && !S.settings.py); }
  function starHTML(n) {
    return '<span class="stars" aria-label="' + n + ' of 3 stars">' +
      [0, 1, 2].map(function (i) { return '<span class="' + (i < n ? 'on' : '') + '">★</span>'; }).join('') + '</span>';
  }

  function home() {
    var t = today();
    var due = D.words.concat(D.frames, D.phrases).filter(function (x) {
      var r = S.sr[itemKey(x)]; return r && r.d <= t;
    }).length;
    var any = D.stages.some(function (s) { return started(s.id); });
    var knownN = D.words.filter(function (w) { return known('w:' + w.id); }).length;
    var html = bar(D.lang.lab, Learner.back);
    html += '<p class="lead">Learn ' + esc(D.lang.name) + ' one sentence pattern at a time. Each stage adds a frame and a handful of words; old frames keep coming back with your new words.</p>';
    html += '<div class="cards">';
    if (any) html += '<a class="card go" href="#/review"><span class="big-emoji">🔁</span><span><b>Review</b><br><span class="muted">' +
      (due ? due + ' ready to practise again' : 'Nothing due. Extra practice?') + '</span></span></a>';
    html += '<a class="card go" href="#/words"><span class="big-emoji">📚</span><span><b>My words</b><br><span class="muted">' +
      knownN + ' of ' + D.words.length + ' known</span></span></a>';
    html += '<a class="card go" href="#/how"><span class="big-emoji">🧱</span><span><b>How it works</b><br><span class="muted">The building blocks</span></span></a>';
    html += '</div>';
    var next = D.stages.filter(function (s) { return stars(s.id) < 3; })[0];
    D.bp.levels.forEach(function (lv) {
      var ss = D.stages.filter(function (s) { return s.level === lv.id; });
      var wn = D.words.filter(function (w) { return stageById(w.stage).level === lv.id; }).length;
      html += '<h2 class="lvl">Level ' + lv.id + ': ' + esc(lv.title) + ' <span>' + wn + ' words</span></h2><p class="muted small">' + esc(lv.blurb) + '</p><ul class="stages">';
      html += ss.map(function (s) {
        return '<li><a class="stage' + (next === s ? ' next' : '') + '" href="#/stage/' + s.id + '"><span class="big-emoji">' + s.emoji + '</span>' +
          '<span class="name"><span class="muted small">Stage ' + s.n + (next === s ? ' · up next' : '') + '</span><br>' + esc(s.title) + '</span>' + starHTML(stars(s.id)) + '</a></li>';
      }).join('') + '</ul>';
    });
    app.innerHTML = html;
    bindBar();
  }

  function stagePage(id) {
    var s = stageById(id);
    if (!s) return home();
    var tips = (D.lang.tips || {})[id] || [];
    var st = S.stages[id] || {};
    var html = bar(s.emoji + ' ' + s.title, '#/');
    html += '<p class="lead">' + esc(s.idea) + '</p>';
    html += '<ul class="modes">' +
      mode('#/learn/' + id, '👀', 'Learn', 'Words and sentence patterns', st.learn ? '★ done' : '') +
      mode('#/start/build/' + id, '🧩', 'Build', 'Tap the words into order', st.build != null ? 'best ' + st.build + '/8' : '') +
      mode('#/start/quiz/' + id, '✅', 'Quiz', 'Pick the right meaning', st.quiz != null ? 'best ' + st.quiz + '/8' : '') +
      mode('#/start/say/' + id, '🗣️', 'Say it', 'Say it out loud, then check', '') + '</ul>';
    html += '<p class="muted small">A star each for Learn, Build (6/8 or more) and Quiz (6/8 or more).</p>';
    if (tips.length) html += '<div class="tips"><h2>' + esc(D.lang.name) + ' tips</h2><ul>' + tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
    app.innerHTML = html;
    bindBar();
  }
  function mode(href, emoji, title, sub, badge) {
    return '<li><a class="mode" href="' + href + '"><span class="big-emoji">' + emoji + '</span><span class="name"><b>' + title + '</b><br><span class="muted small">' + sub +
      '</span></span>' + (badge ? '<span class="badge">' + badge + '</span>' : '') + '</a></li>';
  }

  function learnPage(id) {
    var s = stageById(id);
    if (!s) return home();
    S.stages[id] = S.stages[id] || {};
    if (!S.stages[id].learn) { S.stages[id].learn = 1; save(); }
    var words = ofStage(D.words, id), frames = ofStage(D.frames, id), phrases = ofStage(D.phrases, id);
    var html = bar('Learn: ' + s.title, '#/stage/' + id);
    if (frames.length) {
      html += '<h2>Sentence patterns</h2><p class="muted small">The pattern stays the same. Swap in any word that fits the gap.</p>';
      html += frames.map(function (f) {
        return '<div class="card frame" data-f="' + f.id + '">' + patternHTML(f) + '<div class="ex"></div>' +
          '<button type="button" class="chip more">🔀 Another one</button></div>';
      }).join('');
    }
    if (phrases.length) {
      html += '<h2>Ready-made phrases</h2><ul class="vocab">' + phrases.map(function (p) {
        return '<li>' + sentenceHTML(gen(p).segs) + '<span class="en">' + esc(p.en) + '</span></li>';
      }).join('') + '</ul>';
    }
    if (words.length) {
      html += '<h2>New words <span class="muted small">' + words.length + '</span></h2><ul class="vocab">' + words.map(function (w) {
        return '<li>' + wordHTML(w) + '<span class="en">' + esc(wordEn(w)) + '</span></li>';
      }).join('') + '</ul>';
    }
    html += '<div class="actions"><a class="btn" href="#/start/build/' + id + '">Now build some 🧩</a></div>';
    app.innerHTML = html;
    bindBar();
    Array.prototype.forEach.call(app.querySelectorAll('.frame'), function (card) {
      var f = D.frames.filter(function (x) { return x.id === card.getAttribute('data-f'); })[0];
      function fill() {
        var seen = {}, rows = [];
        for (var k = 0; k < 12 && rows.length < 3; k++) {
          var g = gen(f);
          if (!seen[g.en]) { seen[g.en] = 1; rows.push('<li>' + sentenceHTML(g.segs) + '<span class="en">' + esc(g.en) + '</span></li>'); }
        }
        card.querySelector('.ex').innerHTML = '<ul class="vocab">' + rows.join('') + '</ul>';
      }
      fill();
      card.querySelector('.more').onclick = fill;
    });
  }

  function wordsPage() {
    var html = bar('My words', '#/');
    html += '<p class="lead">A word counts as known once you have got it right in two separate goes. Starter pack first, then the next 50, then the next.</p>';
    D.bp.levels.forEach(function (lv) {
      var ws = D.words.filter(function (w) { return stageById(w.stage).level === lv.id; });
      var k = ws.filter(function (w) { return known('w:' + w.id); }).length;
      html += '<h2 class="lvl">Level ' + lv.id + ': ' + esc(lv.title) + ' <span>' + k + ' / ' + ws.length + ' known</span></h2>' +
        '<div class="meter"><span style="width:' + Math.round(100 * k / (ws.length || 1)) + '%"></span></div><ul class="vocab">' +
        ws.map(function (w) {
          return '<li class="' + (known('w:' + w.id) ? 'known' : '') + '">' + wordHTML(w) + '<span class="en">' + esc(wordEn(w)) + '</span></li>';
        }).join('') + '</ul>';
    });
    app.innerHTML = html;
    bindBar();
  }

  function howPage() {
    var html = bar('How it works', '#/');
    html += '<div class="card prose">' +
      '<p>Every language is built from the same few kinds of sentence. This lab climbs them one rung at a time:</p>' +
      '<ol class="ladder">' + D.stages.map(function (s) { return '<li><b>' + s.emoji + ' ' + esc(s.title) + '</b>: ' + esc(s.idea) + '</li>'; }).join('') + '</ol>' +
      '<p><b>Frames + words = sentences.</b> A frame like <i>I want ___</i> works with every food you know. Each new word you learn makes every old frame bigger.</p>' +
      '<p><b>Small word packs.</b> About 50 words per level: enough to make real sentences, small enough to really know.</p>' +
      '<p><b>Repetition.</b> Every round mixes in two sentences from earlier stages, and Review brings back whatever is due: tomorrow, then in 2 days, 4, a week, two weeks, a month.</p>' +
      '<p><b>Grammar last.</b> Levels 1 and 2 use one simple form of each verb. Level 3 starts on other people, the past and the future, and joining sentences.</p>' +
      '<p class="muted small">Tip: always say the sentence out loud as you build it.</p></div>';
    html += '<div class="actions"><button type="button" class="btn ghost" id="reset">Start again (wipe progress)</button></div>';
    app.innerHTML = html;
    bindBar();
    document.getElementById('reset').onclick = function () {
      if (confirm('Wipe all progress in ' + D.lang.lab + ' on this device?')) {
        S = { stages: {}, sr: {}, settings: S.settings }; save(); location.hash = '#/';
      }
    };
  }

  /* ---------- play ---------- */
  function play() {
    if (!session) { location.hash = '#/'; return; }
    if (session.i >= session.qs.length) return finish();
    var q = session.qs[session.i];
    var back = session.stage ? '#/stage/' + session.stage : '#/';
    var title = session.stage ? stageById(session.stage).title : 'Review';
    var html = bar(title, back) + '<div class="progress"><span style="width:' + Math.round(100 * session.i / session.qs.length) + '%"></span></div>';
    if (q.type === 'build') html += buildHTML(q);
    else if (q.type === 'quiz') html += quizHTML(q);
    else html += sayHTML(q);
    app.innerHTML = html;
    bindBar();
    if (q.type === 'build') bindBuild(q);
    else if (q.type === 'quiz') bindQuiz(q);
    else bindSay(q);
  }
  function next() { session.i++; play(); window.scrollTo(0, 0); }
  function nextBtn() { return '<div class="actions"><button type="button" class="btn" id="next">Next →</button></div>'; }

  function tileHTML(s, i, attr) {
    return '<button type="button" class="tile-w" ' + attr + '="' + i + '" lang="' + LANGATTR() + '"><span class="h">' + esc(s.t) + '</span>' +
      (D.zh ? '<span class="p">' + esc(s.p) + '</span>' : '') + '</button>';
  }
  function buildHTML(q) {
    var html = '<p class="ask">Build this in ' + esc(D.lang.name) + ':</p><p class="prompt">' + esc(q.g.en) + '</p>';
    html += '<div class="answer" aria-live="polite">' + (q.picked.length ? q.picked.map(function (bi) { return tileHTML(q.bank[bi], bi, 'data-out'); }).join('') : '<span class="muted">Tap the words below</span>') + '</div>';
    if (q.result == null) {
      html += '<div class="bank">' + q.bank.map(function (s, i) {
        return q.picked.indexOf(i) >= 0 ? '<span class="tile-w ghost"></span>' : tileHTML(s, i, 'data-in');
      }).join('') + '</div>';
      html += '<div class="actions"><button type="button" class="btn ghost" id="clear">Clear</button><button type="button" class="btn" id="check"' + (q.picked.length ? '' : ' disabled') + '>Check</button></div>';
    } else {
      html += feedback(q.result, sentenceHTML(q.g.segs, true)) + nextBtn();
    }
    return html;
  }
  function feedback(ok, answer) {
    return '<div class="fb ' + (ok ? 'ok' : 'no') + '"><b>' + (ok ? pick(['Yes! ✓', 'Spot on ✓', 'Brilliant ✓', 'Correct ✓']) : 'Not quite. It\'s:') + '</b><div>' + answer + '</div></div>';
  }
  function bindBuild(q) {
    Array.prototype.forEach.call(app.querySelectorAll('[data-in]'), function (b) {
      b.onclick = function () { q.picked.push(+b.getAttribute('data-in')); play(); };
    });
    Array.prototype.forEach.call(app.querySelectorAll('[data-out]'), function (b) {
      b.onclick = function () { if (q.result != null) return; q.picked.splice(q.picked.indexOf(+b.getAttribute('data-out')), 1); play(); };
    });
    var c = document.getElementById('clear');
    if (c) c.onclick = function () { q.picked = []; play(); };
    var k = document.getElementById('check');
    if (k) k.onclick = function () {
      var got = q.picked.map(function (i) { return q.bank[i].t.toLowerCase(); }).join(' ');
      var want = q.target.map(function (s) { return s.t.toLowerCase(); }).join(' ');
      q.result = got === want;
      if (q.result) session.score++;
      mark(itemKey(q.it), q.result);
      play();
    };
    var n = document.getElementById('next');
    if (n) n.onclick = next;
  }

  function optHTML(o, toEn) {
    if (toEn) return esc(o.en);
    return itemHTML(o.it, o.g);
  }
  function quizHTML(q) {
    var r = q.right;
    var html = '<p class="ask">' + (q.toEn ? 'What does this mean?' : 'How do you say this in ' + esc(D.lang.name) + '?') + '</p>';
    html += '<p class="prompt">' + (q.toEn ? itemHTML(r.it, r.g, true) : esc(r.en)) + '</p>';
    html += '<div class="opts">' + q.opts.map(function (o, i) {
      var cls = q.done ? (o === r ? ' right' : (i === q.chosen ? ' wrong' : '')) : '';
      return '<button type="button" class="opt' + cls + '" data-o="' + i + '"' + (q.done ? ' disabled' : '') + '>' + optHTML(o, q.toEn) + '</button>';
    }).join('') + '</div>';
    if (q.done) {
      var sh = q.toEn ? esc(r.en) : itemHTML(r.it, r.g, true);
      html += feedback(q.ok, sh) + nextBtn();
    }
    return html;
  }
  function bindQuiz(q) {
    Array.prototype.forEach.call(app.querySelectorAll('[data-o]'), function (b) {
      b.onclick = function () {
        if (q.done) return;
        q.done = true;
        q.chosen = +b.getAttribute('data-o');
        q.ok = q.opts[q.chosen] === q.right;
        if (q.ok) session.score++;
        mark(itemKey(q.it), q.ok);
        play();
      };
    });
    var n = document.getElementById('next');
    if (n) n.onclick = next;
  }

  function sayHTML(q) {
    var html = '<p class="ask">Say this out loud in ' + esc(D.lang.name) + ':</p><p class="prompt">' + esc(itemEn(q.it, q.g)) + '</p>';
    if (!q.shown) html += '<div class="actions"><button type="button" class="btn" id="show">I\'ve said it: show me</button></div>';
    else html += '<div class="fb plain"><div>' + itemHTML(q.it, q.g, true) + '</div></div>' +
      '<p class="ask">Did you get it?</p><div class="actions"><button type="button" class="btn ghost" id="nope">Not yet</button><button type="button" class="btn" id="yes">Got it ✓</button></div>';
    return html;
  }
  function bindSay(q) {
    var s = document.getElementById('show');
    if (s) s.onclick = function () { q.shown = true; play(); };
    function done(ok) { if (ok) session.score++; mark(itemKey(q.it), ok); next(); }
    var y = document.getElementById('yes'), n = document.getElementById('nope');
    if (y) y.onclick = function () { done(true); };
    if (n) n.onclick = function () { done(false); };
  }

  function finish() {
    var s = session, n = s.qs.length, sc = s.score;
    var back = s.stage ? '#/stage/' + s.stage : '#/';
    var msg = '';
    if (s.stage && (s.kind === 'build' || s.kind === 'quiz')) {
      var st = S.stages[s.stage] = S.stages[s.stage] || {};
      var before = stars(s.stage);
      st[s.kind] = Math.max(st[s.kind] || 0, sc);
      save();
      if (stars(s.stage) > before) msg = '<p class="star-win">⭐ New star!</p>';
      else if (sc < 6) msg = '<p class="muted">Get 6 or more for a star. Try again: the sentences change each time.</p>';
    } else if (s.stage) {
      S.stages[s.stage] = S.stages[s.stage] || {};
      save();
    }
    var html = bar(s.stage ? stageById(s.stage).title : 'Review', back);
    html += '<div class="card done"><p class="score">' + sc + ' / ' + n + '</p>' +
      '<p>' + (sc === n ? 'Perfect!' : sc >= n * 0.75 ? 'Great work!' : sc >= n / 2 ? 'Good going. Practice makes it stick.' : 'Keep at it: every go helps.') + '</p>' + msg + '</div>';
    html += '<div class="actions"><a class="btn ghost" href="' + back + '">Done</a><button type="button" class="btn" id="again">Go again</button></div>';
    app.innerHTML = html;
    bindBar();
    document.getElementById('again').onclick = function () { startSession(s.kind, s.stage); };
  }

  /* ---------- routing ---------- */
  function route() {
    var h = location.hash.replace(/^#\/?/, '').split('/');
    switch (h[0]) {
      case 'stage': stagePage(h[1]); break;
      case 'learn': learnPage(h[1]); break;
      case 'start': startSession(h[1], h[2]); return;
      case 'review': startSession('review'); return;
      case 'play': play(); break;
      case 'words': wordsPage(); break;
      case 'how': howPage(); break;
      default: home();
    }
    window.scrollTo(0, 0);
  }

  Promise.all([getJSON(BASE + 'blueprint.json'), getJSON(BASE + LANG + '.json')]).then(function (res) {
    D = prepare(res[0], res[1]);
    document.title = D.lang.lab;
    applyPy();
    window.addEventListener('hashchange', route);
    route();
    // Take on the child's colour from the hub.
    getJSON('../../../children.json').then(function (c) {
      var me = c.children.filter(function (x) { return x.slug === SLUG; })[0];
      if (me) document.body.classList.add('c-' + me.colour);
    }).catch(function () {});
  }).catch(function (e) {
    app.innerHTML = '<p class="empty">Could not load the lab. Check your connection and try again.</p>';
    console.error(e);
  });
})();
