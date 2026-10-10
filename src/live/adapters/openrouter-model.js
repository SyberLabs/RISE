/**
 * Which OpenRouter model, and what a model name may be.
 *
 * Kept apart from the adapter so that the page can show the default without
 * loading the provider (boundary.test.js holds this).
 *
 * The default is Claude Haiku 5.5: the cheapest tier OpenRouter lists from a
 * maker whose models hold to a written format (US$0.10 in, US$0.50 out per
 * million tokens on 2026-10-09), with no reasoning unless asked for, so the
 * first words come quickly. The reader may name any other model their account
 * can reach.
 */

export const OPENROUTER_DEFAULT_MODEL = 'anthropic/claude-haiku-5.5';

/** `maker/model`, with an optional `:variant`, in OpenRouter's lower-case alphabet (every id it listed on 2026-10-09 fits). */
const MODEL = /^~?[a-z0-9][a-z0-9._-]{0,63}\/[a-z0-9][a-z0-9._-]{0,127}(?::[a-z0-9._-]{1,32})?$/u;

export function isOpenRouterModel(value) {
    return typeof value === 'string' && MODEL.test(value);
}
