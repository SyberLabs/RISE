/**
 * What a text-streaming model is told: beats, one per line, taught with worked
 * examples. An example that the parser would cut, or that the Worker would
 * refuse once sealed, teaches the model to write something RISE drops, so each
 * one is read here exactly as a model's answer is.
 */
import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../worker/mcp-server.mjs';
import { SCENE_ENGINES } from '../../core/beats.js';
import { TOOL_NAME } from '../guide/index.js';
import { createEventWriter } from '../adapter.js';
import { createCurrentStream } from '../stream.js';
import { BEAT_EXAMPLES, promptFor, REALTIME_INSTRUCTIONS } from './openai-instructions.js';
import { createSegmentParser } from './segment-parser.js';
import { sceneRefusal } from '../../core/scene-admission.js';

function seal(text) {
    const writer = createEventWriter('example');
    const stream = createCurrentStream({ admitScene: sceneRefusal });
    stream.apply(writer.next('current.open', { title: 'Example', origin: { kind: 'model', name: 'Example', provider: 'test' } }));
    const parser = createSegmentParser((type, body) => stream.apply(writer.next(type, body)));
    parser.push(text);
    parser.finish();
    stream.apply(writer.next('current.complete', {}));
    return stream;
}

describe('the instructions', () => {
    it('teach the beat lines with two worked examples, written into them verbatim', () => {
        expect(BEAT_EXAMPLES).toHaveLength(2);
        for (const example of BEAT_EXAMPLES) expect(REALTIME_INSTRUCTIONS).toContain(example);
        for (const directive of ['@say', '@show hold=', '@hold', '@scene', '=>', 'scene=', 'cue=']) expect(REALTIME_INSTRUCTIONS).toContain(directive);
    });

    it('name every engine a native scene may use', () => {
        for (const engine of SCENE_ENGINES.filter(id => id !== 'still')) expect(REALTIME_INSTRUCTIONS).toContain(`${engine}:`);
    });

    it('teach only what RISE keeps: every line of each example is read, nothing is dropped, and the Worker accepts what it seals to', async () => {
        for (const example of BEAT_EXAMPLES) {
            const stream = seal(example);
            expect(stream.snapshot()).toMatchObject({ phase: 'complete', refusals: 0 });
            expect(stream.refusedScenes).toEqual([]);
            const current = stream.toCurrent();
            const beatLines = example.split('\n').filter(line => /^@(say|show|hold)\b/u.test(line));
            expect(current.beats, example).toHaveLength(beatLines.length);
            const options = beatLines.join(' ').match(/\b(scene|cue|place|size)=\S+/gu) ?? [];
            const kept = current.beats.reduce((sum, beat) => sum + ['scene', 'cue', 'place', 'size'].filter(key => beat[key] !== undefined).length, 0);
            expect(kept, example).toBe(options.length);
            const response = dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: TOOL_NAME, arguments: { current } } }, 'https://rise.invalid');
            const { result } = await response.json();
            expect(result.isError, result.content?.map(item => item.text).join('\n')).not.toBe(true);
        }
    });

    it('ask a Dive in beats too', () => {
        const asked = promptFor({ intent: 'dive', prompt: 'Why?', parent: { context: ['Before.', 'Here.'], atCharacter: 2 } });
        expect(asked).toMatch(/in beats, briefly/u);
    });
});
