import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ingestCorpus } from './corpus.js';
import { demoCorpusInput, demoDeck } from './demo.js';
import { createDeviceDecider, DEVICE_PROVIDER } from './device-decider.js';
import { DEVICE_MODELS, ORT_WASM, runMatches } from './device-model.js';
import { createLiveLoop } from './live.js';
import { prepareTalk } from './prepare.js';
import { RAIL_QUESTION } from './rail-question.js';
import { openSession } from './session.js';

const ROOT = join(import.meta.dirname, '..', '..');

function room() {
    const corpus = ingestCorpus(demoCorpusInput());
    const program = prepareTalk({ deck: demoDeck(), corpus, audienceId: 'all-hands', presenterId: 'ada' });
    return openSession({ program, corpus, now: (at) => at, sessionId: 'room1' });
}

const atlas = { text: 'Atlas renewal price', final: true, speaker: 'presenter', speakerId: 'ada', at: 0 };

/** A worker that loads instantly and answers with whatever `answer` returns. */
function fakeWorker({ answer, fail } = {}) {
    const sent = [];
    const worker = {
        sent,
        terminated: false,
        onmessage: null,
        onerror: null,
        postMessage(message) {
            sent.push(message);
            queueMicrotask(() => {
                if (message.type === 'load') {
                    if (fail) worker.onmessage({ data: { type: 'failed', code: fail } });
                    else worker.onmessage({ data: { type: 'ready', info: { run: 'jaredpalmer/kev-4b@139fdd94f1b6a6ad80cc15e08fcb99cac885a101', revision: 'r1', adapter: { vendor: 'nvidia' } } } });
                }
                if (message.type === 'ask') {
                    const response = answer?.(message.request);
                    if (response !== undefined) worker.onmessage({ data: { type: 'answer', id: message.id, response, inferenceMs: 12 } });
                }
            });
        },
        terminate() { worker.terminated = true; }
    };
    return worker;
}

const choose = (choice, confidence = 0.7) => () => ({ answers: { [RAIL_QUESTION]: { type: 'choice', choice, confidence, probabilities: {} } } });

describe('device model pins', () => {
    it('match only the pinned repo at a commit with the pinned prefix', () => {
        expect(runMatches('jaredpalmer/kev-4b@4bc64c6f00d', 'jaredpalmer/kev-4b@4bc64c6')).toBe(true);
        expect(runMatches('jaredpalmer/kev-4b@4bc64c6', 'jaredpalmer/kev-4b@4bc64c6')).toBe(true);
        expect(runMatches('jaredpalmer/kev-4b@139fdd9', 'jaredpalmer/kev-4b@4bc64c6')).toBe(false);
        expect(runMatches('someone/kev-4b@4bc64c6', 'jaredpalmer/kev-4b@4bc64c6')).toBe(false);
        expect(runMatches('jaredpalmer/kev-4b', 'jaredpalmer/kev-4b@4bc64c6')).toBe(false);
        expect(runMatches(undefined, 'jaredpalmer/kev-4b@4bc64c6')).toBe(false);
    });

    it('pins Kev-4B on the device to the checkpoint local RISE serves', () => {
        const serving = readFileSync(join(ROOT, 'deploy/kev/local_app.py'), 'utf8');
        const revision = serving.match(/^KEV_MODEL_REVISION = "([0-9a-f]{40})"$/mu)?.[1];
        expect(revision).toBeTruthy();
        expect(DEVICE_MODELS['kev-4b'].run).toBe(`jaredpalmer/kev-4b@${revision}`);
        expect(runMatches(`jaredpalmer/kev-4b@${revision}`, DEVICE_MODELS['kev-4b'].run)).toBe(true);
        expect(runMatches('jaredpalmer/kev-4b@4bc64c6f00d', DEVICE_MODELS['kev-4b'].run)).toBe(false);
    });

    it('pins the runtime binary the lockfile installed', () => {
        const bytes = readFileSync(join(ROOT, 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jspi.wasm'));
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(ORT_WASM.sha256);
    });

    it('loads weights only over https from the published bundle', () => {
        for (const model of Object.values(DEVICE_MODELS)) {
            expect(model.base).toMatch(/^https:\/\/huggingface\.co\/ai-ecoverse\/kev\.js\/resolve\//u);
        }
    });
});

describe('device decider', () => {
    it('refuses to decide before it is loaded, while loading, and after a failed load', async () => {
        const context = room().prepare(atlas).context;
        const idle = createDeviceDecider({ createWorker: () => fakeWorker() });
        await expect(idle.decide(context)).rejects.toMatchObject({ reason: 'unavailable' });

        const loading = createDeviceDecider({ createWorker: () => fakeWorker() });
        const done = loading.load();
        await expect(loading.decide(context)).rejects.toMatchObject({ reason: 'loading' });
        await done;

        const failed = createDeviceDecider({ createWorker: () => fakeWorker({ fail: 'no-webgpu' }) });
        expect(await failed.load()).toMatchObject({ state: 'failed', code: 'no-webgpu' });
        await expect(failed.decide(context)).rejects.toMatchObject({ reason: 'unavailable' });
    });

    it('asks the shared question with titles only and maps the choice back', async () => {
        const worker = fakeWorker({ answer: choose('show_1_quote') });
        const device = createDeviceDecider({ createWorker: () => worker });
        await device.load();
        const context = room().prepare(atlas).context;
        const result = await device.decide(context);
        expect(result.raw).toEqual({ action: 'show', cardId: context.structure.candidates[0].id, layout: 'quote' });
        expect(result.meta).toMatchObject({ provider: DEVICE_PROVIDER, model: 'jaredpalmer/kev-4b@139fdd94f1b6a6ad80cc15e08fcb99cac885a101', confidence: 0.7 });
        const request = JSON.stringify(worker.sent.find(message => message.type === 'ask').request);
        expect(request).not.toContain('card:');
        expect(request).not.toContain('12.4');
        expect(request).not.toContain('880');
    });

    it.each([
        ['an option that was not offered', choose('show_9_quote')],
        ['a raw card id', choose('card:atlas-renewal:passage:pricing:1')],
        ['a confidence above one', choose('hold', 3)],
        ['a missing answer', () => ({ answers: {} })],
        ['a non-choice answer', () => ({ answers: { [RAIL_QUESTION]: { type: 'noul', noul: 0.9 } } })]
    ])('refuses %s', async (_, answer) => {
        const device = createDeviceDecider({ createWorker: () => fakeWorker({ answer }) });
        await device.load();
        await expect(device.decide(room().prepare(atlas).context)).rejects.toMatchObject({ reason: 'invalid' });
    });

    it('holds through the live loop when the device answers late, badly, or not at all', async () => {
        const session = room();
        const device = createDeviceDecider({ createWorker: () => fakeWorker({ answer: () => undefined }) });
        await device.load();
        const loop = createLiveLoop({ session, decide: device.decide, timeoutMs: 50 });
        expect(await loop.hear(atlas)).toMatchObject({ action: 'hold', reason: 'timeout' });
        expect(session.rail()).toEqual([]);
    });

    it('shows through the live loop and records the device as the decider', async () => {
        const session = room();
        const device = createDeviceDecider({ createWorker: () => fakeWorker({ answer: choose('show_1_quote') }) });
        await device.load();
        const loop = createLiveLoop({ session, decide: device.decide });
        expect(await loop.hear(atlas)).toMatchObject({ action: 'show' });
        expect(session.rail()[0].decidedBy).toBe(DEVICE_PROVIDER);
        expect(session.stage()).toEqual([]);
    });

    it('fails closed when the worker cannot start or crashes', async () => {
        const none = createDeviceDecider({ createWorker: () => { throw new Error('no workers'); } });
        expect(await none.load()).toMatchObject({ state: 'failed', code: 'no-worker' });

        const worker = fakeWorker({ answer: () => undefined });
        const device = createDeviceDecider({ createWorker: () => worker });
        await device.load();
        const pending = device.decide(room().prepare(atlas).context);
        worker.onerror(new Event('error'));
        await expect(pending).rejects.toMatchObject({ reason: 'error' });
        expect(device.status()).toMatchObject({ state: 'failed', code: 'crashed' });
    });
});
