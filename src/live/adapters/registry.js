/**
 * The providers the Live venue offers a reader (src/live/host/venue.js), in the order it lists them.
 *
 * An entry is { id, label, credential, keyName?, keyGoesTo?, adapter }:
 *   credential  'none'        nothing is asked of the reader (the deterministic demo)
 *               'openrouter'  the site's own OpenRouter connection (src/core/ai-connection.js); the page
 *                             shows the connect control while there is none, and never handles the key
 *               'key'         a key the reader types into the page for `keyName`, held in the page's
 *                             memory only and handed to the adapter through `getKey` at each request;
 *                             it goes to `keyGoesTo` and nowhere else
 *   adapter     async ({ clock, getKey }) => adapter (src/live/adapter.js), loaded only when asked; null
 *               lists the provider as coming soon
 *
 * A provider is offered here only if its key goes from the browser to that provider and nowhere else.
 * OpenAI Realtime is not: its session is opened through this site's Worker route (worker/live-realtime.mjs).
 */

export const LIVE_PROVIDERS = Object.freeze([
    Object.freeze({
        id: 'mock',
        label: 'Demo (no key)',
        credential: 'none',
        // The answer written in beats, through the parser every real provider's text goes through.
        adapter: async ({ clock }) => (await import('./mock-beats.js')).createMockBeatsAdapter({ clock })
    }),
    Object.freeze({
        id: 'openrouter',
        label: 'OpenRouter (your key)',
        credential: 'openrouter',
        // The key stays in ai-connection.js; the adapter asks for the connection at each request.
        adapter: async () => (await import('./openrouter.js')).createOpenRouterAdapter()
    }),
    Object.freeze({
        id: 'gemini',
        label: 'Gemini (your key)',
        credential: 'key',
        keyName: 'Gemini',
        keyGoesTo: 'Google',
        adapter: async ({ getKey }) => {
            const [{ createGeminiAdapter }, { createGeminiFetchTransport }] = await Promise.all([
                import('./gemini.js'),
                import('./gemini-fetch.js')
            ]);
            return createGeminiAdapter({ transport: createGeminiFetchTransport({ getKey, getModel: () => undefined }) });
        }
    })
]);

/** The entry for `id`, or null. */
export function liveProvider(id) {
    return LIVE_PROVIDERS.find(entry => entry.id === id) ?? null;
}
