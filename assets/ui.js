/* Learn hub: shared UI. Used by the front door and every child's subject picker.
   All URLs are relative so the site works under /learn/ and at a custom domain. */
(function () {
  'use strict';

  var ICONS = {
    flame: '<path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-9.5z"/>',
    swords: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/>' +
            '<path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="M5 14l4 4"/><path d="M7 17l-3 3"/><path d="M3 19l2 2"/>',
    paw: '<circle cx="5.5" cy="10" r="2"/><circle cx="9" cy="5.5" r="2"/><circle cx="15" cy="5.5" r="2"/><circle cx="18.5" cy="10" r="2"/>' +
         '<path d="M12 11c-3 0-6 4.5-6 7a3 3 0 0 0 3 3c1.2 0 2-.6 3-.6s1.8.6 3 .6a3 3 0 0 0 3-3c0-2.5-3-7-6-7z"/>',
    book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
    file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>',
    print: '<path d="M7 8V3h10v5"/><rect x="3" y="8" width="18" height="9" rx="2"/><path d="M7 14h10v7H7z"/>'
  };

  function icon(name) {
    return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.book) + '</svg>';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function titleCase(slug) {
    return slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  function fail(el, err) {
    el.innerHTML = '<p class="empty">Could not load this page. Check your connection and try again.</p>';
    console.error(err);
  }

  /* ---------- Front door: "Who's learning?" ---------- */
  function renderHome(el) {
    getJSON('children.json').then(function (data) {
      el.innerHTML = '<ul class="grid big">' + data.children.map(function (c) {
        return '<li><a class="tile c-' + esc(c.colour) + '" href="' + esc(c.slug) + '/">' +
          icon(c.icon) + '<span>' + esc(c.label) + '</span></a></li>';
      }).join('') + '</ul>';
    }).catch(function (e) { fail(el, e); });
  }

  /* ---------- Child page: subjects, then tools in a subject ---------- */
  // The slug is the folder name, so the same index.html works in every child folder.
  function slugFromPath() {
    var parts = location.pathname.replace(/index\.html$/, '').split('/').filter(Boolean);
    return parts[parts.length - 1];
  }

  function renderChild(el) {
    var slug = slugFromPath();
    var showArchived = false;

    Promise.all([getJSON('../children.json'), getJSON('manifest.json')]).then(function (res) {
      var child = res[0].children.filter(function (c) { return c.slug === slug; })[0] ||
        { slug: slug, label: titleCase(slug), colour: '', icon: 'book' };
      var manifest = res[1];
      var items = manifest.items || [];
      var subjects = (manifest.subjects || []).slice();

      // Any subject folder used by an item but not listed still gets a tile.
      items.forEach(function (it) {
        var s = subjectOf(it);
        if (!subjects.some(function (x) { return x.slug === s; })) subjects.push({ slug: s, label: titleCase(s) });
      });

      document.body.className = 'c-' + child.colour;
      document.title = child.label + ' · Learn';

      function draw() {
        var subjectSlug = decodeURIComponent(location.hash.slice(1));
        var subject = subjects.filter(function (s) { return s.slug === subjectSlug; })[0];
        if (subjectSlug === PRINTABLES) drawPrintables();
        else if (subject) drawSubject(subject); else drawSubjects();
        window.scrollTo(0, 0);
      }

      function visible(it) {
        return showArchived ? it.status === 'archived' : it.status !== 'archived';
      }

      function toggleHTML() {
        return '<div class="toggle" role="group" aria-label="Which material">' +
          '<button type="button" data-archived="0" aria-pressed="' + !showArchived + '">Current</button>' +
          '<button type="button" data-archived="1" aria-pressed="' + showArchived + '">Archive</button></div>' +
          (showArchived ? '<p class="note">Finished work, kept to look back on. Everything still opens and prints.</p>' : '');
      }

      function bindToggle() {
        Array.prototype.forEach.call(el.querySelectorAll('.toggle button'), function (b) {
          b.addEventListener('click', function () {
            showArchived = b.getAttribute('data-archived') === '1';
            draw();
          });
        });
      }

      function bar(title, back, label) {
        return '<div class="bar"><a class="back" href="' + back + '" aria-label="' + label + '">&#8592;</a>' +
          '<h1>' + esc(title) + '</h1></div>';
      }

      function counts(list) {
        var p = list.filter(isPractise).length, q = printsOf(list).length, out = [];
        if (p) out.push(p + ' to practise');
        if (q) out.push(q + ' to print');
        return out.join(' · ') || 'Empty';
      }

      function drawSubjects() {
        var html = bar(child.label, '../', 'Back to everyone') + toggleHTML();
        var shown = subjects.filter(function (s) {
          // In the archive, only subjects that have archived material.
          return !showArchived || items.some(function (it) { return subjectOf(it) === s.slug && visible(it); });
        });
        if (!shown.length) {
          html += '<p class="empty">' + (showArchived ? 'Nothing archived yet.' : 'No subjects yet.') + '</p>';
        } else {
          html += '<ul class="grid">' + shown.map(function (s) {
            var list = items.filter(function (it) { return subjectOf(it) === s.slug && visible(it); });
            return '<li><a class="tile" href="#' + encodeURIComponent(s.slug) + '">' + icon(s.icon || 'book') +
              '<span>' + esc(s.label) + '</span><span class="sub">' + counts(list) + '</span></a></li>';
          }).join('') + '</ul>';
        }
        var allPrints = printsOf(items.filter(visible));
        if (allPrints.length) {
          html += '<a class="row shelf" href="#' + PRINTABLES + '"><span class="badge">PDF</span>' +
            '<span class="title">All printables</span><span class="year">' + allPrints.length + '</span></a>';
        }
        el.innerHTML = html;
        bindToggle();
      }

      // One subject: "Practise" (HTML tools) then "Print" (PDFs, including worksheets attached to a tool).
      function drawSubject(s) {
        var list = items.filter(function (it) { return subjectOf(it) === s.slug && visible(it); });
        var html = bar(s.label, '#', 'Back to subjects') + toggleHTML();
        var practise = list.filter(isPractise), prints = printsOf(list);
        if (!practise.length && !prints.length) {
          html += '<p class="empty">' + (showArchived ? 'Nothing archived here yet.' : 'Nothing here yet.') + '</p>';
        } else {
          if (practise.length) html += section('Practise', 'On screen', practise, practiseRowHTML);
          if (prints.length) html += section('Print', 'Worksheets to print out', prints, printRowHTML);
        }
        el.innerHTML = html;
        bindToggle();
      }

      // This child's whole PDF shelf, grouped by subject.
      function drawPrintables() {
        var html = bar('Printables', '#', 'Back to subjects') + toggleHTML();
        var blocks = subjects.map(function (s) {
          var prints = printsOf(items.filter(function (it) { return subjectOf(it) === s.slug && visible(it); }));
          return prints.length ? section(s.label, '', prints, printRowHTML) : '';
        }).join('');
        html += blocks || '<p class="empty">' + (showArchived ? 'No archived printables.' : 'No printables yet.') + '</p>';
        el.innerHTML = html;
        bindToggle();
      }

      function section(title, hint, list, row) {
        return '<section class="section"><h2>' + esc(title) + (hint ? ' <span>' + esc(hint) + '</span>' : '') + '</h2>' +
          groupsHTML(list, row) + '</section>';
      }

      // Current: optional "topic" headings. Archive: year headings (newest first), with the topic alongside.
      function groupsHTML(list, row) {
        var groups = [];
        list.forEach(function (it) {
          var key = (showArchived ? (it.year || '') + '|' : '') + (it.topic || '');
          var g = groups.filter(function (x) { return x.key === key; })[0];
          if (!g) groups.push(g = { key: key, year: it.year || 0, topic: it.topic || '', items: [] });
          g.items.push(it);
        });
        groups.sort(function (a, b) {
          return (showArchived ? b.year - a.year : 0) || ((a.topic === '') - (b.topic === ''));
        });
        var headed = groups.some(function (g) { return g.topic; }) || (showArchived && groups.length > 1);
        return groups.map(function (g) {
          var label = showArchived ? [g.year || '', g.topic].filter(Boolean).join(' · ') : (g.topic || 'Other');
          return (headed ? '<h3 class="topic">' + esc(label || 'Other') + '</h3>' : '') +
            '<ul class="list">' + g.items.map(row).join('') + '</ul>';
        }).join('');
      }

      window.addEventListener('hashchange', draw);
      draw();
    }).catch(function (e) { fail(el, e); });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () {});
    }
  }

  var PRINTABLES = 'printables';

  function isPractise(it) { return it.type !== 'pdf'; }

  // Every PDF in a list: standalone PDF items, plus the "print" worksheet attached to an HTML tool.
  function printsOf(list) {
    var out = [];
    list.forEach(function (it) {
      if (it.type === 'pdf') out.push(it);
      else if (it.print) out.push({ title: it.printTitle || it.title, path: it.print, year: it.year, term: it.term, topic: it.topic });
    });
    return out;
  }

  function metaHTML(it) {
    var m = [it.term, it.year].filter(Boolean).join(' ');
    return m ? '<span class="year">' + esc(m) + '</span>' : '';
  }

  function practiseRowHTML(it) {
    var row = '<a class="row" href="' + esc(it.path) + '"><span class="badge">Play</span>' +
      '<span class="title">' + esc(it.title) + '</span>' + metaHTML(it) + '</a>';
    if (!it.print) return '<li>' + row + '</li>';
    return '<li class="pair">' + row + '<a class="row print" href="' + esc(it.print) + '" target="_blank" rel="noopener" ' +
      'aria-label="Print the worksheet for ' + esc(it.title) + '">' + icon('print') + '</a></li>';
  }

  function printRowHTML(it) {
    return '<li><a class="row" href="' + esc(it.path) + '" target="_blank" rel="noopener"><span class="badge">PDF</span>' +
      '<span class="title">' + esc(it.title) + '</span>' + metaHTML(it) + '</a></li>';
  }

  // Subject folder = first segment of the item's path, e.g. "maths/counting/" -> "maths".
  function subjectOf(it) {
    return String(it.path).replace(/^\.\//, '').split('/')[0];
  }

  window.Learn = { renderHome: renderHome, renderChild: renderChild };
})();
