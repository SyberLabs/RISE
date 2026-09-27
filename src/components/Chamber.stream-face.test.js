import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chamber } from './Chamber.js';

const chamberCss = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Chamber.css'), 'utf8');

function makeChamber(settings = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const session = {
        title: 'Stream face',
        atoms: [{ content: 'hello', duration: 500 }],
        totalDuration: 500,
        atomCount: 1,
        visualConfig: { visualMode: 'off' }
    };
    const chamber = new Chamber(container, {
        session,
        player: null,
        autoStart: false,
        getSettings: () => settings
    });
    return { chamber, container, settings };
}

describe('Chamber stream face', () => {
    afterEach(() => {
        document.body.replaceChildren();
    });

    it('applies the selected allowlisted face to the live atom display', () => {
        const { chamber, container } = makeChamber({ chamberFace: 'jp' });
        const el = container.querySelector('#atom-display');
        expect(el.dataset.chamberFace).toBe('jp');
        chamber.destroy();
    });

    it.each(['sans', 'book'])('applies the %s face to the live atom display', chamberFace => {
        const { chamber, container } = makeChamber({ chamberFace });
        expect(container.querySelector('#atom-display').dataset.chamberFace).toBe(chamberFace);
        chamber.destroy();
    });

    it('maps Sans to regular primary sans and Book to semibold literary type', () => {
        expect(chamberCss).toMatch(/\.atom-display\[data-chamber-face="sans"\]\s*\{[^}]*--font-stream-face:\s*var\(--font-primary\);[^}]*--font-stream-weight:\s*var\(--font-weight-regular\);/s);
        expect(chamberCss).toMatch(/\.atom-display\[data-chamber-face="book"\]\s*\{[^}]*--font-stream-face:\s*var\(--font-literary\);[^}]*--font-stream-weight:\s*var\(--font-weight-semibold\);/s);

        const bookFace = chamberCss.indexOf('.atom-display[data-chamber-face="book"]');
        const mask = chamberCss.indexOf('.atom-display.is-mask {', bookFace);
        expect(mask).toBeGreaterThan(bookFace);
        expect(chamberCss.slice(mask, chamberCss.indexOf('}', mask))).toContain('--font-stream-face: var(--font-stream-thick);');
    });

    it('falls back to literary when the stored face is unknown', () => {
        const { chamber, container } = makeChamber({ chamberFace: 'papyrus' });
        expect(container.querySelector('#atom-display').dataset.chamberFace).toBe('literary');
        chamber.destroy();
    });

    it('re-reads the latest persisted chamberFace when the session starts', () => {
        const { chamber, container, settings } = makeChamber({ chamberFace: 'literary' });
        expect(container.querySelector('#atom-display').dataset.chamberFace).toBe('literary');

        settings.chamberFace = 'thick';
        chamber.beginSession();
        expect(container.querySelector('#atom-display').dataset.chamberFace).toBe('thick');
        chamber.destroy();
    });
});
