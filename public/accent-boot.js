// Stamps the reader's saved colourway on <html> before first paint, so the
// default never flashes first. A same-origin file because the policy is
// script-src 'self', which refuses inline scripts. The default is the bare
// :root, so only a colourway is stamped. Mirrors migrateChamberAccent and
// applyChamberAccent; keep the list in step with CHAMBER_ACCENT_TOKENS
// (src/core/chamber-accent.js).
(function () {
  try {
    var allowed = { slate: 1, ivory: 1, purple: 1, cobalt: 1, amber: 1, sunset: 1, gecko: 1, garnet: 1, teal: 1, orchid: 1 };
    var stored = JSON.parse(localStorage.getItem('rise-settings')) || {};
    var id = stored.chamberAccent;
    // A 'slate' saved before Slate became a hue of its own meant the default.
    if (id === 'slate' && !stored.chamberAccentNamed) return;
    if (allowed[id] === 1) document.documentElement.dataset.accent = id;
  } catch (e) {
    // Storage blocked or settings corrupt: the bare :root is the default.
  }
})();
