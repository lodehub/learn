/* LearnSend: sends a learner's answers to their parent's private Google Sheet.
   Only children listed in ENDPOINTS send anything; for everyone else this file does nothing.
   The endpoint is a Google Apps Script web app that can only ADD rows; it cannot read them.

   API (window.LearnSend):
     init({key: "<slug>:<subject>:<tool>", title, kind})   kind: "practice" | "explore" | "today"
     enabled()            true if this child has an endpoint
     put(id, row)         queue one answer (skipped if identical to what was last sent)
     flush()              send everything queued; returns a Promise of "sent" | "nothing" | "offline" | "off"
     status()             {pending, lastSent}
   Unsent answers are kept on the device and retried next time. Pages flush when hidden. */
(function () {
  'use strict';
  var ENDPOINTS = {
    ember: ''
  };
  var cfg = null, url = '', K = '', pending = {}, last = {}, lastSent = null, timer = null;

  function load(k, d) { try { var v = localStorage.getItem(K + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function keep(k, v) { try { localStorage.setItem(K + k, JSON.stringify(v)); } catch (e) {} }
  function sig(row) { return JSON.stringify(row); }
  function clip(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + '…' : s; }

  function init(o) {
    var parts = String(o.key || '').split(':');
    cfg = { child: parts[0] || '', subject: parts[1] || '', tool: parts[2] || '', title: o.title || document.title, kind: o.kind || 'practice' };
    url = ENDPOINTS[cfg.child] || '';
    K = 'learnsend:' + o.key + ':';
    pending = load('pending', {}); last = load('last', {}); lastSent = load('sentAt', null);
    if (!url) return;
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', function () { flush(); });
    if (Object.keys(pending).length) setTimeout(flush, 1500);
  }
  function enabled() { return !!url; }

  function put(id, row) {
    if (!cfg) return;
    row = row || {};
    ['q', 'answer', 'result', 'source'].forEach(function (f) { if (row[f] != null) row[f] = clip(row[f], f === 'answer' ? 6000 : 400); });
    if (last[id] === sig(row)) { if (pending[id]) { delete pending[id]; keep('pending', pending); } return; }
    pending[id] = row; keep('pending', pending);
    clearTimeout(timer); timer = setTimeout(flush, 20000); // also send a little while after she stops changing things
  }

  var busy = null;
  function flush() {
    if (!url) return Promise.resolve('off');
    if (busy) return busy;
    var ids = Object.keys(pending);
    if (!ids.length) return Promise.resolve('nothing');
    if (navigator.onLine === false) return Promise.resolve('offline');
    var rows = ids.map(function (id) { var r = pending[id], o = { block: id }; for (var k in r) o[k] = r[k]; return o; });
    var body = JSON.stringify({ v: 1, child: cfg.child, subject: cfg.subject, tool: cfg.tool, title: cfg.title, kind: cfg.kind, sent: new Date().toISOString(), page: location.pathname, rows: rows });
    busy = fetch(url, { method: 'POST', mode: 'no-cors', keepalive: body.length < 60000, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body })
      .then(function () {
        ids.forEach(function (id) { if (pending[id]) { last[id] = sig(pending[id]); delete pending[id]; } });
        lastSent = new Date().toISOString(); keep('pending', pending); keep('last', last); keep('sentAt', lastSent);
        document.dispatchEvent(new CustomEvent('learnsend', { detail: status() }));
        return 'sent';
      }, function () { return 'offline'; })
      .then(function (r) { busy = null; return r; });
    return busy;
  }
  function status() { return { pending: Object.keys(pending).length, lastSent: lastSent }; }

  /* A small "Send my answers" button with a status line, for any page. */
  function button(parent, label) {
    if (!url) return null;
    var box = document.createElement('div'); box.className = 'ls-box';
    var b = document.createElement('button'); b.type = 'button'; b.className = 'ls-btn'; b.textContent = label || 'Send my answers';
    var s = document.createElement('p'); s.className = 'ls-status';
    function paint(msg) {
      var st = status();
      s.textContent = msg || (st.pending ? st.pending + ' new answer' + (st.pending === 1 ? '' : 's') + ' not sent yet.' :
        st.lastSent ? 'All sent ✓ (last sent ' + new Date(st.lastSent).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) + ')' : 'Your answers are sent automatically as you go.');
    }
    b.onclick = function () { b.disabled = true; paint('Sending…'); flush().then(function (r) { b.disabled = false; paint(r === 'offline' ? 'No connection. They will send next time you are online.' : null); }); };
    document.addEventListener('learnsend', function () { paint(); });
    setInterval(function () { paint(); }, 5000);
    paint(); box.appendChild(b); box.appendChild(s); parent.appendChild(box);
    if (!document.getElementById('ls-css')) {
      var css = document.createElement('style'); css.id = 'ls-css';
      css.textContent = '.ls-box{margin:12px 0}.ls-btn{min-height:48px;padding:10px 18px;border-radius:12px;border:1px solid var(--accent,var(--acc,#d9682a));background:var(--accent,var(--acc,#d9682a));color:#fff;font:inherit;font-weight:700;cursor:pointer}.ls-btn:disabled{opacity:.5}.ls-status{font-size:14px;color:var(--muted,var(--mute,#6f6b64));margin:6px 0 0}@media print{.ls-box{display:none}}';
      document.head.appendChild(css);
    }
    return box;
  }

  window.LearnSend = { init: init, enabled: enabled, put: put, flush: flush, status: status, button: button };
})();
