/**
 * Which Gemini model, and what a model name may be.
 *
 * Kept apart from the wire so that the page can show the default without
 * loading the rest of the provider: anything the page imports statically is in
 * the chunk every visit to it loads, and a provider is loaded only when it is
 * asked for (boundary.test.js holds this).
 */

export const GEMINI_DEFAULT_MODEL = 'gemini-3.5-flash';

const MODEL = /^[a-z0-9][a-z0-9.-]{0,63}$/u;

/** A model name, and nothing that can leave the address it is put in. */
export function isModelId(value) {
    return typeof value === 'string' && MODEL.test(value);
}
