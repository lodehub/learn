/* Service worker, scoped to this child's folder (the same file is copied into each child folder).
   Pages and data: network first, but after 3 seconds use the saved copy (slow wifi never means a blank screen);
   a late network answer still refreshes the saved copy for next time.
   Everything else (images, fonts, PDFs): saved copy first, filled as it is used.
   After install, every current tool in manifest.json (its page plus the scripts and styles it links)
   is saved in the background, so the child's tools open offline without being visited first. */
var CACHE = 'learn-v2';
var SHELL = ['./', 'index.html', 'manifest.json', '../children.json', '../assets/style.css', '../assets/ui.js', '../assets/back.js'];
var WAIT = 3000;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }).then(function () {
    warm(); // not awaited: best effort, never blocks the app
  }));
});

// Save each current tool page and the local scripts and stylesheets it links.
function warm() {
  return caches.open(CACHE).then(function (c) {
    return fetch('manifest.json').then(function (r) { return r.json(); }).then(function (m) {
      var pages = (m.items || []).filter(function (it) { return it.status !== 'archived' && it.type === 'html'; })
        .map(function (it) { return new URL(it.path, self.registration.scope).href; });
      return pages.reduce(function (chain, page) {
        return chain.then(function () { return keep(c, page); });
      }, Promise.resolve());
    });
  }).catch(function () { /* offline or no manifest: try again next time */ });
}

function keep(c, page) {
  return c.match(page).then(function (hit) {
    if (hit) return;
    return fetch(page).then(function (res) {
      if (!res.ok) return;
      return res.clone().text().then(function (html) {
        var refs = [], re = /<(?:script|link)\b[^>]*?(?:src|href)="([^"#?]+\.(?:js|css))"[^>]*>/g, m;
        while ((m = re.exec(html))) {
          var src = new URL(m[1], page).href;
          refs.push(src);
          data(src, m[0]).forEach(function (f) { refs.push(new URL(f, /practice\.js$/.test(src) ? page : src).href); });
        }
        return c.put(page, res).then(function () {
          return Promise.all(refs.filter(function (u) { return u.indexOf(self.location.origin) === 0; }).map(function (u) {
            return c.match(u).then(function (h) { return h || c.add(u).catch(function () {}); });
          }));
        });
      });
    }).catch(function () {});
  });
}

// The JSON each shared engine loads at runtime, read from its script tag (see assets/lab and assets/practice).
function data(src, tag) {
  function attr(n) { var m = new RegExp(n + '="([^"]+)"').exec(tag); return m && m[1]; }
  var lang = attr('data-lang') || 'french';
  if (/\/lab\/lab\.js$/.test(src)) return ['blueprint.json', lang + '.json'];
  if (/\/roleplay\.js$/.test(src)) return [(attr('data-content') || lang + '-roleplay') + '.json'];
  if (/\/dials\.js$/.test(src)) return [(attr('data-data') || 'french-dials') + '.json'];
  if (/\/mainland\.js$/.test(src)) return ['mainland.json'];
  if (/\/phrase-lab\.js$/.test(src)) return ['units.json', 'structures.json'];
  if (/\/practice\.js$/.test(src)) return [attr('data-content') || 'content.json'];
  return [];
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  var url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  var fresh = req.mode === 'navigate' || /\.(json|html|css|js)$/.test(url.pathname);
  e.respondWith(fresh ? networkFirst(req, e) : cacheFirst(req));
});

function save(req, res) {
  if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
  return res;
}

function fromCache(req) {
  // ?print and other query strings share the saved page.
  return caches.match(req).then(function (hit) { return hit || caches.match(req, { ignoreSearch: true }); });
}

function networkFirst(req, e) {
  var net = fetch(req).then(function (res) { return save(req, res); });
  e.waitUntil(net.catch(function () {}));
  return new Promise(function (resolve, reject) {
    var done = false;
    function finish(res) { if (!done && res) { done = true; resolve(res); } }
    var timer = setTimeout(function () { fromCache(req).then(finish); }, WAIT);
    net.then(function (res) { clearTimeout(timer); finish(res); }).catch(function () {
      clearTimeout(timer);
      fromCache(req).then(function (hit) { if (hit) finish(hit); else if (!done) reject(new TypeError('offline')); });
    });
  }).catch(function () { return net; });
}

function cacheFirst(req) {
  return caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (res) { return save(req, res); });
  });
}
