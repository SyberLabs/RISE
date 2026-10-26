/**
 * The NVIDIA adapter: a model in NVIDIA's API catalog (build.nvidia.com), asked directly from this browser on the
 * reader's own NVIDIA key.
 *
 * A keyed text stream (keyed-stream.js) over NVIDIA's OpenAI-compatible chat completions,
 * `POST https://integrate.api.nvidia.com/v1/chat/completions` with `stream: true`: OpenAI's chat completions wire,
 * read by openai-chat.js's own reader (only `delta.content`, never `reasoning_content`). Names and shapes are NVIDIA's, read on 2026-10-26:
 *   https://docs.api.nvidia.com/nim/reference/llm-apis  (POST /v1/chat/completions at integrate.api.nvidia.com)
 *   https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b  (Authorization: Bearer $NVIDIA_API_KEY;
 *     max_tokens; stream; chat_template_kwargs.enable_thinking; reasoning in reasoning_content, apart from content)
 * and, asked without a working key on 2026-10-26: a key NVIDIA does not know is a 403 `application/problem+json`
 * `{"status":403,"title":"Forbidden","detail":"Authorization failed"}`, a malformed one a 401 of the same shape, and a
 * model it does not serve a plain-text 404. The model list is `GET /v1/models`.
 *
 * NOT YET REACHABLE FROM RISE. NVIDIA's preflight (OPTIONS, checked without a key on 2026-10-26) allows
 * `Authorization` and `Content-Type` only for an `https://*.nvidia.com` origin; for rise.syberlabs.io, or any other
 * origin, it answers 200 with no Access-Control-Allow-Origin, so the browser refuses the request before it is sent,
 * key and all. The adapter is the right shape for the day NVIDIA admits browser origins, and says plainly what
 * happened until then (`reachable`). docs/plans/LIVE-NVIDIA.md. A real session has not been run here.
 */

import { instructionsFor, promptFor } from './openai-instructions.js';
import { createKeyedStreamAdapter, KEYED_LIMITS } from './keyed-stream.js';
import { wire } from './openai-chat.js';

export const NVIDIA_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

/**
 * Nemotron 3.5 Lightning: what NVIDIA's catalog calls its fastest 30B A3B model, a general purpose reasoning and chat
 * model (2026-10-26). The reader may name any model in the catalog their key reaches.
 */
export const NVIDIA_DEFAULT_MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b';

/** A catalog model id: a lower-case publisher, a slash, a lower-case name (digits, dots, dashes, underscores). */
const MODEL = /^[a-z0-9][a-z0-9._-]{0,63}\/[a-z0-9][a-z0-9._-]{0,127}$/u;
export const isNvidiaModel = value => typeof value === 'string' && MODEL.test(value) && !value.includes('..');

/** NVIDIA's API keys begin `nvapi-`. */
const KEY_SHAPE = /nvapi-[A-Za-z0-9_-]{4,}/gu;

export const NVIDIA_UNREACHABLE = 'NVIDIA’s API lets a browser reach it only from NVIDIA’s own sites today, so it may refuse this page.';

const object = value => (value && typeof value === 'object' && !Array.isArray(value) ? value : null);

/** The one request that asks a question: RISE's instructions, the reader's words, a cap, no thinking, usage. */
export function buildBody(request, model, origin) {
    return {
        model,
        messages: [
            { role: 'system', content: instructionsFor(origin, request.intent, request) },
            { role: 'user', content: promptFor(request) }
        ],
        max_tokens: KEYED_LIMITS.maxTokens,
        stream: true,
        stream_options: { include_usage: true },
        // Thinking counts toward the cap; off keeps the first words quick. A template that has no such switch ignores it.
        chat_template_kwargs: { enable_thinking: false }
    };
}

/** A refusal's words: NVIDIA's problem document (`detail`, `title`), or an OpenAI-shaped `error`. */
export function errorOf(body) {
    const error = object(body?.error);
    if (error) return error;
    if (typeof body?.detail === 'string') return { message: body.detail, code: typeof body.title === 'string' ? body.title : undefined };
    return null;
}

function refusal(status, error, said, model) {
    // NVIDIA answers a key it does not know with 403, not 401.
    if (status === 401 || status === 403) return ['KEY_REFUSED', `NVIDIA did not accept your key: ${said}`];
    if (status === 402) return ['CREDIT_REQUIRED', `Your NVIDIA account has no credits left for this. Add credits at build.nvidia.com, then ask again: ${said}`];
    if (status === 404 || ((status === 400 || status === 422) && /model/iu.test(said))) return ['MODEL_NOT_FOUND', `NVIDIA has no model called “${model}” for your key: ${said}`];
    if (status === 429) return ['RATE_LIMITED', `NVIDIA is holding back requests from your key just now (a rate limit). Wait a moment, then ask again: ${said}`];
    if (status === 408 || status >= 500) return ['PROVIDER_UNAVAILABLE', `NVIDIA could not answer just now: ${said}`];
    return ['BAD_REQUEST', `NVIDIA would not take the request: ${said}`];
}

/**
 * A fetch that says, when the browser could not send the request at all, why that is likely. A request the reader
 * stopped is still taken as stopped: the keyed stream asks its own signal first.
 */
const reachable = fetchImpl => async (...args) => {
    try {
        return await fetchImpl(...args);
    } catch (error) {
        throw new TypeError(`${error?.message ?? error}. ${NVIDIA_UNREACHABLE}`);
    }
};

/**
 * @param {object} options
 * @param {() => string} options.getKey the reader's typed NVIDIA key, asked for at each request
 * @param {() => string | undefined} [options.getModel] the model the reader named, if they did
 * @param {Function} [options.onUsage] the tokens NVIDIA reported an answer used (it reports no price)
 * @param {typeof fetch} [options.fetch]
 * @param {number} [options.capacity]
 * @param {number} [options.maxBytes]
 */
export function createNvidiaAdapter({ fetch: fetchImpl = (...args) => globalThis.fetch(...args), ...options } = {}) {
    return createKeyedStreamAdapter({
        id: 'nvidia-stream',
        name: 'NVIDIA',
        url: NVIDIA_CHAT_URL,
        defaultModel: NVIDIA_DEFAULT_MODEL,
        isModel: isNvidiaModel,
        modelHint: 'That is not an NVIDIA catalog model id: it looks like nvidia/nemotron-3.5-lightning-30b-a3b.',
        keyShape: KEY_SHAPE,
        headers: key => ({ 'content-type': 'application/json', authorization: `Bearer ${key}` }),
        body: buildBody,
        errorOf,
        refusal,
        wire
    }, { ...options, fetch: reachable(fetchImpl) });
}
