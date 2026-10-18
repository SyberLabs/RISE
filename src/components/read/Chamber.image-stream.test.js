/**
 * WHILE `IMAGE_STREAM_ENABLED` IS OFF, THE CHAMBER NEVER LOADS OR BUILDS THE STREAM.
 *
 * The real flag, not a mock: whatever the session says and whatever the
 * Chamber is handed, the presenter's module is never imported, no canvas is
 * mounted, and nothing is allocated for it. The flag-on half is
 * Chamber.image-stream-enabled.test.js.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { IMAGE_STREAM_ENABLED } from '../../core/visual-presence.js';

const presenter = vi.hoisted(() => ({ loads: 0 }));
vi.mock('../../visuals/image-stream.js', () => {
    presenter.loads += 1;
    return { mountImageStream: vi.fn(), decodeStreamFrames: vi.fn(async () => []) };
});

const { Chamber } = await import('./Chamber.js');

function fakePlayer() {
    const handlers = new Map();
    return {
        state: 'playing',
        on: (event, listener) => handlers.set(event, [...(handlers.get(event) || []), listener]),
        emit: (event, payload) => (handlers.get(event) || []).forEach(listener => listener(payload)),
        play: vi.fn(), pause: vi.fn(), stop: vi.fn(), setInterlocutionHandler: vi.fn()
    };
}

function mount(presentation) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const player = fakePlayer();
    const chamber = new Chamber(container, {
        session: {
            title: 'Probe',
            atoms: [{ content: 'First', duration: 500 }, { content: 'Second', duration: 500 }],
            totalDuration: 1000,
            atomCount: 2,
            visualConfig: { visualMode: 'interlocution', interlocution: { presentation, procedural: ['fractal'] } }
        },
        player,
        autoStart: false,
        // What the gate grants only with the flag on and the notice accepted:
        // handed here anyway, to show the flag alone is enough.
        imageStream: true
    });
    return { chamber, container, player };
}

const settle = async () => { for (let i = 0; i < 5; i += 1) await new Promise(r => setTimeout(r, 0)); };

afterEach(() => {
    document.body.replaceChildren();
});

describe('the Chamber with the image stream flag off', () => {
    it('is off', () => {
        expect(IMAGE_STREAM_ENABLED).toBe(false);
    });

    for (const presentation of ['continuous', 'stream']) {
        it(`never loads or mounts the stream for a ${presentation} session, even when told it may`, async () => {
            const { chamber, container, player } = mount(presentation);
            await settle();
            player.emit('state', { state: 'playing' });
            player.emit('state', { state: 'paused' });
            await settle();
            expect(presenter.loads).toBe(0);
            expect(container.querySelector('canvas.image-stream')).toBeNull();
            expect(container.querySelector('.chamber-image-stream')).toBeNull();
            chamber.destroy();
        });
    }

    it('reaches the presenter only through a lazy import behind the flag', () => {
        const source = readFileSync(resolve(import.meta.dirname, 'Chamber.js'), 'utf8');
        expect(source).not.toMatch(/^import[^;]*image-stream\.js/mu);
        const lazy = source.indexOf("import('../../visuals/image-stream.js')");
        expect(lazy).toBeGreaterThan(-1);
        expect(source).toContain('IMAGE_STREAM_ENABLED && this.imageStreamGranted');
    });
});
