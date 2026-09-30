/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { Emotions, emotionInhabitants } from './Emotions.js';

describe('RISE EMOTIONS', () => {
    it('keeps texts, colors, and visuals that have a place, and leaves white out', () => {
        const inhabitants = emotionInhabitants();
        const kinds = new Set(inhabitants.map(item => item.kind));
        expect(kinds).toEqual(new Set(['text', 'color', 'visual']));
        expect(inhabitants.some(item => item.label === 'Meditations' && item.place.mode === 'plane')).toBe(true);
        expect(inhabitants.some(item => item.id === 'color-red' && item.place.mode === 'ring')).toBe(true);
        expect(inhabitants.some(item => item.label === 'Ember Cathedral' && item.place.valence == null)).toBe(true);
        expect(inhabitants.some(item => item.id === 'color-white')).toBe(false);
    });

    it('opens the map and returns home', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const onNavigate = vi.fn();
        const room = new Emotions(container, { onNavigate });
        expect(container.querySelector('h1').textContent).toBe('RISE EMOTIONS');
        expect(container.querySelector('canvas.emotions-field')).not.toBeNull();
        expect(container.textContent).toContain('Hue follows warmth');
        expect(container.querySelector('[data-kind="text"]')).not.toBeNull();
        expect(container.querySelector('[data-kind="color"]')).not.toBeNull();
        expect(container.querySelector('[data-kind="visual"]')).not.toBeNull();
        container.querySelector('[data-action="back"]').click();
        expect(onNavigate).toHaveBeenCalledWith('portal');
        room.destroy();
        container.remove();
    });
});
