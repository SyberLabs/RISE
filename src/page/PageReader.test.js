import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PageReader } from './PageReader.js';

/**
 * The Page Reader (PAGE-MODE-SPEC §3.3). jsdom has no layout and no
 * IntersectionObserver by default, which suits us: the renderer's
 * eager path is exercised directly, and the contracts under test are
 * structural — reverent degradation, decode-before-reveal, determinism,
 * and the attribution obligation.
 */

const atom = (content, extra = {}) => ({ content, modality: 'text', weight: 0.5, tags: [], ...extra });

const program = {
    coordinateSpace: 'scripture',
    enabled: true,
    fallback: { kind: 'still' },
    segments: [
        {
            id: 'before-pilate',
            match: { chapter: 27, verseStart: 1, verseEnd: 2 },
            cue: { kind: 'sourced', collections: ['chapel-gospel-before-pilate'] }
        }
    ]
};

const session = {
    atoms: [
        atom('And when morning was come,', { chapter: 27, verse: 1 }),
        atom('they bound him and led him away.', { chapter: 27, verse: 2 })
    ],
    visualProgram: program
};

const work = (url, extra = {}) => ({
    name: 'A Work',
    data: { url, title: 'Christ before Pilate', artist: 'Master', sourceName: 'AIC', ...extra }
});

function mount(options = {}) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const reader = new PageReader(host, { session, ...options });
    return { reader, host };
}

// A decode that always succeeds, so tests exercise reveal, not the network.
beforeEach(() => {
    vi.spyOn(PageReader.prototype, '_decode').mockResolvedValue(true);
});
afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
});

/**
 * Let the fill chain complete: resolve → decode → DOM are separate
 * awaits, so a macrotask turn (not a few microtasks) is what settles it.
 */
const settle = async () => { await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0)); };

describe('PageReader', () => {
    it('renders the typeset column: text in the measure, verse marks in the margin', () => {
        const { reader, host } = mount({ resolveCollection: async () => [] });
        reader.render();
        const texts = host.querySelectorAll('.page-text');
        expect(texts.length).toBe(2);
        expect(host.querySelectorAll('.page-verse').length).toBe(2);
        expect(texts[0].textContent).toContain('And when morning was come');
        reader.destroy();
    });

    it('opens a chapter with its numeral', () => {
        const { reader, host } = mount({ resolveCollection: async () => [] });
        reader.render();
        expect(host.querySelector('.page-chapter').textContent).toBe('27');
        reader.destroy();
    });

    it('shows a resolved work with its caption', async () => {
        const { reader, host } = mount({ resolveCollection: async () => [work('a.jpg')] });
        reader.render();
        await settle();
        const fig = host.querySelector('.page-figure');
        expect(fig.classList.contains('is-shown')).toBe(true);
        expect(fig.querySelector('img').getAttribute('src')).toBe('a.jpg');
        expect(fig.querySelector('figcaption').textContent).toContain('Christ before Pilate');
        reader.destroy();
    });

    it('REVERENT DEGRADATION: an unresolvable collection leaves no frame', async () => {
        const { reader, host } = mount({ resolveCollection: async () => [] });
        reader.render();
        await settle();
        const fig = host.querySelector('.page-figure');
        expect(fig.classList.contains('is-absent')).toBe(true);
        expect(fig.querySelector('img')).toBeNull();
        // the text still composed
        expect(host.querySelectorAll('.page-text').length).toBe(2);
        reader.destroy();
    });

    it('a resolver that throws degrades to absence, never a crash', async () => {
        const { reader, host } = mount({ resolveCollection: async () => { throw new Error('provider down'); } });
        reader.render();
        await settle();
        expect(host.querySelector('.page-figure').classList.contains('is-absent')).toBe(true);
        expect(host.querySelectorAll('.page-text').length).toBe(2);
        reader.destroy();
    });

    it('a work that fails to decode is withheld, not shown broken', async () => {
        PageReader.prototype._decode.mockResolvedValue(false);
        const { reader, host } = mount({ resolveCollection: async () => [work('bad.jpg')] });
        reader.render();
        await settle();
        const fig = host.querySelector('.page-figure');
        expect(fig.classList.contains('is-absent')).toBe(true);
        expect(fig.querySelector('img')).toBeNull();
        reader.destroy();
    });

    it('resolves each collection ONCE however many figures reference it', async () => {
        const resolveCollection = vi.fn(async () => [work('a.jpg')]);
        const { reader } = mount({ resolveCollection });
        reader.render();
        await settle();
        expect(resolveCollection).toHaveBeenCalledTimes(1);
        reader.destroy();
    });

    it('is DETERMINISTIC — the same page shows the same work (re-readable)', async () => {
        const works = [work('a.jpg'), work('b.jpg'), work('c.jpg')];
        const first = mount({ resolveCollection: async () => works });
        first.reader.render();
        await settle();
        const a = first.host.querySelector('.page-figure img').getAttribute('src');
        first.reader.destroy();

        const second = mount({ resolveCollection: async () => works });
        second.reader.render();
        await settle();
        const b = second.host.querySelector('.page-figure img').getAttribute('src');
        second.reader.destroy();

        expect(a).toBe(b);
    });

    it('ATTRIBUTION: a credit-required work shows its full credit', async () => {
        const cc = {
            name: 'Nebula',
            data: {
                url: 'n.jpg', title: 'Carina Nebula', artist: 'NASA/ESA',
                sourceName: 'ESA/Hubble', rightsBasis: 'CC BY 4.0', creditRequired: true
            }
        };
        const { reader, host } = mount({ resolveCollection: async () => [cc] });
        reader.render();
        await settle();
        const cap = host.querySelector('.page-figure-caption');
        expect(cap.classList.contains('is-required-credit')).toBe(true);
        expect(cap.textContent).toContain('Carina Nebula');
        expect(cap.textContent).toContain('ESA/Hubble');
        reader.destroy();
    });

    it('a plain reading with no program typesets text and no figures', async () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const reader = new PageReader(host, {
            session: { atoms: [atom('The pendulum draws the chord it hears.')], visualProgram: null },
            resolveCollection: async () => [work('a.jpg')]
        });
        reader.render();
        await settle();
        expect(host.querySelectorAll('.page-text').length).toBe(1);
        expect(host.querySelectorAll('.page-figure').length).toBe(0);
        reader.destroy();
    });

    it('reports the collections it will need (for pre-warming)', () => {
        const { reader } = mount({ resolveCollection: async () => [] });
        expect(reader.collections()).toEqual(['chapel-gospel-before-pilate']);
        reader.destroy();
    });

    it('destroy clears the host and stops further fills', async () => {
        const { reader, host } = mount({ resolveCollection: async () => [work('a.jpg')] });
        reader.render();
        reader.destroy();
        await settle();
        expect(host.querySelector('.page-article')).toBeNull();
        expect(host.classList.contains('page-reader')).toBe(false);
    });
});
