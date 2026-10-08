/**
 * A scene worker, made the way the page's origin allows
 * (docs/superpowers/specs/2026-10-08-creative-control-design.md §3, §13).
 *
 * On RISE's own pages the worker is RISE's module, same-origin. In a host's
 * card the document's origin is the host's sandbox, and a worker must be
 * same-origin with its document, so RISE's built worker is fetched as text
 * (connect-src admits RISE) and started from a `blob:` URL (worker-src admits
 * blob:). The built worker imports nothing at run time, so it runs whole from
 * there. The text is fetched once per page.
 *
 * The blob worker is a classic worker, not a module one. A host that sandboxes
 * the card without `allow-same-origin` gives it an opaque origin; Chromium
 * fetches a module worker's script in CORS mode, which `blob:null/…` cannot
 * pass, so a module worker from such a blob never loads (its `onerror` fires
 * with no message). A classic worker loads there, and `import()` of the
 * scene's own blob module works from inside it. The built worker has no
 * static import or export, so it parses as a classic script; the browser
 * test of a generated scene in the self-contained card holds that.
 */
import workerUrl from './scene-worker.js?worker&url';
import { IN_HOST_CARD } from '../core/embed-address.js';

let blobUrl = null;

/**
 * @param {object} [options] the page's own, overridden only by tests
 * @param {boolean} [options.inHostCard]
 * @param {typeof fetch} [options.load]
 * @param {(url: string, options?: WorkerOptions) => Worker} [options.makeWorker]
 */
export async function createSceneWorker({ inHostCard = IN_HOST_CARD, load = fetch, makeWorker = (url, options) => new Worker(url, options) } = {}) {
  if (!inHostCard) return makeWorker(workerUrl, { type: 'module' });
  blobUrl ??= load(workerUrl)
    .then(response => {
      if (!response.ok) throw new Error(`the scene worker answered ${response.status}`);
      return response.text();
    })
    .then(text => URL.createObjectURL(new Blob([text], { type: 'text/javascript' })));
  try {
    return makeWorker(await blobUrl);
  } catch (error) {
    blobUrl = null;
    throw error;
  }
}
