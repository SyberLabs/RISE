/**
 * The Anthropic adapter: Claude, asked directly from this browser on the reader's own Anthropic key.
 *
 * A keyed text stream (keyed-stream.js) over the Messages API,
 * `POST https://api.anthropic.com/v1/messages` with `stream: true`. Names and
 * shapes are those of Anthropic's documentation, read on 2026-10-12:
 *   https://platform.claude.com/docs/en/build-with-claude/streaming  (named events: message_start with usage,
 *                                                                     content_block_delta with text_delta, message_delta
 *                                                                     with stop_reason and cumulative usage, message_stop,
 *                                                                     ping, error; unknown events are to be ignored)
 *   https://platform.claude.com/docs/en/api/errors                   (`{ type: 'error', error: { type, message } }`;
 *                                                                     400, 401, 402, 403, 404, 429, 500, 529)
 *   https://platform.claude.com/docs/en/api/overview                 (x-api-key, anthropic-version, content-type)
 *   https://platform.claude.com/docs/en/build-with-claude/effort     (output_config.effort; Haiku 5.5 defaults to medium)
 *
 * THE BROWSER HEADER. Anthropic answers a request from a web page only when it
 * carries `anthropic-dangerous-direct-browser-access: true`: the header its own
 * TypeScript SDK sends when told `dangerouslyAllowBrowser`
 * (anthropic-sdk-typescript src/client.ts; "Browser usage" on
 * https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript). The
 * danger it names is a site that ships its own key in its page. That is not
 * this: the key is the reader's, typed into their own browser, held in memory
 * and sent only to Anthropic (docs/USER-OWNED-AI.md). The preflight was checked
 * without a key on 2026-10-12 (it allows content-type, x-api-key,
 * anthropic-version and this header from any origin). A real session has not
 * been run here.
 */

import { instructionsFor, promptFor } from './openai-instructions.js';
import { codeOf, createKeyedStreamAdapter, KEYED_LIMITS, tokens } from './keyed-stream.js';

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Claude Haiku 5.5: the newest, cheapest Claude (US$0.10 in, US$0.50 out per million tokens), the same model the
 * OpenRouter default names. The reader may name claude-sonnet-5-5 or claude-opus-5-5, or any id their key reaches.
 */
export const ANTHROPIC_DEFAULT_MODEL = 'claude-haiku-5-5';

/** A Claude model id: `claude-` and lower-case words joined by single dashes (claude-opus-4-5-20251101 fits). */
const MODEL = /^claude-[a-z0-9]+(?:-[a-z0-9]+){0,8}$/u;
export const isAnthropicModel = value => typeof value === 'string' && value.length <= 64 && MODEL.test(value);

const KEY_SHAPE = /sk-ant-[A-Za-z0-9_*-]{4,}/gu;

const object = value => (value && typeof value === 'object' && !Array.isArray(value) ? value : null);

/** The one request that asks a question: RISE's instructions, the reader's words, a cap, and little thinking. */
export function buildBody(request, model, origin) {
    return {
        model,
        max_tokens: KEYED_LIMITS.maxTokens,
        system: instructionsFor(origin, request.intent, request),
        messages: [{ role: 'user', content: promptFor(request) }],
        // Thinking is on by default on the 5.5 models and cannot be turned off on all of them; low effort keeps the
        // first words quick and the thinking inside the cap.
        output_config: { effort: 'low' },
        stream: true
    };
}

function refusal(status, error, said, model) {
    const credit = status === 402 || /credit balance|billing/iu.test(said);
    if (status === 401) return ['KEY_REFUSED', `Anthropic did not accept your key: ${said}`];
    if (credit) return ['CREDIT_REQUIRED', `Your Anthropic account has no credit left for this. Add credit in the Claude Console, then ask again: ${said}`];
    if (status === 403) return ['REFUSED', `Anthropic refused the request: ${said}`];
    if (status === 404 || (status === 400 && /model/iu.test(said))) return ['MODEL_NOT_FOUND', `Anthropic has no model called “${model}” for your key: ${said}`];
    if (status === 429) return ['RATE_LIMITED', `Anthropic is holding back requests from your key just now (a rate limit). Wait a moment, then ask again: ${said}`];
    if (status === 408 || status >= 500) return ['PROVIDER_UNAVAILABLE', `Anthropic could not answer just now: ${said}`];
    return ['BAD_REQUEST', `Anthropic would not take the request: ${said}`];
}

/** Anthropic's stop reasons as the finishes the keyed stream knows: a natural end, a cap, a refusal. */
const FINISH = { end_turn: 'stop', stop_sequence: 'stop', max_tokens: 'length', refusal: 'refusal' };

function wire(on) {
    let prompt;
    let completion;
    const report = () => on.usage(tokens({ promptTokens: prompt, completionTokens: completion, totalTokens: prompt !== undefined && completion !== undefined ? prompt + completion : undefined }));
    const count = raw => {
        const usage = object(raw);
        if (!usage) return;
        if (Number.isFinite(usage.input_tokens)) prompt = usage.input_tokens;
        if (Number.isFinite(usage.output_tokens)) completion = usage.output_tokens;
        report();
    };
    return data => {
        let event;
        try { event = object(JSON.parse(data)); } catch { return; }
        switch (event?.type) {
            case 'message_start': count(object(event.message)?.usage); break;
            case 'content_block_delta': {
                // Only text; a thinking block's deltas and its signature are never the answer.
                const delta = object(event.delta);
                if (delta?.type === 'text_delta') on.text(delta.text);
                break;
            }
            case 'message_delta': {
                // Its usage is cumulative: it replaces what message_start said.
                count(event.usage);
                const reason = object(event.delta)?.stop_reason;
                if (typeof reason === 'string' && reason) on.finish(FINISH[reason] ?? reason);
                break;
            }
            case 'message_stop': on.done(); break;
            case 'error': {
                const error = object(event.error);
                on.fail(codeOf(error?.type), error?.message);
                break;
            }
            default: break; // ping, content_block_start/stop, and whatever Anthropic adds later
        }
    };
}

/**
 * @param {object} options
 * @param {() => string} options.getKey the reader's typed Anthropic key, asked for at each request
 * @param {() => string | undefined} [options.getModel] the model the reader named, if they did
 * @param {Function} [options.onUsage] the tokens Anthropic reported an answer used (it reports no price)
 * @param {typeof fetch} [options.fetch]
 * @param {number} [options.capacity]
 * @param {number} [options.maxBytes]
 */
export function createAnthropicAdapter(options = {}) {
    return createKeyedStreamAdapter({
        id: 'anthropic-stream',
        name: 'Anthropic',
        url: ANTHROPIC_MESSAGES_URL,
        defaultModel: ANTHROPIC_DEFAULT_MODEL,
        isModel: isAnthropicModel,
        modelHint: 'That is not a Claude model id: it looks like claude-haiku-5-5.',
        keyShape: KEY_SHAPE,
        headers: key => ({
            'content-type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        }),
        body: buildBody,
        refusal,
        wire
    }, options);
}
