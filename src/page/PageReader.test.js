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
    // jsdom never loads images. Settle the DISPLAYED element (the real
    // decode-before-reveal path) so tests exercise reveal, not the network.
    vi.spyOn(PageReader.prototype, '_settleImage').mockResolvedValue(true);
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

    it('a work whose DISPLAYED image fails is withheld, not shown broken', async () => {
        PageReader.prototype._settleImage.mockResolvedValue(false);
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

    it('a WRAPPED figure shares one containing block with its prose', async () => {
        // A float only wraps text that follows it in the SAME parent, so
        // the renderer must group them — otherwise the figure strands.
        const long = (n) => `Verse ${n}: and the governor answered and said unto them, whether of the twain will ye that I release unto you.`;
        const host = document.createElement('div');
        document.body.appendChild(host);
        const reader = new PageReader(host, {
            session: {
                atoms: [
                    atom('Opening prose before the plate entirely.', { chapter: 27, verse: 1 }),
                    atom(long(3), { chapter: 27, verse: 3 }),
                    atom(long(4), { chapter: 27, verse: 4 }),
                    atom(long(5), { chapter: 27, verse: 5 }),
                    atom(long(6), { chapter: 27, verse: 6 })
                ],
                // an episode starting at v3 whose plate demotes to a wrap
                visualProgram: {
                    coordinateSpace: 'scripture', enabled: true, fallback: { kind: 'still' },
                    segments: [{
                        id: 'e', match: { chapter: 27, verseStart: 3, verseEnd: 9 },
                        cue: { kind: 'sourced', collections: ['c'] }
                    }]
                }
            },
            resolveCollection: async () => [work('a.jpg')]
        });
        reader.render();
        await settle();

        const group = host.querySelector('.page-wrap');
        expect(group).not.toBeNull();
        // the figure and its wrapping prose are siblings inside the group
        expect(group.querySelector('.page-figure')).not.toBeNull();
        expect(group.querySelectorAll('.page-text').length).toBeGreaterThanOrEqual(3);
        // and the float is closed so later content starts a clean line
        expect(group.querySelector('.page-wrap-clear')).not.toBeNull();
        reader.destroy();
    });

    it('a real Session titles the masthead (name, not the title alias)', async () => {
        // Regression (red-team #9): Session stores the compiled title as
        // `name`; `title` is an input alias and is undefined on the model,
        // so every masthead was untitled. Injecting a title in the fixture
        // hid it — this test uses a REAL Session.
        const { Session } = await import('../core/models.js');
        const real = new Session({ title: 'Matthew 27', atoms: [] });
        expect(real.title).toBeUndefined();
        expect(real.name).toBe('Matthew 27');

        const host = document.createElement('div');
        document.body.appendChild(host);
        const reader = new PageReader(host, {
            session: { ...session, name: real.name, title: real.title },
            title: real.name || real.title || '',
            resolveCollection: async () => []
        });
        reader.render();
        expect(host.querySelector('.page-title').textContent).toBe('Matthew 27');
        reader.destroy();
    });

    it('honours the artwork-label preference, but never hides a required credit', async () => {
        // Regression (red-team #8): optional labels were hardcoded on, so
        // disabling "Artwork labels" in Settings governed the cortex and
        // Gallery but not the Page.
        const plain = mount({
            resolveCollection: async () => [work('a.jpg')],
            showOptionalLabels: false
        });
        plain.reader.render();
        await settle();
        expect(plain.host.querySelector('.page-figure-caption')).toBeNull();
        plain.reader.destroy();

        const cc = {
            name: 'Nebula',
            data: {
                url: 'n.jpg', title: 'Carina Nebula', artist: 'NASA/ESA',
                sourceName: 'ESA/Hubble', rightsBasis: 'CC BY 4.0', creditRequired: true
            }
        };
        const credited = mount({
            resolveCollection: async () => [cc],
            showOptionalLabels: false
        });
        credited.reader.render();
        await settle();
        const cap = credited.host.querySelector('.page-figure-caption');
        expect(cap).not.toBeNull();               // obligation survives the preference
        expect(cap.textContent).toContain('Carina Nebula');
        credited.reader.destroy();
    });

    it('an aborted reader stops filling figures', async () => {
        // Regression (red-team #2/#3): closing the Page must revoke work
        // it began, not merely disconnect the observer.
        const controller = new AbortController();
        const resolveCollection = vi.fn(async () => [work('a.jpg')]);
        const host = document.createElement('div');
        document.body.appendChild(host);
        const reader = new PageReader(host, {
            session, resolveCollection, signal: controller.signal
        });
        controller.abort();
        reader.render();
        await settle();
        expect(host.querySelector('.page-figure.is-shown')).toBeNull();
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
