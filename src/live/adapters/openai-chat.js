/**
 * The OpenAI chat adapter: a GPT model, asked directly from this browser on the reader's own OpenAI key.
 *
 * Not the Realtime adapter (openai-realtime.js), whose session is opened through this site's Worker. This is a keyed
 * text stream (keyed-stream.js) over chat completions, `POST https://api.openai.com/v1/chat/completions` with
 * `stream: true`. Names and shapes are those of OpenAI's reference, read on 2026-10-12:
 *   https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create
 *     (developer messages replace system messages for newer models; max_completion_tokens, max_tokens deprecated;
 *      reasoning_effort; stream_options.include_usage: one more chunk before `data: [DONE]` with the whole request's
 *      usage and an empty choices array, every other chunk's usage null)
 *   https://developers.openai.com/api/reference/resources/chat/subresources/completions/streaming-events
 *     (chat.completion.chunk, choices[].delta.content, finish_reason stop | length | content_filter | …)
 *   https://developers.openai.com/api/docs/guides/error-codes (401; 429 for rate limits and for credit or spend
 *     limits, told apart by `code`; 500, 503)
 * OpenAI's preflight was checked without a key on 2026-10-12: it reflects the page's origin and allows
 * authorization and content-type, and a refusal carries `Access-Control-Allow-Origin: *`. A real session has not been
 * run here. A refused key is echoed back in OpenAI's own message; the keyed stream cleans it before it is shown.
 */

import { instructionsFor, promptFor } from './openai-instructions.js';
import { codeOf, createKeyedStreamAdapter, KEYED_LIMITS, tokens } from './keyed-stream.js';

export const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * GPT-6 Luna: what OpenAI's models page calls its most efficient model for focused, high-volume tasks
 * (US$0.10 in, US$0.50 out per million tokens, on 2026-10-12). The reader may name any model their key reaches.
 */
export const OPENAI_DEFAULT_MODEL = 'gpt-6-luna';

/** An OpenAI model id: lower case, digits, dots, dashes, underscores, and the colons of a fine-tuned model. */
const MODEL = /^[a-z0-9][a-z0-9._:-]{0,95}$/u;
export const isOpenAIModel = value => typeof value === 'string' && MODEL.test(value) && !value.includes('..');

const KEY_SHAPE = /sk-[A-Za-z0-9_*-]{4,}/gu;
/** The codes OpenAI gives a 429 that is about money, not pace (the error-codes guide). */
const MONEY = /quota|credit|spend_limit|usage_limit|billing/iu;

const object = value => (value && typeof value === 'object' && !Array.isArray(value) ? value : null);

/** The one request that asks a question: RISE's instructions, the reader's words, a cap, little reasoning, usage. */
export function buildBody(request, model, origin) {
    return {
        model,
        messages: [
            { role: 'developer', content: instructionsFor(origin, request.intent) },
            { role: 'user', content: promptFor(request) }
        ],
        max_completion_tokens: KEYED_LIMITS.maxTokens,
        // Reasoning counts toward the cap; low keeps the first words quick.
        reasoning_effort: 'low',
        stream: true,
        stream_options: { include_usage: true }
    };
}

function refusal(status, error, said, model) {
    const code = typeof error?.code === 'string' ? error.code : '';
    if (status === 401) return ['KEY_REFUSED', `OpenAI did not accept your key: ${said}`];
    if (status === 402 || (status === 429 && MONEY.test(code))) return ['CREDIT_REQUIRED', `Your OpenAI account has no credit or spend left for this. Add credit or raise the limit at platform.openai.com, then ask again: ${said}`];
    if (status === 403) return ['REFUSED', `OpenAI refused the request: ${said}`];
    if (status === 404 || code === 'model_not_found' || (status === 400 && /model/iu.test(said))) return ['MODEL_NOT_FOUND', `OpenAI has no model called “${model}” for your key: ${said}`];
    if (status === 429) return ['RATE_LIMITED', `OpenAI is holding back requests from your key just now (a rate limit). Wait a moment, then ask again: ${said}`];
    if (status === 408 || status >= 500) return ['PROVIDER_UNAVAILABLE', `OpenAI could not answer just now: ${said}`];
    return ['BAD_REQUEST', `OpenAI would not take the request: ${said}`];
}

/** Reads one chat completions chunk; NVIDIA's OpenAI-compatible stream (nvidia.js) is read by it too. */
export function wire(on) {
    return data => {
        if (data === '[DONE]') { on.done(); return; }
        let chunk;
        try { chunk = object(JSON.parse(data)); } catch { return; }
        if (!chunk) return;
        if (chunk.error !== undefined && chunk.error !== null) {
            const error = object(chunk.error);
            on.fail(codeOf(error?.code ?? error?.type), error?.message);
            return;
        }
        const usage = object(chunk.usage);
        if (usage) on.usage(tokens({ promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens, totalTokens: usage.total_tokens }));
        const choice = Array.isArray(chunk.choices) ? object(chunk.choices[0]) : null;
        if (!choice) return;
        // Only the answer's words: never a refusal field or a model's reasoning.
        on.text(object(choice.delta)?.content);
        if (typeof choice.finish_reason === 'string' && choice.finish_reason) on.finish(choice.finish_reason);
    };
}

/**
 * @param {object} options
 * @param {() => string} options.getKey the reader's typed OpenAI key, asked for at each request
 * @param {() => string | undefined} [options.getModel] the model the reader named, if they did
 * @param {Function} [options.onUsage] the tokens OpenAI reported an answer used (it reports no price)
 * @param {typeof fetch} [options.fetch]
 * @param {number} [options.capacity]
 * @param {number} [options.maxBytes]
 */
export function createOpenAIChatAdapter(options = {}) {
    return createKeyedStreamAdapter({
        id: 'openai-chat-stream',
        name: 'OpenAI',
        url: OPENAI_CHAT_URL,
        defaultModel: OPENAI_DEFAULT_MODEL,
        isModel: isOpenAIModel,
        modelHint: 'That is not an OpenAI model id: it looks like gpt-6-luna.',
        keyShape: KEY_SHAPE,
        headers: key => ({ 'content-type': 'application/json', authorization: `Bearer ${key}` }),
        body: buildBody,
        refusal,
        wire
    }, options);
}
