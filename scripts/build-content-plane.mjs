/**
 * Runner for the data-plane build. The work lives in lib/content-plane.mjs
 * so a test can call it without a script running itself on import.
 *
 * Runs ahead of `vite build`; see the library module for why.
 */

import { buildContentPlane } from './lib/content-plane.mjs';

const manifest = await buildContentPlane();
const shelved = manifest.works.filter(work => work.shelved);
const bytes = shelved.reduce((total, work) => total + work.bytes, 0);
console.log(
  `[content-plane] ${shelved.length} works, `
  + `${(bytes / 1024 / 1024).toFixed(2)} MB, `
  + `${manifest.works.length - shelved.length} withheld with reasons, `
  + `revision ${manifest.revision}`
);
