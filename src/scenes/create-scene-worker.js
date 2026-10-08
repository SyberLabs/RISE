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
 */
import workerUrl from './scene-worker.js?worker&url';
import { IN_HOST_CARD } from '../core/embed-address.js';

let blobUrl = null;

export async function createSceneWorker() {
  if (!IN_HOST_CARD) return new Worker(workerUrl, { type: 'module' });
  blobUrl ??= fetch(workerUrl)
    .then(response => {
      if (!response.ok) throw new Error(`the scene worker answered ${response.status}`);
      return response.text();
    })
    .then(text => URL.createObjectURL(new Blob([text], { type: 'text/javascript' })));
  try {
    return new Worker(await blobUrl, { type: 'module' });
  } catch (error) {
    blobUrl = null;
    throw error;
  }
}
