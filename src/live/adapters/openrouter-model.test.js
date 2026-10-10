import { describe, expect, it } from 'vitest';
import { isOpenRouterModel, OPENROUTER_DEFAULT_MODEL } from './openrouter-model.js';

describe('which OpenRouter model', () => {
    it('defaults to a named model that is itself a model name', () => {
        expect(OPENROUTER_DEFAULT_MODEL).toBe('anthropic/claude-haiku-5.5');
        expect(isOpenRouterModel(OPENROUTER_DEFAULT_MODEL)).toBe(true);
    });

    it('takes the names OpenRouter lists: a maker, a model, and a variant after a colon', () => {
        for (const id of ['openai/gpt-5.4-nano', 'meta-llama/llama-4-scout', 'qwen/qwen3.7-flash:free', '~anthropic/claude-haiku-latest']) {
            expect(isOpenRouterModel(id), id).toBe(true);
        }
    });

    it('refuses anything else', () => {
        for (const id of ['', 'gpt-5', 'a/b/c', 'openai/', '/gpt', 'openai/gpt 5', 'openai/gpt-5\n', 'OpenAI/GPT', `a/${'x'.repeat(200)}`, null, 7]) {
            expect(isOpenRouterModel(id), String(id)).toBe(false);
        }
    });
});
