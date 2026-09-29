/* Learn hub: floating back button for tools.
   Add to any tool at /<slug>/<subject>/<tool>/ with:
   <script src="../../../assets/back.js"></script>
   Optional data-bottom="72" lifts the phone-position button above a tool's own bottom bar.
   Optional data-corner="bottom" keeps it bottom-left on tablets too (for tools with a sticky top bar).
   It links back to that child's subject list, which matters when installed as an app (no browser back button). */
(function () {
  'use strict';
  var bottom = parseInt((document.currentScript && document.currentScript.getAttribute('data-bottom')) || '14', 10);
  var corner = document.currentScript && document.currentScript.getAttribute('data-corner');
  var parts = location.pathname.replace(/index\.html$/, '').split('/').filter(Boolean);
  var subject = parts[parts.length - 2] || '';

  var a = document.createElement('a');
  a.href = '../../#' + encodeURIComponent(subject);
  a.setAttribute('aria-label', 'Back to ' + subject);
  a.textContent = '←';
  a.style.cssText = [
    'position:fixed', 'z-index:1000',
    // Top-left on tablets; bottom-left on phones so it never covers a tool's heading.
    (corner === 'bottom' || window.innerWidth < 700) ? 'bottom:calc(' + bottom + 'px + env(safe-area-inset-bottom, 0px))' : 'top:calc(10px + env(safe-area-inset-top, 0px))',
    'left:calc(10px + env(safe-area-inset-left, 0px))',
    'width:48px', 'height:48px', 'border-radius:50%',
    'display:flex', 'align-items:center', 'justify-content:center',
    'background:rgba(255,255,255,.92)', 'color:#2b2a28', 'border:1px solid rgba(0,0,0,.12)',
    'box-shadow:0 4px 14px rgba(0,0,0,.18)',
    'font:600 24px/1 system-ui,-apple-system,sans-serif', 'text-decoration:none',
    '-webkit-tap-highlight-color:transparent'
  ].join(';');
  document.body.appendChild(a);
})();
