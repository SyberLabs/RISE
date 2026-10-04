// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Library } from './Library.js';

/**
 * The Library is the one room for the corpus programs: the Chapel, the
 * Rosary, the Stations, a journey, a keystone sequence, a minted sequence,
 * the day's poem and the provenance record each open as a pane inside it.
 */
let container;
let library;

const options = { onNavigate: () => {}, onSelectText: () => {}, getAudioEngine: () => null };
const paneCapabilities = {
    chapel: { onNavigate: () => {}, getAudioEngine: () => null },
    stations: { onNavigate: () => {}, getAudioEngine: () => null }
};

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});

afterEach(() => {
    library?.destroy();
    library = null;
    document.body.innerHTML = '';
    localStorage.clear();
});

describe('Library panes', () => {
    it('opens a chapel chapter as a pane of the Library', async () => {
        library = new Library(container, { ...options, paneCapabilities });
        await library.showPane('chapel', { bookId: 'genesis', chapter: 1 });
        expect(container.querySelector('[data-pane="chapel"]')).not.toBeNull();
        expect(library.activePane).toBe('chapel');
    });

    it('hides its own sections and the previous pane when another pane opens', async () => {
        library = new Library(container, { ...options, paneCapabilities });
        await library.showPane('chapel', {});
        expect(container.querySelector('.library-room').hidden).toBe(true);
        await library.showPane('stations', {});
        expect(container.querySelector('[data-pane="chapel"]').hidden).toBe(true);
        expect(container.querySelector('[data-pane="stations"]').hidden).toBe(false);
        expect(library.activePane).toBe('stations');

        await library.update({});
        expect(library.activePane).toBe(null);
        expect(container.querySelector('.library-room').hidden).toBe(false);
        expect(container.querySelector('[data-pane="stations"]').hidden).toBe(true);
    });

    it('deactivates the pane it leaves and activates the one it shows', async () => {
        library = new Library(container, { ...options, paneCapabilities });
        library.activate();
        await library.showPane('stations', {});
        const via = library.paneInstance('stations');
        const deactivate = vi.spyOn(via, 'deactivate');
        const activate = vi.spyOn(via, 'activate');
        await library.showPane('chapel', {});
        expect(deactivate).toHaveBeenCalledTimes(1);
        await library.showPane('stations', {});
        expect(activate).toHaveBeenCalledTimes(1);
    });

    it('forwards its own deactivation to the open pane', async () => {
        library = new Library(container, { ...options, paneCapabilities });
        library.activate();
        await library.showPane('stations', {});
        const deactivate = vi.spyOn(library.paneInstance('stations'), 'deactivate');
        library.deactivate();
        expect(deactivate).toHaveBeenCalledTimes(1);
    });

    it('destroys every mounted pane when it is destroyed', async () => {
        library = new Library(container, { ...options, paneCapabilities });
        await library.showPane('chapel', {});
        await library.showPane('stations', {});
        const chapel = vi.spyOn(library.paneInstance('chapel'), 'destroy');
        const stations = vi.spyOn(library.paneInstance('stations'), 'destroy');
        library.destroy();
        library = null;
        expect(chapel).toHaveBeenCalledTimes(1);
        expect(stations).toHaveBeenCalledTimes(1);
    });

    it('hands a mounted pane new data through its update hook', async () => {
        library = new Library(container, { ...options, paneCapabilities });
        await library.showPane('chapel', {});
        const chapel = library.paneInstance('chapel');
        const update = vi.spyOn(chapel, 'update');
        await library.showPane('chapel', { bookId: 'genesis', chapter: 2 });
        expect(library.paneInstance('chapel')).toBe(chapel);
        expect(update).toHaveBeenCalledWith({ bookId: 'genesis', chapter: 2 });
    });

    it('remounts a pane without an update hook when its data changes', async () => {
        library = new Library(container, { ...options, paneCapabilities });
        await library.showPane('stations', {});
        const first = library.paneInstance('stations');
        const destroy = vi.spyOn(first, 'destroy');
        await library.showPane('stations', {});
        expect(library.paneInstance('stations')).toBe(first);
        await library.showPane('stations', { door: true });
        expect(destroy).toHaveBeenCalledTimes(1);
        expect(library.paneInstance('stations')).not.toBe(first);
    });

    it('opens a pane from its update data, as the router hands it', async () => {
        library = new Library(container, { ...options, paneCapabilities });
        await library.update({ pane: 'chapel', bookId: 'genesis' });
        expect(library.activePane).toBe('chapel');
    });

    it('links each program from its head through the router', () => {
        const onNavigate = vi.fn();
        library = new Library(container, { ...options, onNavigate, paneCapabilities });
        container.querySelector('[data-open-pane="stations"]').click();
        expect(onNavigate).toHaveBeenCalledWith('library', { pane: 'stations' });
        const panes = [...container.querySelectorAll('[data-open-pane]')].map(b => b.dataset.openPane);
        expect(panes).toEqual(['chapel', 'rosary', 'stations', 'journeys', 'keystones', 'provenance']);
    });
});
