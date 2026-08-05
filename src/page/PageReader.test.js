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

/**
 * Pagination in the renderer (PAGE-MODE-SPEC §9).
 *
 * The cut itself is proven in paginator.test.js without a browser.
 * These assert only what the renderer is responsible for: that one
 * page's DOM is present at a time, that turning is possible and
 * reversible, and that nothing is lost between the first page and the
 * last.
 */
describe('PageReader pagination', () => {
    /** mount() constructs; this suite needs it rendered. */
    const paged = (options = {}) => {
        const m = mount(options);
        m.reader.render();
        return m;
    };

    const longSession = (paragraphs) => ({
        atoms: Array.from({ length: paragraphs }, (_, i) =>
            atom(`Paragraph ${i} — ${'word '.repeat(60)}`, { chapter: 1, verse: i + 1 })),
        visualProgram: null
    });

    it('renders one page and offers a way to the next', () => {
        const { reader, host } = paged({ session: longSession(60) });
        expect(reader.pages.length).toBeGreaterThan(1);

        const shown = host.querySelectorAll('.page-text').length;
        const total = reader.composition.items.filter(i => i.type === 'text').length;
        expect(shown, 'the whole reading is still in the DOM at once').toBeLessThan(total);

        expect(host.querySelector('.page-pager')).not.toBeNull();
        expect(host.querySelector('[data-page-nav="prev"]').disabled).toBe(true);
        expect(host.querySelector('[data-page-nav="next"]').disabled).toBe(false);
        reader.destroy();
    });

    it('turns forward and back, and the DOM follows', () => {
        const { reader, host } = paged({ session: longSession(60) });
        const firstText = host.querySelector('.page-text').textContent;

        reader.nextPage();
        expect(reader.pageIndex).toBe(1);
        expect(host.querySelector('.page-text').textContent).not.toBe(firstText);
        expect(host.querySelector('[data-page-nav="prev"]').disabled).toBe(false);

        reader.prevPage();
        expect(reader.pageIndex).toBe(0);
        expect(host.querySelector('.page-text').textContent).toBe(firstText);
        reader.destroy();
    });

    it('refuses to turn past either end rather than erroring', () => {
        const { reader } = paged({ session: longSession(60) });
        expect(reader.prevPage()).toBe(0);
        reader.goToPage(reader.pages.length - 1);
        const last = reader.pageIndex;
        expect(reader.nextPage()).toBe(last);
        reader.destroy();
    });

    it('loses nothing across every page', () => {
        const { reader } = paged({ session: longSession(60) });
        const seen = reader.pages.flatMap(p => p.items);
        expect(seen).toEqual(reader.composition.items);
        reader.destroy();
    });

    it('shows the masthead on the first page only — a title is not a running header', () => {
        const { reader, host } = paged({ session: longSession(60), title: 'A Reading' });
        expect(host.querySelector('.page-masthead')).not.toBeNull();
        reader.nextPage();
        expect(host.querySelector('.page-masthead')).toBeNull();
        reader.prevPage();
        expect(host.querySelector('.page-masthead')).not.toBeNull();
        reader.destroy();
    });

    it('names the reading once past the opening — a running head, not a masthead', () => {
        // Past page one nothing on screen said what was being read. The
        // head is furniture: the focal and the source line still belong
        // to the opening alone.
        const { reader, host } = paged({ session: longSession(60), title: 'Matthew' });
        expect(host.querySelector('.page-runner')).toBeNull();

        reader.nextPage();
        const runner = host.querySelector('.page-runner');
        expect(runner).not.toBeNull();
        expect(runner.textContent).toBe('Matthew');
        expect(host.querySelector('.page-masthead')).toBeNull();
        // The article is titled already; a reader should not meet the
        // name twice on every page.
        expect(runner.getAttribute('aria-hidden')).toBe('true');

        reader.prevPage();
        expect(host.querySelector('.page-runner')).toBeNull();
        reader.destroy();
    });

    it('a reading short enough to scroll, scrolls', () => {
        // PROJECTION BY LENGTH. A page boundary is a constraint the
        // compositor does not model — it can put a margin figure beside
        // a chapter opening, or wrap a heading where the column had room.
        // In a short reading that is pure loss: there was nothing to
        // bound. So it keeps its column.
        const { reader, host } = paged({ session: longSession(6) });
        expect(reader.isPaged).toBe(false);
        expect(reader.pages).toHaveLength(1);
        expect(host.querySelector('.page-pager')).toBeNull();
        const shown = host.querySelectorAll('.page-text').length;
        expect(shown).toBe(reader.composition.items.filter(i => i.type === 'text').length);
        reader.destroy();
    });

    it('a reading long enough for its overhead to matter, pages', () => {
        const { reader } = paged({ session: longSession(80) });
        expect(reader.isPaged).toBe(true);
        expect(reader.pages.length).toBeGreaterThan(4);
        reader.destroy();
    });

    it('the threshold is a tunable, not a constant buried in a branch', () => {
        const short = paged({ session: longSession(30), scrollUnderPages: 999 });
        expect(short.reader.isPaged).toBe(false);
        short.reader.destroy();

        const eager = paged({ session: longSession(30), scrollUnderPages: 0 });
        expect(eager.reader.isPaged).toBe(true);
        eager.reader.destroy();
    });

    it('Elongate turns a paged reading into one column, and back', () => {
        const { reader, host } = paged({ session: longSession(80) });
        expect(reader.isPaged).toBe(true);
        const total = reader.composition.items.filter(i => i.type === 'text').length;

        reader.setPaged(false);
        expect(reader.isPaged).toBe(false);
        expect(reader.pages).toHaveLength(1);
        expect(host.querySelectorAll('.page-text').length).toBe(total);

        reader.setPaged(true);
        expect(reader.isPaged).toBe(true);
        expect(host.querySelectorAll('.page-text').length).toBeLessThan(total);
        reader.destroy();
    });

    it('Elongate is not offered where there is no choice to make', () => {
        // "No choice" means the cut yields ONE page, so the projections
        // are the same object. A reading that scrolls but WOULD cut into
        // several still offers the choice — that is the point of it.
        const { reader } = paged({ session: longSession(1) });
        expect(reader.canPage).toBe(false);
        expect(reader.setPaged(true)).toBe(false);
        reader.destroy();
    });

    it('offers the choice on a reading that scrolls but could be paged', () => {
        const { reader } = paged({ session: longSession(6) });
        expect(reader.isPaged).toBe(false);   // short enough to scroll
        expect(reader.canPage).toBe(true);    // …and long enough to cut
        expect(reader.setPaged(true)).toBe(true);
        reader.destroy();
    });

    it('a short reading gets no pager at all', () => {
        const { reader, host } = paged();
        expect(reader.pages).toHaveLength(1);
        expect(host.querySelector('.page-pager')).toBeNull();
        expect(host.classList.contains('is-paginated')).toBe(false);
        reader.destroy();
    });

    it('paginated:false renders the whole column, for callers that need it', () => {
        // Print is the caller this exists for: a paged DOM would emit one
        // page and silently drop the rest of the reading.
        const { reader, host } = paged({ session: longSession(60), paginated: false });
        expect(reader.pages).toHaveLength(1);
        const shown = host.querySelectorAll('.page-text').length;
        const total = reader.composition.items.filter(i => i.type === 'text').length;
        expect(shown).toBe(total);
        expect(host.querySelector('.page-pager')).toBeNull();
        reader.destroy();
    });
});
