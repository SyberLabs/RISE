/**
 * The glass behind the words, frame by frame: what the reader sees of the pane while a reading speaks, and across
 * each stretch between two phrases. Shared by the card (live-mcp.spec.js) and the Reader (band-continuity.spec.js).
 */

/**
 * Every frame for `ms`: the words the reader can see and their opacity, and the glass behind them (its alpha as
 * painted, and its box). Words that have left and are kept only to hold the glass's box (`[data-outgoing]`) are
 * not words the reader sees.
 */
export async function sampleGlass(app, ms) {
  await app.locator('body').evaluate(body => {
    const doc = body.ownerDocument;
    const win = doc.defaultView;
    const record = win.__glassProbe = { frames: [] };
    // rgb(), rgba() and color(srgb r g b / a), which is how a color-mix() computes.
    const alpha = color => {
      if (!color || color === 'transparent') return 0;
      const slash = /\/\s*([\d.]+)\s*\)$/u.exec(color);
      if (slash) return Number(slash[1]);
      const m = /rgba?\(([^)]+)\)/u.exec(color);
      if (!m) return color.startsWith('color(') ? 1 : 0;
      const parts = m[1].split(/[\s,]+/u).filter(Boolean).map(Number);
      return parts.length > 3 ? parts[3] : 1;
    };
    const t0 = win.performance.now();
    const tick = () => {
      const display = doc.querySelector('#atom-display');
      const band = doc.querySelector('#atom-band');
      const ds = win.getComputedStyle(display);
      const bs = win.getComputedStyle(band);
      const box = display.getBoundingClientRect();
      const bandBox = band.getBoundingClientRect();
      const opacity = Number(ds.opacity);
      const shown = display.cloneNode(true);
      for (const gone of shown.querySelectorAll('[data-outgoing]')) gone.remove();
      const phrase = display.querySelector('.atom-phrase');
      // The pane the reader sees: the display's own background under its opacity (a computer), the pane the Reader's
      // progressive reveal paints in the display's ::before, or the band's under its opacity (a phone).
      const before = win.getComputedStyle(display, '::before');
      const progressive = display.classList.contains('is-progressive-glass') ? alpha(before.backgroundColor) * Number(before.opacity) * opacity : 0;
      const glass = Math.max(alpha(ds.backgroundColor) * opacity, progressive, alpha(bs.backgroundColor) * Number(bs.opacity));
      record.frames.push({
        t: Math.round(win.performance.now() - t0),
        text: shown.textContent.trim(),
        words: Math.round(opacity * (phrase ? Number(win.getComputedStyle(phrase).opacity) : 1) * 1000) / 1000,
        glass: Math.round(glass * 1000) / 1000,
        height: Math.round(Math.max(box.height, bandBox.height)),
        width: Math.round(Math.max(box.width, bandBox.width)),
        state: band.dataset.bandState ?? null
      });
      if (!record.stopped) win.requestAnimationFrame(tick);
    };
    win.requestAnimationFrame(tick);
  });
  await app.locator('body').page().waitForTimeout(ms);
  return app.locator('body').evaluate(body => {
    const probe = body.ownerDocument.defaultView.__glassProbe;
    probe.stopped = true;
    return probe.frames;
  });
}

/**
 * Each stretch between two shown phrases: how long no words could be seen, the least glass and the least height the
 * pane kept meanwhile, and for how long the glass was under half its alpha. `visible` is the glass's alpha under words.
 */
export function glassGaps(frames) {
  const seen = frame => frame.text && frame.words >= 0.05;
  const visible = Math.max(...frames.filter(seen).map(frame => frame.glass));
  const gaps = [];
  let open = null;
  for (const [index, frame] of frames.entries()) {
    if (!open && !seen(frame) && index > 0 && seen(frames[index - 1])) open = { from: frame.t, before: frames[index - 1].text, frames: [] };
    else if (open && seen(frame)) {
      const thin = open.frames.filter(f => f.glass < visible * 0.5);
      gaps.push({
        from: open.from,
        ms: frame.t - open.from,
        lowestGlass: Math.min(...open.frames.map(f => f.glass), frame.glass),
        glassAbsentMs: thin.length ? thin.at(-1).t - thin[0].t + 16 : 0,
        lowestHeight: Math.min(...open.frames.map(f => f.height)),
        before: open.before.slice(0, 24),
        after: frame.text.slice(0, 24)
      });
      open = null;
    }
    if (open && !seen(frame)) open.frames.push(frame);
  }
  return { visible, gaps };
}
