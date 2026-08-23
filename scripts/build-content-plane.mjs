/**
 * Runner for the data-plane build. The work lives in lib/content-plane.mjs
 * so a test can call it without a script running itself on import.
 *
 * Runs ahead of `vite build`; see the library module for why.
 */

import { buildContentPlane } from './lib/content-plane.mjs';

const manifest = await buildContentPlane();
const shelved = manifest.works.filter(work => work.shelved);
const mb = list => (list.reduce((total, item) => total + item.bytes, 0) / 1024 / 1024)
  .toFixed(2);

console.log(
  `[content-plane] ${shelved.length} works ${mb(shelved)} MB · `
  + `${manifest.chapel.length} Chapel books ${mb(manifest.chapel)} MB · `
  + `${manifest.works.length - shelved.length} withheld with reasons · `
  + `revision ${manifest.revision}`
);
