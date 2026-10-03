// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Read } from './Read.js';

/**
 * Read is the one room for reading: the reader setup, the Chamber that shows a
 * compiled session, and the host of a live Current, as three panes. Each pane's
 * module is stubbed here, so no Player is built in jsdom.
 */
let container;
let read;
let capabilities;

class Stub {
    constructor(element, options) {
        this.element = element;
        this.options = options;
        this.destroyed = false;
    }
    destroy() { this.destroyed = true; }
}

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const chamberOperations = { name: 'chamber operations' };
    capabilities = {
        setup: { onBeginSession: () => {} },
        chamber: chamberOperations,
        live: { router: null },
        load: {
            setup: async () => ({ ChamberOrbital: class extends Stub { loadText(...args) { this.loaded = args; } } }),
            chamber: async () => ({
                createChamberSession: vi.fn(async (operations, element, session) => {
                    const chamber = new Stub(element, operations);
                    chamber.session = session;
                    chamber.handleEscape = () => true;
                    return chamber;
                })
            }),
            live: async () => ({ LiveHost: class extends Stub {} })
        }
    };
});

afterEach(() => {
    read?.destroy();
    read = null;
    document.body.innerHTML = '';
});

const pane = name => container.querySelector(`[data-pane="${name}"]`);

describe('Read', () => {
    it('opens on the setup pane with no work, and on the chamber with one', async () => {
        const chamberModule = await capabilities.load.chamber();
        capabilities.load.chamber = async () => chamberModule;
        read = new Read(container, { ...capabilities });
        await read.open({});
        expect(read.activePane).toBe('setup');
        await read.open({ workId: 'meditations' });
        expect(read.activePane).toBe('chamber');
        expect(chamberModule.createChamberSession).toHaveBeenCalledWith(capabilities.chamber, pane('chamber'), undefined);
    });

    it('opens the live host for a live Current', async () => {
        read = new Read(container, { ...capabilities });
        await read.open({ live: true });
        expect(read.activePane).toBe('live');
        await read.open({ pane: 'setup' });
        await read.update({ pane: 'live' });
        expect(read.activePane).toBe('live');
    });

    it('hands the chamber the session itself, never a copy', async () => {
        read = new Read(container, { ...capabilities });
        const session = { atoms: [{ text: 'one' }] };
        await read.open({ pane: 'chamber', session });
        expect(read.paneInstance('chamber').session).toBe(session);
    });

    it('loads the text the setup pane was opened with', async () => {
        read = new Read(container, { ...capabilities });
        await read.open({ pane: 'setup', text: 'Words', source: 'Pasted', config: { wpm: 200 } });
        expect(read.paneInstance('setup').loaded).toEqual(['Words', 'Pasted', { wpm: 200 }]);
    });

    it('keeps one of setup and chamber at a time, as their one container did, and keeps the live host', async () => {
        read = new Read(container, { ...capabilities });
        await read.open({ pane: 'live' });
        const live = read.paneInstance('live');
        await read.open({});
        const setup = read.paneInstance('setup');
        await read.open({ pane: 'chamber', session: { atoms: [1] } });
        expect(setup.destroyed).toBe(true);
        expect(pane('setup')).toBeNull();
        const chamber = read.paneInstance('chamber');
        await read.open({});
        expect(chamber.destroyed).toBe(true);
        expect(pane('chamber')).toBeNull();
        expect(live.destroyed).toBe(false);
        expect(read.paneInstance('live')).toBe(live);
    });

    it('closes a pane only while it still holds the instance named', async () => {
        read = new Read(container, { ...capabilities });
        await read.open({ pane: 'chamber', session: { atoms: [1] } });
        const first = read.paneInstance('chamber');
        await read.open({ pane: 'chamber', session: { atoms: [2] } });
        const second = read.paneInstance('chamber');
        expect(first.destroyed).toBe(true);
        read.closePane('chamber', first);
        expect(read.paneInstance('chamber')).toBe(second);
        read.closePane('chamber', second);
        expect(second.destroyed).toBe(true);
        expect(read.paneInstance('chamber')).toBeNull();
    });

    it('can close a reading and leave its element for the next one (a continuing division)', async () => {
        read = new Read(container, { ...capabilities });
        await read.open({ pane: 'chamber', session: { atoms: [1] } });
        const element = pane('chamber');
        const first = read.paneInstance('chamber');
        read.closePane('chamber', first, { keepElement: true });
        expect(first.destroyed).toBe(true);
        expect(pane('chamber')).toBe(element);
        await read.open({ pane: 'chamber', session: { atoms: [2] } });
        expect(read.paneInstance('chamber').element).toBe(element);
    });

    it('lets the pane on screen answer Escape', async () => {
        read = new Read(container, { ...capabilities });
        await read.open({});
        expect(read.handleEscape()).toBe(false);
        await read.open({ pane: 'chamber', session: { atoms: [1] } });
        expect(read.handleEscape()).toBe(true);
    });
});
