/**
 * The three conditions that are not a live Current.
 *
 * What is held is that they show the same answer: the same words in the same
 * order, the sources where the medium can carry them, and the side answer at the
 * place every condition gives it; that the visualizer reacts to the speech and
 * to nothing in it; and that a voice that fails is said, and recorded, not
 * hidden.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVirtualClock } from '../clock.js';
import { BLACK_HOLES, HORIZON_DIVE } from '../fixtures/black-holes.js';
import { createSyntheticVoice } from '../voices/synthetic.js';
import { createPresenters, spokenPresenter, textPresenter } from './presenters.js';
import { cite, scriptParts, spokenLines } from './script.js';

const fields = [];
vi.mock('../../visuals/attractor.js', () => ({
    AttractorField: class {
        constructor(host, options) { this.host = host; this.options = options; this.intensity = options.intensity; this.calls = []; this.destroyed = false; fields.push(this); }
        setIntensity(value) { this.calls.push(value); this.intensity = value; }
        destroy() { this.destroyed = true; }
    }
}));

afterEach(() => {
    document.body.replaceChildren();
    fields.length = 0;
    vi.useRealTimers();
});

const flush = async () => { for (let i = 0; i < 10; i += 1) await Promise.resolve(); };

describe('the fixed answer, cut once', () => {
    it('says every passage once, in order, with its sources and the side answer where it belongs', () => {
        const parts = scriptParts();
        expect(parts.filter(part => part.kind === 'passage').map(part => part.id)).toEqual(BLACK_HOLES.segments.map(segment => segment.id));
        expect(parts.filter(part => part.kind === 'passage').map(part => part.text)).toEqual(BLACK_HOLES.segments.map(segment => segment.text));
        expect(parts.filter(part => part.kind === 'source').map(part => part.text)).toEqual(
            BLACK_HOLES.segments.flatMap(segment => (segment.evidence ?? []).map(cite))
        );
        const at = parts.findIndex(part => part.kind === 'side-question');
        expect(parts[at - 1].id).toBe('size');
        expect(parts.slice(at + 1, at + 3).map(part => part.text)).toEqual(HORIZON_DIVE.segments.map(segment => segment.text));
        expect(parts[at + 3].kind).toBe('return');
        expect(parts[at + 4].id).toBe('shadow');
    });

    it('is the same for the ear: the same parts, with a source named as one and the side question said', () => {
        const lines = spokenLines();
        expect(lines).toHaveLength(scriptParts().length);
        expect(lines.filter(line => line.kind === 'source').every(line => /^Source: .*\.$/u.test(line.text))).toBe(true);
        expect(lines.find(line => line.kind === 'side-question').text).toMatch(/side question was asked about the event horizon/u);
        expect(new Set(lines.map(line => `${line.kind}-${line.id}`)).size).toBe(lines.length);
    });
});

describe('text', () => {
    it('shows all of it at once, sources as notes, the side question and answer in place, and waits to be told it is read', () => {
        const container = document.createElement('div');
        document.body.append(container);
        const done = vi.fn();
        textPresenter({ container, done });
        const paragraphs = [...container.querySelectorAll('p')].map(p => p.textContent);
        for (const segment of BLACK_HOLES.segments) expect(paragraphs).toContain(segment.text);
        for (const segment of HORIZON_DIVE.segments) expect(paragraphs).toContain(segment.text);
        expect(paragraphs.some(text => text.startsWith('Source: First M87 Event Horizon Telescope Results'))).toBe(true);
        const order = ['A black hole is a region', 'For a black hole that does not spin', 'The event horizon is where', 'In 2019, the Event Horizon Telescope'];
        const at = order.map(start => paragraphs.findIndex(text => text.startsWith(start)));
        expect(at).toEqual([...at].sort((a, b) => a - b));
        expect(done).not.toHaveBeenCalled();
        container.querySelector('button').click();
        expect(done).toHaveBeenCalledTimes(1);
    });

    it('draws its words as text and nothing else', () => {
        const container = document.createElement('div');
        textPresenter({ container, done() {} });
        expect(container.querySelectorAll('script, img, style, a[href]')).toHaveLength(0);
    });
});

function speak({ visualizer = false, voiceKind = () => 'browser' } = {}) {
    const clock = createVirtualClock();
    const voice = createSyntheticVoice({ clock, msPerChar: 2, breathMs: 5 });
    const spoken = [];
    const original = voice.enqueue.bind(voice);
    voice.enqueue = utterance => { spoken.push(utterance); return original(utterance); };
    const container = document.createElement('div');
    document.body.append(container);
    const notes = {};
    const done = vi.fn();
    const presenter = spokenPresenter({
        container, done, visualizer, voiceKind,
        voices: async () => ({ create: () => voice }),
        note: (key, value) => { notes[key] = value; }
    });
    return { clock, voice, spoken, container, notes, done, presenter };
}

describe('spoken', () => {
    it('says every line in the answer’s order, notes what kind of voice it was, and finishes when the last is said', async () => {
        const { clock, spoken, container, notes, done } = speak();
        await flush();
        expect(notes.voice).toBe('browser');
        expect(spoken.map(item => item.text)).toEqual(spokenLines().map(line => line.text));
        expect(container.querySelector('.live-eval__status').textContent).toBe('Listening…');
        expect(container.querySelector('button')).toBeNull();
        await clock.runAll();
        expect(container.querySelector('.live-eval__status').textContent).toBe('The answer has finished.');
        expect(done).not.toHaveBeenCalled();
        container.querySelector('button').click();
        expect(done).toHaveBeenCalledTimes(1);
        expect(container.querySelector('canvas, .live-eval__field')).toBeNull();
    });

    it('records a silent voice as one, so the run can be left out of the analysis', async () => {
        const { notes } = speak({ voiceKind: () => 'paced' });
        await flush();
        expect(notes.voice).toBe('paced');
    });

    it('says the voice stopped, records it, and lets the participant go on', async () => {
        const clock = createVirtualClock();
        const container = document.createElement('div');
        document.body.append(container);
        const notes = {};
        let report = null;
        spokenPresenter({
            container, done() {}, voiceKind: () => 'browser',
            voices: async () => ({ create: () => ({ attach: r => { report = r; }, enqueue() {}, close() {} }) }),
            note: (key, value) => { notes[key] = value; }
        });
        await flush();
        report.fail('passage-what', 'synthesis-failed');
        expect(notes.voice).toBe('failed');
        expect(container.querySelector('.live-eval__status').textContent).toBe('The voice stopped.');
        expect(container.querySelector('button')).not.toBeNull();
        void clock;
    });

    it('lets go of the voice when it is taken away', async () => {
        const { presenter, voice, clock } = speak();
        await flush();
        const close = vi.spyOn(voice, 'close');
        presenter.destroy();
        expect(close).toHaveBeenCalled();
        await clock.runAll();
    });
});

describe('spoken, over a generic visualizer', () => {
    it('puts one field behind the speech, of one fixed look, and pulses it on each word and nothing else', async () => {
        vi.useFakeTimers();
        const { clock, container } = speak({ visualizer: true });
        await flush();
        await vi.advanceTimersByTimeAsync(0);
        expect(fields).toHaveLength(1);
        expect(fields[0].options).toMatchObject({ system: 'aizawa', palette: 'white', form: 'mirror' });
        expect(container.querySelector('.live-eval__field')).not.toBeNull();
        await clock.advance(400);
        expect(fields[0].calls).toContain(0.85);
        await vi.advanceTimersByTimeAsync(300);
        expect(fields[0].intensity).toBe(0.5);
        await clock.runAll();
        // The imagery knows nothing of the words: it was only ever asked to be brighter or dimmer.
        expect(new Set(fields[0].calls)).toEqual(new Set([0.85, 0.5]));
    });

    it.each(['reduced-motion', 'photosensitivity-mode'])('does not pulse the field under %s', async mode => {
        document.documentElement.classList.add(mode);
        try {
            const { clock } = speak({ visualizer: true });
            await vi.waitFor(() => expect(fields).toHaveLength(1));
            await clock.runAll();
            expect(fields[0].calls).toEqual([]);
        } finally {
            document.documentElement.classList.remove(mode);
        }
    });

    it('is destroyed with the presenter, and the plain spoken condition has no field at all', async () => {
        const visual = speak({ visualizer: true });
        await flush();
        await visual.clock.advance(50);
        visual.presenter.destroy();
        expect(fields[0].destroyed).toBe(true);
        fields.length = 0;
        speak({ visualizer: false });
        await flush();
        expect(fields).toHaveLength(0);
    });
});

describe('the set of presenters', () => {
    it('has one for each condition the host does not present itself', () => {
        const presenters = createPresenters({ voices: async () => ({ create() {} }), voiceKind: () => 'browser', note() {} });
        expect(Object.keys(presenters).sort()).toEqual(['spoken', 'spoken-visualizer', 'text']);
    });
});
