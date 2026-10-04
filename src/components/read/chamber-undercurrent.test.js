import { beforeEach, describe, expect, it } from 'vitest';
import { renderUndercurrent } from './chamber-undercurrent.js';

let panel;

beforeEach(() => {
    panel = document.createElement('div');
});

const written = (authority, text = 'A note about this passage.') => ({
    id: 'g', kind: 'gloss', provenance: 'written', authority, text
});
const received = (text = 'It says it plainly') => ({
    id: 'e', kind: 'echo', provenance: 'received', source: 'primary', text
});
const under = (threads = [], extra = {}) => ({ threads, visual: null, audio: null, ...extra });

describe('the panel under a passage', () => {
    it('says so plainly when nothing lies under the passage', () => {
        renderUndercurrent(panel, under());
        expect(panel.textContent).toBe('Nothing lies under this passage.');
    });

    it('shows a gloss and says who wrote it, by authority', () => {
        for (const [authority, said] of [
            ['published', 'Written for this reading'],
            ['user', 'Written by you'],
            ['proposed', 'Proposed, not yet accepted']
        ]) {
            renderUndercurrent(panel, under([written(authority)]));
            const item = panel.querySelector('li');
            expect(item.dataset.kind).toBe('gloss');
            expect(item.dataset.provenance).toBe('written');
            expect(item.textContent).toContain('A note about this passage.');
            expect(item.textContent).toContain(said);
        }
    });

    it('shows an echo in quotation marks and says it is from the text', () => {
        renderUndercurrent(panel, under([received()]));
        const item = panel.querySelector('li');
        expect(item.dataset.kind).toBe('echo');
        expect(item.dataset.provenance).toBe('received');
        expect(item.querySelector('blockquote').textContent).toBe('\u201CIt says it plainly\u201D');
        expect(item.textContent).toContain('From the text');
    });

    it('sets words as text, never as markup', () => {
        renderUndercurrent(panel, under([
            written('proposed', '<img src=x onerror="window.__pwned = 1"><b>bold</b>')
        ]));
        expect(panel.querySelector('img')).toBeNull();
        expect(panel.querySelector('b')).toBeNull();
        expect(panel.textContent).toContain('<img src=x onerror="window.__pwned = 1"><b>bold</b>');
    });

    it('lists threads in the order given', () => {
        renderUndercurrent(panel, under([written('user', 'First.'), received('Second'), written('user', 'Third.')]));
        expect([...panel.querySelectorAll('li')].map(li => li.dataset.kind))
            .toEqual(['gloss', 'echo', 'gloss']);
    });

    it('notes an image and a sound the score puts here, without naming ids', () => {
        renderUndercurrent(panel, under([], {
            visual: { id: 'v1', cue: { kind: 'sourced', collections: ['aic-landscapes'] } },
            audio: { id: 'a1', cue: { kind: 'soundscape', soundscapeId: 'aurora' } }
        }));
        expect(panel.textContent).toContain('The score puts an image here.');
        expect(panel.textContent).toContain('The score puts a sound here.');
        expect(panel.textContent).not.toContain('aic-landscapes');
        expect(panel.textContent).not.toContain('aurora');
        expect(panel.textContent).not.toContain('Nothing lies under this passage.');
    });

    it('replaces what was there instead of adding to it', () => {
        renderUndercurrent(panel, under([written('user', 'One.')]));
        renderUndercurrent(panel, under([written('user', 'Two.')]));
        expect(panel.querySelectorAll('li')).toHaveLength(1);
        expect(panel.textContent).toContain('Two.');
        expect(panel.textContent).not.toContain('One.');
    });

    it('answers how many threads it showed', () => {
        expect(renderUndercurrent(panel, under())).toBe(0);
        expect(renderUndercurrent(panel, under([written('user'), received()]))).toBe(2);
    });
});
