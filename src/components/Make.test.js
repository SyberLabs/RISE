// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Make } from './Make.js';

/**
 * Make is the one room for authoring: the Workshop, the Vault, the
 * Scriptorium, the Visual Lab and the Visual Catalog each open as a tab.
 */
let container;
let make;

const tabCapabilities = {
    workshop: { onNavigate: () => {} },
    vault: { onNavigate: () => {} },
    'visual-catalog': { onNavigate: () => {} }
};

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});

afterEach(() => {
    make?.destroy();
    make = null;
    document.body.innerHTML = '';
    localStorage.clear();
});

describe('Make tabs', () => {
    it('shows the workshop as a tab and keeps the vault mounted when switching', async () => {
        make = new Make(container, { tabCapabilities });
        await make.showTab('vault');
        await make.showTab('workshop');
        expect(make.activeTab).toBe('workshop');
        expect(container.querySelector('[data-pane="vault"]').hidden).toBe(true);
    });

    it('opens the tab named by the router, and the Workshop when none is named', async () => {
        make = new Make(container, { tabCapabilities });
        await make.update({ pane: 'visual-catalog', search: '?q=network' });
        expect(make.activeTab).toBe('visual-catalog');
        expect(container.querySelector('#visual-catalog-search').value).toBe('network');
        await make.update({});
        expect(make.activeTab).toBe('workshop');
    });

    it('marks the open tab and moves between tabs through the router', async () => {
        const onNavigate = vi.fn();
        make = new Make(container, { onNavigate, tabCapabilities });
        await make.showTab('vault');
        const tabs = [...container.querySelectorAll('.make-nav [data-tab]')];
        expect(tabs.map(tab => tab.dataset.tab))
            .toEqual(['workshop', 'vault', 'scriptorium', 'visual-lab', 'visual-catalog']);
        expect(container.querySelector('.make-nav [data-tab="vault"]').getAttribute('aria-current')).toBe('page');
        container.querySelector('.make-nav [data-tab="scriptorium"]').click();
        expect(onNavigate).toHaveBeenCalledWith('make', { pane: 'scriptorium' });
    });

    it('refreshes the open tab when the room is entered again with the same address', async () => {
        make = new Make(container, { tabCapabilities });
        await make.update({ pane: 'vault' });
        const update = vi.spyOn(make.tabInstance('vault'), 'update');
        await make.update({ pane: 'vault' });
        expect(update).toHaveBeenCalledWith({});
    });
});
