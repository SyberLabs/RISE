/**
 * WHILE `IMAGE_STREAM_ENABLED` IS OFF, THE CHAMBER NEVER LOADS OR BUILDS THE STREAM.
 *
 * The real flag, not a mock: whatever the session says and whatever the
 * Chamber is handed, the presenter's module is never imported, no canvas is
 * mounted, and nothing is allocated for it. The flag-on half is
 * Chamber.image-stream-enabled.test.js.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
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

    // The launch gate hands the Chamber a Gallery session for a stream (it
    // never sees 'stream'), so this is the session that reaches the flag check.
    it('never loads or mounts the stream for a Gallery session, even when told it may', async () => {
        const { chamber, container, player } = mount('continuous');
        await settle();
        player.emit('state', { state: 'playing' });
        player.emit('state', { state: 'paused' });
        await settle();
        expect(presenter.loads).toBe(0);
        expect(container.querySelector('canvas.image-stream')).toBeNull();
        expect(container.querySelector('.chamber-image-stream')).toBeNull();
        chamber.destroy();
    });

    it('reaches the presenter only through a lazy import', () => {
        const source = readFileSync(resolve(import.meta.dirname, 'Chamber.js'), 'utf8');
        expect(source).not.toMatch(/^import[^;]*image-stream\.js/mu);
        expect(source).toContain("import('../../visuals/image-stream.js')");
    });

    /** Every production module under src/ but src/content, as [path, text]. */
    function productionSources() {
        // src/content is 127 MB of works held as data; no code there calls
        // the Chamber or the presenter, and flashing-disabled.test.js already
        // checks it for presentation names.
        const SRC = resolve(import.meta.dirname, '../..');
        const CONTENT = join(SRC, 'content');
        const found = [];
        const walk = (dir) => {
            for (const entry of readdirSync(dir)) {
                const full = join(dir, entry);
                if (statSync(full).isDirectory()) { if (full !== CONTENT) walk(full); continue; }
                if (!entry.endsWith('.js') || /\.(?:test|spec)\.js$/u.test(entry)) continue;
                found.push([relative(SRC, full).replace(/\\/gu, '/'), readFileSync(full, 'utf8')]);
            }
        };
        walk(SRC);
        return found;
    }

    /** The body of Chamber's _mountImageStream, the one place the presenter may be reached. */
    function mountMethod(text) {
        return text.match(/\n {2}async _mountImageStream\(field\) \{[\s\S]*?\r?\n {2}\}\r?\n/u)?.[0] ?? '';
    }

    it('starts the stream from no call site in src/ that is not inside the flag and the grant', () => {
        const GUARD = 'if (IMAGE_STREAM_ENABLED && this.imageStreamGranted) {';
        const offenders = [];
        let calls = 0;
        for (const [path, text] of productionSources()) {
            if (!text.includes('_mountImageStream(')) continue;
            for (const match of text.matchAll(/_mountImageStream\(/gu)) {
                const before = text.slice(0, match.index);
                if (before.trimEnd().endsWith('async')) continue;
                calls += 1;
                const guard = before.lastIndexOf(GUARD);
                // Inside the guarded block: the guard precedes it and no
                // brace has closed since.
                if (guard === -1 || before.slice(guard + GUARD.length).includes('}')) {
                    offenders.push(`${path}:${before.split('\n').length}`);
                }
            }
        }
        expect(calls).toBeGreaterThan(0);
        expect(offenders).toEqual([]);
    }, 30_000);

    it('lets nothing in src/ import the presenter or mount it except that one method', () => {
        const offenders = [];
        let imports = 0;
        for (const [path, text] of productionSources()) {
            if (path === 'visuals/image-stream.js') continue;
            const allowed = path === 'components/read/Chamber.js' ? mountMethod(text) : '';
            // A module specifier: a quoted path ending in image-stream or image-stream.js.
            for (const match of text.matchAll(/['"`][^'"`\n]*\/image-stream(?:\.js)?['"`]/gu)) {
                imports += 1;
                const statement = text.slice(Math.max(0, match.index - 8), match.index + match[0].length + 1);
                if (!(allowed && allowed.includes(statement))) offenders.push(`${path}: ${match[0]}`);
            }
            for (const match of text.matchAll(/(?<![\w.])mountImageStream\(|\.mountImageStream\(/gu)) {
                const around = text.slice(match.index - 1, match.index + 40);
                if (!(allowed && allowed.includes(around))) offenders.push(`${path}: mountImageStream(`);
            }
        }
        expect(imports).toBe(1);
        expect(offenders).toEqual([]);
    }, 30_000);
});
