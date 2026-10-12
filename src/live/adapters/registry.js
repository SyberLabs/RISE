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
 *   adapter     async ({ clock, getKey, onUsage }) => adapter (src/live/adapter.js), loaded only when asked; null
 *               lists the provider as coming soon. `onUsage` is told what the provider reported each request
 *               cost, where it reports it (OpenRouter its price and tokens; Anthropic and OpenAI their tokens), for the
 *               venue's About this reading
 *
 * A provider is offered here only if its key goes from the browser to that provider and nowhere else.
 * OpenAI Realtime is not: its session is opened through this site's Worker route (worker/live-realtime.mjs). The
 * `openai` entry is OpenAI's chat completions, asked from the browser (openai-chat.js).
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
        // The key stays in ai-connection.js; the adapter asks for the connection at each request, and says what each cost.
        adapter: async ({ onUsage } = {}) => (await import('./openrouter.js')).createOpenRouterAdapter({ onUsage })
    }),
    Object.freeze({
        id: 'anthropic',
        label: 'Anthropic (your key)',
        credential: 'key',
        keyName: 'Anthropic',
        keyGoesTo: 'Anthropic',
        adapter: async ({ getKey, onUsage }) => (await import('./anthropic.js')).createAnthropicAdapter({ getKey, onUsage })
    }),
    Object.freeze({
        id: 'openai',
        label: 'OpenAI (your key)',
        credential: 'key',
        keyName: 'OpenAI',
        keyGoesTo: 'OpenAI',
        // Chat completions, from this browser to OpenAI; not the Realtime adapter, which goes through this site's Worker.
        adapter: async ({ getKey, onUsage }) => (await import('./openai-chat.js')).createOpenAIChatAdapter({ getKey, onUsage })
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
