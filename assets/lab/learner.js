/* Who is learning, and where their progress is saved.
   On /<slug>/<subject>/<tool>/ the learner is that child.
   On /languages/<subject>/<tool>/ it is whoever was picked on the language hub (or ?who=<slug>).
   Either way progress lives under "<slug>:<subject>:<tool>:...", so both routes share it.
   Load before any lab engine: <script src="../../../assets/lab/learner.js"></script> */
(function () {
  'use strict';
  var parts = location.pathname.replace(/[^/]*\.html$/, '').split('/').filter(Boolean);
  var n = parts.length;
  var hub = parts[n - 3] === 'languages';
  var slug = parts[n - 3];
  if (hub) {
    slug = null;
    var asked = /[?&]who=([a-z0-9-]+)/i.exec(location.search);
    try {
      if (asked) localStorage.setItem('languages:who', asked[1]);
      slug = localStorage.getItem('languages:who');
    } catch (e) { slug = asked && asked[1]; }
    // Nobody picked yet: go and choose on the hub.
    if (!slug) location.replace('../../#who');
  }
  window.Learner = {
    hub: hub,
    slug: slug || 'guest',
    subject: parts[n - 2] || '',
    tool: parts[n - 1] || '',
    key: function (suffix) { return [this.slug, this.subject, this.tool, suffix].join(':'); },
    // Where the tool's own back arrow goes: the child's subject list, or the hub.
    back: '../../#' + encodeURIComponent(parts[n - 2] || '')
  };
})();
