/**
 * The two halves of the curator loop: what goes out, and what comes back
 * when the answer is refused.
 */
import { describe, expect, it } from 'vitest';
import { exportCuratorContext, validateCuratorContext } from './curator-context.js';
import { describeImportFailure, assertProgramWithinContext } from './experience-program-io.js';
import { WORK_ENGINE_MANIFEST } from '../visuals/work-engines.js';
import { PROCEDURAL_PATTERN_IDS } from './visual-registry.js';

const surface = () => exportCuratorContext({
    id: 'ctx-1',
    sources: [{ id: 'src-a', name: 'Anna Karenina · Chapter 1', data: 'Happy families' }],
    assets: [{ id: 'moon', name: 'Moon' }],
    swellIds: ['my-swell']
});

describe('the context says what its ids are', () => {
    it('describes museum categories with the name and tags they already carry', () => {
        const entry = surface().catalog.collections['aic-oldmasters'];
        expect(entry).toMatchObject({ kind: 'museum-category', name: 'Old Masters' });
        expect(entry.tags).toContain('classical');
    });

    it('describes soundscapes with the prose written beside them', () => {
        const entry = surface().catalog.soundscapes.aurora;
        expect(entry.name).toBe('Aurora');
        expect(entry.description).toMatch(/pad/i);
    });

    it('names the work a work-engine was authored for', () => {
        // THE FIELD THAT MATTERS. The capability list offers every engine
        // at once, so without `work` a Milton engine looks as available
        // over Anna Karenina as Klee does — permitted, and wrong.
        const context = surface();
        expect(context.catalog.engines.flaming_sword).toMatchObject({
            kind: 'work-engine', work: 'paradise-lost'
        });
        // `category` is deliberately absent — see buildCatalog.
        expect(context.catalog.engines.flaming_sword.category).toBeUndefined();
        expect(context.catalog.engines.klee).toMatchObject({ kind: 'procedural' });
        expect(context.catalog.engines.klee.work).toBeUndefined();
    });

    it('separates a procedural pool from the engine of the same name', () => {
        // klee appears in BOTH lists; the catalogue is where the two
        // meanings stop being one word.
        const context = surface();
        expect(context.catalog.collections.klee.kind).toBe('procedural-pool');
        expect(context.catalog.engines.klee.kind).toBe('procedural');
    });

    it('offers exactly the engines the registries hold, not a hand-kept list', () => {
        const context = surface();
        for (const id of [...PROCEDURAL_PATTERN_IDS, ...WORK_ENGINE_MANIFEST.map(e => e.id)]) {
            expect(context.visuals.engines, id).toContain(id);
        }
        expect(context.visuals.engines).toHaveLength(
            PROCEDURAL_PATTERN_IDS.length + WORK_ENGINE_MANIFEST.length
        );
    });

    it('carries no URI anywhere, catalogue included', () => {
        expect(JSON.stringify(surface())).not.toMatch(/data:|blob:|https?:\/\//);
    });

    it('stays a valid context, and the catalogue is optional', () => {
        const context = surface();
        expect(() => validateCuratorContext(context)).not.toThrow();
        const { catalog, ...withoutCatalog } = context;
        expect(catalog).toBeDefined();
        expect(() => validateCuratorContext(withoutCatalog)).not.toThrow();
    });
});

describe('a refusal comes back as something to act on', () => {
    const context = surface();

    it('names both clips and what to do about an overlap', () => {
        const text = describeImportFailure({
            code: 'PROGRAM_LANE_OVERLAP',
            path: '$.tracks',
            details: { trackKind: 'visual', sourceId: 'src-a', clipIds: ['a', 'b'] }
        });
        expect(text).toContain('src-a');
        expect(text).toContain('a and b');
        expect(text).toMatch(/half-open/);
        expect(text).toContain('(PROGRAM_LANE_OVERLAP)');
    });

    it('lists what was available when something named is not', () => {
        // "not in the context" is unactionable; "use one of these" is not.
        let raised;
        try {
            assertProgramWithinContext({
                tracks: [{ kind: 'visual', clips: [{
                    id: 'v1', anchor: { sourceIds: ['src-a'] },
                    cue: { kind: 'sourced', collections: ['aic-nonexistent'] }
                }] }]
            }, context);
        } catch (error) { raised = error; }

        const text = describeImportFailure(raised, { context });
        expect(text).toContain('aic-nonexistent');
        expect(text).toMatch(/Available collections:/);
        expect(text).toContain('aic-oldmasters');
    });

    it('explains the published refusal in terms of what to change', () => {
        const text = describeImportFailure({ code: 'PROGRAM_IO_PUBLISHED_REFUSED', path: '$.authority' });
        expect(text).toMatch(/Remove the authority field/);
    });

    it('explains an ambiguous quotation so the model can extend it', () => {
        const text = describeImportFailure({
            code: 'SOURCE_SPAN_QUOTE_AMBIGUOUS',
            path: '$.tracks[1].clips[0].anchor',
            details: { quoteStart: 'the mark', occurrences: 3 }
        });
        expect(text).toContain('the mark');
        expect(text).toContain('3 times');
        expect(text).toMatch(/appears once|extend/i);
    });

    it('falls back to the message rather than saying nothing', () => {
        const text = describeImportFailure({ code: 'SOMETHING_NEW', message: 'Unexpected shape' });
        expect(text).toContain('Unexpected shape');
        expect(text).toContain('(SOMETHING_NEW)');
    });
});

describe('every named capability says what it looks like', () => {
    // The gap the catalogue was built for. Names are not descriptions:
    // "Rock Garden" and "Klee Lines" say nothing about whether a field is
    // dense or sparse, still or moving, figure or atmosphere — which is
    // the whole of what a curator is choosing between.
    const context = surface();

    it('describes all six procedural patterns', () => {
        for (const id of PROCEDURAL_PATTERN_IDS) {
            expect(context.catalog.engines[id]?.description, id).toBeTruthy();
        }
    });

    it('describes all thirteen work engines', () => {
        for (const { id } of WORK_ENGINE_MANIFEST) {
            expect(context.catalog.engines[id]?.description, id).toBeTruthy();
        }
    });

    it('describes every museum category it offers', () => {
        const museum = Object.entries(context.catalog.collections)
            .filter(([, entry]) => entry.kind === 'museum-category');
        expect(museum.length).toBeGreaterThanOrEqual(10);
        for (const [id, entry] of museum) {
            expect(entry.description, id).toBeTruthy();
        }
    });

    it('keeps every description inside the document bound', () => {
        const all = [
            ...Object.values(context.catalog.engines),
            ...Object.values(context.catalog.collections),
            ...Object.values(context.catalog.soundscapes)
        ].map(entry => entry.description).filter(Boolean);
        expect(all.length).toBeGreaterThan(25);
        for (const text of all) expect(text.length).toBeLessThanOrEqual(400);
    });
});

describe('the prompt teaches a shape that passes', () => {
    // FIRST REAL RUN FOUND THIS. The prompt explained anchoring, ids and
    // cue kinds in prose and never showed the shape, so a model put
    // sourceIds and fromProgress at the clip level instead of inside
    // `anchor`, and omitted every id, movement `data` and track
    // `fallback`. Semantics understood, syntax invented.
    it('carries a worked example, and the example validates', async () => {
        const { buildCuratorPrompt } = await import('./curator-prompt.js');
        const { validateExperienceProgram } = await import('./experience-program.js');
        const prompt = buildCuratorPrompt(surface());

        const opened = prompt.indexOf('{\n  "schema"');
        expect(opened, 'prompt shows no worked example').toBeGreaterThan(-1);
        // Brace-count to the MATCHING close; the prompt keeps talking
        // after the example, so the last `}` in the document is not it.
        let depth = 0;
        let end = opened;
        for (let i = opened; i < prompt.length; i += 1) {
            if (prompt[i] === '{') depth += 1;
            else if (prompt[i] === '}') { depth -= 1; if (depth === 0) { end = i + 1; break; } }
        }
        const example = JSON.parse(prompt.slice(opened, end));

        // An example that does not itself pass is worse than none: it
        // teaches the model to produce something the gate refuses.
        expect(() => validateExperienceProgram(example)).not.toThrow();
    });

    it('carries a worked operation-set example that validates', async () => {
        const { buildCuratorPrompt } = await import('./curator-prompt.js');
        const { validateAgentOperationSet, AGENT_OPERATION_SET_SCHEMA } = await import('./agent-operations.js');
        const prompt = buildCuratorPrompt(surface());
        const marker = `"schema": "${AGENT_OPERATION_SET_SCHEMA}"`;
        const opened = prompt.indexOf(`{\n  ${marker}`);
        expect(opened, 'prompt shows no operation-set example').toBeGreaterThan(-1);
        let depth = 0;
        let end = opened;
        for (let i = opened; i < prompt.length; i += 1) {
            if (prompt[i] === '{') depth += 1;
            else if (prompt[i] === '}') { depth -= 1; if (depth === 0) { end = i + 1; break; } }
        }
        expect(() => validateAgentOperationSet(JSON.parse(prompt.slice(opened, end)))).not.toThrow();
    });

    it('names the containers a model will otherwise flatten', async () => {
        const { buildCuratorPrompt } = await import('./curator-prompt.js');
        const prompt = buildCuratorPrompt(surface());
        for (const shown of ['"anchor"', '"fallback"', '"data"', '"id"']) {
            expect(prompt, shown).toContain(shown);
        }
    });
});

describe('the prompt states the limits a model cannot infer', () => {
    it('names the atom ceiling, which the context only implies', async () => {
        // FIRST REAL RUN: a model chose four whole works totalling 124,794
        // words against a 120,000-atom ceiling. Every word count was in the
        // context; the limit was in neither the context nor the prompt, so
        // the score validated and the reading refused to compile.
        const { buildCuratorPrompt } = await import('./curator-prompt.js');
        const { SESSION_LIMITS } = await import('./session-compiler.js');
        const prompt = buildCuratorPrompt(surface());
        expect(prompt).toContain(SESSION_LIMITS.maxAtoms.toLocaleString());
        expect(prompt).toMatch(/words/);
    });
});
