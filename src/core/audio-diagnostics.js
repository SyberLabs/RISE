/**
 * A window into the audio path, for a phone with no console.
 *
 * Silence on the first phrase has survived four fixes, each of which was
 * a real defect and none of which was THE defect. The reason is that
 * every round has been inference from a symptom — and the device where
 * it reproduces is an iPhone, where there is no console to read.
 *
 * So this records what actually happened at the points that matter and
 * puts it on screen with a button that copies it. It is inert unless the
 * URL says `?diag=1`: no listeners, no DOM, no cost, and every call site
 * is a single line that returns immediately.
 *
 * IT IS MEANT TO BE DELETED. When the cause is known this file and its
 * six call sites go with it.
 */

const FLAG = /(?:^|[?&])diag=1(?:&|$)/u;

let enabled = null;
let panel = null;
let list = null;
const records = [];

/**
 * THE FLAG HAS TO OUTLIVE THE URL THAT CARRIED IT. A reading is several
 * routes away from wherever `?diag=1` was typed, and the router rewrites
 * the address on the way — so reading `location.search` at the moment the
 * first clip plays can find the flag already gone. Once seen it is
 * remembered for the tab, which is also what lets the reader open
 * `/try-rise?diag=1`, press Begin, and still be recording.
 */
const MEMO = 'rise:audio-diag';

export function audioDiagEnabled() {
  if (enabled !== null) return enabled;
  if (typeof location === 'undefined') {
    enabled = false;
    return enabled;
  }
  const url = `${location.search || ''}${location.hash || ''}`;
  enabled = FLAG.test(url);
  try {
    if (enabled) sessionStorage.setItem(MEMO, '1');
    else enabled = sessionStorage.getItem(MEMO) === '1';
  } catch {
    // Private browsing can refuse storage. The flag then lasts as long
    // as the query string does, which is still the common case.
  }
  return enabled;
}

/**
 * Record one fact. Anything not JSON-serialisable is the caller's
 * problem to flatten first — this is read by a person on a phone.
 */
export function audioDiag(event, facts = {}) {
  if (!audioDiagEnabled()) return;
  records.push({
    ms: Math.round(typeof performance !== 'undefined' ? performance.now() : 0),
    event,
    ...facts
  });
  render();
}

function ensurePanel() {
  if (panel?.isConnected) return;
  panel = document.createElement('div');
  panel.setAttribute('data-audio-diag', '');
  panel.style.cssText = [
    'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:2147483647',
    'max-height:42vh', 'overflow:auto', 'background:rgba(8,8,10,0.94)',
    'color:#C5C5CD', 'font:11px/1.35 ui-monospace,Menlo,monospace',
    'padding:8px 10px 10px', 'border-top:1px solid #2A2A30'
  ].join(';');

  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:6px';

  const copy = document.createElement('button');
  copy.textContent = 'Copy';
  copy.style.cssText = 'font:inherit;padding:6px 12px;background:#1A1A1E;'
    + 'color:#E4D2AE;border:1px solid #3A3A42;border-radius:4px';
  copy.onclick = async () => {
    const text = JSON.stringify(records, null, 1);
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = 'Copied';
    } catch {
      // Clipboard needs permission a phone may not give. Select it
      // instead so the reader can copy by hand.
      const area = document.createElement('textarea');
      area.value = text;
      area.style.cssText = 'width:100%;height:28vh;font:inherit;background:#111;color:#ccc';
      panel.appendChild(area);
      area.select();
      copy.textContent = 'Select all above';
    }
  };

  const clear = document.createElement('button');
  clear.textContent = 'Clear';
  clear.style.cssText = copy.style.cssText;
  clear.onclick = () => { records.length = 0; render(); };

  const title = document.createElement('span');
  title.textContent = 'audio diag';
  title.style.cssText = 'color:#9B9BA5;margin-right:auto';

  bar.append(title, copy, clear);
  list = document.createElement('div');
  panel.append(bar, list);
  document.body.appendChild(panel);
}

function render() {
  if (typeof document === 'undefined' || !document.body) return;
  ensurePanel();
  list.textContent = records
    .map(r => {
      const { ms, event, ...rest } = r;
      const facts = Object.entries(rest)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');
      return `${String(ms).padStart(6)}  ${event}  ${facts}`;
    })
    .join('\n');
  panel.scrollTop = panel.scrollHeight;
}
