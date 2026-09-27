/**
 * The shelf as a list of works: one control per row, no per-row buttons,
 * no glyphs, and a designed state for every tab.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Library } from './Library.js';

let container = null;
let library = null;

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    library = new Library(container, { onSelectText: vi.fn(), onNavigate: () => {} });
});

afterEach(() => {
    document.querySelector('.toc-scrim')?.remove();
    library?.destroy();
    container?.remove();
});

describe('the shelf', () => {
    it('is a list of rows whose title is the one control', () => {
        const rows = [...container.querySelectorAll('.archive-card')];
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
            expect(row.tagName).toBe('LI');
            const controls = row.querySelectorAll('button, a');
            expect(controls).toHaveLength(1);
            expect(controls[0].dataset.action).toBe('select-text');
            expect(controls[0].textContent.trim()).toBe(row.querySelector('.archive-title').textContent.trim());
        }
    });

    it('has no filled buttons, glyph icons or repeated shelf tags', () => {
        const shelf = container.querySelector('.archive-divisions');
        expect(shelf.querySelector('.btn-primary')).toBeNull();
        expect(shelf.querySelector('.archive-status, .archive-type')).toBeNull();
        expect(shelf.textContent).not.toMatch(/[⌂◇◈]|Load Text|\bOpen\b/);
    });

    it('lines the title, tabs and rows up under the shared header', () => {
        expect(container.querySelector('.sl-header .sl-lockup')).not.toBeNull();
        const page = container.querySelector('.library-page');
        expect(page.querySelector('.library-back')).not.toBeNull();
        expect(page.querySelector('h1').textContent).toBe('Library');
        expect(page.querySelector('.library-nav')).not.toBeNull();
        expect(page.querySelector('#library-content')).not.toBeNull();
    });

    it('says when a work will not open', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        await library.handleTextSelection('no-such-work');
        expect(container.querySelector('[data-archive-alert] [role="alert"]').textContent)
            .toContain('could not be opened');
        vi.restoreAllMocks();
    });
});

describe('Your files', () => {
    const open = () => container.querySelector('[data-section="personal"]').click();

    it('shows loading, then a designed empty state', async () => {
        library.localState = 'loading';
        open();
        expect(container.querySelector('.library-status').textContent).toContain('Loading your files');
        await library.refreshLocalWorks();
        expect(container.querySelector('.library-status')).toBeNull();
        expect(container.querySelector('.upload-text').textContent).toBe('No files yet.');
        expect(container.querySelector('[data-action="choose-file"]')).not.toBeNull();
    });

    it('says so when the shelf cannot be read', async () => {
        const { LocalWorks } = await import('../core/local-work-store.js');
        vi.spyOn(LocalWorks, 'all').mockRejectedValue(new Error('blocked'));
        open();
        await library.refreshLocalWorks();
        expect(container.querySelector('#library-content [role="alert"]').textContent)
            .toContain('cannot be shown');
        vi.restoreAllMocks();
    });

    it('explains a refused file instead of doing nothing', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        open();
        await library.handleFileUpload({ name: 'notes.pdf', type: 'application/pdf', text: async () => '' });
        expect(container.querySelector('[data-local-alert]').textContent).toContain('.txt or .md');
        vi.restoreAllMocks();
    });
});

describe('Reflections', () => {
    it('has a plain empty state', () => {
        container.querySelector('[data-section="history"]').click();
        const empty = container.querySelector('.library-empty');
        expect(empty.textContent).toContain('No reflections yet.');
        expect(empty.textContent).not.toMatch(/[◌]/);
    });
});

describe('the contents sheet', () => {
    it('goes back to the Library, not the "Shelf"', async () => {
        await library.openWork('literary-meditations');
        const back = document.querySelector('.toc-close');
        expect(back.textContent.trim()).toBe('Library');
        expect(document.querySelector('.toc-sheet').textContent).not.toContain('Shelf');
    }, 60000);
});
