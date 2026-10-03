/**
 * Which Gemini model, and what a model name may be.
 *
 * A model name goes into an address, so it is held to a small alphabet that
 * cannot leave the path it is put in.
 */
import { describe, expect, it } from 'vitest';
import { GEMINI_DEFAULT_MODEL, isModelId } from './gemini-model.js';

describe('the model', () => {
    it('is the one the creator asked for unless the reader names another', () => {
        expect(GEMINI_DEFAULT_MODEL).toBe('gemini-3.5-flash');
    });

    it('is a name and nothing that can leave the address it is put in', () => {
        for (const good of ['gemini-3.5-flash', 'gemini-2.0-pro', 'a', 'x1.2-3']) expect(isModelId(good), good).toBe(true);
        for (const bad of ['', ' ', '../x', 'a/b', 'a?b', 'a#b', 'a:streamGenerateContent', 'Gemini', 'a b', '-a', '.a', 'a'.repeat(65), 'é', '%2e', 'a\nb', null, undefined, 5, {}]) {
            expect(isModelId(bad), String(bad)).toBe(false);
        }
    });
});
