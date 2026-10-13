/**
 * A scene worker, started from a `blob:` URL of RISE's built worker on every page
 * (docs/superpowers/specs/2026-10-08-creative-control-design.md §3, §13).
 *
 * A worker started from its script's own URL takes its policy from that script's
 * response, and the built worker is served immutable, cached for a year: a policy
 * fixed after a reader's visit never reached their scenes (2026-10-13: the face on
 * /live stayed a still for every returning reader while fresh ones saw it). A blob
 * worker inherits its document's policy, which is revalidated on every visit. In a
 * host's card it is the only way: the document's origin is the host's sandbox, and a
 * worker must be same-origin with its document. So RISE's built worker is fetched as
 * text (connect-src admits RISE; on RISE's own pages it is the same origin) and
 * started from a `blob:` URL (worker-src admits blob:). It imports nothing at run
 * time, so it runs whole from there. The text is fetched once per page.
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

let blobUrl = null;

/**
 * @param {object} [options] the page's own, overridden only by tests
 * @param {typeof fetch} [options.load]
 * @param {(url: string, options?: WorkerOptions) => Worker} [options.makeWorker]
 */
export async function createSceneWorker({ load = fetch, makeWorker = (url, options) => new Worker(url, options) } = {}) {
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
