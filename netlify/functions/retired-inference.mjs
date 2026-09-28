import { RETIRED_INFERENCE_ROUTES, retiredInference } from '../../worker/retired-inference.mjs';

// Netlify previews answer the retired inference routes exactly as production
// does: a clear 410 that reads no credential and calls no model.
export default function retired() {
  return retiredInference();
}

export const config = { path: [...RETIRED_INFERENCE_ROUTES] };
