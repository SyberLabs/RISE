import { retiredInference } from '../../worker/retired-inference.mjs';

// Netlify previews answer the retired inference routes exactly as production
// does: a clear 410 that reads no credential and calls no model.
export default function retired() {
  return retiredInference();
}

// Netlify statically extracts function route metadata during packaging. Keep
// this literal (rather than deriving it from the imported route table) so the
// adapter sees a string array before it bundles the function.
export const config = {
  path: [
    '/api/jev-recommend',
    '/api/jev-decision',
    '/api/jev/route',
    '/api/jev-visual-score',
    '/api/enterprise-decision',
    '/api/personal-piece'
  ]
};
