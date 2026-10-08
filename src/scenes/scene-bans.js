/**
 * The names a generated scene may not use (docs/superpowers/specs/
 * 2026-10-08-creative-control-design.md §8, §13), declared once for the two
 * locks that enforce them: the static admission in the Worker
 * (worker/scene-admission.mjs) and the scene worker's shadowing
 * (src/scenes/scene-worker.js).
 *
 * Plain data and no imports, so both can take it and the built scene worker
 * stays one file.
 */

/**
 * Globals the scene worker replaces with a stub that throws. Network and
 * timer paths, storage, the worker's own channel, and `FontFace`, whose
 * `load()` fetches a `url(...)` source. A name is listed only if it is a
 * global of a worker scope: `fonts` is reached through `self`, which is banned.
 */
export const SHADOWED_GLOBALS = Object.freeze([
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'WebTransport', 'BroadcastChannel', 'Worker', 'SharedWorker',
  'importScripts', 'indexedDB', 'caches', 'navigator', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'postMessage',
  'FontFace'
]);

/** Names the parse refuses but the scope cannot shadow: the worker itself, or a way to reach every global. */
export const STATIC_ONLY_NAMES = Object.freeze(['eval', 'Function', 'self', 'globalThis', 'window']);
